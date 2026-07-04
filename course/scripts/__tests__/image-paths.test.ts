import { describe, it, expect } from "vitest";
import {
  parseImageRefs,
  classifyImagePath,
  resolveRefPath,
  countImageDensity,
  isExternalPath,
} from "../lib/image-paths";

/**
 * image-paths 原语单元测试（任务 2.2）：覆盖具体示例与畸形输入边界。
 */

describe("parseImageRefs", () => {
  it("提取 alt、rawPath 与 1 基行号", () => {
    const md = ["# 标题", "", "![封面](images/hero.png)", "正文"].join("\n");
    const refs = parseImageRefs(md, "12-tool.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      chapterFile: "12-tool.md",
      rawPath: "images/hero.png",
      alt: "封面",
      line: 3,
    });
  });

  it("支持空 alt 与空路径", () => {
    const md = "![](images/a.png) 与 ![x]()";
    const refs = parseImageRefs(md, "c.md");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ alt: "", rawPath: "images/a.png" });
    expect(refs[1]).toMatchObject({ alt: "x", rawPath: "" });
  });

  it("剥离可选标题，仅保留 URL", () => {
    const md = '![c](images/a.png "封面标题")';
    const refs = parseImageRefs(md, "c.md");
    expect(refs[0]?.rawPath).toBe("images/a.png");
  });

  it("保留查询串与锚点", () => {
    const md = "![c](images/a.png?v=2#frag)";
    const refs = parseImageRefs(md, "c.md");
    expect(refs[0]?.rawPath).toBe("images/a.png?v=2#frag");
  });

  it("支持中文文件名", () => {
    const md = "![小结](images/小结卡片.png)";
    const refs = parseImageRefs(md, "c.md");
    expect(refs[0]?.rawPath).toBe("images/小结卡片.png");
  });

  it("未闭合括号安全跳过，不抛错", () => {
    const md = "![alt](images/a.png 这里没有右括号";
    expect(() => parseImageRefs(md, "c.md")).not.toThrow();
    expect(parseImageRefs(md, "c.md")).toHaveLength(0);
  });

  it("多行中正确计算各引用行号", () => {
    const md = ["![a](images/a.png)", "", "", "![b](../images/b.png)"].join("\n");
    const refs = parseImageRefs(md, "c.md");
    expect(refs.map((r) => r.line)).toEqual([1, 4]);
  });
});

describe("classifyImagePath（scope 感知）", () => {
  it("top: images/x → compliant；../images/x → escaping", () => {
    expect(classifyImagePath("images/x.png", "top")).toBe("compliant");
    expect(classifyImagePath("./images/x.png", "top")).toBe("compliant");
    expect(classifyImagePath("../images/x.png", "top")).toBe("escaping");
  });

  it("nested: ../images/x → compliant；images/x → escaping", () => {
    expect(classifyImagePath("../images/x.png", "nested")).toBe("compliant");
    expect(classifyImagePath("images/x.png", "nested")).toBe("escaping");
  });

  it("外部 / 绝对 / 协议相对 / data → external", () => {
    expect(classifyImagePath("https://cdn/x.png", "top")).toBe("external");
    expect(classifyImagePath("http://cdn/x.png", "nested")).toBe("external");
    expect(classifyImagePath("//cdn/x.png", "top")).toBe("external");
    expect(classifyImagePath("/abs/x.png", "top")).toBe("external");
    expect(classifyImagePath("data:image/png;base64,AAA", "top")).toBe("external");
  });

  it("空路径 / 纯锚点 → invalid", () => {
    expect(classifyImagePath("", "top")).toBe("invalid");
    expect(classifyImagePath("   ", "nested")).toBe("invalid");
    expect(classifyImagePath("#sec", "top")).toBe("invalid");
  });

  it("剥离查询串/锚点后仍正确分类", () => {
    expect(classifyImagePath("images/x.png?v=1", "top")).toBe("compliant");
    expect(classifyImagePath("../images/x.png#frag", "nested")).toBe("compliant");
  });

  it("深层逃逸 / 其他子目录 → escaping", () => {
    expect(classifyImagePath("../../images/x.png", "top")).toBe("escaping");
    expect(classifyImagePath("shared/x.png", "top")).toBe("escaping");
  });

  it("混合分隔符（反斜杠）等价处理", () => {
    expect(classifyImagePath("images\\x.png", "top")).toBe("compliant");
    expect(classifyImagePath("..\\images\\x.png", "nested")).toBe("compliant");
  });
});

describe("resolveRefPath", () => {
  it("顶层章节 + images/ → images/", () => {
    expect(resolveRefPath("12-tool.md", "images/a.png")).toBe("images/a.png");
  });

  it("顶层章节 + ../images/ → 保留逃逸 ../images/", () => {
    expect(resolveRefPath("12-tool.md", "../images/a.png")).toBe("../images/a.png");
  });

  it("extras 章节 + ../images/ → images/（解析回 course/images）", () => {
    expect(resolveRefPath("extras/01-admin.md", "../images/a.png")).toBe(
      "images/a.png"
    );
  });

  it("extras 章节 + images/ → extras/images/（错误位置）", () => {
    expect(resolveRefPath("extras/01-admin.md", "images/a.png")).toBe(
      "extras/images/a.png"
    );
  });

  it("剥离查询串/锚点并归一化分隔符", () => {
    expect(resolveRefPath("12-tool.md", "images\\a.png?v=1#x")).toBe("images/a.png");
  });
});

describe("countImageDensity", () => {
  const mk = (rawPath: string) => ({
    chapterFile: "c.md",
    rawPath,
    alt: "",
    line: 1,
  });

  it("统计总数与 hero/summary 存在性（大小写不敏感）", () => {
    const refs = [
      mk("images/hero-cover.png"),
      mk("images/Summary.png"),
      mk("images/diagram.png"),
      mk("images/flow.svg"),
      mk("images/x.png"),
    ];
    expect(countImageDensity(refs)).toEqual({
      total: 5,
      hasHero: true,
      hasSummary: true,
    });
  });

  it("无 hero/summary 时为 false", () => {
    const refs = [mk("images/a.png"), mk("images/b.png")];
    expect(countImageDensity(refs)).toEqual({
      total: 2,
      hasHero: false,
      hasSummary: false,
    });
  });

  it("hero/summary 匹配基于文件名而非目录", () => {
    const refs = [mk("images/hero/x.png")];
    // 目录名含 hero 但文件名不含 → hasHero=false
    expect(countImageDensity(refs).hasHero).toBe(false);
  });

  it("空列表", () => {
    expect(countImageDensity([])).toEqual({
      total: 0,
      hasHero: false,
      hasSummary: false,
    });
  });
});

describe("isExternalPath", () => {
  it("识别外部/绝对/协议相对/scheme", () => {
    expect(isExternalPath("https://x/a.png")).toBe(true);
    expect(isExternalPath("//x/a.png")).toBe(true);
    expect(isExternalPath("/abs/a.png")).toBe(true);
    expect(isExternalPath("data:image/png;base64,A")).toBe(true);
  });

  it("本地相对路径不是外部", () => {
    expect(isExternalPath("images/a.png")).toBe(false);
    expect(isExternalPath("../images/a.png")).toBe(false);
    expect(isExternalPath("./a.png")).toBe(false);
  });
});
