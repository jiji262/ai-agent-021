# 配套代码评估报告 · ssp-web 是否需要按最新推荐技术方案更新

> **评估日期**：2026-05-30（依赖最新稳定版均以该日 npm registry `latest` dist-tag 实测为准）
> **评估对象**：配套实战项目 `ssp-web`（本地真理源：`/Users/crimson/codes/0.myprojects/shebao/ssp-web`，发布地址 `https://github.com/jiji262/ssp-web`）
> **基线来源**：`ssp-web/package.json`、`ssp-web/next.config.ts`、`ssp-web/vercel.json`、`ssp-web/drizzle.config.ts`，以及 `course/code-facts.md`（Tech_Stack_Reference）与 `course/research/*.md`（AI SDK v6 / Next.js 16 / 模型选型 2026）。
> **对齐需求**：Requirements 4.1–4.6。

---

## 0. 重要声明（务必先读）

- **本报告仅为评估，不修改 `ssp-web` 任何源码。** 本任务的唯一产物是这份 Markdown 评估报告。
- **任何对 `ssp-web` 源码、依赖或配置的实际改动，都需用户单独批准后另行执行**，不在本报告执行范围内（对齐 Requirement 4.4）。
- 报告中的「建议」「优先级」均为**评估结论**，不代表已经或将要落地。读者据此决策，落地前请回到源仓库核对并经评审。
- 依赖版本号、最新稳定版数值随时间变化；本报告数值锚定 **2026-05-30**，若距今较久请以 npm registry 当时值为准。

---

## 1. 评估方法

1. 读取 `ssp-web/package.json` 的 `dependencies` 与 `devDependencies`，逐项记录当前声明版本。
2. 对每个依赖查询其 npm registry `latest` 稳定版（2026-05-30 实测），对比是否存在差距。
   - **关键口径**：`package.json` 中带 `^`（caret）的声明，`npm install` 会在**同一主版本内**自动浮动到最新。因此「声明 `^6.0.99` 但 registry 已到 `6.0.193`」属于**caret 已覆盖、实际无差距**；只有**pinned 精确版本**（如 `next: 16.1.6`）或**被 caret 边界挡住的跨主版本**（如 `lucide-react ^0.575.0` 无法自动升到 `1.x`）才算真实差距。
3. 除版本外，结合 `code-facts.md` 与研究报告，评估**实现层面**是否有可按最新推荐方案优化的点（AI SDK v6 新特性、Next.js 16 Cache Components、数据库/迁移与限流实践等）。
4. 每条有差距（gap）的建议标注**优先级（P0/P1/P2）+ 理由 + 是否影响教程已引用的代码片段**。
5. 给出总体结论 ∈ {`无需更新`, `建议小幅更新`, `建议较大更新`}。

**优先级口径**：
- **P0**：阻断性 / 严重安全 / 功能不可用，应尽快处理。
- **P1**：值得优先排期（安全加固、生产实践、真实配置不一致），不阻断当前运行。
- **P2**：可延后的优化（次要版本刷新、可选新特性、低收益 major 升级）。

---

## 2. 依赖版本对比表

> 列含义：**是否有差距** = 在「caret 自动浮动」口径下是否仍存在需人工处理的差距；**影响教程片段** = 若 `ssp-web` 据此更新，是否会影响教程中已引用的代码片段 / 叙述（对齐 Requirement 4.5）。`—` 表示无差距故不适用。

### 2.1 运行时依赖（dependencies）

