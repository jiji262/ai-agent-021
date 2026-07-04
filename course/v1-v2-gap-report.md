# V1 → V2 内容缺口报告（Version Gap Report）

> **定位**：本报告是删除 V1（根目录 15 章，任务 8.3）之前的**必要内容审计**。它逐条比对 V1（`ai-agent-021/` 根目录 15 个 Markdown）与 V2（`course/` 30 节正文 + 加餐 + FAQ）的知识点覆盖，确保「先合并、再迁移、后删除」流程不丢失任何有价值内容。
>
> **对应需求**：R1.2（产出缺口报告）、R1.3（未覆盖条目记迁移决策）、R1.4（已覆盖条目不记决策）。
>
> **生成方式**：实际读取全部 15 个 V1 文件的二级/三级标题与正文要点，逐点在 V2 全文中检索覆盖证据（术语命中 + 语义比对），由人工判定覆盖与否并记录迁移决策。

---

## 一、阅读约定（中文表述 ↔ 校验器枚举的对应）

本报告的「迁移决策」列使用中文表述，与校验器 `validateGapDecision`（`course/scripts/lib/gap-report.ts`）的 `MigrationDecision.decision` 枚举一一对应：

| 报告中文表述 | 校验器枚举值（`decision`） | 含义 |
|---|---|---|
| **并入指定 V2 章节** | `merge_into` | 该知识点有价值但 V2 未覆盖，须在「目标 V2 章节」列指明合并落点；删除 V1 前必须完成合并（任务 8.1） |
| **明确放弃并附理由** | `drop` | 该知识点 V2 未覆盖，但经评估不值得保留，须在「理由」列说明放弃原因 |
| **—**（留空） | （无 `decision` 字段） | 该知识点 V2 **已覆盖**，按 AC 1.4 不记录迁移决策 |

**报告须满足的不变式**（与 `validateGapDecision` 一致）：

1. `V2 是否已覆盖 = 是` 的条目 → 迁移决策列必须为 `—`（不带决策）。
2. `V2 是否已覆盖 = 否` 的条目 → 迁移决策列必须恰为「并入指定 V2 章节」或「明确放弃并附理由」之一。
3. 决策为「并入指定 V2 章节」的条目 → 「目标 V2 章节」列必须为非空的具体章节文件。

> **覆盖判定原则**：只要 V2 在任一章节对该知识点的**核心论点 + 关键实现**作了等价或更新的讲解，即判「已覆盖」，不要求逐字一致（V2 基于同一个 `ssp-web` 项目重构，技术栈已升级到 2026 基线，表述更新属正常）。仅当 V1 存在**独有论点或独有实现细节**而 V2 完全缺失时，才判「未覆盖」。

---

## 二、V1 文件 → V2 章节主映射

| V1 文件 | 主题 | 主要落点 V2 章节 |
|---|---|---|
| `00-introduction.md` | 序章：项目缘起 + 四层架构 + 快速体验 | `01-introduction.md` |
| `01-what-is-ai-agent.md` | Agent 是什么 + 进化史 + ReAct + 架构模式 | `02-what-is-agent.md`、`03-agent-evolution.md`、`04-react-loop.md`、`05-four-layer-architecture.md` |
| `02-tech-stack-choices.md` | 技术选型 + 20 行核心 + 数据库 + 成本 | `06-tech-stack-2026.md`、`07-minimal-agent.md`、`08-database-and-drizzle.md`、`22-cost-control.md` |
| `03-prompt-engineering.md` | System Prompt + 动态上下文 + 版本管理 | `10-system-prompt.md`、`11-dynamic-context.md`、`21-security-guardrails.md` |
| `04-tool-system.md` | Tool Calling + Zod Schema + 编排 + 审批 | `12-tool-calling.md`、`13-zod-schema.md`、`14-tool-orchestration.md` |
| `05-rule-engine.md` | 规则引擎 DSL + 执行 + 版本 + 调试 | `15-rule-engine-dsl.md`、`16-jsonlogic-execution.md`、`extras/01-admin-cms.md` |
| `06-agent-memory.md` | 四种记忆 + 持久化 + 传输层 | `19-agent-memory.md`、`17-frontend-integration.md` |
| `07-frontend-integration.md` | useChat + Parts + 工具状态 + XSS | `17-frontend-integration.md`、`18-streaming-ui.md` |
| `08-debugging-observability.md` | 五步排查 + 日志 + Trace + 指标 | `20-debugging-observability.md` |
| `09-evals-and-regression.md` | 三层评测 + 评分器 + CI 门禁 | `23-evaluation.md`、`24-regression-testing.md` |
| `09-security-and-cost.md` | 四层安全 + 注入 + 成本控制 | `21-security-guardrails.md`、`22-cost-control.md` |
| `10-responses-and-mcp.md` | Responses API + MCP 采纳 + 迁移方法论 | `25-mcp-protocol.md`、`26-mcp-in-practice.md`、`extras/03-model-migration.md` |
| `11-mcp-in-practice.md` | MCP 实战 + Inspector + 部署 | `26-mcp-in-practice.md`、`25-mcp-protocol.md` |
| `12-rag-and-agentic-retrieval.md` | RAG + pgvector + 混合检索 + Agentic RAG | `27-rag-augmentation.md` |
| `13-multi-agent-patterns.md` | 多 Agent 协作模式 + 状态共享 + 陷阱 | `28-multi-agent.md` |
| `14-deploy-and-beyond.md` | 部署 + 环境变量 + 灰度 + 运维 | `29-deploy-and-beyond.md`、`30-epilogue.md` |

