# 研究报告 · Agent 设计模式（ReAct / 规划 / 多 Agent / A2A）

> **用途**：本报告是以下三节重写时的技术追溯源——
> - 第 03 节《ReAct 循环》（文件 `04-react-loop.md`）
> - 第 04 节《SSP 四层架构鸟瞰》（文件 `05-four-layer-architecture.md`）
> - 第 27 节《多 Agent 协作模式》（文件 `28-multi-agent.md`）
>
> 这三节里凡是"论文名/作者/年份、模式定义、框架能力、协议版本"类技术声明，都应能回链到本报告对应条目（对齐 Requirements 2.3 / 2.4）。
>
> **调研日期**：2026-02-28（论文以 arXiv 一手源核实；框架/协议以官方文档与官方公告核实；生态规模/榜单类数据标注为二手并给链接）。
>
> **合规说明**：本报告内容为**转述与归纳**，非原文照搬；单一来源连续引用不超过 30 词；论文一律给 arXiv 链接。Content was rephrased for compliance with licensing restrictions。

---

## 0. 一页速查（写作直接抄，但版本/数字回链下文）

| 项 | 值 | 来源类型 |
|---|---|---|
| ReAct 原始论文 | *ReAct: Synergizing Reasoning and Acting in Language Models*，Yao et al.，arXiv:2210.03629，ICLR 2023 | 一手（arXiv） |
| Chain-of-Thought | Wei et al. 2022，arXiv:2201.11903 | 一手 |
| Reflexion | Shinn et al.，arXiv:2303.11366，NeurIPS 2023 | 一手 |
| Tree of Thoughts | Yao et al.，arXiv:2305.10601，NeurIPS 2023 | 一手 |
| ReWOO | Xu et al.，arXiv:2305.18323（2023） | 一手 |
| Plan-and-Solve | Wang et al.，arXiv:2305.04091（ACL 2023） | 一手 |
| 多 Agent Debate | Du et al.，arXiv:2305.14325（"society of minds"，ICML 2024） | 一手 |
| Anthropic 工作流 5 模式 | *Building Effective Agents*（Schluntz & Pagnoni，2024-12） | 一手（官方博客） |
| Anthropic 多 Agent 系统 | *How we built our multi-agent research system*（2025-06），orchestrator-worker，+90.2% / ~15× token | 一手（官方博客） |
| A2A 协议 | Agent2Agent，Google 发起（2025-04）→ 捐 Linux Foundation，**当前 v1.0**，150+ 组织 | 一手（官方 + LF） |
| OpenAI Swarm | 实验项目，**2025-03 弃用**，由 OpenAI Agents SDK 取代 | 二手核实一致 |
| Claude Agent SDK | 由 Claude Code SDK **2025-09-29 改名**而来，支持 subagents | 一手（官方博客） |
| 框架格局 | LangGraph / CrewAI / OpenAI Agents SDK / Microsoft Agent Framework（AutoGen+Semantic Kernel 合并）/ Google ADK / Vercel AI SDK | 一手 + 二手 |

> ⚠️ **写作铁律**：模式名、论文年份、协议版本回链一手源；"75% 项目失败""多轮 −39%""server 总数"这类数字属二手统计，正文引用必须标注"二手 + 口径"，不得作为确定事实陈述。

---

## 1. 模式速查表（模式名 + 一句话 + 适用场景 + 代表实现）

下表是三节写作的"选型字典"。**先有一个心理预期**：这些模式不是"先进 vs 落后"，而是"成本/可靠性/适用任务"不同。

### 1.1 单 Agent 的推理与规划模式

| 模式 | 一句话 | 适用场景 | 代表实现 / 出处 |
|---|---|---|---|
| **CoT（Chain-of-Thought）** | 让模型在输出前先把推理过程一步步写出来 | 纯推理题、无需外部信息 | Wei et al. arXiv:2201.11903 |
| **ReAct（Reason + Act）** | 把"想"和"做"织进同一段 token 流，每步带回环境反馈 Observation | 需要调工具/查外部信息的通用 Agent | Yao et al. arXiv:2210.03629；现代 Tool Calling 的思想原型 |
| **Plan-and-Solve** | 先让模型列出整体计划，再按计划逐步求解（零样本） | 多步算术/常识推理，减少"漏步" | Wang et al. arXiv:2305.04091 |
| **Tree of Thoughts（ToT）** | 把推理建成树，能分支、自评、回溯、前瞻 | 需要搜索/规划的难题（Game of 24、填字、创意写作） | Yao et al. arXiv:2305.10601 |
| **ReWOO** | 把"规划"与"工具观察"解耦：先一次性规划出全部步骤，再批量取证据 | 省 token、降低多轮往返、对工具失败更鲁棒 | Xu et al. arXiv:2305.18323 |
| **Reflexion** | 执行后用自然语言"自我反思"，把教训写进记忆，下次重试更好 | 可多次重试、有成败信号的任务 | Shinn et al. arXiv:2303.11366 |
| **Plan-and-Execute** | 一个 Planner 先出计划，一个 Executor 按步执行，可中途重规划 | 长程任务、想把"贵的规划"和"便宜的执行"分层 | LangGraph plan-and-execute 模板；安全实现指南 arXiv:2509.08646 |
| **LATS** | 用蒙特卡洛树搜索统一推理+行动+规划 | 高价值、可多次采样评估的决策任务 | Zhou et al. arXiv:2310.04406 |

