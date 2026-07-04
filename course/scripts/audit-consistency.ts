/**
 * ConsistencyAuditor 运行器（任务 5.3，Requirements 7.1/7.2/7.3/7.4/7.6/7.7）。
 *
 * 本文件是「一致性审计」的 I/O 适配层：把 lib/ 下的纯函数原语
 * （numbering / refs / terms / report）接到真实文件系统，对 course 下全部
 * Markdown 章节做完整一致性审计，聚合成 `ConsistencyAuditReport`。
 *
 * 设计对应 design.md 组件 C9（Consistency_Auditor）。纯函数层（解析、判定）
 * 已在 lib/ 内实现并由属性测试守护；本层只负责「读文件 → 调原语 → 聚合报告」，
 * 不含任何判定逻辑的重复实现。
 *
 * 审计项：
 * 1. 编号映射（Req 7.1）：每个章节首个标题的实际节号 ↔ 文件名节号映射。
 * 2. 跨节引用断链（Req 7.2/7.3）：章节内 `.md` 链接解析到真实 Chapter。
 * 3. README 目录链接（Req 7.4）：README 目录里的章节链接解析到真实 Chapter。
 * 4. 术语 + 禁用短语（Req 7.6/7.7）：术语反例用法与版本对比措辞扫描。
 * 5. 残留 V1 引用（Req 7.7）：指向 V1 章节文件名或 `../images/` 根图的残留引用。
 * 6. 结构缺段（Req 7.5，轻量版）：主线节是否含 `## 面试题` 段与节末导航行。
 *
 * 安全/降级：
 * - 读取失败不中断整篇审计，记为一条 `unreadable-chapter` 结构发现后继续。
 * - 本审计器只把 `.md` 章节链接视为 Cross_Reference；正文里提到的 `ssp-web`
 *   源码路径（如 `src/lib/ai/tools.ts`）不是 Markdown 链接，不会被解析为跨节
 *   引用，因此 ssp-web 路径无论是否存在都不会被误报为断链（降级为「无法验证」
 *   而非误报）。
 *
 * 运行：`npx tsx audit-consistency.ts <courseDir>`
 * 仅打印摘要；落地写报告文件是任务 14.1 的职责。
 */

import { readFileSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import {
  checkTitleNumber,
  mapFileToTitleNumber,
  parseCrossRefs,
  parseReadmeTocLinks,
  findBrokenRefs,
  checkTermUsage,
  detectForbiddenPhrases,
  defaultTermTable,
  computePassed,
  classifyImagePath,
  V1_CHAPTER_FILES,
} from "./lib/index";
import type { ImagePathScope } from "./lib/types";
import type {
  AuditFinding,
  BrokenRef,
  ConsistencyAuditReport,
  TermViolation,
} from "./lib/types";

// ============================================================================
// 常量
// ============================================================================

/** 不参与遍历的目录（脚本工程与依赖）。 */
const SKIP_DIRS: ReadonlySet<string> = new Set([
  "scripts",
  "node_modules",
  ".git",
]);

/** README 文件名（相对 course/）。 */
const README_FILE = "README.md";

/**
 * 残留根图引用扫描正则：匹配任意 `../images/...` 形态的路径片段。
 * 终止于空白、`)`、`]`、引号等常见 Markdown 边界字符。
 */
const RESIDUAL_ROOT_IMAGE_RE = /\.\.\/images\/[^\s)\]"'`]*/g;

// ============================================================================
// 文件系统辅助（I/O 适配层）
// ============================================================================

/**
 * 递归收集 `courseDir` 下全部 `.md` 文件，返回相对 course/ 的 POSIX 路径列表。
 * 跳过 `SKIP_DIRS`（scripts/node_modules/.git）。
 */
function collectMarkdownFiles(courseDir: string): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // 不可读目录直接跳过，不中断
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(courseDir, join(dir, entry.name))
          .split(sep)
          .join("/");
        out.push(rel);
      }
    }
  }

  walk(courseDir);
  return out;
}

