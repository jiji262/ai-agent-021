import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  checkWordGate,
  WORD_GATE_MIN,
  WORD_GATE_MAX,
} from "../lib/wordcount";

describe("Property 7: 主线节字数门禁", () => {
  it("checkWordGate 通过（返回 null）当且仅当字数 ∈ [4000, 6000]，覆盖 3999/4000/6000/6001 边界", () => {
    // Feature: ai-agent-course-v2-rewrite, Property 7
    // Validates: Requirements 5.4
    const countArb = fc.oneof(
      // 显式覆盖关键边界值。
      fc.constantFrom(0, 3999, 4000, 4001, 5000, 5999, 6000, 6001, 12000),
      // 广覆盖随机字数。
      fc.integer({ min: 0, max: 20000 }),
    );

    fc.assert(
      fc.property(countArb, (count) => {
        const result = checkWordGate(count);
        const inRange = count >= WORD_GATE_MIN && count <= WORD_GATE_MAX;

        // 通过当且仅当落在闭区间。
        expect(result === null).toBe(inRange);

        if (result !== null) {
          expect(result.kind).toBe("word-count-violation");
          // 偏少 / 偏多方向正确。
          if (count < WORD_GATE_MIN) {
            expect(result.detail).toContain("偏少");
          } else {
            expect(result.detail).toContain("偏多");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("边界点逐一断言：3999 拒绝、4000 通过、6000 通过、6001 拒绝", () => {
    expect(checkWordGate(3999)).not.toBeNull();
    expect(checkWordGate(4000)).toBeNull();
    expect(checkWordGate(6000)).toBeNull();
    expect(checkWordGate(6001)).not.toBeNull();
  });
});
