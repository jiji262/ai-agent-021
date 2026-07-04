// Feature: ai-agent-course-v2-rewrite, Property 10: 图片密度门禁
// Validates: Requirements 6.4, 6.5
import { describe, it } from "vitest";
import fc from "fast-check";
import { countImageDensity } from "../lib/image-paths";
import type { ImageRef } from "../lib/types";

/**
 * 密度门禁定义（待验证的判定逻辑，建立在 countImageDensity 之上）：
 * 通过当且仅当 total ≥ 5 且 hasHero 且 hasSummary。
 *
 * 本属性用「随机引用集合」驱动 countImageDensity，再用独立的参照实现
 * 重新计算期望 total/hasHero/hasSummary 与门禁结果，断言两者一致。
 * 生成器刻意覆盖 0..8 张图、含/不含 hero、含/不含 summary 的组合，
 * 以触达 ≥5 与 <5、缺 hero、缺 summary 等边界。
 */

// 单条引用生成器：文件名可能含 hero / summary / 普通名 / 中文名。
function refWithName(name: string): ImageRef {
  return { chapterFile: "12-tool.md", rawPath: `images/${name}`, alt: "", line: 1 };
}

const namePoolArb = fc.constantFrom(
  "hero-cover.png",
  "HERO.png",
  "section-hero.webp",
  "summary-card.png",
  "Summary.jpg",
  "节末小结-summary.png",
  "diagram.png",
  "flow.svg",
  "封面.png",
  "x.png"
);

const refArb: fc.Arbitrary<ImageRef> = namePoolArb.map(refWithName);

// 参照实现：与 countImageDensity 独立地计算期望值。
function expectedDensity(refs: ImageRef[]): {
  total: number;
  hasHero: boolean;
  hasSummary: boolean;
} {
  let hasHero = false;
  let hasSummary = false;
  for (const r of refs) {
    const lower = r.rawPath.toLowerCase();
    const base = lower.slice(lower.lastIndexOf("/") + 1);
    if (base.includes("hero")) hasHero = true;
    if (base.includes("summary")) hasSummary = true;
  }
  return { total: refs.length, hasHero, hasSummary };
}

function densityPasses(d: {
  total: number;
  hasHero: boolean;
  hasSummary: boolean;
}): boolean {
  return d.total >= 5 && d.hasHero && d.hasSummary;
}

describe("Property 10: countImageDensity 与密度门禁", () => {
  it("统计值与门禁结果当且仅当 total≥5 且含 hero 且含 summary 时通过", () => {
    fc.assert(
      fc.property(fc.array(refArb, { minLength: 0, maxLength: 8 }), (refs) => {
        const actual = countImageDensity(refs);
        const expected = expectedDensity(refs);

        const fieldsMatch =
          actual.total === expected.total &&
          actual.hasHero === expected.hasHero &&
          actual.hasSummary === expected.hasSummary;

        const gate = densityPasses(actual);
        const gateMatchesDefinition =
          gate === (refs.length >= 5 && actual.hasHero && actual.hasSummary);

        return fieldsMatch && gateMatchesDefinition;
      }),
      { numRuns: 100 }
    );
  });
});
