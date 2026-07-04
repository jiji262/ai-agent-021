/**
 * lib/wordcount.ts —— 主线节正文字数统计与字数门禁（Requirements 5.4）。
 *
 * 对应 tasks.md 4.8、Correctness Property 7。
 * Validates: Requirements 5.4
 *
 * ── countWords 统计口径（与 style-guide「正文字数落在 [4000,6000]」对齐）──
 *
 * 目标：统计读者实际阅读的「正文」字数，剔除不计入阅读量的结构性 / 非正文内容。
 *
 * 1. 先剔除「不计字数」的片段（按顺序，避免互相干扰）：
 *    a. 围栏代码块 ``` … ``` 与 ~~~ … ~~~（含语言标注与代码内容整体剔除）。
 *    b. HTML 注释 <!-- … -->（含给图片代理的「图片说明」原料，整体剔除）。
 *    c. 行内代码 `code`（剔除，代码不计阅读字数）。
 *    d. 图片引用 ![alt](path)（整体剔除：alt 文本与路径都不计正文）。
 * 2. 再把「保留文字但需去壳」的 Markdown 语法标记规整：
 *    e. 链接 [text](url) → 仅保留显示文字 text，丢弃 URL。
 *    f. 标题井号、引用块、列表项符号（连字符/星号/加号/有序号）、表格竖线等行首与分隔标记剔除。
 *    g. 强调标记（双星号、单星号、下划线、删除线等）成对或单个符号剔除（其包裹的文字保留）。
 * 3. 在规整后的纯文本上计数：
 *    - 中文（含 CJK 统一表意文字、扩展区、兼容区及中日韩标点中的汉字）：**按字计**，
 *      每个 CJK 表意文字记 1。
 *    - 英文 / 数字：**按词计**，连续的 [A-Za-z0-9] 串记 1 个词（如 `streamText`、`v6`、`4000`）。
 *    - 标点、空白、表情符号等：不计入。
 *
 * 该口径为「合理统计」而非精确排版字数：它稳定、可复现、对中英文混排友好，
 * 足以支撑 [4000,6000] 区间门禁判定。
 *
 * ── checkWordGate ──
 * 通过（返回 null）当且仅当字数 ∈ 闭区间 [4000, 6000]；否则返回一条
 * `word-count-violation` 发现，detail 标明「偏少 / 偏多」与实际字数。
 */

import type { AuditFinding } from "./types";

/** 主线节字数门禁下界（闭区间）。 */
export const WORD_GATE_MIN = 4000;
/** 主线节字数门禁上界（闭区间）。 */
export const WORD_GATE_MAX = 6000;

// CJK 表意文字范围（按字计的「中文字」）：
// - U+4E00–U+9FFF   基本区
// - U+3400–U+4DBF   扩展 A
// - U+F900–U+FAFF   兼容表意文字
// - U+20000–U+2A6DF 扩展 B（用 \u{...} 需 u 标志）
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2a6df}]/gu;

// 英文 / 数字「词」：连续的 ASCII 字母数字串。
const EN_WORD_RE = /[A-Za-z0-9]+/g;

/**
 * 剥离不计字数片段并规整 Markdown 语法标记，返回用于计数的纯文本。
 */
function stripForCounting(markdown: string): string {
  let text = markdown;

  // a. 围栏代码块（``` 或 ~~~，含语言标注）。非贪婪，跨行。
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/~~~[\s\S]*?~~~/g, " ");

  // b. HTML 注释（含图片说明原料）。
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // c. 行内代码。
  text = text.replace(/`[^`]*`/g, " ");

  // d. 图片引用 ![alt](path)：整体剔除。
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");

  // e. 链接 [text](url)：保留显示文字，丢弃 URL。
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // 去除残留的 HTML 标签（如 <details>、<summary>、<br> 等），保留其文字内容。
  text = text.replace(/<\/?[A-Za-z][^>]*>/g, " ");

  // f. 行首结构标记：标题井号、引用块、列表符号。逐行处理。
  text = text
    .split("\n")
    .map((line) => {
      let l = line;
      l = l.replace(/^\s{0,3}#{1,6}\s+/, ""); // ATX 标题
      l = l.replace(/^\s*>+\s?/, ""); // 引用块
      l = l.replace(/^\s*([-*+]|\d+[.)])\s+/, ""); // 列表项
      return l;
    })
    .join("\n");

  // 表格竖线与对齐分隔行：去掉竖线（保留单元格文字）。
  text = text.replace(/\|/g, " ");

  // g. 强调 / 删除线标记（成对或单个）：去符号留文字。
  text = text.replace(/(\*\*|\*|__|_|~~)/g, "");

  return text;
}

/**
 * 统计 Markdown 正文字数（中文按字、英文按词），口径见文件头注释。
 *
 * @param markdown 章节正文
 * @returns 字数（CJK 字数 + 英文/数字词数）
 */
export function countWords(markdown: string): number {
  const text = stripForCounting(markdown);

  const cjkMatches = text.match(CJK_RE);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  const enMatches = text.match(EN_WORD_RE);
  const enCount = enMatches ? enMatches.length : 0;

  return cjkCount + enCount;
}

/**
 * 字数门禁判定（Requirements 5.4）。
 *
 * @param count 正文字数（通常来自 countWords）
 * @returns 通过则返回 null；否则返回一条 `word-count-violation` 发现，
 *          detail 标明偏少 / 偏多与实际字数及目标区间。
 */
export function checkWordGate(count: number): AuditFinding | null {
  if (count < WORD_GATE_MIN) {
    return {
      kind: "word-count-violation",
      sourceFile: "",
      detail: `正文字数偏少：${count} < ${WORD_GATE_MIN}（目标区间 [${WORD_GATE_MIN}, ${WORD_GATE_MAX}]）`,
    };
  }
  if (count > WORD_GATE_MAX) {
    return {
      kind: "word-count-violation",
      sourceFile: "",
      detail: `正文字数偏多：${count} > ${WORD_GATE_MAX}（目标区间 [${WORD_GATE_MIN}, ${WORD_GATE_MAX}]）`,
    };
  }
  return null;
}
