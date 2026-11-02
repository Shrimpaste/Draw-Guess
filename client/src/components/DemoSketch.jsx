import { useState } from "react";
import { Button } from "./ui/button.jsx";
import { SketchIcon } from "./ui/sketch-icon.jsx";

// A short replayable round on paper: one player draws, the others guess.
// Every line is drawn along its own path in order; nothing loops on its own.
const outline = [
  ["M180 28C196 50 214 72 233 95C214 120 197 146 181 171C163 146 146 121 127 97C145 74 163 51 180 28Z", 0.1, 0.9],
  ["M180 31C181 80 180 126 181 168", 1.0, 0.35],
  ["M129 97C163 95 199 96 231 95", 1.3, 0.35],
  ["M181 171C175 191 197 203 188 221C182 233 198 240 207 246", 1.65, 0.5],
  ["M178 196l-10-6 1.6 11.4 8.4-5.4 9.6 5.6-1.2-11.2Z", 2.05, 0.3],
  ["M190 224l-10-6 1.6 11.4 8.4-5.4 9.6 5.6-1.2-11.2Z", 2.3, 0.3],
];
const crayon = [
  ["kite-tl", "#ad5541", "M148 74 179 39 136 94 179 55 152 95 179 72 165 95 178 86", 2.55, 0.55],
  ["kite-br", "#bc9244", "M188 101 228 98 186 128 218 102 183 152 205 113 184 164", 2.8, 0.55],
];
const scenery = [
  ["M258 58c-2-10 12-15 18-7 4-9 19-6 19 4 10 0 11 13 1 13h-37c-8 0-9-10-1-10Z", 0.5, 0.6],
  ["M22 238c40-4 82 2 122-2s88 3 196-1", 0.25, 0.6],
];

export function DemoSketch({ onRules }) {
  const [take, setTake] = useState(0);
  return (
    <section className="demo" aria-label="玩法演示">
      <div className="demo-paper paper-sheet" key={take}>
        <svg className="demo-drawing" viewBox="0 0 360 250" fill="none" aria-hidden="true">
          <defs>
            <clipPath id="kite-tl"><path d="M180 28 127 97l53-1Z" /></clipPath>
            <clipPath id="kite-br"><path d="M180 96h53l-52 75Z" /></clipPath>
          </defs>
          {scenery.map(([d, at, length]) => (
            <path key={d} className="draw draw-soft" d={d} pathLength="1" style={{ "--at": `${at}s`, "--len": `${length}s` }} />
          ))}
          {crayon.map(([clip, color, d, at, length]) => (
            <g key={clip} clipPath={`url(#${clip})`}>
              <path className="draw draw-crayon" d={d} pathLength="1" style={{ stroke: color, "--at": `${at}s`, "--len": `${length}s` }} />
            </g>
          ))}
          {outline.map(([d, at, length]) => (
            <path key={d} className="draw" d={d} pathLength="1" style={{ "--at": `${at}s`, "--len": `${length}s` }} />
          ))}
          <path className="draw draw-string" d="M180 96C140 140 92 172 44 232" pathLength="1" style={{ "--at": "2.1s", "--len": "0.5s" }} />
        </svg>
        <div className="demo-guesses" aria-hidden="true">
          <p className="demo-guess demo-guess-wrong" style={{ "--at": "3.25s" }}>
            <b>小圆</b>
            <span>鱼？</span>
          </p>
          <p className="demo-guess demo-guess-right" style={{ "--at": "3.85s" }}>
            <b>阿墨</b>
            <span>风筝</span>
            <svg viewBox="0 0 24 24" fill="none"><path className="draw" d="m4 12 5 6C13 12 17 7 21 4" pathLength="1" style={{ "--at": "4.25s", "--len": "0.3s" }} /></svg>
            <em>+2</em>
          </p>
        </div>
      </div>
      <ol className="demo-steps">
        <li style={{ "--at": "0.1s" }}>一人作画</li>
        <li style={{ "--at": "3.2s" }}>其他人猜词</li>
        <li style={{ "--at": "4.3s" }}>猜中得分</li>
      </ol>
      <div className="demo-actions">
        <Button variant="ghost" size="sm" onClick={() => setTake((value) => value + 1)}>
          <SketchIcon name="refresh" />
          再画一次
        </Button>
        <Button variant="ghost" size="sm" onClick={onRules}>
          <SketchIcon name="help" />
          玩法
        </Button>
      </div>
    </section>
  );
}
