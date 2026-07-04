/**
 * 术语与禁用短语原语（任务 3.5，Requirements 1.9/5.5/7.6）。
 *
 * 本模块为纯函数层：输入 Markdown / 数据结构，输出违规记录，无任何 I/O。
 *
 * 提供两个原语 + 一份默认术语表：
 * - checkTermUsage：扫描命中 style-guide §7 术语表反例用法（如「代理人」「提示语」）
 * - detectForbiddenPhrases：扫描版本对比禁用短语（style-guide §3.3），含带白名单的
 *   版本号 token（v1/v2）上下文判定，避免误伤第三方库版本号
 * - defaultTermTable：与 style-guide §7 术语统一表一致的默认术语规则集
 */

import type { TermRule, TermViolation } from "./types";

// ============================================================================
// 默认术语表（style-guide §7）
// ============================================================================

/**
 * 默认术语统一表（与 style-guide §7 一致）。
 *
 * 仅收录**机器可无歧义扫描**的反例用法。对会与规范术语自身冲突或过于宽泛、
 * 易造成大量误报的反例（如单独的「代理」与「代理协议(A2A)」冲突、「思考」与
 * 「思考题」冲突、「指令」「function」「GPT 通称」语义模糊），不纳入自动扫描，
 * 在 `note` 中标注交人工复核，避免噪音淹没真实违规。
 */
export const defaultTermTable: TermRule[] = [
  {
    canonical: "智能体",
    forbidden: ["代理人"],
    note: "「代理」单独使用与「代理协议(A2A)」冲突，归人工复核",
  },
  {
    canonical: "提示词",
    forbidden: ["提示语"],
    note: "「指令」「提示」语义模糊，归人工复核",
  },
  {
    canonical: "System Prompt",
    forbidden: ["系统提示"],
  },
  {
    canonical: "规则引擎",
    forbidden: ["决策引擎", "规则系统"],
  },
  {
    canonical: "上下文",
    forbidden: ["语境"],
  },
  {
    canonical: "工具调用",
    forbidden: ["函数调用"],
  },
  {
    canonical: "工具",
    forbidden: ["函数工具"],
  },
  {
    canonical: "证据链",
    forbidden: ["证据列表"],
  },
];

// ============================================================================
// 禁用短语与版本号白名单（style-guide §3.3）
// ============================================================================

/**
 * 版本对比禁用短语（纯子串匹配，命中即违规）。
 *
 * 这些短语只在「指代本课程自身版本」时出现，无第三方歧义，故无条件上报。
 * v1/v2 单独 token 另由 `VERSION_TOKEN_RE` + 白名单单独判定（见下）。
 */
export const FORBIDDEN_PHRASES: readonly string[] = [
  "历史归档",
  "旧版本",
  "老版本",
  "上一版",
  "升级说明",
  "版本对比",
  "重写前",
];

/**
 * 第三方技术栈名称白名单（小写）。
 *
 * 当 v1/v2 这类版本号 token 紧邻（前文窗口内出现）这些名称时，视为客观描述
 * **第三方库**的版本号（如「Agent SDK v2」「MCP spec v1.0」「next-auth v2」），
 * 不判违规；否则视为指代**本课程版本**的违规措辞（如「相比 v1」「v2 体系课」）。
 *
 * 维护方式：新增受信任的第三方技术名时，把其小写形式（或足以判别的子串，
 * 如用 `sdk` 覆盖「AI SDK / Agent SDK / Server SDK」）追加到此处即可。
 */
export const VERSION_TOKEN_WHITELIST: readonly string[] = [
  "sdk", // 覆盖 AI SDK / Agent SDK / Server SDK / Client SDK
  "ai sdk",
  "next-auth",
  "nextauth",
  "next.js",
  "nextjs",
  "node",
  "react",
  "vue",
  "angular",
  "zod",
  "drizzle",
  "openai",
  "anthropic",
  "claude",
  "gpt",
  "gemini",
  "vercel",
  "assistant-ui",
  "@ai-sdk",
  "mcp",
  "a2a",
  "spec",
  "python",
  "typescript",
  "express",
  // 第三方可观测/网关产品与 ssp-web 自有标识（其版本号/路径段非课程版本）：
  "helicone", // Helicone proxy 端点路径 https://oai.helicone.ai/v1
  "shanghai-plan", // ssp-web 规则集 ID RS-SHANGHAI-PLAN-V1（项目自有版本标识）
];