| 依赖 | 当前版本（package.json） | 最新稳定版（2026-05-30） | 是否有差距 | 优先级 | 影响教程片段 | 理由 / 建议 |
|---|---|---|---|---|---|---|
| `next` | `16.1.6`（pinned） | `16.2.6` | 是（小） | P2 | 否 | pinned 精确版，被锁在 16.1.6；16.1→16.2 为同 major 次/补版本，App Router / Route Handler / `maxDuration` 等 API 不变。教程与 code-facts 标注 16.1.6 一致，升级不影响已引用片段（仅版本号叙述需同步）。 |
| `react` | `19.2.3`（pinned） | `19.2.6` | 是（小） | P2 | 否 | pinned；补丁级，无 API 变化。 |
| `react-dom` | `19.2.3`（pinned） | `19.2.6` | 是（小） | P2 | 否 | 同 `react`，应与之同步。 |
| `ai`（Vercel AI SDK） | `^6.0.99` | `6.0.193` | 否 | — | 否 | caret 已浮动到 v6 最新；`streamText`/`tool()`/`convertToModelMessages`/`stepCountIs` 签名不变（见 `research/ai-sdk-v6.md`）。 |
| `@ai-sdk/openai` | `^3.0.33` | `3.0.67` | 否 | — | 否 | caret 内；`createOpenAI`/`providerOptions` 不变。 |
| `@ai-sdk/react` | `^3.0.103` | `3.0.195` | 否 | — | 否 | caret 内；`useChat` API 不变。 |
| `@assistant-ui/react` | `^0.12.14` | `0.14.11` | 是 | P2 | **是（潜在）** | 0.x 的 caret 仅允许补丁浮动，`0.12→0.14` 被挡住。assistant-ui 迭代快，0.13/0.14 可能调整 primitives / runtime API；教程 17 节引用了 `AssistantChatTransport`/`ThreadPrimitive`/`ComposerPrimitive`/`useAISDKRuntime`，升级前需回归并可能同步更新教程片段。**当前 0.12 工作正常，不建议为追新而升级。** |
| `@assistant-ui/react-ai-sdk` | `^1.3.10` | `1.3.30` | 否 | — | 否 | caret 内补丁。 |
| `@assistant-ui/react-markdown` | `^0.12.5` | `0.14.1` | 是 | P2 | 否 | 0.x minor 被 caret 挡住；仅做 Markdown 渲染，教程未直接引用其 API。建议与 `@assistant-ui/react` 一并评估，不单独升。 |
| `@auth/drizzle-adapter` | `^1.11.1` | `1.11.2` | 否 | — | 否 | caret 内补丁。 |
| `next-auth` | `^5.0.0-beta.30` | `5.0.0-beta.31` | 否 | — | 否 | 仍是 v5 beta，caret 浮动到 beta.31；NextAuth 配置 API 不变。注：v5 长期处于 beta 属**上游状态**，非 `ssp-web` 可控，无需为此特意改动。 |
| `@neondatabase/serverless` | `^1.0.2` | `1.1.0` | 否 | — | 否 | caret 内次版本；驱动 API 稳定。 |
| `drizzle-orm` | `^0.45.1` | `0.45.2` | 否 | — | 否 | caret(0.45.x) 内补丁。 |
| `zod` | `^4.3.6` | `4.4.3` | 否 | — | 否 | caret 内次版本；`z.object`/`zodSchema`（`zod/v4` 入口）不变。 |
| `json-logic-js` | `^2.0.5` | `2.0.5` | 否 | — | 否 | 已是最新。 |
| `ajv` | `^8.18.0` | `8.20.0` | 否 | — | 否 | caret 内。 |
| `ajv-formats` | `^3.0.1` | `3.0.1` | 否 | — | 否 | 已是最新。 |
| `bcryptjs` | `^3.0.3` | `3.0.3` | 否 | — | 否 | 已是最新。 |
| `@types/bcryptjs` | `^2.4.6` | `3.0.0` | 是 | P2 | 否 | `bcryptjs` 3.x 已自带类型声明，`@types/bcryptjs` 成为多余/弃用 stub。建议**移除该依赖**而非升级（清理项，纯类型层，不影响运行时与教程片段）。 |
| `lucide-react` | `^0.575.0` | `1.17.0` | 是 | P2 | 否 | `0.x→1.x` 为 major，caret(0.575.x) 挡住。仅 `import` 图标组件，教程未引用其内部 API；升级收益低，可延后。 |
| `uuid` | `^13.0.0` | `14.0.0` | 是 | P2 | 否 | major(13→14)，caret 挡住。仅用于 `request_id` 等 ID 生成，`randomUUID`/`v4` 用法稳定；可延后。 |
| `xlsx`（SheetJS） | `^0.18.5` | `0.18.5`（npm 末版） | **是** | **P1** | 否 | npm 上 `0.18.5` 为 2022 年最后一次发布；SheetJS 已将后续版本（含 **CVE-2023-30533** 原型污染、**CVE-2024-22363** ReDoS 修复）迁至**自有 CDN（0.20.x）**，npm 不再更新。建议改用 SheetJS 官方源安装新版或评估替代库。**缓解事实**：`xlsx` 仅在 admin 鉴权后导入受信任 Excel（`src/lib/import/excel-import.ts`），非公网输入，暴露面有限。教程未引用 `xlsx` API。 |
| `tailwind-merge` | `^3.5.0` | `3.6.0` | 否 | — | 否 | caret 内次版本。 |
| `clsx` | `^2.1.1` | `2.1.1` | 否 | — | 否 | 已是最新。 |
| `dotenv` | `^17.3.1` | `17.4.2` | 否 | — | 否 | caret 内。 |

