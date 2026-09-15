# InkMuse Draw & Guess

一个全栈实时你画我猜项目，包含炫酷但简洁的大厅与房间界面、实时同步画布、两种回合模式、可投稿审核的词库系统，以及基于临时 ID 的轻量登录机制。

## 项目特性

- 临时身份登录：玩家可使用临时 ID 登录，服务端保证不与当前在线 ID 冲突。
- 自动清理会话：主动注销立即删除内存会话；最后一个标签页断线后保留 60 秒，允许刷新或短暂断网恢复。
- 房间大厅：支持创建房间、展示大厅房间列表、按房间码加入房间。
- 两种玩法：
  - `host-judged`：系统随机一人给词、一人作画，其余玩家猜词，由给词者判定答案是否正确。
  - `library`：从已审核词库随机抽词，一人作画，其余玩家猜词，标准答案命中后自动结束本轮。
- 防止高频重复随机：服务端按历史角色分配次数和最近回合记录做加权，尽量避免同一玩家连续高频成为画师或出题者。
- 实时画布：房间内所有玩家可同步看到作画过程。
- 词库系统：玩家可提交自定义词库，管理员可审核发布与删除。
- 基础安全：`helmet`、CORS 限制、来源校验、请求速率限制、输入校验与显式配置的管理员密钥机制。

## 技术栈

- 前端：React 19 + Vite
- 后端：Express + WebSocket (`ws`)
- 数据库：SQLite (`better-sqlite3`)
- 校验与测试：Zod + Vitest + Supertest

## 目录结构

```text
.
├─ client/            # React 前端
├─ server/            # Express + WebSocket 服务端
├─ package.json       # workspace 根配置
└─ README.md
```

## 本地运行

### 1. 安装依赖

```powershell
npm install
```

### 2. 启动服务端

```powershell
npm run dev --workspace server
```

服务端默认运行在 `http://localhost:3001`。

### 3. 启动前端

另开一个终端：

```powershell
npm run dev --workspace client
```

前端默认运行在 `http://localhost:5173`，并通过 Vite 代理访问 `/api` 与 `/ws`。

## 环境变量

可在启动前设置：

```powershell
$env:PORT='3001'
$env:CLIENT_ORIGIN='http://localhost:5173'
$env:ADMIN_KEY='local-admin-key'
```

含义：

- `PORT`：后端端口
- `CLIENT_ORIGIN`：允许访问 API 的前端来源
- `ADMIN_KEY`：管理员审核词库使用的密钥

## 管理员词库审核

管理员接口要求请求头：

```text
x-admin-key: local-admin-key
```

相关接口：

- `GET /api/admin/packs`：查看全部词库，包括待审核词库
- `POST /api/admin/packs/:packId/approve`：审核通过
- `DELETE /api/admin/packs/:packId`：删除词库

## 已实现的核心行为

### 登录与在线唯一 ID

- `POST /api/session` 创建临时玩家
- 服务端检查当前内存会话的 ID，若冲突则自动追加随机尾缀

### 账户清理

- `DELETE /api/session` 主动注销时删除内存会话并退出房间
- 最后一个标签页断线 60 秒后清理会话并退出房间；服务重启后需重新登录

### 房间与回合

- 创建房间、加入房间、离开房间
- 主持人启动新回合
- 自定义给词模式中，由给词者提交词语并裁定猜测
- 词库模式中，标准答案命中即结束本轮

### 实时绘制

- 当前画师通过 WebSocket 发送笔迹
- 房间内所有成员实时收到画布状态更新
- 支持清空画布

## 测试与构建

运行测试：

```powershell
npm test
```

构建前端：

```powershell
npm run build
```

本项目已在本机完成以下验证：

- `npm test`
- `npm run build`

## 当前实现说明

- 房间与回合状态当前保存在服务端内存中，适合本地开发与单实例部署。
- 临时会话与房间保存在内存中，词库存储在 SQLite 中。
- 管理员系统目前是简易密钥方案，适合原型阶段，后续可以升级为完整后台认证。
- 当前未加入图片回放、撤销重做、断线重连恢复和更细的权限审计，这些适合作为下一阶段增强项。

## 可靠性与安全约定（第一批修复）

- 一个身份最多加入一个房间；同房间重复加入幂等，跨房间需先离开。
- 词库局至少 2 人，裁定局至少 3 人；等待/结算阶段才可开始下一轮。
- 回合操作携带 roundId，裁定使用唯一 guessId，防止并发答案或旧请求误作用。
- 会话以服务端内存为准，同身份支持最多 4 个标签页；最后一个连接断开后保留 60 秒。刷新可恢复，进程重启后旧 token 返回 401。
- WebSocket 校验来源、会话、消息结构和坐标，限制单消息 64 KiB、每连接每秒 60 条，并进行心跳和异常清理。只有 active 阶段的画师可修改画布。
- ADMIN_KEY 无默认值，未配置时管理员接口禁用。管理员调用仍需临时会话 Bearer token 和 x-admin-key；普通词包投稿不会获得其他人的待审核内容。
- 服务端 Vitest 强制使用独立内存数据库，测试不再读写默认运行数据库。