/**
 * 读取章节文本；失败返回 null（交由调用方记 unreadable-chapter 并继续）。
 */
function readChapter(courseDir: string, file: string): string | null {
  try {
    return readFileSync(join(courseDir, file), "utf8");
  } catch {
    return null;
  }
}

// ============================================================================
// 章节集合划分
// ============================================================================

/**
 * 判定一个相对路径是否为「读者向章节」（参与编号/术语/结构/残留审计）。
 *
 * 章节 = V2_Course 的内容文件：
 * - 顶层编号文件 `NN-*.md`（00-prologue … 30-epilogue）
 * - `extras/*.md`（加餐）
 * - `faq.md`
 *
 * 排除 README.md、style-guide.md、code-facts.md、knowledge-map.md、
 * research/* 等基础设施文档：它们不是读者向章节，且 style-guide.md 本身会
 * 罗列术语反例（如「代理人」「提示语」），若纳入术语扫描会产生大量误报。
 */
function isChapterFile(file: string): boolean {
  if (file === "faq.md") return true;
  if (file.startsWith("extras/") && file.endsWith(".md")) return true;
  // 顶层编号正文：无子目录、形如 NN-*.md
  if (!file.includes("/") && /^\d+-.+\.md$/.test(file)) return true;
  return false;
}

// ============================================================================
// 标题节号解析
// ============================================================================

/**
 * 从章节文本解析「首个标题」的实际节号。
 *
 * 识别两类带号标题：
 * - 主线节：`# 第 NN 节 · …`（`第\s*0*(\d+)\s*节`）
 * - 加餐：`# 加餐 N｜…`（`加餐\s*0*(\d+)`）
 *
 * 首个标题不含节号（开篇词 / 序章 / 结束语 / FAQ）→ 返回 null。
 * 文中无任何标题 → 返回 null（交由 checkTitleNumber 与映射比对）。
 */
function parseHeadingNumber(markdown: string): number | null {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    if (!/^#{1,6}\s+/.test(line)) continue;
    const sec = /第\s*0*(\d+)\s*节/.exec(line);
    if (sec) return Number.parseInt(sec[1] ?? "", 10);
    const extra = /加餐\s*0*(\d+)/.exec(line);
    if (extra) return Number.parseInt(extra[1] ?? "", 10);
    return null; // 首个标题无节号
  }
  return null;
}

// ============================================================================
// 结构检查（轻量版，Req 7.5）
// ============================================================================

/**
 * 主线节轻量结构检查（基础版）。
 *
 * TODO(任务 14.x)：增强为完整七段式 + 元信息 + 人物设定一致性检查。本版仅做两项
 * 低误报的轻量校验：
 * - 是否含 `## 面试题` / `### 面试题` 段（Req 3.2 配套，结构存在性）
 * - 是否含节末导航行（同时出现「目录」与「下一节」或「上一节」链接线索）
 *
 * @returns 该章节的结构缺段发现列表
 */
function checkMainlineStructure(file: string, markdown: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  const hasInterview = /^#{2,3}\s*面试题/m.test(markdown);
  if (!hasInterview) {
    findings.push({
      kind: "missing-section",
      sourceFile: file,
      detail: "主线节缺少「面试题」段（## 面试题）",
    });
  }

  const hasNav =
    markdown.includes("目录") &&
    (markdown.includes("下一节") || markdown.includes("上一节"));
  if (!hasNav) {
    findings.push({
      kind: "missing-section",
      sourceFile: file,
      detail: "主线节缺少节末导航行（上一节 / 目录 / 下一节）",
    });
  }

  return findings;
}

// ============================================================================
// 残留 V1 引用扫描（Req 7.7）
// ============================================================================

