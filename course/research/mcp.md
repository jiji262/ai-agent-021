# 研究报告 · MCP（Model Context Protocol，模型上下文协议）

> **用途**：本报告是第 24 节《MCP 协议拆解》（文件 `25-mcp-protocol.md`）与第 25 节《MCP 实战》（文件 `26-mcp-in-practice.md`）重写时的技术追溯源。所有"协议版本号、SDK 版本号、API 名称"类技术声明都应能回链到本报告的对应条目（对齐 Requirements 2.3 / 2.4）。
>
> **调研日期**：2026 年中（本报告以**官方一手源**核实；最新可见的官方协议动态为 `2026-07-28` spec Release Candidate，当前 stable 仍为 `2025-11-25`）。
>
> **合规说明**：本报告内容均为**转述与归纳**，非原文照搬；外部数字（生态规模、安装量）凡来自二手统计的，均显式标注「二手」并给出链接，供写作时谨慎使用。Content was rephrased for compliance with licensing restrictions。

---

## 0. 一页速查（写作直接抄）

| 项 | 值 | 状态 / 备注 | 来源 |
|---|---|---|---|
| 协议 stable 版本 | **`2025-11-25`** | 当前稳定版，`/specification/latest` 指向它 | [spec changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog) |
| 协议 RC（在途） | **`2026-07-28`** | Release Candidate：stateless 核心 / Extensions / Tasks / MCP Apps / 授权加固 | [blog RC](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) |
| 历史版本线 | `2024-11-05` → `2025-03-26` → `2025-06-18` → `2025-11-25` | 日期即版本号（`YYYY-MM-DD`） | spec changelog |
| 底层 RPC | **JSON-RPC 2.0** | 借鉴 LSP；支持双向请求 | spec architecture |
| TypeScript SDK | `@modelcontextprotocol/sdk`，**v1.x 线**（生产推荐） | v2 stable 预计 **2026 Q1**；v2 ship 后 v1 至少再维护 6 个月 | [TS SDK README](https://github.com/modelcontextprotocol/typescript-sdk) |
| Python SDK | `mcp`，**1.27.x**（PyPI stable） | 含低阶 Server + 高阶 `FastMCP` | [PyPI mcp](https://pypi.org/project/mcp/) |
| 第三方 Python | `fastmcp` `3.2.x` | jlowin/PrefectHQ 维护，生态流行 | [PyPI fastmcp](https://pypi.org/project/fastmcp/) |
| Transport | **stdio** + **Streamable HTTP** 两种官方 | 旧 `HTTP+SSE` 自 `2025-03-26` 起 deprecated | spec transports |
| Server primitives | **Tools / Resources / Prompts** | 按"触发者"区分 | spec server |
| Client capabilities | **Sampling / Roots / Elicitation** | server 反向调用 client | spec client |
| 新实验 primitive | **Tasks**（`2025-11-25` 引入，experimental） | call-now / fetch-later 长任务 | [spec tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks) |
| 治理 | LF Projects, LLC（Linux Foundation 系） | 页脚版权署名已为 LF Projects | spec 页脚 |

> ⚠️ **版本警告（写作必带）**：TypeScript SDK 生产环境锁 **v1.x**，不要用 v2 alpha；Python 用官方 `mcp` 或第三方 `fastmcp`，二选一。

---

## 1. MCP 是什么：定位与设计动机

MCP（Model Context Protocol，模型上下文协议）由 Anthropic 在 2024-11-05 开源发布，定位是**「把数据和工具标准化地接到 LLM 应用」**的开放协议。官方与社区常用的类比是 **「AI 工具界的 USB-C」**——一套接口，任意支持 MCP 的 Host 都能连。

它要解决的核心问题**不是**「模型怎么调用工具」（那是 Tool Calling / Function Calling 在 2023 年已解决的），而是**「一个工具怎么一次性发布给所有 LLM 应用复用」**。三个设计诉求：

1. **工具有独立"服务身份"**：MCP server 是独立进程/服务，有自己的版本、依赖、鉴权，不再寄生在某个 Agent 应用代码库里。
2. **能力可"自助发现"**：client 连上 server 后能列出"你提供哪些 tool / resource / prompt"，无需 client 端硬编码。
3. **协议"跨厂商"**：OpenAI、Anthropic、Google 等 Host 实现 MCP client 后，同一个 server 都能用——类似 LSP（Language Server Protocol）不绑定某家编辑器。

来源：[Anthropic 公告](https://www.anthropic.com/news/model-context-protocol)、[MCP 官网](https://modelcontextprotocol.io)。

---

## 2. 协议版本与演进

MCP 用**日期即版本号**（`YYYY-MM-DD`）。截至本报告核实：

```
2024-11-05  初版          —— HTTP+SSE transport 时代
2025-03-26  第二版         —— 起，HTTP+SSE 被 Streamable HTTP 取代（旧 transport 标记 deprecated）
2025-06-18  第三版         —— Streamable HTTP 成熟；OAuth Resource Server 形式化
2025-11-25  当前 stable    —— 加 Tasks 实验性 primitive、工具命名指南、URL elicitation 等
2026-07-28  RC（在途）      —— stateless 协议核心、Extensions 框架、MCP Apps、授权加固、正式弃用策略
```

`/specification/latest` 当前解析到 `2025-11-25`。来源：[2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog)、[2026-07-28 RC 公告](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)。

### 2.1 `2025-11-25` 的关键变更（已核实于官方 changelog）

**重大变更（Major）**：

1. 授权服务发现支持 **OpenID Connect Discovery 1.0**（PR #797）。
2. tool / resource / resource template / prompt 可暴露 **icons** 元数据（SEP-973）。
3. 通过 `WWW-Authenticate` 支持**增量 scope 同意**（SEP-835）。
4. 新增**工具命名指南**（SEP-986）。
5. `ElicitResult` / `EnumSchema` 改为更标准化的形态，支持有标题/无标题、单选/多选 enum（SEP-1330）。
6. 新增 **URL 模式 elicitation**（SEP-1036）——允许 server 弹浏览器走 OAuth / 付款等流程。
7. Sampling 增加 **tool calling 支持**（`tools` 与 `toolChoice` 参数，SEP-1577）。
8. 推荐 **OAuth Client ID Metadata Documents（CIMD）** 作为 client 注册机制（SEP-991）。
9. 实验性 **Tasks**——可追踪的持久请求 + 轮询 + 延迟取结果（SEP-1686）。

**次要变更（Minor，写代码时会踩到）**：

- 明确 **stdio transport 的 stderr 可用于所有类型日志**，不只是错误（PR #670）。
- 明确 Streamable HTTP 对**非法 `Origin` header 必须返回 HTTP 403 Forbidden**（PR #1439）。
- 明确**输入校验错误应作为 Tool Execution Error 返回**（`isError: true`），而非 Protocol Error，以便模型自我修正（SEP-1303）。
- OAuth Protected Resource Metadata 发现对齐 **RFC 9728**，`WWW-Authenticate` 改为可选、可回退到 `.well-known` endpoint（SEP-985）。
- elicitation schema 的所有基础类型（string/number/enum）支持**默认值**（SEP-1034）。
- 确立 **JSON Schema 2020-12** 为 MCP schema 默认方言（SEP-1613）。

**治理（Governance）**：正式化 MCP 治理结构、工作组/兴趣组，建立 **SDK 分级（tiering）制度**（SEP-932 / SEP-1302 / SEP-1730）。spec 页脚版权已署名 **"Model Context Protocol a Series of LF Projects, LLC."**，即由 Linux Foundation 系托管。

来源：[2025-11-25 Key Changes](https://modelcontextprotocol.io/specification/2025-11-25/changelog)、[一周年回顾博客](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)。

---

## 3. 协议骨架：JSON-RPC 2.0 + 状态化会话

MCP 底层选 **JSON-RPC 2.0**（不是 REST / GraphQL / gRPC）。原因归纳：

- 工具调用语义天然是 RPC（给名字 + 传参 → 等结果）。
- JSON-RPC 不绑定 transport，**支持双向**：server 也能向 client 发起请求（sampling / elicitation / roots）。
- 借鉴 LSP 的成熟经验，省一遍设计成本。

四个核心角色：

| 角色 | 含义 |
|---|---|
| **Host** | 发起连接的 LLM 应用（Claude Desktop、Cursor、ChatGPT 等） |
| **Client** | Host 内部的连接器，与一个 Server **一一对应** |
| **Server** | 提供上下文与能力的进程/服务 |
| **Session** | 有状态连接；初始化时做**能力协商（capability negotiation）** |

握手流程：`initialize` 阶段 client 声明"我支持哪些 capability、用哪个 protocol version"，server 回"我支持这些 primitive"。协商完成后所有调用都跑在这个 session 里。每个请求在 `_meta` 字段声明所用协议版本（draft lifecycle 文档明确）。来源：[spec architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture/index)、[lifecycle](https://modelcontextprotocol.io/specification/draft/basic/lifecycle)。

---

## 4. 核心概念

### 4.1 三大 Server primitives（server 给 client 提供能力）

按**谁触发**区分，这是理解 MCP 的关键分界：

| Primitive | 触发者 | 典型用法 | JSON-RPC 方法（示意） |
|---|---|---|---|
| **Tools** | LLM/模型**主动调** | 计算、查询、副作用、网络请求 | `tools/list`、`tools/call` |
| **Resources** | 用户 / client UI 决定 | 暴露只读数据，由 client 决定何时塞进上下文 | `resources/list`、`resources/read` |
| **Prompts** | 用户**主动选** | 模板化对话/工作流入口（如 slash command） | `prompts/list`、`prompts/get` |

- **Tools 例**：`get_weather(city)`，模型自主决定调用。
- **Resources 例**：`config://app/.env`（脱敏），用户在 UI 里"附加文件"拖进对话。
- **Prompts 例**：`/code-review`，用户敲 `/` 触发预设 system prompt + example。

**工具调用返回结构**（写 server 必记）：
```
{ content: [...], structuredContent?: {...}, isError?: boolean }
```
`content` 给模型看（可含 `text` / `image` / `audio` / `resource` 多种 part），`structuredContent` 给 client UI 看的结构化数据。**两个一起填最稳**。

**工具命名指南（SEP-986，SHOULD）**：`snake_case`、动宾或宾动结构、名字自解释、同 server 内不重复语义、name 与 description **写给模型看**。

### 4.2 三大 Client capabilities（client 反向给 server 提供能力）

| Capability | 含义 | 典型场景 |
|---|---|---|
| **Sampling** | server 让 Host 用它的 LLM 跑一次 completion（`2025-11-25` 起支持 tool calling） | server 内部要 AI 推理但不想自己付 API 费 |
| **Roots** | server 询问 client 它可操作哪些目录边界 | filesystem server 问"我能读哪些文件夹" |
| **Elicitation** | server 让 client 向用户索要更多输入 | "请输入 API key"、"请确认这次操作" |

**Elicitation 在 `2025-11-25` 的扩展**：新增 **URL elicitation**（SEP-1036，弹浏览器走 OAuth/付款）+ 基础类型**默认值**（SEP-1034）+ enum 标准化（SEP-1330）。来源：[elicitation 文档](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)。

### 4.3 Tasks：实验性长任务（`2025-11-25` 引入）

解决"工具跑 5 分钟、模型早超时"的问题，采用 **call-now / fetch-later**：

1. server 声明 `tasks` capability；
2. client 调 tool 时附 task 元数据，server 返回 `taskId`（而非结果）；
3. client 用 `taskId` 轮询，或断线重连后 resume 取结果。

任务状态：`working` / `input_required` / `completed` / `failed` / `cancelled`。

⚠️ 当前为 **experimental**，设计可能在后续版本演进；生产慎用。对 Vercel Hobby（10s 超时）这类平台尤其有意义。来源：[Tasks 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)。

### 4.4 其它实用工具方法

- **Cancellation**：任一方可发取消通知终止进行中的请求（[cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)）。
- **Completion**：为 prompt / resource template 的参数提供自动补全建议（`completion/complete`）。

---

## 5. 传输方式（Transport）

官方只剩**两种** transport。

> ⚠️ 老博客里的 **`HTTP+SSE`** transport 自 `2025-03-26` spec 起 **deprecated**，仅作向后兼容保留。新写的 server **不要用**。

| Transport | 部署形态 | 通信方式 | 适合场景 |
|---|---|---|---|
| **stdio** | client 把 server 当**子进程**拉起 | stdin/stdout 逐行 JSON-RPC（不能内嵌换行），stderr 走日志 | 本地工具，per-user 单实例 |
| **Streamable HTTP** | 独立 HTTP server | **单一 endpoint**（如 `/mcp`），POST/GET/DELETE | 远程工具，多用户共享 |

### 5.1 stdio 要点

- 每条消息一行，**不能内嵌换行**；
- **stdout 只能有 JSON-RPC 消息**，所有日志走 **stderr**（`2025-11-25` 明确 stderr 可用于所有日志类型）；
- 好处：零网络开销 + 进程级隔离，server 崩溃只影响自己。

### 5.2 Streamable HTTP 要点

单 endpoint 同时支持三种 HTTP 方法：

| 客户端动作 | Accept | 服务端可能响应 |
|---|---|---|
| `POST` JSON-RPC request | `application/json, text/event-stream` | `200 + JSON`（一次性）或 `200 + SSE`（升级流） |
| `POST` notification/response | — | `202 Accepted`，无 body |
| `GET` | `text/event-stream` | 打开 server→client 的 SSE 通道 |
| `DELETE` + `MCP-Session-Id` | — | 显式终止 session |

**三个关键 header**：

| Header | 谁设置 | 作用 |
|---|---|---|
| `MCP-Session-Id` | server init 时下发 | 客户端后续每次请求都带，标识 session |
| `MCP-Protocol-Version` | client 请求时带 | 如 `2025-11-25`，让 server 按版本响应 |
| `Origin` | 浏览器自动带 | server **必须校验**，非法返回 **403**（防 DNS rebinding） |

**Resumability（断线重连）**：SSE 事件带全局唯一 `id`，client 断线重连带 `Last-Event-ID`，server 重放未送达消息。`2025-11-25` 进一步明确：GET 流支持轮询、resumption 始终走 GET、event id 应编码 stream 身份（SEP-1699 / Issue #1847）。来源：[transports 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。

---

## 6. 官方 SDK

### 6.1 TypeScript SDK：`@modelcontextprotocol/sdk`

- **生产推荐 v1.x 线**。官方明确："v2 stable 预计 2026 Q1；在此之前 v1.x 仍是生产推荐版本；v2 ship 后 v1.x 至少再维护 6 个月。"（[TS SDK README](https://github.com/modelcontextprotocol/typescript-sdk)、[v2 文档站](https://ts.sdk.modelcontextprotocol.io/v2/)）
- **v1 vs v2 关键区别**：
  - **v1**：单包 `@modelcontextprotocol/sdk`，子路径导入（`/server/mcp.js`、`/client/streamableHttp.js`），schema 校验用 `zod`。
  - **v2**：拆为 `@modelcontextprotocol/server` 与 `@modelcontextprotocol/client` 两个独立包，改用 [Standard Schema](https://standardschema.dev/)（zod / valibot / arktype 均可），新增 middleware 包。
- **课程实测 pin**：第 24/25 节锁 `@modelcontextprotocol/sdk@1.29.0`（v1 stable）。⚠️ 注意 npm 搜索缓存可能显示更早的小版本（如 1.18.0，2025-09），写作时以课程实测 pin 与 v1.x 最新补丁为准，**核心 API 在 v1.x 内稳定**。

**最小 Server（stdio，v1 写法）**：
```typescript
// server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'demo', version: '1.0.0' });

server.registerTool(
  'add',
  {
    title: 'Add',
    description: 'Add two numbers.',
    inputSchema: { a: z.number(), b: z.number() }, // 注意：传 zod shape，SDK 内部包 z.object
  },
  async ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**最小 Client（stdio，v1 写法）**：
```typescript
// client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'demo-client', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'server.ts'] }));

const tools = await client.listTools();
const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
```

**Streamable HTTP client transport**：
```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'));
```

### 6.2 Python SDK：`mcp`（官方）+ `fastmcp`（第三方）

- **官方 `mcp`**：PyPI stable **1.27.x**（[PyPI](https://pypi.org/project/mcp/)、[GitHub](https://github.com/modelcontextprotocol/python-sdk)）。提供低阶 `Server` 和高阶 `FastMCP`（官方已内置一份 FastMCP）。
- **第三方 `fastmcp`**：**3.2.x**（jlowin / PrefectHQ 维护，[PyPI](https://pypi.org/project/fastmcp/)、[GitHub](https://github.com/jlowin/fastmcp)）。生态流行，API 更"Pythonic"。二者**二选一**即可。

**最小 Server（FastMCP，stdio）**：
```python
# server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

if __name__ == "__main__":
    mcp.run()  # 默认 stdio
```

**最小 Client（官方 SDK，stdio）**：
```python
# client.py
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(command="python", args=["server.py"])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            result = await session.call_tool("add", {"a": 2, "b": 3})
```

> 注：以上代码为**标准用法骨架（示意）**，写章节时若要标注 ssp-web 真实路径，请以 `26-mcp-in-practice.md` 中已实测的 ssp-web 改造代码为准。

---

## 7. MCP 与 Tool Calling 的关系（为什么需要 MCP）

最常见的疑问："我已经有 OpenAI Function Calling，为什么还要 MCP？"——**两者正交，可同时存在**。

| 维度 | OpenAI / Anthropic 原生 tool use | MCP |
|---|---|---|
| 协议范围 | 单 provider 内 | **跨 provider / 跨进程** |
| 颗粒 | 一次 API call 内传 tool schema | 持久连接，server 暴露能力 |
| 扩展面 | 仅 functions | tools + resources + prompts + sampling + elicitation + tasks |
| 鉴权 | 在你的 API key 范围内 | 独立 OAuth 2.1 / DCR / CIMD |
| 复用 | 每个 host 单写 adapter | **写一次 server，所有 client 通用** |

一句话：**Function Calling 是"模型怎么调这个工具"，MCP 是"这个工具怎么对外发布"**。实践上 MCP server 内部往往还是用 Function Calling 的语义来定义工具（zod schema + execute），外面再裹一层 MCP 协议发布出去。

**与 A2A 的关系**：MCP 解 "agent ↔ tool"（垂直，"USB-C for tools"），A2A（Google，2025-04）解 "agent ↔ agent"（水平，"HTTP for agents"），**互补不竞争**。典型组合：`Planner Agent ──A2A──> Domain Agent ──MCP──> 数据库/外部 API`。来源：[Auth0 - MCP vs A2A](https://auth0.com/blog/mcp-vs-a2a/)。

---

## 8. 生态现状

### 8.1 主流 MCP client（Host）

来自 [modelcontextprotocol.io/clients](https://modelcontextprotocol.io/clients) 的精选（能力随版本变化，写作时以官网为准）：

| 客户端 | 典型支持能力 |
|---|---|
| **Claude Desktop** / Claude.ai | Resources, Prompts, Tools, Apps, DCR |
| **Claude Code** | Resources, Prompts, Tools, Roots, Elicitation, DCR（**还能反向当 server**） |
| **ChatGPT** (OpenAI) | Tools, Apps, DCR |
| **Codex** (OpenAI) | Resources, Tools, Elicitation |
| **Cursor** | Prompts, Tools, Roots, Elicitation, DCR |
| **VS Code Copilot Chat** | 通过 `mcp.json` 接入 |
| **Continue / Cline** | Resources, Tools |
| **JetBrains AI Assistant** | Tools |
| **Gemini CLI** | Prompts, Tools, DCR |
| **Amazon Q CLI/IDE** | Tools |

值得注意的趋势：**Claude Code 双向**——既是 client（调别的 server），又能当 server 暴露给别的工具调。"Agent 互相做对方的 MCP server"是 2026 年的新形态。二手统计称约有 5 家 Anthropic/OpenAI 原生 host + VS Code/Copilot 作为第 6 个标准接入面（二手，见 [digitalapplied H1 2026 回顾](https://www.digitalapplied.com/blog/mcp-ecosystem-h1-2026-retrospective-adoption-data-points)）。

### 8.2 官方 Registry 与市场

- **官方 Registry**：[registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io)，由 Anthropic、GitHub、PulseMCP、Microsoft 等共建的**集中化元数据仓库**（[registry 介绍](https://modelcontextprotocol.io/registry)）。registry 后端开源仓库 [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry)。
- **第三方聚合站**：Smithery、PulseMCP、glama.ai、mcp.so、awesome-mcp-servers。
- **生态规模（均为二手统计，写作时谨慎引用、标注来源与日期）**：
  - 公开 registry server 数：报道区间约 **8,000 ~ 9,400+**（[fast.io](https://fast.io/resources/mcp-server-marketplace/)、[digitalapplied](https://www.digitalapplied.com/blog/mcp-ecosystem-h1-2026-retrospective-adoption-data-points)）。
  - 跨多个聚合站去重后总量更大，[mcptoplist.com](https://mcptoplist.com/) 称截至 2026-05 覆盖 **52,861** 个 server（跨 Official Registry / Glama / Smithery / mcp.so / GitHub 组织）。
  - ⚠️ 这些数字**未在官方一手源直接确认**，仅作"生态规模感"参考，正文若引用务必写明"二手统计、口径不同"。

### 8.3 官方 reference servers（精选核心）

| Server | 用途 |
|---|---|
| `@modelcontextprotocol/server-everything` | 测试用，覆盖全部 primitive |
| `mcp-server-fetch`（Python） | 抓网页转 markdown |
| `@modelcontextprotocol/server-filesystem` | 文件读写 |
| `mcp-server-git`（Python） | git repo 操作 |
| `@modelcontextprotocol/server-memory` | knowledge graph 持久记忆 |
| `@modelcontextprotocol/server-sequential-thinking` | 强制分步推理 |
| `mcp-server-time`（Python） | 时区转换 |

⚠️ **反例（写作避坑）**：很多老博客引用的 `server-github` / `server-postgres` / `server-slack` 已迁到 [servers-archived](https://github.com/modelcontextprotocol/servers-archived) 不再维护。现状参见 [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)。GitHub 推荐用其官方实现。

### 8.4 调试工具：Inspector

[`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) 是调试 MCP server 的标准工具（"MCP 世界的 curl"）：
```bash
# UI 模式（默认开 http://localhost:6274）
npx @modelcontextprotocol/inspector npx -y @modelcontextprotocol/server-filesystem /tmp
# CLI 模式（适合 CI）
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method tools/list
```

---

## 9. 把 ssp-web 三个工具改造成 MCP Server 的思路

ssp-web 现有三个 AI SDK v6 工具（见 `course/code-facts.md` §4.3，源文件 `ssp-web/src/lib/ai/tools.ts`）：

| 工具 | ssp-web 真实位置 | 现有语义 |
|---|---|---|
| `computePlan` | `tools.ts:174-266` | 调 `orchestrate({ user })` 跑规则引擎，返回 plan/calc/meta |
| `validateField` | `tools.ts:270-279`（实现 402-536） | 单字段格式校验，按 `field` switch |
| `updateProfile` | `tools.ts:282-318` | 客户端结构化提取，`return { updated, profile }` 交前端合并 |

**改造核心认知**：**内部 `execute` 逻辑不变，只是把 schema + execute 重新用 MCP SDK 注册，外面包一层协议**。三步：

1. **抽离工具定义**：把每个工具的 zod inputSchema 与 execute 从 ssp-web 抽到独立 `mcp-server-ssp/` 工程（或内嵌为一条 API route）。
2. **重注册为 MCP tool**：用 `server.registerTool(name, { title, description, inputSchema }, handler)`，handler 返回 `{ content: [...], structuredContent }`。
   - `computePlan` → 直接调底层 `orchestrate`，把结果同时填 `content`（给模型）和 `structuredContent`（给 UI）。
   - `updateProfile` → MCP 里没有"前端 onFinish 钩子"，改为把 profile 存到 server 自己的 session 存储（in-memory / Redis），供同 session 的后续 `computePlan` 复用。
   - `validateField` → 几乎一比一搬，按 `field` switch 复用 ssp-web 校验逻辑。
3. **选 transport + 部署**：
   - 本地给个人用 → **stdio**，发 npm 包，用户 `npx` 拉起；
   - 远程多用户 → **Streamable HTTP**，Vercel（`mcp-handler`）或 Cloudflare Workers（`agents` 的 `McpAgent` Durable Object）；远程**必须加鉴权**（Bearer / OAuth 2.1）+ Origin 校验 + 限流。

**反向**：ssp-web 也可同时做 **MCP client**，用 AI SDK v6 的 `createMCPClient()`（包 `@ai-sdk/mcp`，注意 v6 已去掉 `experimental_` 前缀）+ `mcp.tools()` 把外部 MCP 工具合并进 `streamText({ tools })`，注意命名冲突加前缀、超时用 `AbortController` 控、失败降级。

> 详细落地代码（含 Vercel / Cloudflare / Inspector / Cursor & Claude Code 配置 / 鉴权 / 限流 / 日志 / 生产 checklist）见 `26-mcp-in-practice.md`，其包版本以该节实测表为准。

---

## 10. 章节追溯映射

| 章节文件 | 标题 | 本报告对应小节 |
|---|---|---|
| `25-mcp-protocol.md`（第 24 节） | MCP 协议拆解 | §1 定位 / §2 版本演进 / §3 JSON-RPC 骨架 / §4 核心概念 / §5 传输 / §7 与 Tool Calling 关系 / §8 生态 |
| `26-mcp-in-practice.md`（第 25 节） | MCP 实战 | §5 传输部署 / §6 SDK 用法 / §8.4 Inspector / §9 ssp-web 改造思路 |

---

## 11. 引用来源（可信链接）

**官方一手源（modelcontextprotocol.io / GitHub 组织）**：

- [MCP 官网](https://modelcontextprotocol.io)
- [spec 2025-11-25 Key Changes（changelog）](https://modelcontextprotocol.io/specification/2025-11-25/changelog) — §2.1 全部变更已据此核实
- [spec 2025-11-25 入口](https://modelcontextprotocol.io/specification/2025-11-25)
- [Transports 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [Tasks 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)
- [Elicitation 规范](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- [Cancellation 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)
- [一周年回顾博客（2025-11-25）](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [2026-07-28 spec RC 公告](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- [TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) / [v2 文档站](https://ts.sdk.modelcontextprotocol.io/v2/)
- [Python SDK GitHub](https://github.com/modelcontextprotocol/python-sdk) / [PyPI mcp](https://pypi.org/project/mcp/)
- [官方 Registry](https://registry.modelcontextprotocol.io) / [registry 介绍](https://modelcontextprotocol.io/registry) / [registry 仓库](https://github.com/modelcontextprotocol/registry)
- [reference servers 仓库](https://github.com/modelcontextprotocol/servers) / [servers-archived](https://github.com/modelcontextprotocol/servers-archived)
- [Inspector 仓库](https://github.com/modelcontextprotocol/inspector)
- [Anthropic MCP 公告](https://www.anthropic.com/news/model-context-protocol)

**第三方 / 二手（仅作对比或生态规模感，引用须标注）**：

- [fastmcp（PyPI）](https://pypi.org/project/fastmcp/) / [fastmcp GitHub](https://github.com/jlowin/fastmcp)
- [Auth0 - MCP vs A2A](https://auth0.com/blog/mcp-vs-a2a/) / [Auth0 - 2025-11 spec 更新（CIMD / XAA）](https://auth0.com/blog/mcp-november-2025-specification-update.md)
- [digitalapplied - MCP 生态 H1 2026 回顾](https://www.digitalapplied.com/blog/mcp-ecosystem-h1-2026-retrospective-adoption-data-points)（二手统计）
- [fast.io - MCP server marketplace](https://fast.io/resources/mcp-server-marketplace/)（二手统计）
- [mcptoplist.com](https://mcptoplist.com/)（二手统计）

> 写作铁律：凡"版本号 / API 名称 / 协议条款"类陈述，**优先回链官方一手源**；凡"安装量 / server 总数"类数字，**必须标注二手 + 日期 + 口径**，不得作为确定事实陈述。
