// Feature: ai-agent-course-v2-rewrite, Property 9: 图片存在性审计完整性
// Validates: Requirements 6.1, 6.2
import { describe, it } from "vitest";
import fc from "fast-check";
import { findMissingImages } from "../lib/image-audit";
import { resolveRefPath, isExternalPath } from "../lib/image-paths";
import type { ImageRef } from "../lib/types";

/**
 * 属性：缺失发现列表恰等于「本地引用中解析后不存在于磁盘集合」的子序列，
 * 且每条发现记录正确的 resolvedPath 与引用所在 chapter。
 *
 * 参照实现独立地用 resolveRefPath 过滤出期望缺失引用（保留重复），
 * 与 findMissingImages 输出做多重集合比对；并断言：
 * 1) 多重集合（chapter, rawPath, resolvedPath）逐项相等
 * 2) 每条发现的 kind=missing-image、resolvedPath 不在磁盘集合中
 * 3) 外部引用 / 空路径 / 纯锚点不产生缺失发现（隐含在过滤逻辑中）
 */

const chapterArb = fc.constantFrom(
  "12-tool.md",
  "01-introduction.md",
  "extras/01-admin.md",
  "extras/03-model.md"
);

// 本地相对路径生成器（会被存在性比对）。
const localPathArb = fc.constantFrom(
  "images/a.png",
  "images/封面.png",
  "../images/b.jpg",
  "./images/c.svg",
  "images/sub/d.webp"
);

// 非本地路径生成器（应被跳过：external / 空 / 锚点）。
const skippablePathArb = fc.constantFrom(
  "",
  "   ",
  "#anchor",
  "http://x.test/a.png",
  "https://cdn.test/b.png",
  "//cdn.test/c.png",
  "/abs/d.png",
  "data:image/png;base64,AAAA"
);

const refArb: fc.Arbitrary<ImageRef> = fc.record({
  chapterFile: chapterArb,
  rawPath: fc.oneof(localPathArb, skippablePathArb),
  alt: fc.constantFrom("", "封面", "图"),
  line: fc.integer({ min: 1, max: 500 }),
});

function key(chapterFile: string, rawPath: string, resolvedPath: string): string {
  return `${chapterFile}\u0001${rawPath}\u0001${resolvedPath}`;
}

function isLocal(rawPath: string): boolean {
  const raw = rawPath.trim();
  return raw !== "" && !raw.startsWith("#") && !isExternalPath(raw);
}

// 多重集合计数比对。
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

describe("Property 9: findMissingImages 完整性", () => {
  it("缺失发现恰为解析后不存在的本地引用，且记录正确 chapter 与 resolvedPath", () => {
    fc.assert(
      fc.property(
        fc.array(refArb, { minLength: 0, maxLength: 12 }),
        fc.array(localPathArb, { minLength: 0, maxLength: 6 }),
        (refs, diskSeed) => {
          // 构造磁盘集合：额外种子 + 约一半 refs 的解析路径“存在”，
          // 以同时产生「存在」与「缺失」两类本地引用。
          const existing = new Set<string>();
          for (const p of diskSeed) {
            existing.add(resolveRefPath("12-tool.md", p));
          }
          refs.forEach((r, i) => {
            if (isLocal(r.rawPath) && i % 2 === 0) {
              existing.add(resolveRefPath(r.chapterFile, r.rawPath));
            }
          });

          // 参照实现：期望缺失引用（保留重复，多重集合）
          const expectedKeys: string[] = [];
          for (const r of refs) {
            if (!isLocal(r.rawPath)) continue;
            const resolved = resolveRefPath(r.chapterFile, r.rawPath);
            if (!existing.has(resolved)) {
              expectedKeys.push(key(r.chapterFile, r.rawPath, resolved));
            }
          }

          const findings = findMissingImages(refs, existing);

          // 每条发现良构
          for (const f of findings) {
            if (f.kind !== "missing-image") return false;
            if (f.resolvedPath === undefined) return false;
            if (existing.has(f.resolvedPath)) return false; // 必不在磁盘集合
          }

          const actualKeys = findings.map((f) =>
            key(f.chapterFile, f.rawPath ?? "", f.resolvedPath ?? "")
          );

          return multisetEqual(actualKeys, expectedKeys);
        }
      ),
      { numRuns: 100 }
    );
  });
});