### 1.2 工作流编排模式（Anthropic 五模式，LLM 走预定义代码路径）

| 模式 | 一句话 | 适用场景 |
|---|---|---|
| **Prompt Chaining** | 把任务拆成固定顺序的几步，前一步输出喂后一步 | 步骤可预先确定、要可测可控 |
| **Routing** | 先分类，再把请求路由到专门的处理分支 | 输入类型多样、各类处理方式不同 |
| **Parallelization** | 把子任务并行跑（分片 sectioning 或多次投票 voting） | 子任务独立、想提速或多视角投票 |
| **Orchestrator-Workers** | 一个编排者动态拆任务、派给 worker、汇总 | 子任务数量/形态运行时才知道 |
| **Evaluator-Optimizer** | 一个生成、一个打分，循环改写直到达标 | 有明确评判标准、值得迭代的产出 |

> 出处：Anthropic *Building Effective Agents*（2024-12）。该文把"**工作流（workflow）**=LLM 走预定义代码路径"和"**Agent**=LLM 运行时自己决定路径"明确区分，并把"完全自主 Agent"列为**最后手段**而非默认。

### 1.3 多 Agent 协作拓扑

| 模式 | 一句话 | 适用场景 | 代表实现 |
|---|---|---|---|
| **Supervisor（中心化路由）** | 一个 Supervisor 决定调哪个 Worker、何时收尾 | 路由准确度敏感、要好调试 | LangGraph `langgraph-supervisor`；Anthropic 研究系统 lead+subagent |
| **Hierarchical（多层 Supervisor）** | Supervisor 管 sub-Supervisor，再管 Worker | 超复杂任务的分层分解 | LangGraph 分层图 |
| **Swarm（点对点 handoff）** | Agent 之间直接交接控制权，无中央节点 | 各 Agent 维护自己上下文、要快 | LangGraph `langgraph-swarm`；OpenAI Swarm（已退役）思想 |
| **Sequential Pipeline** | A→B→C 串行，本质是 prompt chaining | 极简、可预测、易测试 | 任意框架 |
| **Debate / Consensus** | N 个 Agent 各答→互看→修订→取共识 | 高赌注、对错可验证的推理 | Du et al. arXiv:2305.14325 |
| **Map-Reduce（并行 fan-out/fan-in）** | 切片→并行 Worker→reducer 合并 | breadth-first、context 装不下 | LangGraph `Send` API；Anthropic 研究系统 |

---

## 2. ReAct 详解（第 03 节核心追溯源）

### 2.1 出处与定位

