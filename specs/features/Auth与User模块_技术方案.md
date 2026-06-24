# Auth & User 模块 — 技术设计文档

## 1. 设计概要

**功能描述**：实现用户注册、登录、JWT 认证、个人资料管理、创作者等级/经验值引擎和每日生成配额控制。这是平台第一个面向最终用户的业务模块，也是所有后续业务模块的认证基座。

**影响范围**：后端新增 `auth/` + `user/` 模块；前端新增 `pages/Login.tsx`、`pages/Register.tsx`、`hooks/use-auth.ts`；修改 `TopNav.tsx` 展示用户态；修改 `App.tsx` 添加认证路由守卫。

**技术难点**：

- 经验值引擎：需要监听多个业务模块的事件（生成插件、发布作品等），解耦事件源和积分计算
- 每日配额：Redis TTL 计数器 + 数据库持久化的双重检查

**外部依赖**：`@nestjs/jwt`、`@nestjs/passport`、`passport`、`passport-jwt`、`passport-local`、`bcrypt`（已规划）

---

## 2. 架构概览

```
注册流程:

POST /auth/register { email, password, nickname }
  → ValidationPipe (DTO 校验)
  → AuthController.register()
    → AuthService.register()
      1. 检查 email 是否已存在
      2. bcrypt.hash(password)
      3. prisma.user.create({ email, password: hash, nickname })
      4. jwtService.sign({ id, email })
      5. 返回 { access_token, user: { id, email, nickname, level, exp, dailyQuota } }


登录流程:

POST /auth/login { email, password }
  → ValidationPipe
  → Passport LocalStrategy.validate()
    1. prisma.user.findUnique({ email })
    2. bcrypt.compare(password, user.password)
    3. return user (或 throw UnauthorizedException)
  → AuthController.login(req.user)
    1. jwtService.sign({ id: user.id, email: user.email })
    2. 返回 { access_token, user }


认证中间件 (JWT):

每次 API 请求 → JwtAuthGuard
  → Passport JwtStrategy.validate()
    1. 从 Authorization header 提取 Token
    2. jwtService.verify(token)
    3. return payload (注入 req.user → 通过 @CurrentUser() 访问)


经验值事件总线:

PluginController.generate() → PluginService
  → EventEmitter.emit('plugin.generate', { userId })
    → UserLevelService.handleGenerate(userId)
      → user.exp += 10 → checkLevelUp()


每日配额流程:

ThrottlerGuard (Redis TTL)
  → Redis: INCR quota:{userId}:{date}
  → 首次 TTL 86400s → 后续检查值 ≤ 20
  → 超限返回 429 Too Many Requests
```

---

## 3. 数据库设计

> 本阶段**不新增表**。User 表已在 Phase 1.2 Prisma Schema 中定义，此处仅列出 Auth/User 模块实际使用的字段。

**使用的字段**（`User` 表）：

| 字段       | 类型     | 用途                   | 本阶段操作                  |
| ---------- | -------- | ---------------------- | --------------------------- |
| id         | UUID     | 主键                   | 只读                        |
| email      | String   | 登录标识               | 注册写入 / 登录读取         |
| password   | String   | bcrypt 哈希            | 注册写入 / 登录验证         |
| nickname   | String   | 显示名称               | 注册写入 / PATCH 修改       |
| avatar     | String   | 默认头像 URL           | 注册时自动填充默认值        |
| bio        | String?  | 个人简介               | PATCH 修改（可选）          |
| level      | Int      | 创作者等级             | 注册默认 1 / 经验升级时递增 |
| exp        | Int      | 经验值                 | 注册默认 0 / 各事件累计     |
| dailyQuota | Int      | 每日配额（数据库记录） | 注册默认 20                 |
| createdAt  | DateTime | 注册时间               | 自动生成                    |
| updatedAt  | DateTime | 资料更新时间           | 自动更新                    |

**本阶段不需要新增 Prisma migration。**

