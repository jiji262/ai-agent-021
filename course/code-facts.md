# SSP-Web 代码事实表

> **目的**：作为本课程技术声明的唯一权威源（设计中称 Tech_Stack_Reference）。所有路径、行号、代码片段均直接抽取自配套实战仓库 `ssp-web`（本地真理源：`/Users/crimson/codes/0.myprojects/shebao/ssp-web`，发布地址 `https://github.com/jiji262/ssp-web`）。
>
> **使用规范**：写作子代理引用代码时，必须使用本表中给出的**真实仓库路径 + 行号**，并用 `\`\`\`ts` 围栏复制源码片段。**不允许编造 / 不允许改写**。如需修改，先回到源文件核对。
>
> **校准基线**：本表以 `ssp-web/package.json` 与 `ssp-web/src/` 真实工作树为准。下文凡出现仓库根，均指 `/Users/crimson/codes/0.myprojects/shebao/ssp-web/`。

---

## 1. 项目结构总览（深度 4）

```
ssp-web/                               # 仓库根：/Users/crimson/codes/0.myprojects/shebao/ssp-web/
├── data/                              # Excel/JSON 案例数据（4 个文件）
├── docs/architecture.md               # 唯一的架构文档（mermaid 图为主）
├── dsl/ssp_dsl_v1/                    # DSL 规则源（JSON 形式，发布前的真理）
│   ├── params/                        # 政策参数包（policy_params_shanghai_base.json）
│   ├── rule_sets/                     # 规则集定义（执行顺序）
│   ├── rules/                         # 24 条规则 JSON（每条一个文件）
│   ├── schema/                        # JSON Schema（DSL/params/user_profile）
│   ├── tests/                         # 从 examples 抽出的测试用例
│   ├── workflows/                     # 发布工作流定义
│   ├── README.md                      # DSL 设计说明
│   └── rules_manifest.json            # 规则清单（用于 Admin 列表）
├── public/                            # 5 个示例 SVG（next.svg 等，未实际使用）
├── scripts/
│   └── generate-showcase-cases.ts     # 调 OpenAI 批量生成案例
├── src/
│   ├── app/                           # Next.js 16 App Router
│   │   ├── (client)/                  # C 端：首页 + cases + chat
│   │   ├── admin/                     # Admin 后台：rules/params/rule-sets/tests/publish/cases
│   │   ├── api/                       # API 路由
│   │   │   ├── admin/                 # 受保护管理 API
│   │   │   ├── auth/[...nextauth]/    # NextAuth handler
│   │   │   ├── chat/                  # AI 对话流（route.ts + [conversationId]）
│   │   │   ├── conversations/         # 会话列表/详情/删除
│   │   │   ├── plan/                  # 直接调引擎的 REST API
│   │   │   └── showcase-cases/        # 案例展示数据
│   │   ├── fonts/                     # 自定义字体（空目录或本地字体）
│   │   └── layout.tsx                 # 根布局
│   ├── components/
│   │   ├── admin/                     # 预留目录（当前为空）
│   │   ├── chat/                      # ChatPanel、MessageBubble、ToolResultCard 等
│   │   ├── layout/                    # MarketingNav/Footer/PaperBackdrop
│   │   ├── ui/                        # 14 个基础 UI 组件
│   │   ├── wizard/                    # 6 步规划向导（已被 chat 取代但保留）
│   │   └── Providers.tsx              # SessionProvider 等顶层 Provider
│   ├── data/showcase-cases.ts         # 静态展示案例（10 个，532 行）
│   ├── lib/
│   │   ├── actions/                   # 预留目录（当前为空）
│   │   ├── admin/                     # publish-service.ts + params-service.ts
│   │   ├── ai/                        # AI 核心：agent / config / prompts / tools
│   │   ├── db/                        # Drizzle schema + queries + seed
│   │   ├── engine/                    # 规则引擎核心（8 个 .ts + __tests__/ 空目录）
│   │   ├── import/excel-import.ts     # 从 Excel 导入案例和测试
│   │   ├── security/                  # anon-session.ts + rate-limit.ts
│   │   ├── utils/cn.ts                # 类名合并
│   │   ├── validators/plan-input.ts   # Zod schema for plan API
│   │   ├── auth.ts                    # NextAuth v5 配置
│   │   └── logging.ts                 # 结构化日志
│   ├── proxy.ts                       # NextAuth middleware（保护 admin）
│   └── types/                         # 6 个类型文件
├── package.json
├── next.config.ts
├── drizzle.config.ts
├── tsconfig.json
├── vercel.json
└── README.md
```

> **说明**：`src/proxy.ts` 实际是 Next.js middleware（导出 `default auth(...)` 和 `config.matcher`），文件名虽是 proxy 但功能是中间件。`fonts/` 目录在 src/app 下存在但本仓库未填充自定义字体。`src/lib/actions/`、`src/components/admin/`、`src/lib/engine/__tests__/` 三个目录当前为空（预留），引用代码时不要指向其下的文件。

---

## 2. package.json 关键依赖

文件：`ssp-web/package.json`

| 依赖 | 版本 | 作用 |
|---|---|---|
| `next` | `16.1.6` | Next.js 16，App Router |
| `react` / `react-dom` | `19.2.3` | React 19 |
| `ai` | `^6.0.99` | **Vercel AI SDK v6**（streamText / tool / convertToModelMessages 入口） |
| `@ai-sdk/openai` | `^3.0.33` | OpenAI 模型 provider（createOpenAI） |
| `@ai-sdk/react` | `^3.0.103` | useChat React hook |
| `@assistant-ui/react` | `^0.12.14` | assistant-ui primitives（ThreadPrimitive 等） |
| `@assistant-ui/react-ai-sdk` | `^1.3.10` | 对接 ai-sdk 的 runtime（AssistantChatTransport） |
| `@assistant-ui/react-markdown` | `^0.12.5` | Markdown 渲染 |
| `next-auth` | `^5.0.0-beta.30` | NextAuth v5 (Auth.js) |
| `@auth/drizzle-adapter` | `^1.11.1` | NextAuth × Drizzle 适配器 |
| `bcryptjs` | `^3.0.3` | 密码 hash |
| `@neondatabase/serverless` | `^1.0.2` | Neon Postgres serverless driver |
| `drizzle-orm` | `^0.45.1` | Drizzle ORM |
| `drizzle-kit` | `^0.31.9` | Drizzle CLI（schema 推送） |
| `json-logic-js` | `^2.0.5` | **JSONLogic 规则引擎核心** |
| `ajv` / `ajv-formats` | `^8.18.0` / `^3.0.1` | JSON Schema 校验（DSL） |
| `zod` | `^4.3.6` | 运行时 schema 校验 |
| `xlsx` | `^0.18.5` | Excel 案例导入 |
| `lucide-react` | `^0.575.0` | 图标 |
| `tailwindcss` / `@tailwindcss/postcss` | `^4` | Tailwind CSS v4 |
| `tailwind-merge` / `clsx` | `^3.5.0` / `^2.1.1` | 类名合并工具 |
| `uuid` | `^13.0.0` | UUID 生成（request_id） |
| `dotenv` | `^17.3.1` | 环境变量加载（drizzle-kit / scripts） |
| `openai` (devDep) | `^6.25.0` | 仅在 scripts 使用，运行时不依赖 |

