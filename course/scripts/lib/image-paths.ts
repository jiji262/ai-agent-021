/**
 * 图片引用解析与路径分类原语（任务 2.2，Requirements 6.1/6.3/6.4/6.5）。
 *
 * 本模块为纯函数层：输入字符串 / 数据结构，输出数据结构，无任何 I/O。
 * 所有路径一律以 POSIX 风格、相对 `course/` 表达。
 *
 * 提供四个原语：
 * - parseImageRefs：从 Markdown 提取所有 `![alt](path)` 图片引用
 * - classifyImagePath：scope 感知的路径合规分类
 * - resolveRefPath：把「章节相对路径 + 引用相对路径」解析为相对 course/ 的规范路径
 * - countImageDensity：统计图片数量与 hero/summary 引用存在性
 */

import type { ImageRef, ImagePathScope, ImagePathClass } from "./types";

// ============================================================================
// 内部工具
// ============================================================================

/**
 * 去掉路径中的查询串（`?...`）与锚点（`#...`）。
 * 取第一个 `?` 或 `#` 出现处截断，二者皆无则原样返回。
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
 * 把 Markdown 链接括号内的内容剥离可选标题，仅保留 URL 部分。
 * 例如 `images/a.png "封面"` → `images/a.png`。
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
 * 例如 `extras/01-admin.md` → `extras`；`12-tool.md` → ``。
 */
function dirOf(file: string): string {
  const norm = file.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? "" : norm.slice(0, idx);
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
      // 绝对路径越过根：忽略。
    } else {
      out.push(part);
    }
  }
  return (isAbsolute ? "/" : "") + out.join("/");
}

/**
 * 判定一个原始路径是否为外部 / 绝对引用（非本地课程图片文件）。
 * 命中：协议相对 `//host`、绝对路径 `/abs`、带 scheme（`http:`/`https:`/`data:`/`ftp:` 等）。
 */
export function isExternalPath(rawPath: string): boolean {
  const p = rawPath.trim();
  if (p.startsWith("//")) return true; // 协议相对 URL
  if (p.startsWith("/")) return true; // 绝对路径
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p)) return true; // scheme:
  return false;
}

/**
 * 取路径的文件名（basename），先剥离查询串/锚点并归一化分隔符。
 */
function basename(rawPath: string): string {
  const clean = stripQueryAnchor(rawPath).replace(/\\/g, "/");
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? clean : clean.slice(idx + 1);
}

// ============================================================================
// 原语 1：parseImageRefs
// ============================================================================

/**
 * 从 Markdown 文本提取所有 `![alt](path)` 图片引用。
 *
 * 行为与畸形输入处理：
 * - 记录 `alt`（可空串）、`rawPath`（剥离可选标题后的原始路径，保留查询串/锚点）、
 *   `line`（1 基行号）、`chapterFile`。
 * - 空路径 `![x]()` → 记录 rawPath 为空串（交由分类/审计判定）。
 * - 纯锚点、查询串、中文文件名 → 原样记录在 rawPath。
 * - 未闭合括号（如 `![x](path` 无 `)`）→ 不匹配，安全跳过，不抛错。
 * - alt 内含 `]`、path 内含 `(` 等嵌套括号的畸形语法 → 正则不匹配该 token，跳过。
 */
export function parseImageRefs(markdown: string, chapterFile: string): ImageRef[] {
  const refs: ImageRef[] = [];
  const re = /!\[([^\]]*)\]\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const alt = m[1] ?? "";
    const rawPath = stripTitle(m[2] ?? "");
    const line = countLines(markdown, m.index);
    refs.push({ chapterFile, rawPath, alt, line });
    // 防御零宽匹配导致的死循环（理论上本正则不会零宽）。
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return refs;
}

// ============================================================================
// 原语 2：classifyImagePath（scope 感知）
// ============================================================================

