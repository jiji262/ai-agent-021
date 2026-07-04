# 配图重生成清单（Image Regen Log）

> 课程评审记录。**状态：A–E 组共 31 张含错配图已于 2026-06-10 全部重生成并逐张人工校验**——用 `baoyu-image-gen`（Google Gemini `gemini-3-pro-image-preview`），多数以原图为 `--ref` 做局部修正，结构性错误（事故矩阵、框架矩阵等）按章节真实内容重绘。图片审计 `audit-images` 仍 `passed`。下表保留为"改了什么"的存档。
> **唯一遗留（可选，非文字错误）**：F 组——重复小结图（`04-three-tools-matrix.png` 同时作 ch12/ch14 小结、`05-rule-pipeline.png` 同时作 ch15/ch16 小结）尚未拆成各章专属图，属设计偏好。

---

## A. 因本轮正文修正而新产生的图文不一致（最高优先，必须重生成）

正文已从「10 张表」改为「11 张表」，但下列图仍显示 10：

| 图片 | 当前错误 | 目标 |
|---|---|---|
| `05-four-layer-arch.png` | 持久层「Drizzle + Neon + 10 张表」 | 11 张表 |
| `05-summary.png` | 持久层「10 张表」 | 11 张表 |
| `06-summary.png` | 「SSP 10 张表」+ 列表漏 `policy_pack_versions` | 11 张表 + 补 `policy_pack_versions` |
| `07-tables-overview.png` | 标题「10 张表」（但图里已画 11 个图标） | 标题改 11 张表 |

> 注：这 4 张图对应的 `.md` 内 `<!-- 图片说明 -->` 注释里的「10 张表」我已同步改成「11 张表」，所以直接按注释重生成即可。

---

## B. 模型名 / 价格陈旧（与本章正文已用的新模型名矛盾）

正文用 `gpt-5.4-mini` / `gpt-5.4-nano` / `Opus 4.8`，但下列图仍是旧代名/旧价：

| 图片 | 当前错误 | 目标（与正文对齐） |
|---|---|---|
| `22-five-tier-routing.png` | `gpt-5-nano $0.05` / `gpt-5-mini $0.25` / `Opus 4.7 $5` | `gpt-5.4-nano $0.20` / `gpt-5.4-mini $0.75` / `Opus 4.8 $5`（Sonnet 4.6 $3 不变） |
| `extra-3-price-tiers.png` | 标题「2026 Q1」+ `gpt-5-mini/nano` + `Opus 4.7` + 多余 DeepSeek V4 | 改「2026 年中」+ `gpt-5.4-*` + `Opus 4.8`，删多余项 |
| `extra-3-summary.png` | 决策树 `Opus 4.7` / `gpt-5-mini` | `Opus 4.8` / `gpt-5.4-mini` |
| `extra-3-hero.png` | `GPT-5` / `Opus 4.7` | `GPT-5.5` / `Opus 4.8` |
| `05-model-decision-tree.png` | `gpt-5-nano` / `gpt-5-mini` / `Opus 4.7` / 裸 `GPT-5` | `gpt-5.4-nano` / `gpt-5.4-mini` / `Opus 4.8` / `gpt-5.4` |
| `05-ssp-tech-stack.png` | 「2026 推荐 gpt-5-mini」 | `gpt-5.4-mini` |
| `06-tech-summary.png` | 「2026 新推荐 gpt-5-mini」 | `gpt-5.4-mini` |
| `07-summary.png` | 「2026 新推荐 gpt-5-mini」 | `gpt-5.4-mini` |

---

## C. API 术语 / 数值错误

| 图片 | 当前错误 | 目标 |
|---|---|---|
| `04-safety-boundary.png` | 标题「maxSteps 安全边界」+「maxSteps = 5」+「stepCountIs(5)」（且危险区画了 6/7/8 步，自相矛盾） | `stopWhen 安全边界` + `stopWhen: stepCountIs(8)` + 「= 8 安全阀」 |
| `09-dual-track.png` | C 端「匿名，180 天滚动续期」 | 30 天（与源码 `SESSION_COOKIE_MAX_AGE = 30天` 一致） |

