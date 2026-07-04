import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseInterviewQuestions } from "../lib/interview";

/**
 * 安全正文字符池：中文 + 英文字母数字 + 安全标点，排除会破坏题块结构的字符
 * （`*`、`【`、`】`、`<`、`>`、反引号），从而保证拼出的题面/解答不会产生伪题头
 * 或提前闭合 <details>。
 */
const SAFE_CHARS =
  "你我他的是在和与对工具调用模型推理上下文协议评测安全成本部署abcXYZ0123456789，。、？！：；（）和流式记忆";

const safeText = fc
  .array(fc.constantFrom(...SAFE_CHARS.split("")), { minLength: 1, maxLength: 40 })
  .map((arr) => arr.join(""));

const difficultyArb = fc.constantFrom("基础", "进阶", "深挖");
const topicArb = fc.constantFrom(
  "Tool Calling 协议",
  "MCP",
  "RAG",
  "Agent vs Chatbot",
  "安全护栏",
);

describe("Property 5: 面试题解析往返", () => {
  it("由 N 个合规题块拼成的文本恰恢复 N 道题，且每题题面与参考解答非空", () => {
    // Feature: ai-agent-course-v2-rewrite, Property 5
    // Validates: Requirements 3.2
    const blockArb = fc.record({
      difficulty: difficultyArb,
      topic: topicArb,
      question: safeText,
      answer: safeText,
    });

    fc.assert(
      fc.property(
        fc.array(blockArb, { minLength: 1, maxLength: 8 }),
        fc.string(),
        (blocks, chapterFile) => {
          const text = blocks
            .map(
              (b, i) =>
                `**Q${i + 1}.【${b.difficulty}】【主题：${b.topic}】** ${b.question}\n` +
                `<details><summary>参考解答</summary>\n\n${b.answer}\n\n</details>`,
            )
            .join("\n\n");

          const parsed = parseInterviewQuestions(text, chapterFile);

          // 恰恢复 N 道题。
          expect(parsed.length).toBe(blocks.length);

          for (let i = 0; i < parsed.length; i++) {
            const q = parsed[i]!;
            const src = blocks[i]!;
            // 题面与参考解答非空。
            expect(q.question.trim().length).toBeGreaterThan(0);
            expect(q.answer.trim().length).toBeGreaterThan(0);
            // 解析出的字段与源题块一致。
            expect(q.difficulty).toBe(src.difficulty);
            expect(q.topic).toBe(src.topic);
            expect(q.question).toBe(src.question);
            expect(q.answer).toBe(src.answer);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
