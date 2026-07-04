# 第 07 节 · 数据库与 ORM：Drizzle + Neon Postgres 实战

![本节封面](images/07-hero.png)

<!-- 图片说明（给图片代理）：
风格：手绘风、温暖封面
内容：画面分两半。左半画一只金鱼在小鱼缸里游，旁边手写"AI 没有记忆 = 金鱼脑";右半画一台笔记本接到一个圆滚滚的 Neon 云朵图标(标 Postgres),云朵里塞着一沓贴满标签的小卡片(rules / params / conversations / plans),笔记本屏幕上显示 Drizzle 的 schema 代码。中间一支手写画的箭头从金鱼指向云朵,旁边写"装上长期记忆"。下方手写一行字:"对话能续,数字能查,规则能改 — 数据库是 Agent 真正的脊柱。"
中文标注,字体亲切
-->

> **预计时长**：阅读 25 分钟 / 实战 60 分钟
> **前置知识**：[第 06 节《20 行代码起 Agent》](./07-minimal-agent.md)、对 SQL 与基本 schema 设计有概念
> **本节代码**：`ssp-web` 仓库 `chapter-07` tag · 主要文件 `src/lib/db/schema.ts`、`src/lib/db/index.ts`、`src/lib/db/queries.ts`、`src/lib/db/seed/`

那天我跟我妈再次打开 SSP，让她接着昨天没聊完的话题。她对着屏幕问："**那些政策计算我昨天问过的，今天还要再来一遍吗？**"

我说不用，刷新页面就在。她说："那你这个 AI 比我那个银行 App 还聪明，那 App 每次进去都要我重新输身份证。"

她那个比方让我笑出声——但这不是夸 AI 聪明，**这是数据库在替 AI 撑着记忆**。

LLM 本身没有任何长期记忆。它每次接到请求，就像一个失忆症患者第一次见你。你昨天告诉它"我是 73 年女工"，今天它根本不知道。要让它"记住"，**必须把对话历史和用户档案塞进数据库，下次请求时再喂回去**。

这一节就讲一件事：**SSP 是怎么用 Drizzle + Neon Postgres 把 Agent 的"长期记忆"撑起来的**。11 张表、4 阶段 seed、一份 538 行的 queries 模块——这些不是教学示范，是 SSP 生产环境每天跑的真实代码。

---

## 一、知识铺垫：为什么是 Drizzle + Neon

数据库选型已经在[第 05 节《2026 年 AI 全栈技术栈选型逻辑》](./06-tech-stack-2026.md)讲过结论。这里把"为什么是这个组合"再具体化一层，让你拿这套方案到别的项目时知道哪些点是关键。

![Drizzle + Neon 组合优势](images/07-stack-advantages.png)

<!-- 图片说明（给图片代理）：
风格：手绘风信息图
内容：左右两个圆圈对碰
  左边圆圈(粉色)写 "Drizzle":
    - schema 即 TS 类型
    - SQL 可控
    - drizzle-kit push / generate
    - Edge runtime 兼容
  右边圆圈(蓝色)写 "Neon Postgres":
    - HTTP 模式 / 无连接池
    - JSONB 一等公民
    - 分支数据库 5 秒克隆
    - Serverless 计费友好
  中间交集写"AI Agent 黄金组合"
底部一行小字:"两个轮子转得齐 - 类型安全 + 冷启动友好"
-->

### Drizzle：类型安全的 TS 原生 ORM

写过 Prisma 的人第一次看 Drizzle 都会愣几秒——**它没有专门的 schema 文件**，schema 直接是 TypeScript 代码。

