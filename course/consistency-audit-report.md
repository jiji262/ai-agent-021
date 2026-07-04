# 一致性审计报告（Consistency Audit Report）

> 生成方式：运行 `ConsistencyAuditor`（`scripts/audit-consistency.ts` 的 `auditConsistency(courseDir)`），目标目录 `course/`。
> 本文件由任务 14.1 产出，属**报告**任务，不修改校验器代码或章节内容。

## 概要

| 项目 | 结果 |
| --- | --- |
| **passed** | ✅ `true` |
| `numberingMismatches`（编号不一致，Req 7.1） | **0** |
| `brokenRefs`（跨节引用断链，Req 7.2/7.3） | **0** |
| `readmeBrokenLinks`（README 目录断链，Req 7.4） | **0** |
| `termViolations`（术语漂移 / 禁用短语，Req 5.5/7.6/7.7） | **0** |
| `residualV1Refs`（残留 V1 / 根图引用，Req 7.7） | **0** |
| `structureFindings`（结构缺段 / 人物设定冲突，Req 5.2/7.5） | **0** |

**结论**：六大类别均为 0 发现，`passed=true`。任务 14.2 已对 `scanResidualV1Refs` 施加 scope-awareness 修复——此前的 18 条 `residualV1Refs` 是 `extras/`（嵌套作用域）的 `../images/...` 误报，现已被正确豁免。详见下文「残留 V1 引用」分析与「重要说明」。

---

## 1. 编号不一致（numberingMismatches）

**0 条发现。** 所有读者向章节的首个标题节号与文件名节号映射一致。

## 2. 跨节引用断链（brokenRefs）

**0 条发现。** 所有章节内 `.md` 跨节链接均能解析到真实 Chapter 文件。

## 3. README 目录断链（readmeBrokenLinks）

**0 条发现。** README 目录中的章节链接均能解析到真实 Chapter 文件。

## 4. 术语 / 禁用短语（termViolations）

**0 条发现。** 未检出术语反例用法或版本对比禁用短语。

## 5. 残留 V1 引用（residualV1Refs）—— 0 条（scope-aware 修复后）

**0 条发现。** 任务 14.2 修复前，此处曾报告 18 条 `../images/extra-N-*.png` 形态的发现，全部集中在 3 个 `extras/`（嵌套作用域）加餐文件中（`01-admin-cms.md` 6 条、`02-postmortems.md` 7 条、`03-model-migration.md` 5 条）。

这 18 条全部是误报：`extras/` 下文件位于 `course/extras/`，其 `../images/...` 会正确解析回 `course/images/`，符合 `style-guide.md` §5.5。任务 14.2 已使 `scanResidualV1Refs` 变为 scope-aware（复用 `classifyImagePath`），嵌套作用域的 `../images/...` 不再被误判，发现数降为 0。详见下文「重要说明」。

## 6. 结构缺段 / 人物设定（structureFindings）

**0 条发现。** 主线节均含「面试题」段与节末导航行，且无不可读章节。

---

## 重要说明：此前 18 条 `residualV1Refs` 误报已由 scope-aware 修复消除（任务 14.2）

### 为何这些引用是**正确**的

按 `style-guide.md` §5.5 的图片路径约定：

- **顶层章节**（`course/` 直接子文件，如 `12-tool-calling.md`）引用图片必须用 `images/...`；此时 `../images/...` 是逃逸到 `course/` 之外的坏引用。
- **嵌套章节**（nested scope，如 `course/extras/` 下的文件）引用图片必须用 `../images/...`，因为这才能正确从 `course/extras/` 回退一级解析到 `course/images/`。

`extras/` 下的文件位于 `course/extras/`，其图片实际存放于 `course/images/`。因此 `../images/extra-N-*.png` 会被浏览器/渲染器解析为 `course/images/extra-N-*.png` —— 路径**完全正确**，图片真实存在并能正常显示。

### 误报的根因与修复

修复前，`audit-consistency.ts` 的 `scanResidualV1Refs()` 使用正则

```
/\.\.\/images\/[^\s)\]"'`]*/g
```

无条件匹配**任意** `../images/...` 形态，**不区分**该引用所在文件是顶层还是嵌套作用域（not scope-aware）。于是它把嵌套作用域下本应合规的 `../images/...` 也一律标记为「残留根图引用」，对这 3 个 `extras/` 文件共产生 18 条误报。

**任务 14.2 的修复**：让 `scanResidualV1Refs` 复用 `lib/image-paths.ts` 中已有的 scope 感知原语 `classifyImagePath(rawPath, scope)`。根据文件的 course-相对路径推断作用域（无 `/` 为 `top`，位于子目录如 `extras/` 为 `nested`），对每个 `../images/...` 命中仅当 `classifyImagePath(...) === "escaping"`（即逃出 `course/`）时才记为 `residual-v1-ref`。这样：

- 顶层章节的 `../images/...`（真实 V1 残留逃逸）→ 仍被标记；
- 嵌套作用域（`extras/`）的 `../images/...`（解析回 `course/images/`）→ 不再标记。

函数第 2 部分（指向 V1 章节 `.md` 文件名的链接检测）保持不变。

### 处置

- **本次（14.2）**：根因修复完成。`scanResidualV1Refs` 现为 scope-aware，18 条误报全部消除，`residualV1Refs` 降为 0，整份报告 `passed=true`。`extras/` 中的图片引用无需任何修改。
- 全量测试（`npx vitest run`）83 项全过，`npx tsc --noEmit` 无错误；真实 `course/` 目录重跑 `auditConsistency` 六大类别均为 0、`passed=true`。

> 简言之：此前 `passed=false` 是**校验器缺陷**所致，而非课程内容缺陷；修复校验器后六大类别均 0 发现，`passed=true`。