---

## 三、决策表

> 列含义：`V1 知识点 | 来源(V1 文件) | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由`。
> 已覆盖条目迁移决策列为 `—`；未覆盖条目恰带一个「并入指定 V2 章节」或「明确放弃并附理由」。

### 3.1 `00-introduction.md`（序章）

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| SSP 产品形态与对话界面 | `00-introduction.md` | 是 | — | — | `01-introduction.md` §2 完整呈现产品与界面 |
| 为什么不能直接问 ChatGPT（幻觉/数据过期/决策树） | `00-introduction.md` | 是 | — | — | `01-introduction.md` 与 `12-tool-calling.md` 均有等价论证 |
| 四层架构（交互/推理/执行/持久） | `00-introduction.md` | 是 | — | — | `01-introduction.md` + `05-four-layer-architecture.md` 系统展开 |
| 5 分钟快速体验（clone → install → env → seed → dev） | `00-introduction.md` | 是 | — | — | `01-introduction.md` §2.4「五分钟快速体验」逐步对齐 |
| 核心设计原则（LLM 是嘴、规则引擎是脑） | `00-introduction.md` | 是 | — | — | `01-introduction.md` 小结与全课主线一致 |
| 教程学习路线与读者前置 | `00-introduction.md` | 是 | — | — | `README.md` + `01-introduction.md` 已覆盖 |

### 3.2 `01-what-is-ai-agent.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 一句话区分 Agent 与聊天机器人 | `01-what-is-ai-agent.md` | 是 | — | — | `02-what-is-agent.md` 核心讲解 |
| 从 Chatbot 到自主 Agent 的进化路径 | `01-what-is-ai-agent.md` | 是 | — | — | `03-agent-evolution.md` 四代进化史 |
| 三板斧：感知 / 推理 / 行动 | `01-what-is-ai-agent.md` | 是 | — | — | `02-what-is-agent.md` + `04-react-loop.md` PRA 模型 |
| ReAct 循环怎么"转"起来 | `01-what-is-ai-agent.md` | 是 | — | — | `04-react-loop.md` 整章专讲 |
| **Agent 架构模式速览：Plan-Execute / Reflexion 等规划范式** | `01-what-is-ai-agent.md` | 否 | 并入指定 V2 章节 | `04-react-loop.md` | 知识地图把「ReAct 与规划范式（Plan-Execute / Reflection）」列为第 3 节知识领域，但 `04-react-loop.md` 正文只在延伸阅读提到 Reflexion，未把 Plan-Execute / Reflexion 作为**与 ReAct 并列的规划范式**展开对比；这是面试高频主题「ReAct 与规划」的必备内容，须并入 |
| 2026 Agent 框架生态对比（AI SDK / LangChain·LangGraph / CrewAI） | `01-what-is-ai-agent.md` | 是 | — | — | `06-tech-stack-2026.md`（推理层选型）+ `28-multi-agent.md`（LangGraph/CrewAI/OpenAI Agents SDK 框架选型）已覆盖且更新 |
| 真实案例：一次完整对话的代码路径 | `01-what-is-ai-agent.md` | 是 | — | — | `04-react-loop.md` §2.3 真实 ReAct 链逐节拍展开 |

