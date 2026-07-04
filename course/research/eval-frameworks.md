# 研究报告 · Eval 框架（LLM / Agent 评测）

> **用途**：本报告是以下两节重写时的技术追溯源——
> - 第 22 节《评测体系：三层评测模型与 LLM-as-Judge》（文件 `23-evaluation.md`）
> - 第 23 节《回归测试与 CI 门禁：让 Agent 不变蠢》（文件 `24-regression-testing.md`）
>
> 这两节里凡是"框架名/定位、是否开源、是否支持 LLM-as-Judge、CI 集成方式、协议或方法名、版本号"类技术声明，都应能回链到本报告对应条目（对齐 Requirements 2.3 / 2.4）。
>
> **调研日期**：2026-02-28（框架能力/许可证以官方仓库与官方文档一手核实；价格/估值/榜单/市占类数据标注为二手并给链接，写作引用须带口径与日期）。
>
> **配套项目版本基线**（来自 `ssp-web` / `code-facts.md`）：`ssp-web` 评测栈以 **Promptfoo + GitHub Actions** 为推荐基线，数据库已有 `cases` / `tests` / `publishes` 三张表作为最小评测系统底座（见 `code-facts.md` §11、`src/lib/db/schema.ts`）。
>
> **合规说明**：本报告内容为**转述与归纳**，非原文照搬；单一来源连续引用不超过 30 词；论文一律给 arXiv 链接。Content was rephrased for compliance with licensing restrictions。

---

## 0. 一页速查：框架对比矩阵（写作直接抄，版本/数字回链下文）

| 框架 | 定位 | 语言/形态 | 开源 & 许可证 | 托管 / 自托管 | LLM-as-Judge | CI 集成方式 | 最适用场景 |
|---|---|---|---|---|---|---|---|
| **Promptfoo** | prompt / agent / RAG 评测 + red-team | TS / Node，CLI + 库 | ✅ **MIT** | 本地优先（local-first），有可选企业版 | ✅ 内置 `llm-rubric` / `factuality` / pairwise | ✅ 官方 `promptfoo-action`（GitHub Actions），YAML 声明式，原生 PR 门禁 | TS/JS 栈、要快速在 CI 跑 prompt 回归 + 安全扫描 |
| **DeepEval** | LLM 应用单元测试 + 50+ 指标 | Python，类 Pytest | ✅ **Apache-2.0** | 开源自托管 + Confident AI 平台（托管 dashboard） | ✅ G-Eval / DAG / 多种 metric 用 judge | ✅ `deepeval test run`（接 Pytest），每次 push/PR 跑 | Python 栈（FastAPI/LangChain/LlamaIndex），要指标库丰富 |
| **Braintrust** | 评测 + 可观测 + 发布门禁一体平台 | 平台（TS/Python SDK） | ⚠️ 平台**闭源商业**；`autoevals` 评分库开源 | 托管 SaaS + 企业自托管/混合 | ✅ 平台内置 + `autoevals` LLM judge | ✅ 把 eval 接 CI，作为 release gate；生产 trace→eval | 团队级、要把生产 trace 与离线 eval 打通 + 发布卡口 |
| **Inspect (Inspect AI)** | 前沿模型 / Agent 评测框架 | Python | ✅ **MIT**（UK AISI + Meridian Labs） | 开源自托管，含 Inspect View 本地可视化 | ✅ `model_graded_qa` / `model_graded_fact` 等 scorer | ✅ CLI `inspect eval`，读 log JSON 提分决定 pass/fail | 标准化 benchmark、Agent 轨迹、安全/能力评测 |
| **Langfuse (evals)** | LLM 可观测 + 数据集 + 评测 | 平台（多语言 SDK） | ✅ 核心 **MIT**（含托管 LLM-judge、标注队列、playground） | 托管云 + 自托管（Docker/K8s） | ✅ 托管 LLM-as-Judge（含 2026 新增 categorical 分类评分） | ✅ 数据集 run + SDK 断言接 CI；偏「trace + 实验」 | 已用 Langfuse 做 trace，要顺手做数据集实验/线上评测 |
| **OpenAI Evals** | 评测框架 + benchmark 注册表 | Python，YAML 注册 | ✅ **MIT** | 开源自托管（亦对接 OpenAI 平台 Evals） | ✅ `ModelBasedClassify` 类模板 | ⚠️ 可脚本化进 CI，但无「开箱即用」官方 Action | 想要 benchmark 注册表/复用社区评测集 |
| **Ragas** | **RAG 专用**评测 | Python | ✅ **Apache-2.0** | 开源自托管 | ✅ 指标内部用 LLM 打分（faithfulness 等） | ✅ 接 Pytest / CI；常配 LangChain/MLflow | 只评 RAG 检索+生成质量（faithfulness/context precision 等） |

> ⚠️ **写作铁律**：
> - "是否开源/许可证/CLI 命令/CI 机制"类 → 已回链官方一手源，可放心写。
> - "价格/估值/市占/榜单排名"类（如 Braintrust Pro $249/mo、$800M 估值、LangSmith $39/seat）→ **全是二手统计**，正文若引用务必标注"二手 + 来源 + 日期"，不作确定事实。
> - Promptfoo 是 **ssp-web 推荐基线**（已在第 23 节落地 `.github/workflows/eval.yml`），其余框架按"对照/选型"介绍，**不要**声称 ssp-web 用了它们。