---

## 4. API 设计

### 4.1 `POST /auth/register` — 用户注册 → AC-001, AC-007, AC-101, AC-102, AC-103

**鉴权**：`@Public()`

**Request**：

```json
{
  "email": "user@example.com",
  "password": "Abc12345",
  "nickname": "测试玩家"
}
```

**Response（成功 — 201 Created）**：

```json
{
  "code": 201,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "测试玩家",
      "avatar": "https://api.dicebear.com/...",
      "level": 1,
      "exp": 0,
      "dailyQuota": 20
    }
  },
  "message": "success"
}
```

**DTO 校验**：
| 字段 | 规则 | 错误信息 |
|------|------|----------|
| email | `@IsEmail()` + `@IsNotEmpty()` | "email must be a valid email" |
| password | `@MinLength(8)` + 自定义 `@Matches(/(?=.*[a-zA-Z])(?=.*\d)/)` | "password must be at least 8 characters with at least 1 letter and 1 number" |
| nickname | `@Length(2, 20)` + `@IsString()` | "nickname must be 2-20 characters" |

**异常响应**：

| 场景         | 状态码 | message                       | 对应 AC                |
| ------------ | ------ | ----------------------------- | ---------------------- |
| 邮箱已注册   | 409    | "Email already registered"    | AC-101                 |
| DTO 校验失败 | 400    | "Validation failed" + details | AC-102, AC-103, AC-104 |

### 4.2 `POST /auth/login` — 用户登录 → AC-002, AC-004, AC-105, AC-106

**鉴权**：`@Public()` + Passport LocalStrategy

**Request**：

```json
{
  "email": "user@example.com",
  "password": "Abc12345"
}
```

**Response（成功 — 200）**：

```json
{
  "code": 200,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "测试玩家",
      "avatar": "https://api.dicebear.com/...",
      "level": 1,
      "exp": 0,
      "dailyQuota": 20
    }
  },
  "message": "success"
}
```

**异常响应**：

| 场景                 | 状态码 | message                     | 对应 AC        |
| -------------------- | ------ | --------------------------- | -------------- |
| 邮箱不存在或密码错误 | 401    | "Invalid email or password" | AC-105, AC-106 |

### 4.3 `GET /user/profile` — 获取当前用户信息 → AC-004, AC-005

**鉴权**：`JwtAuthGuard`

**Headers**：`Authorization: Bearer <token>`

**Response（成功 — 200）**：

```json
{
  "code": 200,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "测试玩家",
    "avatar": "https://api.dicebear.com/...",
    "bio": null,
    "level": 1,
    "exp": 10,
    "dailyQuota": 15,
    "createdAt": "2026-06-18T05:00:00.000Z"
  },
  "message": "success"
}
```

### 4.4 `PATCH /user/profile` — 修改个人资料 → AC-008, AC-204

**鉴权**：`JwtAuthGuard`

**Request**：

```json
{
  "nickname": "新昵称",
  "bio": "我的 Minecraft 插件之旅"
}
```

**Response（成功 — 200）**：

```json
{
  "code": 200,
  "data": {
    "id": "uuid",
    "nickname": "新昵称",
    "bio": "我的 Minecraft 插件之旅"
  },
  "message": "success"
}
```

**DTO 校验**：

| 字段     | 规则                                | 说明          |
| -------- | ----------------------------------- | ------------- |
| nickname | `@Length(2, 20)` + `@IsOptional()`  | 不传则不修改  |
| bio      | `@MaxLength(200)` + `@IsOptional()` | 不超过 200 字 |

**异常响应**：

| 场景                 | 状态码 | message     | 对应 AC |
| -------------------- | ------ | ----------- | ------- |
| 试图修改其他用户资料 | 403    | "Forbidden" | AC-204  |

### 4.5 `POST /auth/logout` — 登出

**鉴理**：`JwtAuthGuard`