### 3.3 `02-tech-stack-choices.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 四层架构选型框架 | `02-tech-stack-choices.md` | 是 | — | — | `05-four-layer-architecture.md` + `06-tech-stack-2026.md` |
| 推理层选型（LangChain / 自建 HTTP / AI SDK v6） | `02-tech-stack-choices.md` | 是 | — | — | `06-tech-stack-2026.md` §2.2 三方对比，已升级到 v6 基线 |
| 20 行代码起推理层核心 | `02-tech-stack-choices.md` | 是 | — | — | `07-minimal-agent.md` 整章专讲 |
| 模型选型 gpt-4o-mini 凭什么够用 | `02-tech-stack-choices.md` | 是 | — | — | `06-tech-stack-2026.md` §2.3 + `22-cost-control.md` |
| 数据库选型 Neon Postgres（含为什么不用 MongoDB） | `02-tech-stack-choices.md` | 是 | — | — | `06-tech-stack-2026.md` §2.4「为什么不选 MongoDB」+ JSONB 论证 |
| **为什么不用 Redis 存对话历史（对话历史是需持久化的结构化数据，非缓存）** | `02-tech-stack-choices.md` | 否 | 明确放弃并附理由 | — | V2 `06-tech-stack-2026.md` 已确立「对话历史是需持久化的结构化数据 → Postgres + JSONB」的选型哲学，候选表聚焦关系型/文档型数据库；Redis 作为缓存不在候选范围，单列「为什么不用 Redis」对 2026 选型读者价值低，放弃以保持选型章节聚焦 |
| 数据库 Schema 全景（4 张核心表） | `02-tech-stack-choices.md` | 是 | — | — | `06-tech-stack-2026.md` + `08-database-and-drizzle.md` schema 展开 |
| 成本估算（Token / 数据库 / 部署 / 月度总成本） | `02-tech-stack-choices.md` | 是 | — | — | `22-cost-control.md` 成本结构 + `06` 选型成本 |

### 3.4 `03-prompt-engineering.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 操作手册 vs 角色描述 | `03-prompt-engineering.md` | 是 | — | — | `10-system-prompt.md` 开篇即此对比 |
| 绝不自行计算（核心规则之首） | `03-prompt-engineering.md` | 是 | — | — | `10-system-prompt.md` 8 条核心规则第 1 条 |
| 洋葱模型：从内核到外壳四层 | `03-prompt-engineering.md` | 是 | — | — | `10-system-prompt.md` 洋葱模型小结图 |
| 三级渐进收集（Tier 1/2/3） | `03-prompt-engineering.md` | 是 | — | — | `10-system-prompt.md` 数据收集优先级 |
| `buildContextPrompt()` 动态上下文注入 | `03-prompt-engineering.md` | 是 | — | — | `11-dynamic-context.md` 整章专讲 |
| 客户端 Round-trip（questions 的旅程） | `03-prompt-engineering.md` | 是 | — | — | `11-dynamic-context.md` + `18-streaming-ui.md` |
| Temperature 0.3 任务型黄金参数 | `03-prompt-engineering.md` | 是 | — | — | `04-react-loop.md` / `05-four-layer-architecture.md` 代码注释 |
| 模糊输入处理（"73 年"→1973） | `03-prompt-engineering.md` | 是 | — | — | `10-system-prompt.md` + `16-jsonlogic-execution.md` parse_birth_year |
| Prompt 版本管理 / 对比测试 / 回滚 | `03-prompt-engineering.md` | 是 | — | — | `11-dynamic-context.md` 版本管理 + 灰度/AB |
| 安全护栏指令防 Prompt Injection | `03-prompt-engineering.md` | 是 | — | — | `21-security-guardrails.md` + `10-system-prompt.md` |