```ts
// 大概就长这样
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

这一段写完，整个项目里所有 `db.select().from(users)` 都自动有类型推断。`users.email` 是 string，`users.createdAt` 是 Date——IDE 直接补全，写错字段名编译期红线。

**和 Prisma 的核心区别**：

- **没有代码生成步骤**——Prisma 改 schema 要 `prisma generate`，Drizzle 不用
- **没有黑魔法 query builder**——Drizzle 的 `where(eq(...))` 直接对应 SQL `WHERE`
- **更快的编译**——大型项目上 Prisma 类型推断要 5-10 秒，Drizzle 几乎瞬间

代价是 Drizzle 的 ecosystem 比 Prisma 小，部分高级特性（比如复杂的 raw SQL 跟 ORM 字段映射）要自己拼。但对 SSP 这种 schema 不算特别花哨的项目，**Drizzle 是更纯粹、更快、更可控的选择**。

### Neon Postgres：Serverless 时代的 Postgres

Neon 是把 Postgres 重新做成 Serverless 的产品。**核心创新点是把存储和计算分离**——存储在 S3 兼容层，计算节点按需起。这意味着：

- **冷启动快**：从零启动一个新 Postgres 实例只要几百毫秒
- **按用计费**：不查就不计费，开发分支闲置时几乎免费
- **分支秒级**：一键 fork 整个数据库，dev/preview/prod 各一份
- **HTTP driver**：`@neondatabase/serverless` 包提供基于 HTTP 的查询接口，**Vercel Functions 完美适配**——每次请求独立查询，无连接池烦恼

> **划重点**：Neon 的"分支"是杀手锏。SSP 的开发流程是：每个 PR 自动 fork 一份 production 数据库的 schema 和数据到 preview 分支，跑测试通过后才合 main。这意味着**新人改规则 schema 不会污染生产数据**——而这个能力别的 Postgres 服务要自己搭 docker compose 才能凑出来。

---

## 二、核心讲解

### 2.1 SSP 的 11 张表：每一张干什么

![SSP 11 张表分层视图](images/07-tables-overview.png)

<!-- 图片说明（给图片代理）：
风格：信息图（infographic），扁平专业风
内容：纵向三层分组的表格视图
顶层（橙色）"政策与规则定义层"：rules / params / rule_sets / policy_pack_versions / workflows / publishes（每个标"极低写入 / 高读取"）
中层（绿色）"运行结果层"：plans（标"每次 chat 写一次"）
底层（粉色）"用户交互层"：conversations（标"高频写入 / 高读取"）+ showcase_cases（标"低频"）
左侧附加层（蓝色）：cases / tests（标"admin 管理"）
右侧标注 "11 张表 · 三档读写频率"
中文标注，字号清晰
-->

直接拉出 SSP 真实的 schema 表（出处：`code-facts.md` §6.1）：

| 表 | 主键 | 干什么 | 写入频率 |
|---|---|---|---|
| `rules` | serial id | 24 条政策规则的 DSL JSON | 极低（admin 改） |
| `params` | serial id | 政策参数（基数、费率等） | 极低（admin 改） |
| `policy_pack_versions` | serial id | 政策包的版本快照 | 低（每次发布） |
| `rule_sets` | serial id | 规则集定义（执行顺序） | 极低 |
| `workflows` | serial id | 发布流水线配置 | 极低 |
| `publishes` | serial id | 发布历史（diff、actor） | 低 |
| `plans` | uuid id | 每次方案计算的输入 / 输出 / 证据链 | 中（每次 chat 调用） |
| `conversations` | uuid id | 对话消息流 + userProfile（JSONB） | **高**（每条消息后写） |
| `showcase_cases` | serial id | 首页展示案例 | 极低 |
| `cases` | serial id | 原始访谈案例库（admin） | 低 |
| `tests` | serial id | 单元测试集合 | 低 |

按读写频率分三档：

- **极低写入 / 高读取**：`rules / params / rule_sets`——发布后基本不动，每次 chat 都要读；适合**长缓存**。
- **中频写入 / 中读取**：`plans`——每次 computePlan 调用写一次，回查时读；JSONB 字段多。
- **高频写入 / 高读取**：`conversations`——每条消息后写一次完整 messages 数组；下次进来要读全量。

> **小提醒**：`conversations.messages` 字段是 JSONB 数组，每次响应结束后**整段覆盖写**——不是 append。这是 v6 `toUIMessageStreamResponse` 的 `onFinish` 拿到的就是完整 messages，懒得做 diff。代价是单条消息只要 5KB，整个 conversation 30 轮就 150KB。够用，但**单 conversation 别超过 100 轮**。

---

### 2.2 一张表的完整生命周期：从 schema 到查询

挑 `conversations` 这张表完整走一遍——从 schema 定义到 migration 到写入到查询。

**Step 1：schema 定义**

```ts
// src/lib/db/schema.ts:133-140
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  messages: jsonb('messages').notNull().default([]),
  userProfile: jsonb('user_profile'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

> **看这里 →**：`uuid().defaultRandom()` 让 Postgres 自己生成 UUID，应用层不用 import `uuid` 包；`jsonb('messages').default([])` 默认空数组，新建会话时 messages 字段不会是 null；`session_id` 用 text 不用 uuid，因为 SSP 的匿名 sessionId 是 `crypto.randomUUID()` 生成的字符串（详见[第 08 节《认证与多用户》](./09-auth-and-session.md)）。

**Step 2：drizzle-kit push**

```bash
# 第一次 schema 推到数据库
pnpm drizzle-kit push
```

`drizzle.config.ts` 长这样（来自 ssp-web）：

```ts
// drizzle.config.ts (12 行)
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

> **小提醒**：`drizzle-kit push` 只适合开发期。生产环境推荐 `drizzle-kit generate`——它会生成可审查的 SQL migration 文件，让 DBA 在 PR review 时看到这次变更具体跑什么 DDL。SSP 现在是教学项目，README 里直接 push（出处：`code-facts.md` §6.5），但要上生产**强烈建议切换到 generate + migrate 模式**。

**Step 3：写入**

`createConversation` 函数（位于 `src/lib/db/queries.ts:443-452`，节选）：

```ts
// src/lib/db/queries.ts:443-452（节选）
export async function createConversation(params: {
  sessionId: string;
  messages?: unknown[];
  userProfile?: unknown;
}) {
  const [row] = await db
    .insert(conversations)
    .values({
      sessionId: params.sessionId,
      messages: params.messages ?? [],
      userProfile: params.userProfile,
    })
    .returning();
  return row;
}
```

> **看这里 →**：`.returning()` 让 Drizzle 把刚插入的整行数据返回——不用再发一次 SELECT 查 id。Postgres 原生支持 `INSERT ... RETURNING *`，但很多 ORM（包括 Prisma 早期）不暴露这个能力。Drizzle 一行搞定。

**Step 4：查询**

`getConversation` 同样在 queries.ts：

```ts
// src/lib/db/queries.ts (节选)
export async function getConversation(id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return row ?? null;
}
```

读一眼就跟 SQL 一样——`SELECT * FROM conversations WHERE id = $1 LIMIT 1`。如果你想看真实跑出去的 SQL，调用 `.toSQL()`：

```ts
const q = db.select().from(conversations).where(eq(conversations.id, id));
console.log(q.toSQL()); // { sql: 'select ... where ... = $1', params: [id] }
```

**Step 5：onFinish 持久化整段 messages**

回到 chat route（`code-facts.md` §3.2 引用）：

```ts
// src/app/api/chat/route.ts:234-261（结构示意）
const result = createChatStream(messages, context);

const response = result.toUIMessageStreamResponse({
  originalMessages: uiMessages,
  onFinish: async ({ messages: persistedMessages }) => {
    try {
      await updateConversation(conversation.id, {
        messages: persistedMessages as unknown[],
        userProfile,
      });
    } catch (err) {
      logger.warn('chat.persist_finish_failed', { /* ... */ });
    }
  },
});
```

> **划重点**：`onFinish` 拿到的 `messages` 是 v6 帮你拼好的"原始历史 + 本轮新消息"的完整数组。所以 SSP 的 `updateConversation` 是**整段覆盖**——下次再读出来直接喂回 streamText，无缝续上。这是 v6 给的便利，没必要自己做 diff append。

---

### 2.3 ssp-web 的 db/queries 模块：把 ORM 包成业务接口

如果你直接在 chat route 里写 `db.select().from(conversations)`，整个项目散满了 SQL 细节，难维护。SSP 的做法是把所有 DB 调用收口到 `src/lib/db/queries.ts`（538 行，30+ 个函数），按业务语义命名。

挑几个有代表性的（出处：`code-facts.md` §6.3）：

| 函数 | 用途 | 关键特征 |
|---|---|---|
| `getEffectiveRules(ruleSetId, asOfDate)` | 取某日生效的规则集 + 当日生效的所有规则 | 联表 + 时间窗口过滤 |
| `getEffectiveParams(policyPackId, asOfDate)` | 取生效参数（按 effective_from 去重） | 同上 |
| `savePlan(input)` / `getPlan(id)` | 方案持久化 / 回查 | UUID 主键 |
| `createConversation` / `getConversation` / `updateConversation` | 会话 CRUD | 含 sessionId 校验 |
| `listConversations(sessionId)` | 列出当前 session 的会话 | 用于左侧会话列表 |
| `countRules / countParams / countTests` | Dashboard 统计 | 简单 count |

把 raw SQL 包成业务函数有三个好处：

1. **业务语义对齐**——chat route 调用 `getEffectiveRules('RS-SHANGHAI-PLAN-V1', '2026-04-25')`，比直接写 join 清楚得多
2. **类型推断爽**——返回类型自动从 schema 推出来，不用手写 interface
3. **改起来集中**——某天要给 conversations 加缓存，改 queries.ts 一处即可

> **小提醒**：queries.ts 不是越大越好。SSP 现在 538 行已经偏多，**单文件超过 800 行就该拆分**——按表拆（`queries/rules.ts` / `queries/conversations.ts`）。SSP 之所以塞一个文件，是因为函数之间互相 import 关系简单，拆开反而麻烦。看你的项目规模再定。

---

### 2.4 seed 数据：4 阶段把空数据库装满

![4 阶段 seed 流程](images/07-seed-pipeline.png)

<!-- 图片说明（给图片代理）：
风格：手绘风信息图
内容：横向流水线 4 个步骤
阶段 1（绿色方块）：rules — 24 条 JSON → DB
阶段 2（橙色方块）：params — 26 scalar + 3 table
阶段 3（粉色方块）：misc — rule_set + workflow + tests
阶段 4（蓝色方块·虚线框）：cases & regression tests（可选,SEED_CASES=true 才跑）
箭头串联，每个阶段下方手写"upsert · idempotent"
中文标注
-->


新 clone 仓库的人第一件事是 `pnpm seed`。这个命令背后是 4 阶段的 seed 流程（`src/lib/db/seed/index.ts`，46 行，引自 `code-facts.md` §6.4）：

```ts
// src/lib/db/seed/index.ts (结构示意,基于 code-facts.md §6.4)
import { seedRules } from './seed-rules';
import { seedParams } from './seed-params';
import { seedMisc } from './seed-misc';
import { importCases, importRegressionTests } from './import-from-excel';

async function main() {
  console.log('[seed 1/4] 装规则...');
  await seedRules();         // 扫 dsl/ssp_dsl_v1/rules/*.json,逐条 upsert 到 rules 表

  console.log('[seed 2/4] 装参数...');
  await seedParams();        // 读 policy_params_shanghai_base.json,scalar + table 两类 upsert

  console.log('[seed 3/4] 装其他...');
  await seedMisc();          // rule_set + workflow + tests 各一份

  console.log('[seed 4/4] 导入案例(可选)...');
  if (process.env.SEED_CASES === 'true') {
    await importCases();             // 从 Excel 文件抽案例到 cases 表
    await importRegressionTests();   // 从 Excel 抽测试到 tests 表
  }

  console.log('✓ 全部完成');
}
```

**4 阶段对应 4 个职责**：

- **阶段 1**：规则 JSON → DB（`seed-rules.ts:80 行`）。扫 `dsl/ssp_dsl_v1/rules/` 下 24 个 JSON 文件，逐个 upsert 到 `rules` 表，version=1。
- **阶段 2**：参数 JSON → DB（`seed-params.ts:143 行`）。读 `policy_params_shanghai_base.json`（**code-facts §10.3** 列了真实政策数字：基数 7460、费率 16% 等），分别 upsert scalar params 和 table params。
- **阶段 3**：其他元数据（`seed-misc.ts:153 行`）。rule_set / workflow / tests 各一份。
- **阶段 4**：可选的 Excel 导入。访谈案例和回归测试用例平时不变，没必要每次 seed 都跑。

> **划重点**：seed 必须是 **idempotent（幂等）** 的——跑 N 次效果跟跑 1 次一样。SSP 用 `INSERT ... ON CONFLICT DO UPDATE` 实现，所以即使 DB 里已经有 rules，再跑 seed 也只是 update。新人不小心多跑一次不会出事。

**跑一次看看**（动手时回到这一步）：

```bash
git clone https://github.com/jiji262/ssp-web.git
cd ssp-web
cp .env.example .env.local  # 填 DATABASE_URL 和 OPENAI_API_KEY
pnpm install
pnpm drizzle-kit push       # 第一次推 schema 到 DB
pnpm seed                   # 4 阶段 seed
```

终端输出大致：

```
[seed 1/4] 装规则...
  ✓ R-010-PARSE-BIRTH-YEAR
  ✓ R-011-BUILD-BIRTH-DATE
  ... (24 条全列)
[seed 2/4] 装参数...
  ✓ scalar params: 26 条
  ✓ table params: 3 张
[seed 3/4] 装其他...
  ✓ rule_set: RS-SHANGHAI-PLAN-V1
  ✓ workflow: WF-DEFAULT
  ✓ tests: 12 个
[seed 4/4] 导入案例(可选)... 跳过
✓ 全部完成
```

5 秒之内跑完，然后 `pnpm dev` 就能起 SSP。

---

### 2.5 Neon serverless driver 在 Edge / Node runtime 的特性

数据库 client 这一层有一个 SSP 写得很巧的设计——`src/lib/db/index.ts` 用 Proxy 实现懒加载（出处：`code-facts.md` §6.2）：

```ts
// src/lib/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db: NeonHttpDatabase<typeof schema> | null = null;

function getInstance() {
  if (!_db) _db = drizzle(neon(process.env.DATABASE_URL!), { schema });
  return _db;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, prop) {
    const v = getInstance()[prop as keyof typeof _db];
    return typeof v === 'function' ? v.bind(getInstance()) : v;
  },
});
```

> **看这里 →**：`getInstance()` 第一次被调用时才 `drizzle(neon(...))`。这意味着如果某个请求根本不查 DB（比如静态页面、纯 LLM 调用），它**完全不会建数据库连接**。冷启动节省一两百毫秒。

**`@neondatabase/serverless` 的两种 driver**（出处：研究素材 §10.3）：

| Driver | 协议 | 用途 | 事务 |
|---|---|---|---|
| `neon-http` | HTTP | **serverless / Edge 首选**。单查询快，无连接池开销 | ❌ 不支持事务交互 |
| `neon-serverless` | WebSocket | 支持事务、prepared statement，drop-in 替换 `pg` | ✅ |

SSP 用的是 `neon-http`——99% 的查询都是单条，不需要事务。**那 1% 需要事务的场景怎么办？**比如 admin 发布新规则集时要更新 `rules` + `policy_pack_versions` + `publishes` 三张表，必须同时成功或同时失败。

SSP 的取舍是：**那部分逻辑在 admin route 里串行执行 + 失败补偿**，没用真事务。这不是最严谨，但够用——admin 写入频率极低，万一中间断了重跑一次就行。

> **小提醒**：`vercel.json` 里 SSP 部署区域是 `iad1`（美东弗吉尼亚，**code-facts §11.3**）。Neon 默认也是 us-east 区。**部署区域跟数据库区域要对齐**——你跑在亚洲区调美东 Neon，每次查询都加 200ms 延迟。AI Agent 路径上每加 200ms 都是用户感知得到的。

---

### 2.6 性能与索引

SSP 的 schema 在主键之外**几乎没显式索引**——这不是疏忽，是因为：

1. 大部分查询都按主键（`id`）或唯一字段（`rule_id` 上有 unique 约束自带索引）
2. `conversations` 按 `sessionId` 列出，但 SSP 单 sessionId 最多就几十条 conversation，全表扫也快
3. 查询规则按 `(status, effective_from)` 过滤，量级 24 条全表扫无所谓

但**生产规模上去后**，几个地方迟早要加索引：

```sql
-- 必加：列出某 session 的会话（按更新时间倒序）
CREATE INDEX idx_conversations_session_updated
  ON conversations (session_id, updated_at DESC);

