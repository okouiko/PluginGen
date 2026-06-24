# Plugin 项目管理 & File 模块 — 技术设计文档

## 1. 设计概要

**功能描述**：实现插件项目的全生命周期管理（CRUD + 版本控制 + 文件浏览）和文件存取能力（上传依赖/源码、下载源码 ZIP/JAR、文件树扫描）。这是 AI 生成引擎（Phase 1.5）的存储载体和编译引擎（Phase 1.6）的数据来源。

**影响范围**：后端新增 `plugin/` + `file/` 模块；前端新增 `pages/dashboard/PluginList.tsx`、`pages/dashboard/PluginEdit.tsx`、`components/plugin/FileTree.tsx`、`components/plugin/DiffViewer.tsx`、`components/plugin/VersionHistory.tsx`。

**技术难点**：

- 版本快照只存储文件清单（JSON）而非文件副本，文件操作都需要通过 JSON → 磁盘双向同步
- 版本回退本质是创建新版本 + 覆盖磁盘文件

**外部依赖**：`archiver`（ZIP 打包）、`adm-zip`（ZIP 解包）、`@monaco-editor/react`（已在 Phase 1.1 安装）

---

## 2. 架构概览

```
数据流:

Controller → Service → FileSystem (本地磁盘)
                 ↓
             Prisma (数据库)

文件存储路径:
data/plugins/{userId}/{pluginId}/
├── src/                        # 最新源码目录（物理文件）
│   ├── pom.xml
│   ├── plugin.yml
│   └── src/main/java/...
├── versions/                   # 版本快照 ZIP（回退用）
│   ├── 1.zip
│   └── 2.zip
├── jars/                       # 编译产物
│   └── plugin-1.jar
└── deps/                       # 用户上传的依赖
    └── Vault.jar

内存中的版本快照:
PluginVersion.filesManifest = {
  "files": {
    "pom.xml": "<xml content>",
    "plugin.yml": "<yaml content>",
    "src/main/java/com/example/Main.java": "<java content>"
  }
}
```

---

## 3. 数据库设计

> 本阶段使用 Phase 1.2 已定义的 `PluginProject` 和 `PluginVersion` 表，**不新增 migration**。

**PluginProject 关键字段**（已定义）：

| 字段                                                | 类型               | 本阶段使用方式                                                         |
| --------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| id                                                  | UUID               | CRUD 查询                                                              |
| userId                                              | FK→User            | 所有权检查                                                             |
| name, mcVersion, coreType, javaVersion, packageName | 各类型             | 创建时写入，列表时展示                                                 |
| status                                              | ProjectStatus enum | `DRAFT`（新建）/ `MODIFIED`（有修改）/ `COMPILING`/`COMPILED`/`FAILED` |
| currentVersion                                      | Int                | 初始 0，每次创建快照递增                                               |
| isPublished                                         | Boolean            | 默认 false，后续 Phase 使用                                            |
| downloadCount                                       | Int                | 默认 0                                                                 |

**PluginVersion 关键字段**（已定义）：

| 字段          | 类型               | 本阶段使用方式                            |
| ------------- | ------------------ | ----------------------------------------- |
| id            | UUID               | 查询                                      |
| pluginId      | FK→PluginProject   | 关联                                      |
| version       | Int                | 自动递增                                  |
| filesManifest | Json               | 存储 `{ "files": { "path": "content" } }` |
| compileStatus | CompileStatus enum | 默认 `PENDING`，后续 Phase 更新           |
| compileLog    | String?            | 后续 Phase 使用                           |

---

## 4. API 设计

### 4.1 `POST /plugins` — 创建插件项目

**鉴权**：`JwtAuthGuard` → AC-201

**Request**：

```json
{
  "name": "DailyReward",
  "mcVersion": "1.20.1",
  "coreType": "PAPER",
  "javaVersion": "17",
  "packageName": "com.example.dailyreward"
}
```

**DTO 校验**：

