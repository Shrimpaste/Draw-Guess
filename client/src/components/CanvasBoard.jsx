import { useEffect, useRef, useState } from "react";

function drawStroke(context, stroke) {
  if (!stroke?.points?.length) return;
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  const [first, ...rest] = stroke.points;
  context.moveTo(first.x, first.y);
  for (const point of rest) {
    context.lineTo(point.x, point.y);
  }
  context.stroke();
}

const palette = ["#16110f", "#ff5b36", "#2f6bff", "#ffd84d", "#2db489", "#8b5cf6"];

export function CanvasBoard({ room, isDrawer, onStroke, onClear }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState({ color: "#16110f", width: 5 });
  const currentStroke = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of room?.canvas || []) {
      drawStroke(context, stroke);
    }
  }, [room?.canvas]);

  function toPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  }

  function pointerDown(event) {
    if (!isDrawer) return;
    const point = toPoint(event);
    currentStroke.current = {
      color: tool.color,
      width: tool.width,
      points: [point],
    };
  }

  function pointerMove(event) {
    if (!isDrawer || !currentStroke.current) return;
    const point = toPoint(event);
    const lastPoint = currentStroke.current.points.at(-1);
    currentStroke.current.points.push(point);
    const context = canvasRef.current.getContext("2d");
    drawStroke(context, {
      color: currentStroke.current.color,
      width: currentStroke.current.width,
      points: [lastPoint, point],
    });
  }

  function pointerUp() {
    if (!isDrawer || !currentStroke.current) return;
    onStroke(currentStroke.current);
    currentStroke.current = null;
  }

  return (
    <section className="surface-panel canvas-shell">
      <div className="canvas-frame">
        <div className="canvas-header">
          <div>
            <p className="section-kicker">Canvas Feed</p>
            <h2>画布就是这一局的中心舞台</h2>
            <p className="canvas-subtitle">
              {isDrawer ? "你的每一笔都会立刻同步到房间内所有玩家。" : "你正在实时观看画面推进，等待下一次灵光一现。"}
            </p>
          </div>

          <div className="canvas-utilities">
            <span className={`canvas-badge ${room?.round?.status === "active" ? "is-live" : ""}`}>
              {room?.round?.status === "active" ? "直播中" : "等待开局"}
            </span>
            <span className="canvas-badge">{isDrawer ? "你正在作画" : "观察画布"}</span>
          </div>
        </div>

        <div className="tool-deck">
          <div className="swatch-row">
            {palette.map((color) => (
              <button
                key={color}
                className={`swatch ${tool.color === color ? "active" : ""}`}
                style={{ "--swatch": color }}
                onClick={() => setTool((prev) => ({ ...prev, color }))}
                aria-label={`切换颜色 ${color}`}
                type="button"
              />
            ))}
          </div>

          <div className="brush-meter">
            <span>线宽</span>
            <input
              type="range"
              min="2"
              max="14"
              value={tool.width}
              onChange={(event) => setTool((prev) => ({ ...prev, width: Number(event.target.value) }))}
            />
            <strong>{tool.width}px</strong>
          </div>

          <button className="ghost-button" onClick={onClear} disabled={!isDrawer} type="button">
            清空画布
          </button>
        </div>

          <div className="canvas-stage interactive-tilt">
            <div className="canvas-orbit canvas-orbit-a" />
            <div className="canvas-orbit canvas-orbit-b" />
          <canvas
            ref={canvasRef}
            className={`board ${isDrawer ? "board-drawable" : ""}`}
            width="960"
            height="620"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerLeave={pointerUp}
          />
        </div>
      </div>
    </section>
  );
}