**npm scripts**（`package.json:5-11`）：
- `dev` → `next dev`
- `build` → `next build`
- `start` → `next start`
- `lint` → `eslint`
- `seed` → `npx tsx src/lib/db/seed/index.ts`

---

## 3. API 路由

### 3.1 完整路径列表

| 路径 | 文件 | 用途 |
|---|---|---|
| `POST /api/chat` | `src/app/api/chat/route.ts` (294 行) | **核心**：AI 对话流 SSE |
| `GET/DELETE /api/chat/[conversationId]` | `src/app/api/chat/[conversationId]/route.ts` (41) | 单会话操作 |
| `GET /api/conversations` | `src/app/api/conversations/route.ts` (35) | 列出当前 session 的会话 |
| `GET/DELETE /api/conversations/[conversationId]` | `src/app/api/conversations/[conversationId]/route.ts` (45) | 会话详情 |
| `POST /api/plan/compute` | `src/app/api/plan/compute/route.ts` (98) | 直接调引擎（绕过 LLM） |
| `GET /api/plan/[id]` | `src/app/api/plan/[id]/route.ts` (25) | 查 plan 持久化结果 |
| `GET /api/showcase-cases` | `src/app/api/showcase-cases/route.ts` (16) | 案例展示 |
| `GET /api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `*/api/admin/rules/...` | `src/app/api/admin/rules/route.ts` 等 | 管理：增删改查/版本/示例运行 |
| `*/api/admin/params/...` | `src/app/api/admin/params/...` | 参数管理 |
| `*/api/admin/rule-sets/...` | `src/app/api/admin/rule-sets/...` | 规则集 |
| `*/api/admin/tests/...` | `src/app/api/admin/tests/...` | 测试中心 |
| `*/api/admin/publish/{history,pipeline,promote,rollback}` | `src/app/api/admin/publish/...` | 发布流水线 |
| `*/api/admin/cases` | `src/app/api/admin/cases/route.ts` | 案例库 |
| `*/api/admin/import/{cases,tests}` | `src/app/api/admin/import/...` | Excel 导入 |
| `*/api/admin/stats` | `src/app/api/admin/stats/route.ts` | Dashboard |

### 3.2 `/api/chat/route.ts` 关键结构

文件：`ssp-web/src/app/api/chat/route.ts`

**顶部常量**（`route.ts:22-29`）：

```ts
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 20000;
const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW_MS = 60_000;
```

**主流程**（`route.ts:81-294`）：

1. `req.json()` 解析 + 字段类型校验（`isValidMessages`）
2. `ensureAnonymousSession(req, legacySessionId)` 取/建匿名 sessionId
3. `checkRateLimit('chat:' + clientIp, ...)` 限流
4. 长度门禁：`MAX_MESSAGES=40` / `MAX_TOTAL_CHARS=20000` / `MAX_MESSAGE_CHARS=4000`
5. 取/建 conversation：`getConversation(id)` → 校验 sessionId → 否则 `createConversation`
6. `convertToModelMessages(uiMessages)` 把 UIMessage 转为 ModelMessage
7. `createChatStream(messages, context)` 取得 streamText 结果
8. `result.toUIMessageStreamResponse({ originalMessages, onFinish, onError })` 返回 SSE
9. 流结束后 `onFinish` 回调把完整 messages 写库（`updateConversation`）
10. 错误分类：AI 错（503）/ 内部错（500）

**核心调用**（`route.ts:234-261`）：

```ts
const messages = await convertToModelMessages(uiMessages);
const result = createChatStream(messages, context);

