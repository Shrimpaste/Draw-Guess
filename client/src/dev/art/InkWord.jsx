import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { hanziMedians } from "./generated/hanzi-medians.js";

// Short status labels written in real stroke order from ordered medians
// (hanzi-writer-data, 1024 box, y up). Erasing runs backwards from the current
// ink amount, and a new label is written only after the old one is empty.
export const StillContext = createContext(false);

const ADVANCE = 930;
const PEN_LIFT = 150;
const WRITE_SPEED = 12000;
const ERASE_SPEED = 16000;
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

export function inkLayout(text) {
  const chars = Array.from(text);
  if (!chars.length || chars.some((char) => !hanziMedians[char] && !punctuation.has(char))) return null;
  let cursor = 0;
  let x = 0;
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
  return { glyphs, width: x + 94, total: cursor };
}

// Ink covering the leading characters both labels share. Those glyphs sit at
// identical positions, so they stay written while only the tail is replaced.
export function sharedInk(from, to) {
  const a = Array.from(from), b = Array.from(to);
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length += 1;
  if (!length || !inkLayout(from) || !inkLayout(to)) return 0;
  return inkLayout(a.slice(0, length).join("")).total;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function InkWord({ text, className = "", color = "#504936" }) {
  const forcedStill = useContext(StillContext);
  const reducedMotion = usePrefersReducedMotion();
  const still = forcedStill || reducedMotion;
  const id = useId().replaceAll(":", "");
  const [shown, setShown] = useState(text);
  const layout = useMemo(() => inkLayout(shown), [shown]);
  const [cursor, setCursor] = useState(() => still ? Infinity : 0);
  const live = useRef({ cursor: still ? Infinity : 0, target: text, shown: text });
  const frame = useRef(null);

  useEffect(() => {
    live.current.target = text;
    if (still) {
      live.current.shown = text;
      live.current.cursor = Infinity;
      setShown(text);
      setCursor(Infinity);
      return undefined;
    }
    let last = performance.now();
    const step = (now) => {
      const state = live.current;
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
      const done = state.shown === state.target && state.cursor >= total;
      frame.current = done ? null : requestAnimationFrame(step);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [text, still]);

  if (!layout) return <span className={`art-ink art-ink-static ${className}`}>{text}</span>;
  return <span className={`art-ink ${className}`}>
    <span className="art-sr-only">{text}</span>
    <svg viewBox={`-60 -40 ${layout.width} 1060`} aria-hidden="true" style={{ aspectRatio: `${layout.width} / 1060` }}>
      <defs>
        <pattern id={`${id}-pigment`} width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
          <rect width="46" height="46" fill={color} />
          <path d="M0 9h30M12 24h34M-4 38h22" stroke="#f1ebde" strokeWidth="5" opacity=".3" />
          <path d="M4 16h14M26 31h12" stroke="#2d281d" strokeWidth="4" opacity=".14" />
        </pattern>
        <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="-60" y="-40" width={layout.width} height="1060">
          <g fill="none" stroke="#fff" strokeWidth="78" strokeLinecap="round" strokeLinejoin="round">
            {layout.glyphs.flatMap((glyph) => glyph.strokes.map((stroke, index) => {
              const visible = Math.max(0, Math.min(stroke.length, cursor - stroke.start));
              return visible > 0 && <path key={`${glyph.x}-${index}`} d={stroke.d} transform={`translate(${glyph.x} 0)`} pathLength={stroke.length} strokeDasharray={`${visible} ${stroke.length + 80}`} />;
            }))}
          </g>
        </mask>
      </defs>
      <rect x="-60" y="-40" width={layout.width} height="1060" fill={`url(#${id}-pigment)`} mask={`url(#${id}-reveal)`} />
      {layout.glyphs.filter((glyph) => glyph.mark).map((glyph) => cursor >= layout.total && <text key={glyph.x} x={glyph.x + 150} y="820" fontSize="900" textAnchor="middle" fill={color} className="art-ink-mark">{glyph.mark}</text>)}
    </svg>
  </span>;
}
