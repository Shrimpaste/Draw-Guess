import { useId } from "react";

// Original vector drawings for the art study. No external art or motion runtime.
const colors = {
  paper: "#f1ebde", ink: "#504936", blue: "#4c6091", red: "#ad5541",
  gold: "#bc9244", green: "#66795a", pale: "#d4c8ad", wood: "#d5b779",
};

function ArtDefs({ id }) {
  return <defs>
    <pattern id={`${id}-grain`} width="13" height="17" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
      <path d="M1 2 10 2.5M-2 8.6 5.5 8M8 13 14 12.5" stroke={colors.paper} strokeWidth="1.1" opacity=".38" />
      <path d="M3 5 11 5.4M-3 15 3 14.5" stroke={colors.ink} strokeWidth=".6" opacity=".16" />
    </pattern>
    <pattern id={`${id}-hatch`} width="8" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(19)">
      <path d="m1 0 .8 7M5 2l.2 7" fill="none" stroke={colors.ink} strokeWidth=".7" opacity=".23" />
    </pattern>
  </defs>;
}

function Pigment({ d, color, id, shade = false, ...props }) {
  return <g {...props}>
    <path d={d} fill={color} />
    <path d={d} fill={`url(#${id}-grain)`} />
    {shade && <path d={d} fill={`url(#${id}-hatch)`} />}
  </g>;
}

function Pencil({ id, x, y, length, color, angle }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <Pigment id={id} color={color} d={`M-5 17 4 15 5 ${length} -4 ${length + 1}Z`} />
    <path d={`M1 17 2 ${length}`} stroke={colors.paper} strokeWidth="1.5" opacity=".45" />
    <path d={`M-5 18 -4 ${length}M4 18 5 ${length}`} stroke={colors.ink} strokeWidth="1.1" opacity=".62" />
    <path d="M-5 17-.7-1 4 15 .4 20-2 18Z" fill={colors.wood} />
    <path d="M-.7-1-2.4 6 .8 5.7Z" fill={color} stroke={colors.ink} strokeWidth=".65" />
    <path d="m-.7 7-1 9M1.5 10 2 16" fill="none" stroke="#947348" strokeWidth=".7" />
    <path d={`m-2 ${length - 19} 4-.3m-4 4.2 4-.5`} fill="none" stroke={colors.paper} strokeWidth=".65" opacity=".64" />
  </g>;
}