const response = result.toUIMessageStreamResponse({
  originalMessages: uiMessages,
  onFinish: async ({ messages: persistedMessages }) => {
    try {
      await updateConversation(conversation.id, {
        messages: persistedMessages as unknown[],
        userProfile,
      });
    } catch (persistErr) {
      logger.warn("chat.persist_finish_failed", { ... });
    }
  },
  onError: (streamErr) => {
    logger.warn("chat.stream_error", { ... });
    return "抱歉，回复中断了。请发送"继续"，我会接着回答。";
  },
});
response.headers.set("x-conversation-id", conversation.id);
```

---

## 4. AI 核心模块（src/lib/ai/）

| 文件 | 关键导出 | 一句话说明 |
|---|---|---|
| `src/lib/ai/agent.ts` (80 行) | `createChatStream`, `ChatContext`, `ChatMessage` (= ModelMessage) | 包装 streamText，注入 system + tools |
| `src/lib/ai/prompts.ts` (322 行) | `SYSTEM_PROMPT`, `buildContextPrompt`, `AgentQuestion`, `UserProfileSummary` | 系统提示词 + 上下文拼接 |
| `src/lib/ai/tools.ts` (537 行) | `tools`, `computePlanTool`, `validateFieldTool`, `updateProfileTool` | 三个工具 + Zod schema |
| `src/lib/ai/config.ts` (51 行) | `getOpenAIConfig`, `OpenAIConfig` | 读 OPENAI_URL/KEY/MODEL 环境变量 |

### 4.1 streamText 调用结构（agent.ts:47-79）

```ts
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
    stopWhen: stepCountIs(8),    // 多步工具调用上限
    temperature: 0.3,            // 低温度，事实导向
    onFinish,
  });
}
```

### 4.2 System Prompt 位置

文件：`src/lib/ai/prompts.ts:10-169`，导出常量 `SYSTEM_PROMPT`。中文，包含 11 个 section：角色 / 核心规则（8 条） / 数据收集优先级（Tier 1/2/3） / 结果展示格式 / 回复表达规范 / 关键字段识别 / 2025 政策要点 / 置信度标注 / 标准注意事项 / 模糊输入处理 / 超范围问题 / 多轮对话策略。

8 条核心规则原文（`prompts.ts:14-23`）：
1. 绝不自行计算政策数字
2. 累积用户信息（合并新旧）
3. Tier 1 字段即刻计算
4. needs_agent=true 时追问
5. needs_agent=false 时展示结果
6. 诚实告知边界
7. 不收集敏感信息
8. 结构化记录用户信息（updateProfile 每轮一次）

### 4.3 Tool 定义（tools.ts）

三个工具，使用 `tool()` + `zodSchema(z.object(...))` 注册：

**Tool 1: `computePlan`**（tools.ts:174-266）
- inputSchema：嵌套 `basic` / `social` / `status` / `subsidy` / `mi` / `objective`（见 tools.ts:36-156）
- execute：调 `orchestrate({ user })` → 提取 needs_agent / questions / warnings / caveats → 构建 scenarios（`buildScenarios`） → 加补贴推荐（`adviseSubsidies`） → `savePlan` 持久化 → 返回 `{success, plan_id, needs_agent, questions, warnings, caveats, plan, calc, meta}`

**Tool 2: `validateField`**（tools.ts:270-279, 实现 402-536）
- 单字段格式校验，按 `field` switch（birth_year / birth_month / gender / female_retire_type / pension_contrib_months / medical_contrib_months / unemployment_insurance_years / employment_status / on_unemployment_benefit / has_employment_difficulty_cert / objective）

**Tool 3: `updateProfile`**（tools.ts:282-318）
- 客户端结构化提取，execute 直接 `return { updated: true, profile: params }`，让前端 `onFinish` 钩子合并到 `sessionProfile`

**导出聚合**（tools.ts:322-326）：
```ts
export const tools = {
  computePlan: computePlanTool,
  validateField: validateFieldTool,
  updateProfile: updateProfileTool,
};
```

---

## 5. 规则引擎（src/lib/engine/ + dsl/）

### 5.1 引擎模块清单

| 文件 | 关键导出 | 用途 |
|---|---|---|
| `src/lib/engine/orchestrator.ts` (239) | `orchestrate`, `orchestrateInMemory`, `executeSingleRuleInMemory`, `OrchestratorInput`, `OrchestratorResult` | **入口**：从 DB 加载规则 + 参数，按顺序执行 |
| `src/lib/engine/executor.ts` (80) | `executeRule` | 单条规则的决策表执行（hit_policy first/all） |
| `src/lib/engine/actions.ts` (338) | `executeAction`, `getDeep`, `setDeep` | 6 种 action 处理（set/lookup/call/emit_question/emit_warning/emit_caveat） |
| `src/lib/engine/json-logic.ts` (103) | `evaluateJsonLogic`, `isJsonLogicExpression` | JSONLogic 求值 + 自定义算子 `intersects/ceil/floor` |
| `src/lib/engine/builtins.ts` (230) | `getBuiltinFunction`, `listBuiltinFunctions` | 内置函数：parse_birth_year, normalize_gender, make_date, date_add_years, date_diff_months, date_year, date_month, date_add_years_months, **compute_delayed_retire_age** |
| `src/lib/engine/scenario-builder.ts` (302) | `buildScenarios`, `Scenario`, `ScenarioPhase` | 多场景对比（早退 vs 晚退） |
| `src/lib/engine/subsidy-advisor.ts` (200) | `adviseSubsidies`, `SubsidyRecommendation` | 4050 / 大龄岗补 / 失业金 / 老失业过渡 |
| `src/lib/engine/test-runner.ts` (283) | `runTestCase`, `TestCase`, `TestResult`, `DiffEntry` | 单元测试运行（含 params 三层合并） |

### 5.2 ctx 数据结构（src/types/engine.ts:3-8）

```ts
export interface RuleContext {
  user: Record<string, unknown>;     // 用户输入
  params: Record<string, unknown>;   // 政策参数（按 as_of_date 加载）
  calc: Record<string, unknown>;     // 中间计算
  plan?: Record<string, unknown>;    // 最终规划输出
}
```

实际运行时（orchestrator.ts:62-68）：

```ts
const ctx: any = {
  user: structuredClone(input.user),
  params: flatParams,
  calc: {},
  plan: {},
};
```

### 5.3 Action 类型（types/engine.ts:23-77）

6 种 action：

```ts
export type Action =
  | SetAction              // { type: "set", path, value }
  | LookupAction           // { type: "lookup", table_param_id, key, into, into_map? }
  | CallAction             // { type: "call", fn, args, into }
  | EmitQuestionAction     // { type: "emit_question", value: { question_id, text, field? } }
  | EmitWarningAction      // { type: "emit_warning", value: { warning_id, text } }
  | EmitCaveatAction;      // { type: "emit_caveat", value: { caveat_id, text, confidence, source? } }
