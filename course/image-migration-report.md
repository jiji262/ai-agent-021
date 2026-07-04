# 图片资源迁移报告（Image_Asset_Migration）

> 任务 8.2 · 对齐 Requirements 1.6 · 删除 V1（任务 8.3）的硬前置
>
> 目的：在删除根目录 `ai-agent-021/images/`（V1 时期图片目录）之前，把 V2 顶层章节仍通过
> `../images/...` 逃逸引用的根图迁入规范位置 `course/images/`，并把引用改写为相对 `course/`
> 的 `images/...`，确保删除根目录后顶层章节零坏图。

## 一、迁移结论摘要

| 指标 | 数量 |
|---|---|
| 受影响顶层章节文件 | 9 |
| 顶层 `../images/` 引用总处数（已改写） | 55 |
| 被引用的唯一根图 | 35 |
| **迁移（复制进 `course/images/`）** | **35** |
| **复用（同名同内容，仅改引用）** | **0** |
| **重命名（同名不同内容 → `legacy-<原名>`）** | **0** |
| **待补缺图（引用了但根目录也不存在）** | **0** |
| 顶层 escaping（`bad-image-path`）残留（真实章节） | **0（已清零）** |

迁移前 `course/images/` 文件数 137，迁移后 172（+35）。根目录 `images/` 保留原图不动（由任务 8.3 删除）。

## 二、处理范围与边界

- **只处理 `course/` 顶层章节**（`course/*.md`）的 `../images/...` 逃逸引用：它们从 `course/` 逃逸到根目录 `ai-agent-021/images/`，删除 V1 后会坏图。
- **`course/extras/` 子目录章节的 `../images/...` 保持不动**：它们从 `course/extras/` 正确解析回 `course/images/`，是规范写法（共 18 处，未触碰）。
- **`course/style-guide.md` 中的 `../images/...` 保持不动**：那是讲解图片路径规范时的 ❌ 反例 / ✅ 示例文本（行内代码），属于规范本身的示范，不是真实图片引用，按任务约束保留。

## 三、被迁移的 35 张根图（复制进 `course/images/`）

全部为「根目录存在、`course/images/` 原本不存在」→ 直接复制（`cp`，保留根目录原图），无命名冲突。

| # | 文件名 | 来源 | 目标 | 处理 |
|---|---|---|---|---|
| 1 | `00-complexity-dimensions.png` | `images/` | `course/images/` | copy |
| 2 | `00-delayed-retirement-shock.png` | `images/` | `course/images/` | copy |
| 3 | `00-design-principle.png` | `images/` | `course/images/` | copy |
| 4 | `00-llm-vs-agent.png` | `images/` | `course/images/` | copy |
| 5 | `04-common-pitfalls.png` | `images/` | `course/images/` | copy |
| 6 | `04-orchestration-patterns.png` | `images/` | `course/images/` | copy |
| 7 | `04-safety-boundary.png` | `images/` | `course/images/` | copy |
| 8 | `04-three-tools-matrix.png` | `images/` | `course/images/` | copy |
| 9 | `04-tool-calling-sequence.png` | `images/` | `course/images/` | copy |
| 10 | `04-zod-schema-flow.png` | `images/` | `course/images/` | copy |
| 11 | `05-ctx-data-flow.png` | `images/` | `course/images/` | copy |
| 12 | `05-evidence-chain.png` | `images/` | `course/images/` | copy |
| 13 | `05-final-gate.png` | `images/` | `course/images/` | copy |
| 14 | `05-module-dependencies.png` | `images/` | `course/images/` | copy |
| 15 | `05-rule-anatomy.png` | `images/` | `course/images/` | copy |
| 16 | `05-rule-orchestration.png` | `images/` | `course/images/` | copy |
| 17 | `05-rule-pipeline.png` | `images/` | `course/images/` | copy |
| 18 | `05-rule-versioning.png` | `images/` | `course/images/` | copy |
| 19 | `05-trace-debugging.png` | `images/` | `course/images/` | copy |
| 20 | `06-long-term-persistence.png` | `images/` | `course/images/` | copy |
| 21 | `06-memory-collaboration.png` | `images/` | `course/images/` | copy |
| 22 | `06-memory-taxonomy.png` | `images/` | `course/images/` | copy |
| 23 | `06-message-pipeline.png` | `images/` | `course/images/` | copy |
| 24 | `06-profile-accumulation.png` | `images/` | `course/images/` | copy |
| 25 | `06-working-memory.png` | `images/` | `course/images/` | copy |
| 26 | `07-component-hierarchy.png` | `images/` | `course/images/` | copy |
| 27 | `07-conversation-flow.png` | `images/` | `course/images/` | copy |
| 28 | `07-frontend-architecture.png` | `images/` | `course/images/` | copy |
| 29 | `07-message-parts.png` | `images/` | `course/images/` | copy |
| 30 | `07-quick-action-buttons.png` | `images/` | `course/images/` | copy |
| 31 | `07-tool-states.png` | `images/` | `course/images/` | copy |
| 32 | `07-usechat-dataflow.png` | `images/` | `course/images/` | copy |
| 33 | `07-xss-protection.png` | `images/` | `course/images/` | copy |
| 34 | `screenshot-chat.png` | `images/` | `course/images/` | copy |
| 35 | `screenshot-home.png` | `images/` | `course/images/` | copy |

