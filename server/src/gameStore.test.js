import { afterEach, describe, expect, it, vi } from "vitest";
import { GameStore } from "./gameStore.js";
import { config } from "./config.js";

const stores = [];
function setup(mode = "library", count = 3, word = "火箭") {
  const store = new GameStore({ getPacks: () => [{ id: "pack", status: "approved", words: [word] }] });
  stores.push(store);
  for (let i = 0; i < count; i++) store.createSession(`p${i}`, `t${i}`);
  const room = store.createRoom({ playerId: "p0", name: "测试", mode, packIds: [] });
  for (let i = 1; i < count; i++) store.joinRoom(`p${i}`, room.code);
  return { store, room };
}
afterEach(() => { stores.splice(0).forEach((store) => store.dispose()); vi.useRealTimers(); });

describe("room and round invariants", () => {
  it.each([
    ["library", "山", "·"],
    ["host-judged", "山", "·"],
    ["library", "𠮷", "·"],
    ["host-judged", "𠮷", "·"],
    ["library", "火箭", "火·"],
    ["host-judged", "𠮷野", "𠮷·"],
  ])("protects the %s hint for %s while preserving role access", (mode, word, hint) => {
    const { store, room } = setup(mode, 3, word);
    store.startRound("p0", room.code, room.round.id);
    const { drawerId, prompterId, id } = room.round;
    if (prompterId) store.submitPrompt(prompterId, room.code, word, id);
    const guesser = room.players.find(player => ![drawerId, prompterId].includes(player.id)).id;
    const view = store.serializeRoomFor(guesser, room.code);
    expect(view.round.word).toBeNull();
    expect(view.round.maskedWord).toBe(hint);
    expect(store.serializeRoomFor(drawerId, room.code).round.word).toBe(word);
    if (prompterId) expect(store.serializeRoomFor(prompterId, room.code).round.word).toBe(word);
    store.skipRound("p0", room.code, id);
    expect(store.serializeRoomFor(guesser, room.code).round.word).toBe(word);
  });
  it("rejects nonmember guesses and private room reads", () => {
    const { store, room } = setup();
    store.startRound("p0", room.code, room.round.id);
    expect(() => store.submitGuess("outside", room.code, "火箭", room.round.id)).toThrow("FORBIDDEN");
    expect(() => store.serializeRoomFor("outside", room.code)).toThrow("FORBIDDEN");
    expect(room.round.status).toBe("active");
  });
  it("keeps one room per player and permits an existing member to rejoin a full room", () => {
    const { store, room } = setup("library", 10);
    expect(store.joinRoom("p0", room.code)).toBe(room);
    expect(() => store.createRoom({ playerId: "p0" })).toThrow("ALREADY_IN_ROOM");
    const other = store.createRoom({ playerId: "other", mode: "library", packIds: [] });
    expect(() => store.joinRoom("p0", other.code)).toThrow("ALREADY_IN_ROOM");
    expect(() => store.joinRoom("new", room.code)).toThrow("ROOM_FULL");
    store.leaveRoom("p0", room.code);
    expect(room.hostId).toBe("p1");
    expect(store.joinRoom("p0", other.code)).toBe(other);
  });
  it("requires three people for judging and rejects repeat or stale starts", () => {
    const { store, room } = setup("host-judged", 2);
    expect(() => store.startRound("p0", room.code, room.round.id)).toThrow("NOT_ENOUGH_PLAYERS");
    store.joinRoom("third", room.code);
    const oldId = room.round.id;
    store.startRound("p0", room.code, oldId);
    expect(() => store.startRound("p0", room.code, oldId)).toThrow("ROUND_STATE_INVALID");
    expect(() => store.startRound("p0", room.code, room.round.id)).toThrow("ROUND_STATE_INVALID");
    expect(() => store.addStroke(room.round.drawerId, room.code, {}, room.round.id)).toThrow("ROUND_STATE_INVALID");
  });
  it("retains each answer and judges its exact ID once", () => {
    const { store, room } = setup("host-judged", 4);
    store.startRound("p0", room.code, room.round.id);
    const { id, prompterId, drawerId } = room.round;
    store.submitPrompt(prompterId, room.code, "火箭", id);
    const [a, b] = room.players.filter((p) => ![prompterId, drawerId].includes(p.id));
    store.submitGuess(a.id, room.code, "火箭", id);
    store.submitGuess(b.id, room.code, "鲸鱼", id);
    store.submitGuess(a.id, room.code, "钢琴", id);
    const pending = store.serializeRoomFor(prompterId, room.code).round.pendingGuesses;
    expect(pending.map((guess) => guess.text)).toEqual(["火箭", "鲸鱼", "钢琴"]);
    store.judgeGuess(prompterId, room.code, pending[1].id, false, id);
    expect(() => store.judgeGuess(prompterId, room.code, pending[1].id, true, id)).toThrow("GUESS_NOT_PENDING");
    store.judgeGuess(prompterId, room.code, pending[0].id, true, id);
    expect(room.round.winnerIds).toEqual([a.id]);
    expect(a.score).toBe(2);
    expect(store.serializeRoomFor(prompterId, room.code).round.pendingGuesses).toEqual([]);
  });
  it("bounds incorrect-guess history and hides the answer until finished", () => {
    const { store, room } = setup();
    store.startRound("p0", room.code, room.round.id);
    const guesser = room.players.find((p) => p.id !== room.round.drawerId).id;
    expect(store.serializeRoomFor(guesser, room.code).round.word).toBeNull();
    for (let i = 0; i < 240; i++) store.submitGuess(guesser, room.code, "错误", room.round.id);
    expect(room.messages.length).toBeLessThanOrEqual(200);
    store.submitGuess(guesser, room.code, "火箭", room.round.id);
    expect(store.serializeRoomFor(guesser, room.code).round.word).toBe("火箭");
  });
});

describe("temporary sessions", () => {
  it("expires only after the last tab disconnects, and cancels expiry on reconnect", () => {
    vi.useFakeTimers();
    const { store, room } = setup();
    const a = { close: vi.fn() }, b = { close: vi.fn() };
    store.bindSocket("t0", a);
    store.bindSocket("t0", b);
    store.unbindSocket(a);
    vi.advanceTimersByTime(config.disconnectMs + 1);
    expect(store.getSession("t0").sockets.has(b)).toBe(true);
    store.unbindSocket(b);
    vi.advanceTimersByTime(config.disconnectMs - 1);
    store.bindSocket("t0", a);
    vi.advanceTimersByTime(2);
    expect(store.getSession("t0")).toBeDefined();
    store.unbindSocket(a);
    vi.advanceTimersByTime(config.disconnectMs + 1);
    expect(store.getSession("t0")).toBeUndefined();
    expect(room.players.some((p) => p.id === "p0")).toBe(false);
  });
  it("cleans up an abandoned HTTP-only session", () => {
    vi.useFakeTimers();
    const { store } = setup();
    vi.advanceTimersByTime(config.disconnectMs + 1);
    expect(store.sessions.size).toBe(0);
    expect(store.rooms.size).toBe(0);
  });
});