```

### 5.4 24 条规则（命名规范 `R-XXX-NAME-IN-CAPS`）

文件夹：`ssp-web/dsl/ssp_dsl_v1/rules/`，每条一个 `.json`。

按 `rule_set_shanghai_plan_v1.json` 的执行顺序：

| 序号 | rule_id | 模块 | 作用 |
|---|---|---|---|
| 1 | `R-010-PARSE-BIRTH-YEAR` | normalization | 解析"73年" → 1973 |
| 2 | `R-011-BUILD-BIRTH-DATE` | normalization | 拼接 birth_date |
| 3 | `R-012-NORMALIZE-GENDER` | normalization | "男/女" → male/female |
| 4 | `R-020-FEMALE-RETIRE-TYPE` | normalization | 女性退休口径（worker50/cadre55） |
| 5 | `R-110-LOOKUP-LEGAL-RETIRE-AGE` | retirement | 查表+算法计算法定退休年龄 |
| 6 | `R-115-FLEXIBLE-RETIREMENT` | retirement | 弹性退休（提前/延迟最多 3 年） |
| 7 | `R-120-COMPUTE-RETIRE-DATE` | retirement | 计算法定退休日期 |
| 8 | `R-200-MIN-PENSION-YEARS` | pension | 最低缴费年限（2030 起 15→20） |
| 9 | `R-210-PENSION-GAP` | pension | 养老缺口月数 |
| 10 | `R-220-MEDICAL-LIFETIME-GAP` | medical | 医保终身待遇缺口 |
| 11 | `R-300-MI-GAP-MONTHS` | medical | 医保断缴月数 |
| 12 | `R-310-MI-WAITING-PERIOD` | medical | 医保等待期 |
| 13 | `R-400-UNEMPLOYMENT-ELIGIBILITY` | unemployment | 失业金资格 |
| 14 | `R-410-UNEMPLOYMENT-DURATION` | unemployment | 失业金可领月数 |
| 15 | `R-420-UI-MEDICAL-COVERAGE` | unemployment | 失业期间医保 |
| 16 | `R-500-4050-ELIGIBILITY` | subsidy | 4050 补贴资格 |
| 17 | `R-510-4050-AMOUNT` | subsidy | 4050 补贴金额 |
| 18 | `R-520-JOB-SUBSIDY-ELIGIBILITY` | subsidy | 大龄岗位补贴资格 |
| 19 | `R-521-JOB-SUBSIDY-AMOUNT` | subsidy | 大龄岗位补贴金额 |
| 20 | `R-530-OLDER-UI-PENSION-FUND-COVERAGE` | subsidy | 老失业人员养老金过渡 |
| 21 | `R-540-SUBSIDY-MUTUAL-EXCLUSION` | subsidy | 补贴互斥 |
| 22 | `R-600-PAY-GAP-REMINDER` | reminder | 缴费断档提醒 |
| 23 | `R-700-PLAN-TEMPLATE` | plan | 规划模板装配 |
| 24 | `R-900-FINAL-GATE` | gate | 最终安全门（缺字段则 needs_agent=true） |

执行顺序由 `rule_set_shanghai_plan_v1.json` 的 `rules` 数组决定（rule_set_shanghai_plan_v1.json:6-31）。

### 5.5 JSONLogic 使用（json-logic.ts:1-43）

```ts
import jsonLogic from "json-logic-js";

jsonLogic.add_operation("intersects", (a, b) => Array.isArray(a) && Array.isArray(b) && a.some(x => b.includes(x)));
jsonLogic.add_operation("ceil", (x) => Math.ceil(typeof x === "number" ? x : x[0]));
jsonLogic.add_operation("floor", (x) => Math.floor(typeof x === "number" ? x : x[0]));

export function evaluateJsonLogic(logic: unknown, data: unknown): any {
  if (logic === null || logic === undefined) return logic;
  if (typeof logic !== "object") return logic;
  // Empty object {} is always-true (catch-all pattern)
  if (Object.keys(logic as object).length === 0) return true;
  return jsonLogic.apply(logic as any, data as any);
}
```

### 5.6 规则示例（R-010 第 1-50 行）

```json
{
  "dsl_version": "SSP-DSL-1.0",
  "rule_id": "R-010-PARSE-BIRTH-YEAR",
  "name": "解析出生年份（支持"73年=1973"）",
  "module": "normalization",
  "status": "published",
  "priority": 10,
  "effective_from": "2024-01-01",
  "decision_table": {
    "hit_policy": "first",
    "rows": [
      {
        "row_id": "row_2_parse_text",
        "when": {
          "and": [
            { "==": [{ "var": "user.basic.birth_year" }, null] },
            { "!=": [{ "var": "user.basic.birth_year_text" }, null] }
          ]
        },
        "then": {
          "actions": [
            {
              "type": "call",
              "fn": "parse_birth_year",
              "args": { "text": { "var": "user.basic.birth_year_text" } },
              "into": "user.basic.birth_year"
            }
          ]
        }
      }
    ]
  }
}
```

### 5.7 引擎入口 orchestrate（orchestrator.ts:41-134）

```ts
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  const ruleSetId   = input.rule_set_id ?? input.ruleSetId ?? "RS-SHANGHAI-PLAN-V1";
  const policyPackId = input.policy_pack_id ?? input.policyPackId ?? "SHANGHAI_BASE";
  const asOfDate    = input.as_of_date ?? input.asOfDate ?? new Date().toISOString().split("T")[0];

  const [{ ruleSet, rules: effectiveRules }, effectiveParams] = await Promise.all([
    getEffectiveRules(ruleSetId, asOfDate),
    getEffectiveParams(policyPackId, asOfDate),
  ]);

  const flatParams = flattenParams(effectiveParams);
  const ctx: any = { user: structuredClone(input.user), params: flatParams, calc: {}, plan: {} };

  const orderedRuleIds = (ruleSet?.rules as string[]) ?? [];
  for (const ruleId of orderedRuleIds) {
    const dbRule = ruleMap.get(ruleId);
    if (!dbRule) continue;
    const ruleDef: RuleDefinition = { /* DB row → DSL */ };
    const result = executeRule(ruleDef, ctx);
    allTrace.push(...result.trace);
    if (ruleId === "R-120-COMPUTE-RETIRE-DATE") autoComputeMonthsToRetire(ctx, asOfDate);
  }

  return { plan: ctx.plan, calc: ctx.calc, user: ctx.user, trace: allTrace, meta: {...}, effectiveRules: ruleDefs, flatParams };
}
```

---

## 6. 数据库（src/lib/db/）

### 6.1 schema 定义（src/lib/db/schema.ts，全 11 张表，PG）

| 表 | 行号 | 主键 | 关键字段 |
|---|---|---|---|
| `rules` | 15-36 | `serial id` | rule_id, name, module, decision_table (jsonb), status, effective_from, version |
| `params` | 40-57 | `serial id` | policy_pack_id, param_id, type, value (jsonb), rows (jsonb), key_fields, value_fields, status |
| `policy_pack_versions` | 61-69 | `serial id` | policy_pack_id, version, param_snapshot, status |
| `rule_sets` | 73-84 | `serial id` | rule_set_id, rules (jsonb 数组), conflict_resolution, status |
| `workflows` | 88-99 | `serial id` | workflow_id, stages, rollback_policy, canary, audit_config |
| `publishes` | 103-114 | `serial id` | entity_type, entity_id, from_stage, to_stage, actor, gate_results, diff |
| `plans` | 118-129 | `uuid id` | user_input, calc_result, plan_output, trace, rule_set_version, policy_pack_version, conclusion_level, as_of_date |
| `conversations` | 133-140 | `uuid id` | session_id, messages (jsonb), user_profile (jsonb), createdAt, updatedAt |
| `showcase_cases` | 144-158 | `serial id` | case_uid, title, tags, user_message, ai_response, input_data, expected_data, is_published, sort_order |
| `cases` | 162-176 | `serial id` | case_uid, creator, post_date, video_id, topics, case_text, transcript_text, tags, is_regression |
| `tests` | 180-192 | `serial id` | name, rule_id, input, params_override, expected, source, last_run_result, last_run_at |

`Drizzle` import（schema.ts:1-11）：`pgTable, serial, text, integer, boolean, jsonb, timestamp, date, uuid` from `drizzle-orm/pg-core`。

### 6.2 db 实例（src/lib/db/index.ts，懒加载 Proxy）

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;
function getInstance() {
  if (!_db) _db = drizzle(neon(process.env.DATABASE_URL!), { schema });
  return _db;
}
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, prop) {
    const v = getInstance()[prop as keyof typeof _db];
    return typeof v === "function" ? v.bind(getInstance()) : v;
  },
});
```

