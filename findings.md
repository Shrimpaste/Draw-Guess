# 修复依据

完整初始证据见 REVIEW-2026-09-15.md。

- 初始 HEAD 与 origin/main 均为 7d858fe；已有 4 个 UI 源文件修改及 4 个未跟踪文档，必须独立保存。
- 初始测试仅 4 项，服务端测试会重置默认 SQLite 玩家表。此后测试必须强制独立数据库。
- 核心风险：WebSocket 未捕获 error、非成员猜词、多房间残留、新旧 socket 解绑、SQLite 与内存会话不一致、pendingGuess 覆盖、画笔抬起才同步和静默丢弃。
- Review Changes 图谱工具当前不可用，审查使用源码 diff、回归测试、真实本地 HTTP/WS 与浏览器。
- 部署建议为单域名单进程；VPS SSH 别名/域名/已有服务情况已向用户询问，继续不依赖它们的本地工作。
