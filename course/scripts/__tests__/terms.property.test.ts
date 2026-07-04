// Feature: ai-agent-course-v2-rewrite, Property 3: 禁用短语与术语反例检测（detectForbiddenPhrases/checkTermUsage）
// Validates: Requirements 1.9, 5.5, 7.6
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  detectForbiddenPhrases,
  checkTermUsage,
  defaultTermTable,
  FORBIDDEN_PHRASES,
} from "../lib/terms";

/**
 * 属性：对任意章节文本，禁用短语 + 术语反例扫描的合并违规列表为非空，当且仅当
 * 文本含 ≥1 禁用项（固定禁用短语 / 术语表反例词 / 未被白名单豁免的 v1·v2 token）；
 * 干净文本（仅含规范术语与中性词）产生零违规；每条违规记录命中项 hit 与合法行号。
 *
 * 构造策略：
 * - 干净基线只用「保证不含任何禁用子串、且不含 v1/v2 token、且不构成白名单上下文」
 *   的中性中文词拼接，确保干净文本必然零违规。
 * - 注入项从 FORBIDDEN_PHRASES ∪ 术语反例词 ∪ {版本 token（带非白名单上下文）} 取。
 */

// 中性词池：逐一确认不含任何禁用短语 / 术语反例 / v1·v2 子串。
const CLEAN_WORDS = [
  "智能体",
  "推理",
  "记忆",
  "评测",
  "成本",
  "部署",
  "上下文",
  "工具",
  "模型",
  "协议",
  "流式",
  "安全护栏",
  "提示词",
];

const cleanLineArb = fc
  .array(fc.constantFrom(...CLEAN_WORDS), { minLength: 1, maxLength: 6 })
  .map((words) => words.join(""));

// 注入项：{ text 注入文本, hit 期望命中 token }。
type Injection = { text: string; hit: string };

const phraseInjectionArb: fc.Arbitrary<Injection> = fc
  .constantFrom(...FORBIDDEN_PHRASES)
  .map((p) => ({ text: p, hit: p }));

// 术语反例词（来自默认术语表所有 forbidden）。
const TERM_FORBIDDEN: string[] = defaultTermTable.flatMap((r) => r.forbidden);
const termInjectionArb: fc.Arbitrary<Injection> = fc
  .constantFrom(...TERM_FORBIDDEN)
  .map((w) => ({ text: w, hit: w }));

// 版本 token：用非白名单上下文「相比 」前缀，确保不被豁免。
const versionInjectionArb: fc.Arbitrary<Injection> = fc
  .constantFrom("v1", "v2")
  .map((v) => ({ text: `相比 ${v} 而言`, hit: v }));

const injectionArb = fc.oneof(
  phraseInjectionArb,
  termInjectionArb,
  versionInjectionArb,
);

// 一行：要么干净，要么干净 + 注入项。
const lineArb = fc.oneof(
  cleanLineArb.map((c) => ({ line: c, injected: null as Injection | null })),
  fc
    .record({ c: cleanLineArb, inj: injectionArb })
    .map(({ c, inj }) => ({ line: `${c}${inj.text}`, injected: inj })),
);

describe("Property 3: 禁用短语与术语反例检测", () => {
  it("合并违规非空 ⟺ 含 ≥1 禁用项；干净文本零违规；记录命中项与合法行号", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 12 }), (lines) => {
        const md = lines.map((l) => l.line).join("\n");
        const totalLines = md.split("\n").length;

        const violations = [
          ...detectForbiddenPhrases(md, "12-tool.md"),
          ...checkTermUsage(md, defaultTermTable, "12-tool.md"),
        ];

        const injectedHits = lines
          .filter((l) => l.injected !== null)
          .map((l) => l.injected!.hit);
        const expectedHasForbidden = injectedHits.length > 0;

        // (1) iff：非空 ⟺ 含禁用项。
        expect(violations.length > 0).toBe(expectedHasForbidden);

        // (2) 每条违规：hit 非空、行号合法。
        for (const v of violations) {
          expect(typeof v.hit).toBe("string");
          expect(v.hit.length).toBeGreaterThan(0);
          expect(v.line).toBeGreaterThanOrEqual(1);
          expect(v.line).toBeLessThanOrEqual(totalLines);
        }

        // (3) 每个注入的命中 token 都至少被某条违规捕获。
        const hitSet = new Set(violations.map((v) => v.hit));
        for (const h of injectedHits) {
          expect(hitSet.has(h)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
