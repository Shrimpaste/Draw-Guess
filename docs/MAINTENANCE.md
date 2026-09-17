# 开发、审查与维护规范

## 1. 开始新 feature

1. 按 [AGENTS](../AGENTS.md) 恢复上下文；读当前用户需求，区分新目标与历史证据。
2. `git status --short` 核对未提交修改；记录归属。`git fetch origin` 后检查主线差异，不强制覆盖本地内容。
3. 干净主线可 `git switch main`、`git pull --ff-only`，再 `git switch -c codex/<topic>` 或 `feature/<topic>`。多个会话使用不同 worktree；不要共享同一工作树互相覆盖。
4. 写明问题、预期行为、影响模块、验证方式及不做什么。复杂任务可有临时计划，完成后归入主文档。
5. 改动前阅读相关实现和相邻测试，先复现故障；涉及权限 / 同步时按架构文档列出不变量。

稳定标签 `stable-base-2026-09-17` 不移动、不覆盖。功能合并后 main 可以前进；修补稳定版本也创建新标签，不重写旧提交。恢复基线用新 worktree / checkout 标签，不在有工作时 reset --hard。

## 2. 编码与依赖

- 根目录 npm workspace、单个 lockfile；Node 24.x，使用 `npm ci` 重现。安装 / 升级依赖与锁文件一起提交，不混进文档清理。
- ES modules、JS / JSX、2 空格、分号、双引号，UTF-8；遵守 `.gitattributes`。无 lint 脚本，人工核对格式。
- 构件优先复用已有 `components/ui/` 和模式；基础交互保留 Radix 语义、键盘和焦点。不要用外观相同的 div 代替可访问控件。
- 保持服务器规则、传输边界、前端展示分层。新行为需同步 schema、错误提示、序列化、客户端合并及回归，不能只改一个按钮。
- 不因“更现代”迁移框架、语言或数据库；新增依赖需有明确收益，注意首屏按需加载和来源授权。
- 原生 SQLite 依赖在目标 OS 安装；不能将 Windows node_modules 上传 Linux。Node ABI / 安装问题先核对 Node 24、lockfile 和完整 npm ci。

## 3. 验证矩阵

| 改动 | 必做 |
|---|---|
| 规则 / 权限 / API / 计分 | 故障回归、服务端测试、全套测试、构建 |
| 协议 / 连接 / canvas 合并 | 版本缺口、旧回合、清空 / 撤销、重连、多标签、新旧协议；全套测试 + 十人脚本 |
| 猜词 / 弹窗 / 表单 | 慢请求、失败、IME、重复提交、旧响应、新草稿、迟到确认、焦点 / 滚动；组件测试 + 可用浏览器 |
| 视觉 / 响应式 | 桌面与 360/390 宽、短横屏、键盘、44px 主要触控目标；截图或短录像说明场景 |
| SQLite / 配置 / 部署 | 隔离 DB、备份、迁移 / 回滚说明、Linux 验证、服务健康与真实 WS |
| 仅文档 / 工作区清理 | 路径 / 链接 / 事实核对、diff、运行代码零差异；不为文字修改新增业务测试 |

常规代码合并前：

```sh
npm test
npm run build
git diff --check
```

同步相关追加 `npm run test:load`。基线测试 67 项；未来允许变化，但需解释删改测试的原因。不要以覆盖率或镜像实现的断言替代真实故障验证。

CI：Node 24 / Ubuntu，npm ci、全套测试、构建、十人隔离测试、生产依赖审计。镜像审计接口不支持时改用官方 registry，不将接口错误写成“0 漏洞”。依赖审计为时点结果，后续升级需重查。

### 测试数据隔离

- Vitest 服务端固定内存数据库；集成测试用随机本地端口并在 finally / afterEach 关闭 socket、server、store 计时器。
- 本地浏览器联调可在 PowerShell 先设 `$env:DATABASE_PATH = ":memory:"` 再启动 backend；bash 为 `DATABASE_PATH=:memory: npm run dev --workspace server`。不要误用生产配置。
- 公网冒烟会创建真实临时身份 / 专用房间，只在授权范围内小规模执行，finally 清理自己创建的身份；不进入或关闭别人的房间，不提交无关词包。
- 不关闭用户其他 node / SSH 进程；需要清理本次启动的进程时记录 PID 与命令，确认归属。