export function PencilCup(props) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 320 230" fill="none" aria-hidden="true" {...props}>
    <ArtDefs id={id} />
    <path d="M26 203c20-11 56-10 85-8 48-9 112-3 150 4 37 7 25 16-19 17-75 5-149 1-210-5" fill="#a69675" opacity=".12" />
    <path d="m49 171 94-17 101 22-25 42-108-5Z" fill="#ded3bb" />
    <path d="m46 167 96-17 99 23-23 40-107-5Z" fill="#f8f0dd" stroke="#b6a98b" strokeWidth="1.1" />
    <path d="m182 159 30 7-6 11-23-5ZM77 192l68 7m-51 1 48 6" stroke="#b4a482" strokeWidth="1.1" opacity=".57" />
    <Pigment id={id} color="#d5bf85" d="m95 161 23-6 24 18-17 8-26-14Z" opacity=".6" />
    <path d="m220 194-10 17 12-1Z" fill="#e0d5be" />
    <path d="M113 106c6-10 73-15 87-4l-2 11-81 6Z" fill="#32425f" />
    <Pencil id={id} x={135} y={29} length={132} color={colors.red} angle={-17} />
    <Pencil id={id} x={155} y={14} length={144} color={colors.gold} angle={-7} />
    <Pencil id={id} x={169} y={46} length={115} color={colors.green} angle={8} />
    <Pencil id={id} x={205} y={24} length={142} color={colors.blue} angle={19} />
    <Pencil id={id} x={188} y={60} length={104} color="#78648b" angle={6} />
    <g transform="translate(120 51) rotate(-27)">
      <path d="M0 0C-7-3-8 14-5 28L2 32 6 27C7 14 8-2 0 0Z" fill="#736049" />
      <path d="M-4 7c1 4 1 14 2 18M2 2c-1 7 1 14 0 23M5 6 3 24" stroke="#b5976e" strokeWidth="1" />
      <path d="m-4 28 10-1-1 15-7 1Z" fill="#b4b1a0" stroke="#6a6a60" strokeWidth="1" />
      <path d="m-3 32 8-1m-8 7 7-1" stroke="#ded8c9" strokeWidth="1.5" />
      <Pigment id={id} color="#b88850" d="m-2 43 7-1-2 105-3 1Z" />
    </g>
    <path d="M112 105c5 10 76 14 90-3l-5 91c-4 14-69 19-80 1Z" fill="#d8decd" />
    <Pigment id={id} color={colors.blue} d="M112 106c13 13 67 13 90-3l-5 88c-6 15-68 21-80 3Z" />
    <Pigment id={id} color="#39496d" d="M184 115c9-2 15-6 18-10l-5 86c-3 8-17 12-28 14l7-29 1-57Z" shade />
    <path d="M113 105c11 15 72 12 89-3M118 190c15 11 57 12 78-3" stroke="#354566" strokeWidth="1.8" />
    <path d="M117 110c19 11 61 11 81-1M122 118l3 64m5-59 3 66m5-67 3 58" stroke="#d1d7d7" strokeWidth="1.4" opacity=".53" />
    <path d="m146 125 4 6m-4 21 3 4m12-34 2 14m-2 17 1 26m8-54 1 21m-23 29 2 17m10-8 1 9m22-49-3 35" stroke="#b2bed0" strokeWidth="1.2" opacity=".44" />
    <path d="M114 106 118 192c7 17 67 15 79-1l5-87" stroke="#414b5c" strokeWidth="1.3" />
    <path d="m133 150 26-4 3 23-26 4Z" fill="#e5d9b8" stroke="#8d886e" strokeWidth=".8" />
    <path d="m138 157 15-2m-14 6 12-2m-11 5 15-2" stroke="#82785d" strokeWidth="1.1" />
    <path d="m134 151 3 20m20-23 3 21" stroke="#f9f0d9" strokeWidth="1" />
    <g transform="translate(227 174) rotate(14)">
      <path d="m0 1 38-7 13 15-36 9Z" fill="#b77b68" />
      <Pigment id={id} color="#c68775" d="m0 1 38-7 3 18-35 9Z" />
      <path d="m38-6 13 15-2 15-8-12Z" fill="#985b4e" />
      <path d="m6 21 35-9 8 12-34 10Z" fill="#c5b798" />
      <Pigment id={id} color="#d9caa7" d="m0 1 23-4 7 20-24 4Z" />
      <path d="m5 7 17-3m-14 9 15-4m-12 9 13-4" stroke="#a18f6d" strokeWidth=".8" />
      <path d="m0 1 6 20 9 13 34-10 2-15L38-6Z" stroke="#856d57" strokeWidth="1.1" />
    </g>
    <g transform="translate(54 190) rotate(-15)">
      <path d="M0 0c9-6 25-6 33-1L28 16c-7 4-20 5-27-1Z" fill="#ad5541" />
      <Pigment id={id} color="#c66b4f" d="M0 0c8-6 26-6 33-1L24 9 1 9Z" />
      <path d="m10-2 16 1-6 10-15-1Z" fill="#c2b7a2" stroke="#665e4a" strokeWidth="1" />
      <path d="m8 1 14 1-3 5-14-1Z" fill="#e3dccb" />
      <path d="m12 3 4 1m-2-2-1 3" stroke="#625e4c" strokeWidth="1.4" />
      <path d="m25 12 3-1-1 4-4 2Z" fill="#634f3d" />
      <path d="M1 9c8 3 19 1 23 0L33-1" stroke="#8d4737" strokeWidth="1.1" />
    </g>
    <path d="M83 218c-7-2-10-7-6-10 3-3 9 3 6 5-2 2-5-1-4-2m14 7 5-4m179 5 3-4m-183-2-3-2" stroke="#b38a54" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}

function Leaf({ id, d, vein, color = colors.green }) {
  return <g>
    <Pigment id={id} d={d} color={color} />
    <path d={vein} stroke="#d1cf9d" strokeWidth="1" opacity=".88" />
    <path d={d} stroke="#4c624b" strokeWidth=".75" opacity=".72" />
  </g>;
}

