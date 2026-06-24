# AI 生成引擎 — 技术设计文档

## 1. 设计概要

**功能描述**：实现 PluginGen 的核心能力——通过 DeepSeek API 根据用户自然语言描述生成完整的 Minecraft 插件 Maven 项目，支持六大服务端核心的项目骨架、增量修改和 AI 代码解释。

**影响范围**：后端新增 `ai-generator/` 模块；前端修改 `pages/dashboard/CreatePlugin.tsx`、`pages/dashboard/PluginEdit.tsx`（增加修改输入框 + AI 解释面板）。

**技术难点**：

- Prompt 工程：针对 6 种服务端核心分别设计模板，确保 AI 输出的代码结构、依赖、API 调用准确匹配
- AI 响应解析：从 Markdown 代码块中提取文件路径和内容，构建可写入磁盘的目录结构
- 增量修改的上下文传递：需要将当前项目所有文件的完整内容 + 修改描述一起发送给 AI

**外部依赖**：`openai` SDK（DeepSeek API 兼容 OpenAI 格式）

---

## 2. 架构概览

```
AI 生成流程:

POST /ai/generate  { name, mcVersion, coreType, javaVersion, packageName, description }
       │
       ▼
  AiGeneratorService
       │
       ├── 1. 根据 coreType + mcVersion 选择 Prompt 模板
       │       (bukkit.prompt.ts / spigot.prompt.ts / ...)
       │
       ├── 2. 填充模板变量 → 构造 SystemPrompt + UserPrompt
       │
       ├── 3. 调用 DeepSeek API (openai.chat.completions.create)
       │       model: "deepseek-v4-flash"
       │       temperature: 0.3 (平衡创意和约束)
       │       max_tokens: 8192
       │
       ├── 4. WebSocket 推送进度 (ai.progress 25%)
       │
       ├── 5. 解析 AI 响应 → 提取代码块 → 构建 filesManifest
       │
       ├── 6. 创建 PluginProject + PluginVersion (version=1)
       │
       ├── 7. 写入文件到磁盘 src/ 目录
       │
       ├── 8. WebSocket 推送完成 (ai.generated)
       │
       └── 9. 返回 pluginId


增量修改流程:

POST /ai/modify/:pluginId  { description: "添加 /reload 命令" }
       │
       ▼
  AiGeneratorService.modify()
       │
       ├── 1. 读取当前项目的 filesManifest (所有文件内容)
       │
       ├── 2. 构造 Modify Prompt: 当前代码 + 修改描述
       │
       ├── 3. 调用 DeepSeek API
       │
       ├── 4. 解析响应 → 替换对应的文件内容
       │
       ├── 5. 创建新 Version (version+1)
       │
       └── 6. 更新磁盘文件 + 返回新的 filesManifest


AI 解释流程:

POST /ai/explain/:pluginId/:filePath  { code: "..." }
       │
       ▼
  ExplainService.explain()
       │
       ├── 1. 构造 Explain Prompt: 代码内容
       │
       ├── 2. 调用 DeepSeek API
       │
       └── 3. 返回 Markdown 格式的解释文本
```

---

## 3. 数据库设计

> 本阶段使用 Phase 1.2 已定义的 `PluginProject` 和 `PluginVersion` 表。生成时创建新记录，不新增字段或表。

**写入操作**：

- `prisma.pluginProject.create(...)` — 创建新项目
- `prisma.pluginVersion.create(...)` — 创建 v1（生成）或 vN（增量修改后）
- `prisma.pluginProject.update({ status, currentVersion })` — 更新状态和版本号

---

## 4. API 设计

### 4.1 `POST /ai/generate` — AI 生成新插件 → AC-001 ~ AC-005

**鉴权**：`JwtAuthGuard` + 配额检查（Redis quota check）→ AC-107

**Request**：

```json
{
  "name": "DailyReward",
  "mcVersion": "1.20.1",
  "coreType": "PAPER",
  "javaVersion": "17",
  "packageName": "com.example.dailyreward",
  "description": "一个每日签到插件，玩家每天可以签到一次，获得随机奖励。"
}
```

**DTO 校验**：同 Phase 1.4 Plugin create DTO + `description`（`@IsString()` `@Length(10, 2000)`）

**Response（201 Created）**：

```json
{
  "code": 201,
  "data": {
    "pluginId": "uuid",
    "version": 1,
    "fileTree": [{ "name": "pom.xml", ... }],
    "message": "Plugin generated successfully"
  },
  "message": "success"
}
```

