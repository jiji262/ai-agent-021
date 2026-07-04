/**
 * 图片集合审计原语（任务 2.5，Requirements 6.1/6.2/6.6）。
 *
 * 本模块为纯函数层：输入引用集合与路径集合，输出审计发现，无任何 I/O。
 * 路径一律以相对 course/ 的 POSIX 形式表达，与 resolveRefPath 的输出对齐。
 *
 * 提供两个原语：
 * - findMissingImages：返回解析后不存在于磁盘集合中的引用（缺失图片）
 * - findOrphanImages：集合差，返回磁盘存在但无人引用的图片（孤立图片）
 */

import type { ImageRef, ImageAuditFinding, OrphanImage } from "./types";
import { resolveRefPath, isExternalPath } from "./image-paths";

/**
 * 缺失图片审计（Requirements 6.1/6.2）。
 *
 * 对每条本地图片引用，用 `resolveRefPath` 解析为相对 course/ 的路径，
 * 若该路径不在 `existingPaths` 集合中，则记录一条 `missing-image` 发现，
 * 含触发引用的 `chapterFile`、原始 `rawPath` 与解析后的 `resolvedPath`。
 *
 * 外部引用（http(s)/data/绝对路径等）与空路径不参与存在性比对，跳过：
 * 它们的规范性问题由 `classifyImagePath` / 路径审计负责，不属缺失图片范畴。
 *
 * @param refs          全部图片引用
 * @param existingPaths 磁盘上实际存在的图片路径集合（相对 course/，POSIX）
 */
export function findMissingImages(
  refs: ImageRef[],
  existingPaths: Set<string>
): ImageAuditFinding[] {
  const findings: ImageAuditFinding[] = [];
  for (const ref of refs) {
    const raw = ref.rawPath.trim();
    if (raw === "" || raw.startsWith("#")) continue; // 空路径/纯锚点：非缺失图片范畴
    if (isExternalPath(raw)) continue; // 外部引用不做存在性比对

    const resolved = resolveRefPath(ref.chapterFile, ref.rawPath);
    if (!existingPaths.has(resolved)) {
      findings.push({
        kind: "missing-image",
        chapterFile: ref.chapterFile,
        rawPath: ref.rawPath,
        resolvedPath: resolved,
        detail: `图片引用解析为 ${resolved}，但该文件不存在于 course/images/`,
      });
    }
  }
  return findings;
}

/**
 * 孤立图片审计（Requirements 6.6）。
 *
 * 返回严格的集合差：`diskPaths − referencedPaths`，即磁盘上存在但
 * 未被任何 Chapter 引用的图片文件。结果按路径升序、去重。
 *
 * @param diskPaths       磁盘上的图片文件路径列表（相对 course/，POSIX）
 * @param referencedPaths 被引用并解析到的图片路径集合（相对 course/，POSIX）
 */
export function findOrphanImages(
  diskPaths: string[],
  referencedPaths: Set<string>
): OrphanImage[] {
  const orphans: string[] = [];
  const seen = new Set<string>();
  for (const filePath of diskPaths) {
    if (referencedPaths.has(filePath)) continue;
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    orphans.push(filePath);
  }
  orphans.sort();
  return orphans.map((filePath) => ({ filePath }));
}