function Botanical({ id }) {
  return <>
    <path d="M47 116c19-6 108-7 130 0" stroke="#a69878" strokeWidth="5" opacity=".15" />
    <g transform="rotate(-8 79 90)">
      <Pigment id={id} color={colors.red} d="m53 80 47-1-7 35c-4 6-29 7-34 1Z" />
      <Pigment id={id} color="#894536" d="m88 84 11-4-6 34c-2 3-5 5-12 5Z" shade />
      <path d="M50 77c11-4 44-4 52 0l-2 10c-13 3-33 4-48 0Z" fill="#bd7150" stroke="#85513c" strokeWidth="1.1" />
      <path d="M52 76c12-4 38-5 47 1-7 4-33 5-47-1Z" fill="#68533b" />
      <path d="m58 92 4 17m6-17 3 21m6-22 1 16" stroke="#daa676" strokeWidth="1.5" opacity=".7" />
      <path d="M77 79c-2-29-2-48 7-66m-8 48L57 40m20 8 21-15m-20 1-10-17m11 52 22-14" stroke="#62704e" strokeWidth="2" />
      <Leaf id={id} d="M76 60C59 61 47 49 45 32c14 2 27 8 31 28Z" vein="M74 57 50 37m9 9-7 1m14 2-2-8" />
      <Leaf id={id} d="M78 45C81 25 99 19 112 22c-6 15-15 26-34 23Z" vein="M82 41 106 26m-10 6-1-7m-2 10 9 0" color="#84925e" />
      <Leaf id={id} d="M79 32C66 28 61 16 65 6c9 3 15 11 14 26Z" vein="M77 28 68 11m5 10-5-1" />
      <Leaf id={id} d="M80 20C78 8 88 1 97 3c-1 11-6 16-17 17Z" vein="M82 17 93 6" color="#899663" />
      <Leaf id={id} d="M79 70c7-20 22-22 37-18-8 14-21 20-37 18Z" vein="m84 67 25-12m-14 7 1-7m4 5 7 2" color="#7c8753" />
      <path d="M62 84c6 2 24 2 31-1" stroke="#db9670" strokeWidth="1" />
    </g>
    <g transform="rotate(16 157 80)">
      <path d="M119 91c14-16 26-33 49-54M150 56l3-22m-18 40-22-3m30-6 24 0" stroke="#737d50" strokeWidth="1.4" />
      <Leaf id={id} d="M149 58c-11-7-13-17-9-27 10 5 15 16 9 27Z" vein="m148 52-5-14" color="#83905e" />
      <Leaf id={id} d="M158 47c-1-16 9-22 20-24 0 13-7 21-20 24Z" vein="m161 42 12-14" />
      <Leaf id={id} d="M140 69c9-11 23-10 30-5-8 10-20 13-30 5Z" vein="m145 68 17-2" />
      <Leaf id={id} d="M134 75c-16 0-24-7-26-19 12 0 23 7 26 19Z" vein="m130 71-16-11" color="#919560" />
      <path d="m119 91 12-12m-8 15 11-12" stroke="#ab8250" strokeWidth="1.5" />
    </g>
    <path d="m155 108 7-3 6 2-4 5-9-1m18 4 5-2 4 2-1 3-6 1" fill="#a78c58" opacity=".75" />
  </>;
}

