import { useState } from "react";
import { SketchIcon } from "../components/ui/sketch-icon.jsx";
import { Button } from "../components/ui/button.jsx";
import { Field, Input } from "../components/ui/field.jsx";
import { Modal } from "../components/ui/overlay.jsx";
import { Popover } from "../components/ui/tool-overlays.jsx";
import { Slider, ToggleGroup } from "../components/ui/tool-selection.jsx";

const PenIcon = (props) => <SketchIcon name="pen" {...props} />;
const EraserIcon = (props) => <SketchIcon name="eraser" {...props} />;

export default function UiPreview() {
  const [tool, setTool] = useState("pen"),
    [width, setWidth] = useState(5),
    [open, setOpen] = useState(false);
  const [guess, setGuess] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="ui-preview">
      <header>
        <span className="meta">开发预览 · 不连接游戏服务器</span>
        <h1>基础控件</h1>
      </header>
      <section className="preview-panel">
        <div className="preview-controls preview-tools">
          <ToggleGroup
            label="画具"
            value={tool}
            onValueChange={setTool}
            options={[
              { value: "pen", label: "画笔", icon: PenIcon },
              { value: "eraser", label: "橡皮", icon: EraserIcon },
            ]}
          />
          <Popover
            label="调整线宽"
            trigger={<Button variant="outline">笔宽 {width}</Button>}
          >
            <Slider
              label="线宽"
              min={2}
              max={24}
              value={[width]}
              onValueChange={([next]) => setWidth(next)}
            />
          </Popover>
          <Button variant="ghost" size="icon" aria-label="撤销" disabled>
            <SketchIcon name="undo" />
          </Button>
        </div>
        <div
          style={{
            minHeight: 220,
            display: "grid",
            placeItems: "center",
            background: "#fbf8f0",
            borderRadius: 2,
          }}
        >
          <svg
            width="170"
            height="130"
            viewBox="0 0 170 130"
            aria-label="咖啡杯简笔画"
          >
            <g
              fill="none"
              stroke="#504936"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M35 50h85v40q-5 25-42 25T35 90Z M120 58h13q28 20-13 30 M45 123h65 M58 32q-14-13 0-24 M82 32q-14-13 0-24 M106 32q-14-13 0-24" />
            </g>
          </svg>
        </div>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            await new Promise((r) => setTimeout(r, 1500));
            setPending(false);
            setError("模拟发送失败，输入还在，可以重试。");
          }}
        >
          <Field label="你的答案" error={error}>
            {(props) => (
              <Input
                {...props}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="输入答案"
              />
            )}
          </Field>
          <div className="preview-controls">
            <Button type="submit" pending={pending} disabled={!guess.trim()}>
              发送答案
            </Button>
            <Button variant="outline" onClick={() => setOpen(true)}>
              试试弹窗
            </Button>
          </div>
        </form>
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="弹窗"
        description="Tab 切换焦点，Esc 关闭并返回触发按钮。"
      >
        <Field label="房间名称">
          {(props) => <Input {...props} placeholder="午后速写室" />}
        </Field>
        <footer className="ui-dialog-footer">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={() => setOpen(false)}>保存</Button>
        </footer>
      </Modal>
    </main>
  );
}