-- 应该加：按 rule_id 查规则版本历史
CREATE INDEX idx_rules_rule_id_version
  ON rules (rule_id, version DESC);

-- 可选：按 plan 的创建时间统计
CREATE INDEX idx_plans_created_at
  ON plans (created_at DESC);
```

> **划重点**：不要预先加一堆索引——**先量、后加**。Postgres 自带 `EXPLAIN ANALYZE` 和 `pg_stat_statements`，看哪些查询慢再针对性加。Neon 也支持 [Neon Console](https://console.neon.tech/) 里直接看慢查询。

JSONB 字段什么时候要加 GIN 索引？

```sql
-- 当你需要按 messages 里的某字段查询时
CREATE INDEX idx_conversations_messages_gin
  ON conversations USING GIN (messages);
```

SSP 现在不需要——`messages` 字段只是被整段读出，**从来不在 SQL 里检索它的内部字段**。如果未来要做"找出所有用户问过'退休'关键字的对话"这种全文检索，就必须加 GIN 索引；否则全表扫几万行 JSON，性能崩盘。

---

### 2.7 三个常见踩坑

**坑 1：在 Edge runtime 里 import bcrypt**

SSP 的 `next.config.ts:1-10` 里有：

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'xlsx'],
};
```

这是因为 `bcryptjs` 是 Node.js native 模块，打包到 Edge runtime 直接报错。`serverExternalPackages` 告诉 Next.js"这些包不要打包，运行时再 require"。**Drizzle 本身没问题**，但配套的 driver 选错可能在 Edge runtime 失败——`neon-http` 走 fetch，Edge 兼容；`neon-serverless` 走 WebSocket，要看 runtime 支持。

