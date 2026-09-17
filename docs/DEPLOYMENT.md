# VPS 运维手册

本文件描述运维机制；**当前稳定代码 / 标签 / 回滚候选以 [HANDOFF](HANDOFF.md) 为唯一版本索引**。不要将历史报告里的 release 名称当作实时服务器状态。

## 1. 架构与访问

- 入口：https://170.106.190.20；本机已配置 SSH：`ssh codex@170.106.190.20`。
- 基线环境：Debian 12、4 GB、Node 24、Caddy 2.11.4。后续维护先查实际版本，不根据此记录自动降级。
- Caddy 提供 80 → HTTPS 跳转和 443；静态文件取 current/client/dist，`/api/*`、`/ws` 反代到 `127.0.0.1:3001`。
- 单实例 GameStore，不支持无损热切换；应用重启结束所有内存对局 / 身份。数据库词库保留。
- 同机已有其他服务，不能占用 / 清理它们的端口、目录或 systemd units。部署只触及下列项目专属路径。

| 路径 / 服务 | 用途 |
|---|---|
| `/srv/draw-guess/releases/<commit>/` | 只读版本源码、Linux node_modules、client/dist |
| `/srv/draw-guess/current` | 当前版本软链接；原子切换 |
| `/home/codex/draw-guess-staging/<commit>/` | 上传、安装和验证区；成功验证后复制到 releases |
| `/var/lib/draw-guess/app.db` | 持久词包 SQLite |
| `/var/lib/draw-guess/backups/` | 在线备份文件 |
| `/etc/draw-guess.env` | 后端配置，600 权限；包含独立 ADMIN_KEY |
| `/etc/draw-guess-proxy.env` | SITE_ADDRESS 配置，600 权限 |
| `/etc/draw-guess.Caddyfile` | 当前代理配置，模板在仓库 deploy/ |
| `/var/lib/draw-guess-proxy/` | 证书与 ACME 状态，必须保留 |
| `/opt/draw-guess/bin/node`、`caddy` | systemd 使用的真实二进制路径，不依赖用户 nvm |
| `draw-guess.service` | 应用，运行用户 draw-guess |
| `draw-guess-proxy.service` | HTTPS，运行用户 draw-guess-proxy |
| `draw-guess-backup.service` / `.timer` | SQLite 在线备份，服务器时区 03:30 + 最多 15 分钟随机延迟 |

代码归 root，运行服务只能写各自 state 目录；ProtectHome / ProtectSystem / NoNewPrivileges 等配置在 deploy units。不要为解决路径问题直接关闭隔离。

## 2. 凭据与配置

后端示例见 [deploy/.env.example](../deploy/.env.example)。生产使用精确 `CLIENT_ORIGIN=https://170.106.190.20`、`TRUST_PROXY=loopback`、loopback 监听和持久 DB 路径。代理 SITE_ADDRESS 为该 IP。

管理员先正常登录大厅，再打开词包审核。ADMIN_KEY 是服务端独立随机值，空值关闭审核；不是 sudo 密码。需要密钥时通过授权的 SSH / sudo 渠道私下获取，不在会话、命令日志或公开交接文档中打印。sudo 凭据由操作者安全提供；仓库不保存密码，也不依赖某台开发机的个人密钥文件路径。

Node 默认不自动读 `.env`；systemd 通过 EnvironmentFile 注入。本地联调环境变量必须在启动 / import config 前设置。

## 3. 无域名 HTTPS

当前使用 Let's Encrypt 公网 IP 短周期证书，Caddy 的 ACME issuer 明确配置 `shortlived` profile。不是自签证书，不需要用户绕过浏览器安全警告。证书由运行服务自动续期，80 / 443 与证书 state 目录需可用；不要把旧的到期时间抄成当前结论。

检查（以下运维命令在远端 Linux 执行）：

```sh
curl --fail https://170.106.190.20/api/health
openssl s_client -connect 170.106.190.20:443 -servername 170.106.190.20 </dev/null 2>/dev/null | openssl x509 -noout -dates -issuer
sudo journalctl -u draw-guess-proxy -n 80 --no-pager
```

若未来使用域名，另行验证 DNS、证书与 CLIENT_ORIGIN，不要混用 IP / 域名来源。免费公共 DNS 地址不等于自有域名；当前版本不依赖它们。

## 4. 发布准备

1. 按 [维护规范](MAINTENANCE.md) 完成本地分支、审查、测试 / 构建，记录不可变提交 ID。
2. 确认此次任务授权包含部署及可能的短暂停机。已有明确授权不重复问；但不能把普通 feature 修改理解为可以随时终止玩家对局。
3. 从干净提交 `git archive --format=tar --output=<archive-path> <commit>`；用 scp 上传 staging。不要打包工作区的 .env、DB、缓存、node_modules 或未提交代码。
4. 在新的、尚不存在的 staging/<commit> 解包。确认 Node 24 / npm PATH；执行 `sh deploy/verify-release.sh`。它会 npm ci、67 项基线对应测试（未来数量可变）、build、隔离十人测试，并写 validation.exit。
5. 需要 SSH 断开后继续验证时，在 staging 目录用 `nohup sh deploy/verify-release.sh > validation.log 2>&1 < /dev/null &`。之后必须读取 validation.exit 为 0，并审查日志。不能仅凭目录存在就上线。
6. 依赖原生二进制必须在 Linux 安装。新的 release 归 root；不修改 / 覆盖旧 release。

本次清理已将一次性 release / sudo helper 从原工作位置移至可恢复隔离目录（见 HANDOFF）；可复用验证入口是仓库 `deploy/verify-release.sh`，不用寻找旧临时文件。