> 本端点为纯语义接口。实际登出逻辑由前端清除 Token 完成（JWT 无状态，服务端无需记录黑名单）。当前返回 200 确认。

**Response**：

```json
{ "code": 200, "data": null, "message": "success" }
```

---

## 5. 核心逻辑

### 5.1 注册服务 (AuthService.register) → AC-001, AC-007, AC-101

```
register(email, password, nickname):
  1. email = email.toLowerCase().trim()
  2. existing = prisma.user.findUnique({ where: { email } })
  3. if (existing) → throw ConflictException('Email already registered')
  4. hashed = bcrypt.hash(password, saltRounds=10)
  5. user = prisma.user.create({
       data: { email, password: hashed, nickname }
     })
  6. token = jwtService.sign({ id: user.id, email: user.email })
  7. return { access_token: token, user: sanitize(user) }
```

**安全要点**：

- 邮箱转小写后存储+查询，保证大小写不敏感 → AC-201
- bcrypt salt rounds = 10（计算耗时约 100-200ms，足够抵抗暴力破解，不影响用户体验）
- `sanitize()` 排除 `password` 字段（`const { password, ...safeUser } = user`）

### 5.2 登录策略 (LocalStrategy.validate) → AC-002, AC-105, AC-106

```
validate(email, password):
  1. email = email.toLowerCase().trim()
  2. user = prisma.user.findUnique({ where: { email } })
  3. if (!user) → throw UnauthorizedException('Invalid email or password')
  4. match = bcrypt.compare(password, user.password)
  5. if (!match) → throw UnauthorizedException('Invalid email or password')
  6. return user  (相同异常信息防止邮箱枚举 → AC-105, AC-106)
```

### 5.3 JWT 策略 (JwtStrategy.validate) → AC-004, AC-203

```
validate(payload):
  // payload 来自 jwtService.sign({ id, email })
  return { id: payload.id, email: payload.email }
  // 注入到 req.user
```

**JWT 配置**：

```typescript
JwtModule.register({
  secret: configService.get('JWT_SECRET'),
  signOptions: { expiresIn: '7d' }, // → BR-004, AC-203
});
```

### 5.4 经验值引擎 (UserLevelService) → AC-205, BR-005

**事件-积分映射表**：

| 事件               | 触发时机         | 经验值 |
| ------------------ | ---------------- | ------ |
| `plugin.generated` | AI 生成插件完成  | +10    |
| `plugin.published` | 作品发布到广场   | +20    |
| `plugin.liked`     | 用户的插件被点赞 | +5     |
| `plugin.favorited` | 用户的插件被收藏 | +3     |
| `user.signed_in`   | 每日签到         | +5     |

**等级计算公式**：

```
nextLevelExp(level) = level * 100

// 示例：
// Lv.1 → Lv.2: 需要 100 exp
// Lv.2 → Lv.3: 需要 200 exp
// Lv.10 → Lv.11: 需要 1000 exp
```

**实现方式**：使用 NestJS `EventEmitter2`（或简单的 `@Injectable()` + 方法调用）：

```typescript
// user-level.service.ts
async addExp(userId: string, amount: number): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  const newExp = user.exp + amount;
  const newLevel = this.calculateLevel(newExp);

  await this.prisma.user.update({
    where: { id: userId },
    data: { exp: newExp, level: newLevel },
  });
}

// 由各业务模块的事件处理器调用
// 如 CompileService 编译成功后: this.userLevelService.addExp(userId, 10);
```

### 5.5 每日配额中间件 → AC-107, BR-006

**Redis 策略**（在 AuthService 或独立的配额 Guard 中实现）：

```typescript
async checkQuota(userId: string): Promise<boolean> {
  const key = `quota:${userId}:${this.getDateString()}`;  // e.g. "quota:uuid:2026-06-18"
  const count = await this.redis.incr(key);
  if (count === 1) {
    await this.redis.expire(key, 86400);  // 首次设置 TTL 24h
  }
  return count <= 20;  // → BR-006
}

// 在 AI Generator 的 Controller 中调用:
// const allowed = await this.authService.checkQuota(userId);
// if (!allowed) throw new HttpException('Daily quota exceeded', 429);
```