| 字段        | 规则                                                            | 说明                  |
| ----------- | --------------------------------------------------------------- | --------------------- |
| name        | `@IsString()` `@Length(2, 50)`                                  | 插件名 2-50 字符      |
| mcVersion   | `@IsString()` `@Matches(/^\d+\.\d+(\.\d+)?$/)`                  | 如 "1.20.1"           |
| coreType    | `@IsEnum(CoreType)`                                             | CoreType 枚举         |
| javaVersion | `@IsString()`                                                   | "8", "11", "17", "21" |
| packageName | `@IsString()` `@Matches(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/)` | Java 包名格式         |

**Response（201 Created）**：

```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "name": "DailyReward",
    "mcVersion": "1.20.1",
    "coreType": "PAPER",
    "javaVersion": "17",
    "packageName": "com.example.dailyreward",
    "status": "DRAFT",
    "currentVersion": 0,
    "isPublished": false,
    "createdAt": "2026-06-18T05:00:00.000Z"
  },
  "message": "success"
}
```

### 4.2 `GET /plugins` — 获取当前用户的插件列表 → AC-001

**鉴权**：`JwtAuthGuard`

**Query**：`?page=1&limit=20&status=DRAFT`

**Response**：

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "DailyReward",
        "mcVersion": "1.20.1",
        "coreType": "PAPER",
        "status": "DRAFT",
        "currentVersion": 0,
        "createdAt": "..."
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  },
  "message": "success"
}
```

### 4.3 `GET /plugins/:id` — 获取插件详情 + 文件树 → AC-003, AC-004

**鉴权**：`JwtAuthGuard` + 所有权检查

**Response**：

```json
{
  "code": 200,
  "data": {
    "plugin": { "...": "插件元信息" },
    "fileTree": [
      { "name": "pom.xml", "path": "pom.xml", "type": "file" },
      {
        "name": "src",
        "path": "src",
        "type": "directory",
        "children": [
          {
            "name": "main",
            "path": "src/main",
            "type": "directory",
            "children": [
              {
                "name": "java",
                "path": "src/main/java",
                "type": "directory",
                "children": [
                  {
                    "name": "com/example/Main.java",
                    "path": "src/main/java/com/example/Main.java",
                    "type": "file"
                  }
                ]
              }
            ]
          }
        ]
      },
      { "name": "plugin.yml", "path": "plugin.yml", "type": "file" }
    ],
    "versions": [{ "version": 1, "compileStatus": "PENDING", "createdAt": "..." }]
  },
  "message": "success"
}
```

### 4.4 `POST /plugins/:id/versions` — 创建版本快照 → AC-005

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：将当前磁盘 `src/` 目录的所有文件生成文件清单 JSON，创建新 PluginVersion 记录，并将文件打包为 ZIP 存储到 `versions/{version}.zip`。

**Response（201 Created）**：

```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "version": 1,
    "compileStatus": "PENDING",
    "createdAt": "2026-06-18T05:00:00.000Z"
  },
  "message": "success"
}
```

### 4.5 `GET /plugins/:id/versions` — 版本列表 → AC-005

**鉴权**：`JwtAuthGuard` + 所有权检查

**Response**：

```json
{
  "code": 200,
  "data": [
    { "version": 3, "compileStatus": "SUCCESS", "createdAt": "..." },
    { "version": 2, "compileStatus": "FAILED", "createdAt": "..." },
    { "version": 1, "compileStatus": "PENDING", "createdAt": "..." }
  ],
  "message": "success"
}
```

### 4.6 `GET /plugins/:id/versions/:vid/diff` — 版本差异对比 → AC-006

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：对比 `vid-1` 与 `vid` 两个版本的文件差异，返回按文件组织的 diff 数据。

**Response**：

```json
{
  "code": 200,
  "data": {
    "oldVersion": 1,
    "newVersion": 2,
    "files": [
      {
        "path": "src/main/java/com/example/Main.java",
        "oldContent": "public class Main ...",
        "newContent": "public class Main ..."
      }
    ]
  },
  "message": "success"
}
```

> 前端使用 Monaco DiffEditor 渲染 `oldContent` vs `newContent` 的并排差异。

### 4.7 `POST /plugins/:id/versions/:vid/restore` — 版本回退 → AC-007

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：将指定版本的 `filesManifest` 还原到磁盘 `src/` 目录，同时创建新版本（`currentVersion + 1`）。

**Response**：

```json
{
  "code": 200,
  "data": { "version": 4, "message": "Restored to version 1" },
  "message": "success"
}
```

### 4.8 `DELETE /plugins/:id` — 删除插件项目 → AC-012, AC-101, AC-202

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：级联删除数据库记录 + 本地磁盘目录（`data/plugins/{userId}/{pluginId}/`）。

### 4.9 `POST /file/upload/dependency` — 上传依赖 JAR → AC-010, AC-104, AC-105

**鉴权**：`JwtAuthGuard` + 所有权检查

**支持**：`multipart/form-data`，字段名 `file`

**校验**：`application/java-archive` 或 `.jar` 扩展名，≤ 50MB

### 4.10 `POST /file/upload/source` — 上传源码 ZIP → AC-011

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：接收 ZIP 文件 → `adm-zip` 解包 → 遍历文件 → 写入 `src/` 目录 → 更新 `filesManifest`

### 4.11 `GET /file/download/:id/zip` — 下载源码 ZIP → AC-008

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：读取 `src/` 目录所有文件 → `archiver` 流式打包为 ZIP → 返回 `Content-Disposition: attachment; filename="plugin-name-source.zip"`

### 4.12 `GET /file/download/:id/jar` — 下载编译 JAR → AC-009

**鉴权**：`JwtAuthGuard` + 所有权检查

**说明**：返回 `jars/plugin-{currentVersion}.jar` 文件流

---

## 5. 核心逻辑

### 5.1 文件树构建 → AC-003, AC-204

```typescript
// plugin.service.ts — buildFileTree()
// 从 PluginVersion.filesManifest 构建树结构

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

