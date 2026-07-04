# 序章｜延迟退休来了，我们造了个 AI 帮你算社保

![序章封面](images/00-hero.png)

<!-- 图片说明（给图片代理）：
风格：手绘风格封面，温暖叙事感
内容：一个老人坐在公园长椅上，旁边坐着一个年轻人捧着笔记本电脑。
电脑屏幕上是 SSP 的对话界面：左边气泡"我 1975 年女性 上海户籍"，右边气泡"你的法定退休日是 2030 年 8 月..."
背景是上海的天际线（东方明珠隐约可见）+ 飘落的银杏叶
色调：米白 + 暖橙 + 一点蓝（背景）
中文标题手写在右上角："延迟退休来了，我们造了个 AI 帮你算社保"
-->

> **预计时长**：阅读 25 分钟 / 实战 30 分钟
> **前置知识**：会跑过任意一个 Next.js 项目即可；不需要 AI/ML 背景
> **本节代码**：`ssp-web` 仓库 [`chapter-00` tag](https://github.com/jiji262/ssp-web) · 主要文件 `src/app/api/chat/route.ts`、`src/lib/ai/agent.ts`、`docs/architecture.md`

---

2025 年 1 月 1 日，一项政策悄然生效，影响了几乎每一个中国人。

**渐进式延迟退休，正式落地了。**

那几天，朋友圈被一种集体焦虑刷屏。每个人都在问差不多的问题：我到底什么时候能退休？养老保险交够了吗？灵活就业每个月要交多少？听说还有补贴能领？

问题听上去简单，但只要你真去算，就会发现这是一个巨大的坑——退休年龄取决于你的性别、出生年月、岗位类型，还得叠加延迟退休的渐进式调整表。养老保险最低缴费年限从 15 年逐步提到 20 年。医保有单独的终身待遇门槛。灵活就业人员还有一套专门的补贴政策。

普通人想搞清楚？要么去社保窗口排两小时队，要么在网上搜一堆互相矛盾的"攻略"。

**所以我们造了一个 AI Agent，让它帮你算。**

它的名字叫 SSP——Shanghai Social Security Planner，上海社保规划助手。这一节，我们要把它整个掀开给你看。

![延迟退休政策冲击波](images/00-delayed-retirement-shock.png)

<!-- 图片说明（给图片代理）：
风格：手绘风格痛点图
内容：一个中年人捂着头，周围漂浮着一堆问号气泡：
  "55 还是 56?" "缴 15 年还是 20 年?" "补贴能领吗?" "弹性退休?"
中央背景是一张被红笔圈得乱七八糟的"退休年龄对照表"
色调：米白底 + 红色问号 + 黑色小人轮廓
（注：复用已有图 images/00-delayed-retirement-shock.png）
-->

---

## 一、知识铺垫：为什么社保计算这么难

要看懂为什么"算社保"是个大坑，得先看清楚里面有几个互相纠缠的变量。

### 1.1 多维度交叉

**第一个维度：法定退休年龄**

2025 年新政之前的口径很简单：男 60、女工人 50、女干部 55。

新政之后，引入了一张"渐进式延迟退休对照表"——出生年月每提前一个月，退休年龄就推后一点。1973 年出生的女性工人，退休年龄从 50 岁延到 51 岁零几个月。1985 年出生的男性，从 60 岁延到 63 岁。

光这一个变量，就需要一张精确到出生年月的查找表。

**第二个维度：弹性退休**

新政允许"弹性退休"——你可以选择最多提前 3 年或延迟 3 年退休。但提前的前提是养老保险最低缴费年限达标。

**第三个维度：最低缴费年限**

旧规则是 15 年。新政从 2030 年起每年加半年，直到 2039 年提到 20 年。所以你 2032 年退休时要求是 16 年，2035 年是 17.5 年。

**第四个维度：医保终身待遇**

医保有自己的门槛——男性 25 年、女性 20 年。和养老保险是两套独立计算。

**第五个维度：补贴**

灵活就业人员有 4050 补贴、大龄岗位补贴、失业金、医保补贴……每一项都有独立的资格条件、计算公式、互斥规则。

把这五个维度乘起来——你大概有上千种组合。

![社保计算的复杂度：多维度交叉](images/00-complexity-dimensions.png)

<!-- 图片说明（给图片代理）：
风格：手绘信息图
内容：5 个齿轮咬合在一起：
  齿轮 1：法定退休年龄
  齿轮 2：弹性退休
  齿轮 3：最低缴费年限
  齿轮 4：医保终身待遇
  齿轮 5：补贴政策
中央写"上千种组合"
色调：米白底 + 暖色齿轮 + 黑色文字
（注：复用已有图 images/00-complexity-dimensions.png）
-->

### 1.2 政策是活的

更糟的是，这堆规则**每年都变**。

社保缴费基数每年 7 月调整。延迟退休对照表是分阶段推进的。补贴金额、补贴年限、补贴互斥规则随时可能更新。

这意味着：**任何一份"算社保"的代码，发布的那一刻起就在过期**。

### 1.3 LLM、规则引擎、AI Agent

在我们继续之前，先把三个术语对齐——后面会反复用到。

| 术语 | 中英对照 | 一句话定义 |
|---|---|---|
| 大模型 | LLM (Large Language Model) | 会自然语言对话的"嘴" |
| 规则引擎 | Rule Engine | 把"条件 → 结果"逻辑序列化执行的"脑" |
| 智能体 | Agent | 能感知环境、推理、调用工具、采取行动的系统 |
| 工具调用 | Tool Calling | LLM 输出"该调哪个 Tool 以及参数"，由系统执行 |
| 提示词 | Prompt | 喂给 LLM 的指令文本（System / User / Assistant） |
| 上下文 | Context | 一次对话里塞进 LLM 的所有信息 |

**Agent 跟 Chatbot 的本质区别**只有一句话：

> **Chatbot 直接说话，Agent 先决定下一步做什么——是说话，还是调工具。**

这个区别看似细微，但决定了整个架构怎么搭。后面 30 节都在围绕这一句话展开。

---

## 二、核心讲解

### 2.1 SSP 长什么样

先别急着看代码。我们先看产品。

**SSP 是一个网页应用**。打开页面，跟 AI 聊天，就能拿到一份专属的社保规划方案。

![SSP 产品首页](images/screenshot-home.png)

<!-- 图片说明（给图片代理）：
这是 ssp-web 的首页截图，复用已有图 images/screenshot-home.png
-->

来看一段真实对话：

```
你：我是女的，1975 年 8 月出生，上海户籍，养老保险交了 18 年，灵活就业

AI：好的，让我帮你算一下。
    [调用 computePlan 工具，跑了 24 条政策规则]

    📋 你的初步规划方案：

    ■ 退休时间
      · 法定退休日：2030 年 8 月（延迟后 55 岁）
      · 最早可退休：2028 年 8 月（弹性提前 2 年）

    ■ 养老保险
      · 已缴 216 个月，最低要求 180 个月 ✓ 达标

    ■ 还需确认一个信息
      你是普通工人还是管理岗？这影响退休年龄计算。

      [普通工人(50 岁)]  [管理岗(55 岁)]   ← 点一下就行

你：（点了"普通工人"）

AI：[重新计算，生成完整方案]
    方案已更新，你的法定退休日调整为……
```

![AI 对话与规划结果展示](images/screenshot-chat.png)

<!-- 图片说明（给图片代理）：
这是 ssp-web 的对话页截图，复用已有图 images/screenshot-chat.png
-->

注意几个关键细节：

**对话式交互**——不用填表格。你像跟朋友聊天一样说自己的情况，AI 自己提取信息。

**所有数字都是算出来的**——不是 AI 凭印象编的。24 条政策规则精确计算，每个结论都有据可查。

**渐进式追问**——先用最少的信息给你一个初步结果，遇到模糊的地方再追问。而且追问不是让你打字，是弹出可点击的按钮。

> **划重点**：核心设计哲学就一句话——**LLM 负责"听"和"说"，规则引擎负责"算"。绝不让大模型猜数字。**

### 2.2 为什么不能直接问 ChatGPT

你可能想：直接问 ChatGPT "我 1975 年出生的女性什么时候退休"，不就行了？

**真不行**。我们实测了几十次，三个致命问题。

**第一个：LLM 会自信地给错误答案。**

它可能告诉你"55 岁退休"，但 2025 年延迟退休方案实施后，1975 年出生的女性工人退休年龄可能是 51 岁零 8 个月。差了三年多。

更可怕的是——**LLM 给出错误答案时，不会告诉你它在猜**。它会像真的一样，给你列出"政策依据"来佐证自己的错误结论。这种现象有个专业名字：**幻觉（Hallucination）**。

幻觉对闲聊场景无伤大雅，但在涉及钱的领域，**是致命的**。

**第二个：政策是活的。**

大模型的训练数据有截止日期。比如 GPT-4o 的训练数据截止到 2024 年中。但社保缴费基数每年 7 月调整，补贴政策随时可能变，延迟退休表按年份递进。你不可能靠一个训练数据停在半年前的模型来算这种东西。

**第三个：每个人的情况不一样。**

同样 1975 年出生的女性，工人岗和管理岗退休年龄不同。交了 15 年和交了 25 年，方案完全不一样。户籍、就业形态、参保类型、缴费历史，每个变量都影响最终结果。**LLM 没法在脑子里跑一遍完整的决策树**——尤其是有 24 条相互关联的规则时。

![LLM 直接回答 vs Agent 精确计算](images/00-llm-vs-agent.png)

<!-- 图片说明（给图片代理）：
风格：手绘对比图
内容：左右对比。
左边："直接问 LLM"——气泡里写"55 岁退休✗"，下面写"幻觉、过期、忽略个体差异"，配一个皱眉的小人
右边："Agent + 规则引擎"——气泡里写"2030-08 法定退休 ✓"，下面写"24 条规则、版本化政策、个性化"，配一个微笑的小人
色调：左灰右暖
（注：复用已有图 images/00-llm-vs-agent.png）
-->

所以答案很明确：**我们需要一个 AI Agent**。

AI 负责理解你说了什么、决定下一步做什么、把结果翻译成你能看懂的话。但所有涉及数字的计算，**全部交给确定性的规则引擎来做**。

### 2.3 SSP 四层架构鸟瞰

SSP 的架构并不复杂。一句话：

> **用户跟 AI 聊天 → AI 判断要调哪个 Tool → Tool 调规则引擎算出结果 → AI 把结果翻译成人话。**

四层，每层职责清晰：

```
┌─────────────────────────────────────────────────────────┐
│                   交互层 Interaction                     │
│        React 19.2.3 + assistant-ui + useChat + SSE       │
│      用户输入 → 实时渲染 AI 回复 → 渲染工具结果卡片         │
├─────────────────────────────────────────────────────────┤
│                    推理层 Reasoning                      │
│  Vercel AI SDK v6 (ai@^6.0.99) + streamText + LLM        │
│  组装 System Prompt → 调用 LLM → 决策调用哪个 Tool        │
├─────────────────────────────────────────────────────────┤
│                    执行层 Execution                      │
│        3 个 Tool 函数 + JSONLogic 规则引擎               │
│   computePlan / updateProfile / validateField           │
│       + 24 条 JSON 政策规则                              │
├─────────────────────────────────────────────────────────┤
│                   持久层 Persistence                     │
│     Drizzle ORM 0.45+ + Neon Postgres (Serverless)       │
│   conversations · plans · rules · params · rule_sets    │
└─────────────────────────────────────────────────────────┘
```

![SSP 四层架构鸟瞰](images/00-four-layer-arch.png)

<!-- 图片说明（给图片代理）：
风格：信息图，扁平专业风
内容：4 层并列横向方块，从上到下：
  1. 交互层（粉色背景）：React 19 / assistant-ui / useChat / SSE
  2. 推理层（橙色背景）：AI SDK v6 / streamText / LLM
  3. 执行层（绿色背景）：computePlan / updateProfile / validateField / 24 条 JSONLogic 规则
  4. 持久层（米色背景）：Drizzle ORM / Neon Postgres
箭头：从上到下流向，间隙处用箭头串联
中文标注，字号清晰
-->

我们一层一层快速过一遍——**每层后面都会有专门的章节展开**。这里只看全貌。

#### 交互层：让对话像聊天一样自然

React 19 + Vercel AI SDK 的 `useChat` hook + assistant-ui 库。这一层干三件事：

- 把用户输入发给后端
- 实时渲染 AI 的流式输出（SSE，Server-Sent Events）
- 把 Tool 调用结果变成好看的卡片和按钮

你在前面看到的那些"可点击的选项按钮"——那不是 AI 在文本里写了个括号，而是前端根据 Tool 返回的结构化数据，实打实渲染出来的 UI 组件。我们叫它**工具结果卡片（Tool Result Card）**。

详见[第 17 节《工具结果卡片化》](./18-streaming-ui.md)。

#### 推理层：AI 的"大脑"

Next.js 16 的 API Route 收到用户消息后，做两件事：

1. 把 169 行的 System Prompt（11 节，相当于一本操作手册）和对话历史打包发给 LLM
2. 等模型决定下一步——是直接说话，还是调 Tool

来看真实代码（来自 `ssp-web` 的 `src/lib/ai/agent.ts`）：

```typescript
// src/lib/ai/agent.ts:47-79
export function createChatStream(
  messages: ModelMessage[],
  context?: ChatContext,
  onFinish?: (result: { text: string }) => void | Promise<void>,
) {
  const { apiKey, baseURL, model } = getOpenAIConfig();
  const openai = createOpenAI({ apiKey, baseURL });

  const contextPrompt = context
    ? buildContextPrompt(context.questions ?? [], context.userProfile)
    : "";

  const systemPrompt = contextPrompt
    ? `${SYSTEM_PROMPT}\n\n${contextPrompt}`
    : SYSTEM_PROMPT;

  return streamText({
    model: openai(model),
    system: systemPrompt,
    messages,
    providerOptions: {
      openai: { store: false },  // 中转网关兼容
    },
    tools,
    stopWhen: stepCountIs(8),    // 多步 Tool 调用上限
    temperature: 0.3,            // 低温度，事实导向
    onFinish,
  });
}
```

> **看这里 →**：`stopWhen: stepCountIs(8)` 是 AI SDK v6 的多步 Tool 循环上限——一次对话最多让 LLM 自动调 8 步 Tool。`temperature: 0.3` 是低温度，让模型尽量按 Prompt 走、少自由发挥。

模型不会直接回答数字类问题。它的决策是：**"我需要调 `computePlan` 这个工具，参数是……"**

这就是 Agent 和 Chatbot 的根本区别。Chatbot 直接输出文字，Agent 会先"想一想"该调什么 Tool。

详见[第 11 节《Tool Calling 协议》](./12-tool-calling.md)。

#### 执行层：三个工具 + 规则引擎

AI 有三个 Tool 可以调：

| Tool | 干什么 | 调用频率 |
|---|---|---|
| `computePlan` | 核心工具，调规则引擎算社保方案 | 每次对话至少 1 次 |
| `updateProfile` | 把对话中的用户信息结构化存下来 | 收集到新信息时 |
| `validateField` | 校验单个字段格式（出生年份合不合理等） | 偶尔 |

`computePlan` 是主角。它调用 **JSONLogic 规则引擎**，引擎内部有 **24 条用 JSON 定义的决策规则**，覆盖退休年龄、养老保险、医疗保险、失业保险和各种补贴。

24 条规则的执行顺序由 `dsl/ssp_dsl_v1/rule_sets/rule_set_shanghai_plan_v1.json` 决定。来看几条：

| 序号 | rule_id | 干什么 |
|---|---|---|
| 1 | `R-010-PARSE-BIRTH-YEAR` | 解析"73 年" → 1973 |
| 5 | `R-110-LOOKUP-LEGAL-RETIRE-AGE` | 查表+算法计算法定退休年龄 |
| 8 | `R-200-MIN-PENSION-YEARS` | 最低缴费年限（2030 起 15→20） |
| 17 | `R-510-4050-AMOUNT` | 4050 补贴金额 |
| 24 | `R-900-FINAL-GATE` | 最终安全门（缺字段则 needs_agent=true） |

**政策要更新？改 JSON 就行，不用动一行 TypeScript 代码**。这是规则引擎相对硬编码逻辑的最大优势。

详见[第 14 节《规则引擎 DSL》](./15-rule-engine-dsl.md)和[第 15 节《JSONLogic 引擎实现》](./16-jsonlogic-execution.md)。

#### 持久层：让 AI 不再健忘

Neon Postgres 存四类数据：

```
rules           24 条规则的定义（含历史版本）
params          政策参数（基数、费率、补贴金额）
plans           每次计算结果的快照
conversations   用户对话历史（messages + user_profile JSONB）
```

为什么要存对话历史？因为用户可能今天聊到一半关掉页面，明天再回来接着问。**没有持久化，AI 就是个金鱼——什么都记不住**。

来看 Drizzle 的 schema 怎么定义 `conversations` 表：

```typescript
// src/lib/db/schema.ts:133-140
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull(),
  messages: jsonb("messages").notNull(),       // 整个对话历史
  userProfile: jsonb("user_profile"),          // 结构化提取的用户信息
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

详见[第 7 节《数据库与 ORM》](./08-database-and-drizzle.md)和[第 18 节《Agent 记忆系统》](./19-agent-memory.md)。

### 2.4 五分钟快速体验

看了这么多，不如自己跑一遍。**5 分钟，从 clone 到跟 AI 对话**。

![5 分钟快速体验流程](images/00-quickstart-flow.png)

<!-- 图片说明（给图片代理）：
风格：信息图，5 步流程图（横向）
内容：5 个圆形节点连成一条线：
  1. clone 仓库（Git 图标）
  2. pnpm install（依赖图标）
  3. 配 .env.local（密钥图标）
  4. pnpm dev（运行图标）
  5. 打开浏览器（浏览器图标）
每步配一行小字说明，全部连起来时间标"~5 min"
色调：橙黄主色 + 米白底
（注：复用已有图 images/00-quickstart-flow.png）
-->

#### 你需要准备

- **Node.js 20+**（推荐用 [nvm](https://github.com/nvm-sh/nvm) 管理版本）。Next.js 16 的最低 Node 版本是 20.9。
- **pnpm 9+**（`npm install -g pnpm`，用 npm 也行，下面命令换成 npm 就好）
- **一个 OpenAI API Key**（[这里申请](https://platform.openai.com/api-keys)）。课程默认用 `gpt-4o-mini`，几分钱聊几十轮。
- **一个 Neon Postgres 数据库**（可选，[免费版](https://neon.tech) 够用；不配也能跑，但会话历史会丢）

> **2026 模型选择小贴士**：项目默认 `gpt-4o-mini`，通过 `@ai-sdk/openai` 的 OpenAI 兼容端点接入，改个 `OPENAI_MODEL` 就能换模型。`gpt-4o-mini` 的 API 访问仍然保留，跑通教程没问题；做新项目时，可考虑同价位带更强的 `gpt-5.4-mini`，或主力生产档的 `claude-sonnet-4.6` / `gemini-2.5-flash`。具体价格与选型决策树见[加餐 3《模型迁移实战》](./extras/03-model-migration.md)（价格随厂商调整，以官方定价页为准）。

#### 五步搞定

**第一步，clone 代码**：

```bash
git clone https://github.com/jiji262/ssp-web.git
cd ssp-web
git checkout chapter-00       # 切到序章对应的初始 tag
```

**第二步，装依赖**：

```bash
pnpm install
```

如果 `bcryptjs` 或 `xlsx` 报 native 模块错误，看 `next.config.ts`——这两个包已经标在 `serverExternalPackages` 里，应该自动处理。

**第三步，配环境变量**：

```bash
cp .env.example .env.local
```

打开 `.env.local`，至少填这几个：

```bash
# 必填
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=  # 看下面注释

# 可选（暂时不填也能跑）
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

`ADMIN_PASSWORD_HASH` 用 bcryptjs 生成：

```bash
node -e "console.log(require('bcryptjs').hashSync('your-admin-password', 10))"
```

> **提醒**：如果暂时没有数据库，C 端聊天还是能跑（用进程内 in-memory），但 admin 后台和会话持久化用不了。

**第四步，跑 seed 把规则灌库**（可选，需要数据库）：

```bash
pnpm seed
```

这会把 `dsl/ssp_dsl_v1/rules/*.json` 24 条规则、政策参数、规则集、测试用例，全部 upsert 到 PG。

**第五步，启动**：

```bash
pnpm dev
```

浏览器打开 [`http://localhost:3000`](http://localhost:3000)，你应该能看到 SSP 的对话界面。

#### 试着聊一句

输入：

> **"我是男的，1970 年出生，上海户籍，养老保险交了 25 年"**

然后看 AI 怎么回你。

它不会直接编一个答案。你会看到终端里打出的日志——AI 先判断该调 `computePlan`，把你的信息传给规则引擎，引擎跑完 24 条规则，返回结构化结果，AI 再把结果翻译成自然语言。

**这就是 Agent 和 Chatbot 的区别**。Chatbot 是嘴上功夫，Agent 是真的去"做事"了。

#### 刚才发生了什么

回头看一眼架构图，刚才那一轮对话，四层全跑了一遍：

1. **交互层**：React 前端把你的输入发给 `/api/chat`，SSE 流式接收 AI 的回复
2. **推理层**：`gpt-4o-mini` 读了 11 节 System Prompt，决定调用 `computePlan` 工具
3. **执行层**：Tool 函数跑了规则引擎，24 条规则精确计算出退休方案
4. **持久层**：对话历史和计算结果存进了 PG（如果你配了的话）

接下来的 28 节，就是把这四层一层一层拆开给你看。

### 2.5 核心设计原则

整个 SSP 的设计，归到底就一条原则：

> **让 LLM 做它擅长的事（理解自然语言、组织表达、决策调度），让规则引擎做它擅长的事（精确计算、政策匹配、条件判断）。**

这条原则贯穿整个教程：

- **Prompt 工程**（核心篇 第 09-10 节）：教 LLM "你不是计算器，遇到数字必须调 Tool"
- **Tool Calling**（核心篇 第 11-13 节）：给 LLM 装上 3 个"手脚"，让它能调用外部能力
- **规则引擎**（核心篇 第 14-15 节）：把 24 条政策规则变成可执行的 JSON，确保计算 100% 确定性

为什么要这么较真？

因为在社保这个领域，**差一个月就可能差几万块钱**。用户信任你给的数字，你的数字就必须对。LLM 的幻觉在闲聊场景无伤大雅，但在涉及钱的场景，是致命的。

![设计原则：LLM 与规则引擎的分工](images/00-design-principle.png)

<!-- 图片说明（给图片代理）：
风格：手绘风格分工图
内容：左右两个圆形：
  左圆："LLM"标签，配嘴巴图标，下方写"听 + 说 + 决策调度"
  右圆："Rule Engine"标签，配齿轮+大脑图标，下方写"算 + 政策匹配 + 条件判断"
中间一道分隔线，上方箭头从 LLM 指向 Rule Engine（标"调 Tool"），下方箭头从 Rule Engine 指向 LLM（标"返回结构化结果"）
色调：左暖橙 + 右冷蓝
（注：复用已有图 images/00-design-principle.png）
-->

---

## 三、举一反三

把"SSP" 三个字盖住，你会发现整个架构其实是**一个通用的 Tool-Calling Agent 模板**：

> **结构化领域知识 + LLM 自然语言外壳 = 一个能解决领域复杂度的 AI 应用。**

这个模板可以套到很多地方。

**比如要做一个法律咨询 Agent**：

- 交互层不变（用户用自然语言描述纠纷）
- 推理层不变（LLM 决定调哪个 Tool）
- 执行层换成"法律条款检索 + 案例库查询 + 风险评估"
- 持久层存"用户案件、咨询历史、判例数据"
- 核心设计原则：**LLM 不解释法律条文细节，所有"判决预期" "诉讼建议"必须从结构化案例库出**

**比如要做一个医疗问诊助手**：

- 执行层换成"症状-疾病匹配引擎 + 药物相互作用规则库 + 检查项目推荐"
- 持久层多了"病史档案"
- 核心设计原则：**LLM 不下诊断，只做症状梳理 + 引导用户去医院**

**比如要做一个个人报税 Agent**：

- 执行层换成"税法规则引擎 + 收入分类计算 + 抵扣项推荐"
- 用户档案：收入流水、家庭情况、抵扣凭证
- 核心设计原则：**LLM 不口算税额，所有数字必须从税法引擎出**

**通用模板**：**任何"政策/规则随时变 + 个体情况差异大 + 数字必须算对"**的领域，都可以套这个架构。

社保、税务、签证、医疗、法律、教育——这些行业每个都有几十亿的市场。市面上的产品都还停留在"问卷调查"或"专家系统"的老套路。**Tool-Calling Agent 是把这些行业重做一遍的最好机会**。

---

## 四、小结

这一节，我们做了 5 件事：

- ✅ 看清楚社保计算到底为什么难（5 个维度交叉 + 政策每年变）
- ✅ 看清楚为什么不能直接问 ChatGPT（幻觉 / 训练数据过期 / 决策树太大）
- ✅ 鸟瞰 SSP 的四层架构（交互 / 推理 / 执行 / 持久）
- ✅ 跑通了 5 分钟快速体验
- ✅ 抽出了核心设计原则——**LLM 是嘴，规则引擎是脑**

![本节小结](images/00-summary.png)

<!-- 图片说明（给图片代理）：
风格：手绘小结卡片
内容：一张便签纸风格，上面手写：
  "本节核心 takeaway"
  ✓ 社保计算 = 5 维度 × 政策每年变
  ✓ LLM 幻觉 + 数据过期 = 不能直接问
  ✓ 四层架构：交互/推理/执行/持久
  ✓ LLM 是嘴，规则引擎是脑
  ✓ 5 min 跑起来：clone → install → env → seed → dev
便签纸右上角有个手绘的"S"圆章（SSP 的 logo）
色调：米白纸 + 黑色手写字 + 红色对勾
-->

**核心要点回顾**：

- **Agent 不是 Chatbot**：Chatbot 直接说话，Agent 先决定调 Tool 还是说话
- **架构四层独立**：每层职责清晰，可以独立替换或升级
- **规则引擎才是骨头**：24 条 JSON 规则解耦了"政策更新"和"代码部署"
- **持久化是基本盘**：没有 conversations 表，AI 就是金鱼

接下来的 28 节，会把这一节里"快速带过"的每个模块拆开。**强烈建议把 [`ssp-web`](https://github.com/jiji262/ssp-web) clone 下来跟着读**——读到哪节就 `git checkout chapter-NN`。

---

## 思考题

1. **【开放题】**：除了社保、税务、医疗、法律，你还能想到哪些行业适合用"LLM + 规则引擎"这套架构？为什么？这些行业里，哪些规则适合放进规则引擎，哪些更适合放在 Prompt 里？
2. **【动手题】**：clone `ssp-web`，跑通 `pnpm dev`，跟 AI 聊一轮，触发至少一次 `computePlan` 调用。**验收标准**：在浏览器开发者工具的 Network 面板里，能看到 `/api/chat` 的 SSE 响应里出现 `tool-call` 类型的 chunk，并且最后渲染出"工具结果卡片"（不是纯文本）。
3. **【选做】**：打开 `dsl/ssp_dsl_v1/rules/R-010-PARSE-BIRTH-YEAR.json` 看一下 24 条规则之一长啥样。如果你要加一条新规则"出生年份小于 1940 的用户应该报错"，你会怎么写？只看这一个文件的结构，能不能猜出来？

---

## 延伸阅读

- [Anthropic：Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)（行业反思"别上来就多 Agent"的奠基之作）
- [Vercel AI SDK v6 官方文档](https://sdk.vercel.ai/docs)（本课程主线 SDK）
- [ssp-web 项目仓库](https://github.com/jiji262/ssp-web)（配套实战代码）
- [Next.js 16 升级指南](https://nextjs.org/docs/app/guides/upgrading/version-16)（项目用的是 16.1.6）
- [JSONLogic 文档](https://jsonlogic.com/)（执行层规则引擎核心）

---

[← 上一节：开篇词](./00-prologue.md) · [📚 目录](./README.md) · [下一节：第 01 节 - AI Agent 到底是个啥 →](./02-what-is-agent.md)
