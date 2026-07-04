// Feature: ai-agent-course-v2-rewrite, Property 11: 孤立图片为集合差
// Validates: Requirements 6.6
import { describe, it } from "vitest";
import fc from "fast-check";
import { findOrphanImages } from "../lib/image-audit";

/**
 * 属性：findOrphanImages(diskPaths, referencedPaths) 返回的文件集合，
 * 恰等于「磁盘去重集合 − 被引用集合」（严格集合差）。
 *
 * 断言：
 * 1) 结果集合 == diskSet \ referencedSet（双向包含）
 * 2) 结果中每个 filePath 都在磁盘集合中、且不在被引用集合中
 * 3) 结果无重复（去重）
 * 4) 结果按 filePath 升序
 */

const pathArb = fc.constantFrom(
  "images/a.png",
  "images/b.png",
  "images/c.png",
  "images/封面.png",
  "images/sub/d.webp",
  "images/e.svg",
  "images/f.jpg",
  "images/g.jpeg"
);

describe("Property 11: findOrphanImages = 磁盘集合 − 被引用集合", () => {
  it("结果恰为集合差，去重且升序", () => {
    fc.assert(
      fc.property(
        fc.array(pathArb, { minLength: 0, maxLength: 8 }),
        fc.array(pathArb, { minLength: 0, maxLength: 8 }),
        (diskPaths, referenced) => {
          const referencedSet = new Set(referenced);
          const orphans = findOrphanImages(diskPaths, referencedSet);
          const orphanPaths = orphans.map((o) => o.filePath);

          // 期望集合差
          const diskSet = new Set(diskPaths);
          const expected = [...diskSet].filter((p) => !referencedSet.has(p));

          // (1) 集合相等（双向包含，忽略顺序）
          const actualSet = new Set(orphanPaths);
          if (actualSet.size !== expected.length) return false;
          for (const p of expected) if (!actualSet.has(p)) return false;

          // (2) 每项在磁盘集合中且不在被引用集合中
          for (const p of orphanPaths) {
            if (!diskSet.has(p)) return false;
            if (referencedSet.has(p)) return false;
          }

          // (3) 无重复
          if (orphanPaths.length !== actualSet.size) return false;

          // (4) 升序
          const sorted = [...orphanPaths].sort();
          for (let i = 0; i < orphanPaths.length; i++) {
            if (orphanPaths[i] !== sorted[i]) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
