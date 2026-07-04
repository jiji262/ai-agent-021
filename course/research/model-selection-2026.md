# 研究报告 · 模型选型 2026（价格 / 能力 / Agent SDK）

> **用途**：本报告是第 21 节《成本控制》（文件 `22-cost-control.md`）与加餐《模型迁移》（文件 `extras/03-model-migration.md`）重写时的技术追溯源。所有"模型价格、上下文窗口、能力、SDK 版本"类技术声明都应能回链到本报告的对应条目（对齐 Requirements 2.3 / 2.4）。
>
> **价格获取日期**：**价格截至 2026-05-30，均以各厂商官方定价页为准**。模型价格随时变动，写作引用时务必复核官方页并更新本报告。OpenAI / Anthropic 价格直接抓取自官方文档定价页；Google Gemini 价格抓取自官方页（页脚标注"最后更新 2026-05-28"）。
>
> **币种**：全文价格单位为 **美元（USD）/ 每百万 token（per 1M tokens，MTok）**，除非另行标注（如"每千次搜索""每张图片"）。
>
> **配套项目基线**（来自 `ssp-web/package.json` 与 `code-facts.md`）：`ssp-web` 通过 `@ai-sdk/openai` 的 `createOpenAI({ apiKey, baseURL })` 接入 OpenAI 兼容端点，模型名由环境变量 `OPENAI_MODEL` 注入（示例值 `gpt-4o-mini`），`temperature: 0.3`，`stopWhen: stepCountIs(8)`，`providerOptions.openai.store = false`。因此本报告既服务"成本控制"，也服务"从 `gpt-4o-mini` 迁到更强/更省模型"的实战追溯。
>
> **合规说明**：本报告内容均为**转述与归纳**，非原文照搬；价格等事实直接来自官方定价页并标注获取日期，未大段照抄第三方文章。涉及第三方对比文章的数字（如生态份额、基准跑分）一律标注"二手"并给出链接。Content was rephrased for compliance with licensing restrictions。

---

## 0. 一页速查（写作直接抄，价格截至 2026-05-30）

> 下表只列**当前主推 / 高性价比**的文本模型；多模态、语音、图像、视频模型见 §5。价格为**标准处理（standard）**档，单位 USD / MTok。

