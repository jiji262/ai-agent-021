# 研究报告：Vercel AI SDK v6

> **调研日期**：2026-02-28（API 声明已于交付前对照 ai-sdk.dev v6 官方文档逐条复核）
> **用途**：本文件是 `course/code-facts.md`（Tech_Stack_Reference）的**补充研究报告**。`code-facts.md` 锁定 `ssp-web` 真实依赖与代码事实；本报告补充 AI SDK v6 的官方 API 语义、版本归属与权威来源，供章节重写时**追溯技术声明、避免幻觉**。
> **配套项目版本基线**（来自 `ssp-web/package.json`）：`ai` `^6.0.99`、`@ai-sdk/openai` `^3.0.33`、`@ai-sdk/react` `^3.0.103`。
> **追溯映射**：本报告主要服务 06（技术栈）、07（最小 Agent）、11（动态上下文）、12（Tool Calling）、17（前端集成）、18（流式 UI）等节。
>
> **来源合规说明**：本文转述自下列官方文档，未逐段复制；代码示例为最小化改写或直接引用 `ssp-web` 真实源码。内容已为合规重新组织。

---

## 0. 版本背景与权威来源

AI SDK 6 是 Vercel 在 2025 年底发布的主版本，官方公告强调它带来 agents、tool execution approval、DevTools、完整 MCP 支持、reranking、图像编辑等能力（[AI SDK 6 公告](https://vercel.com/blog/ai-sdk-6)，2025-12）。配套项目 `ssp-web` 锁定 `ai` `^6.0.99`，因此本课程所有 AI SDK 技术声明以 **v6** 为准。

权威来源清单（本报告全程引用）：

- 官方文档站点：[ai-sdk.dev/docs](https://ai-sdk.dev/docs)（页眉标注 `v6 (Latest)` / `AI SDK 6.x`）
- Tool Calling：[Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- 多步循环控制：[Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- 聊天 UI（useChat）：[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)
- Transport：[Transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport)
- 结构化输出：[Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- 升级指南：[Migrate AI SDK 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
- stepCountIs 参考：[stepCountIs](https://ai-sdk.dev/docs/reference/ai-sdk-core/step-count-is)

> 包结构提醒（v6 命名）：服务端核心 API（`streamText`、`generateText`、`tool`、`convertToModelMessages`、`stepCountIs`、`UIMessage` 类型等）来自 `ai` 包；React hook `useChat` 来自 `@ai-sdk/react`；OpenAI provider（`createOpenAI`）来自 `@ai-sdk/openai`。

---

## 1. `streamText`（AI SDK v6，`ai` 包）

`streamText` 是服务端流式生成的核心原语，返回一个 `StreamTextResult`，可直接转成 SSE 响应。它接收 `model`、`system`、`messages`、`tools`、`stopWhen`、`temperature`、`providerOptions`、`onFinish` 等参数。配合 `tools` 与 `stopWhen` 即可实现多步工具调用循环。来源：[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)、[Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)。

最小官方示例（route handler，转述自官方文档）：

```ts
import { convertToModelMessages, streamText, UIMessage } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.5',
    system: 'You are a helpful assistant.',
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

`ssp-web` 真实用法（`src/lib/ai/agent.ts:47-79`，封装在 `createChatStream`）：

```ts
// src/lib/ai/agent.ts
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs } from "ai";

return streamText({
  model: openai(model),
  system: systemPrompt,
  messages,
  providerOptions: {
    openai: { store: false },  // 中转网关兼容，见 §6
  },
  tools,
  stopWhen: stepCountIs(8),    // 多步工具调用上限，见 §4
  temperature: 0.3,
  onFinish,
});
```

> **看这里 →**：`ssp-web` 把 `streamText` 的 `messages` 设为 `ModelMessage[]`（已由 `convertToModelMessages` 转换），并通过 `tools` + `stopWhen` 开启多步循环。`onFinish` 回调用于把完整消息写库。

### `result.toUIMessageStreamResponse()`

`streamText` 的结果对象提供 `toUIMessageStreamResponse()`，把流转成符合 UIMessage 流协议的 HTTP 响应（SSE），供 `useChat` 在前端消费。它支持若干回调与开关参数：

- `originalMessages`：把本轮原始 UIMessage 传入，便于在 `onFinish` 里拿到合并后的完整消息列表用于持久化。
- `onFinish({ messages })`：流结束回调，`messages` 为持久化用的完整消息。
- `onError(error)`：把错误转成对用户友好的文本（默认错误信息会被遮蔽为 "An error occurred."，需显式 `onError` 才返回自定义文案）。
- `messageMetadata({ part })`：在 `start` / `finish` 等阶段附加元数据（如 `createdAt`、`totalUsage.totalTokens`）。
- `sendReasoning` / `sendSources`：转发推理 token / 来源。

来源：[Chatbot — Controlling the response stream](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)、[Tool Calling — streamText errors](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)。

`ssp-web` 真实用法（`src/app/api/chat/route.ts:234-261`）：

```ts
// src/app/api/chat/route.ts
const messages = await convertToModelMessages(uiMessages);
const result = createChatStream(messages, context);

const response = result.toUIMessageStreamResponse({
  originalMessages: uiMessages,
  onFinish: async ({ messages: persistedMessages }) => {
    await updateConversation(conversation.id, {
      messages: persistedMessages as unknown[],
      userProfile,
    });
  },
  onError: (streamErr) => {
    logger.warn("chat.stream_error", { /* ... */ });
    return "抱歉，回复中断了。请发送“继续”，我会接着回答。";
  },
});
```

---

## 2. `generateText`（AI SDK v6，`ai` 包）

`generateText` 是非流式（一次性返回）的文本生成原语，参数与 `streamText` 基本对齐（`model`、`tools`、`stopWhen`、`prepareStep`、`toolChoice` 等），返回 `text`、`steps`、`toolCalls`、`toolResults`、`response.messages` 等。适合后台批处理、不需要逐 token 流式的场景。来源：[Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)。

最小官方示例（转述）：

```ts
import { z } from 'zod';
import { generateText, tool, stepCountIs } from 'ai';

const { text, steps } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ location, temperature: 72 }),
    }),
  },
  stopWhen: stepCountIs(5),
  prompt: 'What is the weather in San Francisco?',
});
```

> `ssp-web` 运行时不使用 `generateText`（聊天链路全程走 `streamText`）；课程介绍它作为「非流式对照原语」即可，**不要**声称 `ssp-web` 用了它（属于示意/对照，非项目实际代码）。
> 多步结果可通过 `steps` 访问中间 tool calls/results，或用 `onStepFinish` 回调逐步观察。

---

## 3. `tool()` helper（AI SDK v6，`ai` 包）

v6 的工具用 `tool({ description, inputSchema, execute })` 定义。关键字段（来源：[Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)）：

- `description`：可选，影响模型何时选用该工具。
- `inputSchema`：**Zod schema 或 JSON schema**，既喂给 LLM 也用于校验工具调用入参。（v6 字段名为 `inputSchema`，这是相对早期版本 `parameters` 的命名变化，见 §8。）
- `execute`：可选 async 函数，缺省时表示把工具调用转发给客户端/队列而非本进程执行。
- `strict`（可选）：provider 支持时启用严格工具调用。
- `needsApproval`（可选，布尔或 async 函数）：开启「工具执行审批」，模型生成调用后先返回 `tool-approval-request`，需补 `tool-approval-response` 再执行（v6 新增能力）。

`tool()` helper 的主要价值是**类型推断**：它让 `execute` 的入参类型从 `inputSchema` 推出，便于把工具抽到独立文件。来源：[Tool Calling — Extracting Tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)。

`ssp-web` 真实用法（`src/lib/ai/tools.ts`，用 `tool()` + `zodSchema(z.object(...))` 注册三个工具）：

```ts
// src/lib/ai/tools.ts
import { tool, zodSchema } from "ai";
import { z } from "zod/v4";