### 5.6 前端 use-auth Hook → AC-001 ~ AC-010

```typescript
// hooks/use-auth.ts
export function useAuth() {
  const { token, user, setAuth, clearAuth } = useAuthStore();

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setAuth(res.data.access_token, res.data.user);
    // auth-store 持久化 token 到 localStorage
  };

  const register = async (email: string, password: string, nickname: string) => {
    const res = await apiClient.post('/auth/register', { email, password, nickname });
    setAuth(res.data.access_token, res.data.user);
  };

  const logout = () => {
    clearAuth(); // 清除 Zustand + localStorage
    window.location.href = '/';
  };

  const updateProfile = async (data: { nickname?: string; bio?: string }) => {
    const res = await apiClient.patch('/user/profile', data);
    useAuthStore.getState().updateUser(res.data);
  };

  return { user, token, isAuthenticated: !!token, login, register, logout, updateProfile };
}
```

### 5.7 前端认证路由守卫 → AC-006, AC-108

```tsx
// 在 RouterProvider 中配置:
const protectedRoutes = [
  {
    path: '/dashboard',
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
  },
  {
    path: '/daily',
    element: (
      <RequireAuth>
        <DailyPage />
      </RequireAuth>
    ),
  },
  {
    path: '/messages',
    element: (
      <RequireAuth>
        <MessagesPage />
      </RequireAuth>
    ),
  },
];

// RequireAuth 组件:
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}
```

---

## 6. 现有代码改动

| 模块 / 文件                                 | 改动内容                                                                        | 原因                                | 对应 AC        |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------- | -------------- |
| `backend/src/app.module.ts`                 | 导入 AuthModule + UserModule                                                    | 注册新模块                          | 全部           |
| `frontend/src/App.tsx`                      | 添加登录/注册路由 + 认证路由守卫                                                | 路由分发                            | AC-006, AC-108 |
| `frontend/src/components/layout/TopNav.tsx` | 根据登录状态显示不同 UI（未登录→登录/注册按钮；已登录→昵称+等级+配额+下拉菜单） | 用户态展示                          | AC-005, AC-009 |
| `frontend/src/lib/api-client.ts`            | 登录后更新 Token 逻辑（store 中读取代入）                                       | 已在 Phase 1.2 实现，本阶段无需改动 | AC-004         |

---

## 7. 技术决策

### 7.1 bcrypt salt rounds = 10

**背景**：bcrypt 的成本因子选择。

**选项**：

- A: salt rounds = 8（约 50ms）— 注册体验快，但安全性稍弱
- B: salt rounds = 10（约 150ms）— 安全性和速度的最佳平衡（业界推荐）
- C: salt rounds = 12（约 500ms）— 更高安全性，但注册耗时明显

**结论**：选择 B。150ms 的哈希时间在注册场景中可接受，同时提供足够的安全强度。

### 7.2 经验值使用 EventEmitter 而非消息队列

**背景**：经验值事件（生成插件、发布作品等）的传递方式。

**选项**：

- A: 使用 Bull 消息队列 — 解耦彻底，但对 MVP 阶段过于重量级
- B: 使用 NestJS EventEmitter（`@nestjs/event-emitter`）— 进程内事件，无额外基础设施依赖

**结论**：选择 B。MVP 阶段使用进程内事件总线足够，后续如果扩展到分布式部署再考虑迁移到消息队列。

### 7.3 每日配额使用 Redis 而非数据库

**背景**：每日 20 次配额的计算方式。

**选项**：

- A: PostgreSQL 字段 + cron 每天重置 — 需要额外定时任务，复杂
- B: Redis TTL 计数器 — `INCR` + `EXPIRE 86400`，零维护成本