### 6.3 queries.ts（538 行，关键函数）

| 函数 | 行 | 说明 |
|---|---|---|
| `getEffectiveRules(ruleSetId, asOfDate)` | 24-64 | 联表取规则集 + 该日期下生效的规则版本 |
| `getRule(ruleId, version?)` | 67-81 | 单规则查询 |
| `listRules(filters)` | 84-97 | 列表 |
| `listRuleVersions(ruleId)` | 100-106 | 单规则历史版本 |
| `insertRule` / `updateRule` | 109-125 | 写入 |
| `getEffectiveParams(policyPackId, asOfDate)` | 133-160 | 取生效参数（按 effective_from 去重） |
| `listParams` / `insertParam` / `updateParam` | 163-198 | 参数 CRUD |
| `getRuleSet` / `listRuleSets` / `insertRuleSet` / `updateRuleSet` | 203-238 | 规则集 |
| `getWorkflow` / `insertWorkflow` | 243-256 | 工作流 |
| `getLatestPolicyPackVersion` / `insertPolicyPackVersion` | 262-284 | 政策包版本 |
| `insertPublish` / `listPublishes` | 289-301 | 发布历史 |
| `savePlan` / `getPlan` / `listPlans` | 306-325 | 方案持久化 |
| `listShowcaseCases` / `insertShowcaseCases` / `countShowcaseCases` | 330-352 | 案例展示 |
| `listCases` / `insertCase` / `insertCases` | 357-379 | 案例库 |
| `listTests` / `insertTest` / `insertTests` / `updateTestResult` / `getTest` | 384-430 | 测试 |
| `createConversation` / `getConversation` / `updateConversation` / `listConversations` / `deleteConversation` | 435-513 | **会话 CRUD（核心）** |
| `countRules` / `countParams` / `countTests` | 517-538 | Dashboard 计数 |

### 6.4 seed（src/lib/db/seed/）

- `index.ts`（46 行）：4 阶段 — `seedRules` → `seedParams` → `seedMisc`（rule_set + workflow + tests） → 可选 `importCases` + `importRegressionTests`
- `seed-rules.ts`（80）：扫 `dsl/ssp_dsl_v1/rules/*.json`，逐条 upsert 到 `rules` 表（version=1）
- `seed-params.ts`（143）：读 `policy_params_shanghai_base.json`，分别 upsert scalar params 与 table params
- `seed-misc.ts`（153）：读 rule_set / workflow / tests JSON，upsert

### 6.5 migrations

⚠️ 仓库未提供独立 SQL migration 文件夹。Schema 通过 `drizzle-kit push`（README.md:47）直接同步到数据库；`drizzle.config.ts:7` 输出目录是 `./drizzle/` 但仓库未 commit 该目录。

---

## 7. 认证与会话（src/lib/auth.ts + src/lib/security/）

### 7.1 NextAuth 配置（src/lib/auth.ts，53 行）

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        if (!adminUsername || !adminPasswordHash) return null;
        if (credentials.username !== adminUsername) return null;
        const isValid = await bcrypt.compare(credentials.password as string, adminPasswordHash);
        if (!isValid) return null;
        return { id: "admin", name: adminUsername, email: `${adminUsername}@admin.local` };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
});
```

**关键事实**：
- 单管理员账户（仅 `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`）
- bcrypt 密码 hash
- JWT session 策略（无数据库 session 表）
- 登录页：`/admin/login`

### 7.2 中间件（src/proxy.ts，35 行 — 文件名 proxy 但功能是 middleware）

```ts
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  if (pathname.startsWith("/api/admin/")) {
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!session) return NextResponse.redirect(new URL("/admin/login?callbackUrl=" + pathname, req.url));
  }
  return NextResponse.next();
});
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
```

### 7.3 匿名会话（src/lib/security/anon-session.ts，54 行）

C 端不登录，用 cookie 区分匿名用户：

```ts
export const ANON_SESSION_COOKIE_NAME = "ssp-anon-session";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天
function isValidSessionId(v): v is string { return /^[a-zA-Z0-9-]{16,128}$/.test(v); }
function createSessionId() { return crypto.randomUUID(); }

