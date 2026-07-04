/**
 * lib/interview.ts —— 面试题解析与元数据校验（design C6 / DM5）。
 *
 * 对应 tasks.md 4.3、Correctness Property 5、Property 7（本 spec 编号下 Property 5/6）。
 * Validates: Requirements 3.2, 3.3, 3.4
 *
 * 解析格式遵守 style-guide §8.3 的逐字符约定：
 *
 *   **Q1.【难度】【主题：X】** 题面正文写在同一行……
 *   <details><summary>参考解答</summary>
 *
 *   参考解答正文。可换行、可分点、可带代码块。
 *
 *   </details>
 *
 * 解析产出 InterviewQuestion（id / difficulty / topic / question / answer）。
 * 校验由 validateQuestionMeta 负责（难度三值枚举、主题 ∈ 知识地图主题集、题面/解答非空）。
 *
 * 本模块为纯函数，不读文件系统。
 */

import type { AuditFinding, Difficulty, InterviewQuestion } from "./types";

/** 合法难度枚举（Requirements 3.3）。 */
const VALID_DIFFICULTIES: ReadonlySet<string> = new Set([
  "基础",
  "进阶",
  "深挖",
]);

/**
 * 题块头部匹配。逐字段宽松匹配以提升鲁棒性：
 * - 题号 `Q<digits>.`，允许句点后紧跟空白
 * - 第一个 `【…】` 捕获为难度（可能越界，交校验器判定）
 * - `【主题：X】` 捕获主题，冒号兼容全角 `：`与半角 `:`
 * - 头部以加粗结束标记 `**` 收尾
 * 使用全局 + 多行匹配以定位所有题块起点。
 */
const HEADER_RE =
  /\*\*Q(\d+)\.\s*【\s*([^】]*?)\s*】\s*【\s*主题\s*[:：]\s*([^】]*?)\s*】\s*\*\*/g;

/**
 * 参考解答折叠块匹配。`summary` 固定写「参考解答」（允许内外空白）。
 * 用非贪婪捕获 `</details>` 之前的全部内容作为解答正文原料。
 */
const DETAILS_RE =
  /<details>\s*<summary>\s*参考解答\s*<\/summary>([\s\S]*?)<\/details>/;

/**
 * 从章节文件名推导题号前缀。
 * - `12-tool-calling.md` → `12`
 * - 无前导数字时（如 `faq.md`）退化为去扩展名的文件名 stem。
 * 仅取 basename，容忍传入带目录的相对路径（如 `extras/01-x.md`）。
 */
function deriveChapterPrefix(chapterFile: string): string {
  const base = chapterFile.split("/").pop() ?? chapterFile;
  const stem = base.replace(/\.[^.]*$/, "");
  const numMatch = stem.match(/^(\d+)/);
  return numMatch ? numMatch[1]! : stem;
}

/**
 * 解析章节 Markdown 中的全部内嵌面试题。
 *
 * 鲁棒性处理：
 * - 题块以头部正则定位；题面取「头部之后到下一题头部（或文末）之间」的文本，
 *   再剥离其中的 `<details>` 折叠块，剩余部分 trim 后即题面。
 * - 缺失 `<details>` 时 answer 记为空串（交 validateQuestionMeta 判为缺解答）。
 * - 难度即便越界也照原文捕获返回（不在解析期丢弃），由校验器统一判违规。
 * - 题号取头部捕获的序号，id 形如 `<前缀>-Q<序号>`。
 *
 * @param markdown 章节正文
 * @param chapterFile 章节文件相对路径（用于推导 id 前缀与回填 chapterFile 字段）
 */
export function parseInterviewQuestions(
  markdown: string,
  chapterFile: string,
): InterviewQuestion[] {
  const prefix = deriveChapterPrefix(chapterFile);
  const questions: InterviewQuestion[] = [];

  // 先收集所有头部匹配的位置与捕获组，再据相邻头部切分题块正文。
  const headers: {
    qnum: string;
    difficulty: string;
    topic: string;
    headerEnd: number;
  }[] = [];

  HEADER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADER_RE.exec(markdown)) !== null) {
    headers.push({
      qnum: m[1]!,
      difficulty: m[2]!,
      topic: m[3]!,
      headerEnd: m.index + m[0].length,
    });
    // 防御零宽匹配导致的死循环（理论上不会，因头部含必需字符）。
    if (m.index === HEADER_RE.lastIndex) HEADER_RE.lastIndex++;
  }

  // 重新定位每个题块的起点（用于确定下一题块边界）。
  const headerStarts: number[] = [];
  HEADER_RE.lastIndex = 0;
  while ((m = HEADER_RE.exec(markdown)) !== null) {
    headerStarts.push(m.index);
    if (m.index === HEADER_RE.lastIndex) HEADER_RE.lastIndex++;
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]!;
    // 题块正文 = 本题头部之后 → 下一题头部之前（或文末）。
    const blockEnd =
      i + 1 < headerStarts.length ? headerStarts[i + 1]! : markdown.length;
    const blockBody = markdown.slice(header.headerEnd, blockEnd);

    // 抽取参考解答折叠块。
    const detailsMatch = blockBody.match(DETAILS_RE);
    const answer = detailsMatch ? detailsMatch[1]!.trim() : "";

    // 题面 = 折叠块之前的文本（若无折叠块，则整段 blockBody）。
    const questionRaw = detailsMatch
      ? blockBody.slice(0, detailsMatch.index ?? blockBody.length)
      : blockBody;
    const question = questionRaw.trim();

    questions.push({
      id: `${prefix}-Q${header.qnum}`,
      chapterFile,
      // 难度可能越界；按 Difficulty 形态返回，越界值由校验器拒绝。
      difficulty: header.difficulty as Difficulty,
      topic: header.topic,
      question,
      answer,
    });
  }

  return questions;
}

/**
 * 校验单道面试题的元数据良构性（Requirements 3.3, 3.4）。
 *
 * 通过（返回空数组）当且仅当：
 * - `difficulty ∈ {基础, 进阶, 深挖}`
 * - `topic ∈ topics`（知识地图主题集）
 * - `question` 非空（去空白后长度 > 0）
 * - `answer` 非空（去空白后长度 > 0）
 *
 * @param q 面试题
 * @param topics 知识地图主题集合
 * @returns 违规发现列表；每条 `kind` 为 `invalid-question-meta`，`sourceFile`
 *          取题所在章节，`detail` 含题 id 与具体违规原因。
 */
export function validateQuestionMeta(
  q: InterviewQuestion,
  topics: ReadonlySet<string>,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const sourceFile = q.chapterFile;

  if (!VALID_DIFFICULTIES.has(q.difficulty)) {
    findings.push({
      kind: "invalid-question-meta",
      sourceFile,
      detail: `${q.id}：难度越界（期望 基础/进阶/深挖，实际「${q.difficulty}」）`,
    });
  }

  if (!topics.has(q.topic)) {
    findings.push({
      kind: "invalid-question-meta",
      sourceFile,
      detail: `${q.id}：主题「${q.topic}」不在知识地图主题集中`,
    });
  }

  if (q.question.trim().length === 0) {
    findings.push({
      kind: "invalid-question-meta",
      sourceFile,
      detail: `${q.id}：题面为空`,
    });
  }

  if (q.answer.trim().length === 0) {
    findings.push({
      kind: "invalid-question-meta",
      sourceFile,
      detail: `${q.id}：参考解答为空`,
    });
  }

  return findings;
}