/**
 * 扫描章节中的残留 V1 引用：
 * 1. `../images/...` 根图引用（删除 V1 后属坏图来源）——**scope 感知**：
 *    仅当该引用逃出 `course/`（即顶层章节文件的 `../images/...`）时才算残留。
 *    嵌套章节（如 `extras/...`）的 `../images/...` 会解析回 `course/images/`，
 *    属合规引用（style-guide §5.5），不应误报。
 * 2. 指向 V1_Course 章节文件名（`00-introduction.md`..）的 `.md` 链接。
 *
 * @returns residual-v1-ref 发现列表
 */
function scanResidualV1Refs(file: string, markdown: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // 文件相对 course/ 的层级：无 `/` 为顶层（top），含子目录（如 extras/）为嵌套（nested）。
  const scope: ImagePathScope = file.replace(/\\/g, "/").includes("/")
    ? "nested"
    : "top";

  // 1. ../images/ 根图残留——仅当 classifyImagePath 判定为 escaping（逃出 course/）才记。
  RESIDUAL_ROOT_IMAGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RESIDUAL_ROOT_IMAGE_RE.exec(markdown)) !== null) {
    if (classifyImagePath(m[0], scope) === "escaping") {
      findings.push({
        kind: "residual-v1-ref",
        sourceFile: file,
        detail: `残留根图引用：${m[0]}`,
      });
    }
    if (m.index === RESIDUAL_ROOT_IMAGE_RE.lastIndex) {
      RESIDUAL_ROOT_IMAGE_RE.lastIndex++;
    }
  }

  // 2. 指向 V1 章节文件名的 .md 链接
  for (const ref of parseCrossRefs(markdown, file)) {
    const clean = ref.rawPath.split("#")[0]?.split("?")[0] ?? "";
    const base = clean.replace(/\\/g, "/").split("/").pop() ?? "";
    if (V1_CHAPTER_FILES.has(base)) {
      findings.push({
        kind: "residual-v1-ref",
        sourceFile: file,
        detail: `指向 V1 章节文件的引用：${ref.rawPath}`,
      });
    }
  }

  return findings;
}

// ============================================================================
// 主入口：auditConsistency
// ============================================================================

/**
 * 对 `courseDir` 做完整一致性审计，聚合成 ConsistencyAuditReport。
 *
 * @param courseDir 课程根目录绝对/相对路径（即 `course/`）
 * @returns ConsistencyAuditReport（`passed` 由 computePassed 据各发现列表计算）
 */
export function auditConsistency(courseDir: string): ConsistencyAuditReport {
  const numberingMismatches: AuditFinding[] = [];
  const brokenRefs: BrokenRef[] = [];
  const readmeBrokenLinks: BrokenRef[] = [];
  const termViolations: TermViolation[] = [];
  const residualV1Refs: AuditFinding[] = [];
  const structureFindings: AuditFinding[] = [];

  // 全部真实 .md 文件（相对 course/，POSIX）→ 跨节引用存在性比对集合。
  const allMdFiles = collectMarkdownFiles(courseDir);
  const existingSet = new Set(allMdFiles);

  // 读者向章节子集（参与编号/术语/结构/残留审计）。
  const chapterFiles = allMdFiles.filter(isChapterFile);

  for (const file of chapterFiles) {
    const content = readChapter(courseDir, file);
    if (content === null) {
      structureFindings.push({
        kind: "unreadable-chapter",
        sourceFile: file,
        detail: "无法读取该章节文件，已跳过其后续审计",
      });
      continue;
    }

    // 1. 编号映射（Req 7.1）
    const headingNumber = parseHeadingNumber(content);
    if (!checkTitleNumber(file, headingNumber)) {
      const entry = mapFileToTitleNumber(file);
      numberingMismatches.push({
        kind: "numbering-mismatch",
        sourceFile: file,
        detail: `标题节号 ${headingNumber ?? "(无)"} 不符合映射（期望 ${
          entry.titleNumber ?? "(无节号)"
        }，kind=${entry.kind}）`,
      });
    }

    // 2. 跨节引用断链（Req 7.2/7.3）
    const refs = parseCrossRefs(content, file);
    brokenRefs.push(...findBrokenRefs(refs, existingSet));

    // 3. 术语 + 禁用短语（Req 7.6/7.7）
    termViolations.push(...checkTermUsage(content, defaultTermTable, file));
    termViolations.push(...detectForbiddenPhrases(content, file));

    // 4. 残留 V1 引用（Req 7.7）
    residualV1Refs.push(...scanResidualV1Refs(file, content));

    // 5. 结构缺段（Req 7.5，轻量版，仅主线节）
    if (mapFileToTitleNumber(file).kind === "mainline") {
      structureFindings.push(...checkMainlineStructure(file, content));
    }
  }

  // 6. README 目录链接（Req 7.4）
  if (existingSet.has(README_FILE)) {
    const readme = readChapter(courseDir, README_FILE);
    if (readme === null) {
      structureFindings.push({
        kind: "unreadable-chapter",
        sourceFile: README_FILE,
        detail: "无法读取 README.md，跳过目录链接校验",
      });
    } else {
      const tocLinks = parseReadmeTocLinks(readme);
      readmeBrokenLinks.push(...findBrokenRefs(tocLinks, existingSet));
    }
  }

  const report: ConsistencyAuditReport = {
    numberingMismatches,
    brokenRefs,
    readmeBrokenLinks,
    termViolations,
    residualV1Refs,
    structureFindings,
    passed: false,
  };
  report.passed = computePassed(report);
  return report;
}

