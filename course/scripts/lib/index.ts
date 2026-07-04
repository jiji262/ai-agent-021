/**
 * lib 桶文件（barrel）。后续原语模块（image-paths、image-audit、numbering、
 * refs、terms、interview、gap-report、report 等）实现后从此处统一导出。
 *
 * 目前导出共享数据模型类型与已实现的内容门禁原语。
 */
export type * from "./types";

// 图片审计原语（tasks.md 阶段 2）
export {
  parseImageRefs,
  classifyImagePath,
  resolveRefPath,
  countImageDensity,
  isExternalPath,
} from "./image-paths";
export { findMissingImages, findOrphanImages } from "./image-audit";

// 内容门禁原语（tasks.md 阶段 4）
export { validateGapDecision } from "./gap-report";
export { parseInterviewQuestions, validateQuestionMeta } from "./interview";
export { checkKnowledgeMapCoverage } from "./knowledge-map";
export {
  countWords,
  checkWordGate,
  WORD_GATE_MIN,
  WORD_GATE_MAX,
} from "./wordcount";

// 一致性审计原语（tasks.md 阶段 3）
export {
  mapFileToTitleNumber,
  checkTitleNumber,
  NUMBERING_RULES,
} from "./numbering";
export {
  parseCrossRefs,
  parseReadmeTocLinks,
  findBrokenRefs,
  V1_CHAPTER_FILES,
} from "./refs";
export {
  checkTermUsage,
  detectForbiddenPhrases,
  defaultTermTable,
  FORBIDDEN_PHRASES,
  VERSION_TOKEN_WHITELIST,
} from "./terms";
export { computePassed } from "./report";
export type { AuditLikeReport } from "./report";
