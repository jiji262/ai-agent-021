// Feature: ai-agent-course-v2-rewrite, Property 2: 引用解析与断链报告完整性（parseCrossRefs/findBrokenRefs）
// Validates: Requirements 1.8, 2.7, 7.2, 7.3, 7.4
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  parseCrossRefs,
  parseReadmeTocLinks,
  findBrokenRefs,
  V1_CHAPTER_FILES,
} from "../lib/refs";
import type { CrossRef } from "../lib/types";

/**
 * 属性：findBrokenRefs 报告的断链集合，恰等于「指向 V1 章节文件名，或解析后目标
 * 不在真实 Chapter 集合中」的引用（保留重复，多重集合）；每条断链记录正确的
 * sourceFile、rawPath 与解析后的 targetPath。
 *
 * 同时校验 parseCrossRefs / parseReadmeTocLinks 的解析完整性：由已知链接拼成的
 * 文本恰被解析回对应的 .md 章节链接（排除图片与外链）。
 *
 * 生成器统一覆盖：跨节相对链接（./xx.md、xx.md、../xx.md）、README 目录链接、
 * 指向 V1 文件名的链接、解析到不存在目标的链接、含锚点/查询串的链接。
 */

// 独立参照：POSIX 路径规范化（处理 . 与 ..，保留逃逸前导 ../）。
function normalizePosix(path: string): string {
  const parts = path.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      const last = out.length > 0 ? out[out.length - 1] : undefined;
      if (last !== undefined && last !== "..") out.pop();
      else out.push("..");
    } else {
      out.push(part);
    }
  }
  return out.join("/");
}

// 独立参照：解析来源文件 + 链接为相对 course/ 路径。
function resolve(sourceFile: string, rawPath: string): string {
  const clean = (rawPath.split("#")[0] ?? "").split("?")[0] ?? "";
  const norm = clean.replace(/\\/g, "/").trim();
  const idx = sourceFile.replace(/\\/g, "/").lastIndexOf("/");
  const dir = idx === -1 ? "" : sourceFile.slice(0, idx);
  const joined = dir === "" ? norm : `${dir}/${norm}`;
  return normalizePosix(joined);
}

function basenameOf(rawPath: string): string {
  const clean = (rawPath.split("#")[0] ?? "").split("?")[0] ?? "";
  const norm = clean.replace(/\\/g, "/");
  return norm.split("/").pop() ?? norm;
}

const sourceArb = fc.constantFrom(
  "12-tool-calling.md",
  "02-what-is-agent.md",
  "extras/01-admin-cms.md",
);

// 真实存在的章节目标（无目录前缀，顶层）。
const existingTargetArb = fc.constantFrom(
  "12-tool-calling.md",
  "13-zod-schema.md",
  "02-what-is-agent.md",
  "README.md",
);

// 不存在的目标。
const missingTargetArb = fc.constantFrom(
  "99-ghost.md",
  "does-not-exist.md",
  "draft.md",
);

// 指向 V1 文件名（恒断链）。
const v1TargetArb = fc.constantFrom(
  "00-introduction.md",
  "14-deploy-and-beyond.md",
  "05-rule-engine.md",
);

const anchorArb = fc.constantFrom("", "#section", "?v=2", "#小结");

type LinkCase = { sourceFile: string; rawPath: string };

const linkCaseArb: fc.Arbitrary<LinkCase> = fc.oneof(
  fc
    .record({ s: sourceArb, t: existingTargetArb, a: anchorArb })
    .map(({ s, t, a }) => ({ sourceFile: s, rawPath: `./${t}${a}` })),
  fc
    .record({ s: sourceArb, t: missingTargetArb, a: anchorArb })
    .map(({ s, t, a }) => ({ sourceFile: s, rawPath: `${t}${a}` })),
  fc
    .record({ s: sourceArb, t: v1TargetArb, a: anchorArb })
    .map(({ s, t, a }) => ({ sourceFile: s, rawPath: `../${t}${a}` })),
);

const existingSet = new Set<string>([
  "12-tool-calling.md",
  "13-zod-schema.md",
  "02-what-is-agent.md",
  "README.md",
  "extras/01-admin-cms.md",
]);

function key(r: { sourceFile: string; rawPath: string; targetPath: string }): string {
  return `${r.sourceFile}\u0001${r.rawPath}\u0001${r.targetPath}`;
}

function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const k of a) counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const k of b) {
    const c = counts.get(k);
    if (c === undefined || c === 0) return false;
    counts.set(k, c - 1);
  }
  return true;
}

describe("Property 2: 引用解析与断链报告完整性", () => {
  it("断链集合恰为「指向 V1 或解析后不存在」的引用，记录正确来源与目标", () => {
    fc.assert(
      fc.property(fc.array(linkCaseArb, { maxLength: 20 }), (cases) => {
        const refs: CrossRef[] = cases.map((c, i) => ({
          sourceFile: c.sourceFile,
          rawPath: c.rawPath,
          text: `link-${i}`,
          line: i + 1,
        }));

        const broken = findBrokenRefs(refs, existingSet);

        // 参照：期望断链（保留重复）。
        const expected: string[] = [];
        for (const c of refs) {
          const target = resolve(c.sourceFile, c.rawPath);
          const pointsToV1 = V1_CHAPTER_FILES.has(basenameOf(c.rawPath));
          if (pointsToV1 || !existingSet.has(target)) {
            expected.push(key({ sourceFile: c.sourceFile, rawPath: c.rawPath, targetPath: target }));
          }
        }

        const actual = broken.map((b) => key(b));
        return multisetEqual(actual, expected);
      }),
      { numRuns: 100 },
    );
  });

  it("parseCrossRefs / parseReadmeTocLinks 完整解析 .md 章节链接，排除图片与外链", () => {
    const textArb = fc.constantFrom(
      "见 [工具调用](./12-tool-calling.md)",
      "图：![封面](images/hero.png) 与 [下一节](13-zod-schema.md)",
      "外链 [官网](https://example.com) 不计",
      "[目录](README.md) 和 [上一节](../02-what-is-agent.md)",
    );
    fc.assert(
      fc.property(fc.array(textArb, { minLength: 1, maxLength: 6 }), (parts) => {
        const md = parts.join("\n\n");
        const crossRefs = parseCrossRefs(md, "12-tool-calling.md");
        const tocLinks = parseReadmeTocLinks(md);

        // 所有解析出的引用都指向 .md，且 README 解析来源固定为 README.md。
        for (const r of crossRefs) expect(/\.md$/i.test(r.rawPath.split("#")[0]!.split("?")[0]!)).toBe(true);
        for (const r of tocLinks) expect(r.sourceFile).toBe("README.md");
        // 不把图片/外链当作章节链接。
        for (const r of crossRefs) {
          expect(r.rawPath.startsWith("http")).toBe(false);
          expect(r.rawPath.endsWith(".png")).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