export const computePlanTool = tool<
  ComputePlanInput,
  Awaited<ReturnType<typeof computePlanExecute>>
>({
  description:
    "调用社保规则引擎，根据用户参数计算社保规划方案……如果引擎返回 needs_agent=true，说明仍有缺失字段，需要继续追问用户。",
  inputSchema: zodSchema(computePlanSchema),
  execute: computePlanExecute,
});

// 三个工具聚合导出（tools.ts:322-326）
export const tools = {
  computePlan: computePlanTool,
  validateField: validateFieldTool,
  updateProfile: updateProfileTool,
};
```

> **看这里 →**：`ssp-web` 用 `zodSchema(z.object(...))` 显式包一层（配合 `zod/v4` 入口）。官方文档示例多直接传 `z.object(...)`；两种写法都符合 v6「`inputSchema` 接受 Zod 或 JSON schema」的约定。`updateProfile` 工具的 `execute` 直接 `return { updated: true, profile: params }`，把结构化提取结果回传客户端，是「工具结果驱动前端副作用」的典型。

工具相关补充能力（v6，按需在 12/14 节引用）：

- **`toolChoice`**：`auto`（默认）/ `required` / `none` / `{ type: 'tool', toolName }`。
- **动态工具 `dynamicTool`**：schema 运行时才知道（如 MCP 工具）时使用，入参类型为 `unknown`。
- **工具输入生命周期钩子**：`onInputStart` / `onInputDelta` / `onInputAvailable`（前两个仅流式 `streamText` 触发）。
- **错误类型**：`NoSuchToolError`、`InvalidToolInputError`、`ToolCallRepairError`；`execute` 抛错会变成 `tool-error` 内容片段以支持多步回灌。

---

## 4. 多步工具调用：`stopWhen` 与 `stepCountIs`（AI SDK v6，`ai` 包）

`stopWhen` 控制「当最后一步含工具结果时」何时停止多步循环。当设置了 `stopWhen` 且模型生成了工具调用，SDK 会带着工具结果触发新一轮生成，直到没有更多工具调用或满足停止条件。来源：[Tool Calling — Multi-Step Calls](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)、[Loop Control](https://ai-sdk.dev/docs/agents/loop-control)。

内置停止条件：

- `stepCountIs(count)`：达到指定步数后停止。
- `hasToolCall(toolName)`：调用了指定工具后停止。
- `isLoopFinished()`：永不主动触发，让循环跑到模型自然结束（无步数上限，慎用）。

可用数组组合多个条件（满足任一即停），也可写自定义 `StopCondition`。来源：[Loop Control](https://ai-sdk.dev/docs/agents/loop-control)。

> **关键默认值（务必区分两套，写作高频踩坑点）**：
> - **核心函数 `streamText` / `generateText`**：`stopWhen` 默认 **`stepCountIs(1)`**——即**默认只跑一步、不开多步工具循环**。要让模型在拿到工具结果后继续生成，**必须显式传 `stopWhen`**。来源：[streamText 参考](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)（`stopWhen` 参数明确标注 "Default: stepCountIs(1)"）。
> - **Agent 类 `ToolLoopAgent`**：`stopWhen` 默认 **`stepCountIs(20)`**（作为防失控的安全上限）。该默认在 v5→v6 从 `stepCountIs(1)` 改为 `stepCountIs(20)`。来源：[Loop Control](https://ai-sdk.dev/docs/agents/loop-control)、[Migrate 5.x→6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)。
>
> 换句话说：`ssp-web` 走的是**核心函数 `streamText`** 这条路，默认是单步；它显式写 `stopWhen: stepCountIs(8)` 不是「把 20 收紧到 8」，而是**主动开启上限为 8 步的多步工具循环**（否则 `computePlan` 的结果无法回灌给模型继续作答）。

`ssp-web` 真实用法（`src/lib/ai/agent.ts`）：`stopWhen: stepCountIs(8)`——显式开启上限 8 步的多步工具循环，注释说明是「避免复杂对话里在输出结论前提前截断」。

```ts
// src/lib/ai/agent.ts
import { streamText, stepCountIs } from "ai";