### 3.5 `04-tool-system.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| LLM 是调度员不是执行者 | `04-tool-system.md` | 是 | — | — | `12-tool-calling.md` §2.1 协议本质 |
| Zod Schema 的 description 是给 LLM 看的 | `04-tool-system.md` | 是 | — | — | `13-zod-schema.md` 整章专讲 |
| AI SDK v6 `strict` 模式 | `04-tool-system.md` | 是 | — | — | `13-zod-schema.md` §1.3 strictJsonSchema 默认开 |
| **AI SDK v6 `inputExamples`（工具入参示例增强器）** | `04-tool-system.md` | 否 | 并入指定 V2 章节 | `13-zod-schema.md` | `12-tool-calling.md` 仅把 `inputExamples` 列为 v6 新增字段名「等会讲到」，但全课无任何章节实际展开其用法；它是 v6 降低 LLM 填参错误率的具体能力（R2 要求跟进最新技术栈），应在 Schema 章节补一小节实现示例 |
| 三个工具三种职责 | `04-tool-system.md` | 是 | — | — | `12-tool-calling.md` §2.2 + `14-tool-orchestration.md` |
| **`needsApproval` 完整实现（工具定义 → 前端审批 UI → 后端恢复）** | `04-tool-system.md` | 否 | 并入指定 V2 章节 | `14-tool-orchestration.md` | V2 多处提到 `needsApproval` 概念与动态阈值（`12`/`14`/`17`），但无任一章节给出「工具标记审批 → 前端 `approval-requested` UI → 用户批准后 `addToolResult` 恢复执行」的端到端实现；human-in-the-loop 是面试高频考点，须并入完整实现 |
| 工具编排模式（串行 / 并行 / 条件分支） | `04-tool-system.md` | 是 | — | — | `14-tool-orchestration.md` 编排策略 + 多步链路控制 |
| 优雅失败：工具出错绝不抛异常 | `04-tool-system.md` | 是 | — | — | `16-jsonlogic-execution.md`（内置函数不抛异常）+ `12`/`13`（output-error 状态 + repair）|
| stepCountIs(5) + Temperature 0.3 双重安全边界 | `04-tool-system.md` | 是 | — | — | `04-react-loop.md` + `14-tool-orchestration.md` stopWhen 硬阀门 |

### 3.6 `05-rule-engine.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 政策更新不改代码（架构决策） | `05-rule-engine.md` | 是 | — | — | `15-rule-engine-dsl.md` 政策即代码哲学 |
| Orchestrator 四步流程 | `05-rule-engine.md` | 是 | — | — | `16-jsonlogic-execution.md` orchestrate() 五步 |
| 一条规则的完整解剖（R-110 六部分） | `05-rule-engine.md` | 是 | — | — | `15-rule-engine-dsl.md` 规则 anatomy 六部分 |
| executeRule() 执行逻辑 | `05-rule-engine.md` | 是 | — | — | `16-jsonlogic-execution.md` 执行器讲解 |
| 为什么用 JSONLogic 不用 eval() | `05-rule-engine.md` | 是 | — | — | `16-jsonlogic-execution.md` §为什么不用 eval 三理由 |
| R-900-FINAL-GATE 安全闸门 | `05-rule-engine.md` | 是 | — | — | `15-rule-engine-dsl.md` + `16` 门禁规则 |
| needs_agent 真实语义（以 trace 为准） | `05-rule-engine.md` | 是 | — | — | `16-jsonlogic-execution.md` needs_agent 行为信号 |
| 24 条规则的完整编排（rule_set 顺序） | `05-rule-engine.md` | 是 | — | — | `15-rule-engine-dsl.md` 编排由 rule_set 决定 |
| 证据链 trace（让结论有据可查） | `05-rule-engine.md` | 是 | — | — | `16-jsonlogic-execution.md` §2.4 trace[]/evidence[] |
| 规则版本管理（灰度 / 审批流 draft→review→published / 回滚） | `05-rule-engine.md` | 是 | — | — | `15-rule-engine-dsl.md` §2.4 四层版本 + `extras/01-admin-cms.md` publish 流水线 |
| 用 Trace 调试规则 Bug + 规则调试器 UI | `05-rule-engine.md` | 是 | — | — | `16-jsonlogic-execution.md` + `20-debugging-observability.md` + `extras/01` 后台 |