**异常响应**：

| 场景                  | 状态码 | message                                      | 对应 AC |
| --------------------- | ------ | -------------------------------------------- | ------- |
| 每日配额不足          | 429    | "Daily quota exceeded"                       | AC-107  |
| AI 响应格式错误       | 502    | "AI response parse failed, please try again" | AC-103  |
| AI 响应超时           | 504    | "AI generation timed out"                    | AC-104  |
| DeepSeek API 调用失败 | 502    | "AI service unavailable"                     | —       |

### 4.2 `POST /ai/modify/:pluginId` — 增量修改 → AC-006, AC-007, AC-105

**鉴权**：`JwtAuthGuard` + 所有权检查

**Request**：

```json
{
  "description": "给签到指令增加一个 /reward top 排行榜子命令"
}
```

**DTO 校验**：`description`（`@IsString()` `@Length(5, 1000)`）

**Response**：

```json
{
  "code": 200,
  "data": {
    "pluginId": "uuid",
    "newVersion": 2,
    "fileTree": [{ "name": "pom.xml", ... }],
    "changes": ["Modified: src/main/java/com/example/Command.java", "Added: src/main/java/com/example/RewardTopCommand.java"]
  },
  "message": "success"
}
```

### 4.3 `POST /ai/explain/:pluginId` — AI 解释代码 → AC-008

**鉴权**：`JwtAuthGuard` + 所有权检查

**Request**：

```json
{
  "filePath": "src/main/java/com/example/Main.java",
  "code": "public class Main extends JavaPlugin { ... }"
}
```

> `code` 字段由前端从 Monaco Editor 中读取，可以是整个文件内容或选中的代码段。

**Response**：

````json
{
  "code": 200,
  "data": {
    "filePath": "src/main/java/com/example/Main.java",
    "explanation": "## Main.java\n\n这个文件是插件的**主类**，继承自 `JavaPlugin`...\n\n### onEnable 方法\n在插件加载时调用，作用包括：\n1. 注册 `/reward` 命令...\n2. 注册签到事件监听器...\n3. 加载 config.yml 配置...\n\n### 关键代码片段\n```java\npublic void onEnable() {\n    getCommand(\"reward\").setExecutor(new RewardCommand(this));\n}\n```\n这段代码通过 `setExecutor` 将 `/reward` 命令绑定到 `RewardCommand` 处理类。",
    "language": "zh-CN"
  },
  "message": "success"
}
````

### 4.4 WebSocket 事件定义

**事件名**：

| 事件               | 方向            | Payload                                                 | 说明                  |
| ------------------ | --------------- | ------------------------------------------------------- | --------------------- |
| `ai.progress`      | Server → Client | `{ pluginId, percent: 25, stage: "正在生成项目结构…" }` | 进度推送              |
| `ai.generated`     | Server → Client | `{ pluginId, success: true }`                           | 生成完成              |
| `ai.error`         | Server → Client | `{ pluginId, error: "..." }`                            | 生成失败              |
| `compile.progress` | Server → Client | `{ pluginId, percent, stage }`                          | 编译进度（Phase 1.6） |

**前端连接**：用户在进入 `CreatePlugin.tsx` 时建立 WebSocket 连接（通过 `useWebSocket` hook），传入 `pluginId` 订阅对应事件。

---

## 5. 核心逻辑

### 5.1 Prompt 模板设计

每个 Prompt 模板由两部分组成：**System Prompt**（固定指令）和 **User Prompt**（由用户输入填充）。

**System Prompt（通用结构）**：

```
你是一个 Minecraft 插件开发专家。根据用户的需求生成一个完整的、可编译的 Maven 项目。

生成要求：
1. 每个文件的完整代码必须放在 Markdown 代码块中
2. 代码块第一行必须是文件路径注释：// File: src/main/java/com/example/Main.java
3. 必须包含以下文件（如适用）：
   - pom.xml（Maven 构建文件，含对应核心的依赖）
   - src/main/java/{packagePath}/Main.java（主类）
   - src/main/java/{packagePath}/commands/（命令类目录）
   - src/main/java/{packagePath}/listeners/（事件监听器目录）
   - src/main/java/{packagePath}/managers/（管理器目录）
   - src/main/resources/plugin.yml（Bukkit/Spigot/Paper/Purpur/BungeeCord）
   - src/main/resources/config.yml（配置文件）
4. Java 版本：{javaVersion}
5. 包名：{packageName}
6. 代码必须是完整可编译的，不能有占位符或 TODO。
7. 使用对应核心的 API：{coreApiImport}
```