### 2.2 开发依赖（devDependencies）

| 依赖 | 当前版本 | 最新稳定版（2026-05-30） | 是否有差距 | 优先级 | 影响教程片段 | 理由 / 建议 |
|---|---|---|---|---|---|---|
| `eslint-config-next` | `16.1.6`（pinned） | `16.2.6` | 是（小） | P2 | 否 | 应与 `next` 同步小版本；纯 lint 配置，不影响运行时与教程片段。 |
| `typescript` | `^5` | `6.0.3` | 是 | P2 | 否 | TS 6 已发布 major，caret(`^5`) 挡住。devDep/构建工具；TS6 升级需评估编译器 breaking change，对本项目收益有限，可延后。 |
| `drizzle-kit` | `^0.31.9` | `0.31.10` | 否 | — | 否 | caret 内补丁。 |
| `openai` | `^6.25.0` | `6.39.1` | 否 | — | 否 | caret 内次版本；仅 `scripts/` 使用，运行时不依赖。 |
| `tailwindcss` | `^4` | `4.3.0` | 否 | — | 否 | caret 内。 |
| `@tailwindcss/postcss` | `^4` | `4.3.0` | 否 | — | 否 | caret 内。 |
| `eslint` | `^9` | `9.x` | 否 | — | 否 | caret 内。 |
| `@types/node` | `^20` | `20.x` | 否 | — | 否 | 对齐 Node 20 运行时（Next 16 要求 Node ≥ 20.9）。 |
| `@types/react` | `^19` | `19.x` | 否 | — | 否 | caret 内。 |
| `@types/react-dom` | `^19` | `19.x` | 否 | — | 否 | caret 内。 |
| `@types/json-logic-js` | `^2.0.8` | `2.0.8` | 否 | — | 否 | 已是最新。 |

**对比小结**：共对比 **36 项依赖**，其中 **11 项**存在需人工处理的差距（运行时 10 项 + 开发依赖此处另计入 `eslint-config-next`/`typescript`），其余 **25 项**因 caret 已自动覆盖最新主版本或已是最新而无差距。差距项里只有 `xlsx` 为 P1（供应链/安全），其余均为 P2 的小版本刷新或可延后的 major 升级。

---

## 3. 实现层面优化评估（非版本号差距）

除依赖版本外，以下为「实现是否可按最新推荐方案优化」的评估点。每条同样标注优先级 + 理由 + 是否影响教程片段。

### 3.1 `maxDuration` 配置不一致（真实配置缺陷）

- **现状**：`src/app/api/chat/route.ts` 声明 `export const maxDuration = 120`，但 `vercel.json` 对 `src/app/api/**/*.ts` 配 `"maxDuration": 30`。平台以 `vercel.json` 为准，实际上限被收紧到 30s，长流式 / 多步工具循环（`stopWhen: stepCountIs(8)`）可能在产出结论前被截断。
- **优先级**：**P1**（功能正确性 / 用户体验）。
- **是否影响教程片段**：**是**。`code-facts.md` 与 `research/nextjs-16.md` 已把该不一致作为「真实工程踩坑」记录，教程 06 / 18 / 29 节会引用这一点；若 `ssp-web` 统一两处口径，需同步更新教程对应叙述。
- **建议**：把两处 `maxDuration` 统一（按目标流式时长设定，并受 Vercel plan 上限约束）。**属源码/配置改动，需用户单独批准。**

### 3.2 数据库迁移实践：`drizzle-kit push` → 版本化 migration

