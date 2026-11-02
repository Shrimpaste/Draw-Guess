// A selection mark drawn as one pen stroke. CSS draws it when its control becomes
// selected and erases it backwards from the current ink when the selection leaves.
const marks = {
  ring: ["0 0 100 100", "M56 8C81 7 94 26 93 50C92 76 73 93 48 92C23 91 7 74 8 48C9 26 28 10 62 12"],
  underline: ["0 0 100 12", "M4 7.5C28 3.5 58 9.5 96 4.5"],
};

export function SketchMark({ variant = "ring", className = "" }) {
  const [viewBox, d] = marks[variant];
  return (
    <svg className={`sketch-mark sketch-mark-${variant} ${className}`} viewBox={viewBox} preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d={d} pathLength="1" />
    </svg>
  );
}
