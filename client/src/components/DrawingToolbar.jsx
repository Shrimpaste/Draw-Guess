import { ConfirmAction } from "./ui/overlay.jsx";
import { memo } from "react";
import {
  Check,
  Circle,
  Eraser,
  Palette,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Popover, Tooltip, TooltipProvider } from "./ui/tool-overlays.jsx";
import { Slider, ToggleGroup } from "./ui/tool-selection.jsx";

export const palette = [
  ["#16110f", "墨黑"],
  ["#ff5b36", "朱橙"],
  ["#2f6bff", "湖蓝"],
  ["#ffd84d", "明黄"],
  ["#2db489", "青绿"],
  ["#8b5cf6", "鸢紫"],
];
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
      <div className="drawing-toolbar" aria-label="绘画工具">
        <ToggleGroup
          label="画具"
          value={tool.tool}
          onValueChange={(kind) => onToolChange({ ...tool, tool: kind })}
          options={[
            { value: "pen", label: "画笔", icon: Pencil },
            { value: "eraser", label: "橡皮", icon: Eraser },
          ]}
        />
        <span className="tool-separator" />
        <Popover
          label="选择颜色"
          trigger={
            <Button variant="ghost" size="icon" aria-label="选择颜色">
              <span
                className="active-color"
                style={{ background: tool.color }}
              />
              <Palette className="sr-only" />
            </Button>
          }
        >
          <div className="popover-heading">
            给灵感一点颜色
            <span>{palette.find(([color]) => color === tool.color)?.[1]}</span>
          </div>
          <div className="color-grid">
            {palette.map(([color, name]) => (
              <button
                type="button"
                key={color}
                className="color-choice"
                aria-label={name}
                aria-pressed={tool.color === color && tool.tool === "pen"}
                onClick={() => onToolChange({ ...tool, color, tool: "pen" })}
              >
                <span style={{ background: color }}>
                  {tool.color === color && tool.tool === "pen" && (
                    <Check
                      size={16}
                      color={color === "#ffd84d" ? "#29221d" : "white"}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </Popover>
        <Popover
          label="调整线宽"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="width-trigger"
              aria-label={`调整线宽，当前 ${tool.width}`}
            >
              <Circle size={16} />
              <span>{tool.width}</span>
            </Button>
          }
        >
          <div className="popover-heading">
            线条粗细<span>{tool.width} px</span>
          </div>
          <div className="brush-preview">
            <span
              style={{
                width: tool.width,
                height: tool.width,
                background: tool.tool === "eraser" ? "#b3a595" : tool.color,
              }}
            />
          </div>
          <Slider
            label="线宽"
            min={2}
            max={24}
            step={1}
            value={[tool.width]}
            onValueChange={([width]) => onToolChange({ ...tool, width })}
          />
          <div className="brush-presets">
            {[3, 5, 12, 20].map((width) => (
              <Button
                key={width}
                size="sm"
                variant={tool.width === width ? "secondary" : "ghost"}
                onClick={() => onToolChange({ ...tool, width })}
              >
                {width}
              </Button>
            ))}
          </div>
        </Popover>
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
              <Undo2 />
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
            <Trash2 />
          </Button>
        </ConfirmAction>
      </div>
    </TooltipProvider>
  );
});
