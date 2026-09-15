import assert from "node:assert/strict";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { WebSocket } from "ws";
import { applyCanvasEvent } from "../client/src/canvasState.js";

// Default is an isolated local server. An explicit URL tests a deployed server
// using 10 temporary sessions and a dedicated room, all cleaned up afterwards.
let base = process.argv[2];
let server, store, realtime;
if (!base) {
  process.env.DATABASE_PATH = ":memory:";
  const { createApp } = await import("../server/src/createApp.js");
  const { attachRealtime } = await import("../server/src/realtime.js");
  const app = createApp(); store = app.get("store");
  server = http.createServer(app); realtime = attachRealtime(server, store);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
base = new URL(base).origin;
const peers = [], latencies = [], sent = new Map();
let bytes = 0, errors = [];
const startedAt = performance.now();
async function api(path, peer, body, method = "POST") {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(peer ? { Authorization: `Bearer ${peer.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function until(condition, label) {
  const deadline = Date.now() + 10000;
  while (!condition()) { if (Date.now() > deadline) throw new Error(`Timeout: ${label}`); await delay(20); }
}
async function connect(peer) {
  const socket = new WebSocket(base.replace(/^http/, "ws") + "/ws?token=" + peer.token);
  peer.socket = socket;
  socket.on("error", (error) => errors.push(error.message));
  socket.on("message", (raw) => {
    bytes += raw.length;
    const event = JSON.parse(String(raw));
    if (event.type === "room:update") peer.room = event.room;
    if (event.type.startsWith("canvas:")) {
      try { peer.room = applyCanvasEvent(peer.room, event); } catch (error) { errors.push(error.message); }
      if (sent.has(event.version)) latencies.push(performance.now() - sent.get(event.version));
    }
    if (event.type === "error") errors.push(event.error);
  });
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
}
try {
  for (let i = 0; i < 10; i++) {
    const { player } = await api("/api/session", null, { preferredId: `Load${Date.now().toString(36)}${i}` });
    peers.push(player); await connect(player);
  }
  const host = peers[0];
  const { room } = await api("/api/rooms", host, { name: "10人同步验证", mode: "library", packIds: [] });
  for (const peer of peers.slice(1)) await api("/api/rooms/join", peer, { roomCode: room.code });
  await api("/api/rounds/start", host, { roomCode: room.code, roundId: room.round.id });
  await until(() => peers.every((peer) => peer.room?.round.status === "active"), "round broadcast");
  const drawer = peers.find((peer) => peer.id === host.room.round.drawerId);
  const guessers = peers.filter((peer) => peer !== drawer);
  const roundId = drawer.room.round.id, epoch = drawer.room.canvasEpoch;
  const initialVersion = drawer.room.canvasVersion;
  for (let chunk = 0; chunk < 200; chunk++) {
    const version = initialVersion + chunk + 1;
    sent.set(version, performance.now());
    drawer.socket.send(JSON.stringify({ type: "canvas:stroke", roundId, epoch, stroke: { id: "load-stroke", offset: chunk * 16, tool: "pen", color: "#16110f", width: 5, points: Array.from({ length: 16 }, (_, i) => ({ x: (chunk * 16 + i) % 960, y: 300 + Math.sin((chunk * 16 + i) / 30) * 100 })) } }));
    if (chunk === 80) {
      const peer = guessers[0]; peer.socket.close(); await connect(peer);
      await until(() => peer.room?.canvasVersion >= version, "reconnect snapshot");
    }
    if (chunk % 50 === 0) await api("/api/rounds/guess", guessers[1], { roomCode: room.code, roundId, guess: "回归测试答案" });
    await delay(50);
  }
  await until(() => peers.every((peer) => peer.room?.canvasVersion === initialVersion + 200), "all canvas versions");
  for (const peer of peers) assert.equal(peer.room.canvas[0].points.length, 3200);
  assert.equal(errors.length, 0, errors.join(", "));
  await api("/api/rounds/guess", guessers[0], { roomCode: room.code, roundId, guess: drawer.room.round.word });
  await until(() => peers.every((peer) => peer.room?.round.status === "finished"), "round result");
  for (const peer of peers) { assert.equal(peer.room.canvas[0].points.length, 3200); assert.deepEqual(peer.room.round.winnerIds, [guessers[0].id]); }
  latencies.sort((a, b) => a - b);
  console.log(JSON.stringify({ target: base, clients: 10, chunks: 200, points: 3200, reconnects: 1, errors: errors.length, elapsedSeconds: +((performance.now() - startedAt) / 1000).toFixed(2), observedMessages: latencies.length, p95DeliveryMs: +latencies[Math.floor(latencies.length * .95)].toFixed(2), receivedMiB: +(bytes / 1048576).toFixed(2), runnerRssMiB: +(process.memoryUsage().rss / 1048576).toFixed(2) }, null, 2));
} finally {
  for (const peer of peers) { peer.socket?.terminate(); await api("/api/session", peer, undefined, "DELETE").catch(() => {}); }
  if (realtime) { for (const socket of realtime.clients) socket.terminate(); realtime.close(); }
  if (server) await new Promise((resolve) => server.close(resolve));
  store?.dispose();
}
