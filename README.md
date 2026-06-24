# PluginGen

Minecraft 插件 AI 生成平台 —— 让任何有创意的人，无需配置 Java/Maven/IDE，在浏览器中完成从「我有一个想法」到「一个可运行的插件」的全过程。

## ✨ 功能特性

| 模块 | 功能 |
|------|------|
| **🤖 AI 生成引擎** | 自然语言描述需求 → DeepSeek API 生成完整 Maven 项目（支持 Bukkit/Spigot/Paper/Purpur/BungeeCord/Velocity 六大核心） |
| **📝 在线编辑器** | Monaco Editor 源码查看 + 语法高亮 + AI 增量修改 + AI 代码解释 |
| **🛠️ 编译系统** | 本地 Maven 编译（JDK 8/11/17/21 自动选择），实时日志推送 |
| **🔧 自动修复** | AI 分析编译错误并自动修复，修复后自动重新编译 |
| **📦 版本管理** | 版本快照、历史对比（Monaco DiffEditor）、一键回退 |
| **📥 文件下载** | 源码 ZIP 打包下载 + 编译 JAR 下载 |
| **👥 作品广场** | 插件公开浏览、搜索筛选、收藏/点赞/评论/评分 |
| **👤 创作者体系** | 个人主页、等级称号（4 档 50 级）、经验值系统 |
| **📅 每日签到** | 连续签到奖励（7/30 天阶梯奖励）+ 每日任务（生成/发布/评论） |
| **🔔 通知与私信** | 实时 WebSocket 推送、站内私信系统 |
| **⚙️ 设置** | DeepSeek API Key 配置、个人资料修改 |
| **🌙 暗色模式** | 亮色/暗色/跟随系统三模式切换 |
| **📱 响应式** | 桌面/平板/移动端三断点适配 |

## 🏗️ 技术栈

### 前端
| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | 框架 |
| Vite 6 | 构建工具 |
| TailwindCSS 4 | 样式方案（DESIGN.md 完整主题映射） |
| Shadcn/ui | UI 组件库 |
| Monaco Editor | 代码编辑器 |
| TanStack Query | 数据请求/缓存 |
| Zustand | 状态管理 |
| Framer Motion | 页面过渡动画 |
| React Router 7 | 路由 |

### 后端
| 技术 | 用途 |
|------|------|
| NestJS 11 + TypeScript | Web 框架 |
| Prisma 6 + PostgreSQL | ORM / 数据库 |
| Redis 7 | 缓存 / 队列 |
| DeepSeek API | AI 生成 |
| Dockerode | Docker 容器管理 |
| JWT + Passport | 认证鉴权 |
| WebSocket (ws) | 实时推送 |
| Maven | 本地编译（JDK 8/11/17/21） |

## 📋 系统要求

- **Node.js** >= 22 LTS
- **pnpm** >= 9.0
- **Docker** & **Docker Compose**（用于 PostgreSQL + Redis）
- **Maven**（用于本地编译，安装脚本会自动安装）
- **JDK 8/11/17/21**（编译插件用，安装脚本会自动安装）

## 🚀 快速启动

```bash
# 1. 克隆项目
git clone https://github.com/okouiko/PluginGen.git
cd PluginGen

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example backend/.env
# 编辑 backend/.env，配置 DeepSeek API Key 等

# 4. 启动数据库
docker compose up -d

# 5. 同步数据库表结构
pnpm --filter backend db:push

# 6. 启动后端 (终端 1)
pnpm dev:backend

# 7. 启动前端 (终端 2)
pnpm dev:frontend
```

访问 **http://localhost:5173**

## 🐳 生产部署

```bash
# 构建前端
pnpm --filter frontend build

# 启动后端服务
cd backend && node dist/main.js

# Nginx 配置参考 nginx/sites/plugingen.conf
```

## 📁 目录结构

```
PluginGen/
├── frontend/              # Vite + React SPA
│   └── src/
│       ├── components/    # 可复用 UI 组件
│       ├── pages/         # 路由页面
│       ├── hooks/         # 自定义 Hooks
│       ├── stores/        # Zustand 状态管理
│       ├── lib/           # 工具/API 客户端
│       └── types/         # TypeScript 类型定义
├── backend/               # NestJS API 服务
│   ├── prisma/            # 数据库 Schema
│   └── src/
│       ├── modules/       # 9 大业务模块
│       │   ├── auth/           # 认证
│       │   ├── user/           # 用户
│       │   ├── plugin/         # 插件管理
│       │   ├── ai-generator/   # AI 生成
│       │   ├── compile/        # 编译引擎
│       │   ├── community/      # 社区
│       │   ├── notification/   # 通知消息
│       │   ├── daily/          # 签到任务
│       │   └── file/           # 文件管理
│       └── common/        # 共享基础设施
├── docker/                # Docker 编译镜像
├── nginx/                 # Nginx 配置
└── specs/                 # 技术文档
```

## 🧪 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev:backend` | 启动 NestJS 后端 (端口 3000) |
| `pnpm dev:frontend` | 启动 Vite 前端 (端口 5173) |
| `pnpm build:backend` | 构建后端 |
| `pnpm build:frontend` | 构建前端 |
| `pnpm lint` | ESLint 检查 |
| `pnpm format` | Prettier 格式化 |
| `pnpm typecheck` | TypeScript 类型检查 |

## 📄 开源协议

MIT
