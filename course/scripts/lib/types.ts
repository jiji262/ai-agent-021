/**
 * 共享数据模型 —— AI Agent V2 课程校验子系统
 *
 * 本文件集中定义校验器/转换器纯函数层使用的数据结构，对应 design.md 的
 * Data Models 章节（DM2–DM7）以及各 lib 原语（image-paths / image-audit /
 * numbering / refs / terms / interview / gap-report / report 等）的输入输出契约。
 *
 * 约定：所有类型仅描述数据形态，不含 I/O；路径一律相对 `course/`。
 */

// ============================================================================
// 通用审计发现（design DM7）
// ============================================================================

/**
 * 审计发现类型枚举。覆盖图片、引用、编号、术语、结构、残留 V1 等问题类别。
 */
export type AuditFindingKind =
  | "missing-image"
  | "bad-image-path"
  | "orphan-image"
  | "broken-xref"
  | "numbering-mismatch"
  | "term-drift"
  | "missing-section"
  | "residual-v1-ref"
  | "unreadable-chapter"
  // 内容门禁原语（lib/gap-report、lib/interview、lib/knowledge-map、lib/wordcount）
  | "invalid-gap-decision"
  | "invalid-question-meta"
  | "unmapped-chapter"
  | "word-count-violation";

/**
 * 单条审计发现（design DM7）。
 * - `sourceFile`：触发该问题的 Chapter（相对 course/ 路径）
 * - `detail`：缺失路径 / 目标路径 / 命中词 / 缺失段落名 等
 */
export type AuditFinding = {
  kind: AuditFindingKind;
  sourceFile: string;
  detail: string;
};

/**
 * 通用审计报告（design DM7）。`passed` 为真当且仅当 `findings` 为空。
 */
export type AuditReport = {
  findings: AuditFinding[];
  passed: boolean;
};

// ============================================================================
// 图片审计模型（Requirements 6.x）
// ============================================================================

/**
 * 从 Chapter 中解析出的单个图片引用（Markdown `![alt](path)`）。
 * - `chapterFile`：引用所在的 Chapter，相对 course/ 路径
 * - `rawPath`：引用的原始路径文本，如 `images/x.png` 或 `../images/x.png`
 * - `alt`：alt 文本（可能为空串）
 * - `line`：引用所在行号（1 基）
 */
export type ImageRef = {
  chapterFile: string;
  rawPath: string;
  alt: string;
  line: number;
};

/**
 * 图片路径的 scope 感知分类结果。
 * - `top`：顶层 Chapter（course/ 直接子文件）
 * - `nested`：嵌套 Chapter（如 course/extras/ 下的文件）
 */
export type ImagePathScope = "top" | "nested";

/**
 * 图片路径合规分类结果（Requirements 6.3）。
 * - `compliant`：相对 course/ 的 `images/...`，或 nested scope 下能解析回 course/images/ 的 `../images/...`
 * - `escaping`：top scope 下的 `../images/...` 逃逸引用（不合规）
 * - `external`：http(s)/绝对路径等非本地课程图片
 * - `invalid`：空路径、纯锚点等无法归类为图片文件的路径
 */
export type ImagePathClass = "compliant" | "escaping" | "external" | "invalid";

/**
 * 图片审计发现（Requirements 6.1/6.2/6.3）。
 * 覆盖缺失图片、路径不规范、不可读章节、密度不达标等图片维度问题。
 */
export type ImageAuditFinding = {
  kind: Extract<
    AuditFindingKind,
    "missing-image" | "bad-image-path" | "unreadable-chapter"
  > | "density-violation";
  chapterFile: string;
  /** 触发问题的原始引用路径（密度/不可读类发现可缺省）。 */
  rawPath?: string;
  /** 解析到的目标路径（仅缺失图片类发现给出）。 */
  resolvedPath?: string;
  detail: string;
};

/**
 * 孤立图片：存在于 course/images/ 但未被任何 Chapter 引用的文件（Requirements 6.6）。
 */
export type OrphanImage = {
  /** 相对 course/ 的图片文件路径，如 `images/unused.png`。 */
  filePath: string;
};

