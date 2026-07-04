import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateGapDecision } from "../lib/gap-report";
import type { MigrationDecision } from "../lib/types";

/**
 * 独立 oracle：判断单条迁移决策是否良构（与 lib 实现独立推导，避免同义重复）。
 * - covered=true  ⇒ 不得带 decision
 * - covered=false ⇒ decision ∈ {merge_into, drop}，且 merge_into 须带非空 targetChapter
 */
function isWellFormed(e: MigrationDecision): boolean {
  const decision = e.decision as unknown;
  const hasDecision = decision !== undefined && decision !== null;
  if (e.covered) return !hasDecision;
  if (!hasDecision) return false;
  if (decision !== "merge_into" && decision !== "drop") return false;
  if (decision === "merge_into") {
    return typeof e.targetChapter === "string" && e.targetChapter.trim().length > 0;
  }
  return true;
}

describe("Property 1: 缺口报告决策有效性", () => {
  it("validateGapDecision 通过（零发现）当且仅当每条决策均良构；发现数恰等于不良构条目数", () => {
    // Feature: ai-agent-course-v2-rewrite, Property 1
    // Validates: Requirements 1.3, 1.4
    const decisionArb = fc.constantFrom<unknown>(
      undefined,
      "merge_into",
      "drop",
      "MERGE_INTO",
      "并入",
      "",
    );
    const targetArb = fc.constantFrom<unknown>(
      undefined,
      "",
      "   ",
      "07-minimal-agent.md",
      "第 5 节",
    );

    const entryArb = fc
      .record({
        v1Source: fc.string(),
        knowledgePoint: fc.string(),
        covered: fc.boolean(),
        decision: decisionArb,
        targetChapter: targetArb,
        rationale: fc.string(),
      })
      .map((o) => o as unknown as MigrationDecision);

    fc.assert(
      fc.property(fc.array(entryArb, { maxLength: 30 }), (entries) => {
        const findings = validateGapDecision(entries);
        const invalidCount = entries.filter((e) => !isWellFormed(e)).length;

        // 通过当且仅当全部良构。
        expect(findings.length === 0).toBe(entries.every(isWellFormed));
        // 每条不良构条目恰产生一条发现。
        expect(findings.length).toBe(invalidCount);
        // 发现类型一致。
        for (const f of findings) {
          expect(f.kind).toBe("invalid-gap-decision");
        }
      }),
      { numRuns: 100 },
    );
  });
});