**坑 2：drizzle-kit push 直接覆盖生产**

```bash
# ❌ 危险：在生产环境直连 DB 跑这个
DATABASE_URL=postgres://prod-host pnpm drizzle-kit push
```

`push` 会**直接 ALTER 生产表**——如果你 schema.ts 改了字段类型，生产数据可能丢。**生产环境永远用 `generate` + `migrate`**：

```bash
# ✅ 安全：生成 SQL 文件,review 后再跑
pnpm drizzle-kit generate    # 生成 drizzle/0001_xxx.sql
# 在 PR 里 review SQL 内容
pnpm drizzle-kit migrate     # 在部署 hook 里跑这个
```

**坑 3：JSONB 字段写入时类型不匹配**

```ts
// ❌ 编译期不报错,运行时跪
await db.insert(conversations).values({
  sessionId: 's1',
  messages: '[]', // 字符串而不是数组
});
```

Drizzle 的 jsonb 字段接受**任何 JSON-serializable 值**，所以 TS 不会拦你传字符串。但 Postgres 收到一个字符串，要么把字符串当成 JSON 字符串存（`'"[]"'`），要么报错——具体行为看 driver 版本。永远传**真正的数组/对象**，让 driver 帮你 stringify。

---

### 2.8 数据库分支：Neon 的杀手锏怎么用