### 3.7 `06-agent-memory.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 四种记忆分类（短期/工作/长期/语义） | `06-agent-memory.md` | 是 | — | — | `19-agent-memory.md` 整章专讲 |
| 短期记忆 messages 管道 | `06-agent-memory.md` | 是 | — | — | `19-agent-memory.md` 消息管道 |
| UIMessage vs ModelMessage + convertToModelMessages | `06-agent-memory.md` | 是 | — | — | `19-agent-memory.md` + `17-frontend-integration.md` |
| 工作记忆动态上下文 + 客户端往返 | `06-agent-memory.md` | 是 | — | — | `11-dynamic-context.md` + `19-agent-memory.md` |
| 长期记忆 Profile 累积 + deepMerge（只增不减） | `06-agent-memory.md` | 是 | — | — | `17-frontend-integration.md`/`19-agent-memory.md` deepMerge |
| JSONB 存储（为什么不建单独 messages 表） | `06-agent-memory.md` | 是 | — | — | `06-tech-stack-2026.md` JSONB + `19-agent-memory.md` 持久化策略 |
| 跨会话 Profile 恢复 | `06-agent-memory.md` | 是 | — | — | `19-agent-memory.md` 跨会话恢复 |
| void updateConversation() 后台写入换零延迟 | `06-agent-memory.md` | 是 | — | — | `19-agent-memory.md` + `22`/`29` waitUntil 异步写库 |
| 语义记忆为 RAG 铺路 | `06-agent-memory.md` | 是 | — | — | `19-agent-memory.md` + `27-rag-augmentation.md` |
| DefaultChatTransport 传输层配置 | `06-agent-memory.md` | 是 | — | — | `17-frontend-integration.md` transport 配置 |
| x-conversation-id 会话连续性 | `06-agent-memory.md` | 是 | — | — | `17-frontend-integration.md` createConversationTrackingFetch |

### 3.8 `07-frontend-integration.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 组件架构全景 | `07-frontend-integration.md` | 是 | — | — | `17-frontend-integration.md` 组件分层 |
| useChat 一个 Hook 撑起对话 | `07-frontend-integration.md` | 是 | — | — | `17-frontend-integration.md` §2 |
| Parts 渲染（消息是结构化数组） | `07-frontend-integration.md` | 是 | — | — | `17`/`18-streaming-ui.md` parts 渲染 |
| updateProfile 结果为什么隐藏 | `07-frontend-integration.md` | 是 | — | — | `17-frontend-integration.md` 工具结果分流 |
| 工具状态处理（别只处理成功） | `07-frontend-integration.md` | 是 | — | — | `18-streaming-ui.md` 四态状态机 |
| 并发工具调用的 UI 处理 | `07-frontend-integration.md` | 是 | — | — | `17`/`18` 多工具 part 渲染 |
| 快速操作按钮（选择变点击） | `07-frontend-integration.md` | 是 | — | — | `18-streaming-ui.md` 快速操作按钮 |
| 流式打字效果（不需手写） | `07-frontend-integration.md` | 是 | — | — | `18-streaming-ui.md` 流式渲染 |
| plan_id 检测与自动跳转 | `07-frontend-integration.md` | 是 | — | — | `07-minimal-agent.md`/`18-streaming-ui.md` plan_id 分流 |
| XSS 防护（escapeHtml 在 renderMarkdown 之前） | `07-frontend-integration.md` | 是 | — | — | `18-streaming-ui.md` §2.7 marked → DOMPurify |
| sendMessage 替代 append（v6） | `07-frontend-integration.md` | 是 | — | — | `17-frontend-integration.md` API 迁移表 |

### 3.9 `08-debugging-observability.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 为什么 AI Agent 的 bug 特别难查 | `08-debugging-observability.md` | 是 | — | — | `20-debugging-observability.md` 开篇 |
| 五步排查法（复现/定位/隔离/修复/验证） | `08-debugging-observability.md` | 是 | — | — | `20-debugging-observability.md` §2.1 |
| createRequestLogger / request_id 锚点 | `08-debugging-observability.md` | 是 | — | — | `20-debugging-observability.md` §2.2-2.3 |
| 错误分级（400/500 等三级） | `08-debugging-observability.md` | 是 | — | — | `20-debugging-observability.md` §2.8 错误分三级 |
| 追踪 TraceEntry | `08-debugging-observability.md` | 是 | — | — | `16-jsonlogic-execution.md` + `20` |
| Trace 可视化调试面板 | `08-debugging-observability.md` | 是 | — | — | `20` + `16` evidence 时间线 |
| 六项核心生产指标 | `08-debugging-observability.md` | 是 | — | — | `20-debugging-observability.md` §2.9 六项指标 |
| 常见问题排查清单（不调工具/空结果/SSE 中断/画像丢失） | `08-debugging-observability.md` | 是 | — | — | `20-debugging-observability.md` 排查清单 |
| 证据链页面赢得用户信任 | `08-debugging-observability.md` | 是 | — | — | `16-jsonlogic-execution.md` `/evidence/[planId]` |
| OpenTelemetry GenAI（V2 新增基线） | `08-debugging-observability.md`（V1 无） | 是 | — | — | V2 `20` 新增 OTel GenAI，超出 V1 范围，无缺口 |