- **论文**：*ReAct: Synergizing Reasoning and Acting in Language Models*。
- **作者**：Shunyu Yao、Jeffrey Zhao、Dian Yu、Nan Du、Izhak Shafran、Karthik Narasimhan、Yuan Cao（普林斯顿 + Google）。
- **链接**：[arXiv:2210.03629](https://arxiv.org/abs/2210.03629)（首次提交 2022-10），ICLR 2023 接收；代码仓库 [ysymyth/ReAct](https://github.com/ysymyth/ReAct)。

ReAct 的核心主张（转述）：让模型在每一步**同时产出"推理痕迹（reasoning trace）"和"动作（action）"**，动作作用于外部环境并返回观察（observation），观察再拼回上下文进入下一轮。这样推理可以指导动作、动作的反馈又能修正推理。

写成模式：

```
Thought:      <模型在想什么>
Action:       <模型决定做什么，作用于外部环境>
Observation:  <环境返回的反馈>
Thought:      <根据反馈接着想>
...           <循环，直到模型输出 Finish 或达到步数上限>
```

### 2.2 为什么需要 ReAct：两条早期路都堵死

- **纯 CoT（只推理）**：Wei et al. 2022（[arXiv:2201.11903](https://arxiv.org/abs/2201.11903)）让模型"一步步想"，但**只能在参数里推，无法接入外部信息**，容易把不知道的事实编出来（幻觉）。
- **纯 Act-only（只行动）**：强制每步只输出动作、不推理，决策**脆弱**，工具一多就乱选。

ReAct 的价值就是**把二者协同**：推理决定"下一步该做什么"，行动把外部世界拉进来校正推理。

### 2.3 论文实验结论（写作引用前以论文表格为准）

论文在知识密集型问答与交互决策两类任务上验证 ReAct：

- **HotpotQA（多跳问答）、FEVER（事实校验）**：ReAct 通过检索维基获取外部证据，缓解了 CoT 的幻觉；论文同时指出 ReAct 与 CoT 结合（ReAct + CoT-SC）效果更好。
- **ALFWorld（具身指令）、WebShop（网页购物）**：ReAct 显著超过模仿学习 / 强化学习基线，论文报告 ALFWorld 成功率约 **71%**、WebShop 约 **40%**，相对 Act-only 与基线有可观提升。

> ⚠️ 写作提醒：上述具体百分比为论文报告值，**写章节引用前请核对 [arXiv:2210.03629](https://arxiv.org/abs/2210.03629) 原文表格**（不同任务设置/采样下数字略有差异）。本报告对 ReAct 的**定性结论**——"只想会幻觉、只动会乱调、想+做协同才稳"——是可放心引用的。

### 2.4 ReAct 的工业化：从字符串解析到原生 Tool Calling

ReAct 提出时（2022-10）LLM **还没有原生 tool calling**——原始实现靠 prompt few-shot 让模型吐出 `Action: Search[...]` 这类字符串，再用正则抽出来执行。OpenAI 在 2023-06 推出 function calling 后，整套 ReAct 协议被 SDK 收编：

| ReAct 原始（2022.10） | 现代 Tool Calling（2023.06+） |
|---|---|
| `Thought:` 自然语言 | 隐式在 reasoning token / system prompt 里，不强制显式输出 |
| `Action:` 字符串 + 正则解析 | 模型直接输出结构化 `tool_calls` JSON |
| `Observation:` 拼回 prompt | `tool_result` 类型 message |
| 自己写 `for step in range(max_steps)` | SDK 自动 loop，直到无 tool_calls |

> **划重点**：今天绝大多数"Tool-Calling Agent" ≈ **工业化 ReAct**。两者不是替代，而是"Prompt 时代 → 结构化时代"的同一套思想。本课程在 AI SDK v6 里看到的 `streamText` + `tools` + `stopWhen: stepCountIs(n)` 多步循环，就是 ReAct loop 的现代实现（AI SDK 细节见 `research/ai-sdk-v6.md` §1/§4）。

### 2.5 ReAct 的"安全阀"与三大踩坑（与 SSP 对齐）

- **必须设步数上限**：对应原始论文的 `max_steps`，在 AI SDK v6 里是 `stopWhen: stepCountIs(8)`（SSP 真实值，见 `code-facts.md` / `ai-sdk-v6.md` §4）。没有上限，模型可能在边界条件上反复调同一个工具，token 烧光。
- **工具描述决定选择质量**：Anthropic *Building Effective Agents* 把"工具描述写不清"列为 Agent 失败的高频原因；工具名/description 是写给模型看的。
- **Observation 必须被读到**：返回结构扁平化、关键字段放外层（SSP 把 `needs_agent` 放最外层就是这个道理）。

### 2.6 ReAct 的"近亲"与进阶（第 03 节延伸阅读用）

- **Reflexion**（[arXiv:2303.11366](https://arxiv.org/abs/2303.11366)，Shinn et al.，NeurIPS 2023）：在 ReAct 之上加"执行后自我反思"——把失败教训用自然语言写进记忆缓冲，下次重试时带着教训跑。适合"可多次重试 + 有成败信号"的任务。
- **ReWOO**（[arXiv:2305.18323](https://arxiv.org/abs/2305.18323)）：与 ReAct"边想边调、每步等观察"相反，ReWOO **先一次性规划出全部推理步骤与工具调用（planner），再批量取观察（worker），最后合成（solver）**，把推理与观察解耦。论文报告在 HotpotQA 上达到约 **5× token 效率**并有准确率提升，且对工具失败更鲁棒。当 ReAct 的"每步都把全历史重发给 LLM"成为成本瓶颈时，ReWOO 是常被引用的替代。

---

## 3. 规划与推理增强模式（Plan / Tree / Reflect）

> 这一组模式服务第 03 节"ReAct 的近亲"与第 27 节"为什么多 Agent 之前先穷尽单 Agent 的规划能力"。

### 3.1 Plan-and-Solve（先规划再求解）

[arXiv:2305.04091](https://arxiv.org/abs/2305.04091)（Wang et al.，ACL 2023）。针对零样本 CoT"漏步/算错"的问题，提出两段式提示：**先让模型把任务拆成子任务并定计划，再按计划执行**。它是"显式规划"思想最轻量的形态——不引入额外 Agent，只改 prompt。

### 3.2 Tree of Thoughts（ToT）

[arXiv:2305.10601](https://arxiv.org/abs/2305.10601)（Yao et al.，NeurIPS 2023）；代码 [princeton-nlp/tree-of-thought-llm](https://github.com/princeton-nlp/tree-of-thought-llm)。

ToT 把"线性 CoT"升级为"**树状搜索**"：每个节点是一个"想法（thought）"，模型可以生成多个分支、对分支自评打分、必要时回溯或前瞻，从而做"全局选择"。论文在 Game of 24、创意写作、Mini Crosswords 三类需要搜索/规划的任务上显著超过 CoT。代价是**多次采样 + 评估，token 成本高**，适合高价值难题。

> 谱系提醒：CoT（线性）→ ToT（树）→ Graph of Thoughts（图）是常被一起讲的"思维拓扑"演进线（综述见 [arXiv:2401.14295](https://arxiv.org/abs/2401.14295)）。

### 3.3 Plan-and-Execute（Planner/Executor 分层）

不是单篇论文，而是被 LangGraph 等框架沉淀成模板的**工程模式**：一个 **Planner**（通常用更强/更贵的 reasoning 模型）先产出多步计划，一个 **Executor**（便宜模型 + 工具）逐步执行，执行中可"重规划（replan）"。它和 ReWOO 的共同点是"把规划与执行解耦"，区别是 Plan-and-Execute 允许中途回到 Planner 改计划。安全实现要点见 [arXiv:2509.08646](https://arxiv.org/abs/2509.08646)（Plan-then-Execute 安全指南）。

> **对 SSP 的意义**（第 04 节）：SSP 是单 Agent，但它的"推理层 vs 执行层"分层，本质上就是"**LLM 负责规划/调度（非确定性），规则引擎负责执行/计算（确定性）**"——这是 Plan-and-Execute 思想在单 Agent 内的体现。LLM 决定"要不要算、追问什么"，`computePlan` 工具 + 24 条规则负责"怎么算"。

### 3.4 LATS（Language Agent Tree Search）

[arXiv:2310.04406](https://arxiv.org/abs/2310.04406)。用蒙特卡洛树搜索把推理（ToT 式）、行动（ReAct 式）、规划统一起来，引入对环境的真实观察与价值反传。属于"重武器"，适合可多次采样评估的高价值决策，工程上落地成本高，课程作为"前沿谱系"提及即可。

---

## 4. Anthropic 工作流 vs Agent：五个组合模式（第 04 / 27 节决策框架）

来源：Anthropic *Building Effective Agents*（Schluntz & Pagnoni，[2024-12](https://www.anthropic.com/engineering/building-effective-agents)；配套页 [resources.anthropic.com/building-effective-ai-agents](https://resources.anthropic.com/building-effective-ai-agents)）。这篇是 2024 年底"行业第一次系统反思'别上来就多 Agent'"的代表，被 Cloudflare、LangGraph 等反复引用。

核心区分（转述）：

- **工作流（Workflow）**：LLM 和工具被**预定义的代码路径**编排。
- **Agent**：LLM **在运行时自己决定**流程与工具用法。

五个"从便宜到贵"的组合模式（§1.2 已列），外加第六类"完全自主 Agent"。文章的关键工程建议（转述）：

1. **能用简单方案就别上 Agent**——先穷尽单次 prompt、再 workflow、最后才自主 Agent。
2. **工具集保持精简**——官方建议把工具数量控制在小集合（课程口径"3-5 个"，SSP 正好 3 个，见第 04 节 §2.4）。
3. **用框架前先理解底层代码**——原文大意："若用框架，务必理解其底层运作"（转述，未逐字引用）。

> **写作映射**：第 04 节讲"四层是事实标准"时，可引用本文"workflow vs agent"的区分作为权威背书；第 27 节讲"先把单 Agent 做到 95 分"时，可引用"完全自主 Agent 是最后手段"。

---

## 5. 多 Agent 协作模式对比（第 27 节核心追溯源）

### 5.1 Anthropic 多 Agent 研究系统：最具说服力的一组数字

来源：Anthropic *How we built our multi-agent research system*（[2025-06](https://www.anthropic.com/engineering/multi-agent-research-system)；Simon Willison 摘要 [simonwillison.net](https://simonwillison.net/2025/Jun/14/multi-agent-research-system/)）。

关键事实（转述）：

- **架构**：orchestrator-worker（编排者-工人）。一个 **lead agent（Claude Opus 4）** 分析查询、制定策略，**派生多个并行 subagent（Claude Sonnet 4）**，每个 subagent 有自己独立的上下文窗口，各查一条线索。
- **性能**：在内部 research 评测上，该多 Agent 配置比单 Agent Claude Opus 4 **高 90.2%**。
- **成本**：消耗 token 约为普通 chat 的 **15×**。
- **归因**：性能差异很大程度由"token 用量差异"解释——多 Agent 之所以更好，主要是"看得更多/想得更多/写得更多"，不是某种神奇的"协作智慧"。
- **失败案例**：单 Agent 在"找全 S&P 500 IT 公司董事会成员"这类 breadth-first 任务上会失败，多 Agent 靠并行分解能成功。

> **判断口径**（第 27 节直接用）：你愿意为单次任务多付约 15× 成本，换约 90% 质量提升吗？只有当**任务价值 ≫ 15× token 成本**时才划算。

### 5.2 六种协作拓扑（逐个 + 适用/不适用）

| 模式 | 结构 | 适合 | 不适合 / 风险 | 代表实现 |
|---|---|---|---|---|
| **Supervisor** | 1 中心 + N worker | 路由准确度敏感、好调试 | Supervisor 是单点瓶颈，每步过它一次 | LangGraph `langgraph-supervisor`；Anthropic lead+subagent |
| **Hierarchical** | 多层 Supervisor | 超复杂分层任务 | 层数深 → 路由调用 token 爆 | LangGraph 分层图 |
| **Swarm** | 点对点 handoff | 各自维护 context、要快 | handoff 决策分散、易"踢皮球"/循环 | LangGraph `langgraph-swarm`；OpenAI Swarm（思想） |
| **Sequential** | A→B→C 串行 | 极简、可预测、易测 | 错误传播、不能并行 | 任意框架（本质 prompt chaining） |
| **Debate** | N agent 互辩取共识 | 高赌注、对错可验证 | N×轮数×token，最贵之一 | Du et al. arXiv:2305.14325 |
| **Map-Reduce** | 切片→并行→reduce | breadth-first、context 装不下 | reducer 设计难、并发计费高 | LangGraph `Send`；Anthropic 研究系统 |

**Debate 模式补充**：Du et al. *Improving Factuality and Reasoning in Language Models through Multiagent Debate*（[arXiv:2305.14325](https://arxiv.org/abs/2305.14325)，ICML 2024）。多个模型实例各自作答、互看后修订、多轮收敛，被称为"society of minds（群智）"。论文报告它能提升数学/策略推理并降低事实性幻觉。代价是成本随"Agent 数 × 轮数"线性上涨，只在"对错可被外部验证"时划算。

> **分层省钱实战**：Supervisor/Planner 用更强的 reasoning 模型，Worker 用便宜模型——Anthropic 研究系统的 lead(Opus)+subagent(Sonnet) 就是这种分层。课程示例里"Supervisor 用 GPT-5、Worker 用 GPT-5-mini"是同一思路（模型选型细节交由 `research/model-selection-2026.md`）。

### 5.3 多轮对话与"踢皮球"的隐性成本

第 27 节引用的"所有顶级 LLM 多轮性能比单轮平均下降约 39%"属**二手研究素材结论**——写作时标注为"研究综述口径，非官方一手数字"。其机制（error propagation 错误传播 + context loss 上下文丢失）是业界共识，可定性引用。多 Agent 的每次 handoff 都相当于一轮"LLM↔LLM 对话"，因此该惩罚在多 Agent 里被放大。

---

## 6. 多 Agent 通信 / handoff 模式

### 6.1 OpenAI：Swarm 退役，Agents SDK 接棒

- **OpenAI Swarm**：2024 年的**实验性**多 Agent 编排库，核心两原语是 `Agent` 与 `handoff`（一个 Agent 通过返回另一个 Agent 对象交出控制权，框架切换活跃 Agent 并保留对话历史）。**2025-03 被弃用**。
- **OpenAI Agents SDK**：Swarm 的**生产级继任者**（2025 年发布），保留 handoff 思想，补上 guardrails（护栏）、sessions（会话）、tracing（追踪）、MCP 工具接入等。Python 优先（亦有 JS/TS 版本），默认基于 OpenAI Responses API。
- 来源：[OpenAI orchestration & handoffs 文档](https://developers.openai.com/api/docs/guides/agents/orchestration)、[cookbook: orchestrating agents](https://cookbook.openai.com/examples/orchestrating_agents)；弃用时间二手核实一致（[augmentcode](https://www.augmentcode.com/guides/swarm-vs-supervisor)）。

handoff 的两个关键陷阱（转述自社区实战，第 27 节已采纳）：

1. **循环 handoff**：A→B→A→B，需靠 `max_steps` 兜底 + prompt 写清交接条件。
2. **context 膨胀**：每次 handoff 带全部历史，建议交接时主动 summarize。

> ⚠️ 写作避坑：OpenAI 在 2025-2026 还推出了 **AgentKit**、并对 Agents SDK 做了"下一代"演进（加 approvals、resume 等）。课程**只需讲到"Swarm 退役 → Agents SDK 是 handoff 的生产实现"**这个稳定结论即可，避免追逐尚在快速变动的产品线命名。

### 6.2 Anthropic：Claude Agent SDK（注意改名）

- **改名事实**：原 **Claude Code SDK** 于 **2025-09-29 改名为 Claude Agent SDK**，文档从 Claude Code 区独立出来，反映它"不止用于编码、是通用 Agent runtime"的定位。来源：Anthropic 官方 [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)、[迁移指南](https://docs.claude.com/en/docs/claude-code/sdk/migration-guide)。
- **能力**：内置 agent loop、工具层、上下文管理、**subagents（子代理）**、hooks、MCP 接入。适合"在自己的文件系统/服务上跑生产 Agent"。
- 写作提醒：第 27 节如提到 Anthropic 侧的多 Agent 落地，**用"Claude Agent SDK（原 Claude Code SDK）"全称一次**，避免读者把它和"Claude Code（产品）"混淆。

---

## 7. A2A（Agent-to-Agent）协议现状（第 27 节核心追溯源）

### 7.1 事实基线

- **定位**：Agent2Agent（A2A）是一个**开放标准**，让"用不同框架、不同厂商构建的、互相不透明（opaque）的 Agent"之间能发现彼此、交换结构化任务、协作，而**不暴露各自的内部状态、记忆、工具实现**。
- **治理**：由 **Google 发起（2025-04 Cloud Next）**，随后**捐给 Linux Foundation**。仓库从 `google/A2A` 迁到 `a2aproject/A2A`。
- **版本**：**当前稳定版 v1.0**（官网 [a2a-protocol.org/latest](https://a2a-protocol.org/latest/)、[What's New in v1.0](https://a2a-protocol.org/latest/whats-new-v1/)）。
- **采用**：Linux Foundation 2026 年初通报 A2A **首年即超 150 家组织参与**，落地于供应链、金融、保险、IT 运维等垂直领域并进入企业生产（[LF 新闻稿](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)）。

> ⚠️ 与第 27 节现稿对齐：现稿写"2025.07.31 v0.3""稳定版 v1.0.0"。**v0.3 → v1.0 的演进方向正确**；但具体小版本日期请以官网为准，本报告**只锁定"当前 v1.0、Google 发起、已捐 LF、150+ 组织"这几个一手可核实点**，建议正文淡化精确小版本日期以免过期。

### 7.2 四个核心概念

| 概念 | 是什么 |
|---|---|
| **Agent Card** | 一份 JSON 元数据，发布在 well-known URL（如 `/.well-known/agent.json` 一类约定路径）。描述身份、能力、技能、服务端点、认证要求——让 Agent **像网站一样可被发现**。 |
| **Task** | 任务生命周期单元（`send` / `get` / `cancel`），有状态流转，支持长任务的实时流式更新与异步推送（webhook）。 |
| **Transport** | JSON-RPC 2.0 / gRPC / HTTP+JSON(REST) 三选一；都支持流式（SSE / gRPC streams）。 |
| **认证** | API Key / HTTP Basic / Bearer / OAuth 2.0 / OIDC / mTLS 等企业级方案。 |

来源：[A2A specification](https://a2a-protocol.org/latest/specification/)、[llms.txt 能力摘要](https://a2a-protocol.org/llms.txt)。

### 7.3 A2A vs MCP（互补不竞争）

| 维度 | MCP（Model Context Protocol） | A2A（Agent to Agent） |
|---|---|---|
| 解决 | Agent ↔ 工具/数据（**垂直**） | Agent ↔ Agent（**水平**） |
| 类比 | "USB-C for tools" | "HTTP for agents" |
| 单元 | tool / resource / prompt | agent card / task / message |
| 提出方 | Anthropic（2024-11） | Google（2025-04） |
| 当前版本 | spec 2025-11-25（stable） | v1.0 |

典型组合：`Planner Agent ──A2A──→ Domain Agent ──MCP──→ 数据库/API/工具`。A2A 把跨组织的 Agent 连起来，MCP 让每个 Agent 各自连自己的工具。MCP 细节见 `research/mcp.md` §7。

### 7.4 何时用 / 不用 A2A

- **该用**：跨组织 Agent 互通（B2B）、内部多团队各自维护 Agent 需标准接入、面向未来的 Agent Marketplace。
- **不该用**：单产品内的 Agent 协作（直接用 LangGraph/CrewAI 即可）、没有跨组织需求时（引入即过度工程）。
- 第 27 节口径正确：A2A 真正的颠覆性在"Agent Card 让 Agent 可发现"，但"今天绝大多数项目还没到这一步，先把内部 Agent 跑稳"。

---

## 8. 主流 Agent 框架现状综述（第 27 节框架对比追溯源）

> 截至 2026-Q1 的格局核实。框架迭代快，"成熟度/痛点"为综合一手文档 + 二手评测的归纳，写作时标注"截至 2026 初"。

| 框架 | 语言/生态 | 多 Agent 范式 | 状态管理 | 定位 / 适用 | 出处 |
|---|---|---|---|---|---|
| **LangGraph** | Python / JS-TS | 全部（图节点）；prebuilt `create_react_agent`、`langgraph-supervisor`、`langgraph-swarm`、`Send` API 动态 fan-out | checkpointing、time-travel、durable | 生产级、要可观测/可中断/可回放的复杂状态机 | [LangGraph 文档](https://docs.langchain.com/oss/python/langgraph/workflows-agents) |
| **CrewAI** | Python | role-based crew、sequential、hierarchical | 任务输出顺序传递 | 最快从想法到"3-5 角色协作"原型 | 二手评测 |
| **OpenAI Agents SDK** | Python（+JS/TS） | handoff（Swarm 继任）、guardrails、sessions、tracing | 内置 tracing/session | 已在 OpenAI 生态、要 handoff + 内置追踪 | [OpenAI 文档](https://developers.openai.com/api/docs/guides/agents/orchestration) |
| **Microsoft Agent Framework** | .NET / Python | orchestrator、group chat、handoff | 内置 | **AutoGen + Semantic Kernel 合并而来**，AutoGen 的官方继任 | 二手核实（[ampcome](https://ampcome.com/post/top-7-ai-agent-frameworks-in-2025)） |
| **AutoGen** | Python | conversation-driven（actor model，v0.4 重写） | 内存对话历史 | 研究/已有代码库；新项目转向 Agent Framework | 二手 |
| **Google ADK** | Python / Java | 原生 A2A 支持 | 内置 | Google 生态 + 想用 A2A | 二手 |
| **Vercel AI SDK** | TypeScript | routing、orchestrator-workers、`ToolLoopAgent`、Workflow DevKit | WDK 持久化 | **TS/Next.js 项目（如 ssp-web）首选** | 见 `research/ai-sdk-v6.md` |
| **Pydantic AI** | Python | type-safe agents | — | 类型安全偏好的生产 Agent | 二手 |

**重要更新（现稿未覆盖，建议补进第 27 节）**：

1. **Microsoft 把 AutoGen 与 Semantic Kernel 合并为统一的 Microsoft Agent Framework**——现稿表格里的"AutoGen v0.4"应注明"其能力正并入 Microsoft Agent Framework，新项目优先后者"。
2. **Google ADK v1.0 原生支持 A2A**——讲 A2A 落地时可作为"框架已内建协议支持"的例证。
3. **OpenAI Swarm 已退役**——现稿已正确写到，保持。

**选型建议**（综合，非营销）：

- 产品级、要 checkpoint/人工干预/流式 → **LangGraph**
- 团队不熟 LLM 工程、想快速搭多角色 → **CrewAI**
- 在 OpenAI 生态、要 handoff + tracing → **OpenAI Agents SDK**
- .NET 或微软栈 → **Microsoft Agent Framework**
- TypeScript / Next.js（ssp-web） → **Vercel AI SDK（+ Workflow DevKit）**

> Anthropic *Building Effective Agents* 的告诫仍然成立（转述）：用框架前先理解其底层；否则 bug 出现时你 debug 不动框架，框架就会反过来 debug 你。第 27 节"CrewAI 加到 5 个 role 后 token 暴涨"的反例正是这个教训的实例。

---

## 9. 单 Agent vs 多 Agent 决策树（第 27 节核心图追溯源）

把"该不该上多 Agent"做成可判定的决策流：

```
我要不要上多 Agent？
│
├─ 任务能一句 prompt 解决吗？──── 能 → 单次 LLM 调用（别上 Agent）
│
├─ 需要外部信息/工具吗？──────── 不需要 → CoT / reasoning model（纯推理）
│
├─ 步骤数固定吗？──────────────── 固定 → Prompt Chaining / Workflow（不是 Agent）
│
├─ 用 Tool-Calling 单 Agent（ReAct）
│     ├─ 工具 ≤ ~5、步数 < ~10 ─────────── 单 Agent ✅（绝大多数停在这）
│     ├─ 子任务可并行 ───────────────────── Parallelization / Map-Reduce
│     ├─ 任务 breadth-first 且价值 ≫ 15×token ─ Supervisor / orchestrator-worker 多 Agent
│     └─ 对错可外部验证、且高赌注 ────────── Debate
│
└─ 需要跨组织/跨厂商 Agent 通信？──── 是 → 在多 Agent 之上加 A2A 协议层
```

**三条硬判据（满足才考虑多 Agent，来自 Anthropic 研究系统经验）**：

1. **breadth-first**：宽度优先探索（研究 50 个网站/100 篇论文）。
2. **independent subtasks**：子任务弱耦合、可独立并行。
3. **价值 ≫ 15× token 成本**：单次任务值得付 15 倍代价。

**三个"假多 Agent"信号（命中即应收回单 Agent）**：

1. 没有真并行（其实是串行 → prompt chaining）。
2. 没有独立 context（共享同一份 prompt+历史 → 一个 Agent 多角色切换）。
3. 没有失败隔离（一个挂全崩 → 没享受到 "fail one, retry one"）。

> **对 SSP 的结论**（第 27 节）：SSP 问题边界窄（社保），单 Agent + `stepCountIs(8)` 已解决 95% 问题，三条硬判据一条都不满足 → **单 Agent 是终点不是中间站**。更轻量的"虚拟分工"可用 AI SDK v6 的 `prepareStep`（同一 Agent 不同 step 换 system prompt / active tools），享受关注点分离又不付 15× token。

---

## 10. 章节追溯映射

| 章节文件 | 标题（节号） | 本报告对应小节 |
|---|---|---|
| `04-react-loop.md` | 第 03 节 ReAct 循环 | §2 ReAct 详解（全部）、§2.6 Reflexion/ReWOO、§3.1 Plan-and-Solve、§1.1 速查 |
| `05-four-layer-architecture.md` | 第 04 节 SSP 四层架构鸟瞰 | §3.3 Plan-and-Execute（推理层 vs 执行层）、§4 workflow vs agent（四层是事实标准的背书） |
| `28-multi-agent.md` | 第 27 节 多 Agent 协作 | §4 五模式、§5 六拓扑 + Anthropic 数字、§6 handoff/SDK、§7 A2A、§8 框架、§9 决策树 |

---

## 11. 写作对齐核对清单（防幻觉 / 防过期）

写 03 / 04 / 27 时，凡引用以下点务必与本报告一致：

- ✅ ReAct = **Yao et al. arXiv:2210.03629, ICLR 2023**；提出于 2022-10，早于 OpenAI function calling（2023-06）。
- ✅ ReAct 论文 benchmark 具体百分比 **引用前回核原文表格**（本报告只为定性结论背书）。
- ✅ Reflexion = **arXiv:2303.11366**；Tree of Thoughts = **arXiv:2305.10601**；ReWOO = **arXiv:2305.18323**；Plan-and-Solve = **arXiv:2305.04091**；多 Agent Debate = **arXiv:2305.14325**。作者/年份见上文，勿张冠李戴。
- ✅ Anthropic 多 Agent 数字：**+90.2% / ~15× token / orchestrator-worker / lead Opus 4 + subagent Sonnet 4**，来自 2025-06 官方博客；"性能差异主要由 token 用量解释"是官方归因。
- ✅ Anthropic 五工作流模式：**prompt chaining / routing / parallelization / orchestrator-workers / evaluator-optimizer**，"自主 Agent 是最后手段"。
- ✅ A2A：**Google 发起（2025-04）→ 捐 Linux Foundation → 当前 v1.0 → 150+ 组织**；四概念 Agent Card / Task / Transport / 认证；与 MCP 互补。
- ✅ OpenAI **Swarm 2025-03 弃用 → Agents SDK 继任**；handoff 思想保留。
- ✅ Claude **Code SDK → 2025-09-29 改名 Agent SDK**，支持 subagents；用全称避免与产品 Claude Code 混淆。
- ⚠️ **框架命名/版本是快速变动区**：Microsoft Agent Framework（AutoGen+SK 合并）、OpenAI AgentKit、ADK v1.0+A2A 等——正文**只写已稳定的结论**，精确小版本号/发布日尽量淡化或标"截至 2026 初"。
- ⚠️ "75% 项目失败""多轮 −39%""server 总数"等数字均为**二手统计**，正文必须标注口径与来源，不作确定事实。
- ⚠️ 术语对齐 `style-guide.md` §7：用"智能体/Agent""推理（Reasoning，ReAct 的 R）""工具调用 Tool Calling""上下文 Context""代理协议 A2A""模型上下文协议 MCP"；勿用"代理人""函数调用""思考"（指 Reasoning 时）。
- ⚠️ 版本措辞硬规则（§3.3）：本报告对"AI SDK v6""A2A v1.0""spec 2025-11-25"等是**第三方库/协议版本**，可写；但章节正文**不得**出现指代"本课程"的版本对比措辞。

---

## 12. 引用来源（可信链接）

**论文（arXiv 一手）**：

- [ReAct: Synergizing Reasoning and Acting in Language Models（arXiv:2210.03629）](https://arxiv.org/abs/2210.03629) · 代码 [ysymyth/ReAct](https://github.com/ysymyth/ReAct)
- [Chain-of-Thought Prompting（arXiv:2201.11903）](https://arxiv.org/abs/2201.11903)
- [Reflexion: Language Agents with Verbal Reinforcement Learning（arXiv:2303.11366）](https://arxiv.org/abs/2303.11366)
- [Tree of Thoughts: Deliberate Problem Solving with LLMs（arXiv:2305.10601）](https://arxiv.org/abs/2305.10601) · 代码 [princeton-nlp/tree-of-thought-llm](https://github.com/princeton-nlp/tree-of-thought-llm)
- [ReWOO: Decoupling Reasoning from Observations（arXiv:2305.18323）](https://arxiv.org/abs/2305.18323) · 代码 [billxbf/ReWOO](https://github.com/billxbf/ReWOO)
- [Plan-and-Solve Prompting（arXiv:2305.04091）](https://arxiv.org/abs/2305.04091)
- [Improving Factuality and Reasoning through Multiagent Debate（arXiv:2305.14325）](https://arxiv.org/abs/2305.14325)
- [Language Agent Tree Search / LATS（arXiv:2310.04406）](https://arxiv.org/abs/2310.04406)
- [Demystifying Chains, Trees, and Graphs of Thoughts（arXiv:2401.14295）](https://arxiv.org/abs/2401.14295)
- [A Guide to Secure Plan-then-Execute Implementations（arXiv:2509.08646）](https://arxiv.org/abs/2509.08646)

**官方工程博客 / 文档（一手）**：

- [Anthropic — Building Effective Agents（2024-12）](https://www.anthropic.com/engineering/building-effective-agents) · [配套页](https://resources.anthropic.com/building-effective-ai-agents)
- [Anthropic — How we built our multi-agent research system（2025-06）](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Anthropic — Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) · [改名迁移指南](https://docs.claude.com/en/docs/claude-code/sdk/migration-guide)
- [OpenAI — Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration) · [Cookbook: Orchestrating Agents](https://cookbook.openai.com/examples/orchestrating_agents)
- [A2A Protocol — 官网](https://a2a-protocol.org/latest/) · [Specification](https://a2a-protocol.org/latest/specification/) · [What's New in v1.0](https://a2a-protocol.org/latest/whats-new-v1/) · [仓库 a2aproject/A2A](https://github.com/google/A2A)
- [Linux Foundation — A2A 首年 150+ 组织新闻稿](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- [LangGraph — Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) · [langgraph-supervisor](https://github.com/langchain-ai/langgraph-supervisor-py) · [langgraph-swarm](https://github.com/langchain-ai/langgraph-swarm-py)

**二手（仅作格局/趋势，引用须标注口径）**：

- [Simon Willison — Anthropic 多 Agent 系统摘要](https://simonwillison.net/2025/Jun/14/multi-agent-research-system/)
- [augmentcode — Swarm vs Supervisor（Swarm 2025-03 弃用）](https://www.augmentcode.com/guides/swarm-vs-supervisor)
- [ampcome — 2026 框架对比（AutoGen+SK 合并、ADK+A2A）](https://ampcome.com/post/top-7-ai-agent-frameworks-in-2025)
- [futureagi — Best Multi-Agent Frameworks 2026](https://futureagi.com/blog/best-multi-agent-frameworks-2026/)
- [digitalapplied — Claude Agent SDK 迁移](https://www.digitalapplied.com/blog/claude-agent-sdk-migration-playbook-from-claude-code-sdk-2026) · [A2A 通信指南](https://www.digitalapplied.com/blog/google-a2a-protocol-agent-to-agent-communication-guide)

> 写作铁律：模式名/论文年份/协议版本 → 回链一手源；生态规模/失败率/性能百分比 → 标注二手 + 口径 + 日期，不得作为确定事实陈述。本报告与 `research/ai-sdk-v6.md`（AI SDK v6 多步循环 = ReAct 工业化）、`research/mcp.md`（MCP vs A2A）、`research/model-selection-2026.md`（Planner/Worker 分层模型选型）互为补充。