export function ensureAnonymousSession(req, fallbackSessionId?) {
  const existing = req.cookies.get(ANON_SESSION_COOKIE_NAME)?.value;
  if (isValidSessionId(existing)) return { sessionId: existing, isNewSession: false };
  if (isValidSessionId(fallbackSessionId)) return { sessionId: fallbackSessionId, isNewSession: true };
  return { sessionId: createSessionId(), isNewSession: true };
}
```

Cookie 标志：`HttpOnly; SameSite=Lax; Secure（仅 production）`。

### 7.4 限流（src/lib/security/rate-limit.ts，102 行）

进程内 in-memory 桶（`globalThis.__sspRateLimitBuckets: Map`）。
- 客户端 IP：`getClientIp(req)` 读 `x-forwarded-for` / `x-real-ip`
- 接口：`checkRateLimit(key, { limit, windowMs })` → `{ allowed, remaining, resetAt, retryAfterSeconds }`
- chat 配置：30 / 60s（route.ts:28-29）；plan 配置：12 / 60s（plan/compute/route.ts:17-18）
- 响应头：`x-ratelimit-limit/remaining/reset` + `retry-after`

### 7.5 PII 处理

System Prompt 第 7 条（`prompts.ts:21`）：**不收集姓名、身份证号、手机号、地址等敏感信息**。

数据库 `conversations.user_profile` 仅保存非 PII 结构化字段（gender, birth_year, birth_month, contrib_months 等，详见 `types/user-profile.ts`）。

---

## 8. 前端组件

### 8.1 Chat 模块（src/components/chat/）

| 文件 | 行 | 关键导出 | 说明 |
|---|---|---|---|
| `ChatPanel.tsx` | 528 | `ChatPanel`, `ChatPanelProps` | **核心**：assistant-ui 集成 + useChat + AssistantChatTransport |
| `MessageBubble.tsx` | 156 | `MessageBubble` | 旧版气泡（手写 markdown 解析），实际未在 ChatPanel 中用 |
| `ToolResultCard.tsx` | 708 | `ToolResultCard` | 渲染 computePlan / validateField 工具结果（场景对比 + 补贴推荐 + caveats） |
| `ChatInput.tsx` | 90 | `ChatInput` | 旧版输入框（含 IME 处理），ChatPanel 用了 ComposerPrimitive 替代 |
| `ConversationList.tsx` | 249 | `ConversationList`, `ConversationItem` | 左侧会话列表（删除/切换） |
| `conversation-runtime.ts` | 49 | `createConversationTrackingFetch`, `CONVERSATION_ID_RESPONSE_HEADER`, `getConversationRestoreErrorMessage`, `shouldRestoreConversationFromUrl` | fetch 包装：从响应头读 `x-conversation-id` |
| `conversation-runtime.test.ts` | 81 | （测试文件） | 仓库唯一的单元测试 |

**ChatPanel 关键调用**（ChatPanel.tsx:354-390）：

```ts
const transport = useMemo(() => new AssistantChatTransport({
  api: "/api/chat",
  fetch: createConversationTrackingFetch(handleConversationReady),
  prepareSendMessagesRequest: async (options) => ({
    ...options,
    body: {
      ...body,
      id: options.id,
      messages: options.messages,
      trigger: options.trigger,
      messageId: options.messageId,
      metadata: options.requestMetadata,
      conversationId,
      sessionId,
      questions,
      userProfile: sessionProfile,
      planId,
    },
  }),
}), [conversationId, handleConversationReady, planId, questions, sessionId, sessionProfile]);