- **现状**：仓库通过 `drizzle-kit push` 直接把 schema 同步到数据库，未提交版本化 SQL migration（`code-facts.md §6.5`：`drizzle.config.ts` 的 `out: "./drizzle"` 未 commit）。
- **优先级**：**P2**（生产可追溯性 / 回滚审计的最佳实践改进；当前对教学场景可用）。
- **是否影响教程片段**：否（教程未把 `push` 作为生产推荐强调；如需可在部署节作为延伸补充，不改已引用代码片段）。
- **建议**：生产环境改用 `drizzle-kit generate` 生成版本化 migration + CI 应用，便于回滚与审计。可选演进，非必须。

### 3.3 限流为进程内内存实现

- **现状**：`src/lib/security/rate-limit.ts` 使用进程内 `Map` 桶（`globalThis.__sspRateLimitBuckets`）。serverless / 多实例部署下各实例独立计数，限流不精确。
- **优先级**：**P2**（生产健壮性；当前实现已在 code-facts 注明为进程内方案）。
- **是否影响教程片段**：否（教程 20 安全护栏节可作为「生产化升级方向」延伸提及，不影响已引用片段）。
- **建议**：生产环境改用集中式限流（如 Upstash Redis / Vercel KV）。可选演进。

### 3.4 AI SDK v6 可选新特性（按需，非必须）

- **`prepareStep`**（每步动态换 model / 限工具 / 压上下文）、**`experimental_repairToolCall`**（工具入参修复）、**`Output.object`**（LLM 结构化输出）、**tool execution approval（`needsApproval`）** 等 v6 能力当前**均未启用**。
- **优先级**：**P2**（可选增强）。
- **是否影响教程片段**：否（`research/ai-sdk-v6.md` 已将这些标注为「示意，非项目实际代码」，教程 12/14/21 节按示意讲解）。
- **评估**：`ssp-web` 的结构化结果来自规则引擎而非 LLM，工具均为只读计算、无副作用，**不需要** `Output.object` 与工具审批；`prepareStep`/repair 属健壮性/成本优化，可作为演进方向，当前架构无需改动。

### 3.5 Next.js 16 Cache Components / `use cache`

- **现状**：`/api/chat` 走 `force-dynamic` 实时流式，**不适合**缓存（正确选择）。展示类只读页（`/cases`、showcase）目前未用 `use cache` + PPR。
- **优先级**：**P2**（可选性能优化）。
- **是否影响教程片段**：否（`research/nextjs-16.md §5` 已标注为示意；29 节作延伸提及）。
- **建议**：只读展示页可评估引入 `use cache` + PPR 降低 DB 压力；对话链路保持 `force-dynamic`。可选演进。

---

## 4. 更新建议汇总（每条含优先级 + 理由 + 是否影响教程片段）

> 仅列出存在差距 / 可优化的条目。**所有建议均需用户单独批准后才可对源码落地。**

**P0（阻断 / 严重）**：无。当前 `ssp-web` 可正常构建运行，无阻断性问题。

**P1（建议优先排期）**：
1. **`xlsx`（SheetJS）供应链** — 优先级：P1；理由：npm 末版 `0.18.5` 含已知 CVE，修复版仅在 SheetJS 自有 CDN 提供，npm 不再更新；是否影响教程片段：否（教程未引用 `xlsx` API；admin 鉴权 + 受信任输入已缓解暴露面）。
2. **`maxDuration` 配置统一**（`route.ts` 120 vs `vercel.json` 30）— 优先级：P1；理由：平台口径不一致导致长流式可能被 30s 截断；是否影响教程片段：是（06/18/29 节将其作为「真实踩坑」引用，源码修复后需同步更新教程叙述）。

