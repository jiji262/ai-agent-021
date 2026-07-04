// Feature: ai-agent-course-v2-rewrite, Property 8: 图片路径合规分类（scope 感知）
// Validates: Requirements 6.3
import { describe, it } from "vitest";
import fc from "fast-check";
import { classifyImagePath } from "../lib/image-paths";
import type { ImagePathScope, ImagePathClass } from "../lib/types";

/**
 * 用「带标注期望值的智能生成器」做 oracle 风格属性测试：
 * 生成器按已知类别构造路径并附带其在给定 scope 下的期望分类，
 * 断言 classifyImagePath 的输出与期望一致。
 *
 * 覆盖：images/x.png、../images/x.png、./images/x.png、含锚点/查询串、
 * 混合分隔符（反斜杠）、空路径/纯锚点、深层逃逸、中文文件名。
 */

type Case = { rawPath: string; scope: ImagePathScope; expected: ImagePathClass };

const scopeArb: fc.Arbitrary<ImagePathScope> = fc.constantFrom("top", "nested");

// 文件名生成器：含中文名、含连字符、含数字与多种扩展名。
const fileNameArb = fc
  .tuple(
    fc.constantFrom(
      "cover",
      "diagram",
      "x",
      "封面",
      "小结卡片",
      "示意图",
      "agent-flow",
      "a1"
    ),
    fc.constantFrom(".png", ".jpg", ".jpeg", ".svg", ".webp")
  )
  .map(([b, e]) => b + e);

// 不改变分类语义的局部装饰：查询串 / 锚点（classifyImagePath 会剥离）。
const localSuffixArb = fc.constantFrom("", "?v=1", "?a=b&c=d", "#sec", "#小结");

function maybeBackslash(path: string, useBs: boolean): string {
  return useBs ? path.replace(/\//g, "\\") : path;
}

// 类别 A：bare images（含可选 ./ 前缀）→ top: compliant；nested: escaping
const bareImagesArb: fc.Arbitrary<Case> = fc
  .record({
    file: fileNameArb,
    scope: scopeArb,
    prefix: fc.constantFrom("", "./"),
    suffix: localSuffixArb,
    bs: fc.boolean(),
  })
  .map(({ file, scope, prefix, suffix, bs }) => ({
    rawPath: maybeBackslash(`${prefix}images/${file}${suffix}`, bs),
    scope,
    expected: scope === "top" ? "compliant" : "escaping",
  }));

// 类别 B：../images → top: escaping；nested: compliant
const parentImagesArb: fc.Arbitrary<Case> = fc
  .record({
    file: fileNameArb,
    scope: scopeArb,
    suffix: localSuffixArb,
    bs: fc.boolean(),
  })
  .map(({ file, scope, suffix, bs }) => ({
    rawPath: maybeBackslash(`../images/${file}${suffix}`, bs),
    scope,
    expected: scope === "top" ? "escaping" : "compliant",
  }));

// 类别 C：外部 / 绝对 / 协议相对 / data → 任意 scope: external
const externalArb: fc.Arbitrary<Case> = fc
  .record({
    file: fileNameArb,
    scope: scopeArb,
    suffix: localSuffixArb,
    form: fc.constantFrom(
      "http://example.com/",
      "https://cdn.test/",
      "//cdn.test/",
      "/abs/"
    ),
  })
  .map(({ file, scope, suffix, form }) => ({
    rawPath: `${form}${file}${suffix}`,
    scope,
    expected: "external" as const,
  }));

const dataUriArb: fc.Arbitrary<Case> = scopeArb.map((scope) => ({
  rawPath: "data:image/png;base64,iVBORw0KGgo=",
  scope,
  expected: "external" as const,
}));

// 类别 D：空路径 / 纯空白 → invalid
const emptyArb: fc.Arbitrary<Case> = fc
  .record({ scope: scopeArb, p: fc.constantFrom("", "   ", "\t") })
  .map(({ scope, p }) => ({ rawPath: p, scope, expected: "invalid" as const }));

// 类别 E：纯锚点 → invalid
const anchorArb: fc.Arbitrary<Case> = fc
  .record({ scope: scopeArb, p: fc.constantFrom("#", "#sec", "#小结-1") })
  .map(({ scope, p }) => ({ rawPath: p, scope, expected: "invalid" as const }));

// 类别 F：深层逃逸 / 其他子目录 → 任意 scope: escaping
const escapeArb: fc.Arbitrary<Case> = fc
  .record({
    file: fileNameArb,
    scope: scopeArb,
    form: fc.constantFrom("../../images/", "../", "shared/", "../assets/"),
  })
  .map(({ file, scope, form }) => ({
    rawPath: `${form}${file}`,
    scope,
    expected: "escaping" as const,
  }));

const caseArb: fc.Arbitrary<Case> = fc.oneof(
  bareImagesArb,
  parentImagesArb,
  externalArb,
  dataUriArb,
  emptyArb,
  anchorArb,
  escapeArb
);

describe("Property 8: classifyImagePath scope 感知分类", () => {
  it("对每个已知类别 × scope，分类结果与期望一致", () => {
    fc.assert(
      fc.property(caseArb, ({ rawPath, scope, expected }) => {
        return classifyImagePath(rawPath, scope) === expected;
      }),
      { numRuns: 100 }
    );
  });
});
