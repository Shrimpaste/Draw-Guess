# VPS 部署与运维

## 当前部署（2026-09-17）

- 入口：[https://170.106.190.20](https://170.106.190.20)。HTTP 自动跳转 HTTPS；公网可信证书已验证。
- 当前发布：`87835b6`；上一版 `2ca8c70` 保留供回滚。后续文档 / 合并提交不改变运行代码；对应代码已推送 GitHub main。
- Let's Encrypt YE2 签发 IP 证书，当前到期时间 2026-09-22 06:20:26 UTC；Caddy 已配置自动续期，首次续期尚未发生。
- 管理密钥是服务器上独立生成的随机值，仅在 `/etc/draw-guess.env` 的 `ADMIN_KEY` 中，使用 SSH + sudo 获取；不在仓库或本地凭据文件中。管理员先正常登录大厅，再打开词包审核。
- 每日备份已自动运行成功，备份位于 `/var/lib/draw-guess/backups/`。目前备份保存在同一 VPS，尚无异机备份。
- Windows / Debian 均 56 项测试通过。最新 VPS 隔离十人验证：200 分块 / 3200 点 / 一次重连 / 0 错误，P95 1.58 ms；公网单字提示两轮验证通过。历史公网延迟数据保留在下方记录及 progress.md，不作为本次更新的性能测量。
- 当前为单实例朋友试玩版本：重启会结束房间，词库持久保存。实际手机硬件触摸、跨运营商延迟和完整灾难恢复演练尚未验证。

## 架构与路径

Node.js 24 + Caddy 2.11.4。HTTPS 443 提供静态前端，`/api/*` 与 `/ws` 反代至 `127.0.0.1:3001`。80 用于证书验证与 HTTPS 跳转。单 Node 实例，房间在内存中。

- `/srv/draw-guess/releases/<commit>/`：版本源码、Linux node_modules、client/dist。
- `/srv/draw-guess/current`：当前版本符号链接。
- `/var/lib/draw-guess/app.db`：持久词库；backups 子目录存每日备份。
- `/var/lib/draw-guess-proxy/`：证书和续期状态，必须持久保留。
- `/etc/draw-guess.env` / `/etc/draw-guess-proxy.env`：权限 600 的配置文件。
- `draw-guess.service`、`draw-guess-proxy.service`、`draw-guess-backup.timer`：独立服务。

## 无自有域名

推荐公网 IPv4 直接 HTTPS。配置显式使用 Let's Encrypt `shortlived` profile，证书约 160 小时有效，由常驻 Caddy 自动续期。保留显式 ACME issuer；默认 IP 自签证书不能用于朋友直接访问。

备选 `170-106-190-20.sslip.io` 或 `170-106-190-20.nip.io`，解析到对应 IP，无需注册。这是第三方公共 DNS 下的地址，不属于你；长期建议自有域名。切换地址同时修改 SITE_ADDRESS 与 CLIENT_ORIGIN。

参考：[IP 证书](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)、[Caddy TLS](https://caddyserver.com/docs/caddyfile/directives/tls)、[nip.io / sslip.io](https://nip.io/)。

## 首次安装

1. 检查已用端口、现有站点与云防火墙；允许 TCP 80/443，后端只监听本机。
2. 将 Node 24 的真实可执行文件放到 `/opt/draw-guess/bin/node`，避免服务的 ProtectHome 与 nvm 路径冲突；安装官方 Caddy 2.11.4；用官方 release checksums 的 SHA-512 校验下载包，将二进制放到 `/opt/draw-guess/bin/caddy`。
3. 创建无登录用户 draw-guess、draw-guess-proxy。代码归 root，词库目录归 draw-guess，证书目录归 draw-guess-proxy。
4. 上传已审查提交到版本目录，在 Linux 上执行 npm ci、npm test、npm run build、npm run test:load。不要上传 Windows node_modules。
5. 将 deploy 中 units 复制到 `/etc/systemd/system/`，Caddyfile 到 `/etc/draw-guess.Caddyfile`，.env.example 到 `/etc/draw-guess.env`。设置 `CLIENT_ORIGIN=https://170.106.190.20`；代理 env 为 `SITE_ADDRESS=170.106.190.20`。ADMIN_KEY 留空关闭审核，启用时用独立随机值，不能复用 sudo 密码。
6. 使用 `caddy validate --config /etc/draw-guess.Caddyfile --adapter caddyfile`（注入 SITE_ADDRESS）和 `systemd-analyze verify` 检查配置。
7. 建立 current 链接；运行 `systemctl daemon-reload` 和 `systemctl enable --now draw-guess draw-guess-proxy draw-guess-backup.timer`。
8. 外网用正常证书校验访问 HTTPS 与 `/api/health`，执行 `npm run test:load -- https://170.106.190.20`，浏览器验证开局、绘画与猜词。

## 更新与回滚

新提交放入新目录并验证。记录 current 的旧目标，游戏空闲时创建 `/srv/draw-guess/next` 新链接，再用 `mv -Tf /srv/draw-guess/next /srv/draw-guess/current` 原子切换，重启 draw-guess 并验证健康接口。失败则同样切回旧版本。当前没有破坏性词库迁移，回滚程序无需回滚词库。

重启会结束内存房间；SIGTERM / SIGINT 会清理连接、计时器与数据库。代理无需随应用更新重启。

## 备份与恢复

每日 timer 调用 SQLite 在线 backup API，兼容 WAL 并检查完整性。手动触发 `sudo systemctl start draw-guess-backup.service`。建议保留近 30 天，定期复制到另一设备；当前不自动删除备份。

恢复前停止 draw-guess。将 app.db、app.db-wal、app.db-shm（若存在）一起移到新建的带时间戳保留目录；将选定备份复制为 app.db，恢复 draw-guess 所有权和 600 权限再启动。**不要覆盖运行中的数据库或保留旧 WAL。** 核对词包无误前保留旧文件。

## 检查

```sh
systemctl status draw-guess draw-guess-proxy --no-pager
journalctl -u draw-guess -u draw-guess-proxy -n 80 --no-pager
systemctl list-timers draw-guess-backup.timer
curl --fail https://170.106.190.20/api/health
openssl s_client -connect 170.106.190.20:443 -servername 170.106.190.20 </dev/null 2>/dev/null | openssl x509 -noout -dates
```

IP 证书期限短，确保代理常驻、证书目录可写、80/443 验证连接可达；关注到期与续期失败。

## UI 版本部署（2026-09-16）

2ca8c70 已完成 Debian 全新安装、50 项测试、构建和隔离十人验证：200 分块 / 3200 点 / 1 次重连 / 0 错误，P95 1.53 ms。确认线上没有房间后切换，健康检查及公网上线登录 / WebSocket 成功，自动重启次数 0。保留 9a858c6 回滚。后续单字提示修复将在下一条发布记录更新当前版本。

## 单字提示修复部署（2026-09-17）

当前线上 release：`87835b6`，路径 `/srv/draw-guess/releases/87835b6`。Debian 全新安装、56 项测试、构建和隔离十人测试全部通过；200 分块 / 3200 点 / 1 次重连 / 0 错误，P95 1.58 ms。确认无房间后切换，应用与代理健康。保留上一版 `2ca8c70` 和更早 `9a858c6`。

公网三人裁定局分别使用「山」和「𠮷」：猜词者 HTTP / WebSocket 的 word 为 null，maskedWord 为「·」；画师知情及最终公布答案正常，测试身份已清理。当前浏览器工具未连接，新增单字修复使用真实公网 HTTP / WS 验证；UI 浏览器验收沿用上一版记录。
