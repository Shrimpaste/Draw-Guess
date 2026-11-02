// Hand-drawn option symbols: a few pen strokes each, drawn in currentColor.
const paths = {
  pen: ["m5 17 1-5L16 3l4 4-10 10-5 1Z", "m6 12 4 4M14 5l4 4M5 18l-2 3 4-1"],
  eraser: ["m3 14 10-11 8 7-10 11-4-1-4-6Z", "m8 9 8 7M10 21h11"],
  undo: ["M5 8c11-8 21 7 9 12-2 1-4 1-6 0", "m5 3-1 6 7 1"],
  trash: ["m7 7 1 13c3 1 7 1 9-1l1-12M4 6l17-1", "m9 5 1-3 5 1 1 2M11 10v7m3-7 1 7"],
  arrow: ["M3 12c6-1 11 0 17-1", "m14 5 7 6-7 7"],
  check: ["m4 12 5 6C13 12 17 7 21 4"],
  close: ["M5 5c5 5 9 9 14 15M19 5 5 19"],
  copy: ["m8 8 12-1 1 13-12 1-1-13Z", "m5 16-2-1L4 3l12 1v1"],
  clock: ["M12 3C1 2 0 20 11 21c13 2 13-18 1-18Z", "m12 6-1 7 5 3"],
  users: ["M9 4C2 3 3 12 8 12c6 0 6-7 1-8Zm8 2c5-1 6 7 0 7", "M2 21c-1-10 13-11 13-1M17 16c4-1 6 2 5 5"],
  book: ["M12 6C9 3 6 3 2 4l1 15c4-1 6 0 9 2 3-3 6-3 10-3L21 3c-4-1-7 0-9 3Z", "m12 6 0 15M5 8l4 1M5 12l4 1m7-5 3-1m-3 5 3-1"],
  send: ["m3 5 19-3-8 19-3-9-8-7Z", "M11 12 21 3"],
  plus: ["M4 12c6-1 10 0 16-1M12 3l-1 18"],
  crown: ["m3 7 5 4 4-8 4 8 5-5-2 12-14 1-2-12Z", "m6 21 12-1"],
  refresh: ["M4 10c-1-8 14-10 17-2M20 15c-2 8-15 8-17 0", "m16 8 6 1V3M8 15l-6-1v6"],
  star: ["m12 3 2.6 5.6 6 .7-4.5 4 1.3 6-5.4-3.1-5.4 3 1.3-5.9L3.4 9.3l6-.7Z"],
  sound: ["M4 9h4l5-4 .5 14-5.5-4H4Z", "M16.5 9c1.8 1.6 1.8 4.4 0 6", "M19 6.5c3.4 3 3.4 8 0 11"],
  mute: ["M4 9h4l5-4 .5 14-5.5-4H4Z", "m16 9.5 5 5.5", "m21 9-5 6"],
  help: ["M12 3C1 2 0 20 11 21c13 2 13-18 1-18Z", "M9.4 9.6c0-3.3 5.4-3.2 5.2 0-.1 2-2.6 2.1-2.6 4.2", "M12 16.9v.3"],
  leave: ["M11 4H5.5l.4 16H11", "M9 12.2c3.6-.3 7.3 0 11-.2", "m16.5 8 3.8 4.1-3.9 3.9"],
  chevron: ["m8 4 8 8-8 8"],
};

export function SketchIcon({ name = "pen", size = 20, className = "", ...props }) {
  return (
    <svg className={`sketch-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {(paths[name] || paths.pen).map((d, index) => <path key={index} d={d} pathLength="1" style={{ "--i": index }} />)}
    </svg>
  );
}
