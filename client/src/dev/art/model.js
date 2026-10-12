// A deterministic, browser-local art study. This is not a network or authority
// simulator; production permissions and canvas synchronization remain separate.
// Statuses, masking and scoring mirror server/src/gameStore.js so the visual
// states map onto real ones.
export const MAX_SELECTED_PACKS = 6;

const publishedPacks = [
  { id: "plants", name: "花草植物", description: "盆栽、花朵、叶子与果实", words: ["鸭梨", "仙人掌", "向日葵", "蒲公英", "松果", "荷叶", "蘑菇", "橡果"] },
  { id: "kitchen", name: "厨房", description: "厨具、调料和常见食物", words: ["茶壶", "柠檬", "蜂蜜", "洋葱", "打蛋器", "饺子", "番茄", "擀面杖"] },
  { id: "oddities", name: "奇物", description: "旅行、天文和老物件", words: ["望远镜", "风筝", "指南针", "沙漏", "手风琴", "月亮", "钥匙", "独轮车"] },
  { id: "animals", name: "动物", description: "常见的鸟、鱼和小动物", words: ["小鸟", "金鱼", "兔子", "狐狸", "刺猬", "企鹅", "蜗牛", "熊猫"] },
].map((pack) => ({ ...pack, status: "published" }));

export function maskWord(word) {
  const characters = Array.from(word);
  return characters.length > 1 ? `${characters[0]}${"·".repeat(characters.length - 1)}` : "·";
}

function curve(points, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const u = 1 - t;
    return {
      x: u ** 3 * points[0][0] + 3 * u ** 2 * t * points[1][0] + 3 * u * t ** 2 * points[2][0] + t ** 3 * points[3][0],
      y: u ** 3 * points[0][1] + 3 * u ** 2 * t * points[1][1] + 3 * u * t ** 2 * points[2][1] + t ** 3 * points[3][1],
    };
  });
}

// Original pear study, authored as the same 960 x 620 stroke data the real
// drawing board consumes. Pigment comes from directional pencil marks.
export function makeSampleStrokes() {
  const strokes = [];
  const add = (points, color, width) => strokes.push({ id: `study-${strokes.length}`, tool: "pen", color, width, points });
  for (let index = 0; index < 12; index += 1) {
    const x = 366 + index * 22;
    const spread = Math.sin((index + 1) / 13 * Math.PI);
    add(curve([[x, 496], [x + 6, 497 + spread * 7], [x + 27, 494 + spread * 10], [x + 38, 496]], 8), "#d4cdba", 2.2);
  }
  const sections = [
    [234, 449, 493], [250, 443, 500], [268, 432, 507], [286, 419, 520],
    [305, 407, 534], [324, 393, 548], [343, 382, 567], [362, 377, 581],
    [381, 374, 591], [401, 378, 594], [420, 385, 589], [439, 399, 578],
    [457, 421, 560], [472, 447, 532],
  ];
  sections.forEach(([y, left, right], index) => {
    const highlight = left + (right - left) * 0.29;
    add(curve([[left, y], [left + 22, y - 12], [highlight + 18, y - 18], [highlight + 31, y - 15]], 15), index % 3 ? "#c9c76b" : "#d7cd79", 9.5);
    add(curve([[highlight + 39, y - 9], [right - 41, y - 8], [right - 21, y - 18], [right, y - 22]], 17), index % 2 ? "#b7b65c" : "#bdbe66", 11.5);
  });
  for (let index = 0; index < 12; index += 1) {
    const t = index / 11;
    add(curve([[530 + 63 * Math.sin(t * Math.PI), 307 + t * 137], [548 + 47 * Math.sin(t * Math.PI), 315 + t * 137], [539 + 45 * Math.sin(t * Math.PI), 329 + t * 135], [517 + 46 * Math.sin(t * Math.PI), 343 + t * 126]], 12), index % 3 ? "#9ca052" : "#a3a453", 2.1);
  }
  const outline = [
    [[448, 218], [433, 246], [439, 270], [410, 309]],
    [[410, 309], [372, 355], [349, 400], [379, 449]],
    [[379, 449], [407, 493], [490, 504], [551, 482]],
    [[551, 482], [616, 461], [635, 410], [602, 360]],
    [[602, 360], [574, 319], [530, 279], [514, 236]],
    [[514, 236], [502, 205], [469, 198], [448, 218]],
  ];
  add(outline.flatMap((points) => curve(points)), "#565e3b", 2.7);
  add(curve([[380, 362], [349, 428], [400, 480], [447, 484]]), "#89925d", 1.25);
  add(curve([[594, 363], [628, 415], [603, 452], [577, 466]]), "#66734a", 1.8);
  add(curve([[475, 214], [470, 191], [484, 166], [498, 149]], 20), "#786149", 7.3);
  add(curve([[473, 209], [473, 188], [485, 164], [501, 148]], 20), "#453f32", 1.9);
  for (let index = 0; index < 9; index += 1) {
    add(curve([[488 + index * 9, 179 - index * 2.5], [499 + index * 9, 167 - index * 2.4], [513 + index * 7, 159 - index * 1.3], [521 + index * 7, 157]], 9), index % 2 ? "#738b61" : "#8f9a65", 5.5);
  }
  add([
    ...curve([[482, 184], [507, 149], [548, 143], [583, 153]]),
    ...curve([[583, 153], [561, 181], [519, 195], [482, 184]]),
  ], "#52664d", 2.2);
  add(curve([[484, 184], [519, 174], [542, 162], [577, 155]]), "#4e6549", 1.5);
  [[512, 175, 513, 160], [529, 169, 539, 152], [538, 166, 554, 174]].forEach(([x, y, endX, endY]) => add([{ x, y }, { x: endX, y: endY }], "#4e6549", 1.1));
  for (let index = 0; index < 18; index += 1) {
    const x = 414 + (index * 37) % 145;
    const y = 331 + (index * 23) % 124;
    add([{ x, y }, { x: x + 1.2, y: y + 1.6 }], index % 3 ? "#99965c" : "#8c7b4c", 1.4);
  }
  return strokes;
}

