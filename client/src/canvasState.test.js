import { expect, it } from "vitest";
import { applyCanvasEvent } from "./canvasState.js";
const room = { code: "ABCDE", round: { id: "round" }, canvas: [], canvasEpoch: 1, canvasVersion: 1 };
const event = { type: "canvas:stroke", roomCode: room.code, roundId: "round", epoch: 1, version: 2, stroke: { id: "s", offset: 0, points: [{ x: 1, y: 1 }], tool: "pen", width: 4, color: "#000000" } };
it("appends chunks immutably and ignores duplicate or stale round events", () => {
  const first = applyCanvasEvent(room, event);
  const second = applyCanvasEvent(first, { ...event, version: 3, stroke: { ...event.stroke, offset: 1 } });
  expect(second.canvas[0].points).toHaveLength(2);
  expect(first.canvas[0].points).toHaveLength(1);
  expect(room.canvas).toHaveLength(0);
  expect(applyCanvasEvent(second, event)).toBe(second);
  expect(applyCanvasEvent(second, { ...event, roundId: "old" })).toBe(second);
});
it("detects lost chunks and restores an authoritative snapshot", () => {
  expect(() => applyCanvasEvent(room, { ...event, version: 4 })).toThrow("CANVAS_DESYNC");
  const restored = applyCanvasEvent(room, { ...event, type: "canvas:snapshot", epoch: 2, version: 4, canvas: [] });
  expect(restored.canvasEpoch).toBe(2);
  expect(restored.canvasResetKey).toBe(1);
});