## 四、复用 / 重命名清单

- **复用（reuse-existing）**：无。被引用根图在 `course/images/` 中均无同名文件。
- **重命名（legacy-<原名>）**：无。无「同名不同内容」冲突。

## 五、引用改写明细（`../images/X` → `images/X`）

仅改写标准 Markdown 图片语法 `!\[alt\](../images/X)` → `!\[alt\](images/X)`，逐文件处数：

| 章节文件 | 改写处数 |
|---|---|
| `01-introduction.md` | 6 |
| `12-tool-calling.md` | 5 |
| `13-zod-schema.md` | 5 |
| `14-tool-orchestration.md` | 6 |
| `15-rule-engine-dsl.md` | 8 |
| `16-jsonlogic-execution.md` | 8 |
| `17-frontend-integration.md` | 5 |
| `18-streaming-ui.md` | 5 |
| `19-agent-memory.md` | 7 |
| **合计** | **55** |

改写后这 9 个文件已无任何 `../images/` 残留。

## 六、待补缺图清单（交由任务 13.3 补齐）

**本次迁移待补缺图：0 张。**

任务说明中预估「某些 `04-*.png/05-*.png/06-*.png/07-*.png` 可能不存在」，经扫描比对，所有 35 张被顶层章节引用的根图在 `ai-agent-021/images/` 中**均真实存在**，已全部成功迁移。因此不存在「引用了但根目录也不存在」的坏引用，本任务无需登记待补缺图、也无需改写指向不存在图的引用。

> 备注：图片审计脚本（`audit-images.ts`）另报告 `style-guide.md` 中若干 `images/NN-*.png`、
> `../images/02-hero.png` 等为「缺失/不规范」，这些是风格指南**讲解用的模板占位与 ❌/✅ 示例**
> （行内代码文本），非真实图片引用，按任务约束保留不动，不属于待补图范畴。
>
> 此外，多个主线节存在「图片密度不达标 / 缺 hero 封面」的 density-violation，那属于配图阶段
> （任务 13.3）与重写阶段（阶段 4）的范围，不在本图片迁移任务的处置范围内。

## 七、验证

- 9 个顶层章节 `../images/` 残留：**0**。
- `course/images/` 新增文件：**35**（137 → 172）。
- `course/extras/` 的 `../images/` 引用：18 处，**未触碰**（正确写法，解析回 `course/images/`）。
- `course/style-guide.md` 的示范性 `../images/` 文本：**未触碰**（规范示例）。
- `audit-images.ts` 复跑：真实顶层章节零 `bad-image-path`（escaping）。仅 `style-guide.md` 的示范文本与各节 density-violation（属任务 13.3）仍在报告中，符合预期。
- 根目录 `ai-agent-021/images/` 原图保留不动，待任务 8.3 统一删除。
