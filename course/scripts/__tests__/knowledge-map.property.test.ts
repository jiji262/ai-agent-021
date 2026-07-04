import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { checkKnowledgeMapCoverage } from "../lib/knowledge-map";

describe("Property 4: 知识地图覆盖完整性", () => {
  it("通过（零发现）当且仅当每个主线节都至少映射到一个非空知识领域；未映射节恰被记录", () => {
    // Feature: ai-agent-course-v2-rewrite, Property 4
    // Validates: Requirements 2.6
    const chapterArb = fc.string({ minLength: 1, maxLength: 12 });

    // 每个主线节随机给定一种映射形态，覆盖「未映射 / 已映射」两类。
    const mappingValueArb = fc.oneof(
      fc.constant<undefined>(undefined), // 缺映射 → 未映射
      fc.constant<string[]>([]), // 空数组 → 未映射
      fc.constant<string[]>(["   ", ""]), // 全空白 → 未映射
      fc.array(fc.constantFrom("推理", "工具", "记忆", "评测"), {
        minLength: 1,
        maxLength: 3,
      }), // 有效领域 → 已映射
    );

    fc.assert(
      fc.property(
        fc.uniqueArray(chapterArb, { maxLength: 20 }),
        fc.array(mappingValueArb, { maxLength: 20 }),
        (chapters, values) => {
          const mapping: Record<string, string[]> = {};
          chapters.forEach((ch, i) => {
            const v = values[i % Math.max(values.length, 1)];
            if (v !== undefined) mapping[ch] = v;
          });

          const findings = checkKnowledgeMapCoverage(chapters, mapping);

          const expectedUnmapped = chapters.filter((ch) => {
            // 用 hasOwnProperty 防御 "valueOf"/"toString" 等原型链属性名，
            // 与 checkKnowledgeMapCoverage 的实现保持一致。
            const areas = Object.prototype.hasOwnProperty.call(mapping, ch)
              ? mapping[ch]
              : undefined;
            return (
              !areas ||
              !areas.some((a) => typeof a === "string" && a.trim().length > 0)
            );
          });

          // 通过当且仅当全部主线节均已映射 ≥1 有效领域。
          expect(findings.length === 0).toBe(expectedUnmapped.length === 0);
          // 发现数恰等于未映射节数。
          expect(findings.length).toBe(expectedUnmapped.length);
          for (const f of findings) {
            expect(f.kind).toBe("unmapped-chapter");
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