const chat = useChat({ id: conversationId, transport, messages: initialMessages ?? [], onFinish });
const runtime = useAISDKRuntime(chat);
```

`onFinish`（ChatPanel.tsx:396-441）扫描 `message.parts`，对 `tool-computePlan` / `tool-updateProfile` 的结果做副作用（更新 planId / deepMerge profile）。

### 8.2 Admin 页面（src/app/admin/）

| 路径 | 文件 | 行 | 用途 |
|---|---|---|---|
| `/admin` | `page.tsx` | 277 | Dashboard（统计 / 快速入口） |
| `/admin/login` | `login/page.tsx` | 101 | 登录表单 |
| `/admin/rules` | `rules/page.tsx` | 430 | 规则列表（含筛选/搜索） |
| `/admin/rules/[ruleId]` | `rules/[ruleId]/page.tsx` | 371 | 规则详情 + JSON 编辑器 + 跑示例 |
| `/admin/rule-sets` | `rule-sets/page.tsx` | 254 | 规则集编辑（拖拽排序） |
| `/admin/params` | `params/page.tsx` | 256 | 参数列表 + 编辑 |
| `/admin/tests` | `tests/page.tsx` | 291 | 测试中心（运行 + diff） |
| `/admin/cases` | `cases/page.tsx` | 245 | 案例库 |
| `/admin/publish` | `publish/page.tsx` | 293 | 发布流水线（draft → staging → production） |
| `/admin/layout.tsx` | 11 行 | 包裹 AdminLayoutClient |
| `/admin/AdminLayoutClient.tsx` | 104 | 侧边栏 + 顶部 |

### 8.3 Wizard 模块（src/components/wizard/，旧版交互，现已被 chat 取代）

| 文件 | 行 |
|---|---|
| `WizardLayout.tsx` | 29 |
| `steps/BasicInfoStep.tsx` | 99 |
| `steps/ContributionStep.tsx` | 101 |
| `steps/MedicalStep.tsx` | 33 |
| `steps/ObjectiveStep.tsx` | 92 |
| `steps/StatusStep.tsx` | 47 |
| `steps/SubsidyStep.tsx` | 79 |

### 8.4 UI 共享组件（src/components/ui/，14 个）

`Alert / Badge / Button / Card / Checkbox / Input / JsonEditor / LoadingSpinner / PageHeader / RadioGroup / Select / StepIndicator / Table / Tabs`。每个一个文件。

### 8.5 客户端入口（src/app/(client)/）

| 路径 | 文件 | 行 |
|---|---|---|
| `/` | `page.tsx` | 147 |
| `/cases` | `cases/page.tsx` (95) + `cases/CaseGrid.tsx` (372) |
| `/chat` | `chat/page.tsx` (20) + `chat/ChatPageClient.tsx` (310) |
| Layout | `layout.tsx` (11) |

---

## 9. 类型定义（src/types/）

| 文件 | 行 | 关键 type/interface |
|---|---|---|
| `engine.ts` | 139 | `RuleContext`, `DecisionTable`, `DecisionRow`, `Action` (= 6 种 union), `RuleDefinition`, `Input`, `Output`, `ParameterRef`, `Example`, `TraceEntry`, `EngineResult` |
| `dsl.ts` | 103 | `RuleDSL`, `DSLInput`, `DSLOutput`, `DSLParameterRef`, `DSLDecisionTable`, `DSLDecisionRow`, `DSLAction` (5 种 union), `DSLExample` |
| `params.ts` | 48 | `PolicyPack`, `ScalarParam`, `TableParam`, `TableRow`, `ParamValue`, `TimelineParam`, `TimelineRow` |
| `user-profile.ts` | 60 | `UserProfile`, `UserProfileBasic`, `UserProfileSocial`, `UserProfileStatus`, `UserProfileSubsidy`, `UserProfileMI`, `UserObjective` |
| `api.ts` | 68 | `PlanComputeRequest/Response`, `TestRunRequest/Response`, `PublishPromoteRequest/Response`, `RuleListItem`, `RuleDetailResponse` |
| `admin.ts` | 60 | `RuleListItem`, `ParamListItem`, `RuleSetListItem`, `PublishRecord`, `TestResult` |

> **注意**：`engine.ts` 与 `dsl.ts` 有重叠（前者是运行时，后者是序列化形态）。`api.ts:RuleListItem` 与 `admin.ts:RuleListItem` 同名但定义略不同 — 引用时要看清 import 来源。

---

## 10. 数据文件（data/ 与 src/data/）

### 10.1 `ssp-web/data/`

| 文件 | 用途 |
|---|---|
| `independent_cases_with_full_transcripts_v5.xlsx` | 原始访谈案例（含完整对话） |
| `runnable_testdata_from_cases_v5.xlsx` | 可执行的测试用例（input/expected） |
| `ssp-test-cases-from-transcripts.xlsx` | 转录用例 |
| `test-cases-from-transcripts.json` | 上面的 JSON 版（供 generate-showcase-cases.ts 读取） |

### 10.2 `ssp-web/src/data/showcase-cases.ts` (532 行)

导出 `showcaseCases: ShowcaseCase[]`（10 个精选案例），每个含 `id, title, tags, userMessage, aiResponse`。仓库内静态数据，可作为 fallback。

```ts
export interface ShowcaseCase {
  id: string;
  title: string;
  tags: string[];
  userMessage: string;
  aiResponse: string;
}
```

### 10.3 `ssp-web/dsl/ssp_dsl_v1/params/policy_params_shanghai_base.json` (327 行)

政策包 ID：`SHANGHAI_BASE`，as_of：`2026-02-26`。

**26 个 scalar params**（部分摘录）：
`P-SH-CONTRIB-BASE-LOWER`(7460元/月) / `P-SH-CONTRIB-BASE-UPPER`(37302) / `P-SH-PENSION-RATE-EMPLOYER`(0.16) / `P-SH-PENSION-RATE-EMPLOYEE`(0.08) / `P-SH-PENSION-RATE-FLEX`(0.20) / `P-SH-MEDICAL-RATE-EMPLOYER`(0.09) / `P-SH-MEDICAL-RATE-EMPLOYEE`(0.02) / `P-SH-MEDICAL-RATE-FLEX`(0.10) / `P-SH-UNEMPLOYMENT-RATE-EMPLOYER/EMPLOYEE`(0.005/0.005) / `P-SH-MI-WAITING-PERIOD-MONTHS`(2) / `P-SH-MI-GAP-WAIVER-MONTHS`(3) / `P-SH-4050-SUBSIDY-RATE`(0.5) / `P-SH-4050-MAX-YEARS-GENERAL`(3) / `P-SH-4050-MAX-YEARS-NEAR-RETIRE`(8) / `P-SH-JOB-SUBSIDY-RATE-MINWAGE` / `P-SH-UNEMPLOYMENT-MAX-MONTHS` / `P-SH-UNEMPLOYMENT-BENEFIT-{TIER1,TIER2,EXTENDED}` / `P-SH-MEDICAL-LIFETIME-{REQUIRED,MALE,FEMALE}-YEARS` / `P-SH-PAY-GAP-AFFECTS-NEXT-MONTH` / `T-SH-PAY-GAP-MONTHS` / `P-SH-MIN-WAGE`。

**3 个 table params**：
- `T-RETIREMENT-AGE-LOOKUP`：退休年龄映射表（gender + female_retire_type + birth_year_range → age）
- `T-MIN-PENSION-YEARS-BY-RETIRE-YEAR`：按退休年份的最低缴费年限
- `T-SH-UNEMPLOYMENT-DURATION-BY-YEARS`：失业金可领月数 × 缴费年限

### 10.4 `ssp-web/dsl/ssp_dsl_v1/rules_manifest.json`

24 条规则的清单（Admin 列表用）。

### 10.5 其他 DSL 资源

- `dsl/ssp_dsl_v1/schema/` — 3 个 JSON Schema：`ssp_rule_dsl.schema.json` / `ssp_policy_params.schema.json` / `user_profile.schema.json`
- `dsl/ssp_dsl_v1/tests/` — `rule_examples_as_tests.json`（自动从 examples 抽取） + `test-delayed-retirement-2025.json`（专项测试）
- `dsl/ssp_dsl_v1/workflows/publish_workflow_default.json` — 发布流水线定义

---

## 11. 配置文件

### 11.1 `next.config.ts` (10 行)

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "xlsx"],
};
```

仅声明：bcryptjs 和 xlsx 不打包（Node.js native 模块）。无 standalone 输出。

### 11.2 `drizzle.config.ts` (12 行)

```ts
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### 11.3 `vercel.json` (8 行)

```json
{
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 30 }
  }
}
```

⚠️ README.md 第 81 行写的是 `hkg1`，但 `vercel.json` 实际是 `iad1`（美东） — **以 vercel.json 为准**。

### 11.4 `tsconfig.json` 关键项

- `"target": "ES2017"` / `"module": "esnext"` / `"moduleResolution": "bundler"`
- `"strict": true`
- `"jsx": "react-jsx"`
- `"paths": { "@/*": ["./src/*"] }` — 别名 `@/`
- `"plugins": [{ "name": "next" }]`

### 11.5 环境变量（README.md:24-35）

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✓ | Neon PG 连接（带 `?sslmode=require`） |
| `NEXTAUTH_SECRET` | ✓ | session 加密 |
| `NEXTAUTH_URL` | ✓ | 站点 URL |
| `ADMIN_USERNAME` | ✓ | 管理员账号 |
| `ADMIN_PASSWORD_HASH` | ✓ | bcrypt hash |
| `OPENAI_URL` | 可选 | 默认 `https://api.openai.com/v1`，cr_ 前缀 key 必填 |
| `OPENAI_BASE_URL` | 可选 | OPENAI_URL 的别名 |
| `OPENAI_API_KEY` | ✓ | API key |
| `OPENAI_MODEL` | ✓ | 模型名（如 `gpt-4o-mini`） |

