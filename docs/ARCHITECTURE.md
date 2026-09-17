# 架构、协议与行为契约

本文描述稳定基线的实际实现，不是待实施方案。先读 [README](../README.md)；版本事实与未验证项见 [HANDOFF](HANDOFF.md)。

## 1. 系统与目录

```text
浏览器 React
  ├─ HTTP /api/*：身份、房间、回合命令、词包
  └─ WebSocket /ws：房间状态、大厅、笔画增量、恢复快照
            ↓ 同源（本地 Vite 代理 / 生产 Caddy）
Express createApp + ws attachRealtime
            ↓
GameStore：内存身份 / 房间 / 计时器 / 积分 / 画布
SQLite：word_packs + words，WAL，外键级联删除
```

| 模块 | 责任 |
|---|---|
| `server/src/index.js` | HTTP / WS 装配、监听、信号关闭；退出前清理连接、计时器和数据库 |
| `createApp.js` | Express 中间件、验证、鉴权、路由、HTTP 错误映射 |
| `gameStore.js` | 全部游戏规则和角色可见性；不知道浏览器控件 |
| `realtime.js` | 升级连接、消息校验 / 限流、广播、socket 画布游标、心跳 |
| `validators.js` / `security.js` | schema、来源、限流、管理员检查 |
| `config.js` | 启动环境；导入时读取，Node 不自动加载 `.env` |
| `db.js` / `backup.js` | 词库 SQL / 事务 / 初始种子 / 在线备份 |
| `client/src/App.jsx` | 登录、大厅 / 房间切换、API 动作、局部错误与弹窗入口 |
| `hooks/useGameConnection.js` | bootstrap、WS 生命周期、revision 合并、重连 / 过期反馈 |
| `canvasState.js` | 纯函数合并房间状态和画布事件，缺口抛出 desync |
| `components/CanvasBoard.jsx` | 输入采样、本地笔迹、离屏缓存、分块发送、撤销同步等待 |
| `components/GameRoom.jsx` | 角色、回合、消息回显、提示与画布组织 |
| `GuessComposer` / `GuessFeed` | IME、输入 / 失败草稿、单条裁定、消息滚动与本地确认 |
| `Lobby` / `PackDialogs` | 建房 / 加入 / 词包选择、投稿和审核 |
| `components/ui/` | 按需 Radix 基础交互与主题样式，授权必须保留 |

只有 npm workspaces，没有单独客户端 / 服务端 lockfile。精确版本在根 `package-lock.json`。无 TypeScript、状态管理库、前端路由框架、Redis、消息队列或 Docker 依赖。

## 2. 数据与生命周期

### 身份与房间

- `sessions: Map<token, {playerId, roomCode, sockets}>`；昵称在线唯一，冲突时加随机后缀。客户端将 `{id, token}` 存在 localStorage 的 `draw-guess-session`。
- 创建身份先启动 60 秒宽限计时，成功绑定 WS 取消计时；最后一个 socket 关闭才再次计时。最多 100 个身份，每身份最多 4 个 socket。
- 一个身份只加入一个房间。房间码 5 位，避开容易混淆的字符；每房间最多 10 人。
- 房主离开后第一位剩余玩家继任；空房删除。显式离开 / 注销立即处理，普通断线等待宽限；刷新不能主动调用注销接口。
- 内存和 SQLite 分离。身份、房间、画布、消息、积分重启后消失；词包保留。历史数据库可能还有未使用的 players 表，不在清理任务中直接删除。

### 词库

- 表 `word_packs` 保存元信息和 pending / approved 状态；`words` 引用 pack_id，启用外键与 WAL。
- 创建词包使用事务，名称全局唯一；词包标题、词语等有长度 / 字符约束，描述为普通文本。
- 普通列表仅返回 approved 元信息与 wordCount；不下发完整词表。管理列表有待审核内容和词表，必须临时身份 + 管理密钥。
- 建房解析选中 approved 词包并保留当时词表；未选默认取前两个 approved 包。空词池回退「流星」。后续词包审核 / 删除不会重写已建房间的词池。

## 3. 回合状态机与规则

```text
waiting / finished
  └─ 房主 start → library: active
                  host-judged: collecting-word → 出题者 submitPrompt → active
active / collecting-word
  └─ 猜中、接受裁定、超时、房主 skip、关键玩家离开 → finished
finished ── 房主下一次 start → 新 roundId、清空画布
```