/**
 * 版本号 token 正则：独立的 `v1` / `v2`（大小写不敏感，前后均为词边界）。
 *
 * 词边界确保不误伤 `dev1`、`env2`、`v10`、`v12` 等：
 * - `v12` / `v10`：`[12]` 后跟数字，`\b` 不成立 → 不匹配（属更高版本号）
 * - `dev1`：`v` 前为字母，`\b` 不成立 → 不匹配
 */
const VERSION_TOKEN_RE = /\bv[12]\b/gi;

/** 版本号 token 白名单上下文窗口（向前看的字符数）。 */
const WHITELIST_WINDOW = 16;

// ============================================================================
// 内部工具
// ============================================================================

/**
 * 计算字符串中 `index` 之前的行号（1 基）。
 */
function countLines(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/**
 * 判定某个版本号 token（位于 `idx`）是否被白名单上下文豁免。
 * 取该 token 之前 `WHITELIST_WINDOW` 个字符（小写）为窗口，若窗口内出现任一
 * 白名单技术名子串，则视为第三方库版本号，豁免。
 */
function isWhitelistedVersionToken(markdown: string, idx: number): boolean {
  const start = Math.max(0, idx - WHITELIST_WINDOW);
  const before = markdown.slice(start, idx).toLowerCase();
  for (const keyword of VERSION_TOKEN_WHITELIST) {
    if (before.includes(keyword)) return true;
  }
  return false;
}

// ============================================================================
// 原语 1：checkTermUsage
// ============================================================================

/**
 * 扫描命中术语表反例用法（Requirements 5.5/7.6）。
 *
 * 对术语表中每条规则的每个反例词，扫描其在文本中的全部出现位置，逐处记录一条
 * 违规：`hit`（命中的反例词）、`canonical`（对应规范术语）、`line`（1 基行号）。
 *
 * @param markdown   章节 Markdown 文本
 * @param termTable  术语规则集（默认可传 `defaultTermTable`）
 * @param sourceFile 来源文件相对 course/ 路径（供审计运行器定位，默认空串）
 */
export function checkTermUsage(
  markdown: string,
  termTable: TermRule[],
  sourceFile = ""
): TermViolation[] {
  const violations: TermViolation[] = [];
  for (const rule of termTable) {
    for (const word of rule.forbidden) {
      if (word === "") continue;
      let from = 0;
      for (;;) {
        const idx = markdown.indexOf(word, from);
        if (idx === -1) break;
        violations.push({
          sourceFile,
          hit: word,
          canonical: rule.canonical,
          line: countLines(markdown, idx),
        });
        from = idx + word.length;
      }
    }
  }
  return violations;
}

// ============================================================================
// 原语 2：detectForbiddenPhrases
// ============================================================================

/**
 * 扫描版本对比禁用短语（Requirements 1.9/7.7，style-guide §3.3）。
 *
 * 两类命中：
 * 1. `FORBIDDEN_PHRASES` 中的固定短语（历史归档 / 旧版本 / 老版本 / 上一版 /
 *    升级说明 / 版本对比 / 重写前）—— 纯子串匹配，无条件上报。
 * 2. 独立版本号 token `v1` / `v2` —— 仅当**未**被白名单上下文（紧邻第三方库名，
 *    如「AI SDK v6」「next-auth v5」）豁免时上报，以免误伤客观描述第三方库版本。
 *
 * 每条违规记录 `hit`（命中短语/版本号）与 `line`（1 基行号）；版本对比短语无对应
 * 规范术语，故不带 `canonical`。
 *
 * @param markdown   章节 Markdown 文本
 * @param sourceFile 来源文件相对 course/ 路径（供审计运行器定位，默认空串）
 */
export function detectForbiddenPhrases(
  markdown: string,
  sourceFile = ""
): TermViolation[] {
  const violations: TermViolation[] = [];

  // 1. 固定禁用短语
  for (const phrase of FORBIDDEN_PHRASES) {
    let from = 0;
    for (;;) {
      const idx = markdown.indexOf(phrase, from);
      if (idx === -1) break;
      violations.push({
        sourceFile,
        hit: phrase,
        line: countLines(markdown, idx),
      });
      from = idx + phrase.length;
    }
  }

  // 2. 版本号 token v1/v2（带白名单上下文判定）
  VERSION_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VERSION_TOKEN_RE.exec(markdown)) !== null) {
    const idx = m.index;
    if (!isWhitelistedVersionToken(markdown, idx)) {
      violations.push({
        sourceFile,
        hit: m[0],
        line: countLines(markdown, idx),
      });
    }
    if (m.index === VERSION_TOKEN_RE.lastIndex) VERSION_TOKEN_RE.lastIndex++;
  }

  return violations;
}
