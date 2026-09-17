import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api.js";
import { useGameConnection } from "./useGameConnection.js";

const sockets = [];
class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  constructor() { sockets.push(this); }
  close = vi.fn();
  send() {}
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); sockets.length = 0; });
it("keeps a session on temporary bootstrap failure and retries", async () => {
  vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
  vi.spyOn(api, "bootstrap").mockRejectedValueOnce(new TypeError("Network failed")).mockResolvedValue({ room: null, revision: 1 });
  const expired = vi.fn();
  const hook = renderHook(() => useGameConnection("token", expired));
  await act(async () => {});
  expect(hook.result.current.connection).toBe("reconnecting");
  expect(expired).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  expect(api.bootstrap).toHaveBeenCalledTimes(2);
  hook.unmount();
});
it("expires unauthorized sessions and ignores late state after cleanup", async () => {
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.spyOn(api, "bootstrap").mockRejectedValue(Object.assign(new Error("expired"), { status: 401 }));
  const expired = vi.fn();
  const hook = renderHook(() => useGameConnection("token", expired));
  await waitFor(() => expect(expired).toHaveBeenCalledOnce());
  hook.unmount();
  let resolve;
  api.bootstrap.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const other = renderHook(() => useGameConnection("other", expired));
  other.unmount();
  await act(async () => resolve({ room: null }));
  expect(sockets).toHaveLength(0);
});
it("does not let an older HTTP snapshot replace a newer websocket state", async () => {
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.spyOn(api, "bootstrap").mockResolvedValue({ room: { code: "ABCDE" }, revision: 1 });
  const hook = renderHook(() => useGameConnection("token", vi.fn()));
  await waitFor(() => expect(sockets).toHaveLength(1));
  act(() => sockets[0].onmessage({ data: JSON.stringify({ type: "room:update", room: null, revision: 3 }) }));
  act(() => hook.result.current.applyResponse({ room: { code: "ABCDE" }, revision: 2 }));
  expect(hook.result.current.room).toBeNull();
  hook.unmount();
});

it("preserves canvas identity across metadata and empty HTTP acknowledgements between chunks", async () => {
  vi.stubGlobal("WebSocket", FakeSocket);
  const room = { code: "ABCDE", round: { id: "round" }, canvas: [], canvasEpoch: 1, canvasVersion: 0 };
  vi.spyOn(api, "bootstrap").mockResolvedValue({ room, revision: 1 });
  const hook = renderHook(() => useGameConnection("token", vi.fn()));
  await waitFor(() => expect(sockets).toHaveLength(1));
  const emit = (data) => act(() => sockets[0].onmessage({ data: JSON.stringify(data) }));
  emit({ type: "canvas:stroke", roomCode: room.code, roundId: "round", epoch: 1, version: 1, revision: 2, stroke: { id: "ink", offset: 0, points: [{ x: 1, y: 1 }] } });
  const canvas = hook.result.current.room.canvas;
  const { canvas: omitted, ...metadata } = hook.result.current.room;
  act(() => hook.result.current.applyResponse(null));
  emit({ type: "room:update", room: { ...metadata, messages: [{ id: "guess" }] }, revision: 3 });
  expect(hook.result.current.room.canvas).toBe(canvas);
  emit({ type: "canvas:stroke", roomCode: room.code, roundId: "round", epoch: 1, version: 2, revision: 4, stroke: { id: "ink", offset: 1, points: [{ x: 2, y: 2 }] } });
  expect(hook.result.current.room.canvas[0].points).toHaveLength(2);
  expect(hook.result.current.room.messages).toEqual([{ id: "guess" }]);
  expect(sockets[0].close).not.toHaveBeenCalled();
  hook.unmount();
});

it("reconnects instead of using a missing canvas version from a compact update", async () => {
  vi.stubGlobal("WebSocket", FakeSocket);
  const room = { code: "ABCDE", round: { id: "round" }, canvas: [], canvasEpoch: 1, canvasVersion: 0 };
  vi.spyOn(api, "bootstrap").mockResolvedValue({ room, revision: 1 });
  const hook = renderHook(() => useGameConnection("token", vi.fn()));
  await waitFor(() => expect(sockets).toHaveLength(1));
  const { canvas, ...metadata } = room;
  act(() => sockets[0].onmessage({ data: JSON.stringify({ type: "room:update", room: { ...metadata, canvasVersion: 4 }, revision: 5 }) }));
  expect(sockets[0].close).toHaveBeenCalledOnce();
  expect(hook.result.current.room.canvas).toEqual([]);
  hook.unmount();
});