function buildFileTree(filesManifest: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const files = Object.keys(filesManifest);

  for (const filePath of files) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const name = parts[i];
      const path = parts.slice(0, i + 1).join('/');

      if (isLast) {
        current.push({ name, path, type: 'file' });
      } else {
        let existing = current.find((n) => n.name === name && n.type === 'directory');
        if (!existing) {
          existing = { name, path, type: 'directory', children: [] };
          current.push(existing);
        }
        current = existing.children!;
      }
    }
  }

  return root;
}
```

### 5.2 版本快照创建 → AC-005, AC-203

```typescript
// plugin-version.service.ts — createSnapshot()
async createSnapshot(pluginId: string): Promise<PluginVersion> {
  const plugin = await this.prisma.pluginProject.findUnique({ where: { id: pluginId } });
  const newVersion = plugin.currentVersion + 1;

  // 1. 从磁盘 src/ 目录读取所有文件
  const srcDir = this.getSrcDir(plugin.userId, pluginId);
  const filesManifest = await this.scanDirectory(srcDir);

  // 2. 创建版本记录
  const version = await this.prisma.pluginVersion.create({
    data: {
      pluginId,
      version: newVersion,
      filesManifest,  // Json 字段
    },
  });

  // 3. 将文件打包为 ZIP 备份
  await this.zipAndSave(srcDir, this.getVersionZipPath(plugin.userId, pluginId, newVersion));

  // 4. 更新当前版本号
  await this.prisma.pluginProject.update({
    where: { id: pluginId },
    data: { currentVersion: newVersion },
  });

  return version;
}
```

### 5.3 版本回退 → AC-007

```typescript
// plugin-version.service.ts — restoreVersion()
async restoreVersion(pluginId: string, targetVersion: number): Promise<PluginVersion> {
  const target = await this.prisma.pluginVersion.findUnique({
    where: { pluginId_version: { pluginId, version: targetVersion } },
  });

  // 1. 将目标版本的 filesManifest 写入磁盘 src/
  await this.writeManifestToDisk(
    this.getSrcDir(plugin.userId, pluginId),
    target.filesManifest as Record<string, string>,
  );

  // 2. 创建新版本（内容是回退版本的内容）
  const newVersion = await this.createSnapshot(pluginId);

  return newVersion;
}
```

### 5.4 ZIP 打包下载 → AC-008

```typescript
// file.service.ts — downloadSourceZip()
async downloadSourceZip(pluginId: string, userId: string, res: Response): Promise<void> {
  const srcDir = this.getSrcDir(userId, pluginId);
  const plugin = await this.prisma.pluginProject.findUnique({ where: { id: pluginId } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${plugin.name}-source.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory(srcDir, false);
  await archive.finalize();
}
```

### 5.5 文件上传与校验 → AC-010, AC-104, AC-105

```typescript
// file.controller.ts — uploadDependency()
@Post('upload/dependency')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 50 * 1024 * 1024 },  // 50MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith('.jar')) {
      cb(new BadRequestException('Only .jar files are allowed'), false);
    }
    cb(null, true);
  },
}))
async uploadDependency(
  @Param('id') pluginId: string,
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: JwtPayload,
) {
  const depsDir = path.join(this.getPluginDir(user.id, pluginId), 'deps');
  await fs.promises.mkdir(depsDir, { recursive: true });
  await fs.promises.writeFile(path.join(depsDir, file.originalname), file.buffer);
  return { filename: file.originalname, size: file.size };
}
```

### 5.6 前端编辑器三栏布局 → AC-003, AC-004, AC-005

```tsx
// PluginEdit.tsx — 三栏布局结构
<div className="flex h-full">
  {/* 左侧文件树 — 240px */}
  <aside className="w-60 border-r border-hairline bg-canvas p-md">
    <FileTree files={fileTree} onSelect={handleFileSelect} />
  </aside>

  {/* 中间编辑器 — flex 1 */}
  <main className="flex-1">
    <EditorPanel language={selectedFile?.endsWith('.java') ? 'java' : 'yaml'} value={fileContent} />
  </main>

  {/* 右侧版本侧栏 — 280px */}
  <aside className="w-70 border-l border-hairline bg-canvas p-md">
    <VersionHistory
      versions={versions}
      onDiff={(v1, v2) => loadDiff(v1, v2)}
      onRestore={(v) => restoreVersion(v)}
    />
  </aside>