### 3.10 `09-evals-and-regression.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 手动测试 vs 自动评测的天然缺陷 | `09-evals-and-regression.md` | 是 | — | — | `23-evaluation.md` §1 |
| 三层评测模型（字段抽取/工具调用/端到端） | `09-evals-and-regression.md` | 是 | — | — | `23-evaluation.md` 评测金字塔（单元/集成/回归） |
| 评测集从 30 到 200 的增长路径 | `09-evals-and-regression.md` | 是 | — | — | `23-evaluation.md` 黄金集 50-200 + 四种数据集 |
| 评分器设计（确定性优先 / 模型评分补充） | `09-evals-and-regression.md` | 是 | — | — | `23-evaluation.md` deterministic + LLM-as-Judge |
| 评测代码实战（Vitest 结构） | `09-evals-and-regression.md` | 是 | — | — | `23`/`24` Promptfoo/DeepEval/Inspect 实战 |
| 发布门禁阈值 | `09-evals-and-regression.md` | 是 | — | — | `24-regression-testing.md` CI 门禁阈值 |
| 模型升级的特殊评测流程 | `09-evals-and-regression.md` | 是 | — | — | `24` + `extras/03-model-migration.md` 迁移评测 |
| 与 SSP 代码落地对齐（tools/engine/route） | `09-evals-and-regression.md` | 是 | — | — | `24-regression-testing.md` cases/tests/publishes 表 |
| CI/CD GitHub Actions + 保护分支 | `09-evals-and-regression.md` | 是 | — | — | `24-regression-testing.md` CI 流水线 |

### 3.11 `09-security-and-cost.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 四层安全纵深防御（网络/应用/AI/数据） | `09-security-and-cost.md` | 是 | — | — | `21-security-guardrails.md` 四层防御 |
| Prompt Injection 攻防（直接/间接注入 + 输入标记隔离） | `09-security-and-cost.md` | 是 | — | — | `21-security-guardrails.md` 注入攻防 |
| LLM 四大安全风险（注入/工具滥用/越权/数据外泄） | `09-security-and-cost.md` | 是 | — | — | `21-security-guardrails.md` 风险清单 |
| Token 成本公式 | `09-security-and-cost.md` | 是 | — | — | `22-cost-control.md` 成本计算 |
| 按维度追踪成本 | `09-security-and-cost.md` | 是 | — | — | `22-cost-control.md` 成本归因 |
| 六个成本优化策略 | `09-security-and-cost.md` | 是 | — | — | `22-cost-control.md` 缓存/分级/stopWhen 等 |
| 预算告警 + 紧急关停开关 | `09-security-and-cost.md` | 是 | — | — | `22-cost-control.md` §2.7 紧急关停 + 降级路径 |
| 安全检查清单 | `09-security-and-cost.md` | 是 | — | — | `21-security-guardrails.md` 上线前清单 |

### 3.12 `10-responses-and-mcp.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| Responses API vs Chat Completions | `10-responses-and-mcp.md` | 是 | — | — | `extras/03-model-migration.md` Responses API 迁移（store/previous_response_id/缓存命中）|
| 适配层 provider adapter（改底层不改业务） | `10-responses-and-mcp.md` | 是 | — | — | `06-tech-stack-2026.md` + `research/model-selection-2026.md` provider 抽象 |
| MCP 的三大价值（标准化/跨服务共享/治理） | `10-responses-and-mcp.md` | 是 | — | — | `25-mcp-protocol.md` MCP 意义 |
| 渐进式 MCP 采纳三阶段 | `10-responses-and-mcp.md` | 是 | — | — | `26-mcp-in-practice.md` 迁移策略 + 三信号 |
| 双轨迁移方法论（适配层 → 灰度对比 → 失败回退） | `10-responses-and-mcp.md` | 是 | — | — | `extras/03-model-migration.md` 灰度阶梯 + 跨 provider fallback |
| 迁移常见误区（官方推荐就全切 / 一上来全换 / 只验功能） | `10-responses-and-mcp.md` | 是 | — | — | `26`/`28`/`extras/03` 均强调先穷尽现状、灰度验证 |

