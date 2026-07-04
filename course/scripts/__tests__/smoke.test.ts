import { describe, it, expect } from "vitest";
import type { ImageAuditReport, ConsistencyAuditReport } from "../lib/types";

/**
 * 占位冒烟测试：确认 vitest 工程接线正确、共享类型可被导入。
 * 后续任务（2.2+）会逐步替换/补充为真实的原语单元测试与属性测试。
 */
describe("course-audit 工程冒烟", () => {
  it("vitest runner 正常工作", () => {
    expect(true).toBe(true);
  });

  it("共享数据模型类型可用于构造空报告", () => {
    const imageReport: ImageAuditReport = {
      findings: [],
      orphans: [],
      densityViolations: [],
      passed: true,
    };
    const consistencyReport: ConsistencyAuditReport = {
      numberingMismatches: [],
      brokenRefs: [],
      readmeBrokenLinks: [],
      termViolations: [],
      residualV1Refs: [],
      structureFindings: [],
      passed: true,
    };

    expect(imageReport.passed).toBe(true);
    expect(consistencyReport.passed).toBe(true);
  });
});
