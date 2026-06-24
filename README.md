# PluginGen

Minecraft 插件 AI 生成平台 —— 让任何有创意的人，无需配置 Java/Maven/IDE，在浏览器中就能完成从「我有一个想法」到「一个可运行的插件」的全过程。

## 系统要求

- **Node.js** >= 22 LTS
- **pnpm** >= 9.0
- **Docker** & **Docker Compose** (用于 PostgreSQL + Redis)

## 快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 启动数据库
docker compose up -d

# 3. 启动后端 (终端 1)
pnpm dev:backend

# 4. 启动前端 (终端 2)
pnpm dev:frontend
```

访问 http://localhost:5173

## 目录结构

```
PluginGen/
├── frontend/       # Vite + React SPA
├── backend/        # NestJS API 服务
├── docker/         # Docker 编译沙箱镜像
├── nginx/          # Nginx 反向代理配置
├── specs/          # 项目定义文档
└── docker-compose.yml
```

## 开发命令

| 命令                | 说明                         |
| ------------------- | ---------------------------- |
| `pnpm dev:backend`  | 启动 NestJS 后端 (端口 3000) |
| `pnpm dev:frontend` | 启动 Vite 前端 (端口 5173)   |
| `pnpm lint`         | 运行 ESLint 检查             |
| `pnpm format`       | 运行 Prettier 格式化         |
| `pnpm typecheck`    | 运行 TypeScript 类型检查     |
