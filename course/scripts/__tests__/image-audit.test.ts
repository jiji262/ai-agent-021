import { describe, it, expect } from "vitest";
import { findMissingImages, findOrphanImages } from "../lib/image-audit";
import type { ImageRef } from "../lib/types";

/**
 * image-audit 原语单元测试（任务 2.5）：覆盖具体示例与边界。
 */

const mk = (chapterFile: string, rawPath: string): ImageRef => ({
  chapterFile,
  rawPath,
  alt: "",
  line: 1,
});

describe("findMissingImages", () => {
  it("解析后存在 → 无缺失发现", () => {
    const refs = [mk("12-tool.md", "images/a.png")];
    const existing = new Set(["images/a.png"]);
    expect(findMissingImages(refs, existing)).toHaveLength(0);
  });

  it("解析后不存在 → 记录 chapter 与 resolvedPath", () => {
    const refs = [mk("12-tool.md", "images/missing.png")];
    const existing = new Set(["images/a.png"]);
    const findings = findMissingImages(refs, existing);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: "missing-image",
      chapterFile: "12-tool.md",
      rawPath: "images/missing.png",
      resolvedPath: "images/missing.png",
    });
  });

  it("extras 章节 ../images/ 正确解析回 course/images 再比对", () => {
    const refs = [mk("extras/01-admin.md", "../images/a.png")];
    const existing = new Set(["images/a.png"]);
    expect(findMissingImages(refs, existing)).toHaveLength(0);
  });

  it("外部引用 / 空路径 / 纯锚点不参与存在性比对", () => {
    const refs = [
      mk("c.md", "https://cdn/x.png"),
      mk("c.md", "/abs/x.png"),
      mk("c.md", "//cdn/x.png"),
      mk("c.md", "data:image/png;base64,A"),
      mk("c.md", ""),
      mk("c.md", "#anchor"),
    ];
    expect(findMissingImages(refs, new Set())).toHaveLength(0);
  });

  it("逃逸 ../images（顶层）解析为 ../images/ 通常不在磁盘集合中 → 记为缺失", () => {
    const refs = [mk("12-tool.md", "../images/a.png")];
    const existing = new Set(["images/a.png"]);
    const findings = findMissingImages(refs, existing);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.resolvedPath).toBe("../images/a.png");
  });
});

describe("findOrphanImages", () => {
  it("返回磁盘有但无人引用的文件（集合差）", () => {
    const disk = ["images/a.png", "images/b.png", "images/c.png"];
    const referenced = new Set(["images/a.png"]);
    expect(findOrphanImages(disk, referenced).map((o) => o.filePath)).toEqual([
      "images/b.png",
      "images/c.png",
    ]);
  });

  it("全部被引用 → 无孤立", () => {
    const disk = ["images/a.png"];
    const referenced = new Set(["images/a.png"]);
    expect(findOrphanImages(disk, referenced)).toHaveLength(0);
  });

  it("磁盘重复项去重", () => {
    const disk = ["images/a.png", "images/a.png", "images/b.png"];
    const referenced = new Set<string>();
    expect(findOrphanImages(disk, referenced).map((o) => o.filePath)).toEqual([
      "images/a.png",
      "images/b.png",
    ]);
  });

  it("结果按 filePath 升序", () => {
    const disk = ["images/c.png", "images/a.png", "images/b.png"];
    const referenced = new Set<string>();
    expect(findOrphanImages(disk, referenced).map((o) => o.filePath)).toEqual([
      "images/a.png",
      "images/b.png",
      "images/c.png",
    ]);
  });

  it("空磁盘 → 空结果", () => {
    expect(findOrphanImages([], new Set(["images/a.png"]))).toHaveLength(0);
  });
});