**各核心模板特有部分**：

| 核心       | System Prompt 追加内容                                                                 | 示例依赖                                          |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Bukkit     | 使用 Bukkit API，主类 extends JavaPlugin，使用 plugin.yml                              | `org.bukkit:bukkit:1.20.1-R0.1-SNAPSHOT`          |
| Spigot     | 使用 Spigot API，主类 extends JavaPlugin，使用 plugin.yml                              | `org.spigotmc:spigot-api:1.20.1-R0.1-SNAPSHOT`    |
| Paper      | 使用 Paper API，主类 extends JavaPlugin，可使用 Paper 特有 API（如 Component 文本）    | `io.papermc.paper:paper-api:1.20.1-R0.1-SNAPSHOT` |
| Purpur     | 使用 Purpur API（Paper 的超集），可使用 Purpur 特有 API                                | `net.pl3x.purpur:purpur-api:1.20.1-R0.1-SNAPSHOT` |
| BungeeCord | 使用 BungeeCord API，主类 extends Plugin，使用 plugin.yml，事件监听使用 Listener 接口  | `net.md-5:bungeecord-api:1.20-R0.1-SNAPSHOT`      |
| Velocity   | 使用 Velocity API，主类使用 @Plugin 注解，无 plugin.yml，使用 EventSubscriber 监听事件 | `com.velocitypowered:velocity-api:3.2.0-SNAPSHOT` |

**增量修改 Prompt**：

```
当前插件的所有文件内容如下：
{filesManifest (JSON 序列化，包含每个文件的路径和内容)}

用户希望进行以下修改：
{description}

请输出修改后的完整文件内容（包含所有文件，即使没有修改也要原样输出）。
保持与原来相同的文件路径格式：// File: path/to/file
```

### 5.2 DeepSeek API 调用 → AC-001 ~ AC-005

```typescript
// ai-generator.service.ts
@Injectable()
export class AiGeneratorService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1', // DeepSeek API 地址
      apiKey: this.configService.get('DEEPSEEK_API_KEY'),
    });
  }

  async generate(dto: GenerateDto): Promise<GenerateResult> {
    const prompt = this.promptService.buildPrompt(dto); // 5.1
    this.wsGateway.pushProgress(dto.userId, 'plugin', 10, '正在生成项目结构…');

    const response = await this.openai.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
      timeout: 30000, // 30s → AC-104
    });

    this.wsGateway.pushProgress(dto.userId, 'plugin', 60, '正在解析生成结果…');

    const content = response.choices[0]?.message?.content;
    if (!content) throw new BadRequestException('AI response is empty');

    const filesManifest = this.parserService.parseResponse(content); // 5.3
    if (Object.keys(filesManifest).length === 0) {
      throw new BadRequestException('AI response parse failed'); // → AC-103
    }

    return filesManifest;
  }
}
```

### 5.3 AI 响应解析器 → AC-103

````typescript
// parser.service.ts
function parseResponse(markdown: string): Record<string, string> {
  const files: Record<string, string> = {};

  // 匹配格式：```\n// File: path/to/File.java\ncode...```
  const fileBlocks = markdown.matchAll(/```(?:\w+)?\n\/\/ File:\s*([^\n]+)\n([\s\S]*?)```/g);

  for (const match of fileBlocks) {
    const [, filePath, code] = match;
    files[filePath.trim()] = code.trim();
  }

  return files;
}
````

### 5.4 项目骨架状态机

生成过程中的状态流转（通过 WebSocket 推送）：→ AC-005

```
initial → GENERATING (10%) → PARSING (60%) → SAVING (80%) → COMPLETE (100%)
                                          ↘ PARSE_FAILED → ERROR (返还配额)
```

### 5.5 增量修改上下文传递 → AC-006

