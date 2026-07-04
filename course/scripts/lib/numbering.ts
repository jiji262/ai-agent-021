/**
 * 编号映射原语（任务 3.1，Requirements 7.1）。
 *
 * 本模块为纯函数层：输入字符串 / 数据结构，输出数据结构，无任何 I/O。
 * 文件名一律以 POSIX 风格、相对 `course/` 表达（如 `12-tool-calling.md`、
 * `extras/01-admin-cms.md`）。
 *
 * 对应 design.md 的 Data Models DM2（NumberingMap）。映射规则：
 * | 文件名模式            | kind      | titleNumber 规则        |
 * |-----------------------|-----------|-------------------------|
 * | `NN-*.md`，NN ∈ 02..29 | mainline  | 标题节号 = fileNumber − 1 |
 * | `00-prologue.md`      | prologue  | 无节号（null）          |
 * | `01-introduction.md`  | intro     | 无节号（null）          |
 * | `30-epilogue.md`      | epilogue  | 无节号（null）          |
 * | `extras/0N-*.md`      | extra     | 加餐序号 = fileNumber    |
 * | `faq.md`              | faq       | 无节号（null）          |
 *
 * 提供两个原语：
 * - mapFileToTitleNumber：由文件名推导 NumberingEntry（kind / fileNumber / titleNumber）
 * - checkTitleNumber：判定实际标题节号是否符合映射
 */

import type { ChapterKind, NumberingEntry, NumberingRule } from "./types";

// ============================================================================
// 编号推导规则（DM2 的数据化表达）
// ============================================================================

/**
 * 各 Chapter 类别的编号推导规则。
 * - `hasNumber`：该类标题是否带节号（决定 titleNumber 是否为 null）
 * - `titleOffset`：标题节号 = fileNumber + titleOffset（仅当 hasNumber 为真时生效）
 *
 * 主线节标题比文件名少 1（offset = −1）；加餐标题节号直接等于文件名号（offset = 0）；
 * 开篇词 / 序章 / 结束语 / FAQ 无节号。
 */
export const NUMBERING_RULES: Record<ChapterKind, NumberingRule> = {
  mainline: { kind: "mainline", hasNumber: true, titleOffset: -1 },
  extra: { kind: "extra", hasNumber: true, titleOffset: 0 },
  prologue: { kind: "prologue", hasNumber: false, titleOffset: 0 },
  intro: { kind: "intro", hasNumber: false, titleOffset: 0 },
  epilogue: { kind: "epilogue", hasNumber: false, titleOffset: 0 },
  faq: { kind: "faq", hasNumber: false, titleOffset: 0 },
};

// ============================================================================
// 内部工具
// ============================================================================

/**
 * 归一化分隔符并取相对路径的 basename（文件名部分）。
 * 例如 `extras/01-admin-cms.md` → `01-admin-cms.md`。
 */
function basenameOf(fileName: string): string {
  const norm = fileName.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}

/**
 * 判定文件是否位于 `extras/` 目录下（相对 course/）。
 */
function isInExtras(fileName: string): boolean {
  return fileName.replace(/\\/g, "/").startsWith("extras/");
}

/**
 * 从 basename 解析前导数字（如 `09-security-and-cost.md` → 9）。
 * 无前导数字（如 `faq.md`）返回 null。
 */
function leadingNumber(base: string): number | null {
  const m = /^(\d+)/.exec(base);
  if (m === null) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * 由文件名与解析出的编号推导 Chapter 类别。
 *
 * 归类优先级：
 * 1. `faq.md`（无前导数字、basename 以 `faq` 起始）→ faq
 * 2. `extras/` 目录下的文件 → extra
 * 3. 编号 0 → prologue；1 → intro；30 → epilogue
 * 4. 编号 ∈ 02..29 → mainline
 * 5. 其他带前导数字的顶层文件 → 按通用「顶层编号正文」处理（mainline 规则，offset −1）
 * 6. 无前导数字且非 extras 的其他特殊页 → faq（无节号兜底）
 *
 * 说明：文档化的主线编号区间是 02..29；区间外的编号文件按通用编号规则（offset −1）
 * 处理，便于审计运行器对越界输入稳健返回而非抛错。
 */
function deriveKind(
  inExtras: boolean,
  num: number | null
): ChapterKind {
  if (inExtras) return "extra";
  if (num === null) return "faq";
  if (num === 0) return "prologue";
  if (num === 1) return "intro";
  if (num === 30) return "epilogue";
  return "mainline";
}

// ============================================================================
// 原语 1：mapFileToTitleNumber
// ============================================================================

/**
 * 由文件名推导编号映射条目（NumberingEntry）。
 *
 * @param fileName 相对 course/ 的文件名（POSIX），如 `12-tool-calling.md`、
 *                 `extras/02-postmortems.md`、`00-prologue.md`、`faq.md`
 * @returns NumberingEntry：含 `kind`、`fileNumber`（无前导数字为 null）、
 *          `titleNumber`（特殊页为 null；主线 = fileNumber − 1；加餐 = fileNumber）
 */
export function mapFileToTitleNumber(fileName: string): NumberingEntry {
  const file = fileName.replace(/\\/g, "/");
  const base = basenameOf(file);
  const inExtras = isInExtras(file);
  const fileNumber = leadingNumber(base);
  const kind = deriveKind(inExtras, fileNumber);

  const rule = NUMBERING_RULES[kind];
  const titleNumber =
    rule.hasNumber && fileNumber !== null ? fileNumber + rule.titleOffset : null;

  return { file, kind, fileNumber, titleNumber };
}

// ============================================================================
// 原语 2：checkTitleNumber
// ============================================================================

/**
 * 判定某文件的实际标题节号是否符合编号映射。
 *
 * @param fileName      相对 course/ 的文件名
 * @param headingNumber 从标题中解析出的实际节号（无节号标题传 null）
 * @returns 实际节号与映射推导的期望节号一致时为 true。
 *          特殊页（开篇/序章/结束语/FAQ）当且仅当 `headingNumber === null` 通过；
 *          主线节当且仅当 `headingNumber === fileNumber − 1` 通过。
 */
export function checkTitleNumber(
  fileName: string,
  headingNumber: number | null
): boolean {
  const entry = mapFileToTitleNumber(fileName);
  return entry.titleNumber === headingNumber;
}