---

## 12. Scripts

`ssp-web/scripts/` 下只有 1 个：

| 脚本 | 行 | 用途 |
|---|---|---|
| `generate-showcase-cases.ts` | 较长 | 读 `data/test-cases-from-transcripts.json`，调 OpenAI 生成结构化 AI 回复，批量插入 `showcase_cases` 表。运行：`npx tsx scripts/generate-showcase-cases.ts` |

入库流程（generate-showcase-cases.ts:17-46）：
1. 加载 `dotenv` + 取 `DATABASE_URL` / OpenAI 配置
2. `neon(DATABASE_URL)` + `drizzle()` 建实例
3. `createOpenAI({ apiKey, baseURL })`
4. 用 `streamText` 按用户消息生成回复
5. 写入 `showcase_cases`

---

## 13. 现有文档（docs/architecture.md）

唯一文档，267 行，**全部以 mermaid 图表呈现**：

| 图 | 内容 |
|---|---|
| 系统总览（graph TB） | 用户 → /api/chat → LLM → tools → 引擎 → DB |
| 四层架构（block-beta） | 交互层 / 推理层 / 执行层 / 持久层 |
| AI Agent 对话流程（sequenceDiagram） | 6 步：用户 → useChat → API → LLM → 引擎 → 返回 |
| 规则引擎流水线（flowchart LR） | R-010 → R-012 → ... → R-700 → R-900 |
| 场景构建器（flowchart TB） | orchestrate → 3 个变体 → enrichedCalc |
| 工具系统（flowchart LR） | LLM 三种 tool_call 路径 |
| System Prompt 分层（pie） | 4 个 section 占比 |
| 会话持久化（stateDiagram-v2） | 新建 → 收集Tier1 → 计算 → 追问 → 展示 → 存档 |
| 消息转换管道（flowchart LR） | UIMessage → ModelMessage → SSE → parts |
| 安全防御层（flowchart TB） | 网络/应用/AI/数据 4 层（部分 TODO） |
| 可观测性（flowchart TB） | request_id → log/trace/metrics |
| 数据模型（erDiagram） | conversations / plans / rules / params / rule_sets |

⚠️ docs 仅 1 个文件，无独立的 README / contributing / runbook 等。

---

## 教程引用规范

写作子代理引用此仓库代码时，必须遵守：

### 1. 路径规范

- **必须使用真实仓库路径**，前缀 `ssp-web/`（本地真理源 `/Users/crimson/codes/0.myprojects/shebao/ssp-web/`）
- 在课程正文里展示给读者时，可以省略前缀，写为相对路径，如 `src/lib/ai/agent.ts`
- **绝不写"大概在 lib 下面"这种模糊描述**

### 2. 行号规范

- 引用时给出 **行号区间**，例如：`src/app/api/chat/route.ts:81-294`（POST handler）
- 摘录代码段时在围栏前一行注明：`// src/lib/ai/agent.ts:47-79`
- 如果该函数移动过位置，先回到本文件第 1 节的真实路径核对

### 3. 摘录规范

- **不要改写代码**：所有 ts/json 片段必须**逐字符复制自源文件**
- 中文 prompt 内容（含全角引号、emoji、空格）也必须原样复制
- 如要省略中间，使用 `// ...` 或 `// ... (omitted)` 明示
- 摘录长度建议 **30-60 行**，过长拆成多块

### 4. 数字与版本

- 包版本号引用 `package.json` 第 12-51 行的实际值
- 政策数字（基数 7460、费率 16% 等）引用 `dsl/ssp_dsl_v1/params/policy_params_shanghai_base.json`，不要凭印象写
- 规则总数 = **24 条**（见 `rule_set_shanghai_plan_v1.json:6-31`），不是 23、25
- 工具总数 = **3 个**（computePlan / validateField / updateProfile），见 `tools.ts:322-326`

### 5. 容易踩坑的点

- `vercel.json` 是 `iad1`，README 写的 `hkg1` 是过期信息 → 引用部署区域时以 vercel.json 为准
- `src/proxy.ts` 实际是 Next.js middleware（文件名误导）
- `next-auth` 是 v5 beta（`^5.0.0-beta.30`），API 不同于 v4
- `ai` 包是 v6（`^6.0.99`），`tool` 函数签名是 `tool({ description, inputSchema: zodSchema(...), execute })`，不是 v3/v4 的旧形式
- `streamText` 的 `stopWhen: stepCountIs(8)` 是多步工具调用的关键参数，**不要写成 maxSteps**
- `temperature: 0.3`、`store: false`、`MAX_MESSAGES=40`、`CHAT_RATE_LIMIT=30/min` 都是源码硬编码值
- 引擎执行顺序由 **rule_set 的 rules 数组**决定（不是按 priority），priority 仅用于 admin UI 排序
- `R-110` 同时使用 lookup（参数表）+ call（compute_delayed_retire_age 内置函数），后者优先级低（先 lookup 后 fallback）
- 匿名 cookie 名是 `ssp-anon-session`，sessionId 校验正则 `/^[a-zA-Z0-9-]{16,128}$/`

### 6. 链接到具体节

- 第 1 章（项目结构）→ 引用第 1 节
- 第 2 章（依赖技术栈）→ 引用第 2 节 + 第 11 节
- 第 3 章（API 设计）→ 引用第 3 节
- 第 4-5 章（AI Agent 与工具）→ 引用第 4 节
- 第 6-8 章（规则引擎/DSL/JSONLogic）→ 引用第 5 节 + 第 10.3 节
- 第 9 章（数据库）→ 引用第 6 节
- 第 10 章（认证安全）→ 引用第 7 节
- 第 11-12 章（前端）→ 引用第 8 节
- 第 13 章（类型系统）→ 引用第 9 节
- 第 14 章（部署/运维）→ 引用第 11 节 + 第 12 节
- 第 15 章（文档/扩展）→ 引用第 13 节

### 7. 文档版本

本表以配套仓库 `ssp-web`（本地真理源 `/Users/crimson/codes/0.myprojects/shebao/ssp-web`，发布地址 `https://github.com/jiji262/ssp-web`）`main` 分支当前工作树为准。如未来源代码有更新，请重新核对每条引用。本表的唯一真相源 = 上述路径下的 git 工作树。
