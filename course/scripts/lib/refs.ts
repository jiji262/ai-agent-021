/**
 * 跨节引用解析原语（任务 3.3，Requirements 1.8/2.7/7.2/7.3/7.4）。
 *
 * 本模块为纯函数层：输入 Markdown / 数据结构，输出数据结构，无任何 I/O。
 * 路径一律以 POSIX 风格、相对 `course/` 表达。
 *
 * 提供四个原语：
 * - parseCrossRefs：解析章节中指向其他章节的相对路径链接
 * - parseReadmeTocLinks：解析 README 目录里的章节链接
 * - resolveRefPath：把「来源文件相对路径 + 链接相对路径」解析为相对 course/ 的规范路径
 * - findBrokenRefs：找出目标不存在（或指向 V1）的断链
 *
 * 为避免与 image-paths 模块产生耦合/import 循环，本模块自带一份轻量
 * resolveRefPath 实现（仅服务于章节链接解析）。
 */

import type { CrossRef, BrokenRef } from "./types";

// ============================================================================
// V1 历史版本文件名（恒判为断链 / 不合规）
// ============================================================================

/**
 * V1_Course 根目录 15 章的文件名集合（basename）。
 *
 * 删除 V1 后，任何指向这些文件名的引用都属于残留 / 断链，恒判为不合规
 * （Requirements 1.8/7.7）。集合以 basename 比对，不区分链接写法
 * （`./00-introduction.md`、`../00-introduction.md`、`00-introduction.md`
 * 都视为指向 V1）。
 */
export const V1_CHAPTER_FILES: ReadonlySet<string> = new Set([
  "00-introduction.md",
  "01-what-is-ai-agent.md",
  "02-tech-stack-choices.md",
  "03-prompt-engineering.md",
  "04-tool-system.md",
  "05-rule-engine.md",
  "06-agent-memory.md",
  "07-frontend-integration.md",
  "08-debugging-observability.md",
  "09-evals-and-regression.md",
  "09-security-and-cost.md",
  "10-responses-and-mcp.md",
  "11-mcp-in-practice.md",
  "12-rag-and-agentic-retrieval.md",
  "13-multi-agent-patterns.md",
  "14-deploy-and-beyond.md",
]);

// ============================================================================
// 内部工具
// ============================================================================

/**
 * 去掉路径中的查询串（`?...`）与锚点（`#...`）。
 */
function stripQueryAnchor(path: string): string {
  let end = path.length;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c === "#" || c === "?") {
      end = i;
      break;
    }
  }
  return path.slice(0, end);
}

/**
 * 从 Markdown 链接括号内的内容剥离可选标题，仅保留 URL 部分。
 * 例如 `12-tool.md "工具调用"` → `12-tool.md`。
 */
function stripTitle(inside: string): string {
  const trimmed = inside.trim();
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) return trimmed;
  const rest = trimmed.slice(spaceIdx + 1).trimStart();
  if (rest.startsWith('"') || rest.startsWith("'")) {
    return trimmed.slice(0, spaceIdx);
  }
  return trimmed;
}

/**
 * 计算字符串中 `index` 之前的行号（1 基）。
 */
function countLines(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/**
 * 取相对 course/ 的文件所在目录（POSIX）。顶层文件返回空串。
 */
function dirOf(file: string): string {
  const norm = file.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? "" : norm.slice(0, idx);
}

/**
 * 取路径 basename（先剥离查询串/锚点、归一化分隔符）。
 */
function basenameOf(rawPath: string): string {
  const clean = stripQueryAnchor(rawPath).replace(/\\/g, "/");
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? clean : clean.slice(idx + 1);
}

/**
 * 规范化 POSIX 相对/绝对路径，处理 `.` 与 `..` 段。
 * 逃出根（相对路径）时保留前导 `../`；绝对路径越过根则忽略多余 `..`。
 */
function normalizePosix(path: string): string {
  const isAbsolute = path.startsWith("/");
  const parts = path.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      const last = out.length > 0 ? out[out.length - 1] : undefined;
      if (last !== undefined && last !== "..") {
        out.pop();
      } else if (!isAbsolute) {
        out.push("..");
      }
    } else {
      out.push(part);
    }
  }
  return (isAbsolute ? "/" : "") + out.join("/");
}

/**
 * 判定一个原始链接是否为外部 / 绝对引用（非本地相对链接）。
 * 命中：协议相对 `//host`、绝对路径 `/abs`、带 scheme（`http:`/`mailto:` 等）。
 */
function isExternalLink(rawPath: string): boolean {
  const p = rawPath.trim();
  if (p.startsWith("//")) return true;
  if (p.startsWith("/")) return true;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p)) return true;
  return false;
}

/**
 * 判定一个链接目标是否指向章节（`.md` 文件）。
 * 仅章节链接参与跨节引用解析；图片/资源/外链不在此列。
 */
function isChapterLink(rawPath: string): boolean {
  const clean = stripQueryAnchor(rawPath).replace(/\\/g, "/").trim();
  if (clean === "") return false;
  return /\.md$/i.test(clean);
}