---

## D. AI 捏造 / 乱码内容（与正文不符）

| 图片 | 当前错误 | 目标 |
|---|---|---|
| `extra-2-summary.png` | 画了 6 个通用运维事故（DB超时/API限流…，事故5/6 重复「依赖故障」） | 改成本章真实 5 则（stopWhen=1 / Zod strict / context 黑洞 / prompt 注入 / 模型迁移回归） |
| `extra-2-summary-matrix.png` | 5 行是通用基础设施事故 | 改成本章真实 5 则的「现象/直觉错/真根因/修复」 |
| `extra-3-migration-costs.png` | 乱码面板「4. Frk data」+ 重复编号 4（两个「4.」） | 5 个面板 1-5：Provider/Prompt/Tool Schema/缓存/Tokenizer |
| `05-execution-layer-zoom.png` | 规则列表是捏造 ID（R-435/R-442/R-899，R-025 重复 3 次）+ 「权限检查/业务逻辑A」 | 用真实 24 条规则 ID（R-010…R-900） |
| `06-working-memory.png` | SYSTEM_PROMPT 分节列表重复（身份×2、目标×2）+「文章/模式」乱入 | 真实 11 节名 |
| `03-eleven-sections.png` | 12 张便利贴标「11 节」，「注意事项」重复 | 11 张（参照正确的 `10-system-prompt-hero.png`） |
| `23-framework-matrix.png` | 11 个框架全标同一假版本 `v0.121.8`；且为 4 象限散点，与正文「7 行 license/judge/CI 矩阵」不符 | 去掉假版本号；重画成正文描述的 7 行许可证矩阵（仅 Braintrust 闭源） |
| `28-a2a-vs-mcp.png` | 4 个 Agent 节点且两个叫「Agent A」；MCP 传输标「stdio / SSE」 | 3 个节点 A/B/C；MCP 传输改「stdio / Streamable HTTP」 |
| `24-pass-threshold.png` | 底部孤立行「deterministic ≥ 100%」（不可能）+ 确定性/Tool 准确率标签错位 | 删除孤立行；主矩阵正确无需动 |
| `faq-topics.png` | 前端「3 题 = 6.09%」（应 9.09%）；中心「33 题」但切片求和 36 | 前端改 9.09%；中心数与切片求和对齐 |
| `extra-1-params-layers.png` | 两行举例乱码（「越和」+ 方框字形） | 重画干净示例（如「缴费基数下限 → 参数 ID」）；结构数字 24/26+3 已对 |
| `24-hero.png` | 信封状态标签乱码「暂急」「不散的」「门禁集户」 | 改为可读标签（如 警告/拒绝/门禁）；CI 阈值已对 |
| `extra-3-six-steps.png` | Step-4 缩略图小字乱码 | 重画 Step-4 缩略图小字（步骤标题/工期已对） |
| `23-hero.png` | 底层英文「Unit（Unit）」重复 | 去重 |

---

## E. 低优（可选）

| 图片 | 问题 |
|---|---|
| `25-mcp-summary.png` / `26-summary.png` | 编造精确 SDK 版本 `1.29.0`（正文只说「1.x」）→ 改「1.x」或核实真实版本 |
| `26-inspector.png` | updateProfile 结果显示 `{retireAge:63}`（真值返回 `{updated, profile}`） |
| `21-security-checklist.png` | 「temperature < 0.3」（源码用 = 0.3）；作为阈值表述可接受 |

---

## F. 重复小结图（图片复用，非乱码，建议各出一张）

| 图片 | 问题 |
|---|---|
| `04-three-tools-matrix.png` | 同时作 ch12 与 ch14 小结卡，且背 4 种不同 caption；建议各出一张专属小结图 |
| `05-rule-pipeline.png` | 同时作 ch15 与 ch16 小结卡；建议各出一张 |

---

## 重生成后必做

重生成完，重跑图片审计确认 0 断链/0 孤立：

```bash
cd course/scripts && npx tsx audit-images.ts ..
```