export const lobbyRooms = [
  { code: "MOON7", name: "周末速写", mode: "host-judged", playerCount: 6, status: "active" },
  { code: "TEA42", name: "茶水间", mode: "library", playerCount: 10, status: "active" },
  { code: "PAPER", name: "三楼会议室", mode: "library", playerCount: 3, status: "waiting" },
];

export function initialArtState() {
  return {
    view: "room", mode: "library", role: "drawer", host: true, roomName: "午后速写室", code: "INK24",
    roundId: 1, roundNumber: 3, status: "active", word: "鸭梨", seconds: 74,
    players: [
      { id: "you", name: "你", score: 4, kind: "bird" },
      { id: "xiaoyuan", name: "小圆", score: 6, kind: "pear" },
      { id: "amo", name: "阿墨", score: 3, kind: "fish" },
      { id: "lizi", name: "栗子", score: 2, kind: "moon" },
    ],
    messages: [
      { id: "sample-1", roundId: 1, playerId: "lizi", text: "芒果", status: "rejected" },
      { id: "sample-2", roundId: 1, playerId: "lizi", text: "牛油果", status: "rejected" },
    ],
    canvas: makeSampleStrokes(), canvasEpoch: 0, packs: publishedPacks, selectedPacks: ["plants"], online: true,
    reason: null, winnerIds: [], scoreChanges: {}, nextMessageId: 1, nextPackId: 1, packError: "",
  };
}

export function rolePlayers(state) {
  const drawerId = state.role === "drawer" ? "you" : "xiaoyuan";
  const prompterId = state.mode === "host-judged" ? state.role === "prompter" ? "you" : "amo" : null;
  return {
    drawerId, prompterId,
    drawer: state.players.find((player) => player.id === drawerId),
    prompter: state.players.find((player) => player.id === prompterId) || null,
    guessers: state.players.filter((player) => player.id !== drawerId && player.id !== prompterId),
  };
}

export function roundWords(state) {
  const published = state.packs.filter((pack) => pack.status === "published");
  const chosen = published.filter((pack) => state.selectedPacks.includes(pack.id));
  return (chosen.length ? chosen : published.slice(0, 2)).flatMap((pack) => pack.words);
}

function finish(state, reason, winnerId = null) {
  const { drawerId, prompterId } = rolePlayers(state);
  const scoreChanges = winnerId ? { [winnerId]: 2, [drawerId]: 1, ...(prompterId ? { [prompterId]: 1 } : {}) } : {};
  return {
    ...state, status: "finished", reason, winnerIds: winnerId ? [winnerId] : [], scoreChanges,
    players: state.players.map((player) => ({ ...player, score: player.score + (scoreChanges[player.id] || 0) })),
    messages: state.messages.map((message) => message.status === "pending" ? { ...message, status: "closed" } : message),
  };
}

const clean = (text) => typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
const canonical = (text) => clean(text).toLowerCase();
const currentRound = (state, action) => action.roundId === state.roundId;
const isActive = (state, action) => state.online && state.status === "active" && currentRound(state, action);