streamText({
  // ...
  tools,
  stopWhen: stepCountIs(8),
});
```

补充：v6 还提供 `prepareStep` 回调，可在每步前动态改 `model` / `activeTools` / `toolChoice` / `messages`（用于上下文压缩、分阶段限工具等）。`ssp-web` 当前未用 `prepareStep`，介绍时按「示意」处理。来源：[Loop Control — Prepare Step](https://ai-sdk.dev/docs/agents/loop-control)。

---

## 5. `convertToModelMessages`（AI SDK v6，`ai` 包）

`convertToModelMessages` 把前端的 **UIMessage[]**（带 `parts` 的 UI 消息）转换成 **ModelMessage[]**（喂给模型的消息）。它是「UI 协议」与「模型协议」之间的桥：前端用 UIMessage 渲染富 UI，服务端用 ModelMessage 调模型。来源：[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)。

官方最小用法：

```ts
import { convertToModelMessages, streamText, UIMessage } from 'ai';

const { messages }: { messages: UIMessage[] } = await req.json();
const result = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  messages: await convertToModelMessages(messages),
});
```

`ssp-web` 真实用法（`src/app/api/chat/route.ts`）：`const messages = await convertToModelMessages(uiMessages);`，随后把 `messages`（`ModelMessage[]`）交给 `createChatStream`。注意 `ssp-web` 把它当作 `await` 的异步调用使用，与官方示例一致。

> 命名提醒：v6 用 `convertToModelMessages` + `ModelMessage`；这是相对早期 `convertToCoreMessages` / `CoreMessage` 的命名演进（见 §8）。课程引用务必用 v6 名称。

---

## 6. Provider：`@ai-sdk/openai` 的 `createOpenAI` 与 provider options

`@ai-sdk/openai`（`ssp-web` 锁 `^3.0.33`）提供 OpenAI 模型 provider。`createOpenAI({ apiKey, baseURL })` 创建一个可配置 provider 实例，再用 `openai(model)` 得到具体模型句柄。来源：[@ai-sdk/openai (npm)](https://www.npmjs.com/package/@ai-sdk/openai)。

`ssp-web` 真实用法（`src/lib/ai/agent.ts` + `src/lib/ai/config.ts`）：

```ts
// src/lib/ai/agent.ts
const { apiKey, baseURL, model } = getOpenAIConfig();
const openai = createOpenAI({ apiKey, baseURL });