### 3.13 `11-mcp-in-practice.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| MCP 协议速览（HTTP 类比） | `11-mcp-in-practice.md` | 是 | — | — | `25-mcp-protocol.md` 协议拆解 |
| 三核心概念（Tools / Resources / Prompts） | `11-mcp-in-practice.md` | 是 | — | — | `25-mcp-protocol.md` 三 primitive + 触发者区分 |
| Client ↔ Server 架构 | `11-mcp-in-practice.md` | 是 | — | — | `25`/`26` 架构图 |
| 把 computePlan 包装成 MCP Server（完整代码） | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` §2 stdio server 代码 |
| AI SDK 接入 MCP Server | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` `@ai-sdk/mcp` client |
| 生产环境 HTTP/SSE 传输 | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` Streamable HTTP + Vercel/CF 部署 |
| 本地工具 vs MCP 工具怎么选 | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` 选型对比表 |
| MCP Inspector 测试 + 自动化测试 | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` §2.6 Inspector（UI/CLI）|
| 部署为独立服务 | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` Vercel/Cloudflare 部署 + health/限流/日志 |
| 迁移策略三信号 | `11-mcp-in-practice.md` | 是 | — | — | `26-mcp-in-practice.md` 何时该上 MCP |

### 3.14 `12-rag-and-agentic-retrieval.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 规则引擎 + RAG 双轨知识体系 | `12-rag-and-agentic-retrieval.md` | 是 | — | — | `27-rag-augmentation.md` §1 结构化归规则、非结构化归 RAG |
| 为什么 Agent 需要 RAG | `12-rag-and-agentic-retrieval.md` | 是 | — | — | `27-rag-augmentation.md` §1.3 |
| 向量库选型 Neon pgvector（复用现有基础设施） | `12-rag-and-agentic-retrieval.md` | 是 | — | — | `27-rag-augmentation.md` §2.2 pgvector + hnsw |
| 文档切分与 Embedding（embed/embedMany） | `12-rag-and-agentic-retrieval.md` | 是 | — | — | `27-rag-augmentation.md` §2.3-2.4 切分策略 + embedding 选型 |
| 检索与重排（向量相似度 / 混合检索 / Rerank） | `12-rag-and-agentic-retrieval.md` | 是 | — | — | `27-rag-augmentation.md` §2.5 Hybrid Search + rerank |
| Agentic RAG（让 Agent 自主决定何时检索，检索即工具） | `12-rag-and-agentic-retrieval.md` | 是 | — | — | `27-rag-augmentation.md` RAG 是 Tool Calling 的特殊形态 |

### 3.15 `13-multi-agent-patterns.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| 为什么需要多 Agent（认知负荷） | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` 开篇 |
| 三种协作模式（管道 / 分工 / 讨论） | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` 6 种模式（Supervisor/Hierarchical/Swarm/Sequential/Debate/Map-Reduce）为其超集 |
| AI SDK 多步骤执行（maxSteps/stopWhen） | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` + `04-react-loop.md` |
| Subagent 模式（工具里藏另一个 Agent） | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` Supervisor-Worker + prepareStep 虚拟分工 |
| SSP 实战：主 Agent + 补贴计算专家 | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` §2.6 真正需要多 Agent 场景的 supervisor-worker 实战 |
| 状态共享与协调（传参不传状态 / 结果聚合） | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` 结构化 JSON 传递 + Map-Reduce reducer |
| 常见陷阱（过度拆分 / 路由不准 / 信息不对齐 / 无限循环 / 一致性） | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` 反模式 + 决策树 |
| 什么时候上多 Agent 决策框架 | `13-multi-agent-patterns.md` | 是 | — | — | `28-multi-agent.md` 决策树 + A2A 协议（V2 新增）|

### 3.16 `14-deploy-and-beyond.md`

| V1 知识点 | 来源 | V2 是否已覆盖 | 迁移决策 | 目标 V2 章节 | 理由 |
|---|---|---|---|---|---|
| Vercel 部署全流程（CLI / Preview vs Production） | `14-deploy-and-beyond.md` | 是 | — | — | `29-deploy-and-beyond.md` 部署流程 + 三套环境 |
| 路由配置（API 端点特殊配置） | `14-deploy-and-beyond.md` | 是 | — | — | `29-deploy-and-beyond.md` §28.3 vercel.json |
| 环境变量管理（三层环境 + 必需变量） | `14-deploy-and-beyond.md` | 是 | — | — | `29-deploy-and-beyond.md` §28.1 + checklist |
| 上线前检查清单（10 项 Must-Do） | `14-deploy-and-beyond.md` | 是 | — | — | `29-deploy-and-beyond.md` §28.2 50 项 checklist（含 18 项关键自检）|
| 灰度发布策略（Preview / 特性开关 / 回滚预案） | `14-deploy-and-beyond.md` | 是 | — | — | `29-deploy-and-beyond.md` 灰度阀门 + `24` win-rate + `11` enabledRatio |
| 上线后运维（监控仪表盘 / 告警 / 用户反馈循环） | `14-deploy-and-beyond.md` | 是 | — | — | `29-deploy-and-beyond.md` + `20-debugging-observability.md` 指标/告警 |
| 系列回顾（00→14 旅程） | `14-deploy-and-beyond.md` | 是 | — | — | `30-epilogue.md` 课程回顾（00→28）|
| 推荐学习资源 / 动手方向 | `14-deploy-and-beyond.md` | 是 | — | — | `30-epilogue.md` 下一步建议 + 延伸阅读 |

