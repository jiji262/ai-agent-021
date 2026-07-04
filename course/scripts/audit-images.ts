/**
 * ImageAuditor 运行器（任务 5.1，Requirements 6.1–6.6）。
 *
 * 把图片审计纯函数原语（lib/image-paths、lib/image-audit、lib/report）接到真实
 * 文件系统，对 `course/**\/*.md`（顶层 + extras/）做完整图片审计，聚合为
 * `ImageAuditReport`。
 *
 * I/O 适配层职责（design「校验器架构 / I/O 适配层」）：
 * - 递归读取 courseDir 下的 Markdown（顶层 Chapter + extras/ 嵌套 Chapter）。
 * - 读取 `course/images/` 下真实图片文件集合。
 * - 对每篇 Chapter 调用纯函数原语解析引用、判路径合规、解析路径、比对存在性、
 *   统计主线节图片密度。
 * - 读取失败的章节记为 `unreadable-chapter` 发现并继续，不中断整体审计。
 *
 * 纯函数原语本身无 I/O；本文件是它们与磁盘之间的唯一接线点。
 */

import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import {
  parseImageRefs,
  classifyImagePath,
  resolveRefPath,
  countImageDensity,
  findMissingImages,
  findOrphanImages,
  computePassed,
} from "./lib/index";
import type {
  ImageRef,
  ImagePathScope,
  ImageAuditFinding,
  ImageAuditReport,
} from "./lib/types";

// ============================================================================
// 常量
// ============================================================================

/** 视为「图片文件」的扩展名（小写，含点）。其余文件（如 .md 笔记）不计入图片集合。 */
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
]);

/** 主线节文件名号区间（Requirements：02-what-is-agent .. 29-deploy-and-beyond）。 */
const MAINLINE_MIN = 2;
const MAINLINE_MAX = 29;

/** 图片密度门禁阈值（Requirements 6.5）：主线节图片引用总数下限。 */
const DENSITY_MIN_REFS = 5;

// ============================================================================
// 文件系统收集
// ============================================================================

/** 一篇被审计的 Chapter：含其相对 course/ 的 POSIX 路径与 scope。 */
type ChapterFile = {
  /** 绝对路径，用于读取。 */
  absPath: string;
  /** 相对 courseDir 的 POSIX 路径，如 `12-tool-calling.md`、`extras/01-admin-cms.md`。 */
  relPath: string;
  /** 路径 scope：顶层=top，extras/=nested。 */
  scope: ImagePathScope;
};

/** 把任意分隔符的相对路径归一为 POSIX 风格。 */
function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

/**
 * 收集待审计的 Markdown 文件：courseDir 顶层 `*.md` 与 `extras/*.md`。
 *
 * 仅覆盖任务约定的审计范围（顶层 Chapter + 加餐），不下探 `images/`、`scripts/`、
 * `research/` 等目录，避免把生成笔记/脚本/研究稿误纳入图片审计。
 */
function collectChapterFiles(courseDir: string): ChapterFile[] {
  const chapters: ChapterFile[] = [];

  // 顶层 *.md
  for (const entry of readdirSync(courseDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const absPath = join(courseDir, entry.name);
      chapters.push({ absPath, relPath: entry.name, scope: "top" });
    }
  }

  // extras/*.md（nested scope）
  const extrasDir = join(courseDir, "extras");
  if (existsSync(extrasDir) && statSync(extrasDir).isDirectory()) {
    for (const entry of readdirSync(extrasDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const absPath = join(extrasDir, entry.name);
        chapters.push({
          absPath,
          relPath: `extras/${entry.name}`,
          scope: "nested",
        });
      }
    }
  }

  chapters.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return chapters;
}

/**
 * 收集 `course/images/` 下真实图片文件，返回相对 courseDir 的 POSIX 路径列表
 * （如 `images/00-hero.png`）。递归处理潜在子目录，仅纳入图片扩展名文件。
 */
function collectImageFiles(courseDir: string): string[] {
  const imagesDir = join(courseDir, "images");
  if (!existsSync(imagesDir) || !statSync(imagesDir).isDirectory()) {
    return [];
  }

  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf(".");
        const ext = dot === -1 ? "" : entry.name.slice(dot).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          found.push(toPosix(relative(courseDir, abs)));
        }
      }
    }
  };
  walk(imagesDir);
  found.sort();
  return found;
}

// ============================================================================
// 主线节判定与密度门禁
// ============================================================================

/**
 * 判定一个 Chapter 是否为主线节（密度门禁只对主线节强制）。
 * 主线节 = 顶层文件，文件名形如 `NN-*.md` 且 NN ∈ [02, 29]。
 * 开篇/序章/结束语（00/01/30）、extras/、README/faq/style-guide/code-facts 等不强制密度。
 */