function Pantry({ id }) {
  return <>
    <path d="M37 113c32-6 131-8 155 0" stroke="#a69878" strokeWidth="6" opacity=".15" />
    <g transform="rotate(-9 149 75)">
      <path d="M124 48c2-4 48-5 54 0l-1 60c-8 6-40 6-51 1Z" fill="#b8beb2" stroke="#747d71" strokeWidth="1" />
      <Pigment id={id} color="#718385" d="M127 50c12 4 36 4 48-1l-1 56c-10 5-35 5-45 1Z" />
      <path d="M130 59c10 3 30 2 43 0l-1 37c-15 4-29 3-42-1Z" fill="#dfd0ac" />
      <path d="M128 51c8 4 37 4 48-1m-46 54c11 5 32 4 43 0" stroke="#e7e0cc" strokeWidth="1.5" />
      <path d="M125 47c8-5 44-5 53 0-5 6-47 7-53 0Z" fill="#cbd0c3" stroke="#747d71" strokeWidth="1" />
      <path d="M132 47c6-2 34-3 39 0" stroke="#9aab9d" strokeWidth="1" />
      <path d="M149 47c-6-9 11-11 10-3-1 4-5 5-10 3Z" stroke="#5d716c" strokeWidth="2" />
      <Pigment id={id} color={colors.blue} d="M137 77c10-11 19-11 28-3l7-5-1 16-7-6c-9 9-18 9-27-2Z" />
      <path d="m150 71-3 9m8-10-4 12" stroke="#d4d7bc" strokeWidth="1" />
      <circle cx="142" cy="76" r="1.3" fill="#3b4b5c" />
      <path d="m139 89 21-1m-19-25 23-1" stroke="#a38860" strokeWidth="1" />
    </g>
    <g transform="rotate(10 83 76)">
      <Pigment id={id} color={colors.gold} d="M89 32c13 4 7 17 16 32 11 19 9 35-3 44-13 8-34 5-43-7-13-17 0-31 11-45 9-11 7-25 19-24Z" />
      <Pigment id={id} color="#9a763c" d="M101 66c12 20 10 33 0 41-6 5-13 6-22 3 17-7 22-21 22-44Z" />
      <path d="M80 42c-3 15-12 25-15 36m-3 7c-2 10 4 16 9 20m5-54-6 11" stroke="#e5cd8a" strokeWidth="2" />
      <path d="M87 36c-3-9 0-15 5-18" stroke="#745d3c" strokeWidth="3" />
      <Leaf id={id} d="M90 30c6-16 20-15 27-10-8 10-16 15-27 10Z" vein="m95 27 16-6" />
      <path d="m84 107 6 1m-19-21 1-1m20-30 1 1m5 39 1 1m-17 2 1 1m-3-25 1-1" stroke="#7e693d" strokeWidth="1.3" strokeLinecap="round" />
    </g>
    <Pigment id={id} color="#ac503b" d="M40 87c7-8 16-6 20-2 13-1 21 7 19 19-2 15-18 21-29 17-18 0-26-22-10-34Z" />
    <path d="M46 88c-10 6-12 17-5 24m11-24c-8 11-7 24-3 29m10-28c11 3 13 16 6 26" stroke="#d07950" strokeWidth="1.5" />
    <path d="m54 88-13-9 12 3 3-10 3 10 11-3-8 8 2 7-8-5-6 6Z" fill="#61724d" />
    <path d="m56 84 3-10m-13 9 10 5 11-6" stroke="#889264" strokeWidth="1" />
  </>;
}

function Oddities({ id }) {
  return <>
    <path d="M47 116c26-6 106-6 134 0" stroke="#a69878" strokeWidth="5" opacity=".15" />
    <g transform="rotate(-16 76 70)">
      <Pigment id={id} color={colors.gold} d="M97 17C65 9 37 33 40 64c2 31 35 48 59 30-23 4-41-9-43-30-2-20 13-43 41-47Z" />
      <Pigment id={id} color="#9b763e" d="M42 64c4 26 32 39 55 31-19 15-48 7-55-14-3-8-3-14-2-21Z" />
      <path d="M76 20c-19 5-31 19-32 35m1 9c2 14 10 22 19 26m-12-58-3 7m19-15-5 5M48 78l4 6" stroke="#e3c987" strokeWidth="1.8" />
      <path d="M67 56q5-5 10-1m-3-1 1 5m-5 13 7 1" stroke="#7f6139" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m85 65 4 3-5 1" stroke="#95733b" strokeWidth="1.1" />
    </g>
    <g transform="translate(136 61) rotate(15)">
      <Pigment id={id} color={colors.blue} d="M0 0C-10-20-29-25-37-13c-9 14 1 29 35 23-17 10-20 24-10 28 9 3 16-7 15-27 9 19 19 24 25 18 8-7-3-18-18-23 28-1 31-17 21-27C22-30 9-22 0 0Z" />
      <Pigment id={id} color="#7d86a1" d="M-5-1C-13-17-24-22-30-14c-6 10 2 16 23 18ZM9 0c15-3 20-12 14-17C17-23 10-12 9 0Z" />
      <path d="M-30-11c8-1 15 4 21 12m-18-1c5 5 11 6 18 5m-2 13 7-7m15-26L7-2m15-8L9 2m10 17L7 10" stroke="#c4c8c5" strokeWidth="1.1" />
      <path d="M-1-7c-1 12 0 25 4 27 3-5 2-20-1-27" fill="#695439" stroke="#514b3a" strokeWidth="1" />
      <path d="m-1-6-6-9M1-6l6-13" stroke="#63563e" strokeWidth="1.1" />
      <circle cx="-23" cy="-9" r="4" fill="#aa8d57" /><circle cx="-23" cy="-9" r="2" fill="#4d596f" />
      <circle cx="19" cy="-12" r="3.5" fill="#aa8d57" /><circle cx="19" cy="-12" r="1.5" fill="#4d596f" />
    </g>
    <g transform="translate(163 99) rotate(23)">
      <path d="M0 0c-5-6-4-16 3-17 9-2 13 11 6 15L9 21l-6 1-1-5-6 1v-6l6-1L2 1Z" fill="#b4914f" stroke="#826c43" strokeWidth="1.2" />
      <path d="M2-7c-2-6 5-8 6-3 1 5-4 8-6 3Z" fill={colors.paper} />
      <path d="m6 0 1 17m-7-4 4-1" stroke="#e0c68b" strokeWidth="1" />
    </g>
    <path d="m116 19 2 5 6 1-5 4 1 6-5-3-5 3 1-6-4-4 6-1Zm72 52 1 4 4 1-3 2v4l-3-2-4 2 1-4-3-3 4-1Z" fill="#b59650" />
  </>;
}

