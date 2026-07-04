# 图片审计报告（image-audit-report）

> 由 `scripts/audit-images.ts` 的 `auditImages()` 对真实文件系统执行生成。
> 本报告仅做记录与 punch-list 用途（任务 13.1），不修改章节、不生成图片
> （改路径属任务 13.2，生成图片属任务 13.3）。

- 审计目录：`/Users/crimson/codes/0.myprojects/shebao/ai-agent-021/course`
- 审计范围：顶层 `*.md` + `extras/*.md`，比对 `course/images/` 真实文件集合
- 结论：❌ **未通过（passed = false）**

## 概要（counts）

| 维度 | 数量 |
| --- | --- |
| 缺失图片 missing-image | 8 |
| 路径不规范引用 bad-image-path | 3 |
| 孤立图片 orphans | 8 |
| 密度不达标主线节 density-violation | 11 |
| 不可读章节 unreadable-chapter | 0 |

> 门禁语义：findings / orphans / densityViolations 任一非空即 `passed = false`。

## 缺失图片（8）

引用存在但 `course/images/` 下无对应文件（referenced but not on disk）。

| 章节 chapter | 解析路径 resolvedPath | 原始引用 rawPath |
| --- | --- | --- |
| `29-deploy-and-beyond.md` | `images/29-cicd-pipeline.png` | `images/29-cicd-pipeline.png` |
| `extras/02-postmortems.md` | `images/extra-2-prompt-injection.png` | `../images/extra-2-prompt-injection.png` |
| `image-migration-report.md` | `images/X` | `images/X` |
| `style-guide.md` | `images/NN-hero.png` | `images/NN-hero.png` |
| `style-guide.md` | `images/NN-concept.png` | `images/NN-concept.png` |
| `style-guide.md` | `images/NN-summary.png` | `images/NN-summary.png` |
| `style-guide.md` | `images/NN-name.png` | `images/NN-name.png` |
| `style-guide.md` | `images/05-four-layer.png` | `images/05-four-layer.png` |

注：`style-guide.md`（`NN-*`、`05-four-layer`）与 `image-migration-report.md`
（`images/X`）中的引用是**文档示例/占位模板**，并非真实内容图片。任务 13.3 不应为其
生成图片；它们应在任务 13.2 处理（例如放入代码块以免被审计器当作真实引用）。真正需要
生成图片的只有 `29-deploy-and-beyond.md` 与 `extras/02-postmortems.md` 两条。

## 路径不规范引用（3）

`bad-path`：顶层章节使用了逃逸 `course/images/` 的 `../images/...`，应改为相对
`course/` 的 `images/...`（任务 13.2 处理）。

| 章节 chapter | 原始引用 rawPath |
| --- | --- |
| `image-migration-report.md` | `../images/X` |
| `style-guide.md` | `../images/02-hero.png` |
| `style-guide.md` | `../images/extra-1-hero.png` |

注：三条均出现在文档/规范文件中，属示例文本而非真实章节配图。

## 孤立图片（8）

磁盘存在但无任何章节引用（on disk but unreferenced）。需排查是否为改名/重编号遗留，
或应被某章节引用却漏引。

| 磁盘路径 filePath |
| --- |
| `images/09-prompt-injection.png` |
| `images/23-framework-matrix.png` |
| `images/25-deploy-decision.png` |
| `images/25-hero.png` |
| `images/25-inspector.png` |
| `images/25-project-structure.png` |
| `images/25-summary.png` |
| `images/25-three-clients.png` |

注：`images/25-*` 共 6 张集中孤立，疑似 `25-mcp-protocol.md` / `26-mcp-in-practice.md`
的引用路径与磁盘文件名不一致或章节重编号所致，建议核对这两章的引用。

## 密度不达标主线节（11）

主线节（02–29）门禁要求：本地图片引用 ≥ 5，且含 ≥1 hero 封面、≥1 小结卡片。

| 章节 chapter | 不达标详情 |
| --- | --- |
| `03-agent-evolution.md` | 图片引用数 3 < 5 |
| `10-system-prompt.md` | 图片引用数 4 < 5；缺少 hero 封面图引用 |
| `11-dynamic-context.md` | 图片引用数 4 < 5；缺少 hero 封面图引用 |
| `12-tool-calling.md` | 缺少 hero 封面图引用 |
| `13-zod-schema.md` | 缺少 hero 封面图引用 |
| `14-tool-orchestration.md` | 缺少 hero 封面图引用 |
| `15-rule-engine-dsl.md` | 缺少 hero 封面图引用 |
| `16-jsonlogic-execution.md` | 缺少 hero 封面图引用 |
| `17-frontend-integration.md` | 缺少 hero 封面图引用 |
| `18-streaming-ui.md` | 缺少 hero 封面图引用 |
| `19-agent-memory.md` | 缺少 hero 封面图引用 |

---

## 任务 13.3 punch-list（按章节归并）

下表汇总「需生成 / 补足图片」的真实章节清单，供任务 13.3 直接使用。文档示例与占位模板
（`style-guide.md`、`image-migration-report.md`）已从生成清单中剔除，仅留待 13.2 修复路径。

| 章节 | 缺失图片 | 密度问题 | 需补图片（建议） |
| --- | --- | --- | --- |
| `03-agent-evolution.md` | — | 引用数 3 < 5 | 补 ≥2 张配图（达到 ≥5；确认含 hero + summary） |
| `10-system-prompt.md` | — | 引用数 4 < 5；缺 hero | 补 1 张 hero 封面 + 1 张配图 |
| `11-dynamic-context.md` | — | 引用数 4 < 5；缺 hero | 补 1 张 hero 封面 + 1 张配图 |
| `12-tool-calling.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `13-zod-schema.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `14-tool-orchestration.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `15-rule-engine-dsl.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `16-jsonlogic-execution.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `17-frontend-integration.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `18-streaming-ui.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `19-agent-memory.md` | — | 缺 hero | 补 1 张 hero 封面 |
| `29-deploy-and-beyond.md` | `images/29-cicd-pipeline.png` | — | 生成 `29-cicd-pipeline.png` |
| `extras/02-postmortems.md` | `images/extra-2-prompt-injection.png` | — | 生成 `extra-2-prompt-injection.png` |

### 旁路 / 需人工核对项

- **孤立图 `images/25-*`（6 张）**：核对 `25-mcp-protocol.md` / `26-mcp-in-practice.md`
  是否漏引或引用路径与文件名不符；若确属可用资产，应在对应章节补引而非删除。
- **孤立图 `images/09-prompt-injection.png`**：核对 `09-auth-and-session.md` 或安全相关章节
  （如 `21-security-guardrails.md`）是否应引用。
- **孤立图 `images/23-framework-matrix.png`**：核对 `23-evaluation.md` 是否漏引。
- **路径修复（任务 13.2）**：`style-guide.md`、`image-migration-report.md` 中的
  `../images/...` 与 `NN-*` / `images/X` 示例引用应包裹进代码块或转义，避免被审计器当作真实引用。