```typescript
async modify(pluginId: string, description: string): Promise<ModifyResult> {
  // 1. 获取当前版本的文件清单
  const currentVersion = await this.prisma.pluginVersion.findFirst({
    where: { pluginId },
    orderBy: { version: 'desc' },
  });
  const filesManifest = currentVersion.filesManifest as Record<string, string>;

  // 2. 构建修改 Prompt（包含全部当前代码）
  const systemPrompt = this.promptService.buildModifyPrompt(filesManifest, description);

  // 3. 调用 AI
  const response = await this.openai.chat.completions.create({ ... });

  // 4. 解析修改后的文件
  const newFiles = this.parserService.parseResponse(responseContent);

  // 5. 创建新版本
  const newVersion = await this.versionService.createSnapshot(pluginId, newFiles);

  // 6. 写入磁盘
  await this.fileService.writeFiles(pluginId, newFiles);

  return { newVersion: newVersion.version, changes: this.detectChanges(filesManifest, newFiles) };
}
```

### 5.6 AI 解释 → AC-008

```typescript
async explain(filePath: string, code: string): Promise<string> {
  const response = await this.openai.chat.completions.create({
    model: 'deepseek-v4-flash',
    messages: [
      {
        role: 'system',
        content: `你是一个 Minecraft 插件开发导师。解释以下 Java 代码的作用。
