import { describe, expect, it } from "vitest";
import { artReducer, initialArtState, makeSampleStrokes, maskWord, rolePlayers, roundWords } from "./model.js";

const act = (state, type, fields = {}) => artReducer(state, { type, roundId: state.roundId, ...fields });
const judgedRound = () => {
  let state = act(initialArtState(), "MODE", { mode: "host-judged" });
  state = act(state, "START");
  state = act(state, "ROLE", { role: "prompter" });
  state = act(state, "PROMPT", { word: "纸  风筝" });
  return act(state, "ROLE", { role: "guesser" });
};

describe("local art study model", () => {
  it("masks by Unicode code point like the server", () => {
    expect(maskWord("梨")).toBe("·");
    expect(maskWord("鸭梨")).toBe("鸭·");
    expect(maskWord("𠀋𠀋𠀋")).toBe("𠀋··");
  });

  it("accepts normalized library answers once, awarding winner and drawer", () => {
    const initial = act(initialArtState(), "ROLE", { role: "guesser" });
    const finished = act(initial, "GUESS", { text: `  ${initial.word} `, clientGuessId: "answer-1" });
    expect(finished.status).toBe("finished");
    expect(finished.reason).toBe("guessed");
    expect(finished.messages.at(-1).status).toBe("accepted");
    expect(finished.scoreChanges).toEqual({ you: 2, xiaoyuan: 1 });
    expect(finished.canvas).toBe(initial.canvas);
    expect(act(finished, "GUESS", { text: initial.word, clientGuessId: "answer-1" })).toBe(finished);
    const next = act(finished, "START");
    expect(next.canvas).toEqual([]);
    expect(next.roundId).toBe(finished.roundId + 1);
    expect(next.canvasEpoch).toBe(finished.canvasEpoch + 1);
    expect(act(next, "GUESS", { roundId: finished.roundId, text: next.word })).toBe(next);
  });

  it("rejects wrong library guesses without ending the round", () => {
    const initial = act(initialArtState(), "ROLE", { role: "guesser" });
    const guessed = act(initial, "GUESS", { text: "苹果", clientGuessId: "g1" });
    expect(guessed.status).toBe("active");
    expect(guessed.messages.at(-1)).toMatchObject({ text: "苹果", status: "rejected", playerId: "you" });
  });

  it("requires the correct role, host and current round for input", () => {
    const initial = initialArtState();
    expect(act(initial, "GUESS", { text: initial.word })).toBe(initial);
    const guesser = act(initial, "ROLE", { role: "guesser" });
    expect(act(guesser, "GUESS", { text: initial.word, roundId: 0 })).toBe(guesser);
    expect(act(guesser, "PROMPT", { word: "梨" })).toBe(guesser);
    const offline = act(guesser, "ONLINE", { online: false });
    expect(act(offline, "GUESS", { text: initial.word })).toBe(offline);
    expect(act(offline, "SKIP")).toBe(offline);
    const guest = act(initial, "HOST", { host: false });
    expect(act(guest, "SKIP")).toBe(guest);
    const waiting = act(act(initial, "SKIP"), "HOST", { host: false });
    expect(act(waiting, "START")).toBe(waiting);
  });

  it("deduplicates guesses by sender, round and client identifier", () => {
    const initial = act(initialArtState(), "ROLE", { role: "guesser" });
    const guessed = act(initial, "GUESS", { text: "苹果", clientGuessId: "same" });
    expect(act(guessed, "GUESS", { text: "苹果", clientGuessId: "same" })).toBe(guessed);
    expect(act(guessed, "GUESS", { text: "苹果", clientGuessId: "different" }).messages).toHaveLength(guessed.messages.length + 1);
  });

  it("holds judged guesses pending and judges a specific message only once", () => {
    let state = judgedRound();
    expect(state.word).toBe("纸 风筝");
    state = act(state, "GUESS", { text: "纸飞机" });
    const firstId = state.messages.at(-1).id;
    expect(state.messages.at(-1).status).toBe("pending");
    state = act(state, "GUESS", { text: "纸风筝" });
    const secondId = state.messages.at(-1).id;
    expect(state.status).toBe("active");
    expect(act(state, "JUDGE", { guessId: firstId, accepted: true })).toBe(state);
    state = act(state, "ROLE", { role: "prompter" });
    const rejected = act(state, "JUDGE", { guessId: firstId, accepted: false });
    expect(rejected.messages.find((message) => message.id === firstId).status).toBe("rejected");
    expect(rejected.messages.find((message) => message.id === secondId).status).toBe("pending");
    expect(act(rejected, "JUDGE", { guessId: firstId, accepted: true })).toBe(rejected);
    expect(act(rejected, "JUDGE", { guessId: secondId, accepted: true, roundId: state.roundId - 1 })).toBe(rejected);
    const finished = act(rejected, "JUDGE", { guessId: secondId, accepted: true });
    expect(finished.status).toBe("finished");
    expect(finished.messages.find((message) => message.id === secondId).status).toBe("accepted");
    expect(finished.scoreChanges).toEqual({ amo: 2, xiaoyuan: 1, you: 1 });
    expect(act(finished, "JUDGE", { guessId: secondId, accepted: true })).toBe(finished);
  });

  it("expires prompt or drawing time without awarding points or removing artwork", () => {
    const initial = initialArtState();
    for (const [finished, reason] of [[act(initial, "TICK", { seconds: 100 }), "timeout"], [act(initial, "SKIP"), "skipped"]]) {
      expect(finished.status).toBe("finished");
      expect(finished.reason).toBe(reason);
      expect(finished.players).toEqual(initial.players);
      expect(finished.canvas).toBe(initial.canvas);
      expect(finished.scoreChanges).toEqual({});
    }
    const prompt = act(act(initial, "MODE", { mode: "host-judged" }), "START");
    expect(prompt.seconds).toBe(30);
    expect(act(prompt, "PROMPT", { word: "梨" })).toBe(prompt);
    expect(act(prompt, "TICK", { seconds: 30 }).status).toBe("finished");
    let pending = act(judgedRound(), "GUESS", { text: "风筝" });
    pending = act(pending, "TICK", { seconds: 100 });
    expect(pending.messages.at(-1).status).toBe("closed");
  });

  it("requires minimum player counts before starting", () => {
    let state = { ...initialArtState(), status: "waiting", players: initialArtState().players.slice(0, 1) };
    expect(act(state, "START")).toBe(state);
    state = { ...state, mode: "host-judged", players: initialArtState().players.slice(0, 2) };
    expect(act(state, "START")).toBe(state);
  });

  it("draws round words from selected packs, falling back to the first two", () => {
    const state = initialArtState();
    expect(roundWords({ ...state, selectedPacks: ["kitchen"] })).toEqual(state.packs.find((pack) => pack.id === "kitchen").words);
    expect(roundWords({ ...state, selectedPacks: [] })).toEqual(state.packs.slice(0, 2).flatMap((pack) => pack.words));
  });

  it("validates submissions and publishes only reviewed packs, selectable up to six", () => {
    let state = initialArtState();
    const valid = { name: "交通工具", description: "陆海空常见的交通工具", words: "自行车\n火车, 帆船\n热气球\n火车" };
    expect(act(state, "SUBMIT_PACK", { pack: { ...valid, words: "自行车,自行车,火车" } }).packError).toMatch(/4–32/);
    expect(act(state, "SUBMIT_PACK", { pack: { ...valid, description: "太短" } }).packError).toMatch(/8–120/);
    expect(act(state, "SUBMIT_PACK", { pack: { ...valid, name: state.packs[0].name } }).packError).toMatch(/同名/);
    state = act(state, "SUBMIT_PACK", { pack: valid });
    const submitted = state.packs.at(-1);
    expect(submitted).toMatchObject({ name: "交通工具", status: "pending", words: ["自行车", "火车", "帆船", "热气球"] });
    expect(act(state, "PACK", { id: submitted.id })).toBe(state);
    state = act(state, "REVIEW_PACK", { id: submitted.id, approved: true });
    expect(state.packs.at(-1).status).toBe("published");
    for (const pack of state.packs) if (!state.selectedPacks.includes(pack.id)) state = act(state, "PACK", { id: pack.id });
    expect(state.selectedPacks.length).toBeLessThanOrEqual(6);
    const rejectedState = act(act(initialArtState(), "SUBMIT_PACK", { pack: { ...valid, name: "乐器" } }), "REVIEW_PACK", { id: "submitted-1", approved: false });
    expect(rejectedState.packs.some((pack) => pack.name === "乐器")).toBe(false);
  });

  it("appends stroke chunks immutably and rejects gaps, stale epochs and late rounds", () => {
    const initial = act(initialArtState(), "CLEAR");
    const stroke = { id: "drawn", offset: 0, tool: "pen", color: "#263b31", width: 4, points: [{ x: 20, y: 40 }] };
    const first = act(initial, "STROKE", { stroke, epoch: initial.canvasEpoch });
    expect(first.canvas).toHaveLength(1);
    expect(initial.canvas).toEqual([]);
    expect(act(first, "STROKE", { stroke, epoch: first.canvasEpoch })).toBe(first);
    const second = act(first, "STROKE", { stroke: { ...stroke, offset: 1 }, epoch: first.canvasEpoch });
    expect(second.canvas[0].points).toHaveLength(2);
    expect(first.canvas[0].points).toHaveLength(1);
    expect(act(second, "STROKE", { stroke: { ...stroke, offset: 3 }, epoch: second.canvasEpoch })).toBe(second);
    expect(act(second, "STROKE", { stroke: { ...stroke, offset: 2 }, epoch: second.canvasEpoch - 1 })).toBe(second);
    expect(act(second, "STROKE", { stroke: { ...stroke, offset: 2 }, epoch: second.canvasEpoch, roundId: 0 })).toBe(second);
    const undone = act(second, "UNDO");
    expect(undone.canvas).toEqual([]);
    expect(undone.canvasEpoch).toBe(second.canvasEpoch + 1);
  });

  it("recasts only your role when switching, keeping every guess with a current guesser", () => {
    const authorsAreGuessers = (state) => {
      const guessers = rolePlayers(state).guessers.map((player) => player.id);
      return state.messages.every((message) => guessers.includes(message.playerId));
    };
    for (const mode of ["library", "host-judged"]) {
      const initial = act(initialArtState(), "MODE", { mode });
      for (const role of mode === "library" ? ["guesser", "drawer"] : ["guesser", "prompter", "drawer"]) {
        const switched = act(initial, "ROLE", { role });
        expect(switched.messages.filter((message) => message.playerId === "you")).toEqual([]);
        expect(authorsAreGuessers(switched)).toBe(true);
      }
    }
    const own = act(judgedRound(), "GUESS", { text: "风筝" });
    const sampleAuthors = own.messages.filter((message) => message.playerId !== "you").map((message) => message.playerId);
    const prompter = act(own, "ROLE", { role: "prompter" });
    expect(authorsAreGuessers(prompter)).toBe(true);
    expect(prompter.messages.filter((message) => message.id.startsWith("sample")).map((message) => message.playerId)).toEqual(sampleAuthors);
  });

  it("uses distinct roles and Chinese sample content inside the canvas bounds", () => {
    const state = judgedRound();
    const roles = rolePlayers(state);
    expect(roles.drawerId).not.toBe(roles.prompterId);
    expect(roles.guessers.map((player) => player.id)).toContain("you");
    const initial = initialArtState();
    expect(initial.roomName).toMatch(/[\u4e00-\u9fff]/);
    expect(initial.packs.every((pack) => /[\u4e00-\u9fff]/.test(pack.name) && pack.description.length >= 8 && pack.words.length >= 4)).toBe(true);
    const strokes = makeSampleStrokes();
    expect(strokes.length).toBeGreaterThan(20);
    expect(strokes.length).toBeLessThan(120);
    expect(strokes.every((stroke) => stroke.points.every(({ x, y }) => x >= 0 && x <= 960 && y >= 0 && y <= 620))).toBe(true);
  });
});
