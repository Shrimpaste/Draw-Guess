import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DrawingToolbar, palette } from "./DrawingToolbar.jsx";
import { pencilScratch } from "../sound.js";

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

const prefersStill = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// The previous round's drawing lifts over the top binding like a sketchbook page.
function PageFlip({ flip, onDone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    ref.current?.getContext("2d")?.drawImage(flip.image, 0, 0);
  }, [flip]);
  useEffect(() => {
    const timer = setTimeout(onDone, 1000);
    return () => clearTimeout(timer);
  }, [flip, onDone]);
  return (
    <div className="page-flip" aria-hidden="true">
      <div className="page-flip-sheet">
        <canvas ref={ref} width={flip.image.width} height={flip.image.height} />
      </div>
    </div>
  );
}

function PencilCursor({ tool, cursorRef }) {
  return (
    <div ref={cursorRef} className={`canvas-cursor cursor-${tool.tool}`} style={{ "--tip": tool.color }} aria-hidden="true">
      <span className="cursor-brush" />
      <svg className="cursor-tool" key={tool.tool} viewBox="0 0 30 30" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {tool.tool === "eraser" ? (
          <>
            <path d="m2 27 9-11 8 7-6 7H6Z" fill="#f2ddd6" stroke="#504936" strokeWidth="1.3" />
            <path d="m11 16 8-9 8 7-8 9Z" fill="#ad5541" stroke="#504936" strokeWidth="1.3" />
            <path d="m13 18 6 5" stroke="#504936" strokeWidth="1" />
          </>
        ) : (
          <>
            <path d="m6.5 18.5 14-14 5 5-14 14Z" fill="#bc9244" stroke="#504936" strokeWidth="1.3" />
            <path d="m20.5 4.5 2-2c1-1 2.6-1 3.6 0l1.4 1.4c1 1 1 2.6 0 3.6l-2 2" fill="#d9a59a" stroke="#504936" strokeWidth="1.3" />
            <path d="M6.5 18.5 1.5 28.5l10-5Z" fill="#ead8b3" stroke="#504936" strokeWidth="1.3" />
            <path className="cursor-tip" d="M3.4 24.6 1.5 28.5l3.9-1.9Z" />
            <path d="m9 21 13.5-13.5" stroke="#f9f4e9" strokeWidth="1" opacity=".6" />
          </>
        )}
      </svg>
    </div>
  );
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
  const scratchRef = useRef(null);
  const lastMoveRef = useRef(null);
  const cursorRef = useRef(null);
  const fxRef = useRef(null);
  const previousRoundRef = useRef(room.round.id);
  const [flip, setFlip] = useState(null);
  const endFlip = useCallback(() => setFlip(null), []);
  const [waitingForReset, setWaitingForReset] = useState(false);
  const canDraw = isDrawer && !waitingForReset;
  const confirmed = useMemo(() => new Map(room.canvas.map((stroke) => [stroke.id, stroke.points.length])), [room.canvas]);
  const latest = useRef(null);
  latest.current = { room, isDrawer, onStroke, confirmed };
  const [tool, setTool] = useState({
    color: palette[0][0],
    width: 6,
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
    for (const local of localRef.current.values()) {
      const length = latest.current.confirmed.get(local.id) || 0;
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
  function quietPencil() {
    scratchRef.current?.end();
    scratchRef.current = null;
  }
  function discardLocal() {
    quietPencil();
    clearInterval(timerRef.current);
    activeRef.current = null;
    localRef.current.clear();
  }
  useEffect(() => {
    const buffer = bufferRef.current;
    if (previousRoundRef.current !== room.round.id && renderedRef.current.length && buffer && !prefersStill()) {
      const image = document.createElement("canvas");
      image.width = buffer.width;
      image.height = buffer.height;
      image.getContext("2d")?.drawImage(buffer, 0, 0);
      setFlip({ key: room.round.id, image });
    }
    previousRoundRef.current = room.round.id;
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
      quietPencil();
      clearInterval(timerRef.current);
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function showCursor(event) {
    const cursor = cursorRef.current, canvas = canvasRef.current;
    if (!cursor || !canvas) return;
    if (event.pointerType === "touch") {
      cursor.classList.remove("is-visible");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    cursor.style.transform = `translate(${event.clientX - rect.left + canvas.offsetLeft}px, ${event.clientY - rect.top + canvas.offsetTop}px)`;
    cursor.style.setProperty("--brush", `${Math.max(3, (tool.width * rect.width) / 960)}px`);
    cursor.classList.add("is-visible");
  }
  function hideCursor() {
    cursorRef.current?.classList.remove("is-visible", "is-down");
  }
  // A short ink ring where the pen meets the paper; a few at most.
  function contact(event) {
    const layer = fxRef.current, canvas = canvasRef.current;
    if (!layer || !canvas || prefersStill()) return;
    const rect = canvas.getBoundingClientRect();
    const ring = document.createElement("span");
    ring.className = `canvas-contact contact-${tool.tool}`;
    ring.style.left = `${event.clientX - rect.left + canvas.offsetLeft}px`;
    ring.style.top = `${event.clientY - rect.top + canvas.offsetTop}px`;
    ring.style.setProperty("--tip", tool.color);
    ring.style.setProperty("--size", `${Math.max(10, (tool.width * rect.width) / 960 + 12)}px`);
    while (layer.childElementCount >= 3) layer.firstElementChild.remove();
    layer.append(ring);
    setTimeout(() => ring.remove(), 600);
  }
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
    showCursor(event);
    cursorRef.current?.classList.add("is-down");
    contact(event);
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
    quietPencil();
    scratchRef.current = pencilScratch(tool.tool);
    lastMoveRef.current = { ...stroke.points[0], at: performance.now() };
    flush();
    requestPaint();
    if (activeRef.current) timerRef.current = setInterval(flush, 25);
  }
  function pointerMove(event) {
    if (canDraw) showCursor(event);
    const stroke = activeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId || !isDrawer) return;
    const next = point(event),
      last = stroke.points.at(-1);
    if (Math.hypot(next.x - last.x, next.y - last.y) < 0.5) return;
    stroke.points.push(next);
    const now = performance.now(), previous = lastMoveRef.current;
    if (previous) scratchRef.current?.move(Math.hypot(next.x - previous.x, next.y - previous.y) / Math.max(4, now - previous.at));
    lastMoveRef.current = { ...next, at: now };
    if (stroke.points.length - stroke.sent >= 128) flush();
    requestPaint();
  }
  function finish(event) {
    cursorRef.current?.classList.remove("is-down");
    const stroke = activeRef.current;
    if (
      !stroke ||
      (event?.pointerId !== undefined && event.pointerId !== stroke.pointerId)
    )
      return;
    flush();
    quietPencil();
    activeRef.current = null;
    clearInterval(timerRef.current);
    if (canvasRef.current.hasPointerCapture?.(stroke.pointerId))
      canvasRef.current.releasePointerCapture(stroke.pointerId);
    requestPaint();
  }
  const resetCanvas = useCallback((command) => {
    if (!isDrawer || resetPendingRef.current) return;
    finish();
    // New strokes must use the epoch returned by the authoritative snapshot.
    resetPendingRef.current = true;
    setWaitingForReset(true);
    if (!command()) {
      resetPendingRef.current = false;
      setWaitingForReset(false);
    }
  }, [isDrawer]);
  const undo = useCallback(() => resetCanvas(onUndo), [resetCanvas, onUndo]);
  const clear = useCallback(() => resetCanvas(onClear), [resetCanvas, onClear]);

  return (
    <section
      className="canvas-shell"
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
          onUndo={undo}
          onClear={clear}
        />
      ) : (
        <div className="watching-label">
          <span>
            {room.round.status === "finished"
              ? "本轮画作"
              : room.round.status === "active" && room.round.drawerId
                ? `${room.round.drawerId} 正在画`
                : "画布"}
          </span>
          {room.round.number > 0 && <span className="paper-no">No. {String(room.round.number).padStart(3, "0")}</span>}
        </div>
      )}
      <div className={`canvas-stage ${canDraw ? "is-drawable" : ""} ${waitingForReset ? "is-syncing" : ""}`}>
        <span className="paper-tape tape-left" aria-hidden="true" />
        <span className="paper-tape tape-right" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          aria-label="绘画画布"
          tabIndex={isDrawer ? 0 : undefined}
          aria-busy={waitingForReset}
          className={`board ${canDraw ? "board-drawable" : ""} ${canDraw && tool.tool === "eraser" ? "board-erasing" : ""}`}
          width={960 * pixelRatio}
          height={620 * pixelRatio}
          style={{
            touchAction: isDrawer ? "none" : "pan-y",
            aspectRatio: "960 / 620",
          }}
          onPointerDown={pointerDown}
          onPointerEnter={(event) => canDraw && showCursor(event)}
          onPointerLeave={hideCursor}
          onPointerMove={pointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        />
        <div ref={fxRef} className="canvas-fx" aria-hidden="true" />
        {canDraw && <PencilCursor tool={tool} cursorRef={cursorRef} />}
        {flip && <PageFlip key={flip.key} flip={flip} onDone={endFlip} />}
        {["waiting", "collecting-word"].includes(room.round.status) && !room.canvas.length && (
          <div className="canvas-placeholder" aria-hidden="true">
            <svg viewBox="0 0 120 70" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path className="draw" d="M14 52c14-20 26-22 34-8s20 12 28-6 22-16 30-4" stroke="#ad5541" strokeWidth="2.4" pathLength="1" style={{ "--at": "0.15s", "--len": "0.9s" }} />
              <path d="m78 14 22-9 4 9-22 9Z" fill="#bc9244" stroke="#504936" strokeWidth="1.4" />
              <path d="m78 14-5 9 9 0" stroke="#504936" strokeWidth="1.4" />
            </svg>
            <strong>{room.round.status === "waiting" ? "等待开局" : "出题中"}</strong>
            <p>{room.round.status === "waiting" ? "人齐后由房主开局" : "词语确定后开始作画"}</p>
          </div>
        )}
      </div>
      <p className="canvas-subtitle">
        {waitingForReset
          ? "正在同步画布，请稍候…"
          : isDrawer
            ? "B 画笔 · E 橡皮 · Ctrl / ⌘ Z 撤销"
            : room.round.status === "finished"
              ? "画作保留到下一轮开始"
              : room.round.status === "active"
                ? "看画猜词"
                : ""}
      </p>
    </section>
  );
}
