/**
 * lib/knowledge-map.ts —— 知识地图覆盖校验（design C4 / Requirements 2.6）。
 *
 * 对应 tasks.md 4.6、Correctness Property 4。
 * Validates: Requirements 2.6
 *
 * 规则：通过当且仅当每个主线节都至少映射到一个知识领域。任一未映射的主线节
 * （映射缺失，或映射存在但其领域列表为空 / 全为空白）都被记录为 `unmapped-chapter`。
 *
 * 本模块为纯函数，输入主线节列表与映射表，输出未映射节的发现列表。
 */

import type { AuditFinding } from "./types";

/**
 * 判断某主线节是否「至少映射到一个知识领域」。
 * 有效领域 = 非空白字符串。映射缺失、空数组、全空白数组均判为未映射。
 */
function hasAtLeastOneArea(areas: readonly string[] | undefined): boolean {
  if (!areas) return false;
  return areas.some((a) => typeof a === "string" && a.trim().length > 0);
}

/**
 * 校验主线节的知识领域覆盖完整性。
 *
 * @param mainlineChapters 主线节标识列表（如文件名或节号）
 * @param mapping 主线节 → 知识领域列表的映射表
 * @returns 未映射主线节的发现列表；为空表示全部主线节均已映射 ≥1 知识领域。
 *          每条发现 `kind` 为 `unmapped-chapter`，`sourceFile` 取该主线节标识。
 */
export function checkKnowledgeMapCoverage(
  mainlineChapters: string[],
  mapping: Record<string, string[]>,
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const chapter of mainlineChapters) {
    // Object.prototype.hasOwnProperty 防御原型链上的同名键。
    const areas = Object.prototype.hasOwnProperty.call(mapping, chapter)
      ? mapping[chapter]
      : undefined;

    if (!hasAtLeastOneArea(areas)) {
      findings.push({
        kind: "unmapped-chapter",
        sourceFile: chapter,
        detail: `主线节「${chapter}」未映射到任何知识领域`,
      });
    }
  }

  return findings;
}
