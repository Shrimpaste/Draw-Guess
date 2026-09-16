import { useEffect, useRef, useState } from "react";
import { DrawingToolbar, palette } from "./DrawingToolbar.jsx";

export function drawStroke(context, stroke) {
  if (!stroke?.points?.length) return;
  context.save();
  context.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  const [first, ...rest] = stroke.points;
  if (!rest.length) {
    context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.moveTo(first.x, first.y);
    for (const point of rest) context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
}

export function CanvasBoard({ room, isDrawer, onStroke, onClear, onUndo }) {
  const [pixelRatio] = useState(() =>
    Math.min(window.devicePixelRatio || 1, 2),
  );
  const canvasRef = useRef(null);
  const bufferRef = useRef(null);
  const renderedRef = useRef([]);
  const localRef = useRef(new Map());
  const activeRef = useRef(null);
  const timerRef = useRef(null);
  const frameRef = useRef(null);
  const resetPendingRef = useRef(false);
  const [waitingForReset, setWaitingForReset] = useState(false);
  const canDraw = isDrawer && !waitingForReset;
  const latest = useRef({ room, isDrawer, onStroke });
  latest.current = { room, isDrawer, onStroke };
  const [tool, setTool] = useState({
    color: palette[0][0],
    width: 5,
    tool: "pen",
  });

  function paint() {
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    if (!canvas || !buffer) return;
    const context = canvas.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, 960, 620);
    context.drawImage(buffer, 0, 0, 960, 620);
    const confirmed = new Map(
      latest.current.room.canvas.map((stroke) => [stroke.id, stroke]),
    );
    for (const local of localRef.current.values()) {
      const length = confirmed.get(local.id)?.points.length || 0;
      if (length < local.points.length)
        drawStroke(context, {
          ...local,
          points: local.points.slice(Math.max(0, length - 1)),
        });
      else if (activeRef.current?.id !== local.id)
        localRef.current.delete(local.id);
    }
  }
  function requestPaint() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  }
  function discardLocal() {
    clearInterval(timerRef.current);
    activeRef.current = null;
    localRef.current.clear();
  }
  useEffect(() => {
    discardLocal();
    resetPendingRef.current = false;
    setWaitingForReset(false);
    renderedRef.current = [];
    if (bufferRef.current)
      bufferRef.current.getContext("2d").clearRect(0, 0, 960, 620);
    requestPaint();
  }, [room.round.id, room.canvasEpoch, room.canvasResetKey, isDrawer]);

  useEffect(() => {
    if (!bufferRef.current) {
      const buffer = document.createElement("canvas");
      buffer.width = 960 * pixelRatio;
      buffer.height = 620 * pixelRatio;
      buffer.getContext("2d").scale(pixelRatio, pixelRatio);
      bufferRef.current = buffer;
    }
    const context = bufferRef.current.getContext("2d");
    const previous = renderedRef.current;
    const strokes = room.canvas;
    // Most messages append points to the latest stroke. Redraw the buffer only
    // for snapshots, undo, or overlapping drawing tabs that change an older stroke.
    const incremental =
      previous.length <= strokes.length &&
      previous.every(
        (stroke, i) =>
          stroke === strokes[i] ||
          (i === previous.length - 1 &&
            stroke.id === strokes[i]?.id &&
            stroke.points.length <= strokes[i].points.length),
      );
    if (!incremental) context.clearRect(0, 0, 960, 620);
    strokes.forEach((stroke, index) => {
      const old = incremental ? previous[index] : null;
      if (old === stroke) return;
      if (old && old.id === stroke.id)
        drawStroke(context, {
          ...stroke,
          points: stroke.points.slice(Math.max(0, old.points.length - 1)),
        });
      else drawStroke(context, stroke);
    });
    renderedRef.current = strokes;
    requestPaint();
  }, [
    room.canvas,
    room.round.id,
    room.canvasEpoch,
    room.canvasResetKey,
    isDrawer,
  ]);
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x:
        Math.round(
          Math.max(
            0,
            Math.min(960, ((event.clientX - rect.left) / rect.width) * 960),
          ) * 100,
        ) / 100,
      y:
        Math.round(
          Math.max(
            0,
            Math.min(620, ((event.clientY - rect.top) / rect.height) * 620),
          ) * 100,
        ) / 100,
    };
  }
  function flush() {
    const current = activeRef.current;
    if (!current || !latest.current.isDrawer) return;
    while (current.sent < current.points.length) {
      const points = current.points.slice(current.sent, current.sent + 128);
      const { id, color, width, tool: kind } = current;
      if (
        !latest.current.onStroke({
          id,
          color,
          width,
          tool: kind,
          offset: current.sent,
          points,
        })
      ) {
        discardLocal();
        requestPaint();
        return;
      }
      current.sent += points.length;
    }
  }
  function pointerDown(event) {
    if (
      !isDrawer ||
      resetPendingRef.current ||
      event.button !== 0 ||
      activeRef.current
    )
      return;
    event.preventDefault();
    canvasRef.current.focus?.({ preventScroll: true });
    canvasRef.current.setPointerCapture?.(event.pointerId);
    const stroke = {
      ...tool,
      id: crypto.randomUUID(),
      points: [point(event)],
      sent: 0,
      pointerId: event.pointerId,
    };
    activeRef.current = stroke;
    localRef.current.set(stroke.id, stroke);
    flush();
    requestPaint();
    if (activeRef.current) timerRef.current = setInterval(flush, 50);
  }
  function pointerMove(event) {
    const stroke = activeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId || !isDrawer) return;
    const next = point(event),
      last = stroke.points.at(-1);
    if (Math.hypot(next.x - last.x, next.y - last.y) < 0.5) return;
    stroke.points.push(next);
    if (stroke.points.length - stroke.sent >= 128) flush();
    requestPaint();
  }
  function finish(event) {
    const stroke = activeRef.current;
    if (
      !stroke ||
      (event?.pointerId !== undefined && event.pointerId !== stroke.pointerId)
    )
      return;
    flush();
    activeRef.current = null;
    clearInterval(timerRef.current);
    if (canvasRef.current.hasPointerCapture?.(stroke.pointerId))
      canvasRef.current.releasePointerCapture(stroke.pointerId);
    requestPaint();
  }
  function resetCanvas(command) {
    if (!isDrawer || resetPendingRef.current) return;
    finish();
    // New strokes must use the epoch returned by the authoritative snapshot.
    resetPendingRef.current = true;
    setWaitingForReset(true);
    if (!command()) {
      resetPendingRef.current = false;
      setWaitingForReset(false);
    }
  }

  return (
    <section
      className="surface-panel canvas-shell"
      aria-label="画布与工具"
      onKeyDown={(event) => {
        if (
          !isDrawer ||
          event.target.closest(
            "input, textarea, [contenteditable=true], [role=slider], button, [role=radio]",
          )
        )
          return;
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "z" &&
          !event.shiftKey &&
          room.canvas.length
        ) {
          event.preventDefault();
          resetCanvas(onUndo);
        }
        if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          ["b", "e"].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          setTool((old) => ({
            ...old,
            tool: event.key.toLowerCase() === "b" ? "pen" : "eraser",
          }));
        }
      }}
    >
      {isDrawer ? (
        <DrawingToolbar
          tool={tool}
          onToolChange={setTool}
          canReset={!!room.canvas.length}
          pending={waitingForReset}
          onUndo={() => resetCanvas(onUndo)}
          onClear={() => resetCanvas(onClear)}
        />
      ) : (
        <div className="watching-label">
          {room.round.status === "finished" ? "本轮画作" : "灵感正在纸上发生"}
          <span>INKMUSE CANVAS</span>
        </div>
      )}
      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          aria-label="绘画画布"
          tabIndex={isDrawer ? 0 : undefined}
          aria-busy={waitingForReset}
          className={`board ${canDraw ? "board-drawable" : ""}`}
          width={960 * pixelRatio}
          height={620 * pixelRatio}
          style={{
            touchAction: isDrawer ? "none" : "pan-y",
            aspectRatio: "960 / 620",
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        />
        {["waiting", "collecting-word"].includes(room.round.status) && (
          <div className="canvas-placeholder" aria-hidden="true">
            <span>✳</span>
            <strong>
              {room.round.status === "waiting"
                ? "好画，从相聚开始"
                : "给灵感一点时间"}
            </strong>
            <p>
              {room.round.status === "waiting"
                ? "邀请朋友加入，把第一笔留给你们。"
                : "出题者正在想一个词，马上开始。"}
            </p>
          </div>
        )}
      </div>
      <p className="canvas-subtitle">
        {waitingForReset
          ? "正在同步画布，请稍候…"
          : isDrawer
            ? "轮到你画了 · 画笔实时同步，支持触摸绘制"
            : room.round.status === "finished"
              ? "本轮画作 · 下一轮开始前会一直保留"
              : "看画面，猜一个词"}
      </p>
    </section>
  );
}