**P2（可延后）**：
3. **pinned 小版本刷新**：`next` 16.1.6→16.2.6、`react`/`react-dom` 19.2.3→19.2.6、`eslint-config-next` 16.1.6→16.2.6 — 优先级：P2；理由：同 major 次/补版本，无 API 破坏；是否影响教程片段：否（仅版本号叙述需对齐 code-facts）。
4. **`@assistant-ui/react` 0.12→0.14（及 `react-markdown` 0.12→0.14）** — 优先级：P2；理由：0.x 跨 minor 可能含 API 调整，当前 0.12 工作正常；是否影响教程片段：是（潜在，17 节引用其 primitives/runtime，升级需回归）。
5. **`lucide-react` 0.575→1.x、`uuid` 13→14、`typescript` 5→6** — 优先级：P2；理由：均为被 caret 挡住的 major 升级，对本项目收益有限、风险需评估；是否影响教程片段：否。
6. **`@types/bcryptjs` 移除** — 优先级：P2；理由：`bcryptjs` 3.x 自带类型，该 `@types` 已多余/弃用；是否影响教程片段：否。
7. **数据库迁移改版本化（`generate` 而非 `push`）** — 优先级：P2；理由：生产可追溯/回滚最佳实践；是否影响教程片段：否。
8. **限流改集中式（Redis/KV）** — 优先级：P2；理由：serverless 多实例下进程内限流不精确；是否影响教程片段：否。
9. **AI SDK v6 可选新特性 / Next.js 16 Cache Components** — 优先级：P2；理由：可选增强，当前架构无需；是否影响教程片段：否（研究报告已标注示意）。

---

## 5. 总体结论

**总体结论：建议小幅更新。**

**理由**：

1. **技术栈整体处于 2026 最新梯队**：Next.js 16 / React 19.2 / Vercel AI SDK v6 / `@ai-sdk/openai` 3 / drizzle-orm 0.45 / zod 4 / next-auth v5 / assistant-ui 0.12，均为当前主流最新版本，无过时框架、无需架构级改造。
2. **绝大多数依赖（25/36）已通过 caret 自动浮动到最新主版本内或已是最新**，`npm install` 即保持最新，无人工动作必要。
3. **真实差距集中在少量条目**：仅 `xlsx` 供应链（P1）与 `maxDuration` 配置一致性（P1）值得优先处理；其余均为 pinned 小版本刷新或可延后的 major 升级（P2），无一为破坏性变更。
4. **无 P0 阻断项**，项目可正常构建运行。

综合判断：既非「无需更新」（存在 2 项 P1 与若干 P2 可改进点），也未达「建议较大更新」（无架构改造、无破坏性升级、无大面积差距），故定为 **「建议小幅更新」**。

> 再次提醒：以上为评估结论，**不修改 `ssp-web` 源码**；任何实际改动需用户单独批准后另行执行。

---

## 附：数据来源

- `ssp-web/package.json`、`ssp-web/next.config.ts`、`ssp-web/vercel.json`、`ssp-web/drizzle.config.ts`、`ssp-web/tsconfig.json`（当前依赖与配置基线）。
- `course/code-facts.md`（Tech_Stack_Reference：真实依赖版本与代码事实，含 `maxDuration` 不一致、`drizzle-kit push`、进程内限流等记录）。
- `course/research/ai-sdk-v6.md`、`course/research/nextjs-16.md`、`course/research/model-selection-2026.md`（最新技术行为与版本归属）。
- npm registry `latest` dist-tag 实测（2026-05-30）：`ai@6.0.193`、`@ai-sdk/openai@3.0.67`、`@ai-sdk/react@3.0.195`、`next@16.2.6`、`react@19.2.6`、`@assistant-ui/react@0.14.11`、`@assistant-ui/react-ai-sdk@1.3.30`、`@assistant-ui/react-markdown@0.14.1`、`drizzle-orm@0.45.2`、`drizzle-kit@0.31.10`、`zod@4.4.3`、`@neondatabase/serverless@1.1.0`、`@auth/drizzle-adapter@1.11.2`、`next-auth@5.0.0-beta.31`（beta dist-tag）、`lucide-react@1.17.0`、`uuid@14.0.0`、`typescript@6.0.3`、`openai@6.39.1`、`tailwind-merge@3.6.0`、`xlsx@0.18.5`（npm 末版）等。
- 安全事实（`xlsx`/SheetJS）：CVE-2023-30533（原型污染）、CVE-2024-22363（ReDoS），修复版经 SheetJS 官方 CDN 分发，npm 注册表停留在 0.18.5。

> 价格/版本类数值随官方变动，引用时以当时 npm registry / 官方页为准。本报告内容为转述与归纳，未逐段复制第三方原文。
