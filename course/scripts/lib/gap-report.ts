/**
 * lib/gap-report.ts —— V1→V2 缺口报告的迁移决策良构校验（design C1 / DM3）。
 *
 * 对应 tasks.md 4.1、Correctness Property 1。
 * Validates: Requirements 1.3, 1.4
 *
 * 不变式（design DM3）：
 * - `covered=true`  ⇒ 不得带 `decision`（已覆盖条目不记录迁移决策，AC 1.4）
 * - `covered=false` ⇒ 须恰带一个决策 ∈ {merge_into, drop}
 *   （对应缺口报告中文表述「并入指定 V2 章节」/「明确放弃并附理由」，AC 1.3）
 * - `decision=merge_into` ⇒ 须带非空 `targetChapter`（并入须指明目标章节）
 *
 * 本模块为纯函数，输入决策记录列表，输出违规发现列表（空列表 = 全部良构）。
 */

import type { AuditFinding, MigrationDecision } from "./types";

/** 合法的迁移决策取值集合。 */
const VALID_DECISIONS = new Set(["merge_into", "drop"]);

/**
 * 判断字符串是否为「非空」（去除首尾空白后长度 > 0）。
 * 用于 targetChapter 的存在性判定，避免把空串/纯空白当作有效目标章节。
 */
function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 校验一组 V1→V2 迁移决策记录的良构性。
 *
 * @param entries 迁移决策记录列表
 * @returns 违规发现列表；为空表示全部条目良构。每条发现的 `kind` 为
 *          `invalid-gap-decision`，`sourceFile` 取该条目的 `v1Source`，
 *          `detail` 说明具体违规原因。
 */
export function validateGapDecision(
  entries: MigrationDecision[],
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const entry of entries) {
    const sourceFile = entry.v1Source;
    // 运行时读取 decision（类型上为可选枚举，但生成器/脏数据可能给越界值）。
    const decision = entry.decision as unknown;
    const hasDecision = decision !== undefined && decision !== null;

    if (entry.covered) {
      // 已覆盖条目不得记录任何迁移决策（AC 1.4）。
      if (hasDecision) {
        findings.push({
          kind: "invalid-gap-decision",
          sourceFile,
          detail: `已覆盖条目（covered=true）不得带迁移决策，却出现 decision=${String(
            decision,
          )}`,
        });
      }
      continue;
    }

    // 以下为 covered=false 分支：须恰带一个合法决策（AC 1.3）。
    if (!hasDecision) {
      findings.push({
        kind: "invalid-gap-decision",
        sourceFile,
        detail:
          "未覆盖条目（covered=false）必须记录迁移决策（merge_into 或 drop），却缺省",
      });
      continue;
    }

    if (typeof decision !== "string" || !VALID_DECISIONS.has(decision)) {
      findings.push({
        kind: "invalid-gap-decision",
        sourceFile,
        detail: `迁移决策越界：期望 merge_into 或 drop，实际为 ${String(decision)}`,
      });
      continue;
    }

    // decision=merge_into 须带非空 targetChapter（并入须指明目标章节）。
    if (decision === "merge_into" && !isNonEmpty(entry.targetChapter)) {
      findings.push({
        kind: "invalid-gap-decision",
        sourceFile,
        detail: "decision=merge_into 必须带非空 targetChapter（并入的目标 V2 章节）",
      });
    }
  }

  return findings;
}
