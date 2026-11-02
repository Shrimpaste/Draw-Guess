import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./motion.js";

// Short labels written in real stroke order from ordered medians (1024 box, y up).
// Erasing runs backwards from the current ink amount; a new label is written only
// after the old one is empty, and a shared leading phrase stays on the paper.
const ADVANCE = 930;
const PEN_LIFT = 150;
const WRITE_SPEED = 12500;
const ERASE_SPEED = 17000;
const punctuation = new Set(["！", "？", "，", "。", "…", "·"]);

function strokePath(flat) {
  const points = [];
  for (let index = 0; index < flat.length; index += 2) points.push([flat[index], 900 - flat[index + 1]]);
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  let d = `M${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) d += `L${points[1][0]} ${points[1][1]}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index], [nx, ny] = points[index + 1];
    d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  if (points.length > 2) d += `L${points.at(-1)[0]} ${points.at(-1)[1]}`;
  return { d, length: Math.max(length, 1) };
}

// Stroke data is a separate chunk so the first screen does not wait for it.
let hanziMedians = null;
let loading = null;
export function loadMedians() {
  loading ||= import("./hanzi-medians.js")
    .then((module) => (hanziMedians = module.hanziMedians))
    .catch(() => (hanziMedians = {}));
  return loading;
}

const layouts = new Map();
export function inkLayout(text) {
  if (!hanziMedians) return null;
  if (layouts.has(text)) return layouts.get(text);
  const chars = Array.from(text || "");
  let layout = null;
  if (chars.length && chars.every((char) => hanziMedians[char] || punctuation.has(char))) {
    let cursor = 0, x = 0;
    const glyphs = chars.map((char) => {
      const glyph = { char, x, strokes: [] };
      if (punctuation.has(char)) {
        x += ADVANCE * 0.4;
        glyph.mark = char;
        return glyph;
      }
      for (const flat of hanziMedians[char]) {
        const stroke = strokePath(flat);
        glyph.strokes.push({ ...stroke, start: cursor });
        cursor += stroke.length + PEN_LIFT;
      }
      x += ADVANCE;
      return glyph;
    });
    layout = { glyphs, width: x + 94, total: cursor };
  }
  layouts.set(text, layout);
  return layout;
}

export function sharedInk(from, to) {
  const a = Array.from(from || ""), b = Array.from(to || "");
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length += 1;
  if (!length || !inkLayout(from) || !inkLayout(to)) return 0;
  return inkLayout(a.slice(0, length).join("")).total;
}

export function InkWord({ text, className = "" }) {
  const still = usePrefersReducedMotion();
  const id = useId().replaceAll(":", "");
  const [ready, setReady] = useState(() => !!hanziMedians);
  const [shown, setShown] = useState(text);
  const [cursor, setCursor] = useState(() => (still ? Infinity : 0));
  const live = useRef({ cursor: still ? Infinity : 0, target: text, shown: text });
  const frame = useRef(null);
  const layout = inkLayout(shown);

  useEffect(() => {
    if (!ready) loadMedians().then(() => setReady(true));
  }, [ready]);
  useEffect(() => {
    if (!ready) return undefined;
    const state = live.current;
    state.target = text;
    // Static text has no ink to erase, so an unwritable label is replaced at once.
    if (still || !inkLayout(state.shown)) {
      state.shown = text;
      state.cursor = still ? Infinity : 0;
      setShown(text);
      setCursor(state.cursor);
      if (still || !inkLayout(text)) return undefined;
    }
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const total = inkLayout(state.shown)?.total ?? 0;
      if (state.cursor > total) state.cursor = total;
      if (state.shown !== state.target) {
        const kept = sharedInk(state.shown, state.target);
        state.cursor = Math.max(kept, state.cursor - ERASE_SPEED * dt);
        if (state.cursor === kept) {
          state.shown = state.target;
          setShown(state.target);
        }
      } else {
        state.cursor = Math.min(total, state.cursor + WRITE_SPEED * dt);
      }
      setCursor(state.cursor);
      const done = state.shown === state.target && (!inkLayout(state.shown) || state.cursor >= total);
      frame.current = done ? null : requestAnimationFrame(step);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [text, still, ready]);

  const strokes = useMemo(() => layout?.glyphs.flatMap((glyph) => glyph.strokes.map((stroke, index) => ({ ...stroke, x: glyph.x, key: `${glyph.x}-${index}` }))) || [], [layout]);
  if (!ready)
    return (
      <span className={`ink-word ${className}`}>
        <span className="sr-only">{text}</span>
        <span className="ink-word-pending" aria-hidden="true" style={{ width: `${Array.from(text || "").length * 1.02}em` }} />
      </span>
    );
  if (!layout) return <span className={`ink-word ink-word-static ${className}`}>{shown}</span>;
  // The written label is decoration; assistive tech always reads the current state.
  return (
    <span className={`ink-word ${className}`}>
      <span className="sr-only">{text}</span>
      <svg viewBox={`-60 -40 ${layout.width} 1060`} aria-hidden="true" style={{ aspectRatio: `${layout.width} / 1060` }}>
        <defs>
          <pattern id={`${id}-pigment`} width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
            <rect width="46" height="46" fill="currentColor" />
            <path d="M0 9h30M12 24h34M-4 38h22" stroke="#f1ebde" strokeWidth="5" opacity=".28" />
            <path d="M4 16h14M26 31h12" stroke="#2d281d" strokeWidth="4" opacity=".14" />
          </pattern>
          <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="-60" y="-40" width={layout.width} height="1060">
            <g fill="none" stroke="#fff" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round">
              {strokes.map((stroke) => {
                const visible = Math.max(0, Math.min(stroke.length, cursor - stroke.start));
                return visible > 0 && <path key={stroke.key} d={stroke.d} transform={`translate(${stroke.x} 0)`} strokeDasharray={`${visible} ${stroke.length + 80}`} />;
              })}
            </g>
          </mask>
        </defs>
        <rect x="-60" y="-40" width={layout.width} height="1060" fill={`url(#${id}-pigment)`} mask={`url(#${id}-reveal)`} />
        {cursor >= layout.total && layout.glyphs.filter((glyph) => glyph.mark).map((glyph) => (
          <text key={glyph.x} x={glyph.x + 150} y="820" fontSize="900" textAnchor="middle" fill="currentColor">{glyph.mark}</text>
        ))}
      </svg>
    </span>
  );
}