function isMainlineChapter(chapter: ChapterFile): boolean {
  if (chapter.scope !== "top") return false;
  const m = /^(\d{2})-.*\.md$/.exec(chapter.relPath);
  if (!m) return false;
  const num = Number.parseInt(m[1]!, 10);
  return num >= MAINLINE_MIN && num <= MAINLINE_MAX;
}

/**
 * 主线节图片密度门禁（Requirements 6.4/6.5）。
 * 通过当且仅当：本地图片引用数 ≥ 5、含 ≥1 hero 封面、含 ≥1 小结卡片。
 * 返回未达标项的 `density-violation` 发现（达标则返回 null）。
 */
function checkDensity(
  chapter: ChapterFile,
  localRefs: ImageRef[]
): ImageAuditFinding | null {
  const { total, hasHero, hasSummary } = countImageDensity(localRefs);
  const missing: string[] = [];
  if (total < DENSITY_MIN_REFS) missing.push(`图片引用数 ${total} < ${DENSITY_MIN_REFS}`);
  if (!hasHero) missing.push("缺少 hero 封面图引用");
  if (!hasSummary) missing.push("缺少小结卡片图引用");
  if (missing.length === 0) return null;

  return {
    kind: "density-violation",
    chapterFile: chapter.relPath,
    detail: `主线节图片密度不达标：${missing.join("；")}`,
  };
}

// ============================================================================
// 审计运行器
// ============================================================================

/**
 * 对 `courseDir`（即 `course/`）执行完整图片审计，聚合为 `ImageAuditReport`。
 *
 * 流程：
 * 1. 收集顶层 + extras/ 的 Markdown 与 `images/` 真实文件集合。
 * 2. 逐篇读取章节：读取失败 → `unreadable-chapter` 发现并继续。
 * 3. `parseImageRefs` 解析引用；`classifyImagePath`（scope 感知）分类：
 *    - escaping → `bad-image-path` 发现（顶层 `../images/...` 逃逸等不规范路径）。
 *    - compliant → 进入存在性比对与孤立图引用集合。
 *    - external/invalid → 跳过（外链/空路径不属图片存在性范畴）。
 * 4. `findMissingImages` 对合规引用比对 `course/images/` 真实集合 → `missing-image`。
 * 5. 主线节用 `countImageDensity` 检查密度 → `density-violation`。
 * 6. `findOrphanImages` 求集合差 → 孤立图。
 * 7. `computePassed` 据全部发现列表计算 `passed`。
 *
 * @param courseDir 课程根目录（含 `images/`、顶层章节与 `extras/`）。
 * @returns 聚合后的图片审计报告。
 */
export function auditImages(courseDir: string): ImageAuditReport {
  if (!existsSync(courseDir) || !statSync(courseDir).isDirectory()) {
    throw new Error(`courseDir 不是有效目录：${courseDir}`);
  }

  const chapters = collectChapterFiles(courseDir);
  const diskImagePaths = collectImageFiles(courseDir);
  const existingPaths = new Set(diskImagePaths);

  const findings: ImageAuditFinding[] = [];
  const densityViolations: ImageAuditFinding[] = [];

  // 合规引用集合（用于缺失图比对）与被引用图片集合（用于孤立图比对）。
  const compliantRefs: ImageRef[] = [];
  const referencedPaths = new Set<string>();

  for (const chapter of chapters) {
    let markdown: string;
    try {
      markdown = readFileSync(chapter.absPath, "utf8");
    } catch (err) {
      findings.push({
        kind: "unreadable-chapter",
        chapterFile: chapter.relPath,
        detail: `章节读取失败：${(err as Error).message}`,
      });
      continue; // 不中断整体审计
    }

    const refs = parseImageRefs(markdown, chapter.relPath);

    // 用于密度统计的本地引用（合规 + 逃逸，均为指向课程图片的本地引用；
    // 路径合规问题单独记 bad-image-path，不影响「图够不够」的密度判断）。
    const localRefs: ImageRef[] = [];

    for (const ref of refs) {
      const cls = classifyImagePath(ref.rawPath, chapter.scope);
      if (cls === "escaping") {
        localRefs.push(ref);
        findings.push({
          kind: "bad-image-path",
          chapterFile: chapter.relPath,
          rawPath: ref.rawPath,
          detail: `路径不规范（逃逸 course/images/）：${ref.rawPath}，应改为相对 course/ 的 images/...`,
        });
      } else if (cls === "compliant") {
        localRefs.push(ref);
        compliantRefs.push(ref);
        referencedPaths.add(resolveRefPath(ref.chapterFile, ref.rawPath));
      }
      // external / invalid：跳过存在性与密度统计
    }

    if (isMainlineChapter(chapter)) {
      const violation = checkDensity(chapter, localRefs);
      if (violation) densityViolations.push(violation);
    }
  }

  // 缺失图：仅对合规引用比对真实文件集合（逃逸引用已由 bad-image-path 覆盖）。
  findings.push(...findMissingImages(compliantRefs, existingPaths));

  // 孤立图：磁盘集合 − 被合规引用集合。
  const orphans = findOrphanImages(diskImagePaths, referencedPaths);

  const report: ImageAuditReport = {
    findings,
    orphans,
    densityViolations,
    passed: false,
  };
  report.passed = computePassed(report);
  return report;
}