最后讲一下 Neon 的"分支数据库"——这是 SSP 开发流程里最爽的一环。

**典型工作流**：

1. 我在本地分支 `feat/add-rule-r600` 上改了 `seed-rules.ts`，新增了一条规则
2. push 到 GitHub，GitHub Actions 跑 `pnpm tsx scripts/branch-db.ts` 在 Neon 上 fork 一份生产分支
3. 在新分支上跑 `drizzle-kit push + pnpm seed + pnpm test`，看新规则是否兼容
4. 通过则合并；不通过则改代码，分支 DB 自动销毁

这套流程的核心命令是 Neon CLI 的 `neon branches create`：

```bash
neon branches create \
  --project-id <project-id> \
  --name preview-pr-123 \
  --parent main
# 输出新分支的 connection string
```

得到的新 connection string 写到 `DATABASE_URL` 环境变量，剩下的 Drizzle 代码不用改一行——同样的 schema、同样的 queries、同样的 seed 命令，只是数据库实例换了一个。

> **划重点**：分支不是"另一份数据库"，**是 git 风格的 copy-on-write**。新分支共享 parent 的存储，只在你写入时才产生差异。所以 fork 一个 100GB 的生产 DB 几乎瞬间完成、几乎不占空间——Neon 内部用类似 ZFS / btrfs 的 snapshot 机制实现。

