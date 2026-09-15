import { afterEach, expect, it, vi } from "vitest";
import { GameStore } from "./gameStore.js";
let store;
function setup(mode = "library") {
  store = new GameStore({ getPacks: () => [{ id: "pack", status: "approved", words: ["鲸鱼"] }] });
  const room = store.createRoom({ playerId: "host", mode, packIds: [] });
  store.joinRoom("a", room.code); store.joinRoom("b", room.code);
  store.startRound("host", room.code, room.round.id);
  return room;
}
const stroke = (id, offset = 0, count = 1) => ({ id, offset, tool: "pen", color: "#000000", width: 4, points: Array.from({ length: count }, (_, i) => ({ x: i, y: 1 })) });
afterEach(() => { store?.dispose(); vi.useRealTimers(); });
it("preserves long strokes and more than 240 strokes, undoing a whole stroke", () => {
  const room = setup();
  for (let i = 0; i < 6; i++) store.addStroke(room.round.drawerId, room.code, stroke("long", i * 128, 128), room.round.id, room.canvasEpoch);
  expect(room.canvas[0].points).toHaveLength(768);
  for (let i = 0; i < 241; i++) store.addStroke(room.round.drawerId, room.code, stroke(`dot${i}`), room.round.id, room.canvasEpoch);
  expect(room.canvas).toHaveLength(242);
  expect(room.canvas[0].id).toBe("long");
  const epoch = room.canvasEpoch;
  store.undoStroke(room.round.drawerId, room.code, room.round.id, epoch);
  expect(room.canvas).toHaveLength(241);
  expect(() => store.addStroke(room.round.drawerId, room.code, stroke("stale"), room.round.id, epoch)).toThrow("CANVAS_CHANGED");
});
it("rejects mismatched offsets and exceeded budgets without removing earlier artwork", () => {
  const room = setup();
  store.addStroke(room.round.drawerId, room.code, stroke("one"), room.round.id, room.canvasEpoch);
  expect(() => store.addStroke(room.round.drawerId, room.code, stroke("one", 8), room.round.id, room.canvasEpoch)).toThrow("CANVAS_CHANGED");
  room.canvasPoints = 100000;
  expect(() => store.addStroke(room.round.drawerId, room.code, stroke("two"), room.round.id, room.canvasEpoch)).toThrow("CANVAS_FULL");
  expect(room.canvas.map((s) => s.id)).toEqual(["one"]);
});
it("ends at the server deadline, preserves artwork, and gives no points for a timeout", () => {
  vi.useFakeTimers(); const room = setup();
  store.addStroke(room.round.drawerId, room.code, stroke("one"), room.round.id, room.canvasEpoch);
  const guesser = room.players.find((p) => p.id !== room.round.drawerId).id;
  vi.setSystemTime(room.round.endsAt + 1);
  expect(() => store.submitGuess(guesser, room.code, "鲸鱼", room.round.id)).toThrow("ROUND_STATE_INVALID");
  expect(room.round.reason).toBe("timeout");
  expect(room.canvas).toHaveLength(1);
  expect(room.players.every((p) => p.score === 0)).toBe(true);
});
it("times out prompting and gives a fresh active deadline after a prompt", () => {
  vi.useFakeTimers(); const room = setup("host-judged");
  vi.advanceTimersByTime(30000);
  expect(room.round.status).toBe("finished");
  store.startRound("host", room.code, room.round.id);
  vi.advanceTimersByTime(20000);
  store.submitPrompt(room.round.prompterId, room.code, "火箭", room.round.id);
  expect(room.round.endsAt - Date.now()).toBe(100000);
  vi.advanceTimersByTime(100000);
  expect(room.round.status).toBe("finished");
});
it("ends when the only guesser leaves and lets the host skip without awarding points", () => {
  const room = setup("host-judged");
  const guesser = room.players.find((p) => ![room.round.drawerId, room.round.prompterId].includes(p.id));
  store.leaveRoom(guesser.id, room.code);
  expect(room.round.reason).toBe("player-left");
  store.joinRoom(guesser.id, room.code);
  store.startRound(room.hostId, room.code, room.round.id);
  const other = room.players.find((p) => p.id !== room.hostId).id;
  expect(() => store.skipRound(other, room.code, room.round.id)).toThrow("FORBIDDEN");
  store.skipRound(room.hostId, room.code, room.round.id);
  expect(room.round.reason).toBe("skipped");
  expect(room.players.every((p) => p.score === 0)).toBe(true);
});