---

## 四、待并入清单（供任务 8.1 执行）

下表汇总全部「并入指定 V2 章节」决策的知识点，是任务 8.1（内容合并）的工作清单。合并须遵守 `style-guide.md` 七段式与术语表，且不破坏主线节 4000–6000 字门禁；合并完成后将对应条目状态标记为「已合并」。

| # | 待并入知识点 | 来源 V1 文件 | 目标 V2 章节 | 合并要点 | 状态 |
|---|---|---|---|---|---|
| 1 | Agent 架构模式：Plan-Execute / Reflexion 等规划范式（与 ReAct 并列对比、各自适用场景、SSP 为何选 ReAct） | `01-what-is-ai-agent.md` | `04-react-loop.md` | 在 ReAct 核心讲解后补一节「不止 ReAct：Plan-Execute 与 Reflexion」，对照知识地图「ReAct 与规划」主题；说明三种范式的 token/成本/适用场景差异，并落地「SSP 短链路任务选 ReAct」的结论。注意维持 4000–6000 字门禁与七段式 | ✅已合并（`04-react-loop.md` §2.7「不止 ReAct」） |
| 2 | AI SDK v6 `inputExamples`（工具入参示例增强器） | `04-tool-system.md` | `13-zod-schema.md` | 在 Schema 增强手段处补一小节，给出 `inputExamples` 的用法与「增强器而非唯一防线」的定位；标注 AI SDK v6 版本与 `code-facts.md` 依赖一致 | ✅已合并（`13-zod-schema.md` §2.8「inputExamples」） |
| 3 | `needsApproval` 完整端到端实现（工具定义标记审批 → 前端 `approval-requested` UI → 用户批准后 `addToolResult` 后端恢复） | `04-tool-system.md` | `14-tool-orchestration.md` | 在工具编排章补一节 human-in-the-loop 完整实现；标注 SSP 三工具当前不用审批、但给出动态阈值审批的通用实现样例（标注「示意，非项目实际代码」如非真实代码）；可与 `18-streaming-ui.md` 的工具状态机相互引用 | ✅已合并（`14-tool-orchestration.md` §2.6「把人放回环里」） |

> **放弃清单（drop，供留痕）**：
>
> - 「为什么不用 Redis 存对话历史」（来源 `02-tech-stack-choices.md`）——理由见 §3.3：V2 第 06 节已确立「对话历史是需持久化的结构化数据 → Postgres + JSONB」的选型哲学，Redis 作为缓存不在候选范围，单列反驳价值低，放弃以保持选型章节聚焦。

---

## 五、审计统计

- **审计 V1 文件数**：15（`00-introduction.md` … `14-deploy-and-beyond.md`，含两个 `09-` 前缀文件）。
- **审计知识点总数**：**138** 条（按各 V1 文件二级/三级标题主知识点聚合，详见 §三决策表逐条记录）。
- **V2 已覆盖**：**134** 条（占 97.1%）——不记录迁移决策（符合 AC 1.4）。
- **V2 未覆盖**：**4** 条（占 2.9%）——每条恰带一个迁移决策（符合 AC 1.3）：
  - **并入指定 V2 章节（merge_into）**：**3** 条 → 见 §四待并入清单。
  - **明确放弃并附理由（drop）**：**1** 条 → 「为什么不用 Redis」。
- **结论**：V2 课程对 V1 内容的覆盖度极高（97%+），仅 3 处有价值知识点需并入、1 处可放弃。完成 §四的 3 项合并后，即满足删除 V1 的内容前置条件（任务 8.1 → 8.3）。

> **下一步**：本报告交任务 7.3 用 `validateGapDecision` 做决策有效性校验；§四待并入清单交任务 8.1 执行内容合并；合并与图片迁移（8.2）全部完成后方可执行任务 8.3 删除 V1。