/**
 * 通用链接提取：返回所有 `[text](dest)` 链接，排除图片（`![]()`）与外链。
 * 仅保留指向 `.md` 章节的相对链接。
 */
function extractChapterLinks(markdown: string, sourceFile: string): CrossRef[] {
  const refs: CrossRef[] = [];
  // 匹配 [text](dest)；text 不含 ]；dest 不含 )。
  const re = /\[([^\]]*)\]\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    // 排除图片链接：`![text](dest)`（`!` 紧贴 `[` 之前）。
    if (m.index > 0 && markdown[m.index - 1] === "!") {
      if (m.index === re.lastIndex) re.lastIndex++;
      continue;
    }
    const text = m[1] ?? "";
    const rawPath = stripTitle(m[2] ?? "");
    if (!isExternalLink(rawPath) && isChapterLink(rawPath)) {
      refs.push({
        sourceFile,
        rawPath,
        text,
        line: countLines(markdown, m.index),
      });
    }
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return refs;
}

// ============================================================================
// 原语 1：parseCrossRefs
// ============================================================================

/**
 * 解析章节中指向其他章节的相对路径链接（Requirements 7.2）。
 *
 * 识别 `[text](./xx.md)`、`[text](xx.md)`、`[text](../xx.md)` 等指向 `.md`
 * 章节文件的相对链接；排除：
 * - 图片引用 `![alt](path)`
 * - 外部链接（http(s)/mailto/协议相对/绝对路径）
 * - 非 `.md` 目标（锚点、资源文件等）
 *
 * @param markdown   章节 Markdown 文本
 * @param sourceFile 该章节相对 course/ 的路径（如 `12-tool-calling.md`）
 */
export function parseCrossRefs(markdown: string, sourceFile: string): CrossRef[] {
  return extractChapterLinks(markdown, sourceFile);
}

// ============================================================================
// 原语 2：parseReadmeTocLinks
// ============================================================================

/**
 * 解析 README 目录里的章节链接（Requirements 7.4）。
 *
 * 与 parseCrossRefs 同源（同样只取指向 `.md` 的相对链接、排除图片与外链），
 * 来源文件固定标注为 `README.md`，便于断链报告定位。
 *
 * @param readmeMarkdown README 的 Markdown 文本
 */
export function parseReadmeTocLinks(readmeMarkdown: string): CrossRef[] {
  return extractChapterLinks(readmeMarkdown, "README.md");
}

// ============================================================================
// 原语 3：resolveRefPath
// ============================================================================

/**
 * 把「来源文件相对路径 + 链接相对路径」解析为相对 course/ 的规范 POSIX 路径，
 * 用于与真实 Chapter 文件集合做存在性比对。
 *
 * 会先剥离查询串/锚点、归一化分隔符；逃出 course/ 时保留前导 `../`。
 * 例如：
 * - resolveRefPath("12-tool.md", "./13-zod.md")        → "13-zod.md"
 * - resolveRefPath("12-tool.md", "README.md")          → "README.md"
 * - resolveRefPath("extras/01.md", "../12-tool.md")    → "12-tool.md"
 * - resolveRefPath("12-tool.md", "../00-introduction.md") → "../00-introduction.md"
 */
export function resolveRefPath(sourceFile: string, rawPath: string): string {
  const cleanRaw = stripQueryAnchor(rawPath).replace(/\\/g, "/").trim();
  const dir = dirOf(sourceFile);
  const joined = dir === "" ? cleanRaw : `${dir}/${cleanRaw}`;
  return normalizePosix(joined);
}

// ============================================================================
// 原语 4：findBrokenRefs
// ============================================================================

/**
 * 找出断链（Requirements 1.8/2.7/7.3）。
 *
 * 对每条跨节引用：
 * 1. 若其 basename 命中 V1_Course 文件名（`V1_CHAPTER_FILES`），恒判为断链
 *    （指向已删除的历史版本，Requirements 1.8/7.7）。
 * 2. 否则用 resolveRefPath 解析为相对 course/ 的路径，若该路径不在
 *    `existingSet` 中，则记一条断链。
 *
 * 每条断链记录来源 `sourceFile`、原始 `rawPath` 与解析后的 `targetPath`。
 *
 * @param refs        跨节引用集合（来自 parseCrossRefs / parseReadmeTocLinks）
 * @param existingSet 真实存在的 Chapter 文件路径集合（相对 course/，POSIX）
 */
export function findBrokenRefs(
  refs: CrossRef[],
  existingSet: Set<string>
): BrokenRef[] {
  const broken: BrokenRef[] = [];
  for (const ref of refs) {
    const targetPath = resolveRefPath(ref.sourceFile, ref.rawPath);
    const base = basenameOf(ref.rawPath);
    const pointsToV1 = V1_CHAPTER_FILES.has(base);
    if (pointsToV1 || !existingSet.has(targetPath)) {
      broken.push({
        sourceFile: ref.sourceFile,
        rawPath: ref.rawPath,
        targetPath,
      });
    }
  }
  return broken;
}