这种能力在传统 Postgres 里要自己搭 docker compose + pg_dump + restore，新人两天搞不通。Neon 让"数据库分支"变成跟 git 分支一样自然的操作。

---

## 三、举一反三

把 SSP 这套数据库方案搬到别的领域，**90% 的代码不需要改**。变化的是 schema 设计和 seed 数据。

**法律咨询 Agent**：

- 替换 `rules` 表 → `law_articles`（法条）+ `cases`（判例）
- 替换 `params` → `legal_constants`（如最低工资标准随地区年份变化）
- `conversations` 表完全复用
- 新增 `pgvector` 扩展 + `law_articles_embeddings` 向量表（详见[第 26 节《RAG 增强与混合检索》](./27-rag-augmentation.md)）

**报税 Agent**：

- 替换 `rules` → `tax_rules`（税收规则）
- 新增 `tax_returns`（用户报税历史）+ `transactions`（涉税交易流水）
- 时序索引：`transactions` 要按 `(user_id, transaction_date)` 加复合索引
- 用 BRIN 索引代替 B-tree，节省存储

**健身规划助手**：

- 替换 `rules` → `workout_templates`（训练模板）
- 新增 `workout_logs`（用户训练记录）+ `body_metrics`（身体指标历史）
- `userProfile` JSONB 扩展为 `{ height, weight, fitness_goals, restrictions[] }`
- 高频写入场景，要给 `workout_logs` 加分区表（按月分区）

**SQLite / MySQL 迁移**：

Drizzle 支持 PG / MySQL / SQLite 三种 dialect。**schema 定义文件本身要改**——`pgTable` 换成 `mysqlTable` 或 `sqliteTable`，类型函数从 `pg-core` 换到对应包。但 queries.ts 99% 的代码不变，因为 Drizzle 的 query builder 是 dialect-agnostic 的。

> **小结论**：选数据库优先看**业务读写模式**，不是看流行度。Postgres 是默认值（关系型 + JSONB + 强一致性），Neon 让它 Serverless-friendly。SQLite 适合本地工具或离线 First 应用，MySQL 适合已有团队经验的高并发 OLTP。

---

## 动手：clone ssp-web 跑 4 阶段 seed

这个动手环节单独拎出来，因为它是验证你"基建篇能跑通"的关键里程碑。

```bash
# 1. clone 仓库
git clone https://github.com/jiji262/ssp-web.git
cd ssp-web

# 2. 准备 Neon 数据库
# 去 https://console.neon.tech/ 创建一个 project
# 拿到 connection string,例如:
# postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# 3. 配环境变量
cp .env.example .env.local
# 编辑 .env.local 填:
#   DATABASE_URL=postgresql://...
#   OPENAI_API_KEY=sk-...

# 4. 装依赖
pnpm install

# 5. 推 schema
pnpm drizzle-kit push
# 输出: ✓ Pushed schema to database

# 6. 跑 4 阶段 seed
pnpm seed
# 输出: 见 §2.4 的终端示例

# 7. 起 dev
pnpm dev
# 浏览器打开 localhost:3000
```

**验证 checklist**：

