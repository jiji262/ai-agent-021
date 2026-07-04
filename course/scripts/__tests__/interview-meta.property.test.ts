import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateQuestionMeta } from "../lib/interview";
import type { Difficulty, InterviewQuestion } from "../lib/types";

/** 知识地图主题集（测试固定子集）。 */
const TOPICS = new Set([
  "Tool Calling 协议",
  "MCP",
  "RAG",
  "Agent vs Chatbot",
  "安全护栏",
]);

describe("Property 6: 面试题元数据校验", () => {
  it("通过（零发现）当且仅当难度 ∈ 三值枚举 且 主题 ∈ 知识地图主题集 且 题面/解答非空", () => {
    // Feature: ai-agent-course-v2-rewrite, Property 6
    // Validates: Requirements 3.3, 3.4
    const difficultyArb = fc.constantFrom<string>(
      "基础",
      "进阶",
      "深挖",
      "中级", // 越界
      "困难", // 越界
      "", // 越界
    );
    const topicArb = fc.constantFrom<string>(
      "Tool Calling 协议",
      "MCP",
      "RAG",
      "安全护栏",
      "未知主题", // 越界
      "工具", // 越界
    );
    const textArb = fc.oneof(
      fc.constant(""), // 空
      fc.constant("   "), // 纯空白（视为空）
      fc.constantFrom("题面正文", "参考解答正文", "abc"),
    );

    const qArb = fc
      .record({
        difficulty: difficultyArb,
        topic: topicArb,
        question: textArb,
        answer: textArb,
      })
      .map(
        (o) =>
          ({
            id: "12-Q1",
            chapterFile: "12-tool-calling.md",
            difficulty: o.difficulty as Difficulty,
            topic: o.topic,
            question: o.question,
            answer: o.answer,
          }) satisfies InterviewQuestion,
      );

    fc.assert(
      fc.property(qArb, (q) => {
        const findings = validateQuestionMeta(q, TOPICS);

        const difficultyOk =
          q.difficulty === "基础" ||
          q.difficulty === "进阶" ||
          q.difficulty === "深挖";
        const topicOk = TOPICS.has(q.topic);
        const questionOk = q.question.trim().length > 0;
        const answerOk = q.answer.trim().length > 0;
        const allOk = difficultyOk && topicOk && questionOk && answerOk;

        // 通过当且仅当四项均良构。
        expect(findings.length === 0).toBe(allOk);
        for (const f of findings) {
          expect(f.kind).toBe("invalid-question-meta");
        }
      }),
      { numRuns: 100 },
    );
  });
});