// ============================================================================
// 报告格式化（供任务 13.1 写出 image-audit-report.md 复用）
// ============================================================================

/**
 * 把 `ImageAuditReport` 渲染为人类可读的 Markdown 报告文本。
 * 列出缺失图片、路径不规范引用、孤立图、密度不达标项（Requirements 6.6）。
 */
export function formatImageAuditReport(
  report: ImageAuditReport,
  courseDir?: string
): string {
  const missing = report.findings.filter((f) => f.kind === "missing-image");
  const badPath = report.findings.filter((f) => f.kind === "bad-image-path");
  const unreadable = report.findings.filter((f) => f.kind === "unreadable-chapter");

  const lines: string[] = [];
  lines.push("# 图片审计报告（image-audit-report）");
  lines.push("");
  if (courseDir) lines.push(`- 审计目录：\`${courseDir}\``);
  lines.push(`- 结论：${report.passed ? "✅ 通过（passed）" : "❌ 未通过（failed）"}`);
  lines.push(`- 缺失图片：${missing.length}`);
  lines.push(`- 路径不规范引用：${badPath.length}`);
  lines.push(`- 孤立图片：${report.orphans.length}`);
  lines.push(`- 密度不达标主线节：${report.densityViolations.length}`);
  lines.push(`- 不可读章节：${unreadable.length}`);
  lines.push("");

  const section = (title: string, rows: string[]): void => {
    lines.push(`## ${title}（${rows.length}）`);
    lines.push("");
    if (rows.length === 0) {
      lines.push("_无_");
    } else {
      lines.push(...rows);
    }
    lines.push("");
  };

  section(
    "缺失图片",
    missing.map(
      (f) => `- \`${f.chapterFile}\` → \`${f.resolvedPath ?? f.rawPath ?? ""}\`（${f.detail}）`
    )
  );
  section(
    "路径不规范引用",
    badPath.map((f) => `- \`${f.chapterFile}\`：\`${f.rawPath ?? ""}\``)
  );
  section(
    "孤立图片",
    report.orphans.map((o) => `- \`${o.filePath}\``)
  );
  section(
    "密度不达标主线节",
    report.densityViolations.map((f) => `- \`${f.chapterFile}\`：${f.detail}`)
  );
  if (unreadable.length > 0) {
    section(
      "不可读章节",
      unreadable.map((f) => `- \`${f.chapterFile}\`：${f.detail}`)
    );
  }

  return lines.join("\n");
}

/** 在终端打印简明摘要（CLI 用）。 */
function printSummary(report: ImageAuditReport, courseDir: string): void {
  const count = (kind: ImageAuditFinding["kind"]): number =>
    report.findings.filter((f) => f.kind === kind).length;
  console.log("图片审计摘要");
  console.log(`  目录          : ${courseDir}`);
  console.log(`  缺失图片      : ${count("missing-image")}`);
  console.log(`  路径不规范    : ${count("bad-image-path")}`);
  console.log(`  不可读章节    : ${count("unreadable-chapter")}`);
  console.log(`  孤立图片      : ${report.orphans.length}`);
  console.log(`  密度不达标    : ${report.densityViolations.length}`);
  console.log(`  结论 passed   : ${report.passed}`);
}

// ============================================================================
// CLI 入口
// ============================================================================

/** 判定当前模块是否作为脚本被直接执行（而非被 import）。 */
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

function main(): void {
  const args = process.argv.slice(2);
  // 解析可选 --out <path>
  let outPath: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--out") {
      outPath = args[i + 1];
      i++;
    } else if (a.startsWith("--out=")) {
      outPath = a.slice("--out=".length);
    } else {
      positional.push(a);
    }
  }

  // courseDir 默认 = 本脚本上两级（scripts/ 的父目录即 course/）。
  const scriptDir = fileURLToPath(new URL(".", import.meta.url));
  const defaultCourseDir = join(scriptDir, "..");
  const courseDir = positional[0] ?? defaultCourseDir;

  const report = auditImages(courseDir);
  printSummary(report, courseDir);

  if (outPath) {
    writeFileSync(outPath, formatImageAuditReport(report, courseDir), "utf8");
    console.log(`已写出 Markdown 报告：${outPath}`);
  }

  // 终审门禁语义：有发现则以非零码退出，便于 CI 接线。
  process.exitCode = report.passed ? 0 : 1;
}

if (isMainModule()) {
  main();
}