</div>
```

---

## 6. 现有代码改动

| 模块 / 文件                     | 改动内容                                                        | 原因       | 对应 AC |
| ------------------------------- | --------------------------------------------------------------- | ---------- | ------- |
| `backend/src/app.module.ts`     | 导入 PluginModule + FileModule                                  | 注册新模块 | 全部    |
| `frontend/src/App.tsx`          | 添加 `/dashboard/plugins` 和 `/dashboard/plugins/:id/edit` 路由 | 新页面路由 | AC-001  |
| `frontend/src/config/routes.ts` | 添加 `DASHBOARD_PLUGINS`、`DASHBOARD_PLUGIN_EDIT` 常量          | 路由常量化 | —       |

---

## 7. 技术决策

### 7.1 版本快照存储：JSON filesManifest + ZIP 双重备份

**背景**：版本快照需要同时支持"快速读取文件内容"（文件树展示）和"完整版本回退"（恢复所有文件）。

**选项**：

- A: 仅存 JSON filesManifest — 读取快，回退时需重建目录结构，但缺少文件元数据
- B: JSON filesManifest + 每次创建快照时将文件打包为 ZIP — 读取快（从 JSON），回退可靠（从 ZIP），但磁盘占用翻倍

**结论**：选择 B。JSON 用于常规读取（文件树、编辑器展示），ZIP 作为版本备份用于回退操作。ZIP 有高压缩比（Minecraft 插件源码通常 < 100KB），磁盘开销可忽略。

### 7.2 文件树从服务端构建而非前端

**背景**：文件树的构建位置。

**选项**：

- A: 前端从 flatsManifest 的 key 列表中自行构建树结构 — 前端逻辑复杂，需要递归遍历
- B: 服务端构建树结构直接返回 → 前端只需渲染

**结论**：选择 B。`GET /plugins/:id` 时服务端直接返回已构建好的文件树数组，前端直接遍历渲染，保持数据源一致。

### 7.3 `archiver` 流式打包而非先生成文件再下载

**背景**：源码 ZIP 下载的实现方式。

**选项**：

- A: 先生成 ZIP 临时文件 → 返回路径 → 下载完成后清理 — 需要临时文件管理和定时清理
- B: `archiver` 流式打包 → pipe 到 Response — 零临时文件，内存友好

**结论**：选择 B。流式打包直接将 ZIP 流写入 HTTP 响应，不产生任何临时文件，对大项目也内存友好。

---

## 8. 安全与性能

**文件上传安全**：

- 限制文件类型：依赖仅 `.jar`，源码仅 `.zip` → AC-104
- 限制文件大小：≤ 50MB → AC-105
- 文件路径使用 UUID 重命名存储（Multer 的 `diskStorage` 配置 `filename`），防止路径遍历攻击
- 编译在 Docker 沙箱中执行（Phase 1.6），上传的 JAR/ZIP 不直接执行

**所有权检查**：所有 `pluginId` 参数的 API 都检查 `req.user.id === plugin.userId`，返回 403 拒绝跨用户访问 → AC-201

**级联删除安全**：删除项目时使用 Prisma `onDelete: Cascade` + 文件系统递归删除，确保数据一致 → AC-202

---

## 9. AC 覆盖总表

| AC 编号 | 验收标准概述           | 实现位置                                                         |
| ------- | ---------------------- | ---------------------------------------------------------------- |
| AC-001  | 插件列表展示           | 4.2 GET /plugins                                                 |
| AC-002  | 插件列表空状态         | 前端 PluginList.tsx 空态判断                                     |
| AC-003  | 文件树展示项目结构     | 4.3 GET /plugins/:id fileTree + 5.1 buildFileTree                |
| AC-004  | Monaco 编辑器展示源码  | 前端 EditorPanel.tsx (Monaco Editor)                             |
| AC-005  | 版本历史列表           | 4.5 GET /plugins/:id/versions                                    |
| AC-006  | 版本差异对比           | 4.6 GET /plugins/:id/versions/:vid/diff + DiffViewer             |
| AC-007  | 版本回退               | 4.7 POST /plugins/:id/versions/:vid/restore + 5.3 restoreVersion |
| AC-008  | 下载源码 ZIP           | 4.11 GET /file/download/:id/zip + 5.4 archiver                   |
| AC-009  | 下载编译 JAR           | 4.12 GET /file/download/:id/jar                                  |
| AC-010  | 上传依赖 JAR           | 4.9 POST /file/upload/dependency + 5.5                           |
| AC-011  | 上传源码 ZIP 并分析    | 4.10 POST /file/upload/source                                    |
| AC-012  | 删除插件项目           | 4.8 DELETE /plugins/:id                                          |
| AC-101  | 删除前二次确认         | 前端 ConfirmDialog 组件                                          |
| AC-102  | 访问不存在的项目       | Controller 中 NotFoundException                                  |
| AC-103  | 无权访问他人项目       | 所有权中间件检查 → 403                                           |
| AC-104  | 上传文件类型不合法     | 5.5 Multer fileFilter + `.jar` 校验                              |
| AC-105  | 上传文件超过大小限制   | 5.5 Multer limits.fileSize = 50MB                                |
| AC-201  | 所有权检查             | 各 Controller 中 plugin.userId !== user.id → 403                 |
| AC-202  | 级联删除               | Prisma onDelete: Cascade + fs.rm recursive                       |
| AC-203  | 版本号自动递增         | 5.2 newVersion = plugin.currentVersion + 1                       |
| AC-204  | 文件树正确反映磁盘结构 | 5.1 buildFileTree from filesManifest                             |

---

## 附录：变更记录

| 日期       | 变更内容 | 原因 |
| ---------- | -------- | ---- |
| 2026-06-18 | 初始版本 | —    |