- [ ] `pnpm drizzle-kit studio` 能打开 GUI，看到 11 张表
- [ ] `rules` 表里有 24 条规则（按 rule_id 排序，从 R-010 到 R-900）
- [ ] `params` 表里有 26 条 scalar + 3 张 table
- [ ] `rule_sets` 表里有一条 `RS-SHANGHAI-PLAN-V1`
- [ ] 浏览器输入"73 年女工"，AI 调用 computePlan 后返回结果
- [ ] `conversations` 表里有一条新记录，`messages` 字段是 JSONB 数组

**如果某一步卡住**，最常见的问题：

- DATABASE_URL 没加 `?sslmode=require` → Neon 强制 SSL，连不上
- DSL JSON 文件夹缺失 → 没把 dsl/ 目录 clone 下来（git LFS 或 .gitignore 误配）
- bcryptjs 报错 → 没在 next.config.ts 配 `serverExternalPackages`

---

## 四、小结

![本节小结](images/07-summary.png)

<!-- 图片说明（给图片代理）：
风格：手绘风、小结卡片
内容：标题"数据库与 ORM · 一页纸记忆"
六个手绘小方块:
1. Drizzle: schema 即 TS 类型, db.select() 直接出推断
2. Neon: HTTP driver / 分支数据库 / Serverless 计费
3. SSP 11 张表: rules / params / rule_sets / plans / conversations / showcase_cases / cases / tests / publishes / workflows / policy_pack_versions
4. 4 阶段 seed: rules → params → misc → cases(可选)
5. 懒加载 Proxy: 按需建连接,冷启动友好
6. 生产用 generate + migrate, 别 push
中间一句金句:"AI 没有记忆 - 数据库就是它的脊柱"
中文标注、可爱风格
-->

数据库这一节看似在讲基础设施，但**它是 Agent 区分"demo"和"产品"的分水岭**。能跑的 demo 都不需要 DB，刷新页面重置一切就行。但要让用户跨设备、跨时间、跨刷新都能续上对话，要让 admin 改完规则即时生效，要让 plan 历史可以审计回查——**没有 DB，全是空话**。

SSP 选 Drizzle + Neon 不是图新潮，是图三件事：**类型安全、Serverless 友好、分支数据库**。这三件事换成 Prisma + AWS RDS 你也能做，但开发体验差一截、冷启动慢一截、新人门槛高一截。**够用 + 能跑 + 能维护 + 能换**这四原则贯穿始终。

**核心要点回顾**：

- ✅ Drizzle 的 schema 即 TypeScript，类型推断零延迟
- ✅ Neon Postgres + `neon-http` driver = Vercel Functions 完美适配
- ✅ SSP 11 张表分三档读写频率：极低（rules/params）、中（plans）、高（conversations）
- ✅ `db` 实例用 Proxy 懒加载，冷启动节省一两百毫秒
- ✅ 4 阶段 seed 必须幂等：rules → params → misc → cases（可选）
- ✅ 生产用 `drizzle-kit generate` + `migrate`，开发期才用 `push`
- ✅ 分支数据库是 Neon 的杀手锏——PR 自动 fork，dev/preview/prod 互不影响
- ✅ 索引"先量、后加"——别预先 over-engineer

下一节，我们把这套数据库底座往上加一层**用户隔离**——SSP 怎么用匿名 cookie + NextAuth v5 双轨设计同时撑住"妈妈也能用"和"管理员账号必锁"两种相反的需求。

---

## 思考题

1. **【开放题】**：SSP 的 `conversations.messages` 是 JSONB 整段覆盖写。这种设计**简单但有代价**：单 conversation 超过 100 轮后，每次写入都要传 200KB 数据。**你会怎么改造**——继续覆盖写但定期归档？切到 append 模式（每条 message 一行）？引入 Redis 做近期消息缓存？说清楚你的方案 + 它的取舍。

2. **【动手题】**：clone `ssp-web` 仓库，按"§动手：clone ssp-web 跑 4 阶段 seed"完整跑一遍。**输出**：(1) `pnpm drizzle-kit studio` 截图（看到 11 张表）；(2) `rules` 表的前 5 条 rule_id；(3) 一段你与 Agent 真实对话的 conversation 记录（在 DB 里查到的 jsonb 字段截图）。**验收**：3 张截图齐全，能看到 24 条规则全部 seed 成功。