- 词库局至少 2 人；裁定局至少 3 人，出题者与画师不同且均不能猜。词库局画师不能猜。
- 角色选择优先历史担任次数少的人，并对最近 3 次角色名单中的人加 3 分惩罚；在最低候选分内随机。不是严格轮流，也不是无记忆的纯随机。
- 出题 30 秒、作画 100 秒。服务器存 endsAt 并设定时器，每次访问成员 / 回合也检查过期，防止定时器稍晚执行时接受超时答案。客户端倒计时只展示，不决定胜负。
- `normalizeText` 去首尾并将连续空白变成一个空格，`canonicalWord` 再转小写；不移除词语内部全部空格。
- `submitGuess` 创建服务端 guessId。library 命中即结束；host-judged 标为 pending，出题者按 guessId 接受 / 拒绝。待裁定上限 100。
- 第一位获胜者 +2，画师 / 出题者各 +1。结束记录 scoreChanges 和 winnerIds；无获胜者时不加分。仍 pending 的答案转 closed。
- 画师 / 出题者离开，或人数低于该模式最低要求，结束本轮；不清掉已经完成的画作。下一轮需房主手动开始。
- 消息保留约最近 200 条，修剪时不删除 pending。新回合不会主动清掉消息历史。
- `clientGuessId` 是客户端 UUID，可选；同玩家、同回合且消息仍保留时重复提交返回原状态。必须先验证成员 / roundId；猜中后重试也不能重复加分。不承诺跨重启和无限历史幂等。

### 谜底权限

序列化必须按 viewerId 生成：进行中仅画师 / 出题者看 word，猜词者 word 为 null；结束后公开。`maskWord` 按 Unicode 码点计数；单字符只显示 `·`，多字符保留首字符和其余掩码。罕见汉字也不能被 UTF-16 下标拆坏。这个过滤属于服务器，HTTP 和 WS 都必须遵守。

## 4. HTTP 契约

除 health / 创建或删除 session 的专用处理外，API 要求 `Authorization: Bearer <token>`。删除 session 自身检查 token 存在，失效 token 的删除仍幂等返回 204。

| 方法 / 路径 | 输入与效果 |
|---|---|
| GET `/api/health` | 健康状态，不表示完整玩家流程已通过 |
| POST `/api/session` | 可选 preferredId；返回 201 与 player |
| DELETE `/api/session` | 注销本人，离开房间并关闭自身 socket |
| GET `/api/bootstrap` | player、lobby、packs、room 完整快照、模式说明 |
| GET `/api/lobby`、`/api/packs` | 大厅或公开词包元信息 |
| POST `/api/rooms` | name、mode、packIds；建房并加入 |
| POST `/api/rooms/join`、`/api/rooms/leave` | 加入 / 离开；返回完整状态用于导航 |
| POST `/api/rounds/start`、`/skip` | roomCode、roundId，只有房主 |
| POST `/api/rounds/prompt` | roomCode、roundId、word，只有本轮出题者 |
| POST `/api/rounds/guess` | roomCode、roundId、guess、可选 clientGuessId |
| POST `/api/rounds/judge` | roomCode、roundId、guessId、accepted |
| POST `/api/packs` | name、description、words，投稿为 pending |
| GET `/api/admin/packs` | 所有词包及词表 |
| POST `/api/admin/packs/:id/approve` | 发布审核 |
| DELETE `/api/admin/packs/:id` | 删除 / 拒绝词包及其词表 |

回合命令加 `?compact=1` 后成功返回 **204、无 body**；权威状态走 WS。未协商的旧客户端仍收到完整 room。其他 JSON 响应包含全局 revision。不要改为带 revision 的小 ACK 后直接交给状态合并器：HTTP 比 WS 先到可能跳过尚未应用的笔画。

错误是 `{error, revision}` JSON：未鉴权 401、来源 / 管理权限 403、部分游戏非法状态 400、词包重复名称 409、限流 429；未知内部错误不向客户端泄露堆栈。UI 用 `errors.js` 转换可读文本，新增错误码要一起维护。

## 5. WebSocket 与画布一致性

### 四个顺序标识

| 字段 | 作用 |
|---|---|
| `revision` | 整个 GameStore 的状态修订，用于避免较旧 HTTP 快照覆盖新 WS 状态 |
| `roundId` | 回合身份，旧回合命令不能作用于下一轮 |
| `canvasEpoch` / 事件 `epoch` | 画布被整体重置的代次；开局、撤销、清空递增 |
| `canvasVersion` / 事件 `version` | 房间画布每次修改递增；增量必须连续 |

stroke id 标识整笔，offset 是已接收点数；猜词 ID 与这些字段无关，不能互相替代。

连接 `/ws?token=<token>&compact=1`：先发 connected（身份、大厅、revision），再发 room:update。服务器发送事件：

