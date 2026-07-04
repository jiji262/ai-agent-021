/**
 * 报告通过判定原语（任务 3.7，Requirements 7.8/7.9）。
 *
 * 本模块为纯函数层：输入审计报告，输出布尔判定，无任何 I/O。
 *
 * 提供一个通用原语：
 * - computePassed：当且仅当报告内所有「发现列表」字段均为空时返回 true
 *
 * 设计为能同时接受 ImageAuditReport、ConsistencyAuditReport、AuditReport 以及
 * 任意带发现列表字段的报告结构（如 findings / orphans / densityViolations /
 * numberingMismatches / brokenRefs / readmeBrokenLinks / termViolations /
 * residualV1Refs / structureFindings 等）。
 */

import type {
  AuditReport,
  ImageAuditReport,
  ConsistencyAuditReport,
} from "./types";

/**
 * 可被 `computePassed` 判定的报告：任意对象，其各「发现列表」字段为数组。
 * 既覆盖既有报告类型，也允许未来新增字段而无需改本函数。
 */
export type AuditLikeReport =
  | AuditReport
  | ImageAuditReport
  | ConsistencyAuditReport
  | Record<string, unknown>;

/**
 * 通用门禁判定（Requirements 7.8/7.9）。
 *
 * 判定逻辑：遍历报告对象的全部自有可枚举属性，凡值为**数组**的字段都视为
 * 一个「发现列表」；当且仅当所有这些发现列表均为空数组时返回 true。
 *
 * 这样设计的好处：
 * - 同时适配 ImageAuditReport（findings/orphans/densityViolations）与
 *   ConsistencyAuditReport（numberingMismatches/brokenRefs/readmeBrokenLinks/
 *   termViolations/residualV1Refs/structureFindings），无需逐类型分支。
 * - 报告自带的 `passed` 布尔字段不是数组，自然被忽略（本函数据发现列表重新
 *   计算 `passed`，不信任传入的旧 `passed` 值）。
 * - 未来新增任何发现列表字段都会被自动纳入判定，免维护。
 *
 * @param report 任意审计报告对象
 * @returns 所有发现列表均为空时为 true；存在任一非空发现列表时为 false
 */
export function computePassed(report: AuditLikeReport): boolean {
  for (const value of Object.values(report as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) {
      return false;
    }
  }
  return true;
}
