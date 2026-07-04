<div align="center">

# 手把手带你造一个真能算社保的 AI Agent

<img src="course/images/cover-hero.png" alt="课程封面：从概念到生产的 AI Agent 体系课" width="100%">

**从概念到生产 · 30 节体系课 · 配套真实可部署项目**

[进入课程](./course/README.md) · [查看项目源码](https://github.com/jiji262/ssp-web/)

</div>

---

## 课程定位

2025 年延迟退休政策落地，几亿人都在问同一个问题——**我到底什么时候能退休？**

但你去问任何一个大模型（LLM），它大概率会“一本正经地胡说八道”：退休年龄取决于性别、出生年月、岗位类型，叠加延迟退休渐进调整表，养老最低缴费年限还在从 15 年逐步提到 20 年……每个变量都可能让 LLM 翻车。

这门课要做的事情很简单：**教你造一个不会算错数的 AI Agent。**

不是玩具 demo，不是 “Hello World” 级别的教学项目，而是一个真正跑在生产环境、服务真实用户的社保规划助手——SSP（Shanghai Social Security Planner）。

> **核心思路**：用户跟 AI 聊天 → AI 调工具去算 → 规则引擎出结果 → AI 翻译成人话。四步闭环，数字零幻觉。

---

## 你会学到什么

- **Agent 工程闭环**：Prompt、Tool、Memory、Eval、Observability 一条线讲透。
- **真实业务建模**：把延迟退休、缴费年限、社保规则拆成可维护的规则引擎。
- **可部署项目实践**：每节配套真实代码，能 checkout、能运行、能继续改造。
- **面试与生产视角**：每节都有思考题、面试题与延伸阅读，不只会写 demo。

---

## 配套实战项目

**源码链接**：[jiji262/ssp-web](https://github.com/jiji262/ssp-web/)

每节末尾对应一个 git tag（`chapter-NN`），你可以 `git checkout chapter-04` 看到当节学完的完整代码状态。每段代码都引用 `ssp-web` 的真实文件，能跑能改。

---

## 技术栈一览

| 干什么的 | 用什么 | 为什么选它 |
|---|---|---|
| 全栈框架 | **Next.js 16** | App Router + Cache Components + Turbopack |
| 前端 | **React 19** | `useChat` + assistant-ui 双栈 |
| AI 接入 | **Vercel AI SDK v6** | `streamText` + `tool()` 标准化调用 |
| 大模型 | **gpt-4o-mini**（默认） | 性价比之王，加餐 3 讲模型迁移到 Claude / GPT-5 |
| 数据库 | **Neon Postgres + pgvector** | Serverless Postgres + 向量检索 |
| ORM | **Drizzle 0.45+** | 类型安全 + SQL 可控 |
| 认证 | **NextAuth v5** | 匿名会话 + 邮箱登录 |
| 规则引擎 | **JSONLogic** | 24 条政策规则，改 JSON 不改代码 |
| 工具协议 | **MCP 1.0+** | 标准化工具接口，可跨 Agent 共享 |
| UI 库 | **Tailwind v4** + 自研组件 | 统一设计语言 |

---

## 课程结构概览

```text
开篇词 → 序章
├── 入门篇 · 搞清楚 Agent 是什么（4 节）
├── 基建篇 · 把项目跑起来（4 节）
├── 核心篇 · 给 Agent 装大脑和手脚（7 节）
├── 工程篇 · 从能跑到能用（6 节）
├── 进阶篇 · 区分 demo 和生产（5 节）
└── 演进篇 · 走向生产（2 节）
结束语
+ 加餐 3 篇（管理后台 / 生产事故复盘 / 模型迁移）
+ FAQ
```

每节遵循统一的体系课结构：真实场景开场 → 知识铺垫 → 核心讲解 → 举一反三 → 小结 → 思考题 → 面试题 → 延伸阅读。主线节内嵌可检索的面试题与参考解答，适合一边学一边为 AI Agent 岗位面试备战。

<div align="center">

**[查看完整目录](./course/README.md)**

</div>

---

## 项目源码结构

```text
ssp-web/
├── src/lib/ai/          # Agent 核心逻辑（Prompt / Tool / Agent 装配）
├── src/lib/engine/      # 规则引擎（决策表 + JSONLogic）
├── src/lib/db/          # 数据持久化（Drizzle + Neon Postgres）
├── src/components/chat/ # 前端对话界面（useChat + assistant-ui）
├── src/lib/security/    # 安全护栏（匿名会话 + 限流）
├── src/lib/auth.ts      # 认证（NextAuth v5）
├── src/app/api/chat/    # API 路由入口（SSE 对话流）
├── src/app/admin/       # 管理后台（规则 / 参数 / 发布流水线）
└── dsl/ssp_dsl_v1/      # 规则 DSL（24 条政策规则）
```

---

## 交流与支持

| 交流群 | 随意打赏 |
|:---:|:---:|
| 扫码加入交流群，讨论课程实践、Agent 工程与项目部署。 | 如果课程对你有帮助，欢迎随意打赏支持继续更新。 |
| <img src="docs/qun.jpg" alt="交流群二维码" width="180"> | <img src="docs/dashang.jpg" alt="随意打赏二维码" width="180"> |

---

## 友情链接

- [Linux DO](https://linux.do/)

---

<div align="center">

准备好了？我们从一个让几亿人头疼的问题开始。

**[立即进入课程](./course/README.md)**

</div>