function changeRole(state, role) {
  // The role selector recasts a LOCAL scene. Players keep their seat unless
  // your move displaces them; displaced history and score follow the seat, so
  // a prompter never appears as the author of a guess.
  const next = { ...state, role };
  const before = rolePlayers(state), after = rolePlayers(next);
  const mapping = {};
  for (const seat of ["drawerId", "prompterId"]) if (before[seat]) mapping[before[seat]] = after[seat];
  const beforeGuessers = before.guessers.map((player) => player.id), afterGuessers = after.guessers.map((player) => player.id);
  const arriving = afterGuessers.filter((id) => !beforeGuessers.includes(id));
  for (const id of beforeGuessers) mapping[id] = afterGuessers.includes(id) ? id : arriving.shift();
  const oldScores = Object.fromEntries(state.players.map((player) => [mapping[player.id], player.score]));
  return {
    ...next,
    players: state.players.map((player) => ({ ...player, score: oldScores[player.id] })),
    messages: state.messages.map((message) => ({ ...message, playerId: mapping[message.playerId] || message.playerId })),
    winnerIds: state.winnerIds.map((id) => mapping[id] || id),
    scoreChanges: Object.fromEntries(Object.entries(state.scoreChanges).map(([id, score]) => [mapping[id] || id, score])),
  };
}

function submitPack(state, pack) {
  const name = clean(pack?.name), description = clean(pack?.description);
  const words = [...new Set(String(pack?.words || "").split(/[,，、\n]/).map(clean).filter(Boolean))];
  const fail = (packError) => ({ ...state, packError });
  if (!name || name.length > 24) return fail("词包名称需要 1–24 个字。");
  if (description.length < 8 || description.length > 120) return fail("介绍需要 8–120 个字。");
  if (words.length < 4 || words.length > 32 || words.some((word) => word.length > 28)) return fail("需要 4–32 个不同词语，每个不超过 28 个字。");
  if (state.packs.some((candidate) => canonical(candidate.name) === canonical(name))) return fail("已有同名词包。");
  return {
    ...state, packError: "", nextPackId: state.nextPackId + 1,
    packs: [...state.packs, { id: `submitted-${state.nextPackId}`, name, description, words, status: "pending" }],
  };
}

