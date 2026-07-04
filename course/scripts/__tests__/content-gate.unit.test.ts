import { describe, it, expect } from "vitest";
import { validateGapDecision } from "../lib/gap-report";
import { parseInterviewQuestions, validateQuestionMeta } from "../lib/interview";
import { checkKnowledgeMapCoverage } from "../lib/knowledge-map";
import { countWords, checkWordGate } from "../lib/wordcount";
import type { MigrationDecision } from "../lib/types";

describe("validateGapDecision 单元用例", () => {
  it("良构条目集合产生零发现", () => {
    const entries: MigrationDecision[] = [
      {
        v1Source: "00-introduction.md",
        knowledgePoint: "Agent 定义",
        covered: true,
        rationale: "V2 第 2 节已覆盖",
      },
      {
        v1Source: "03-react.md",
        knowledgePoint: "ReAct 循环",
        covered: false,
        decision: "merge_into",
        targetChapter: "04-react.md",
        rationale: "并入第 3 节",
      },
      {
        v1Source: "09-legacy.md",
        knowledgePoint: "过时部署脚本",
        covered: false,
        decision: "drop",
        rationale: "技术已淘汰",
      },
    ];
    expect(validateGapDecision(entries)).toEqual([]);
  });

  it("covered=true 却带 decision → 记一条发现", () => {
    const entries = [
      {
        v1Source: "x.md",
        knowledgePoint: "k",
        covered: true,
        decision: "drop",
        rationale: "r",
      },
    ] as unknown as MigrationDecision[];
    const findings = validateGapDecision(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.kind).toBe("invalid-gap-decision");
  });

  it("merge_into 缺 targetChapter → 记一条发现", () => {
    const entries: MigrationDecision[] = [
      {
        v1Source: "x.md",
        knowledgePoint: "k",
        covered: false,
        decision: "merge_into",
        rationale: "r",
      },
    ];
    expect(validateGapDecision(entries)).toHaveLength(1);
  });

  it("covered=false 缺 decision → 记一条发现", () => {
    const entries: MigrationDecision[] = [
      {
        v1Source: "x.md",
        knowledgePoint: "k",
        covered: false,
        rationale: "r",
      },
    ];
    expect(validateGapDecision(entries)).toHaveLength(1);
  });
});

describe("parseInterviewQuestions 解析鲁棒性", () => {
  const sample = `## 面试题

**Q1.【基础】【主题：Tool Calling 协议】** 为什么说"LLM 从来不执行代码"？
<details><summary>参考解答</summary>

LLM 只输出结构化意图，真正执行的是服务端。

</details>

**Q2.【进阶】【主题：MCP】** MCP 的传输层有哪些？
<details><summary>参考解答</summary>

stdio 与 Streamable HTTP。

</details>
`;

  it("解析出 2 道题并正确推导 id 前缀与字段", () => {
    const qs = parseInterviewQuestions(sample, "12-tool-calling.md");
    expect(qs).toHaveLength(2);
    expect(qs[0]!.id).toBe("12-Q1");
    expect(qs[0]!.difficulty).toBe("基础");
    expect(qs[0]!.topic).toBe("Tool Calling 协议");
    expect(qs[0]!.question).toContain("LLM 从来不执行代码");
    expect(qs[0]!.answer).toContain("结构化意图");
    expect(qs[1]!.id).toBe("12-Q2");
    expect(qs[1]!.topic).toBe("MCP");
  });

  it("缺 <details> 时 answer 为空串（交校验器判缺解答）", () => {
    const md = `**Q1.【基础】【主题：RAG】** 什么是 RAG？`;
    const qs = parseInterviewQuestions(md, "27-rag.md");
    expect(qs).toHaveLength(1);
    expect(qs[0]!.answer).toBe("");
    expect(qs[0]!.question).toContain("什么是 RAG");
  });

  it("兼容半角冒号的主题标记", () => {
    const md = `**Q1.【深挖】【主题:安全护栏】** 题面\n<details><summary>参考解答</summary>解答</details>`;
    const qs = parseInterviewQuestions(md, "20-guardrails.md");
    expect(qs[0]!.topic).toBe("安全护栏");
  });

  it("无前导数字的文件名退化为去扩展名 stem", () => {
    const md = `**Q1.【基础】【主题：MCP】** 题\n<details><summary>参考解答</summary>答</details>`;
    const qs = parseInterviewQuestions(md, "faq.md");
    expect(qs[0]!.id).toBe("faq-Q1");
  });

  it("空文本解析出零题", () => {
    expect(parseInterviewQuestions("", "12-x.md")).toEqual([]);
  });
});

describe("validateQuestionMeta 单元用例", () => {
  const topics = new Set(["Tool Calling 协议", "MCP"]);
  it("良构题零发现", () => {
    expect(
      validateQuestionMeta(
        {
          id: "12-Q1",
          chapterFile: "12.md",
          difficulty: "基础",
          topic: "MCP",
          question: "q",
          answer: "a",
        },
        topics,
      ),
    ).toEqual([]);
  });
});

describe("checkKnowledgeMapCoverage 单元用例", () => {
  it("全部已映射 → 零发现", () => {
    const findings = checkKnowledgeMapCoverage(["02", "03"], {
      "02": ["Agent vs Chatbot"],
      "03": ["ReAct"],
    });
    expect(findings).toEqual([]);
  });

  it("存在未映射节 → 记录该节", () => {
    const findings = checkKnowledgeMapCoverage(["02", "03"], {
      "02": ["Agent vs Chatbot"],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.sourceFile).toBe("03");
  });
});

describe("countWords 统计口径", () => {
  it("中文按字计", () => {
    expect(countWords("你好世界")).toBe(4);
  });

  it("英文按词计", () => {
    expect(countWords("hello world streamText")).toBe(3);
  });

  it("中英混排：中文字数 + 英文词数", () => {
    // 「用 的 是」3 个中文字 + streamText 1 词 = 4
    expect(countWords("用 streamText 的是")).toBe(4);
  });

  it("剔除围栏代码块", () => {
    const md = "中文一\n```ts\nconst a = streamText();\nconst b = 1;\n```\n中文二";
    // 仅「中文一」「中文二」共 6 个中文字计入。
    expect(countWords(md)).toBe(6);
  });

  it("剔除行内代码", () => {
    expect(countWords("调用 `streamText` 方法")).toBe(4); // 调 用 方 法
  });

  it("剔除图片引用（alt 与路径都不计）", () => {
    expect(countWords("![本节封面 hero](images/02-hero.png)正文两字")).toBe(4); // 正 文 两 字
  });

  it("链接只计显示文字不计 URL", () => {
    // 「详见第五节」5 字，URL 内 token 不计
    expect(countWords("[详见第五节](./05-architecture.md)")).toBe(5);
  });

  it("剔除 HTML 注释（图片说明原料）", () => {
    const md = "正文\n<!-- 图片说明：infographic style flat -->\n收尾";
    expect(countWords(md)).toBe(4); // 正 文 收 尾
  });

  it("标点与空白不计入", () => {
    expect(countWords("，。、？！ \n\t")).toBe(0);
  });
});

describe("checkWordGate 单元用例", () => {
  it("区间内通过", () => {
    expect(checkWordGate(5000)).toBeNull();
  });
  it("偏少返回发现并标注方向", () => {
    const f = checkWordGate(100);
    expect(f).not.toBeNull();
    expect(f!.detail).toContain("偏少");
  });
  it("偏多返回发现并标注方向", () => {
    const f = checkWordGate(9000);
    expect(f).not.toBeNull();
    expect(f!.detail).toContain("偏多");
  });
});
