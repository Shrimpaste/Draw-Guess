import { useEffect, useRef } from "react";
import { drawStroke } from "../../components/CanvasBoard.jsx";

// Local study only. The production board owns authoritative epochs and network
// acknowledgement; this input adapter intentionally does not simulate them.
export default function ArtCanvas({ strokes, epoch, roundId, enabled, tool, onStroke, onUndo, onTool }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const latest = useRef(null);
  latest.current = { strokes, enabled, tool, onStroke, epoch, roundId };

  function paint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.setTransform(canvas.width / 960, 0, 0, canvas.height / 620, 0, 0);
    context.clearRect(0, 0, 960, 620);
    latest.current.strokes.forEach((stroke) => drawStroke(context, stroke));
    const active = activeRef.current;
    if (active) {
      const confirmed = latest.current.strokes.find((stroke) => stroke.id === active.id)?.points.length || 0;
      if (confirmed < active.points.length) drawStroke(context, { ...active, points: active.points.slice(Math.max(0, confirmed - 1)) });
    }
  }
  function requestPaint() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => { frameRef.current = null; paint(); });
  }
  function cancel() {
    clearInterval(timerRef.current);
    activeRef.current = null;
  }
  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 960 * ratio;
    canvas.height = 620 * ratio;
    requestPaint();
    return () => { cancel(); cancelAnimationFrame(frameRef.current); };
  }, []);
  useEffect(() => { cancel(); requestPaint(); }, [epoch, roundId, enabled]);
  useEffect(requestPaint, [strokes]);
  function point(event) {
    const bounds = canvasRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(960, (event.clientX - bounds.left) / bounds.width * 960)), y: Math.max(0, Math.min(620, (event.clientY - bounds.top) / bounds.height * 620)) };
  }
  function flush() {
    const stroke = activeRef.current;
    if (!stroke || !latest.current.enabled || stroke.sent === stroke.points.length) return;
    latest.current.onStroke({ id: stroke.id, color: stroke.color, width: stroke.width, tool: stroke.tool, points: stroke.points.slice(stroke.sent), offset: stroke.sent }, stroke.roundId, stroke.epoch);
    stroke.sent = stroke.points.length;
  }
  function finish(event) {
    const stroke = activeRef.current;
    if (!stroke || (event && event.pointerId !== stroke.pointerId)) return;
    flush();
    cancel();
    if (canvasRef.current.hasPointerCapture?.(stroke.pointerId)) canvasRef.current.releasePointerCapture(stroke.pointerId);
    requestPaint();
  }
  return <canvas
    ref={canvasRef} className="art-canvas" aria-label="绘画画布" role="img"
    tabIndex={enabled ? 0 : undefined} style={{ touchAction: enabled ? "none" : "pan-y" }}
    onKeyDown={(event) => {
      if (!enabled) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); finish(); onUndo(); }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && ["b", "e"].includes(event.key.toLowerCase())) { event.preventDefault(); onTool(event.key.toLowerCase() === "b" ? "pen" : "eraser"); }
    }}
    onPointerDown={(event) => {
      if (!enabled || event.button !== 0 || activeRef.current) return;
      event.preventDefault();
      canvasRef.current.focus({ preventScroll: true });
      canvasRef.current.setPointerCapture?.(event.pointerId);
      activeRef.current = { ...tool, id: crypto.randomUUID(), points: [point(event)], pointerId: event.pointerId, sent: 0, epoch, roundId };
      flush(); requestPaint();
      timerRef.current = setInterval(flush, 25);
    }}
    onPointerMove={(event) => {
      const stroke = activeRef.current;
      if (!enabled || !stroke || stroke.pointerId !== event.pointerId) return;
      const next = point(event), previous = stroke.points.at(-1);
      if (Math.hypot(next.x - previous.x, next.y - previous.y) < .6) return;
      stroke.points.push(next); requestPaint();
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
  />;
}