// ============================================================================
// CLI 入口
// ============================================================================

/**
 * 打印审计摘要（不写报告文件——写报告是任务 14.1 的职责）。
 */
function printSummary(courseDir: string, report: ConsistencyAuditReport): void {
  const {
    numberingMismatches,
    brokenRefs,
    readmeBrokenLinks,
    termViolations,
    residualV1Refs,
    structureFindings,
    passed,
  } = report;

  console.log(`一致性审计：${courseDir}`);
  console.log("────────────────────────────────────────");
  console.log(`  编号不一致 (numbering-mismatch) : ${numberingMismatches.length}`);
  console.log(`  跨节断链   (broken-xref)        : ${brokenRefs.length}`);
  console.log(`  README 断链 (readme)            : ${readmeBrokenLinks.length}`);
  console.log(`  术语/禁用短语 (term/forbidden)  : ${termViolations.length}`);
  console.log(`  残留 V1 引用 (residual-v1-ref)  : ${residualV1Refs.length}`);
  console.log(`  结构缺段   (structure)          : ${structureFindings.length}`);
  console.log("────────────────────────────────────────");
  console.log(`  passed: ${passed ? "✅ true" : "❌ false"}`);

  const sample = (label: string, items: { detail?: string; sourceFile?: string; rawPath?: string; targetPath?: string; hit?: string }[]) => {
    if (items.length === 0) return;
    console.log(`\n  · ${label}（示例最多 5 条）：`);
    for (const it of items.slice(0, 5)) {
      const where = it.sourceFile ?? "";
      const what =
        it.detail ??
        (it.rawPath ? `${it.rawPath} → ${it.targetPath ?? ""}` : it.hit ?? "");
      console.log(`      - ${where}: ${what}`);
    }
  };

  sample("编号不一致", numberingMismatches);
  sample("跨节断链", brokenRefs);
  sample("README 断链", readmeBrokenLinks);
  sample("术语/禁用短语", termViolations);
  sample("残留 V1 引用", residualV1Refs);
  sample("结构缺段", structureFindings);
}

function main(): void {
  const courseDir = process.argv[2];
  if (!courseDir) {
    console.error("用法：npx tsx audit-consistency.ts <courseDir>");
    process.exitCode = 2;
    return;
  }
  const report = auditConsistency(courseDir);
  printSummary(courseDir, report);
  // 不以 passed 决定退出码：审计「跑通并报告」即成功；门禁判定在 14.x。
}

// 仅当作为脚本直接运行时执行 CLI（被 import 时不触发）。
const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main();
}

// 便于将来在测试中按文件路径定位本运行器。
export const __runnerPath = fileURLToPath(import.meta.url);