streamText({
  model: openai(model),
  // ...
  providerOptions: {
    openai: { store: false },
  },
});
```

`getOpenAIConfig()`（`config.ts`）从 `OPENAI_API_KEY` / `OPENAI_MODEL`（必填）与 `OPENAI_URL` / `OPENAI_BASE_URL`（可选，默认 `https://api.openai.com/v1`）读取配置，并对中转网关 key（`cr_` 前缀）做强制 `baseURL` 校验。

**`providerOptions.openai.store` 说明**：OpenAI 的 Responses API 支持服务端持久化对话条目（`store`）。`ssp-web` 显式设 `store: false`，源码注释解释原因是「中转网关可能默认不持久化 responses item，显式关闭 store 避免 `item_reference` 丢失」。这是 provider 专属选项，通过 `providerOptions.openai` 透传。关于 Responses API 的持久化与内置工具能力，见 [OpenAI Responses API（AI SDK 指南）](https://sdk.vercel.ai/docs/guides/openai-responses)。

> **看这里 →**：`providerOptions` 是 v6 透传 provider 专属配置的标准位置（key 为 provider 名，如 `openai`）。课程讲 `store: false` 时应连同「为什么」一起讲——这是 `ssp-web` 为兼容中转网关做的真实工程决策。

---

## 7. `@ai-sdk/react` 的 `useChat` 与 Transport（AI SDK v6）

`useChat`（来自 `@ai-sdk/react`，`ssp-web` 锁 `^3.0.103`）管理聊天 UI 状态：`messages`、`sendMessage`、`status`、`stop`、`regenerate`、`setMessages`、`error` 等。v6 的关键变化是**消息以 `parts` 数组渲染**（见 §7.1），并通过 **transport** 对象配置如何与后端通信。来源：[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)、[Transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport)。

官方最小用法（`DefaultChatTransport`）：

```ts
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
```

`status` 取值：`submitted`（已发出、等待流开始）、`streaming`（流式接收中）、`ready`（完成、可发下一条）、`error`。

### 7.1 UIMessage 协议与 message parts

v6 中 UIMessage 有一个 `parts` 数组，推荐用它渲染消息（替代旧的 `content` 字符串）。`parts` 支持多种类型，便于构建富 UI。来源：[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)。常见 part 类型：

- `text`：文本片段（`part.text`）。
- `reasoning`：推理 token（需服务端 `sendReasoning: true` 转发）。
- `tool-<toolName>`：**类型化的工具调用 part**（v6 用 `tool-工具名` 命名，如 `tool-computePlan`），承载该工具的输入/输出与状态。
- `dynamic-tool`：动态工具的调用 part。
- `source-url` / `source-document`：来源（需 `sendSources: true`）。
- `file`：文件/图片（如生成的图片，`part.mediaType` + `part.url`）。
- `data-<name>`：**自定义 data parts**，服务端通过 `createUIMessageStream` 的 `writer.write({ type: 'data-...', id, data })` 推送，用于流式自定义状态。来源：[Tool Calling — Tool Call ID](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)、[Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)。

渲染范式（官方）：

```ts
{message.parts.map((part, i) => {
  if (part.type === 'text') return <span key={i}>{part.text}</span>;
  if (part.type === 'reasoning') return <pre key={i}>{part.text}</pre>;
  return null;
})}
```

`ssp-web` 真实用法（`src/components/chat/ChatPanel.tsx` 的 `onFinish` 扫描 `message.parts`，对 `tool-computePlan` / `tool-updateProfile` 的结果做副作用，如更新 `planId`、deepMerge profile）——这正是 v6「`tool-<toolName>` parts」协议的落地。

### 7.2 Transport 家族（v6）

v6 把「如何发消息、如何处理响应」抽象为 transport（来源：[Transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport)、[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)）：

| Transport | 来源包 | 用途 |
|---|---|---|
| `DefaultChatTransport` | `ai` | 默认：向 `api` 端点发 HTTP POST，处理 UIMessage 流响应 |
| `TextStreamChatTransport` | `ai` | 消费纯文本流（`streamProtocol: 'text'`）；不支持 tool calls/usage/finish 信息 |
| `DirectChatTransport` | `ai` | 不走 HTTP，直接调 Agent 的 `stream()` 方法（SSR / 测试 / 单进程场景） |
| `AssistantChatTransport` | `@assistant-ui/react-ai-sdk` | assistant-ui 提供的 transport，对接 AI SDK runtime |

`DefaultChatTransport` 支持 `headers` / `body` / `credentials`（可为静态值或返回值的函数），以及 `prepareSendMessagesRequest`（自定义请求体、按 `trigger` 做路由，如 `submit-user-message` / `regenerate-assistant-message`）。

`ssp-web` 真实用法（`src/components/chat/ChatPanel.tsx`）用的是 `AssistantChatTransport`（来自 `@assistant-ui/react-ai-sdk` `^1.3.10`，配合 `@assistant-ui/react` `^0.12.14`）：

```ts
// src/components/chat/ChatPanel.tsx
const transport = useMemo(
  () => new AssistantChatTransport({
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
        conversationId, sessionId, questions,
        userProfile: sessionProfile, planId,
      },
    }),
  }),
  [/* deps */],
);

const chat = useChat({ id: conversationId, transport, messages: initialMessages ?? [] });
```

> **看这里 →**：`ssp-web` 用 `prepareSendMessagesRequest` 把 `conversationId` / `sessionId` / `userProfile` 等业务字段塞进请求体，后端 `route.ts` 再从 body 解构出来。这与官方「Setting custom body fields per request」是同一机制。`AssistantChatTransport` 是 assistant-ui 生态的产物，不是 `ai` 包内置；课程讲集成时要说清来源包。

### 7.3 useChat 事件回调与类型推断

- 回调：`onFinish({ message, messages, isAbort, isDisconnect, isError })`、`onError(error)`、`onData(data)`（收到 data part 时触发；在 `onData` 抛错可中止追加该消息）。
- 请求级配置（推荐）：`sendMessage({ text }, { headers, body, metadata })`，优先级高于 hook 级。
- 类型推断：`InferUITool` / `InferUITools` 从工具集推 UI 工具类型，配合 `UIMessage<never, UIDataTypes, MyUITools>` 得到强类型 UIMessage，可传给 `useChat<MyUIMessage>()`。
- 节流：`experimental_throttle`（仅 React）限制渲染频率。

来源：[Chatbot — Event Callbacks / Type Inference for Tools](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)。

`ssp-web` 在 `useChat` 上用了 `id`、`transport`、`messages`、`onFinish`（`ChatPanel.tsx`）。

---

## 8. 结构化输出：`generateObject` / `streamObject` 与 `Output`（AI SDK v6）

v6 提供两条结构化输出路径（来源：[Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)、[generateObject 参考](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object)）：

1. **`generateObject` / `streamObject`**：传 `schema`（Zod / Valibot / JSON schema）直接生成/流式生成结构化对象；前端可配 `useObject` hook 流式渲染。
2. **`generateText` / `streamText` + `output: Output.object({ schema })`**：v6 标准化的「在文本生成里附带结构化输出」路径。

> **v6 重要变化**：官方在 v6 将 `generateObject` / `streamObject` 标注为 **deprecated**，推荐改用 `generateText` / `streamText` 配 `output: Output.object({ schema })`。来源：[generateObject 参考](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object)（"generateObject is deprecated. Use generateText with the output property instead."）。课程涉及结构化输出时应**优先讲 `Output.object` 路径**，把 `generateObject` 作为历史/对照提及（不与课程版本措辞冲突——这是描述第三方库自身演进，合规）。

最小示例（`streamText` + `Output.object`，转述自官方 cookbook）：

```ts
import { streamText, Output } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  output: Output.object({
    schema: z.object({ title: z.string(), tags: z.array(z.string()) }),
  }),
  prompt: '...',
});
```

> `ssp-web` 不使用结构化输出 API（它的结构化数据来自规则引擎而非 LLM 直接产出）。课程引用 `generateObject` / `streamObject` / `Output.object` 一律按「示意，非项目实际代码」标注。

---

## 9. Tool Call Repair（实验特性，AI SDK v6）

`experimental_repairToolCall` 用于在不增加额外步骤的前提下修复非法工具调用（模型给出的入参不满足 schema 时）。它是回调函数，接收 `{ toolCall, tools, inputSchema, error, messages, system }`，返回修好的 tool call 或 `null`（放弃修复）。常见策略：用带结构化输出的模型重生成入参、或把错误回灌给更强模型重试（re-ask）。来源：[Tool Calling — Tool Call Repair](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)。

> 标注：该特性官方注明「experimental，未来可能变化」，函数名带 `experimental_` 前缀。`ssp-web` 未启用 tool call repair；课程介绍时按「示意」处理，并提醒读者其实验状态。

最小示例（结构化输出修复，转述）：

```ts
const result = await generateText({
  model, tools, prompt,
  experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
    if (NoSuchToolError.isInstance(error)) return null; // 不修工具名错误
    const tool = tools[toolCall.toolName as keyof typeof tools];
    const { output: repaired } = await generateText({
      model: 'anthropic/claude-sonnet-4.5',
      output: Output.object({ schema: tool.inputSchema }),
      prompt: '修复以下不合法的工具入参……',
    });
    return { ...toolCall, input: JSON.stringify(repaired) };
  },
});
```

---

## 10. v6 相对早期版本的关键变化（仅作客观技术演进描述）

> 下表只描述**第三方库 AI SDK 自身**的版本演进（用于解释为何课程用某些 v6 名称），不涉及本课程版本，符合 style-guide §3.3。来源：[Migrate AI SDK 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)、[AI SDK 6 公告](https://vercel.com/blog/ai-sdk-6)、[v5→v6 迁移要点（第三方整理）](https://www.digitalapplied.com/blog/vercel-ai-sdk-v5-to-v6-migration-playbook-2026)。

| 维度 | v6 现状（课程采用） | 说明 |
|---|---|---|
| 工具入参字段 | `inputSchema` | 早期版本用 `parameters`；v6 统一为 `inputSchema` |
| 消息转换 | `convertToModelMessages` + `ModelMessage` | 早期为 `convertToCoreMessages` / `CoreMessage` |
| UI 消息渲染 | `message.parts`（推荐） | 早期依赖 `content` 字符串；v6 以 parts 为一等公民 |
| 多步循环 | `stopWhen` + `stepCountIs(n)` | 早期用 `maxSteps`；v6 改为可组合的停止条件。核心函数 `streamText`/`generateText` 默认仍是 `stepCountIs(1)`（单步）；`ToolLoopAgent` 的默认从 v5 的 `stepCountIs(1)` 改为 v6 的 `stepCountIs(20)` |
| 前端通信 | transport 对象（`DefaultChatTransport` 等） | v5/v6 引入 transport 抽象，hook 不再内置写死 fetch |
| Agent 抽象 | `ToolLoopAgent` 类、tool execution approval、完整 MCP | v6 公告的核心新增能力 |
| 结构化输出 | 推荐 `Output.object`；`generateObject`/`streamObject` deprecated | v6 标准化到 `output` 属性 |

> 写作提醒：课程**不得**用「v1/v2/旧版本/历史归档」等措辞指代**本课程**；但客观写「AI SDK v6 的 `inputSchema`（早期版本叫 `parameters`）」是允许的——版本号修饰的是第三方库，不是课程自身。

---

## 11. 章节追溯速查（写作时引用本报告的哪一节）

| 章节 | 主要追溯小节 | 关键 API |
|---|---|---|
| 06 技术栈 2026 | §0, §10 | 版本归属、v6 演进总览 |
| 07 最小 Agent | §1, §4, §5, §6 | `streamText` + `stopWhen(stepCountIs)` + `convertToModelMessages` + `createOpenAI` |
| 11 动态上下文 | §1, §5 | `system` 拼接、`convertToModelMessages`、`buildContextPrompt`（ssp-web） |
| 12 Tool Calling | §3, §4, §9 | `tool()` / `inputSchema` / `toolChoice` / `stopWhen` / repair |
| 17 前端集成 | §7 | `useChat` + transport + `prepareSendMessagesRequest` |
| 18 流式 UI | §1, §7.1 | `toUIMessageStreamResponse` + UIMessage parts（`tool-*` / `data-*`） |

---

## 12. ssp-web 真实用法对齐核对清单（防幻觉）

写 06/07/11/12/17/18 时，凡引用以下点，务必与 `code-facts.md` 的真实片段一致：

- ✅ `streamText` + `tool()` + `stopWhen: stepCountIs(8)` + `convertToModelMessages` + `toUIMessageStreamResponse` 均为 `ssp-web` **真实使用**的 API（见 `agent.ts`、`route.ts`、`tools.ts`）。
- ✅ `providerOptions.openai.store = false` 为 `ssp-web` 真实配置（`agent.ts`），原因是中转网关兼容。
- ✅ 前端 transport 为 `AssistantChatTransport`（来自 `@assistant-ui/react-ai-sdk`），**非** `ai` 包内置的 `DefaultChatTransport`；引用 `DefaultChatTransport` / `DirectChatTransport` / `TextStreamChatTransport` 时标注「示意/对照」。
- ✅ `temperature: 0.3`、`stopWhen: stepCountIs(8)` 是 `ssp-web` 的真实数值，不要写成官方示例里的 `stepCountIs(5)` 或 `ToolLoopAgent` 默认 20。注意 `ssp-web` 用的是**核心函数 `streamText`**（默认单步 `stepCountIs(1)`），显式 `stepCountIs(8)` 是**主动开启**上限 8 步的多步循环，**不是**把 20 收紧到 8。
- ⚠️ `generateText`、`generateObject`/`streamObject`/`Output.object`、`prepareStep`、`experimental_repairToolCall`、`dynamicTool` 在 `ssp-web` 中**未使用**，引用时一律标注「（示意，非项目实际代码）」。
- ⚠️ 包归属：`useChat` 属 `@ai-sdk/react`；`streamText`/`tool`/`convertToModelMessages`/`stepCountIs`/`UIMessage` 属 `ai`；`createOpenAI` 属 `@ai-sdk/openai`。不要写错来源包。

---

## 附：完整来源清单

1. [AI SDK 6 公告 — Vercel Blog](https://vercel.com/blog/ai-sdk-6)（2025-12）
2. [AI SDK 文档首页（v6 Latest）](https://ai-sdk.dev/docs)
3. [Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
4. [Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
5. [stepCountIs 参考](https://ai-sdk.dev/docs/reference/ai-sdk-core/step-count-is)
6. [Chatbot（useChat）](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)
7. [Transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport)
8. [DirectChatTransport 参考](https://ai-sdk.dev/docs/reference/ai-sdk-ui/direct-chat-transport)
9. [Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
10. [generateObject 参考（deprecated 提示）](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object)
11. [Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
12. [OpenAI Responses API 指南](https://sdk.vercel.ai/docs/guides/openai-responses)
13. [@ai-sdk/openai (npm)](https://www.npmjs.com/package/@ai-sdk/openai)
14. [Migrate AI SDK 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
15. ssp-web 真实源码：`src/lib/ai/agent.ts`、`src/lib/ai/tools.ts`、`src/lib/ai/config.ts`、`src/app/api/chat/route.ts`、`src/components/chat/ChatPanel.tsx`（详见 `course/code-facts.md`）

> 内容已为遵守内容许可做转述处理，未逐段复制官方文档原文；代码示例为最小化改写或直接引用 `ssp-web` 真实源码。