### 性能验证

```sh
node scripts/load-test.mjs --legacy
node scripts/load-test.mjs
node scripts/load-test.mjs --interval=25 --chunks=400 --points-per-chunk=8
```

默认 10 人、200 × 16 点、50 ms；`--clients=3` 可减规模。显式 URL 才访问部署服务。脚本报告消息字节、P50/P95、WS RTT、重连和最终画布 / 分数一致性。

相同点数与点率比较频率：50 ms / 200 × 16 对 25 ms / 400 × 8。固定其他变量，不同时在本机或同 VPS 运行构建干扰测量。一次公网 P95 不足以证明性能收益；RTT 变化、消息字节、渲染帧耗时要分别解释。负载脚本不测浏览器帧率 / 输入批次等待，桌面窄屏也不代表真机软键盘 / 触笔。

## 4. 审查与提交

每批按最终 diff 审查，而不是只回顾测试是否通过：

- 权限 / 答案可见性是否仍由服务端保证？
- 新请求是否带 roundId，异步返回是否可能覆盖新回合 / 新草稿？
- canvas 的省略与空数组是否区分？HTTP 确认是否提前推进 revision？
- 是否保留失败反馈、断线恢复、撤销 epoch 顺序？
- 是否引入密钥 / DB / 生成文件，或不必要依赖 / 大包？
- 测试证据、浏览器 / 真机限制和运维变化是否如实记录？

使用 `fix:`、`feat:`、`perf:`、`test:`、`docs:`、`chore:`，每次提交一个可说明的目的。PR / 本地合并说明面向未看过聊天的人，写清问题、结果、测试、局限；UI 修改附有场景标注的图像。优先完成 review 再 `--no-ff` 合并 main，不强推主线。

推送与上线是两个步骤。GitHub CI 不自动部署 VPS；按任务授权操作。曾授权的一次发布不等于未来任意 feature 可以中断在线房间。已明确授权则完成准备、验证和空闲检查后执行，不重复请求无必要确认。

## 5. 文档维护

| 唯一主文档 | 修改触发点 |
|---|---|
| README | 产品入口、本地命令、环境配置变化 |
| AGENTS | 通用开发约束、阅读路径、不变量变化 |
| HANDOFF | 稳定版本、已知限制、下一步交接边界变化 |
| ARCHITECTURE | 数据模型、规则、协议、状态流变化 |
| DEPLOYMENT | 主机、服务、路径、发布、备份 / 恢复变化 |
| MAINTENANCE | 测试 / 审查 / 发布流程变化 |
| 日期验收报告 | 新实测证据；保留测试对象、日期和限制 |

不要在多个文档复制不同的“当前版本”。HANDOFF 是版本身份的主来源，DEPLOYMENT 只描述路径机制。历史报告用标题明确时间和范围，旧记录不再追加“当前待做”。旧 prompt、一次性计划与排错流水记到 Git 历史即可，不复制进每次新交接。

完成任务后汇总决策 / 维护信息，再移除临时 task_plan / findings / progress，避免留下过期指令。历史问题必须分清：已修复、当前限制、待用户决定的 feature。

## 6. 工作区清洁

- 保留 `scripts/check-server.mjs`、`scripts/load-test.mjs`、`deploy/verify-release.sh`：均被 npm / CI / 发布流程调用，不是残留。
- 保留测试、开发预览、当前验收截图和第三方 NOTICE。删旧截图前确认无活动引用。
- 可移除本任务产生的 `client/dist`、`.npm-cache`、Vite / Vitest 缓存、临时 tar / probe / release helper；不删 node_modules 来假装工作区“干净”，除非确需重装。
- SQLite 的 app.db / WAL / SHM、.env 是本地数据与配置，不是垃圾。禁止用 `git clean -fdx` 一锅端；先列出目标，按明确路径处理。
- Windows 删除 / 移动目录前核对规范化绝对路径仍在预期项目或明确临时目录内，排除链接；使用 PowerShell `-LiteralPath`，不跨 shell 拼删除命令。
- 本地分支仅删除已被 main 包含的任务分支，使用 `git branch -d`；未合并分支、其他 worktree、远程分支和稳定标签保留。
- 收尾检查 `git status --short`、`git diff --check`、目标分支与 remote HEAD；记录部署是否变化、标签是否推送、CI 结论和遗留验证项。