export function PackArtwork({ kind = "botanical", ...props }) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 220 130" fill="none" aria-hidden="true" {...props}>
    <ArtDefs id={id} />
    {kind === "pantry" ? <Pantry id={id} /> : kind === "oddities" ? <Oddities id={id} /> : kind === "animals" ? <>
      <path d="M44 116c30-6 108-7 132 0" stroke="#a69878" strokeWidth="5" opacity=".15" />
      <AvatarArtwork kind="fish" x="108" y="44" width="78" height="78" />
      <AvatarArtwork kind="bird" x="42" y="18" width="92" height="92" />
    </> : <Botanical id={id} />}
  </svg>;
}

export function AvatarArtwork({ kind = "bird", ...props }) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
    <ArtDefs id={id} />
    {kind === "pear" ? <>
      <Pigment id={id} color={colors.gold} d="M31 13c10-1 9 9 15 18 9 13 3 25-10 27-16 2-25-7-21-20 3-9 11-13 11-21Z" />
      <path d="M38 31c9 16 4 22-5 26m-9-24c-5 7-6 14-2 18" stroke="#997738" strokeWidth="1.4" />
      <path d="m32 14 3-9" stroke="#665439" strokeWidth="2.3" />
      <Leaf id={id} d="M34 13c2-10 12-10 17-6-3 7-9 10-17 6Z" vein="m38 11 8-3" />
      <path d="m28 43 1 1m6-14 1 1m-1 21 1-1" stroke="#7f683b" strokeWidth="1.2" />
    </> : kind === "fish" ? <>
      <Pigment id={id} color={colors.blue} d="M7 34c8-22 29-21 40-9l11-9-2 30-12-9C29 52 14 49 7 34Z" />
      <path d="m23 20 8-9 6 11m-12 23 10 10 4-12" fill="#bc9244" stroke="#8f7545" strokeWidth="1" />
      <path d="M20 24c-4 7-3 13 0 18m9-17-2 5 4 5-3 5m8-14-2 5 4 4-3 5m15-13 5 12m-1-15-1 7" stroke="#bdc9cf" strokeWidth="1.1" />
      <circle cx="14.5" cy="31" r="2" fill="#343f5b" />
      <path d="m8 36 5 1" stroke="#354363" strokeWidth="1" />
    </> : kind === "moon" ? <>
      <Pigment id={id} color={colors.gold} d="M40 7C21 3 7 18 9 35c3 20 24 29 41 15-14 3-28-4-29-17C19 20 26 11 40 7Z" />
      <path d="M27 10C10 19 12 37 23 45m2 3 7 4M21 28l4-2m1-1 1 5m-3 8 5 1" stroke="#886936" strokeWidth="1.2" strokeLinecap="round" />
      <path d="m45 18 2 6 6 1-5 4 1 6-5-3-5 3 1-6-4-4 6-1Z" fill={colors.blue} />
    </> : <>
      <path d="m28 48-3 9m9-10 2 8m-13 2 7 1m2-3 7 1" stroke="#9c7845" strokeWidth="1.5" strokeLinecap="round" />
      <Pigment id={id} color={colors.red} d="M14 33C8 15 24 9 34 17c9-1 15 8 14 17 0 12-10 19-23 16L10 52l6-10Z" />
      <Pigment id={id} color="#bd795a" d="M27 29c-10-1-11 11-4 16 10 6 20 0 21-7-9 3-13 0-17-9Z" />
      <path d="m45 25 12 5-11 4" fill={colors.gold} stroke="#946943" strokeWidth=".8" />
      <path d="m23 34 5 7m1-8 5 7m-14 7-5 3m-1-28 5 1" stroke="#e2ab7f" strokeWidth="1.2" />
      <circle cx="38" cy="24" r="2.2" fill="#473e32" />
      <circle cx="38.5" cy="23.4" r=".7" fill={colors.paper} />
    </>}
  </svg>;
}

