// Feature: ai-agent-course-v2-rewrite, Property 13: 审计报告通过判定不变量（computePassed）
// Validates: Requirements 7.8
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computePassed } from "../lib/report";
import type {
  AuditFinding,
  BrokenRef,
  ConsistencyAuditReport,
  ImageAuditFinding,
  ImageAuditReport,
  TermViolation,
} from "../lib/types";

// 图片审计专用 dummy（含 ImageAuditFinding 必需的 chapterFile 字段）。
const dummyImageFinding: ImageAuditFinding = {
  kind: "missing-image",
  chapterFile: "x.md",
  detail: "d",
};

/**
 * 属性：computePassed(report) 为真当且仅当报告中所有「数组型发现列表」字段均为空。
 * 存在任一非空发现列表 → 必为假。
 *
 * 生成器随机填充 ImageAuditReport 与 ConsistencyAuditReport 的各发现列表为
 * 空/非空组合，并附带随机的非数组字段（如旧的 passed 布尔、字符串元数据）以
 * 确认非数组字段不影响判定。
 */

const dummyFinding: AuditFinding = {
  kind: "missing-section",
  sourceFile: "x.md",
  detail: "d",
};
const dummyBroken: BrokenRef = {
  sourceFile: "x.md",
  rawPath: "y.md",
  targetPath: "y.md",
};
const dummyTerm: TermViolation = { sourceFile: "x.md", hit: "v1", line: 1 };

// 0/1/2 长度的数组生成器（覆盖空与非空）。
function listArb<T>(item: T): fc.Arbitrary<T[]> {
  return fc.nat({ max: 2 }).map((n) => Array.from({ length: n }, () => item));
}

describe("Property 13: computePassed 通过判定不变量", () => {
  it("ImageAuditReport：passed ⟺ 所有发现列表为空", () => {
    fc.assert(
      fc.property(
        listArb(dummyImageFinding),
        listArb<{ filePath: string }>({ filePath: "images/o.png" }),
        listArb(dummyImageFinding),
        fc.boolean(),
        (findings, orphans, densityViolations, stalePassed) => {
          const report: ImageAuditReport = {
            findings,
            orphans,
            densityViolations,
            passed: stalePassed, // 旧值，不应影响重算
          };
          const allEmpty =
            findings.length === 0 &&
            orphans.length === 0 &&
            densityViolations.length === 0;
          expect(computePassed(report)).toBe(allEmpty);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("ConsistencyAuditReport：passed ⟺ 全部六类发现列表为空", () => {
    fc.assert(
      fc.property(
        listArb(dummyFinding),
        listArb(dummyBroken),
        listArb(dummyBroken),
        listArb(dummyTerm),
        listArb(dummyFinding),
        listArb(dummyFinding),
        (
          numberingMismatches,
          brokenRefs,
          readmeBrokenLinks,
          termViolations,
          residualV1Refs,
          structureFindings,
        ) => {
          const report: ConsistencyAuditReport = {
            numberingMismatches,
            brokenRefs,
            readmeBrokenLinks,
            termViolations,
            residualV1Refs,
            structureFindings,
            passed: true, // 旧值，不应影响重算
          };
          const allEmpty =
            numberingMismatches.length === 0 &&
            brokenRefs.length === 0 &&
            readmeBrokenLinks.length === 0 &&
            termViolations.length === 0 &&
            residualV1Refs.length === 0 &&
            structureFindings.length === 0;
          expect(computePassed(report)).toBe(allEmpty);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("非数组字段（字符串/布尔/数字）不影响判定", () => {
    fc.assert(
      fc.property(
        listArb(dummyFinding),
        fc.string(),
        fc.boolean(),
        fc.integer(),
        (findings, meta, flag, n) => {
          const report = {
            findings,
            meta,
            passed: flag,
            count: n,
          } as Record<string, unknown>;
          expect(computePassed(report)).toBe(findings.length === 0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