export function artReducer(state, action) {
  switch (action.type) {
    case "VIEW":
      return ["enter", "lobby", "room", "packs"].includes(action.view) ? { ...state, view: action.view } : state;
    case "ROLE":
      return ["drawer", "guesser", "prompter"].includes(action.role) && (action.role !== "prompter" || state.mode === "host-judged") ? changeRole(state, action.role) : state;
    case "HOST":
      return { ...state, host: Boolean(action.host) };
    case "MODE":
      if (!["library", "host-judged"].includes(action.mode) || action.mode === state.mode) return state;
      return { ...state, mode: action.mode, role: state.role === "prompter" ? "drawer" : state.role, status: "waiting", word: "", seconds: 100, reason: null, winnerIds: [], scoreChanges: {}, messages: state.messages.map((message) => message.status === "pending" ? { ...message, status: "closed" } : message) };
    case "CREATE_ROOM":
      if (!state.online || !clean(action.name)) return state;
      return {
        ...state, view: "room", roomName: clean(action.name), code: "INK24", host: true,
        mode: ["library", "host-judged"].includes(action.mode) ? action.mode : state.mode,
        role: "drawer", status: "waiting", word: "", seconds: 100, roundNumber: 0, roundId: state.roundId + 1,
        reason: null, winnerIds: [], scoreChanges: {}, canvas: [], canvasEpoch: state.canvasEpoch + 1,
        messages: [], players: state.players.map((player) => ({ ...player, score: 0 })),
      };
    case "JOIN_ROOM":
      return state.online && /^[A-Z0-9]{5}$/.test(clean(action.code).toUpperCase()) ? { ...state, view: "room", code: clean(action.code).toUpperCase(), roomName: clean(action.name) || state.roomName, role: "guesser", host: false } : state;
    case "START": {
      const minimum = state.mode === "library" ? 2 : 3;
      if (!state.online || !state.host || !["waiting", "finished"].includes(state.status) || state.players.length < minimum) return state;
      const words = roundWords(state);
      return {
        ...state, roundId: state.roundId + 1, roundNumber: state.roundNumber + 1,
        status: state.mode === "library" ? "active" : "collecting-word",
        word: state.mode === "library" ? words[state.roundNumber % words.length] || "流星" : "",
        seconds: state.mode === "library" ? 100 : 30, canvas: [], canvasEpoch: state.canvasEpoch + 1,
        reason: null, winnerIds: [], scoreChanges: {},
      };
    }
    case "PROMPT": {
      const word = clean(action.word);
      if (!state.online || !currentRound(state, action) || state.mode !== "host-judged" || state.role !== "prompter" || state.status !== "collecting-word" || !word) return state;
      return { ...state, status: "active", word, seconds: 100 };
    }
    case "GUESS": {
      if (!isActive(state, action) || state.role !== "guesser") return state;
      const text = clean(action.text);
      if (!text || (action.clientGuessId && state.messages.some((message) => message.roundId === state.roundId && message.playerId === "you" && message.clientGuessId === action.clientGuessId))) return state;
      const correct = state.mode === "library" && canonical(text) === canonical(state.word);
      const message = { id: `guess-${state.nextMessageId}`, roundId: state.roundId, playerId: "you", text, clientGuessId: action.clientGuessId, status: correct ? "accepted" : state.mode === "host-judged" ? "pending" : "rejected" };
      const next = { ...state, messages: [...state.messages, message], nextMessageId: state.nextMessageId + 1 };
      return correct ? finish(next, "guessed", "you") : next;
    }
    case "JUDGE": {
      if (!isActive(state, action) || state.mode !== "host-judged" || state.role !== "prompter" || typeof action.accepted !== "boolean") return state;
      const message = state.messages.find((candidate) => candidate.id === action.guessId && candidate.roundId === state.roundId && candidate.status === "pending");
      if (!message) return state;
      const next = { ...state, messages: state.messages.map((candidate) => candidate === message ? { ...candidate, status: action.accepted ? "accepted" : "rejected" } : candidate) };
      return action.accepted ? finish(next, "guessed", message.playerId) : next;
    }
    case "TICK": {
      if (!["active", "collecting-word"].includes(state.status)) return state;
      const elapsed = Number.isFinite(action.seconds) ? Math.max(0, action.seconds) : 1;
      const next = { ...state, seconds: Math.max(0, state.seconds - elapsed) };
      return next.seconds === 0 ? finish(next, "timeout") : next;
    }
    case "SKIP":
      return state.online && state.host && ["active", "collecting-word"].includes(state.status) ? finish(state, "skipped") : state;
    case "STROKE": {
      if (!isActive(state, action) || state.role !== "drawer" || action.epoch !== state.canvasEpoch) return state;
      const stroke = action.stroke;
      if (!stroke?.id || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return state;
      const index = state.canvas.findIndex((candidate) => candidate.id === stroke.id);
      const previous = state.canvas[index];
      if (stroke.offset !== (previous?.points.length || 0)) return state;
      if (previous && (stroke.tool !== previous.tool || stroke.color !== previous.color || stroke.width !== previous.width)) return state;
      if (!previous && (!["pen", "eraser"].includes(stroke.tool) || !/^#[a-f0-9]{6}$/i.test(stroke.color) || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 24)) return state;
      const canvas = [...state.canvas];
      if (previous) canvas[index] = { ...previous, points: [...previous.points, ...stroke.points] };
      else {
        const { offset, ...drawing } = stroke;
        canvas.push(drawing);
      }
      return { ...state, canvas };
    }
    case "UNDO":
    case "CLEAR":
      // Immediate epochs are sufficient for this local study. Real rooms must
      // keep waiting for authoritative undo/clear confirmation before drawing.
      if (!state.online || state.role !== "drawer" || state.status !== "active" || (action.roundId !== undefined && !currentRound(state, action)) || (action.epoch !== undefined && action.epoch !== state.canvasEpoch)) return state;
      return { ...state, canvas: action.type === "CLEAR" ? [] : state.canvas.slice(0, -1), canvasEpoch: state.canvasEpoch + 1 };
    case "ONLINE":
      return { ...state, online: Boolean(action.online) };
    case "PACK": {
      const pack = state.packs.find((candidate) => candidate.id === action.id && candidate.status === "published");
      if (!pack) return state;
      if (state.selectedPacks.includes(pack.id)) return { ...state, selectedPacks: state.selectedPacks.filter((id) => id !== pack.id) };
      return state.selectedPacks.length >= MAX_SELECTED_PACKS ? state : { ...state, selectedPacks: [...state.selectedPacks, pack.id] };
    }
    case "SUBMIT_PACK":
      return state.online ? submitPack(state, action.pack) : state;
    case "CLEAR_PACK_ERROR":
      return { ...state, packError: "" };
    case "REVIEW_PACK": {
      const pack = state.packs.find((candidate) => candidate.id === action.id && candidate.status === "pending");
      if (!pack || !state.online) return state;
      return { ...state, packs: action.approved ? state.packs.map((candidate) => candidate === pack ? { ...candidate, status: "published" } : candidate) : state.packs.filter((candidate) => candidate !== pack) };
    }
    case "REPLAY": {
      const replay = initialArtState();
      return { ...replay, view: state.view, packs: state.packs, canvasEpoch: state.canvasEpoch + 1, roundId: state.roundId + 1, messages: replay.messages.map((message) => ({ ...message, roundId: state.roundId + 1 })) };
    }
    default:
      return state;
  }
}
