# 配图生成记录（Phase 4）

> 自动生成时间：2026-04-26
> 后端：`baoyu-image-gen` (Google Gemini `gemini-3-pro-image-preview`)

## 本轮新生成

- **总数**：79 张（78 张原计划 + 1 张漏扫的 `21-four-layers.png`）
- **失败**：0 张（所有图均一次或重试一次成功）
- **风格分布**：
  - 信息图（infographic / 扁平专业）：43+
  - 章封面（hand-drawn / 温暖封面）：14
  - 章末小结卡片：10
  - 概念示意（手绘）：12

## 提示词来源

每张图的提示词来自所在 `.md` 文件中紧跟图片引用的 HTML 注释（`<!-- 图片说明（给图片代理）：... -->`），由作者按 `course/style-guide.md §9` 撰写。生成脚本套了一段统一的风格前言 + 中文标注约束。

## 分辨率与格式

- 默认 16:9（封面/信息图）/ 4:3（部分插图）
- 输出 1376×768 像素，JPEG 编码，扩展名 `.png`（baoyu-image-gen 行为）
- 单图大小约 330 KB – 1.5 MB

## 命名调整

`v2 commit 896801b` 部分章节保留了旧的图片前缀命名，与章号不一致：

| 引用名 | 所在章 | 说明 |
|---|---|---|
| `images/05-four-principles.png` | 06 章 | 沿用 v1 的 05- 前缀 |
| `images/05-model-decision-tree.png` | 06 章 | 同上 |
| `images/05-ssp-tech-stack.png` | 06 章 | 同上 |
| `images/24-before-after.png` | 25 章 | 沿用 v1 的 24- 前缀 |
| `images/24-three-primitives.png` | 25 章 | 同上 |
| `images/24-transports.png` | 25 章 | 同上 |

生成时按 markdown 实际引用的文件名落盘。

## 已知缺口（不在本轮范围）

`course/extras/*.md` 中 17 张图引用形如 `../images/extra-*.png`（指向 v1 的根级 `images/`），这些图当前在 `/Users/crimson/codes/0.myprojects/shebao/ai-agent-021/images/` 里**不存在**。

涉及文件：

- `extras/01-admin-cms.md`：`extra-1-hero / -policy-as-code-loop / -admin-mapping / -params-layers / -publish-pipeline / -summary`（6 张）
- `extras/02-postmortems.md`：`extra-2-hero / -postmortem-skeleton / -stopwhen / -context-blackhole / -summary-matrix / -summary`（6 张）
- `extras/03-model-migration.md`：`extra-3-hero / -migration-costs / -price-tiers / -six-steps / -summary`（5 张）

按用户指令本轮跳过 `../images/` 路径。如需补全，可后续单独跑一轮，目标路径 `images/extra-*.png` + 调整 extras `.md` 引用为 `images/`。

## 复跑方式

```bash
# 单张
/tmp/gen_one.sh "<name>" "16:9" "/tmp/image_prompts/<name>.txt" \
  "course/images/<name>.png"

# 批量并行
/tmp/run_batch.sh /tmp/wt_worklist.tsv 6
```

工作目录中间件已清理，需复跑请重建（`/tmp/build_inventory.py` + `/tmp/build_prompts.py`）。

---

## 一致性修复（Phase 4.1）

第二轮一致性审查发现并修复：

| 问题 | 修复 |
|---|---|
| `images/05-four-layer.png` 是孤立文件（仅 `style-guide.md` 模板示例引用，无章节使用） | 删除 |
| ch5 + ch6 共用 `05-hero.png` / `05-summary.png`（不同主题） | ch6 改用 `06-tech-hero.png` / `06-tech-summary.png` + 新生成 |
| ch11 同一张 `03-context-injection.png` 既当 hero 又当 summary（两段 HTML 注释要求的内容完全不同） | summary 改用 `11-dynamic-summary.png` + 新生成 |
| ch10 + ch11 共用 `03-prompt-layers.png`（ch10 想"11 段对比"，ch11 想"三层同心圆"） | ch11 改用 `11-three-prompts.png` + 新生成 |
| ch24 + ch25 共用 `24-hero.png` / `24-summary.png`（CI 门禁 vs MCP USB-C） | ch25 改用 `25-mcp-hero.png` / `25-mcp-summary.png` + 新生成 |

新生成 6 张图：`06-tech-hero`、`06-tech-summary`、`11-dynamic-summary`、`11-three-prompts`、`25-mcp-hero`、`25-mcp-summary`。

最终一致性指标（`/tmp/audit.py`）：

- 断链 `images/` 引用：**0**
- 孤立图片文件：**0**
- 同名跨章不同内容：**0**

> 仅剩的"命名差异"（41 处）是 v2 沿用 v1 主题编号（topic-prefix）的有意约定——多个 v2 章节复用同一组 v1 主题图（如 ch10+ch11 共享 prompt 主题图，ch12-14 共享 tool-calling 主题图）。这是设计选择，不是 bug。

---

## 加餐图补完（Phase 4.2）

补齐 `course/extras/01-03-*.md` 引用的 17 张 + 1 张 v1 图：

| 类别 | 数量 | 名称 |
|---|---|---|
| 加餐 1（admin 后台）| 6 | extra-1-hero / -policy-as-code-loop / -admin-mapping / -params-layers / -publish-pipeline / -summary |
| 加餐 2（事故复盘）| 6 | extra-2-hero / -postmortem-skeleton / -stopwhen / -context-blackhole / -summary-matrix / -summary |
| 加餐 3（模型迁移）| 5 | extra-3-hero / -migration-costs / -price-tiers / -six-steps / -summary |
| v1 复用 | 1 | 09-prompt-injection（从 worktree 根 `images/` 复制） |

**路径辨析**：`course/extras/*.md` 的 `../images/` 从 `course/extras/` 上一层 = `course/images/`（**不是** worktree 根 `images/`）。这与 `course/*.md` 的 `../images/`（解析到 worktree 根 `images/`）不同。补图全部落在 `course/images/`。

最终：

- 课程总图（`course/images/`）：**136 张**（118 v2 新生成/复用 + 17 加餐 + 1 v1 复用）
- v1 图（worktree 根 `images/`）：**137 张**（未变动）
- 跨所有 `.md` 的图片引用（共 **191 处**）：**全部解析成功，0 断链**