/**
 * scope 感知地分类一条图片引用路径。
 *
 * 分类规则（相对 course/ 解析后判定）：
 * - 空路径 / 纯锚点 / 仅查询串 → `invalid`
 * - http(s)/data/ftp 等 scheme、协议相对、绝对路径 → `external`
 * - 其余相对路径按 scope 解析：
 *   - 解析后落在 `course/images/` 下 → `compliant`
 *   - 否则（逃出 course/，或落在如 `extras/images/` 的错误位置）→ `escaping`
 *
 * scope 对应章节文件相对 course/ 的层级：
 * - `top`（如 `12-tool.md`，目录为 course/ 根）：`images/...`→compliant；`../images/...`→escaping
 * - `nested`（如 `extras/01.md`，目录为 course/extras/）：`../images/...`→compliant（解析回 course/images/）；
 *   `images/...`→escaping（实际指向 course/extras/images/）
 */
export function classifyImagePath(
  rawPath: string,
  scope: ImagePathScope
): ImagePathClass {
  const trimmed = rawPath.trim();
  if (trimmed === "") return "invalid";
  if (trimmed.startsWith("#")) return "invalid"; // 纯锚点
  if (isExternalPath(trimmed)) return "external";

  const clean = stripQueryAnchor(trimmed).replace(/\\/g, "/").trim();
  if (clean === "") return "invalid"; // 例如仅 "?x=1"

  const baseDir = scope === "nested" ? "extras" : "";
  const joined = baseDir === "" ? clean : `${baseDir}/${clean}`;
  const resolved = normalizePosix(joined);

  if (resolved === "images" || resolved.startsWith("images/")) {
    return "compliant";
  }
  return "escaping";
}

// ============================================================================
// 原语 3：resolveRefPath
// ============================================================================

/**
 * 把「章节文件相对路径 + 引用相对路径」解析为相对 course/ 的规范 POSIX 路径，
 * 用于与磁盘文件集合做存在性比对。
 *
 * 会先剥离查询串/锚点、归一化分隔符；逃出 course/ 时保留前导 `../`。
 * 例如：
 * - resolveRefPath("12-tool.md", "images/a.png")        → "images/a.png"
 * - resolveRefPath("12-tool.md", "../images/a.png")     → "../images/a.png"
 * - resolveRefPath("extras/01.md", "../images/a.png")   → "images/a.png"
 * - resolveRefPath("extras/01.md", "images/a.png")      → "extras/images/a.png"
 */
export function resolveRefPath(chapterFile: string, rawPath: string): string {
  const cleanRaw = stripQueryAnchor(rawPath).replace(/\\/g, "/").trim();
  const dir = dirOf(chapterFile);
  const joined = dir === "" ? cleanRaw : `${dir}/${cleanRaw}`;
  return normalizePosix(joined);
}

// ============================================================================
// 原语 4：countImageDensity
// ============================================================================

/**
 * 统计一组图片引用的密度信息：
 * - total：引用总数
 * - hasHero：是否存在 hero 封面引用，判定依据为 alt 文本或文件名含 `hero`（大小写不敏感）
 * - hasSummary：是否存在小结卡片引用，判定依据为 alt 文本或文件名含 `summary` 或 `小结`
 *
 * 密度门禁（由审计运行器使用）通过当且仅当：total ≥ 5 且 hasHero 且 hasSummary。
 */
export function countImageDensity(refs: ImageRef[]): {
  total: number;
  hasHero: boolean;
  hasSummary: boolean;
} {
  let hasHero = false;
  let hasSummary = false;
  for (const ref of refs) {
    // 同时考察文件名与 alt 文本；toLowerCase 处理英文大小写，对中文为恒等。
    const haystack = `${basename(ref.rawPath)} ${ref.alt}`.toLowerCase();
    if (haystack.includes("hero")) hasHero = true;
    if (haystack.includes("summary") || haystack.includes("小结")) {
      hasSummary = true;
    }
  }
  return { total: refs.length, hasHero, hasSummary };
}
