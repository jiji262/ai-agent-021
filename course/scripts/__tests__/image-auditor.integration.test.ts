// Feature: ai-agent-course-v2-rewrite — ImageAuditor 集成/冒烟测试（任务 5.2）
// Validates: Requirements 6.6
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { auditImages } from "../audit-images";
import type { ImageAuditFinding, OrphanImage } from "../lib/types";

/**
 * 集成测试：对真实 `course/` 目录端到端跑 auditImages，验证 I/O 适配层接线正确，
 * 产出结构化报告且各字段齐全、类型正确。
 *
 * 说明：当前课程图片尚未完成迁移，预期存在缺失/逃逸/孤立/密度问题，故**不**断言
 * passed=true；只断言报告结构完整、各发现良构、passed 与发现列表一致。
 */

// scripts/__tests__ → 上两级即 course/。
const here = dirname(fileURLToPath(import.meta.url));
const courseDir = join(here, "..", "..");

describe("ImageAuditor 集成测试（真实 course/）", () => {
  it("course/ 目录存在", () => {
    expect(existsSync(courseDir)).toBe(true);
    expect(existsSync(join(courseDir, "images"))).toBe(true);
  });

  it("auditImages 返回结构完整的 ImageAuditReport", () => {
    const report = auditImages(courseDir);

    // 顶层字段齐全且类型正确。
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.orphans)).toBe(true);
    expect(Array.isArray(report.densityViolations)).toBe(true);
    expect(typeof report.passed).toBe("boolean");

    // 每条 finding 良构。
    const validFindingKinds = new Set<ImageAuditFinding["kind"]>([
      "missing-image",
      "bad-image-path",
      "unreadable-chapter",
      "density-violation",
    ]);
    for (const f of report.findings) {
      expect(validFindingKinds.has(f.kind)).toBe(true);
      expect(typeof f.chapterFile).toBe("string");
      expect(f.chapterFile.length).toBeGreaterThan(0);
      expect(typeof f.detail).toBe("string");
    }

    // 每条孤立图良构。
    for (const o of report.orphans as OrphanImage[]) {
      expect(typeof o.filePath).toBe("string");
      expect(o.filePath.startsWith("images/")).toBe(true);
    }

    // 每条密度发现良构。
    for (const d of report.densityViolations) {
      expect(d.kind).toBe("density-violation");
      expect(typeof d.chapterFile).toBe("string");
    }

    // passed 与发现列表一致（不强制 passed=true）。
    const allEmpty =
      report.findings.length === 0 &&
      report.orphans.length === 0 &&
      report.densityViolations.length === 0;
    expect(report.passed).toBe(allEmpty);
  });
});
