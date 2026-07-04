# 研究报告 · Next.js 16

> **调研日期**：2026-02-28（以官方一手源核实：Next.js 16 稳定版公告日为 **2025-10-21**）
> **用途**：本文件是 `course/code-facts.md`（Tech_Stack_Reference）的**补充研究报告**。`code-facts.md` 锁定 `ssp-web` 真实依赖与配置事实；本报告补充 Next.js 16 的官方特性、版本归属、AI 流式与部署相关能力的权威来源，供章节重写时**追溯技术声明、避免幻觉**。
> **配套项目版本基线**（来自 `ssp-web/package.json`）：`next` `16.1.6`、`react` / `react-dom` `19.2.3`、`eslint-config-next` `16.1.6`。
> **追溯映射**：本报告主要服务 **06 技术栈选型**（文件 `06-tech-stack-2026.md`，第 5 节）与 **29 部署上线**（文件 `29-deploy-and-beyond.md`，第 28 节）；流式/Route Handler 相关条目也可供 18 流式 UI 与 28 多 Agent 章节按需引用。
>
> **来源合规说明**：本报告内容均为**转述与归纳**，非原文照搬；外部数字（plan 时长限制、定价口径）凡来自会随时间变化的页面，均标注来源与口径，写作时以官方页面当时值为准。Content was rephrased for compliance with licensing restrictions。

---

## 0. 一页速查（写作直接抄）