### 空闲检查

先通过真实 API 创建一个临时检查身份，带 Bearer 请求 `/api/bootstrap` 检查 lobby，最后在 finally 调用 DELETE `/api/session` 删除检查身份。lobby 非空则推迟重启，不能为了发布主动删除其他房间。健康接口不提供房间列表；检查日志中不要输出 token。允许使用小型一次性脚本，但用后清理。

这不是跨进程锁；从检查到切换应尽量短。对有连续玩家的场景，先安排维护窗口，不能宣称当前机制零停机。

## 5. 切换与回滚

以下是**远端 sudo shell** 内的操作模板，release 必须替换为已经验证的实际十六进制 commit；执行前核对目标和无活动房间。不是让 agent 看到文档就自动执行：

```sh
set -eu
release=REPLACE_WITH_VERIFIED_COMMIT
case "$release" in ""|*[!0-9a-f]*) echo "Invalid release"; exit 1;; esac
source=/home/codex/draw-guess-staging/$release
target=/srv/draw-guess/releases/$release
test "$(cat "$source/validation.exit")" = 0
test ! -e "$target"
test ! -e /srv/draw-guess/next
test ! -L /srv/draw-guess/next
previous=$(readlink -f /srv/draw-guess/current)
case "$previous" in /srv/draw-guess/releases/*) ;; *) exit 1;; esac
cp -a "$source" "$target"
chown -R root:root "$target"
ln -s "$target" /srv/draw-guess/next
mv -Tf /srv/draw-guess/next /srv/draw-guess/current
systemctl restart draw-guess
```

记录 previous，给服务少量启动时间并重试本机 health；接着查服务状态、日志、公网 HTTPS、首页新资源与真实 WS。应用更新通常不需要重启代理。

若健康检查失败，使用同样的 next → current 原子切换回 previous，重启应用并再次验证。不要为了回滚删除新 release 或恢复旧词库。本基线没有破坏性数据库迁移；未来若有迁移，发布前必须单独设计兼容与回滚。

不要对固定名称 next 无条件 `rm -rf`。若发现已存在，先确认是上一次残留还是其他维护任务；查清归属再处理。

## 6. 备份与恢复

备份通过 `server/src/backup.js` 的 SQLite backup API，包含 WAL 中已提交内容；目标必须不存在，完成后做 integrity_check。手动触发：

```sh
sudo systemctl start draw-guess-backup.service
sudo journalctl -u draw-guess-backup -n 30 --no-pager
systemctl list-timers draw-guess-backup.timer --no-pager
```

基线已经验证实际备份产生且完整性检查通过；备份仍在同一 VPS，没有异机保护。保留策略建议按实际空间制定，当前任务不自动删除旧备份。

恢复流程：

1. 选定备份，在独立位置验证完整性和需要的词包；确认恢复会替换哪些新数据。
2. 安排维护窗口，停止 draw-guess。将当前 app.db 及存在的 app.db-wal / app.db-shm 一起移到新建的带时间戳保留目录；不要丢弃。
3. 将所选备份复制为 app.db，设置 draw-guess 所有权及 600 权限，确认不遗留旧 WAL / SHM。
4. 启动应用，检查数据库、词包、接口和权限，确认后再考虑旧文件的保留期限。

禁止在运行中只复制 app.db 作为一致性备份，禁止覆盖运行数据库。生产完整灾难恢复尚未演练；测试备份成功不等于灾难恢复流程已经实操通过。

## 7. 日常检查与排障

```sh
readlink -f /srv/draw-guess/current
systemctl status draw-guess draw-guess-proxy --no-pager
systemctl show draw-guess -p NRestarts -p MemoryCurrent
sudo journalctl -u draw-guess -n 80 --no-pager
systemctl list-timers draw-guess-backup.timer --no-pager
curl --fail http://127.0.0.1:3001/api/health
curl --fail https://170.106.190.20/api/health
```

| 症状 | 优先核对 |
|---|---|
| 静态可访问，登录失败 | 应用健康、/api 代理、CLIENT_ORIGIN、浏览器实际 Origin |
| HTTP 正常，WS 失败 | /ws 代理、token 是否重启失效、Origin、每身份 4 socket 限制 |
| 重连后要求登录 | 超过 60 秒或应用重启时属于既定行为；临时网络失败不应直接注销 |
| 画布不能继续画 | 是否等待 reset 快照；epoch / version / offset；服务端错误，而非先删保护逻辑 |
| 偶发 429 / WS 断开 | HTTP 120/15s 按 IP，WS 60/s、64 KiB、4 MiB 积压、心跳；排查快速重试和弱网 |
| 延迟明显 | 同时测 RTT、消息大小、应用 / 浏览器耗时；检查路径是否代理，不能仅升级 CPU |
| 证书告警 | 实际有效期、ACME 日志、80/443、state 目录权限；不要关闭 TLS 校验来“修好” |
| 管理接口 403 | 已登录身份、管理员密钥和来源；不要把 ADMIN_KEY 打印出来排查 |

## 8. 发布记录与清洁边界

发布后更新 HANDOFF 的版本身份及必要验收证据。GitHub Actions 只做 CI，不自动更新此 VPS；push 成功不等于部署成功。

保留 current 及至少一个确认可回滚的旧 release、数据库、备份和证书状态。删除 staging / 旧 release 需单独确认未被 current、回滚计划或进行中的验证引用；本次用户要求的本地工作区整理没有清理远端 release、词库或证书。
