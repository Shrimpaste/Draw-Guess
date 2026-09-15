const messages = {
  ALREADY_IN_ROOM: "你已在一个房间中，请先返回大厅。",
  SERVER_FULL: "大厅暂时满员，请稍后再来。",
  ROOM_FULL: "房间已满，最多容纳 10 人。",
  ROOM_NOT_FOUND: "房间已关闭，请检查房间码。",
  FORBIDDEN: "当前身份不能进行这个操作。",
  NOT_ENOUGH_PLAYERS: "人数不足：词库局至少 2 人，裁定局至少 3 人。",
  ROUND_STATE_INVALID: "回合已变化，请按当前状态继续。",
  ROLE_CANNOT_GUESS: "画师和出题者不能参与猜词。",
  GUESS_NOT_PENDING: "这个答案已经处理过了。",
  GUESS_QUEUE_FULL: "待裁定答案较多，请等出题者处理后再提交。",
  CANVAS_CHANGED: "画布已更新，已恢复最新画面，请继续作画。",
  CANVAS_FULL: "画布已达到本轮容量，请撤销部分笔迹或清空后继续。",
  INVALID_REALTIME_MESSAGE: "绘画消息格式有误，请刷新后重试。",
  PACK_NAME_TAKEN: "已有同名词包，请换一个名称。",
  "Admin key invalid": "审核密钥不正确，或服务器尚未启用审核。",
  "Too many requests": "操作太快了，请稍等几秒再试。",
  "Session invalid": "会话已失效，请退出后重新进入大厅。",
  "Missing token": "请先进入大厅。",
  "Failed to fetch": "暂时无法连接服务器，请检查网络后重试。",
};
export function errorText(error) {
  const text = typeof error === "string" ? error : error?.message;
  if (!text) return "";
  if (messages[text]) return messages[text];
  if (text.startsWith("Invalid "))
    return "填写内容不符合要求，请检查字段长度与格式。";
  return /[\u3400-\u9fff]/.test(text) ? text : "操作未完成，请稍后重试。";
}