用通俗易懂的语言，以 Markdown 格式输出。
重点解释：
1. 这个文件/代码段的作用是什么
2. 主要类和方法的功能
3. 命令注册和事件监听的逻辑
4. 配置文件的读取方式
5. 权限节点的定义`,
      },
      { role: 'user', content: `文件：${filePath}\n\n代码：\n\`\`\`java\n${code}\n\`\`\`` },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });

  return response.choices[0]?.message?.content || 'Unable to explain this code.';
}
```

### 5.7 前端生成表单 → AC-001

```tsx
// CreatePlugin.tsx — 核心逻辑
function CreatePlugin() {
  const form = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
  });

  const ws = useWebSocket(); // 建立 WebSocket 连接
  const mutation = useMutation({
    mutationFn: (data) => apiClient.post('/ai/generate', data),
    onSuccess: (res) => {
      // 订阅进度事件
      ws.on(`ai.progress:${res.data.pluginId}`, (progress) => {
        setProgress(progress.percent);
        setStage(progress.stage);
      });
      // 生成完成 → 跳转编辑页
      ws.on(`ai.generated:${res.data.pluginId}`, () => {
        navigate(`/dashboard/plugins/${res.data.pluginId}/edit`);
      });
    },
  });

  return (
    <form>
      {/* 插件名称 */}
      <Input {...form.register('name')} label="插件名称" />

      {/* MC 版本下拉 */}
      <Select {...form.register('mcVersion')} options={MC_VERSIONS} label="Minecraft 版本" />

      {/* 核心选择 */}
      <Select
        {...form.register('coreType')}
        options={CORE_TYPES}
        label="服务端核心"
        onChange={(v) =>
          form.setValue('javaVersion', autoMatchJava(v, form.getValues('mcVersion')))
        }
      />

      {/* Java 版本（自动匹配，可手动改） */}
      <Input {...form.register('javaVersion')} label="Java 版本" disabled />

      {/* 包名 */}
      <Input {...form.register('packageName')} label="包名" placeholder="com.example.myplugin" />

      {/* 功能描述 */}
      <Textarea
        {...form.register('description')}
        label="功能描述"
        rows={6}
        placeholder="描述你想实现的插件功能，包括命令、事件、配置等……"
      />

      {/* 提交 */}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? '生成中…' : '生成插件'}
      </Button>

      {/* 进度条 */}
      {mutation.isPending && <ProgressBar percent={progress} stage={stage} />}
    </form>
  );
}
```

---

## 6. 现有代码改动

| 模块 / 文件                                   | 改动内容                                        | 原因               | 对应 AC        |
| --------------------------------------------- | ----------------------------------------------- | ------------------ | -------------- |
| `backend/src/app.module.ts`                   | 导入 AiGeneratorModule                          | 注册新模块         | 全部           |
| `backend/src/modules/auth/auth.service.ts`    | 添加 quota check 方法供 AI Generator 调用       | 生成前检查配额     | AC-107         |
| `backend/src/websocket/progress.gateway.ts`   | 添加 ai.progress / ai.generated / ai.error 事件 | 实时推送           | AC-005         |
| `frontend/src/App.tsx`                        | 添加 `/dashboard/create` 路由                   | 新页面             | AC-001         |
| `frontend/src/components/layout/TopNav.tsx`   | "创建插件"按钮                                  | 入口               | AC-001         |
| `frontend/src/pages/dashboard/PluginEdit.tsx` | 添加底部修改输入框 + AI 解释按钮 + 解释面板     | 增量修改和解释入口 | AC-006, AC-008 |

---

## 7. 技术决策

### 7.1 DeepSeek API temperature = 0.3

**背景**：AI 生成代码的"创造性"程度控制。

**选项**：

- A: temperature = 0.1（接近确定性输出）— 代码结构稳定，但可能过于保守，功能描述处理不够灵活
- B: temperature = 0.3（低创造性）— 代码结构可靠，同时能根据功能描述产生合理的变体

**结论**：选择 B。0.3 是代码生成场景的推荐值——结构稳定但仍有灵活性处理不同的功能描述。

### 7.2 增量修改传全部代码而非仅 diff

**背景**：增量修改时传给 AI 的上下文内容选择。

**选项**：

- A: 仅传修改描述 + 被修改的文件 — 节省 Token，但 AI 可能缺乏全局上下文导致不一致
- B: 传全部项目文件 + 修改描述 — Token 消耗大，但 AI 有完整上下文，修改更准确

**结论**：选择 B。Minecraft 插件通常很小（5-15 个文件，总 Token 约 3K-8K），即使全部传递也在 DeepSeek 的上下文窗口范围内。修改质量优先于 Token 成本。

### 7.3 WebSocket 进度推送到单个连接而非广播

**背景**：WebSocket 事件的分发方式。

**选项**：

- A: 全局广播所有事件 — 所有客户端收到所有事件，前端自行过滤
- B: 按 room（userId:pluginId）分发 — 每个客户端只接收自己项目的事件

**结论**：选择 B。客户端在 WebSocket 连接时加入 `room:userId:pluginId`，服务端只向该 room 推送事件，避免无关事件干扰。

---

## 8. 安全与性能

**配额检查**：每次 `POST /ai/generate` 前执行 Redis quota check。生成失败时通过 `quota:rollback` 返还（INCR 回退）。→ BR-005, AC-203

**API Key 管理**：DeepSeek API Key 仅存在于后端 `.env` 文件中，通过 `ConfigService` 注入，前端不可见。

**超时控制**：DeepSeek API 调用设置 30s 超时（`timeout: 30000`），超时后返回 504。→ AC-104

**并发控制**：单用户不允许并行生成（前一次生成完成后才能发起下一次）。通过 Redis 分布式锁 `generating:{userId}` 实现。

**Token 成本**：每次生成平均消耗约 3K-6K Tokens（输入）+ 5K-10K Tokens（输出），按 DeepSeek 定价成本可控。

---

## 9. AC 覆盖总表

| AC 编号 | 验收标准概述              | 实现位置                                     |
| ------- | ------------------------- | -------------------------------------------- |
| AC-001  | 填写表单并提交            | 5.7 CreatePlugin.tsx + 4.1 POST /ai/generate |
| AC-002  | 生成完成跳转编辑页        | 5.7 WebSocket on ai.generated → navigate     |
| AC-003  | 不同核心生成不同结构      | 5.1 各核心 Prompt 模板（6 个）               |
| AC-004  | 生成结果含标准 Maven 结构 | 5.1 Prompt 强制要求 + 5.3 解析器             |
| AC-005  | WebSocket 实时推送进度    | 5.2 wsGateway + 5.4 状态机                   |
| AC-006  | 增量修改追加功能          | 5.5 modify() + Modify Prompt                 |
| AC-007  | 增量修改创建新版本        | 5.5 versionService.createSnapshot            |
| AC-008  | AI 解释代码               | 5.6 explain() + Explain Prompt               |
| AC-101  | 必填字段校验              | 4.1 DTO validation                           |
| AC-102  | WS 断开处理               | 前端 useWebSocket 重连 + 提示                |
| AC-103  | AI 格式错误               | 5.3 parser 返回空 → 502 + 返还配额           |
| AC-104  | AI 超时处理               | 5.2 timeout: 30000 + 504                     |
| AC-105  | 修改描述无效              | 4.2 @Length(5) DTO 校验                      |
| AC-201  | 不同核心依赖版本          | 5.1 各核心 Prompt 模板的 pom.xml 依赖        |
| AC-202  | 增量修改不覆盖旧版本      | 5.5 prisma.pluginVersion.create              |
| AC-203  | 失败返还配额              | Redis rollback + 自定义 Exception 捕获       |

---

## 附录：变更记录

| 日期       | 变更内容 | 原因 |
| ---------- | -------- | ---- |
| 2026-06-18 | 初始版本 | —    |