- `room:update`：room 或 null；角色过滤后的房间元数据，可带完整 canvas。
- `lobby:update`：未在房间的身份接收大厅变化。
- `canvas:stroke`：roomCode、roundId、epoch、version、stroke、revision。
- `canvas:snapshot`：完整 canvas、同组顺序字段；撤销 / 清空 / 纠错使用。
- `error`：错误码；业务绘图异常通常附恢复快照，schema 未通过则直接拒绝。

客户端只向 WS 发送 `canvas:stroke`、`canvas:clear`、`canvas:undo`；其他操作走 HTTP。stroke 含 id、offset、tool（pen / eraser）、color、width、points。坐标逻辑尺寸 960×620，颜色为 hex，笔宽 1–24；单消息 schema 最多 512 点，前端实际每批最多 128 点。

### 紧凑状态

每个 socket 独立记录已经发送的 roomCode / roundId / epoch / version；完全匹配时 room:update 省略 canvas。省略不等于空画布：客户端保留原数组引用。任何不匹配都发完整画布；重连 socket 不继承旧连接游标。旧客户端未传 compact 参数时一律完整。

客户端合并增量要求：房间和回合相符，版本更新，epoch 匹配、version 连续、offset 正确；旧事件忽略，缺口触发断线 / bootstrap 恢复。快照可替换画布；canvasResetKey 使本地绘图缓存与等待状态恢复。

### 绘图与恢复

- 画师本地先画，不等网络；离屏 canvas 保存已确认部分，叠加本地未确认尾部，RAF 合并绘制，DPR 最多 2。
- 落笔立即发送，移动每 25 ms 批发，抬笔 / 取消立即 flush。40 Hz 是常规持续笔画，不代表所有点击模式严格限制到 40 条。
- 撤销 / 清空先结束当前笔，等待服务器 epoch 快照再接收新笔；发送失败、权限丢失、换回合或恢复快照解除等待。
- useGameConnection 先 HTTP bootstrap，再开 WS；断线按 800 ms 指数退避，最高 5 秒。401 / WS 4001 表示身份失效，不无限重试旧 token。
- 服务器心跳周期 30 秒，消息上限 64 KiB / 每 socket 每秒 60 条，发送积压超过 4 MiB 时断开；服务器 ws 已禁用 Nagle，不要重复把 setNoDelay 当作待做优化。
- 房间元数据仍是整份元数据（包括保留消息），不是通用 JSON patch；当前不引入二进制压缩、CRDT 或复杂命令总线。

## 6. 前端交互与样式

- App 导航 busy 与 GameRoom 内动作分离。GuessComposer 的 in-flight 防重复但不禁止编辑下一条；IME 期间 Enter 不提交。
- GameRoom 保存本地 sending / confirming / failed 回显。WS 的 clientGuessId 确认替换回显；HTTP 先失败、WS 后成功要消除旧错误。自动恢复的失败草稿仅在用户未再次编辑时清掉。
- 猜词者、画师、出题者各显示相关操作；裁定局逐条 pending，不能按数组最后一项裁定。
- 消息区在底部自动跟随；用户上翻时不抢滚动，通过“新消息”返回。清空、提前结束和活跃对局离开有确认。
- 投稿草稿在页面内存，关闭弹窗保留、刷新 / 退出清除；管理密钥只在审核弹窗内存，不进 localStorage。
- `styles.css` 旧样式置于 legacy 层；`ui.css`、`game-ui.css`、`lobby-ui.css` 定义共享件和场景。保留层级，避免全局 button / input 覆盖 Radix 状态。
- 大厅、游戏、投稿按需加载；画具 Radix 模块与登录首屏隔离。基线首屏 JS 约 111.58 kB gzip（构建估计），120 kB 是继续观察的预算，不是下载耗时。
- `/__ui`、`/__game` 为开发专用真实组件样板；不应进生产构建。可维护，但不能代替真实多人 / 真机验证。

## 7. 安全与测试边界

HTTP 全局按 req.ip 每 15 秒 120 次，body 最大 256 KiB；`TRUST_PROXY=loopback` 只用于本机 Caddy。带 Origin 的请求必须精确匹配，CLI 无 Origin 允许但仍需身份。管理接口多一层 x-admin-key；空 ADMIN_KEY 表示关闭审核。

服务端 Vitest 强制 `DATABASE_PATH=:memory:` 与测试专用管理密钥；负载脚本无 URL 时自行建隔离服务。不要在动态 import 数据库后才设置环境变量。运行中的 SQLite 使用 backup API；不能把复制主 db 或删 WAL 当备份。

单进程是容量和运维选择，不是缺陷待重构清单；要水平扩展需重新设计状态、身份路由和广播。持久化对局、认证账号、完整滥用防护也应作为独立需求讨论。