/**
 * 图片审计报告（Requirements 6.6）。
 * `passed` 为真当且仅当 findings / orphans / densityViolations 均为空。
 */
export type ImageAuditReport = {
  /** 缺失图片 + 路径不规范 + 不可读章节等发现。 */
  findings: ImageAuditFinding[];
  /** 孤立图片列表。 */
  orphans: OrphanImage[];
  /** 主线节图片密度不达标的发现（Requirements 6.4/6.5）。 */
  densityViolations: ImageAuditFinding[];
  passed: boolean;
};

// ============================================================================
// 一致性审计模型（Requirements 7.x）
// ============================================================================

/**
 * Chapter 类别。用于编号映射与结构校验。
 */
export type ChapterKind =
  | "mainline"
  | "prologue"
  | "intro"
  | "epilogue"
  | "extra"
  | "faq";

/**
 * 编号映射条目（design DM2）。
 * - `fileNumber`：文件名中的序号（如 `12-tool-calling.md` → 12），无序号则为 null
 * - `titleNumber`：标题中的节号，主线节 = fileNumber − 1，特殊页为 null
 */
export type NumberingEntry = {
  file: string;
  kind: ChapterKind;
  fileNumber: number | null;
  titleNumber: number | null;
};

/**
 * 编号推导规则（design DM2 的映射表，数据化表达）。
 * - `hasNumber`：该类 Chapter 标题是否带节号
 * - `titleOffset`：标题节号 = fileNumber + titleOffset（主线节为 −1；其余类不适用）
 */
export type NumberingRule = {
  kind: ChapterKind;
  hasNumber: boolean;
  titleOffset: number;
};

/**
 * 跨节引用（Requirements 7.2/7.3/7.4）。Chapter 或 README 中指向其他 Chapter 的相对链接。
 */
export type CrossRef = {
  /** 引用所在文件（来源 Chapter / README），相对 course/ 路径。 */
  sourceFile: string;
  /** 链接目标的原始相对路径，如 `12-tool-calling.md`。 */
  rawPath: string;
  /** 链接显示文字。 */
  text: string;
  line: number;
};

/**
 * 断链记录（Requirements 7.3）。目标无法解析到真实 Chapter 文件。
 */
export type BrokenRef = {
  /** 断链来源文件，相对 course/ 路径。 */
  sourceFile: string;
  /** 原始链接路径。 */
  rawPath: string;
  /** 解析后的目标路径。 */
  targetPath: string;
};

/**
 * 术语统一规则（Requirements 5.5/7.6）。
 * - `canonical`：规范术语，如「智能体」「提示词」
 * - `forbidden`：应被纠正的反例用法，如「代理人」「提示语」
 */
export type TermRule = {
  canonical: string;
  forbidden: string[];
  note?: string;
};

/**
 * 术语 / 禁用短语违规记录（Requirements 1.9/5.5/7.6）。
 */
export type TermViolation = {
  /** 违规所在文件，相对 course/ 路径。 */
  sourceFile: string;
  /** 命中的反例词或禁用短语，如「代理人」「v1」「历史归档」。 */
  hit: string;
  /** 对应的规范术语（术语反例时给出；纯禁用短语可缺省）。 */
  canonical?: string;
  line: number;
};

/**
 * 一致性审计报告（Requirements 7.8）。
 * `passed` 为真当且仅当全部发现列表为空。
 */
export type ConsistencyAuditReport = {
  /** 编号不一致（Requirements 7.1）。 */
  numberingMismatches: AuditFinding[];
  /** 跨节引用断链（Requirements 7.2/7.3）。 */
  brokenRefs: BrokenRef[];
  /** README 目录链接断链（Requirements 7.4）。 */
  readmeBrokenLinks: BrokenRef[];
  /** 术语漂移与禁用短语（Requirements 5.5/7.6/7.7）。 */
  termViolations: TermViolation[];
  /** 残留 V1 / 根图引用（Requirements 7.7）。 */
  residualV1Refs: AuditFinding[];
  /** 结构缺段、人物设定冲突等（Requirements 5.2/7.5）。 */
  structureFindings: AuditFinding[];
  passed: boolean;
};