| 家族 | 模型 | 定位 | 输入价 | 输出价 | 缓存读取/命中价 | 上下文窗口 | 来源 |
|---|---|---|---|---|---|---|---|
| **OpenAI** | `gpt-5.5` | 旗舰（默认） | $5.00 | $30.00 | $0.50 | 1,050,000 | [OpenAI 定价](https://developers.openai.com/api/docs/pricing) |
| OpenAI | `gpt-5.4` | 高性价比旗舰 | $2.50 | $15.00 | $0.25 | ~272K+（见 §1） | OpenAI 定价 |
| OpenAI | `gpt-5.4-mini` | 高吞吐 mini | $0.75 | $4.50 | $0.075 | 同上 | OpenAI 定价 |
| OpenAI | `gpt-5.4-nano` | 最省 nano | $0.20 | $1.25 | $0.02 | 同上 | OpenAI 定价 |
| **Anthropic** | `claude-opus-4.8` | 旗舰推理 | $5.00 | $25.00 | $0.50 | 1,000,000 | [Anthropic 定价](https://docs.anthropic.com/en/docs/about-claude/pricing) |
| Anthropic | `claude-sonnet-4.6` | 主力生产 | $3.00 | $15.00 | $0.30 | 1,000,000 | Anthropic 定价 |
| Anthropic | `claude-haiku-4.5` | 高性价比 | $1.00 | $5.00 | $0.10 | 200K（以官方 model 页为准） | Anthropic 定价 |
| **Google** | `gemini-3.1-pro-preview` | 旗舰多模态 | $2.00（≤200K）/ $4.00（>200K） | $12.00 / $18.00 | $0.20 / $0.40 | ~1M | [Gemini 定价](https://ai.google.dev/gemini-api/docs/pricing) |
| Google | `gemini-3.5-flash` | 速度旗舰 | $1.50 | $9.00 | $0.15 | ~1M | Gemini 定价 |
| Google | `gemini-3.1-flash-lite` | 最省高吞吐 | $0.25 | $1.50 | $0.025 | ~1M | Gemini 定价 |
| Google | `gemini-2.5-flash` | 稳定高性价比 | $0.30 | $2.50 | $0.03 | 1,000,000 | Gemini 定价 |
| Google | `gemini-2.5-flash-lite` | 最便宜稳定版 | $0.10 | $0.40 | $0.01 | ~1M | Gemini 定价 |

> ⚠️ **价格警告（写作必带）**：以上为 2026-05-30 标准档价格，**会变**。三家都有 **Batch API（约 5 折）** 与 **Prompt Caching（缓存读取约为输入价 0.1x）** 两个主要省钱杠杆（见 §6）。长上下文（OpenAI >272K、Gemini >200K）有**加价档**，正文务必标注分档。

**三家"省钱铁律"速记**：

- **选对档位**：简单任务用 nano / Haiku / Flash-Lite，主力生产用 mini / Sonnet / Flash，复杂推理才上 旗舰（GPT-5.5 / Opus / Pro）。
- **缓存复用**：大 System Prompt、长文档、对话历史用 Prompt Caching，缓存命中价约为标准输入价的 **10%**。
- **批处理**：非实时任务走 Batch API，输入输出各省 **50%**。

---

## 1. OpenAI 模型线（截至 2026-05-30）

OpenAI 当前 API 旗舰是 **GPT-5.5**（快照 `gpt-5.5-2026-04-23`，2026-04-23 发布、官方标为 Default）。它是统一推理模型，`reasoning.effort` 支持 `none / low / medium（默认）/ high / xhigh`。来源：[GPT-5.5 model 页](https://developers.openai.com/api/docs/models/gpt-5.5)、[OpenAI 定价页](https://developers.openai.com/api/docs/pricing)。

### 1.1 文本模型价格（标准档，USD / MTok）

| 模型 | 输入 | 缓存输入 | 输出 | 备注 |
|---|---|---|---|---|
| `gpt-5.5` | $5.00 | $0.50 | $30.00 | 旗舰，默认 |
| `gpt-5.5-pro` | $30.00 | — | $180.00 | 最强推理 |
| `gpt-5.4` | $2.50 | $0.25 | $15.00 | 高性价比旗舰 |
| `gpt-5.4-mini` | $0.75 | $0.075 | $4.50 | 编码 / 计算机使用 / 子代理 |
| `gpt-5.4-nano` | $0.20 | $0.02 | $1.25 | 分类 / 标注 / 大规模简单任务 |
| `gpt-5.4-pro` | $30.00 | — | $180.00 | — |
| `gpt-5.3-codex`（Codex 专用） | $1.75 | $0.175 | $14.00 | 编码专用 |

来源：[OpenAI 定价页](https://developers.openai.com/api/docs/pricing)（标准档）。Batch / Flex / Priority 档另有费率，Batch 约 5 折。

### 1.2 GPT-5.5 能力与窗口（官方 model 页）

| 维度 | 值 |
|---|---|
| 上下文窗口 | **1,050,000** token |
| 最大输出 | 128,000 token |
| 知识截止 | 2025-12-01 |
| 模态 | 文本输入/输出 + 图像输入（视觉）；不支持音频/视频 |
| 能力 | 流式、Function Calling、Structured Outputs、Reasoning token |
| 工具（Responses API） | Web search、File search、Image generation、Code interpreter、Hosted shell、Computer use、**MCP**、Tool search 等 |
| 端点 | Chat Completions（`v1/chat/completions`）、Responses（`v1/responses`）、Realtime、Batch 等 |
| 长上下文加价 | **>272K 输入 token** 时，该会话按 **2x 输入、1.5x 输出** 计价（standard / batch / flex 均适用） |

来源：[GPT-5.5 model 页](https://developers.openai.com/api/docs/models/gpt-5.5)。

> **写作提醒**：`gpt-4o-mini`（`ssp-web` `code-facts.md` 里的示例 `OPENAI_MODEL`）属于早期 GPT-4o 系列。OpenAI 帮助中心说明：GPT-4o、GPT-4.1 等已于 2026-02-13 从 ChatGPT 产品端下线，但 **API 访问保持不变**（来源：[OpenAI 帮助中心 - 模型与限制](https://help.openai.com/en/articles/11165333-chatgpt-enterprise-and-edu-models-limits)）。课程讲迁移时，把 `gpt-4o-mini → gpt-5.4-mini / gpt-5.5` 当作典型升级路径即可（见 §7）。

---

## 2. Anthropic Claude 模型线（截至 2026-05-30）

Anthropic 当前在售 Claude 4.x 三档：**Opus**（最强推理）、**Sonnet**（主力生产）、**Haiku**（高性价比）。来源：[Anthropic 官方定价页](https://docs.anthropic.com/en/docs/about-claude/pricing)。

### 2.1 文本模型价格（标准档，USD / MTok）

| 模型 | 基础输入 | 5 分钟缓存写入 | 1 小时缓存写入 | 缓存命中/刷新 | 输出 |
|---|---|---|---|---|---|
| Claude Opus 4.8 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.7 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.6 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.5 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.1 | $15.00 | $18.75 | $30.00 | $1.50 | $75.00 |
| Claude Sonnet 4.6 | $3.00 | $3.75 | $6.00 | $0.30 | $15.00 |
| Claude Sonnet 4.5 | $3.00 | $3.75 | $6.00 | $0.30 | $15.00 |
| Claude Haiku 4.5 | $1.00 | $1.25 | $2.00 | $0.10 | $5.00 |
| Claude Haiku 3.5（已退役，仅 Bedrock/Vertex） | $0.80 | $1.00 | $1.60 | $0.08 | $4.00 |

来源：[Anthropic 定价页 - Model pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)。

> **重要价格事实**：Opus 自 **4.5 起把价格从 4.1 的 $15/$75 大幅降到 $5/$25**（同代降幅约 67%）。这是"旗舰也能变便宜"的典型例子，写"成本控制"时值得点出。

### 2.2 能力与窗口要点

- **1M token 上下文**：Opus 4.8 / 4.7 / 4.6 与 Sonnet 4.6 提供完整 100 万 token 上下文窗口，且**按标准价计费**（一次 90 万 token 请求与 9 千 token 请求单价相同）。来源：[Anthropic 定价页 - Long context pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)。
- **新分词器**：Opus 4.7 及以后改用新分词器，相同文本**可能多用约 35% token**——迁移到 Opus 4.7+ 时，token 计数（及账单）会比旧模型偏高，务必实测。来源：同上。
- **工具调用**：客户端工具按普通请求计费；服务端工具（如 Web search $10/千次）另计。开启 `tools` 会自动注入一段工具用系统 Prompt，按模型不同消耗 264~804 个额外 token。来源：[Anthropic 定价页 - Tool use pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)。
- **自适应思考**：Claude 4.6 起 `thinking: { type: "enabled", budget_tokens: N }` 标为 deprecated，迁移到 `thinking: { type: "adaptive" }` + `effort` 参数。来源：[Anthropic Claude 4 迁移指南](https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4)。

---

## 3. Google Gemini 模型线（截至 2026-05-30，官方页更新于 2026-05-28）

Google Gemini API 当前主推 **Gemini 3.x**（Pro / Flash / Flash-Lite）与稳定的 **Gemini 2.5** 线。来源：[Gemini Developer API 定价页](https://ai.google.dev/gemini-api/docs/pricing)。

### 3.1 文本模型价格（付费档，USD / MTok；免费档大多 token 免费但限速/数据用于改进产品）

| 模型 | 模型 ID | 输入 | 输出（含思考 token） | 上下文缓存（读取） | 备注 |
|---|---|---|---|---|---|
| Gemini 3.5 Flash | `gemini-3.5-flash` | $1.50 | $9.00 | $0.15 | 速度旗舰，正式版 |
| Gemini 3 Pro 预览版 | `gemini-3.1-pro-preview` | $2.00（≤200K）/ $4.00（>200K） | $12.00 / $18.00 | $0.20 / $0.40 | 多模态/智能体旗舰 |
| Gemini 3 Flash 预览版 | `gemini-3-flash-preview` | $0.50 | $3.00 | $0.05 | 上一代 Flash 预览 |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | $0.25 | $1.50 | $0.025 | 高吞吐/翻译/简单处理 |
| Gemini 2.5 Pro | `gemini-2.5-pro` | $1.25（≤200K）/ $2.50（>200K） | $10.00 / $15.00 | $0.125 / $0.25 | 稳定旗舰 |
| Gemini 2.5 Flash | `gemini-2.5-flash` | $0.30 | $2.50 | $0.03 | 混合推理，1M 窗口 |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | $0.10 | $0.40 | $0.01 | 最便宜稳定版 |

来源：[Gemini 定价页](https://ai.google.dev/gemini-api/docs/pricing)（付费档，文本/图片/视频输入；音频输入价更高，见官方页）。

### 3.2 要点

- **价格分档**：Gemini 3 Pro 与 2.5 Pro 都按 **提示 ≤200K / >200K** 两档计价，长上下文加价，正文引用务必标注分档。
- **接地（Grounding）**：用 Google 搜索接地，Gemini 3 模型每月免费 5,000 次提示，之后每千次搜索查询 $14；Gemini 2.5 为 1,500 RPD 免费、之后每千次接地提示 $35。来源：[Gemini 定价页 - 工具价格](https://ai.google.dev/gemini-api/docs/pricing)。
- **批处理**：付费档支持 Batch API（约 5 折）与上下文缓存。
- **弃用提醒**：Gemini 2.0 Flash / 2.0 Flash-Lite 已弃用，**2026-06-01 停服**；Gemini 3 Pro 初版 `gemini-3-pro-preview` 已于 2026-03-09 停服，当前 Pro 预览为 `gemini-3.1-pro-preview`。来源：[Gemini models 页](https://ai.google.dev/gemini-api/docs/models)、[Gemini 定价页](https://ai.google.dev/gemini-api/docs/pricing)。
- **最便宜可用模型**：`gemini-2.5-flash-lite`（$0.10 / $0.40）与 `gpt-5.4-nano`（$0.20 / $1.25）是当前主流家族里最省的两个文本模型，适合大规模分类/抽取/校验类子任务。

---

## 4. 性价比与场景匹配（选型决策树）

把"任务类型 → 推荐模型"固化为一棵决策树，供 21 节直接引用：

```text
1) 任务是否需要"强推理 / 多步规划 / 复杂代码"？
   ├─ 是 → 用旗舰推理档：
   │        GPT-5.5（$5/$30） / Claude Opus 4.8（$5/$25） / Gemini 3.1 Pro（$2/$12，≤200K）
   │        预算敏感但仍要强：GPT-5.4（$2.5/$15）
   └─ 否 ↓
2) 任务是否"生产主力对话 / 工具调用 / 中等复杂度"（多数 Agent 落地于此）？
   ├─ 是 → 用主力档：
   │        Claude Sonnet 4.6（$3/$15） / GPT-5.4-mini（$0.75/$4.5） / Gemini 3.5 Flash（$1.5/$9）
   └─ 否 ↓
3) 任务是否"高吞吐 / 低成本 / 简单"（分类、抽取、字段校验、改写）？
   └─ 是 → 用最省档：
            GPT-5.4-nano（$0.2/$1.25） / Claude Haiku 4.5（$1/$5） / Gemini Flash-Lite（$0.1/$0.4）
```

**两条正交维度**（写作时强调）：

- **强推理 vs 高吞吐低成本**：旗舰档单价是最省档的 **10~50 倍**。Agent 系统里"路由 + 分层"——简单子任务下沉到便宜模型、只把难步骤交给旗舰——往往能在不掉质量的前提下把账单砍掉一大截。
- **窗口 vs 价格**：长上下文（>200K / >272K）几乎都触发加价档。能用 RAG / 上下文裁剪 / Prompt Caching 把上下文压下来，就别硬塞满窗口。

> `ssp-web` 场景匹配：它的对话链路是"低温度 + 多步工具调用（`stopWhen: stepCountIs(8)`）+ 规则引擎产出结构化结果"，本质是**主力对话档**任务。从 `gpt-4o-mini` 升级时，`gpt-5.4-mini` / `claude-haiku-4.5` / `gemini-2.5-flash` 都是同价位带的合理候选；要更强的工具编排稳定性可上 `gpt-5.4` / `claude-sonnet-4.6`。

---

## 5. 多模态 / 语音 / 图像模型（按需在 21 / 加餐节引用）

| 厂商 | 模型 | 类型 | 价格要点 | 来源 |
|---|---|---|---|---|
| OpenAI | `gpt-realtime-2` | 实时语音 | 音频 $32/$64（输入/输出），文本 $4/$24 | [OpenAI 定价](https://developers.openai.com/api/docs/pricing) |
| OpenAI | `gpt-image-2` | 图像生成 | 图像 $8 输入 / $30 输出；文本 $5 输入 | OpenAI 定价 |
| OpenAI | `sora-2` / `sora-2-pro` | 视频 | $0.10 / $0.30 起（按秒、按分辨率） | OpenAI 定价 |
| Google | `gemini-3.1-flash-image`（Nano Banana） | 图像 | 输入 $0.50；图像输出 $60/MTok（约 $0.067/张 1K） | [Gemini 定价](https://ai.google.dev/gemini-api/docs/pricing) |
| Google | `veo-3.1` | 视频 | $0.40（720p/1080p）/ $0.60（4K）起 | Gemini 定价 |
| Google | `imagen-4` | 图像 | $0.02（Fast）/ $0.04（标准）/ $0.06（Ultra）每张 | Gemini 定价 |
| Google | `gemini-embedding-001` | 文本嵌入 | $0.15（输入） | Gemini 定价 |

> 注：`ssp-web` 当前不使用多模态/语音/图像/嵌入模型（其结构化结果来自规则引擎而非 LLM 直接产出）。课程引用这些一律按"示意，非项目实际代码"标注。RAG 章节（27 节）若讲嵌入，用 `gemini-embedding-001` 或 OpenAI/开源嵌入模型作对照。

---

## 6. 省钱手段（Prompt Caching / Batch / 分层 / 长上下文管理）

### 6.1 Prompt Caching（提示缓存）

把"重复出现的大块上下文"（System Prompt、长文档、对话历史）缓存复用，后续命中按**远低于标准输入价**计费。

| 厂商 | 缓存写入 | 缓存读取/命中 | 机制 | 来源 |
|---|---|---|---|---|
| Anthropic | 5 分钟 1.25x / 1 小时 2x（相对基础输入价） | **0.1x 基础输入价** | `cache_control` 字段（自动或显式断点） | [Anthropic - Prompt caching](https://docs.anthropic.com/en/docs/about-claude/pricing) |
| OpenAI | 自动 | 缓存输入价（如 GPT-5.5 $0.50 vs 输入 $5.00，约 0.1x） | 自动缓存命中 | [OpenAI 定价](https://developers.openai.com/api/docs/pricing) |
| Google | — | 上下文缓存读取价（如 2.5 Flash $0.03 vs 输入 $0.30，约 0.1x）+ 存储费 $1/MTok/小时 | 上下文缓存 | [Gemini 定价](https://ai.google.dev/gemini-api/docs/pricing) |

> Anthropic 官方算例：5 分钟缓存（写入 1.25x）**只要命中 1 次就回本**；1 小时缓存（写入 2x）命中 2 次回本。缓存折扣可与 Batch 折扣叠加。

### 6.2 Batch API（批处理）

三家都提供异步批处理，**输入输出各省约 50%**，适合非实时任务（离线评测、数据标注、批量生成案例等）。OpenAI / Anthropic / Google 均为 5 折档。来源：三家官方定价页。

> `ssp-web` 的 `scripts/generate-showcase-cases.ts`（批量生成案例）是典型可走 Batch 的离线任务——课程讲省钱时可作为"把离线任务挪到 Batch"的真实例子（注意：现有脚本用 `openai` devDep，未必启用 batch，引用时按"可优化点"而非"已实现"陈述）。

### 6.3 分层路由（model routing）

便宜模型做"分诊/抽取/校验"，旗舰只接难题。配合 Vercel AI SDK v6 的 `prepareStep`（每步动态换 `model`）或自写路由逻辑实现（`prepareStep` 在 `ssp-web` 未启用，按"示意"标注，详见 `research/ai-sdk-v6.md` §4）。

### 6.4 长上下文管理

OpenAI（>272K）、Gemini（>200K）触发加价档，Anthropic 1M 窗口虽按标准价但 Opus 4.7+ 新分词器多吃约 35% token。省钱要点：RAG 召回替代全量塞入、滚动摘要压缩历史、按需裁剪工具 schema。

---

## 7. 模型迁移实战要点（供 extras/03 追溯）

把"从 `gpt-4o-mini` 迁到 Claude / GPT-5.x / Gemini"拆成可执行清单。

### 7.1 迁移 Checklist

- [ ] **接入层**：`ssp-web` 走 `@ai-sdk/openai` + `createOpenAI({ baseURL })`。迁到 OpenAI 新模型只需改 `OPENAI_MODEL`；迁到 Claude 换 `@ai-sdk/anthropic` 的 `createAnthropic`，迁到 Gemini 换 `@ai-sdk/google`——得益于 AI SDK v6 的 provider 抽象，业务代码（`streamText` / `tool()` / `stopWhen`）基本不动。详见 `research/ai-sdk-v6.md`。
- [ ] **Prompt 兼容**：不同家族对 System Prompt 的"听话程度"和格式偏好不同。OpenAI 偏好结构化指令，Claude 偏好清晰角色+边界、对长 System Prompt 友好，Gemini 对"接地/引用"类指令响应好。迁移后**重跑评测集**（见 23/24 节）而非只做 smoke test。
- [ ] **Tool Calling 行为**：工具触发时机、并行工具调用、参数严格度在各家有差异。`ssp-web` 依赖多步工具循环（`stepCountIs(8)`），迁移后要验证：① 工具是否被正确触发；② 多步是否在产出结论前提前停止；③ 结构化入参是否仍满足 Zod schema（必要时启用 tool call repair，见 ai-sdk-v6 §9）。
- [ ] **价格重算**：按 §0~§3 的当前单价，用真实流量（输入/输出 token 比例 + 缓存命中率）重算账单，别只看输入单价。注意 Opus 4.7+ 新分词器、长上下文加价档。
- [ ] **上下文窗口 / 输出上限**：确认目标模型窗口（GPT-5.5 105 万、Claude 4.6+/Sonnet 4.6 100 万、Gemini ~100 万）与最大输出（如 GPT-5.5 12.8 万）满足业务峰值。
- [ ] **限流（Rate Limits）**：各家按用量分级（Tier 1~5 / Enterprise）。迁移前确认目标账户 tier 的 RPM/TPM 是否扛得住生产峰值，必要时提前申请提额。来源：[OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)、[Anthropic Rate limits](https://docs.anthropic.com/en/docs/about-claude/pricing)。
- [ ] **能力差异**：视觉/音频/缓存/Responses API 内置工具支持度不同。`store: false` 这类 provider 专属选项（`ssp-web` 为兼容中转网关而设）换 provider 后要重新评估是否需要。
- [ ] **灰度策略**：见 §7.2。

### 7.2 灰度（渐进式迁移）策略

1. **影子流量（shadow）**：新模型并行跑线上请求但不返回给用户，离线比对输出质量与成本。
2. **按比例放量**：1% → 10% → 50% → 100%，每档观察评测分、延迟、错误率、单位成本。
3. **按场景切分**：先把低风险场景（如简单问答）切到便宜新模型，高风险场景（计算/工具编排）留在已验证模型。
4. **回滚开关**：模型名做成配置（`ssp-web` 已是 `OPENAI_MODEL` 环境变量），异常一键回滚。
5. **回归门禁**：用 23/24 节的评测集做迁移前后对比，跑分不回退才放量。

> 业界提醒（二手）：把换模型当"改个模型名字符串"是常见踩坑——实际需要重测 Prompt、工具行为与成本。参考 [生产环境 LLM 迁移 playbook](https://tianpan.co/blog/2026-04-20-llm-model-migration-production-playbook)（二手，观点参考）。

---

## 8. Agent SDK 现状（Claude Agent SDK / OpenAI Agents SDK / 与 Vercel AI SDK 的关系）

三套 SDK 定位不同，**不是互斥竞品**，选型取决于"你要 provider 中立的工具箱，还是某家的开箱即用 Agent 运行时"。

### 8.1 Anthropic Claude Agent SDK

- **改名事实**：由 **Claude Code SDK 更名**而来（社区记录改名时间约 2025-09-29），文档迁出 Claude Code 区、独立成 Agent SDK 指南。来源：[Anthropic - Migrate to Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/migration-guide)、[Agent SDK overview](https://docs.claude.com/en/api/agent-sdk/overview)。
- **定位**：把"驱动 Claude Code 的同一套 Agent 循环 + 内置工具 + 上下文管理"做成库，Python / TypeScript 双语言。内置工具含 `Read / Write / Edit / Bash / Glob / Grep / WebSearch / WebFetch / AskUserQuestion` 等，开箱即可执行工具，无需自己实现工具循环。
- **包名**：npm `@anthropic-ai/claude-agent-sdk`，PyPI `claude-agent-sdk`。TS SDK 会附带平台原生 Claude Code 二进制作为可选依赖。
- **能力**：支持 MCP、子代理（subagents）、hooks、skills、权限、会话；可加载 `.claude/` 下的文件式配置。
- **认证 / 计费**：`ANTHROPIC_API_KEY`，或 Bedrock / Vertex / Azure。注意：**自 2026-06-15 起**，订阅计划下的 Agent SDK 与 `claude -p` 用量将从独立的月度 Agent SDK 额度扣减。来源：[Agent SDK overview](https://docs.claude.com/en/api/agent-sdk/overview)。
- **vs Client SDK**：Client SDK 给你直连 API、自己写 `while stop_reason == "tool_use"` 工具循环；Agent SDK 让 Claude 自动处理工具循环。
- **版本**（二手，写作前请核对 npm/PyPI）：TS `@anthropic-ai/claude-agent-sdk` 约 v0.2.x、Python 约 v0.1.x。来源：[letsdatascience 教程](https://www.letsdatascience.com/blog/claude-agent-sdk-tutorial)（二手）。

### 8.2 OpenAI Agents SDK

- **定位**：OpenAI 官方 Agent 框架，Python + TypeScript，抽象极简、与 OpenAI 平台（尤其 **Responses API**）深度集成。官方文档涵盖 agent 定义、运行、沙盒、编排（orchestration）、护栏（guardrails/approvals）、结果与状态、集成与可观测性。来源：[OpenAI Agents 指南](https://developers.openai.com/api/docs/guides/agents)。
- **适用**：已重度使用 OpenAI 平台、想要官方护栏/可观测/沙盒的团队。
- **Responses API**：提供持久化对话、Web search / File search / Computer use 等内置工具，是 OpenAI 侧 Agent 能力的承载面。来源：[Responses API 指南（AI SDK 视角）](https://sdk.vercel.ai/docs/guides/openai-responses)。

### 8.3 Vercel AI SDK（`ssp-web` 实际所用）

- **定位**：**provider 中立**的 TypeScript 工具箱，不是重型 Agent 框架，但提供 Agent 原语（`ToolLoopAgent`、`stopWhen`、流式、`tool()` 工具调用）。`ssp-web` 正是用它（`ai` `^6.0.99`）。详见 `research/ai-sdk-v6.md`。
- **与上面两者的关系**：
  - Vercel AI SDK 横跨多家 provider（OpenAI / Anthropic / Google / …），换模型成本最低——这也是 `ssp-web` 能"改个 provider 就迁移"的底层原因（§7.1）。
  - OpenAI Agents SDK / Claude Agent SDK 是"某家原厂的 Agent 运行时"，开箱工具与护栏更全，但与该家平台绑定更紧。
  - 三者可混用：用 Vercel AI SDK 做应用层统一接入，用各家 Agent SDK 做特定平台的深度能力（如 Claude Agent SDK 的文件/编码工具、OpenAI 的 Responses 内置工具）。

| 维度 | Vercel AI SDK v6 | OpenAI Agents SDK | Claude Agent SDK |
|---|---|---|---|
| Provider | 多家中立 | OpenAI 为主 | Anthropic（Claude） |
| 语言 | TypeScript（主） | Python + TS | Python + TS |
| 定位 | 工具箱 + Agent 原语 | 原厂 Agent 框架 | Claude Code 同款 Agent 运行时 |
| 内置工具执行 | 自定义 `tool()` | Responses 内置工具 | Read/Edit/Bash/Web 等开箱 |
| `ssp-web` 是否用 | ✅ 是 | ❌ | ❌ |

> 来源（SDK 对比，部分二手，观点参考）：[Anthropic vs OpenAI vs Vercel SDK 对比](https://docs.bswen.com/blog/2026-04-29-agent-sdk-comparison-anthropic-openai-vercel)、[JS Agent 框架横评](https://fast.io/resources/best-ai-agent-frameworks-for-javascript/)。版本号/包名以官方 npm/PyPI 与官方文档为准。

---

## 9. 章节追溯映射

| 章节文件 | 标题 | 本报告对应小节 |
|---|---|---|
| `22-cost-control.md`（第 21 节） | 成本控制 | §0 速查 / §1–§3 价格表 / §4 选型决策树 / §6 省钱手段 / §5 多模态价格 |
| `extras/03-model-migration.md`（加餐） | 模型迁移 | §1.2 gpt-4o-mini 现状 / §4 场景匹配 / §7 迁移 checklist + 灰度 / §8 Agent SDK 现状 |

---

## 10. ssp-web 真实用法对齐核对清单（防幻觉）

写 21 节 / extras/03 时，凡引用以下点，务必与 `code-facts.md` 的真实片段一致：

- ✅ `ssp-web` 通过 `@ai-sdk/openai` 的 `createOpenAI({ apiKey, baseURL })` 接入，模型名来自 `OPENAI_MODEL` 环境变量（示例 `gpt-4o-mini`），见 `src/lib/ai/config.ts` / `agent.ts`。
- ✅ `temperature: 0.3`、`stopWhen: stepCountIs(8)`、`providerOptions.openai.store = false` 是 `ssp-web` 真实配置（`agent.ts`），不要写成其它数值。
- ✅ `ssp-web` 用 Vercel AI SDK v6（`ai` `^6.0.99`），**不使用** OpenAI Agents SDK / Claude Agent SDK；引用这两者时标注"对照/示意"。
- ⚠️ 本报告所有**价格、上下文窗口、SDK 版本**均为 **2026-05-30 获取**，写作时若距今较久务必复核官方页并更新，正文引用价格须带"价格截至 YYYY-MM-DD，以官方为准"。
- ⚠️ 模型版本号（GPT-5.4 / 5.5、Claude Opus 4.6/4.8、Gemini 3/3.5）修饰的是**第三方产品**，可正常书写；但**不得**用"v1/v2/旧版本/历史归档"等措辞指代**本课程**（style-guide §3.3）。

---

## 附：完整来源清单

**官方一手源（定价 / 文档）**：

1. [OpenAI API 定价（developers.openai.com）](https://developers.openai.com/api/docs/pricing) — §1 价格已据此核实
2. [OpenAI GPT-5.5 model 页](https://developers.openai.com/api/docs/models/gpt-5.5) — §1.2 窗口/能力
3. [OpenAI API 定价（openai.com，旗舰档）](https://openai.com/api/pricing/)
4. [OpenAI Agents 指南](https://developers.openai.com/api/docs/guides/agents) — §8.2
5. [OpenAI Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)
6. [OpenAI 帮助中心 - 模型与限制（GPT-4o 等下线说明）](https://help.openai.com/en/articles/11165333-chatgpt-enterprise-and-edu-models-limits)
7. [Anthropic 官方定价页](https://docs.anthropic.com/en/docs/about-claude/pricing) — §2、§6.1 已据此核实
8. [Anthropic Claude Agent SDK overview](https://docs.claude.com/en/api/agent-sdk/overview) — §8.1
9. [Anthropic - Migrate to Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/migration-guide)
10. [Anthropic - 迁移到 Claude 4 指南](https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4) — §2.2 自适应思考
11. [Google Gemini Developer API 定价页](https://ai.google.dev/gemini-api/docs/pricing)（更新于 2026-05-28）— §3 已据此核实
12. [Google Gemini models 页](https://ai.google.dev/gemini-api/docs/models) — §3.2 弃用/停服
13. [Vercel AI SDK - OpenAI Responses API 指南](https://sdk.vercel.ai/docs/guides/openai-responses) — §8.2/§8.3

**第三方 / 二手（仅作对比或观点参考，引用须标注"二手"）**：

14. [生产环境 LLM 迁移 playbook（tianpan.co）](https://tianpan.co/blog/2026-04-20-llm-model-migration-production-playbook)
15. [Agent SDK 三家对比（bswen）](https://docs.bswen.com/blog/2026-04-29-agent-sdk-comparison-anthropic-openai-vercel)
16. [JS Agent 框架横评（fast.io）](https://fast.io/resources/best-ai-agent-frameworks-for-javascript/)
17. [Claude Agent SDK 教程（letsdatascience，SDK 版本号二手）](https://www.letsdatascience.com/blog/claude-agent-sdk-tutorial)
18. ssp-web 真实源码与依赖：`src/lib/ai/agent.ts`、`config.ts`、`package.json`（详见 `course/code-facts.md`）

> 写作铁律：凡"价格 / 版本号 / 上下文窗口 / API 名称"类陈述，**优先回链官方一手源并带获取日期**；凡"基准跑分 / 市场份额 / SDK 小版本号"类数字，**必须标注二手 + 日期 + 口径**，不得作为确定事实陈述。价格务必带"价格截至 2026-05-30，以官方为准"。
