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

export function CanvasBoard({ room, isDrawer, onStroke, onClear }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState({ color: "#1e1b18", width: 5 });
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
    <section className="canvas-shell panel canvas-shell-premium">
      <div className="canvas-topbar">
        <div>
          <p className="eyebrow">实时画布</p>
          <h2>画布已经连上现场</h2>
          <p className="canvas-subtitle">
            {isDrawer
              ? "当前由你作画，你的每一笔都会即时同步到房间中。"
              : "当前由其他玩家作画，你可以实时观看整个绘制过程。"}
          </p>
        </div>

        <div className="tool-row tool-row-rich">
          {["#1e1b18", "#d9482f", "#0081a7", "#f4a300", "#2a9d6f", "#6f5ef9"].map((color) => (
            <button
              key={color}
              className={`swatch ${tool.color === color ? "active" : ""}`}
              style={{ "--swatch": color }}
              onClick={() => setTool((prev) => ({ ...prev, color }))}
              aria-label={`切换颜色 ${color}`}
              type="button"
            />
          ))}
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
      </div>

      <div className="canvas-stage">
        <div className="canvas-stage-badge">
          {room?.round?.status === "active" ? "实时同步中" : "等待回合开始"}
        </div>
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
    </section>
  );
}