---

## 1. 为什么需要 Eval 框架：评测不是测试

传统软件测试假设**确定性**——`add(1,2)` 永远等于 `3`。但 LLM 输出是**概率性**的：同一 prompt 多次运行可能产出多种说法，无法简单 `expect(output).toBe(...)`。所以业界把面向 LLM 应用的质量验证称为「评测（Eval / Evaluation）」而非「测试（Test）」，核心区别是**通过率/分数阈值**而非完全相等，评分方式是**规则匹配 + 相似度 + LLM 判官**的组合。

Eval 框架要解决的工程问题归纳为三类：

1. **可重复**：把"人工肉眼看几十条输出"换成结构化、可重放的评测集（golden dataset）。来源：[Promptfoo 文档](https://www.promptfoo.dev/docs/intro)、[DataCamp Promptfoo 教程](https://www.datacamp.com/tutorial/promptfoo-tutorial)。
2. **可量化**：把"答得好不好"拆成可计算 metric（断言通过率、faithfulness、tool 调用正确率、latency、cost）。
3. **可卡口**：把评测接进 CI/CD，让不达标的 PR **自动 fail / block merge**，防止"改一行 prompt 就让通过率从 95% 掉到 73%"的事故（第 22/23 节开场故事）。

Vercel 把这套思路概括为「**评测是新的 TDD（Eval-Driven Development）**」（[Vercel — Eval-Driven Development](https://vercel.com/blog/eval-driven-development-build-better-ai-faster)，转述）。

---

## 2. 主流框架逐个拆解

### 2.1 Promptfoo（ssp-web 推荐基线）

- **定位**：开源、本地优先（local-first）的 LLM 评测与 red-teaming 框架，用声明式 YAML 定义 prompt、provider、测试用例与断言（assertion）。支持大量模型 provider，可作 CLI、Node 库、或接 CI/CD 运行，结果可在浏览器查看。来源：[Promptfoo FAQ](https://www.promptfoo.dev/docs/faq/)、[intro](https://www.promptfoo.dev/docs/intro)、[GitHub](https://github.com/promptfoo/promptfoo)。
- **许可证**：**MIT**（[Promptfoo Contributing](https://www.promptfoo.dev/docs/contributing)）。
- **LLM-as-Judge**：内置 `llm-rubric`、`factuality`、`model-graded-closedqa` 等断言类型，也支持 pairwise 偏好比较。来源：[LLM as a Judge 指南](https://www.promptfoo.dev/docs/guides/llm-as-a-judge/)。
- **CI 集成（写作重点）**：官方提供 [`promptfoo/promptfoo-action`](https://github.com/promptfoo/promptfoo-action)，在 GitHub Actions 里跑评测并**自动把报告作为 PR comment 贴回**，失败时给 PR 打 ❌。还有 GitLab CI、Jenkins 等模板。来源：[CI/CD 集成](https://www.promptfoo.dev/docs/integrations/ci-cd/)、[GitLab CI](https://www.promptfoo.dev/docs/integrations/gitlab-ci/)。
- **ssp-web 现状**：第 23 节已新增 `.github/workflows/eval.yml`，用 `promptfoo-action@v1` + `PROMPTFOO_PASS_RATE_THRESHOLD: 0.95` + `fail-on-error: true` 做双保险门禁（见 `24-regression-testing.md` §2.1 方案 A，**这是项目真实落地代码**）。

> **看这里 →**：Promptfoo 的最大优势是「**声明式 + CI 模板齐全 + 本地跑不外传数据**」，对 TS/Next.js 项目（ssp-web）几乎零摩擦。它同时覆盖**质量评测**与**安全 red-team**（67+ 攻击插件，二手口径见 [apidog 指南](https://apidog.com/blog/test-llm-applications/)），但红队能力不是本课程重点。

### 2.2 DeepEval（Python 栈首选）

- **定位**：开源 LLM 评测框架，"像 Pytest 但专门为 LLM 应用做单元测试"，提供 50+ 内置 metric（G-Eval、faithfulness、answer relevancy、hallucination、tool correctness 等）。来源：[PyPI deepeval](https://pypi.org/project/deepeval/)、[GitHub](https://github.com/confident-ai/deepeval)。
- **许可证**：**Apache-2.0**（confident-ai/deepeval 仓库）。
- **托管 / 自托管**：开源库可纯本地跑；背后公司 Confident AI 提供托管 dashboard（`deepeval login` 后上报）。
- **LLM-as-Judge**：G-Eval（用 LLM + chain-of-thought 按自定义标准打分）与 DAG（决策树式 judge）是其招牌；多数 metric 内部用 judge 模型。
- **CI 集成**：通过 `deepeval test run tests/`（深度集成 Pytest 的 `assert_test()`）在每次 push/PR 跑 eval，支持单轮/多轮、端到端/组件级。来源：[DeepEval CI/CD 回归测试](https://deepeval.com/docs/evaluation-unit-testing-in-ci-cd)、[Confident AI 文档](https://docs.confident-ai.com/guides/guides-regression-testing-in-cicd)。
- **ssp-web 现状**：**未使用**（ssp-web 是 TS 栈）。第 23 节作为"Python 栈替代方案 B"介绍，引用时标注"示意/对照"。

### 2.3 Braintrust（评测 + 可观测 + 发布门禁一体平台）

- **定位**：商业化的 AI 评测与可观测平台，把**生产 trace、离线评测、CI/CD 质量门禁、人工评审、prompt 实验**整合到同一套工作流。来源：[Braintrust vs Promptfoo](https://www.braintrust.dev/articles/braintrust-vs-promptfoo)、[Braintrust vs Confident AI](https://www.braintrust.dev/articles/braintrust-vs-confident-ai)。
- **开源边界（写作必标）**：**平台本体是闭源商业产品**；但其评分库 [`autoevals`](https://github.com/braintrustdata/autoevals) 开源，提供 LLM-judge 与确定性 scorer（注意：autoevals 评的是单个 span，不评整条 trace）。来源：[autoevals 文档](https://www.braintrust.dev/docs/evaluate/autoevals)。
- **托管 / 自托管**：托管 SaaS 为主，提供企业级**自托管/混合部署**。来源：[best self-hosted AI evals 2026](https://www.braintrust.dev/articles/best-self-hosted-ai-evals-tools-2026)。
- **LLM-as-Judge**：平台内置 + autoevals；2026 普遍用 GPT-5.1 / Claude Sonnet 4.5 这类强模型当 judge（二手口径，见 [Braintrust prompt eval tools 2026](https://www.braintrust.dev/articles/best-prompt-evaluation-tools-2025)）。
- **CI 集成**：把 eval 作为 release gate 接入 CI，并支持「生产 trace → 转评测用例」的闭环。
- **价格（二手）**：起步免费档，Pro 约 **$249/月**（[cekura 拆解](https://www.cekura.ai/blogs/braintrust-pricing)，二手）；免费档额度（如 1M spans/月、10K eval runs）见 [latitude 对比](https://latitude.so/blog/best-ai-agent-evaluation-platforms-2026-comprehensive-comparison)（二手）。**正文引用务必标二手 + 日期**。
- **ssp-web 现状**：**未使用**；第 23 节作为"商业平台档/Vercel 推荐栈（Braintrust + AI Gateway + Vitest）"提及。

### 2.4 Inspect / Inspect AI（标准化 benchmark + Agent 评测）

- **定位**：UK AI Security Institute（AISI）与 Meridian Labs 开发的前沿 AI 评测框架，覆盖 coding、agentic 任务、推理、知识、行为、多模态。核心三件套：**Dataset（数据集）+ Solver（解题器）+ Scorer（评分器）**，用 `@task` 装饰器组装。来源：[Inspect 官网](https://inspect.aisi.org.uk/)、[Tasks 文档](https://inspect.aisi.org.uk/tasks.html)、[llms-full.txt](https://inspect.aisi.org.uk/llms-full.txt)。
- **许可证**：**MIT**（[UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai)）。
- **能力亮点（agent 评测强项）**：200+ 预置 benchmark；灵活的 tool calling（自定义 + MCP 工具，及内置 bash/python/web 浏览等）；**支持 Agent 评测**（内置 agent、多 agent 原语，可跑外部 agent 如 Claude Code、Codex CLI、Gemini CLI）；Docker/K8s 沙箱跑不可信模型代码；web 版 Inspect View 可视化。来源：[llms-full.txt](https://inspect.aisi.org.uk/llms-full.txt)。
- **LLM-as-Judge**：内置 `model_graded_qa` / `model_graded_fact` 等 model-graded scorer。来源：[scorer 参考](https://inspect.aisi.org.uk/reference/inspect_ai.scorer.html)。
- **CI 集成**：CLI `inspect eval evals/xxx.py --model ...`，再用脚本读 `logs/latest.json` 提 score、`sys.exit(0/1)` 决定 pass/fail（第 23 节方案 C 的真实模式）。
- **ssp-web 现状**：**未使用**；第 23 节作为"安全/能力评测档"与"轨迹评测"案例引用。

### 2.5 Langfuse（trace 顺手做 eval）

- **定位**：LLM 可观测平台（trace/监控）+ 数据集 + 评测。2025-06 起把**托管 LLM-as-a-Judge 评测、标注队列、prompt 实验、playground** 开源到 MIT 许可可自托管。来源：[Langfuse 开源公告](https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product)。
- **许可证**：核心 **MIT**（部分企业功能另计）。
- **托管 / 自托管**：托管云 + 自托管（Docker Compose / K8s，v3 架构）。来源：[Langfuse v3 自托管指南](https://jangwook.net/en/blog/en/langfuse-self-hosted-llm-tracing-setup-guide-2026)（二手教程）。
- **LLM-as-Judge**：托管 evaluator；2026-03 新增 **categorical（分类）LLM-as-a-Judge 分数**——judge 从固定类别集里选，存为原生 categorical score。来源：[categorical judge changelog](https://langfuse.com/changelog/2026-03-20-categorical-llm-as-a-judge-scores)。
- **CI 集成**：偏"数据集 run + 实验对比"，可用 SDK 在 CI 里跑数据集断言；强项是「trace + 实验 + 线上评测」打通。来源：[数据集 prompt 实验](https://langfuse.com/changelog/2024-11-22-prompt-experimentation)。
- **ssp-web 现状**：**未使用**；可作为"可观测 + 评测一体"的开源自托管选项介绍。

### 2.6 OpenAI Evals（benchmark 注册表）

- **定位**：评测 LLM / LLM 系统的框架 + 开源 benchmark 注册表（registry），用 YAML 定义 eval、`elsuite` 提供实现。来源：[openai/evals](https://github.com/openai/evals)、[run-evals 文档](https://github.com/openai/evals/blob/main/docs/run-evals.md)。
- **许可证**：**MIT**。
- **LLM-as-Judge**：提供 `ModelBasedClassify` 等 model-graded 模板。
- **CI 集成**：可脚本化进 CI，但**无官方开箱即用 Action**，需自行包脚本提分判定。
- **生态提示**：OpenAI 另有 [`simple-evals`](https://github.com/openai/simple-evals)（轻量 benchmark）、平台侧的 Evals 产品，以及社区同名项目（如 LangChain 的 [`openevals`](https://github.com/langchain-ai/openevals)）——**命名易混，引用时给准确仓库链接**。
- **ssp-web 现状**：**未使用**；作为"基准注册表/复用社区评测集"的对照。

### 2.7 Ragas（RAG 专用）

- **定位**：开源、**专评 RAG**（检索增强生成）的评测框架，核心指标 **faithfulness（忠实度）、answer relevancy（答案相关性）、context precision（上下文精确率）、context recall（上下文召回率）**。来源：[FutureAGI — Ragas 定义](https://futureagi.com/glossary/ragas)、[arXiv:2309.15217 RAGAS 论文](https://arxiv.org/abs/2309.15217)。
- **许可证**：**Apache-2.0**（[explodinggradients/ragas](https://github.com/explodinggradients/ragas)）。
- **指标语义（写作高频引用）**：
  - **faithfulness**：答案里每个 claim 是否被检索到的 context 支撑（≈ 防"在检索结果之上再幻觉"）。
  - **context precision/recall**：检索回来的 chunk 是否"对且全"。
  - 关键认知：faithfulness=1.0 只说明"没在 context 之外编"，**不**保证检索到的就是对的 chunk（需配 context precision 一起看）。来源：[markaicode RAGAS 指标](https://markaicode.com/rag-evaluation-ragas-metrics-production/)、[learnwithparam RAGAS 4 指标](https://www.learnwithparam.com/blog/ragas-evaluation-rag-pipelines-practical-guide)。
- **CI 集成**：接 Pytest / CI，常配 LangChain、MLflow。来源：[RAGAS + MLflow 教程](https://safjan.com/ragas-mlflow-rag-evaluation-tutorial/)（二手）。
- **ssp-web 现状**：ssp-web 主链路非 RAG（结构化数据来自规则引擎）；第 26 节《RAG》如涉及检索质量评测可引用 Ragas，标注"示意/对照"。

---

## 3. LLM-as-Judge 方法论（第 22 节核心追溯源）

### 3.1 出处与可行性

- **奠基论文**：*Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*，Zheng et al.，[arXiv:2306.05685](https://arxiv.org/abs/2306.05685)，NeurIPS 2023。核心结论（转述）：强 LLM judge（如 GPT-4）与人类偏好的一致率可达 **80% 以上**，与"人类之间的一致率"相当，因此 LLM-as-Judge 是一种**可规模化、可解释**的人类偏好近似。
- **何时用**：当 exact-match 太脆（开放式输出：有用性、语气、事实性、安全、RAG 忠实度、A/B 偏好）时，用 LLM judge。来源：[Promptfoo LLM-as-Judge 指南](https://www.promptfoo.dev/docs/guides/llm-as-a-judge/)。

### 3.2 三种评分形态

| 形态 | 做法 | 适用 | 注意 |
|---|---|---|---|
| **单点打分（pointwise / rubric）** | judge 按 rubric 给单个回答打分（如 1–5 或 1–10） | 大批量、要绝对分数 | 数值分**稳定性差**（同输出今天 4 分明天 8 分），建议小刻度 + 明确 rubric |
| **成对比较（pairwise）** | judge 看 A/B 两个回答，判谁更好或平局 | 比较两版 prompt / 两个模型 | 受 **position bias** 影响，必须 both-orderings |
| **win-rate / Elo** | 多次 pairwise 汇总成胜率或 Elo 等级分 | 模型/版本横向排名 | Chatbot Arena 即此范式（[arXiv:2403.04132](https://arxiv.org/html/2403.04132v1)） |

### 3.3 rubric 设计要点

1. **小刻度优于大刻度**：1–10 的数值分波动大；改用 1–4 或带明确锚点的分级，并要求 judge 先给 reasoning 再给分（chain-of-thought 打分，DeepEval G-Eval 即此思路）。
2. **给 reference / 标准答案**：有 ground truth 时把它喂给 judge（reference-guided），一致性显著提升。
3. **rubric 要"可判定"**：把"答得好"拆成可勾选的具体条目（是否覆盖关键字段、是否未幻觉、是否给出依据），而非笼统打分。
4. **judge 模型与被评模型解耦**：用不同（通常更强）的模型当 judge，缓解 self-enhancement bias（见 §3.4）。

### 3.4 常见偏差与缓解（写作必带，第 22 节）

LLM judge 有**系统性偏差**，不审计就会把"测量假象"当成"真实提升"。来源：[Zheng et al. arXiv:2306.05685](https://arxiv.org/abs/2306.05685)、[系统性 bias 缓解综述 arXiv:2604.23178](https://arxiv.org/abs/2604.23178)、[JudgeLM arXiv:2310.17631](https://arxiv.org/abs/2310.17631)。

| 偏差 | 表现 | 缓解 |
|---|---|---|
| **位置偏差（position bias）** | pairwise 里排前面的回答更易"赢" | **both-orderings**：(A=新,B=旧) 与 (A=旧,B=新) 各跑一次，两次都赢才算赢（swap augmentation） |
| **冗长偏差（verbosity/length bias）** | 更长的回答分更高，不管对不对 | 控制长度对照、在 rubric 里显式声明"长度不加分"、做 length-controlled win-rate |
| **自我增强偏差（self-enhancement bias）** | judge 偏爱与自己同源/同风格的输出 | judge 与被评模型换不同家；多 judge 投票 |
| **格式/知识偏差** | 偏好特定格式；judge 自身知识盲区 | reference 支持、reference drop、format 归一化（JudgeLM 技术） |
| **分数不稳定** | 同输入多次跑分数漂移 | 小刻度 + 取多次中位数 + 固定 temperature |

> **校准底线（第 23 节门禁前提）**：上生产门禁前，必须用人工标注集校准 judge——若 judge 与人工的一致性（如 Cohen's kappa）**< 0.6**，这个 judge 不能当门禁，否则会误杀好 PR。来源：第 23 节现稿 §2.5（与本报告方法论一致）。

> **避免循环论证**：用被评模型同款当 judge、或用同一 prompt 既生成又评分，等于"自己给自己判卷"。务必让 judge 独立。

---

## 4. Agent 评测特有难点（第 22/23 节 + 第 27/28 节交叉）

普通 LLM 评测看"最终答案对不对"；**Agent 评测必须看"过程"**——一个 agent 可能跑 12 步（检索、决定下一步搜什么、调外部 API、工具返回异常时回环），每步都是决策点。只看最终输出会漏掉"输出对但过程坏"的情况（如跳过了安全校验、漏写了数据库）。来源：[评测 Agent 轨迹而非只看结果](https://tianpan.co/blog/2026-02-07-evaluating-ai-agents-trajectories-not-just-outcomes)、[NVIDIA — AI agent evaluation](https://developer.nvidia.com/blog/mastering-agentic-techniques-ai-agent-evaluation/)、[Langfuse — 如何评测 LLM agent](https://langfuse.com/guides/cookbook/example_pydantic_ai_mcp_agent_evaluation)。

四类要单独测的维度：

| 维度 | 测什么 | 手段 |
|---|---|---|
| **任务完成（task completion）** | 最终是否达成目标 | 端到端断言 / LLM-judge |
| **工具轨迹（tool trajectory）** | 调了哪些工具、顺序、参数对不对、有没有多余调用 | 轨迹对比（exact / in-order / any-order）、tool-call accuracy |
| **多步推理质量** | 每个中间决策是否合理 | 逐 span 评分（per-step evaluator）+ OTel trace |
| **多轮连贯（multi-turn coherence）** | 跨轮是否保持上下文、不自相矛盾 | 多轮专用 metric（DeepEval/Confident AI 多轮评测） |

Agent 评测三大工程难点：

1. **轨迹评测难**：要把 agent 的执行轨迹（plan → tool calls → observations）结构化记录下来才能评。业界做法是**用 OpenTelemetry span 记录每个 planner/tool/memory/handoff 调用**，再给每步挂 evaluator。来源：[FutureAGI — agentic observability](https://www.futureagi.com/glossary/agentic-observability)、[OpenAI — evaluate agent workflows](https://developers.openai.com/api/docs/guides/agent-evals)、[Comet Opik — evaluate agent trajectory](https://www.comet.com/docs/opik/evaluation/advanced/evaluate_agent_trajectory)。
2. **工具调用正确性难判**：不只是"调没调对工具"，还要看参数、调用次数、是否有破坏性副作用（"输出对但中途绕过了安全控制"是真实失败模式）。来源：[Label Studio — 生产 agent 评测](https://labelstud.io/blog/how-to-evaluate-ai-agents-in-production)。
3. **回归数据集构建难**：要从生产 trace 里捞典型/失败/对抗案例，沉淀成黄金集（golden dataset），并打 `is_regression` 标记（ssp-web 的 `cases.is_regression` 字段正是为此设计，见 §6）。`pass@k`（k 次里至少 1 次成功）与 `pass^k`（k 次全成功）的区分对 agent 尤其重要——agent 的稳定性比单次成功更值钱。来源：[Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)。

> **工具支持现状**：Inspect AI 原生支持 agent 轨迹与多 agent 原语（§2.4）；Langfuse / Braintrust / Opik 走"OTel trace + 逐 span evaluator"路线；Promptfoo 也支持 agent/RAG 评测但偏 I/O 断言。Agent 轨迹评测整体仍是 2026 的活跃前沿，写作时标注"方法在演进"。

---

## 5. CI 门禁实践（第 23 节核心追溯源）

### 5.1 三套 CI 方案（与 ssp-web 第 23 节一致）

| 方案 | 工具 | 触发 | 判定机制 |
|---|---|---|---|
| **A（推荐基线）** | Promptfoo + GitHub Actions | PR 改动 `src/lib/ai/**`、`evals/**`、`dsl/**` | `promptfoo-action` + `PROMPTFOO_PASS_RATE_THRESHOLD: 0.95` + `fail-on-error: true`，自动 PR comment + ❌ |
| **B** | DeepEval + GitHub Actions（Python 栈） | `[pull_request]` | `deepeval test run tests/`（接 Pytest），失败即 fail |
| **C** | Inspect + GitHub Actions | PR | `inspect eval evals/xxx.py --model ...` → 脚本读 `logs/latest.json` 提分 → `sys.exit(0/1)` |

> 方案 A 是 **ssp-web 真实落地**（`.github/workflows/eval.yml`，第 23 节新增）；B/C 为"示意/对照"。

### 5.2 门禁阈值设计（防 Agent 变蠢）

第 23 节给出的业界推荐门禁口径（可按业务调整）：

| Metric | 单元层 | 集成层 | 回归层 |
|---|---|---|---|
| Deterministic assertion 通过率 | 100% | ≥ 95% | ≥ 95% |
| LLM rubric 分 | ≥ 3.5/4 | ≥ 3.0/4 | — |
| Tool 调用准确率 | — | — | 不退步 > 2% |
| latency | ≤ 1.2× | ≤ 1.5× | 不退步 > 20% |
| cost | ≤ 1.1× | ≤ 1.3× | 不退步 > 30% |

三条设计原则：

1. **单元层测 contract（合约）不测性能**："调 `computePlan` 必须传 `birth_year`"这种事 0 容忍 → 100%。
2. **回归层看 delta 不看绝对值**：baseline = main 分支当前成绩，新 PR 对比"掉了几个点"，掉超过 ~5% 即 fail（业内通用）。
3. **cost / latency 必须 assert**：光对不够，"对但慢 3 倍/贵 3 倍"也是回归。

### 5.3 双层/三层门禁（防线分层）

| 防线 | 目的 | 主要手段 |
|---|---|---|
| 第一层：CI 门禁 | 阻断已知坏 PR | 单元 + 集成 evals + 通过率门槛 |
| 第二层：灰度推全 | 阻断进了 main 的坏版本 | A/B + win-rate / Elo + 自动回滚 |
| 第三层：生产监控 | 抓住跑偏的稳态 | 影子集回放 + OTel trace + 人工抽检 |

### 5.4 业界实践参考（第 23 节 §2.8）

- **Anthropic**：每个 system prompt 改动都跑全套 per-model evals；可能影响智能的改动加 **soak period（浸泡期）** + 更宽 eval suite + 渐进 rollout；"瑞士奶酪"五层联防。来源：[Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)、[April 23 Postmortem](https://www.anthropic.com/engineering/april-23-postmortem)。
- **Vercel**：「评测是新的 TDD」，推荐 **Braintrust + AI Gateway + Vitest** 栈。来源：[Eval-Driven Development](https://vercel.com/blog/eval-driven-development-build-better-ai-faster)。

### 5.5 CI 门禁两个高频坑

1. **CI 太慢工程师绕过**：eval 跑太久会逼人 `--no-verify`。对策：缓存（promptfoo cache）、只对改动路径触发、抽样跑全量留 nightly。
2. **密钥未配 CI 直接挂**：所有方案都依赖 `secrets.OPENAI_API_KEY` 之类。ssp-web 至少要塞 `OPENAI_API_KEY` + `OPENAI_MODEL`（见 `code-facts.md` §11.5）。

---

## 6. 三层评测模型的业界对应（第 22 节核心图追溯源）

借用经典测试金字塔，LLM 评测分三层，每层在业界框架里都有对应实现：

| 层 | 跑动频率/成本 | 测什么 | 框架对应 |
|---|---|---|---|
| **单元层（Unit）** | 多 / 便宜 | 单个 prompt / 单工具的 contract、deterministic 断言 | Promptfoo assertion、DeepEval metric、规则 DSL 单测（ssp-web `dsl/ssp_dsl_v1/tests/`） |
| **集成层（Integration）** | 中 | 多轮对话、tool 编排、端到端任务完成 | DeepEval 多轮、Inspect agent task、Promptfoo scenario |
| **回归层（Regression）** | 少 / 贵 | 跟"过去的自己"比，黄金集 delta、win-rate/Elo | snapshot diff / score diff / pairwise（both-orderings） |

**ssp-web 的最小评测系统**：数据库已有三张表作底座（见 `src/lib/db/schema.ts`，第 23 节 §2.6）——

- `cases`（行 162-176）：回归用例库，`is_regression` 标记"是否进回归集"；`tags=["adversarial"]` 为对抗集。
- `tests`（行 180-192）：规则单元测试。
- `publishes`（行 103-114）：发布门禁记录，`gate_results`（JSON）存每次 release 所有 gate 判定，可追溯"哪次 release 把哪个 metric 拉下来"。

好处：**评测数据是项目源码的一部分**，不依赖外部 SaaS。

---

## 7. 章节追溯映射

| 章节文件 | 标题（节号） | 本报告对应小节 |
|---|---|---|
| `23-evaluation.md` | 第 22 节 评测体系：三层评测模型与 LLM-as-Judge | §1 为什么评测、§3 LLM-as-Judge 全部（rubric/pairwise/偏差）、§4 Agent 评测难点、§6 三层模型对应 |
| `24-regression-testing.md` | 第 23 节 回归测试与 CI 门禁：让 Agent 不变蠢 | §2 框架逐个（Promptfoo/DeepEval/Inspect）、§4 轨迹/工具调用评测、§5 CI 门禁全部（三方案/阈值/分层/坑/业界实践）、§6 ssp-web 三表 |
| `27-rag-augmentation.md`（第 26 节，交叉） | RAG 增强 | §2.7 Ragas（RAG 专用指标） |

---

## 8. 写作对齐核对清单（防幻觉 / 防过期）

写 22 / 23 节时，凡引用以下点务必与本报告一致：

- ✅ **许可证**（一手核实）：Promptfoo=**MIT**、DeepEval=**Apache-2.0**、Ragas=**Apache-2.0**、Inspect AI=**MIT**、OpenAI Evals=**MIT**、Langfuse 核心=**MIT**；**Braintrust 平台=闭源商业**（仅 `autoevals` 开源）。不要把 Braintrust 写成"开源框架"。
- ✅ **Promptfoo 是 ssp-web 推荐基线且已落地**（`.github/workflows/eval.yml` + `promptfoo-action`）；DeepEval/Braintrust/Inspect/Langfuse/OpenAI Evals/Ragas 在 ssp-web 中**未使用**，引用一律标"（示意/对照，非项目实际代码）"。
- ✅ **LLM-as-Judge 奠基**：Zheng et al. **arXiv:2306.05685**，NeurIPS 2023，"与人类一致率 80%+"。
- ✅ **位置偏差缓解 = both-orderings（两序都跑、都赢才算赢）**；冗长偏差、自我增强偏差、分数不稳定的缓解见 §3.4。
- ✅ **judge 校准底线**：kappa < 0.6 不能当生产门禁。
- ✅ **Agent 评测看轨迹不只看结果**；工具调用正确性、回归集 `is_regression`、`pass@k` vs `pass^k` 区分。
- ✅ **Inspect 三件套 = Dataset + Solver + Scorer**，UK AISI + Meridian Labs，支持 MCP 工具与外部 agent。
- ✅ **Ragas 是 RAG 专用**，核心指标 faithfulness / answer relevancy / context precision / context recall；faithfulness=1.0 不等于检索对。
- ⚠️ **价格/估值/市占/榜单**（Braintrust $249/mo、$800M 估值/$80M Series B、LangSmith $39/seat、server 数量、"五商业 + 三开源"格局）全是**二手统计**，正文必须标"二手 + 来源 + 日期"，不作确定事实。
- ⚠️ **框架命名易混**：`openai/evals`（官方）≠ `langchain-ai/openevals`（LangChain）≠ `openai/simple-evals`；引用给准确仓库链接。
- ⚠️ 术语对齐 `style-guide.md` §7：用"评测（Eval）""判官 / LLM-as-Judge""轨迹（trajectory）""门禁（gate）""通过率""黄金集（golden dataset）"；版本号修饰的是**第三方框架**（如"Promptfoo""DeepEval"），章节正文**不得**出现指代"本课程"的"v1/v2/旧版本/历史归档"措辞。

---

## 9. 引用来源（可信链接）

**官方一手源（框架文档 / 仓库）**：

- Promptfoo：[官网 intro](https://www.promptfoo.dev/docs/intro) · [FAQ](https://www.promptfoo.dev/docs/faq/) · [LLM-as-Judge 指南](https://www.promptfoo.dev/docs/guides/llm-as-a-judge/) · [CI/CD 集成](https://www.promptfoo.dev/docs/integrations/ci-cd/) · [GitHub](https://github.com/promptfoo/promptfoo) · [promptfoo-action](https://github.com/promptfoo/promptfoo-action) · [Contributing（MIT）](https://www.promptfoo.dev/docs/contributing)
- DeepEval：[GitHub（Apache-2.0）](https://github.com/confident-ai/deepeval) · [PyPI](https://pypi.org/project/deepeval/) · [CI/CD 回归测试](https://deepeval.com/docs/evaluation-unit-testing-in-ci-cd) · [Confident AI 文档](https://docs.confident-ai.com/guides/guides-regression-testing-in-cicd)
- Braintrust：[autoevals（开源）](https://github.com/braintrustdata/autoevals) · [autoevals 文档](https://www.braintrust.dev/docs/evaluate/autoevals) · [vs Promptfoo](https://www.braintrust.dev/articles/braintrust-vs-promptfoo) · [自托管 evals 2026](https://www.braintrust.dev/articles/best-self-hosted-ai-evals-tools-2026)
- Inspect AI：[官网](https://inspect.aisi.org.uk/) · [llms-full.txt](https://inspect.aisi.org.uk/llms-full.txt) · [Tasks](https://inspect.aisi.org.uk/tasks.html) · [scorer 参考](https://inspect.aisi.org.uk/reference/inspect_ai.scorer.html) · [GitHub（MIT）](https://github.com/UKGovernmentBEIS/inspect_ai)
- Langfuse：[开源公告（MIT）](https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product) · [categorical LLM-judge changelog](https://langfuse.com/changelog/2026-03-20-categorical-llm-as-a-judge-scores) · [evaluate LLM agents](https://langfuse.com/guides/cookbook/example_pydantic_ai_mcp_agent_evaluation)
- OpenAI Evals：[GitHub（MIT）](https://github.com/openai/evals) · [run-evals 文档](https://github.com/openai/evals/blob/main/docs/run-evals.md) · [simple-evals](https://github.com/openai/simple-evals) · [evaluate agent workflows](https://developers.openai.com/api/docs/guides/agent-evals)
- Ragas：[GitHub（Apache-2.0）](https://github.com/explodinggradients/ragas) · [RAGAS 论文 arXiv:2309.15217](https://arxiv.org/abs/2309.15217)

**论文（arXiv 一手）**：

- [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena（arXiv:2306.05685）](https://arxiv.org/abs/2306.05685)
- [Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference（arXiv:2403.04132）](https://arxiv.org/html/2403.04132v1)
- [JudgeLM: Fine-tuned LLMs are Scalable Judges（arXiv:2310.17631）](https://arxiv.org/abs/2310.17631)
- [A Systematic Evaluation of Bias Mitigation Strategies in LLM-as-a-Judge Pipelines（arXiv:2604.23178）](https://arxiv.org/abs/2604.23178)

**官方工程博客（一手）**：

- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) · [April 23 Postmortem](https://www.anthropic.com/engineering/april-23-postmortem)
- [Vercel — Eval-Driven Development](https://vercel.com/blog/eval-driven-development-build-better-ai-faster)
- [OpenAI Cookbook — Evaluation flywheel](https://cookbook.openai.com/examples/evaluation/building_resilient_prompts_using_an_evaluation_flywheel)

**二手 / 第三方（仅作格局、价格、趋势，引用须标注口径与日期）**：

- [DataCamp — Promptfoo 教程](https://www.datacamp.com/tutorial/promptfoo-tutorial) · [apidog — Promptfoo 完整指南 2026](https://apidog.com/blog/test-llm-applications/)
- [latitude — 最佳 Agent 评测平台 2026](https://latitude.so/blog/best-ai-agent-evaluation-platforms-2026-comprehensive-comparison) · [Agent 可观测工具 2026](https://latitude.so/blog/best-ai-agent-observability-tools-2026-comparison)
- [digitalapplied — AI Agent Eval 框架 2026](https://www.digitalapplied.com/blog/ai-agent-eval-frameworks-testing-guide-2026) · [RAG 指标 2026](https://www.digitalapplied.com/blog/rag-system-metrics-recall-precision-faithfulness-2026)
- [cekura — Braintrust 价格拆解](https://www.cekura.ai/blogs/braintrust-pricing)
- [tianpan.co — LLM judge 偏差审计](https://tianpan.co/blog/2026-04-27-llm-judge-bias-audit-length-position-format) · [评测 Agent 轨迹](https://tianpan.co/blog/2026-02-07-evaluating-ai-agents-trajectories-not-just-outcomes)
- [NVIDIA — AI agent evaluation](https://developer.nvidia.com/blog/mastering-agentic-techniques-ai-agent-evaluation/) · [Label Studio — 生产 agent 评测](https://labelstud.io/blog/how-to-evaluate-ai-agents-in-production)
- [FutureAGI — agentic observability](https://www.futureagi.com/glossary/agentic-observability) · [LLM 评测框架 2026](https://futureagi.com/blog/llm-evaluation-frameworks-metrics-best-practices/)
- [markaicode — RAGAS 生产指标](https://markaicode.com/rag-evaluation-ragas-metrics-production/) · [learnwithparam — RAGAS 4 指标](https://www.learnwithparam.com/blog/ragas-evaluation-rag-pipelines-practical-guide)

> 写作铁律：框架名/许可证/CLI 命令/CI 机制/论文年份 → 回链一手源；价格/估值/市占/榜单/性能百分比 → 标注二手 + 口径 + 日期，不得作为确定事实陈述。本报告与 `research/ai-sdk-v6.md`（AI SDK + Vitest 评测栈）、`research/agent-patterns.md`（多 Agent 与轨迹）、`research/model-selection-2026.md`（judge 模型选型）互为补充。Content was rephrased for compliance with licensing restrictions。
