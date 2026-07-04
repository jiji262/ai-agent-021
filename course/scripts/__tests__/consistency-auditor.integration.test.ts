// Feature: ai-agent-course-v2-rewrite — ConsistencyAuditor 集成/冒烟测试（任务 5.4）
// Validates: Requirements 7.7
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { auditConsistency } from "../audit-consistency";

/**
 * 集成测试：对真实 `course/` 目录端到端跑 auditConsistency，验证 I/O 适配层接线
 * 正确，产出结构化报告且各发现列表（编号/断链/README 链接/术语漂移/残留 V1/
 * 结构缺段）字段齐全、类型正确。
 *
 * 说明：内容仍在重写中，预期存在不一致项，故**不**断言 passed=true；只断言报告
 * 结构完整、各发现良构、passed 与全部发现列表一致。
 */

const here = dirname(fileURLToPath(import.meta.url));
const courseDir = join(here, "..", "..");

describe("ConsistencyAuditor 集成测试（真实 course/）", () => {
  it("course/ 目录存在", () => {
    expect(existsSync(courseDir)).toBe(true);
  });

  it("auditConsistency 返回结构完整的 ConsistencyAuditReport", () => {
    const report = auditConsistency(courseDir);

    // 六类发现列表 + passed 字段齐全且类型正确。
    expect(Array.isArray(report.numberingMismatches)).toBe(true);
    expect(Array.isArray(report.brokenRefs)).toBe(true);
    expect(Array.isArray(report.readmeBrokenLinks)).toBe(true);
    expect(Array.isArray(report.termViolations)).toBe(true);
    expect(Array.isArray(report.residualV1Refs)).toBe(true);
    expect(Array.isArray(report.structureFindings)).toBe(true);
    expect(typeof report.passed).toBe("boolean");

    // 编号不一致发现良构。
    for (const f of report.numberingMismatches) {
      expect(f.kind).toBe("numbering-mismatch");
      expect(typeof f.sourceFile).toBe("string");
      expect(typeof f.detail).toBe("string");
    }

    // 断链 / README 断链良构。
    for (const b of [...report.brokenRefs, ...report.readmeBrokenLinks]) {
      expect(typeof b.sourceFile).toBe("string");
      expect(typeof b.rawPath).toBe("string");
      expect(typeof b.targetPath).toBe("string");
    }

    // 术语违规良构。
    for (const t of report.termViolations) {
      expect(typeof t.hit).toBe("string");
      expect(t.hit.length).toBeGreaterThan(0);
      expect(t.line).toBeGreaterThanOrEqual(1);
    }

    // 残留 V1 引用良构。
    for (const r of report.residualV1Refs) {
      expect(r.kind).toBe("residual-v1-ref");
      expect(typeof r.sourceFile).toBe("string");
    }

    // passed 与全部发现列表一致（不强制 passed=true）。
    const allEmpty =
      report.numberingMismatches.length === 0 &&
      report.brokenRefs.length === 0 &&
      report.readmeBrokenLinks.length === 0 &&
      report.termViolations.length === 0 &&
      report.residualV1Refs.length === 0 &&
      report.structureFindings.length === 0;
    expect(report.passed).toBe(allEmpty);
  });
});