**结论**：选择 B。Redis TTL 自动过期完美满足"每天 0 点重置"的需求，且性能远高于数据库操作。

---

## 8. 安全考量

**密码存储**：bcrypt 哈希 + salt rounds=10，数据库 `password` 字段永不暴露到 API 响应中（`sanitize()` 排除）。→ AC-202

**邮箱枚举防护**：登录失败时统一返回 `"Invalid email or password"`，不区分是邮箱不存在还是密码错误。→ AC-105, AC-106

**JWT 安全**：有效期 7 天，Secret 通过环境变量注入，生产环境必须使用强随机字符串（≥32 字符）。→ AC-203

**防暴力破解**：注册时 bcrypt 哈希天然慢速（~150ms），登录同理。额外可在 Nginx 层配置 IP 限流（`limit_req_zone`）。

**资料所有权**：`PATCH /user/profile` 从 JWT 中提取 `userId`，与目标资源的所有者比对，不允许跨用户操作。→ AC-204

---

## 9. AC 覆盖总表

| AC 编号 | 验收标准概述                               | 实现位置                                        |
| ------- | ------------------------------------------ | ----------------------------------------------- |
| AC-001  | 注册成功 → 自动登录 → 跳转工作台           | 5.1 AuthService.register + 5.6 useAuth.register |
| AC-002  | 登录成功 → 跳转工作台                      | 5.2 LocalStrategy + 5.6 useAuth.login           |
| AC-003  | 密码输入显示为圆点                         | 前端 Register.tsx input type=password           |
| AC-004  | 登录后 JWT 存储在本地                      | 5.6 auth-store setAuth + localStorage 持久化    |
| AC-005  | 导航栏显示昵称+等级+配额                   | 6 TopNav 用户态渲染                             |
| AC-006  | 已登录可访问受保护页面                     | 5.7 RequireAuth 组件                            |
| AC-007  | 注册后数据库存储正确                       | 5.1 prisma.user.create                          |
| AC-008  | 用户修改资料成功                           | 4.4 PATCH /user/profile                         |
| AC-009  | 导航栏下拉菜单含三选项                     | 6 TopNav DropdownMenu 组件                      |
| AC-010  | 登出清除 Token 跳转首页                    | 5.6 useAuth.logout                              |
| AC-101  | 邮箱重复 → 409                             | 5.1 ConflictException                           |
| AC-102  | 密码强度不足 → 前端阻止                    | 4.1 自定义 @Matches validator                   |
| AC-103  | 昵称不符合要求 → 前端阻止                  | 4.1 DTO @Length(2,20)                           |
| AC-104  | 两次密码不一致 → 前端阻止                  | 前端 Register.tsx 内联校验                      |
| AC-105  | 登录邮箱不存在 → 401                       | 5.2 LocalStrategy 统一错误信息                  |
| AC-106  | 登录密码错误 → 401                         | 5.2 bcrypt.compare 失败                         |
| AC-107  | 超过每日配额 → 429                         | 5.5 Redis TTL quota check                       |
| AC-108  | 未登录访问受保护页 → 跳转 /login?redirect= | 5.7 RequireAuth 组件                            |
| AC-201  | 邮箱大小写不敏感                           | 5.1 email.toLowerCase().trim()                  |
| AC-202  | 密码 bcrypt 哈希存储                       | 5.1 bcrypt.hash(saltRounds=10)                  |
| AC-203  | Token 过期行为                             | 5.3 expiresIn: '7d' + phase1.2 JwtAuthGuard     |
| AC-204  | 用户只能修改自己资料                       | 4.4 PATCH 从 JWT 取 userId 比对                 |
| AC-205  | 经验值计算准确                             | 5.4 UserLevelService.addExp + 等级公式          |

---

## 附录：变更记录

| 日期       | 变更内容 | 原因 |
| ---------- | -------- | ---- |
| 2026-06-18 | 初始版本 | —    |
