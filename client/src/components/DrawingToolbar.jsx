import { ConfirmAction } from "./ui/overlay.jsx";
import { memo } from "react";
import { Button } from "./ui/button.jsx";
import { SketchIcon } from "./ui/sketch-icon.jsx";
import { Tooltip, TooltipProvider } from "./ui/tool-overlays.jsx";
import { ToggleGroup } from "./ui/tool-selection.jsx";

export const palette = [
  ["#3b3428", "墨黑"],
  ["#c4492f", "朱红"],
  ["#3f5fa8", "靛蓝"],
  ["#4f8a5b", "苔绿"],
  ["#e0b23a", "明黄"],
  ["#8a5ca8", "藕紫"],
  ["#8a5a3a", "赭棕"],
  ["#e58aa0", "桃粉"],
];
export const widths = [3, 6, 12, 20];
const PenIcon = (props) => <SketchIcon name="pen" {...props} />;
const EraserIcon = (props) => <SketchIcon name="eraser" {...props} />;

function ColorPencil({ color, name, active, onPick }) {
  return (
    <button
      type="button"
      className="color-pencil"
      aria-label={name}
      aria-pressed={active}
      title={name}
      style={{ "--pigment": color }}
      onClick={onPick}
    >
      <svg viewBox="0 0 22 46" aria-hidden="true">
        <path d="M5 44 4.6 15 11 2l6.4 13-.4 29Q11 46.5 5 44Z" fill={color} />
        <path d="M4.6 15 11 2l6.4 13-3.4-1.6-3 2.2-3-2.2Z" fill="#dcc494" />
        <path d="m8.8 6.5 2.2-4.5 2.2 4.5Z" fill={color} />
        <path d="m8.4 18 .3 24m4.6-24-.2 24" stroke="#f9f4e9" strokeWidth="1" opacity=".5" />
        <path d="M5 44 4.6 15 11 2l6.4 13-.4 29" stroke="#504936" strokeWidth=".9" fill="none" opacity=".55" />
      </svg>
    </button>
  );
}

export const DrawingToolbar = memo(function DrawingToolbar({
  tool,
  onToolChange,
  canReset,
  pending,
  onUndo,
  onClear,
}) {
  return (
    <TooltipProvider delayDuration={350}>
      <div className="drawing-toolbar" role="toolbar" aria-label="绘画工具">
        <ToggleGroup
          label="画具"
          value={tool.tool}
          onValueChange={(kind) => onToolChange({ ...tool, tool: kind })}
          options={[
            { value: "pen", label: "画笔", icon: PenIcon },
            { value: "eraser", label: "橡皮", icon: EraserIcon },
          ]}
        />
        <div className="color-pencils" role="group" aria-label="颜色">
          {palette.map(([color, name]) => (
            <ColorPencil
              key={color}
              color={color}
              name={name}
              active={tool.color === color && tool.tool === "pen"}
              onPick={() => onToolChange({ ...tool, color, tool: "pen" })}
            />
          ))}
        </div>
        <div className="width-dots" role="group" aria-label="线宽">
          {widths.map((width) => (
            <button
              type="button"
              key={width}
              aria-label={`线宽 ${width}`}
              aria-pressed={tool.width === width}
              onClick={() => onToolChange({ ...tool, width })}
            >
              <i
                style={{
                  width: Math.max(4, width * 0.95),
                  height: Math.max(4, width * 0.95),
                  background: tool.tool === "eraser" ? "#b3a68b" : tool.color,
                }}
              />
            </button>
          ))}
        </div>
        <span className="tool-spacer" />
        <Tooltip text="撤销 · Ctrl / ⌘ Z">
          <span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="撤销"
              disabled={!canReset || pending}
              onClick={onUndo}
            >
              <SketchIcon name="undo" size={22} />
            </Button>
          </span>
        </Tooltip>
        <ConfirmAction
          title="清空这张画布？"
          description="所有笔画都会被移除，清空后无法撤销。"
          confirmText="清空画布"
          disabled={!canReset || pending}
          onConfirm={onClear}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="清空"
            disabled={!canReset || pending}
          >
            <SketchIcon name="trash" size={22} />
          </Button>
        </ConfirmAction>
      </div>
    </TooltipProvider>
  );
});