const iconPaths = {
  pen: ["m5 17 1-5L16 3l4 4-10 10-5 1Z", "m6 12 4 4M14 5l4 4M5 18l-2 3 4-1"],
  pencil: ["m5 17 1-5L16 3l4 4-10 10-5 1Z", "m6 12 4 4M14 5l4 4M5 18l-2 3 4-1"],
  eraser: ["m3 14 10-11 8 7-10 11-4-1-4-6Z", "m8 9 8 7M10 21h11"],
  undo: ["M5 8c11-8 21 7 9 12-2 1-4 1-6 0", "m5 3-1 6 7 1"],
  trash: ["m7 7 1 13c3 1 7 1 9-1l1-12M4 6l17-1", "m9 5 1-3 5 1 1 2M11 10v7m3-7 1 7"],
  arrow: ["M3 12c6-1 11 0 17-1", "m14 5 7 6-7 7"],
  check: ["m4 12 5 6C13 12 17 7 21 4"],
  cross: ["M5 5c5 5 9 9 14 15M19 5 5 19"],
  close: ["M5 5c5 5 9 9 14 15M19 5 5 19"],
  copy: ["m8 8 12-1 1 13-12 1-1-13Z", "m5 16-2-1L4 3l12 1v1"],
  clock: ["M12 3C1 2 0 20 11 21c13 2 13-18 1-18Z", "m12 6-1 7 5 3"],
  users: ["M9 4C2 3 3 12 8 12c6 0 6-7 1-8Zm8 2c5-1 6 7 0 7", "M2 21c-1-10 13-11 13-1M17 16c4-1 6 2 5 5"],
  book: ["M12 6C9 3 6 3 2 4l1 15c4-1 6 0 9 2 3-3 6-3 10-3L21 3c-4-1-7 0-9 3Z", "m12 6 0 15M5 8l4 1M5 12l4 1m7-5 3-1m-3 5 3-1"],
  settings: ["m9 3 5-1 1 4 3 1 3-1 2 5-4 2v3l1 2-4 3-3-2-3 1-1 2-5-3 1-3-1-3-3-1 1-5 4 1 3-2V3Z", "M11 8c-5 1-3 9 2 7 5-1 3-8-2-7Z"],
  chevron: ["m8 4 8 8-8 8"],
  send: ["m3 5 19-3-8 19-3-9-8-7Z", "M11 12 21 3"],
  plus: ["M4 12c6-1 10 0 16-1M12 3l-1 18"],
  crown: ["m3 7 5 4 4-8 4 8 5-5-2 12-14 1-2-12Z", "m6 21 12-1"],
  eye: ["M2 12c6-11 15-9 21 0-8 10-15 9-21 0Z", "M12 8c-6-1-5 9 1 8 5 0 5-8-1-8Z"],
  refresh: ["M4 10c-1-8 14-10 17-2M20 15c-2 8-15 8-17 0", "m16 8 6 1V3M8 15l-6-1v6"],
};

export function SketchIcon({ name = "pen", size = 24, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {(iconPaths[name] || iconPaths.pen).map((d, index) => <path key={index} d={d} />)}
  </svg>;
}
