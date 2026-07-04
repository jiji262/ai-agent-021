// Feature: ai-agent-course-v2-rewrite, Property 12: 编号映射正确性（mapFileToTitleNumber/checkTitleNumber）
// Validates: Requirements 7.1
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapFileToTitleNumber, checkTitleNumber } from "../lib/numbering";
import type { ChapterKind } from "../lib/types";

/**
 * 属性：由文件名推导的 NumberingEntry 与独立参照实现一致，且 checkTitleNumber
 * 通过当且仅当传入的实际标题节号等于映射推导的期望节号。
 *
 * 映射规则（design DM2）：
 * - extras/ 下的编号文件 → kind=extra，titleNumber = fileNumber（offset 0）
 * - 无前导数字（如 faq.md）→ kind=faq，titleNumber = null
 * - 顶层编号 0 → prologue（null）、1 → intro（null）、30 → epilogue（null）
 * - 顶层编号 ∈ 其余（含 02..29 及区间外）→ mainline，titleNumber = fileNumber − 1
 *
 * 生成器覆盖 00..30 全部文件号、区间外越界号（31/40/99）、extras/ 路径、
 * 无数字文件名、混合分隔符等。
 */

// 独立参照：由 (inExtras, num) 推导期望 kind。
function expectedKind(inExtras: boolean, num: number | null): ChapterKind {
  if (inExtras) return "extra";
  if (num === null) return "faq";
  if (num === 0) return "prologue";
  if (num === 1) return "intro";
  if (num === 30) return "epilogue";
  return "mainline";
}

// 独立参照：由 (kind, num) 推导期望 titleNumber。
function expectedTitleNumber(kind: ChapterKind, num: number | null): number | null {
  if (num === null) return null;
  if (kind === "mainline") return num - 1;
  if (kind === "extra") return num;
  return null; // prologue / intro / epilogue / faq
}

// 文件号生成器：覆盖 00..30 全部 + 区间外越界号。
const numberArb = fc.oneof(
  fc.integer({ min: 0, max: 30 }),
  fc.constantFrom(31, 40, 99, 7),
);

const slugArb = fc.constantFrom(
  "prologue",
  "introduction",
  "what-is-agent",
  "tool-calling",
  "deploy-and-beyond",
  "epilogue",
  "x",
);

// 顶层编号文件：NN-slug.md（NN 两位补零）。
const topNumberedArb = fc
  .record({ num: numberArb, slug: slugArb })
  .map(({ num, slug }) => ({
    fileName: `${String(num).padStart(2, "0")}-${slug}.md`,
    inExtras: false,
    num,
  }));

// extras/ 编号文件：extras/0N-slug.md。
const extrasArb = fc
  .record({ num: fc.integer({ min: 1, max: 9 }), slug: slugArb })
  .map(({ num, slug }) => ({
    fileName: `extras/${String(num).padStart(2, "0")}-${slug}.md`,
    inExtras: true,
    num,
  }));

// 无前导数字的特殊页：faq.md / readme 风格。
const noNumberArb = fc.constantFrom("faq.md", "glossary.md", "appendix.md").map(
  (fileName) => ({ fileName, inExtras: false, num: null as number | null }),
);

const caseArb = fc.oneof(topNumberedArb, extrasArb, noNumberArb);

describe("Property 12: 编号映射正确性", () => {
  it("mapFileToTitleNumber 推导的 kind/fileNumber/titleNumber 与参照一致", () => {
    fc.assert(
      fc.property(caseArb, ({ fileName, inExtras, num }) => {
        const entry = mapFileToTitleNumber(fileName);
        const kind = expectedKind(inExtras, num);
        const titleNumber = expectedTitleNumber(kind, num);

        expect(entry.kind).toBe(kind);
        expect(entry.fileNumber).toBe(num);
        expect(entry.titleNumber).toBe(titleNumber);
      }),
      { numRuns: 100 },
    );
  });

  it("checkTitleNumber 通过当且仅当实际标题节号 == 期望节号", () => {
    // 随机给定一个「实际标题节号」（含 null 与各种整数），断言判定与期望一致。
    const headingArb = fc.oneof(
      fc.constant<number | null>(null),
      fc.integer({ min: -1, max: 31 }),
    );
    fc.assert(
      fc.property(caseArb, headingArb, ({ fileName }, heading) => {
        const expected = mapFileToTitleNumber(fileName).titleNumber;
        expect(checkTitleNumber(fileName, heading)).toBe(expected === heading);
      }),
      { numRuns: 100 },
    );
  });
});