| 项 | 值 | 状态 / 备注 | 来源 |
|---|---|---|---|
| 稳定版发布 | **Next.js 16**，`2025-10-21` | Next.js Conf 2025 前发布 | [Next.js 16 公告](https://nextjs.org/blog/next-16) |
| ssp-web 锁定版本 | `next` **16.1.6** | 与 React 19.2.3 搭配 | `ssp-web/package.json` |
| 默认打包器 | **Turbopack（stable）** | 所有新项目默认；webpack 需 `--webpack` 退回 | [公告](https://nextjs.org/blog/next-16) |
| 新缓存模型 | **Cache Components**（`use cache` + PPR） | **opt-in**；默认所有动态代码请求时执行 | [cacheComponents 文档](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) |
| 中间件改名 | `middleware.ts` → **`proxy.ts`**（跑 Node.js runtime） | 旧 `middleware.ts` 仅保留给 Edge，已 deprecated | [proxy 文档](https://nextjs.org/docs/app/getting-started/proxy) |
| AI 调试 | **Next.js DevTools MCP** | MCP 集成，给 AI agent 喂路由/缓存/日志/报错上下文 | [MCP 文档](https://nextjs.org/docs/app/guides/mcp) |
| React 版本 | **React 19.2**（App Router 走 Canary） | View Transitions / `useEffectEvent` / `<Activity>` | [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) |
| 异步请求 API | `params`/`searchParams`/`cookies()`/`headers()`/`draftMode()` **必须 await** | 同步访问已移除（破坏性） | [升级指南](https://nextjs.org/docs/app/guides/upgrading/version-16) |
| Route runtime | `export const runtime = 'nodejs'`（默认）/ `'edge'` | Edge **不支持** Cache Components，且不能用于 Proxy | [runtime 配置](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime) |
| 函数时长 | `export const maxDuration = <秒>` | 部署平台从 build 输出读取该值施加限制 | [maxDuration 配置](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration) |
| Node.js 要求 | **20.9+**（LTS）；Node 18 不再支持 | TypeScript 5.1+ | [公告 · Version Requirements](https://nextjs.org/blog/next-16) |
| Vercel Fluid compute | 新项目默认（2025-04-23 起） | 默认函数时长提升到 300s；Active CPU 计费利好 AI/agent | [Fluid 默认](https://examples.vercel.com/docs/functions/runtimes/edge/edge-functions)、[Fluid 更高默认值](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) |
| ssp-web 部署区域 | `vercel.json` → **`iad1`**（美东） | README 写 `hkg1` 为过期信息，以 vercel.json 为准 | `ssp-web/vercel.json` + `code-facts.md` §11.3 |

> ⚠️ **版本警告（写作必带）**：客观写「Next.js 16」「React 19.2」是允许的（修饰第三方库）；但**不得**用「v1/v2/旧版本/历史归档」指代**本课程自身**版本（见 style-guide §3.3）。

---

## 1. Next.js 16 是什么：发布定位与权威来源

Next.js 16 于 **2025-10-21** 发布稳定版，赶在 Next.js Conf 2025 之前。官方把这一版的主线定位为**对 Turbopack、缓存模型与框架架构的整体升级**。配套项目 `ssp-web` 锁 `next` `16.1.6`，因此本课程所有 Next.js 技术声明以 **16.x** 为准。来源：[Next.js 16 公告](https://nextjs.org/blog/next-16)。

权威来源清单（本报告全程引用）：

- 发布公告：[Next.js 16](https://nextjs.org/blog/next-16)（2025-10-21）、[Next.js 16 beta](https://nextjs.org/blog/next-16-beta)
- 升级指南：[Upgrading: Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Cache Components：[cacheComponents 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)、[迁移到 Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
- Route Handlers：[route.js 文件约定](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- Route Segment Config：[runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)、[maxDuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)
- Proxy：[proxy 文档](https://nextjs.org/docs/app/getting-started/proxy)
- DevTools MCP：[MCP 指南](https://nextjs.org/docs/app/guides/mcp)
- Vercel 部署：[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)、[Fluid compute](https://vercel.com/fluid)、[AI SDK · Vercel 超时排查](https://sdk.vercel.ai/docs/troubleshooting/timeout-on-vercel)

---

## 2. 关键特性总览（16 相对早期版本的新东西）

> 下表只描述**第三方框架 Next.js 自身**的版本演进（用于解释为何课程用某些 16 的 API / 行为），不涉及本课程版本，符合 style-guide §3.3。

| 特性 | 16 现状（课程采用） | 说明 | 来源 |
|---|---|---|---|
| **Turbopack** | stable，默认打包器 | 生产构建快约 2–5×，Fast Refresh 最高约 10×；webpack 需 `--webpack` 退回 | [公告](https://nextjs.org/blog/next-16) |
| **Cache Components** | `use cache` 指令 + PPR；**opt-in** | 默认动态、显式缓存；替代 `experimental.ppr`/`experimental.dynamicIO` | [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) |
| **Proxy** | `proxy.ts` 取代 `middleware.ts`，跑 Node.js runtime | 让"网络边界"更显式；旧 middleware 仅留给 Edge 且 deprecated | [proxy](https://nextjs.org/docs/app/getting-started/proxy) |
| **DevTools MCP** | 内置 MCP，供 AI agent 调试 | 暴露路由/缓存/渲染知识 + 统一日志 + 自动报错栈 | [MCP](https://nextjs.org/docs/app/guides/mcp) |
| **React Compiler** | 支持转 stable（`reactCompiler: true`） | 自动 memo；**默认不开**（依赖 Babel，构建变慢） | [公告](https://nextjs.org/blog/next-16) |
| **Turbopack FS 缓存** | beta（`experimental.turbopackFileSystemCacheForDev`） | 把编译产物落盘，重启后编译更快 | [公告](https://nextjs.org/blog/next-16) |
| **Build Adapters API** | alpha（`experimental.adapterPath`） | 让部署平台/自定义集成 hook 进 build 流程 | [公告](https://nextjs.org/blog/next-16) |
| **增强路由** | 布局去重 + 增量预取 | 共享 layout 只下载一次；只预取未缓存部分 | [公告](https://nextjs.org/blog/next-16) |
| **缓存 API 重整** | `revalidateTag(tag, profile)`、新增 `updateTag()`/`refresh()` | 见 §5 | [公告](https://nextjs.org/blog/next-16) |
| **React 19.2** | App Router 走 React Canary | View Transitions / `useEffectEvent` / `<Activity>` | [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) |

> 写作提醒：课程**不得**用「v1/v2/旧版本/历史归档」等措辞指代**本课程**；但客观写「Next.js 16 把 `middleware.ts` 改名为 `proxy.ts`」是允许的——版本号与变更修饰的是第三方框架，不是课程自身。

---

## 3. App Router 现状与 Server Components / Server Actions 在 Agent 应用里的角色

### 3.1 App Router 是默认且推荐

Next.js 官方文档把路由分为两套：**App Router**（支持 React Server Components 等新特性，推荐）与 **Pages Router**（原始路由，仍维护）。`create-next-app` 在 16 里默认用 App Router + TypeScript 优先配置 + Tailwind + ESLint。来源：[Next.js Docs](https://nextjs.org/docs)、[公告 · create-next-app](https://nextjs.org/blog/next-16)。

`ssp-web` 采用 App Router（`src/app/` 结构），AI 聊天端点是 `src/app/api/chat/route.ts`（Route Handler）。

### 3.2 Server Components / Server Actions 在 Agent 应用里的角色

- **Server Components（默认）**：在服务端渲染、不进客户端 bundle，适合读数据库、读密钥、拼 system prompt 等"不暴露给浏览器"的逻辑。Agent 应用里常用来在服务端组织上下文、读用户画像后再交给模型。
- **Route Handlers（`route.ts`）**：是 Agent 流式对话的标准落点——它能返回流式 HTTP 响应（SSE），把 `streamText().toUIMessageStreamResponse()` 直接吐给前端 `useChat`。`ssp-web` 的 `/api/chat` 就是这一形态（见 §4、`code-facts.md` §4）。
- **Server Actions（`'use server'`）**：适合"读你自己写"的变更操作（提交表单、更新设置）。16 给它配了 `updateTag()`（read-your-writes）与 `refresh()`（刷新未缓存数据）两个专用 API（见 §5.2）。
  - ⚠️ **取舍提醒（二手社区经验，写作谨慎引用）**：有社区文章建议 **Agent 长流式走 Route Handler / API route 而非 Server Action**，因为 Server Action 更适合短事务型变更，长连接流式在并发与超时上不如显式 Route Handler 可控。这是工程取舍经验，非官方硬性规定，正文若引用须标注"社区经验"。来源（二手）：[markaicode · Next.js Agent 架构](https://markaicode.com/architecture/nextjs-agent-architecture/)。

---

## 4. AI 流式相关：Route Handlers、流式响应、runtime 与 maxDuration

这是 06/29 节最该讲清的工程取舍。四个要点：

### 4.1 Route Handler + 流式响应（SSE）

App Router 的 `route.ts` 支持 `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS`。流式 AI 回复的标准范式是：在 `POST` handler 里调 AI SDK 的 `streamText`，再用 `result.toUIMessageStreamResponse()` 返回一个 SSE 响应（详见 `course/research/ai-sdk-v6.md` §1）。Vercel 官方说函数默认就讲 HTTP，**流式响应开箱即用**。来源：[route.js 约定](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)、[Vercel · 托管后端 API](https://vercel.com/kb/guide/hosting-backend-apis)。

### 4.2 `runtime`：Node.js（默认）vs Edge

Route Segment Config 的 `runtime` 取值 `'nodejs'`（默认）或 `'edge'`。官方明确两条关键约束（写作必带）：

- **Edge runtime 不支持 Cache Components**；
- **Edge runtime 不能用于 Proxy**（`proxy.ts` 跑 Node.js runtime）。

来源：[runtime 配置](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)、[proxy 文档](https://nextjs.org/docs/app/getting-started/proxy)。

取舍口径：

| 维度 | Node.js runtime（默认） | Edge runtime |
|---|---|---|
| Node API / npm 原生包 | 全部可用（如 `bcryptjs`/`xlsx`） | 受限（Web 标准 API 子集） |
| 冷启动 | 相对慢 | 更快、更轻 |
| 适合场景 | 完整 Agent 后端、要读 DB/密钥/native 包、长流式 | 低延迟、轻量、个性化边缘响应 |
| Cache Components | 支持 | **不支持** |

> **看这里 →**：`ssp-web` 的 `/api/chat` 未显式声明 `runtime`，因此走**默认 Node.js runtime**——这是对的：它要用 `bcryptjs`、读数据库、跑多步工具循环，Edge 的受限环境不合适。课程讲 runtime 选择时应说清"Agent 后端默认且推荐 Node.js runtime，Edge 留给轻量低延迟场景"。

### 4.3 `maxDuration`：函数执行时长上限

`export const maxDuration = <秒>` 设置该 route segment 服务端逻辑的最大执行秒数；**部署平台会从 Next.js build 输出里读取这个值**来施加限制。AI 流式/多步工具循环可能跑很久，必须显式调高，否则会被默认超时掐断。来源：[maxDuration 配置](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)。

`ssp-web` 真实配置（`src/app/api/chat/route.ts`）：

```ts
// src/app/api/chat/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 120;
```

> **看这里 →（重要不一致，写作必标）**：`route.ts` 里 `export const maxDuration = 120`，但 `ssp-web/vercel.json` 对 `src/app/api/**/*.ts` 配了 `"maxDuration": 30`。两处口径不一致：`vercel.json` 的 functions 配置会对该路径函数施加 30s 上限。课程讲这块时应把它当**真实工程踩坑**讲——"路由里声明 120s，但平台侧 vercel.json 限到 30s，实际生效以平台配置为准；要拉长流式上限，两处都要改、且受 plan 时长上限约束"。这与 `code-facts.md` 记录的 `iad1` vs README `hkg1` 是同类"配置以平台文件为准"的提醒。

### 4.4 `dynamic = "force-dynamic"`

`ssp-web` 在 `/api/chat` 显式声明 `export const dynamic = "force-dynamic"`，强制该路由每次请求都动态执行（不缓存）——对实时 AI 对话是正确选择。注意 16 的 Cache Components 模型下"默认就是动态、缓存才需 opt-in"，所以这个声明在 16 里更多是**显式表达意图**。来源：[Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)。

---

## 5. Cache Components 与缓存 API（06 节"为什么用 16"的核心论据之一）

### 5.1 Cache Components：显式、opt-in 的缓存模型

Cache Components 是 16 围绕 `"use cache"` 指令的新缓存能力：可缓存页面、组件、函数，编译器自动生成缓存键。与早期 App Router 的**隐式缓存**不同，它**完全 opt-in**——默认所有页面/布局/API route 里的动态代码都在请求时执行，更贴近开发者对"全栈框架"的预期。它同时补全了 **Partial Prerendering（PPR）** 的故事：静态外壳 + Suspense 包裹的动态部分共存。开启方式：

```ts
// next.config.ts（示意，ssp-web 当前未开启）
const nextConfig = {
  cacheComponents: true,
};
export default nextConfig;
```

来源：[cacheComponents 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)、[Next.js 16 公告](https://nextjs.org/blog/next-16)。

> 命名演进：16 把早期的 `experimental.ppr` 与 `experimental.dynamicIO` 收敛进 Cache Components（`dynamicIO` → `cacheComponents`，`experimental.ppr` 标志移除）。课程引用时用 16 的名称。来源：[公告 · Removals](https://nextjs.org/blog/next-16)。

### 5.2 缓存失效三件套（Server Actions 相关，AI 应用可能用到）

| API | 作用 | 范围 | 来源 |
|---|---|---|---|
| `revalidateTag(tag, profile)` | 标签失效 + stale-while-revalidate | 需带 `cacheLife` profile（如 `'max'`）做第二参；单参形式已 deprecated | [公告](https://nextjs.org/blog/next-16) |
| `updateTag(tag)` | **read-your-writes**：当请求内立即过期并读新值 | 仅 Server Actions | [公告](https://nextjs.org/blog/next-16) |
| `refresh()` | 只刷新**未缓存**数据，不动缓存 | 仅 Server Actions；与客户端 `router.refresh()` 互补 | [公告](https://nextjs.org/blog/next-16) |

> `ssp-web` 的实时对话链路走 `force-dynamic`，不依赖这套缓存失效 API；课程引用 `use cache`/`updateTag`/`refresh` 一律按「示意，非项目实际代码」标注。它们对"AI 结果页 + 用户画像更新后即时可见"这类场景有价值，可在 29 节作为延伸提及。

---

## 6. 部署：Vercel 流程、函数时长、region、环境变量

### 6.1 部署流程（概览）

Next.js + Vercel 的标准路径：连 Git 仓库 → Vercel 自动识别 Next.js → 构建（16 默认 Turbopack）→ 部署为 Serverless / Fluid 函数 + 静态资源 + 边缘网络。AI route handler 自动成为函数。来源：[Vercel Functions](https://vercel.com/docs/functions/edge-functions)。

### 6.2 函数时长限制（写作必核对当时官方值）

Vercel 在 **2025-04-23** 起对新项目**默认启用 Fluid compute**。启用 Fluid compute 后，**所有 plan 的默认函数执行时长提升到 300 秒（5 分钟）**，对大多数流式应用足够。各 plan 可配置上限（口径会变，引用时以官方页面当时值为准）：

| Plan | 默认 | 可配置上限（口径随官方变化） | 来源 |
|---|---|---|---|
| Hobby | 较短默认（如 10–15s） | 配合 Fluid 可上调（官方页面示约至 300s） | [Hobby plan](https://vercel.com/docs/plans/hobby)、[Functions 限制](https://vercel.com/docs/functions/limitations) |
| Pro | 300s（Fluid 默认） | 最高约 **800s** | [Functions 限制](https://vercel.com/docs/functions/limitations)、[超时排查](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) |
| Enterprise | 300s（Fluid 默认） | 最高约 **800s** | 同上 |

> ⚠️ 这些数值 Vercel 会调整，**写作时务必回链官方页面核当时值**，不要把"300s/800s"写成永久事实。来源：[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)、[AI SDK · Vercel 超时排查](https://sdk.vercel.ai/docs/troubleshooting/timeout-on-vercel)。

**Active CPU 计费（AI/agent 利好）**：Fluid compute 用 Active CPU 计费——只在 CPU 真正干活时计费，空闲（如等模型返回的 I/O 等待）不计 CPU 费。这对"LLM 推理、长跑 agent、MCP server"这类 I/O 密集、间歇空闲的负载很省钱。来源：[Active CPU 计费](https://vercel.com/changelog/lower-pricing-with-active-cpu-pricing-for-fluid-compute)、[Fluid 介绍](https://vercel.com/blog/introducing-active-cpu-pricing-for-fluid-compute)。

### 6.3 region 配置

`vercel.json` 的 `regions` 指定函数部署区域。`ssp-web` 配 **`iad1`**（美东，弗吉尼亚）。选 region 的取舍：靠近**模型 API / 数据库**所在区域能降延迟。`ssp-web` 用 Neon（serverless Postgres）+ OpenAI 中转网关，`iad1` 是常见折中。

```json
// ssp-web/vercel.json（真实配置）
{
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 30 }
  }
}
```

> **看这里 →**：`ssp-web/README.md` 第 81 行写的是 `hkg1`（香港），但 `vercel.json` 实际是 `iad1`（美东）——**以 vercel.json 为准**（`code-facts.md` §11.3 已记录此坑）。引用部署区域时只认 `vercel.json`。

### 6.4 环境变量管理

Vercel 控制台按 **Production / Preview / Development** 三套环境分别配环境变量；本地用 `.env`（注意 16 已移除 `serverRuntimeConfig`/`publicRuntimeConfig`，统一改用环境变量）。`ssp-web` 关键环境变量（见 `code-facts.md`）：`OPENAI_API_KEY` / `OPENAI_MODEL`（必填）、`OPENAI_URL` 或 `OPENAI_BASE_URL`（可选，中转网关）、数据库连接串、NextAuth 密钥等。

> 安全提示（写作必带）：密钥类环境变量只在**服务端**（Server Components / Route Handlers / Server Actions）读取，绝不要前缀 `NEXT_PUBLIC_` 暴露到浏览器。`ssp-web` 对中转网关 key（`cr_` 前缀）还做了强制 `baseURL` 校验（`config.ts`，见 `ai-sdk-v6.md` §6）。来源：[公告 · Removals（runtime config）](https://nextjs.org/blog/next-16)。

---

## 7. 15 → 16 迁移注意点（讲清"为什么用 16 / 升级要小心什么"）

> 全部为**第三方框架自身演进**的客观描述，可写入正文（修饰 Next.js，不修饰本课程）。来源：[升级指南 version-16](https://nextjs.org/docs/app/guides/upgrading/version-16)、[公告 · Breaking Changes](https://nextjs.org/blog/next-16)。

**1) 异步请求 API（最容易踩的破坏性变更）**
`params`、`searchParams`、`cookies()`、`headers()`、`draftMode()` 在 16 里**必须 `await`**，同步访问已移除。官方提供 codemod 自动迁移。

```ts
// 16 写法
const cookieStore = await cookies();
const { id } = await params;
```

**2) 默认打包器换 Turbopack**
新项目默认 Turbopack；有自定义 webpack 配置的项目用 `next dev --webpack` / `next build --webpack` 退回。

**3) `middleware.ts` → `proxy.ts`**
改名 + 导出函数名改为 `proxy`，逻辑不变；跑 Node.js runtime。旧 `middleware.ts` 仅留给 Edge 场景且 deprecated。（注：`ssp-web` 有 `src/proxy.ts`，文件名其实就是 Next.js middleware 的新形态——`code-facts.md` §5 已注明"文件名误导"。）

**4) 缓存模型切换**
`experimental.ppr` / `experimental.dynamicIO` 收敛进 Cache Components（`cacheComponents: true`）；`revalidateTag()` 需带第二个 `cacheLife` profile 参数。

**5) 版本/环境要求抬高**
Node.js **20.9+**（Node 18 不再支持）、TypeScript **5.1+**；浏览器基线 Chrome/Edge/Firefox 111+、Safari 16.4+。

**6) 其它移除/行为变化（按需在 29 节提醒）**
- 移除 `next lint` 命令（改用 ESLint/Biome 直跑；`next build` 不再跑 lint）。
- 移除 AMP、`serverRuntimeConfig`/`publicRuntimeConfig`。
- `next/image` 默认值变化：`minimumCacheTTL` 60s→4 小时；`qualities` 由 `[1..100]`→`[75]`；本地 IP 优化默认禁用。
- 并行路由的每个 slot 现在**必须**有显式 `default.js`，否则 build 失败。
- `experimental.turbopack` 配置移到顶层 `turbopack`。

**升级命令**：`npx @next/codemod@canary upgrade latest`（codemod 无法全自动处理的部分查升级指南）。

---

## 8. 与 ssp-web 实际配置对齐（防幻觉核对清单）

写 06 / 29（及 18/28 按需）时，凡引用以下点，务必与 `code-facts.md` 的真实片段一致：

- ✅ `ssp-web` 锁 `next` **16.1.6** + `react`/`react-dom` **19.2.3** + `eslint-config-next` **16.1.6**（`package.json`）。
- ✅ `next.config.ts` 仅一项：`serverExternalPackages: ["bcryptjs", "xlsx"]`（顶层配置，16 中为稳定项；把这两个 Node 原生依赖排除出 bundle）。
- ✅ `vercel.json`：`regions: ["iad1"]`、`functions["src/app/api/**/*.ts"].maxDuration = 30`。
- ✅ `/api/chat/route.ts`：`export const dynamic = "force-dynamic"` + `export const maxDuration = 120`（**真实存在**），并使用默认 Node.js runtime（未显式声明 `runtime`）。
- ⚠️ **不一致点（必标）**：`route.ts` 的 `maxDuration = 120` 与 `vercel.json` 的 `maxDuration: 30` 口径不一致；讲解时以"平台 vercel.json 配置实际生效、要拉长两处都要改且受 plan 上限约束"为准。
- ⚠️ **部署区域**：以 `vercel.json` 的 `iad1` 为准，README 的 `hkg1` 是过期信息（`code-facts.md` §11.3 / §5）。
- ⚠️ `ssp-web` **未开启** Cache Components（`cacheComponents`）、**未开启** React Compiler（`reactCompiler`）、**未用** `use cache`/`updateTag`/`refresh`/Turbopack FS 缓存——引用这些一律标注「（示意，非项目实际代码）」。
- ⚠️ `src/proxy.ts` 是 Next.js middleware 的新形态（`proxy.ts`），不是普通工具文件——`code-facts.md` 已注明文件名误导。

---

## 9. 章节追溯速查（写作时引用本报告的哪一节）

| 章节 | 主要追溯小节 | 关键点 |
|---|---|---|
| 06 技术栈选型（`06-tech-stack-2026.md`，第 5 节） | §1, §2, §3, §5, §7 | 为什么用 16：Turbopack 默认、Cache Components、App Router、React 19.2、15→16 演进 |
| 29 部署上线（`29-deploy-and-beyond.md`，第 28 节） | §4, §6, §7 | runtime/maxDuration 取舍、Vercel Fluid/时长/region/环境变量、迁移注意点 |
| 18 流式 UI（`18-*.md`） | §4.1, §4.2 | Route Handler + SSE 流式、Node vs Edge runtime |
| 28 多 Agent（`28-multi-agent.md`） | §4.3, §6.2 | 长流式/agent 放 Route Handler、Active CPU 计费利好 I/O 密集 agent |

---

## 10. 引用来源（可信链接）

**官方一手源（nextjs.org / vercel.com / react.dev）**：

1. [Next.js 16 发布公告（2025-10-21）](https://nextjs.org/blog/next-16) — §1/§2/§5/§7 主要依据
2. [Next.js 16 beta 公告](https://nextjs.org/blog/next-16-beta)
3. [升级指南：Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) — §7 迁移依据
4. [Cache Components（cacheComponents 配置）](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
5. [迁移到 Cache Components 指南](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
6. [Route Handlers（route.js）](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
7. [Route Segment Config: runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)
8. [Route Segment Config: maxDuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)
9. [Proxy（proxy.ts）](https://nextjs.org/docs/app/getting-started/proxy)
10. [Next.js DevTools MCP 指南](https://nextjs.org/docs/app/guides/mcp)
11. [React 19.2 公告](https://react.dev/blog/2025/10/01/react-19-2)
12. [Vercel Functions 限制](https://vercel.com/docs/functions/limitations)
13. [Fluid compute 更高默认值/限制（changelog）](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
14. [Fluid compute 默认启用（2025-04-23）](https://examples.vercel.com/docs/functions/runtimes/edge/edge-functions)
15. [Active CPU 计费（changelog）](https://vercel.com/changelog/lower-pricing-with-active-cpu-pricing-for-fluid-compute) / [Active CPU 介绍博客](https://vercel.com/blog/introducing-active-cpu-pricing-for-fluid-compute)
16. [AI SDK · Vercel 部署超时排查](https://sdk.vercel.ai/docs/troubleshooting/timeout-on-vercel)
17. [Vercel · 托管后端 API（流式开箱即用）](https://vercel.com/kb/guide/hosting-backend-apis)
18. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

**第三方 / 二手（仅作工程经验或趋势参考，引用须标注）**：

- [markaicode · Next.js Agent 架构](https://markaicode.com/architecture/nextjs-agent-architecture/)（二手，§3.2 的"长流式走 Route Handler"经验）
- [digitalapplied · 15→16 迁移 playbook](https://www.digitalapplied.com/blog/next-js-15-to-16-migration-playbook-cache-components-2026)（二手，迁移角度补充）

**项目内一手源**：

- `ssp-web/package.json`、`ssp-web/next.config.ts`、`ssp-web/vercel.json`、`ssp-web/src/app/api/chat/route.ts`
- `course/code-facts.md`（§11.3 vercel.json、§5 踩坑点、§4 chat 链路）

> 写作铁律：凡"版本号 / API 名称 / 行为变更"类陈述，**优先回链官方一手源**；凡"plan 时长 / 定价"类数字，**必须标注来源 + 提示口径随官方变化**，不得作为永久事实陈述。内容已为遵守内容许可做转述处理，未逐段复制官方文档原文；代码示例为最小化改写或直接引用 `ssp-web` 真实源码。