// ============================================================================
// 面试题模型（design DM5，Requirements 3.x）
// ============================================================================

/**
 * 面试题难度等级（Requirements 3.3）。
 */
export type Difficulty = "基础" | "进阶" | "深挖";

/**
 * 面试题（design DM5）。
 * - `id`：如 `12-Q2`
 * - `topic`：所属知识主题，须 ∈ knowledge-map 主题集（Requirements 3.4）
 * - `answer`：参考解答（Requirements 3.2/3.6），非空
 */
export type InterviewQuestion = {
  id: string;
  chapterFile: string;
  difficulty: Difficulty;
  topic: string;
  question: string;
  answer: string;
};

// ============================================================================
// V1→V2 迁移决策模型（design DM3，Requirements 1.3/1.4）
// ============================================================================

/**
 * V1→V2 内容迁移决策（design DM3）。
 * 不变式：
 * - `covered=true` ⇒ `decision` 不存在
 * - `decision="merge_into"` ⇒ `targetChapter` 存在
 */
export type MigrationDecision = {
  /** V1 章节文件 + 小节定位。 */
  v1Source: string;
  /** 知识点描述。 */
  knowledgePoint: string;
  /** V2 是否已覆盖。 */
  covered: boolean;
  /** 仅当 covered=false 才有。 */
  decision?: "merge_into" | "drop";
  /** 仅当 decision="merge_into"。 */
  targetChapter?: string;
  rationale: string;
};

// ============================================================================
// 图片资源迁移模型（design DM4，Requirements 1.6）
// ============================================================================

/**
 * 根目录图片引用（design DM4）。Chapter 中形如 `../images/X` 的引用。
 */
export type RootImageRef = {
  /** 含 ../images 的章节，相对 course/ 路径。 */
  chapterFile: string;
  /** 原始引用路径，如 `../images/00-llm-vs-agent.png`。 */
  rawPath: string;
  /** 图片文件名，如 `00-llm-vs-agent.png`。 */
  fileName: string;
  /** 根 images/ 中是否存在该源文件。 */
  sourceExists: boolean;
};

/**
 * 单个图片迁移动作（design DM4）。
 */
export type MigrationAction = {
  fileName: string;
  sourceExists: boolean;
  /** 与 course/images/ 已有文件的冲突状态。 */
  conflict: "none" | "same-content" | "name-collision";
  /** 冲突时 = `legacy-<原名>`，否则 = 原文件名。 */
  targetName: string;
  /** 改写后的引用路径，形如 `images/<targetName>`。 */
  newRefPath: string;
  /** 迁移处理方式。 */
  resolution:
    | "copy"
    | "reuse-existing"
    | "rename"
    | "placeholder"
    | "regenerate";
};

/**
 * 图片迁移计划（design DM4）。
 */
export type MigrationPlan = {
  actions: MigrationAction[];
  /** 被引用但根目录中不存在的源图（坏引用）。 */
  missingSources: string[];
};

// ============================================================================
// ssp-web 配套代码评估模型（design DM6，Requirements 4.x）
// ============================================================================

/**
 * 单条依赖更新建议（design DM6）。
 * 不变式：`gap=true` ⇒ `priority` 与 `rationale` 存在。
 */
export type Recommendation = {
  dependency: string;
  /** ssp-web 当前版本。 */
  current: string;
  /** 重写日期时的最新稳定版。 */
  latest: string;
  gap: boolean;
  /** 仅当 gap=true。 */
  priority?: "P0" | "P1" | "P2";
  /** 仅当 gap=true。 */
  rationale?: string;
  /** 是否影响教程已引用的代码片段（Requirements 4.5）。 */
  affectsTutorialCode: boolean;
};

/**
 * ssp-web 评估报告（design DM6，Requirements 4.6）。
 */
export type AssessmentReport = {
  recommendations: Recommendation[];
  overall: "无需更新" | "建议小幅更新" | "建议较大更新";
};
