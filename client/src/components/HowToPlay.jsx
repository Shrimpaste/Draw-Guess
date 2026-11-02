import { Modal } from "./ui/overlay.jsx";
import { SketchIcon } from "./ui/sketch-icon.jsx";

const rules = [
  ["book", "词库局", "2–10 人", "系统从词包抽一个词，一人作画，其他人猜，答案自动判定。"],
  ["star", "裁定局", "3–10 人", "出题者在 30 秒内写下词语，画师作画，出题者逐条裁定猜词。"],
  ["check", "计分", "每轮 100 秒", "猜中 +2，画师和出题者各 +1。超时、提前结束或关键玩家离开不计分。"],
  ["pen", "作画", "画师", "B 画笔 · E 橡皮 · Ctrl / ⌘ Z 撤销。不要在画里写出答案。"],
  ["refresh", "断线", "60 秒", "刷新不会离开房间；所有标签页断开后，座位保留 60 秒。"],
];

export function HowToPlay({ open, onOpenChange }) {
  return (
    <Modal title="玩法" open={open} onOpenChange={onOpenChange} className="rules-dialog">
      <dl className="rules-list">
        {rules.map(([icon, title, meta, body]) => (
          <div key={title}>
            <dt>
              <SketchIcon name={icon} size={22} />
              {title}
              <small>{meta}</small>
            </dt>
            <dd>{body}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