3. **【选做】**：把 SSP 的 schema 从 PostgreSQL 迁移到 SQLite（用 `drizzle-orm/better-sqlite3`）。需要改：(1) `pgTable` → `sqliteTable`；(2) `jsonb` → `text` + 自己 JSON.stringify；(3) `uuid().defaultRandom()` → `text().$defaultFn(() => crypto.randomUUID())`。**验收**：`pnpm drizzle-kit push` 成功在本地 `dev.db` 创建 11 张表，跑一次 seed 后能在 [DB Browser for SQLite](https://sqlitebrowser.org/) 里看到 24 条规则。

---

## 面试题

**Q1.【基础】【主题：数据持久化与 ORM】** 为什么 LLM 应用一定要数据库？请用"AI 没有长期记忆"这个事实，说明 SSP 是怎么让用户"刷新页面还能续上昨天的对话"的。
<details><summary>参考解答</summary>

LLM 本身**无状态、无长期记忆**——每次请求都像第一次见你，上一轮你说的"我是 73 年女工"它根本不记得。要让它"记住"，必须把对话历史和用户档案存进数据库，下次请求时再喂回去。

SSP 的做法：

- `conversations` 表存整段消息流（`messages: jsonb`）和用户档案（`userProfile: jsonb`），按 `sessionId` 关联匿名用户。
- 每轮回复结束，`toUIMessageStreamResponse` 的 `onFinish` 拿到 v6 拼好的完整 messages，调 `updateConversation` **整段覆盖写**入库。
- 用户下次进来，按 `conversationId` 读出 messages，`convertToModelMessages` 后喂回 `streamText`，对话无缝续上。

一句话：数据库替无记忆的 LLM 撑着"长期记忆"，是 demo 和产品的分水岭——能跑的 demo 刷新就重置，产品必须跨刷新、跨设备续上。

</details>

**Q2.【进阶】【主题：数据持久化与 ORM】** SSP 把 `conversations.messages` 设计成 JSONB 整段覆盖写，而不是每条消息一行。请分析这个设计的优点、代价，以及你会在什么规模下改造它。
<details><summary>参考解答</summary>

**优点**：

- 实现极简——v6 的 `onFinish` 直接给你"历史 + 本轮"的完整数组，整段写入即可，**不用做 diff/append 逻辑**。
- 读取简单——一次查询拿到整段对话，直接喂回模型，无需 join 或聚合多行。
- Postgres 的 JSONB 支持索引和内部字段查询，未来要检索也不是死路。

**代价**：

- 写放大——单 conversation 30 轮约 150KB，每次新消息都要重写整段，轮次越多写入越重。
- 不适合超长会话——本节给的经验是"单 conversation 别超过 100 轮"。

**改造时机与方案**：当出现"超长会话 + 高频写入"时，可选：① 继续覆盖写但定期归档冷会话；② 切 append 模式（每条 message 一行，读时聚合）；③ 引入 Redis 缓存近期消息、DB 只存冷数据。选哪种取决于读写比和会话长度分布——不要为不存在的规模预付复杂度。

</details>

**Q3.【深挖】【主题：数据持久化与 ORM】** SSP 用 `neon-http` driver 而非 `neon-serverless`（WebSocket）。请说明两者差异、为什么 Serverless 环境优先 HTTP，以及当遇到"必须多表原子写"时 SSP 怎么取舍。
<details><summary>参考解答</summary>

**两者差异**：

- `neon-http`：走 HTTP，单查询快、无连接池开销，**Serverless / Edge 首选**，但**不支持交互式事务**。
- `neon-serverless`：走 WebSocket，支持事务和 prepared statement，是 `pg` 的 drop-in 替换，但建连接更重。

**为什么 Serverless 优先 HTTP**：Vercel Functions 每次冷启动都要建连接，TCP/WebSocket 连接池在 Serverless 下难管理、易耗尽；HTTP 每次请求独立、天然适配。SSP 99% 的查询是单条读写，不需要事务，所以 `neon-http` 足够；再配合 `db` 的 Proxy 懒加载，不查 DB 的请求完全不建连接。

**多表原子写的取舍**：SSP 的 admin 发布动作要同时改 `rules` + `policy_pack_versions` + `publishes` 三表。因为用了 `neon-http`（无交互事务），SSP 选择在 admin route 里**串行执行 + 失败补偿**，没用真事务。理由是 admin 写入频率极低，万一中间断了重跑一次即可——这是"够用就好"的工程取舍。若该路径变关键，可在那一处局部切到 `neon-serverless` 用真事务。

</details>

---

## 延伸阅读

- [Drizzle ORM 官方文档](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit 命令完整参考](https://orm.drizzle.team/kit-docs/overview)
- [Neon Postgres Serverless Driver](https://neon.tech/docs/serverless/serverless-driver)
- [Neon Branches 工作流](https://neon.tech/docs/guides/branching-intro)
- [Postgres JSONB 查询性能技巧](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)
- [Drizzle Adapter for NextAuth v5](https://authjs.dev/getting-started/adapters/drizzle)

---

[← 上一节：第 06 节 20 行代码起 Agent](./07-minimal-agent.md) · [📚 目录](./README.md) · [下一节：第 08 节 认证与多用户 →](./09-auth-and-session.md)
