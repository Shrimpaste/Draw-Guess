import http from "node:http";
import { once } from "node:events";
import request from "supertest";
import { WebSocket } from "ws";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createApp } from "./createApp.js";
import { attachRealtime } from "./realtime.js";

let app, server, wss, store, port;
beforeEach(async () => {
  app = createApp(); store = app.get("store");
  server = http.createServer(app); wss = attachRealtime(server, store);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  port = server.address().port;
});
afterEach(async () => {
  for (const socket of wss.clients) socket.terminate();
  await new Promise((resolve) => wss.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  store.dispose();
});
async function player(id) {
  return (await request(app).post("/api/session").send({ preferredId: id })).body.player;
}
async function connect(user) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${user.token}`);
  socket.messages = [];
  socket.on("message", (raw) => socket.messages.push(JSON.parse(String(raw))));
  await once(socket, "open");
  return socket;
}
async function message(socket, predicate) {
  await expect.poll(() => socket.messages.find(predicate)).toBeTruthy();
  return socket.messages.find(predicate);
}
it("notifies lobby clients about creation and deletion, including another tab of the host", async () => {
  const host = await player("Host"), guest = await player("Guest");
  const a = await connect(host), b = await connect(host), lobby = await connect(guest);
  const created = await request(app).post("/api/rooms").set("Authorization", `Bearer ${host.token}`).send({ name: "房间", mode: "library" });
  const code = created.body.room.code;
  await message(lobby, (m) => m.type === "lobby:update" && m.lobby.some((r) => r.code === code));
  await message(b, (m) => m.room?.code === code);
  a.close(); await once(a, "close");
  await expect.poll(() => store.getSession(host.token).sockets.size).toBe(1);
  lobby.messages = []; b.messages = [];
  await request(app).post("/api/rooms/leave").set("Authorization", `Bearer ${host.token}`).send({});
  await message(b, (m) => m.type === "room:update" && m.room === null);
  await message(lobby, (m) => m.type === "lobby:update" && m.lobby.length === 0);
});
it("rejects invalid points and unknown messages without corrupting the canvas", async () => {
  const host = await player("Drawer");
  const socket = await connect(host);
  const room = store.createRoom({ playerId: host.id, name: "test", mode: "library" });
  store.joinRoom("guest", room.code); store.startRound(host.id, room.code, room.round.id);
  room.round.drawerId = host.id;
  socket.send(JSON.stringify({ type: "canvas:stroke", roundId: room.round.id, epoch: room.canvasEpoch, stroke: { id: "bad", offset: 0, tool: "pen", points: [null], color: "#000000", width: 4 } }));
  await message(socket, (m) => m.error === "INVALID_REALTIME_MESSAGE");
  expect(room.canvas).toHaveLength(0);
  socket.messages = [];
  socket.send(JSON.stringify({ type: "unknown" }));
  await message(socket, (m) => m.error === "INVALID_REALTIME_MESSAGE");
  expect(socket.messages.filter((m) => m.type === "room:update")).toHaveLength(0);
});
it.each(["frame", "oversized"])("survives %s protocol errors", async (kind) => {
  const socket = await connect(await player("Malformed"));
  const closed = once(socket, "close");
  if (kind === "frame") socket._socket.write(Buffer.from([0x83, 0x80, 0, 0, 0, 0]));
  else socket.send("x".repeat(65537));
  await closed;
  expect((await request(app).get("/api/health")).status).toBe(200);
});

it("streams small chunks to a viewer before the stroke ends and rejects old canvas epochs", async () => {
  const artist = await player("Artist"), viewer = await player("Viewer");
  const room = store.createRoom({ playerId: artist.id, name: "test", mode: "library" });
  store.joinRoom(viewer.id, room.code); store.startRound(artist.id, room.code, room.round.id);
  room.round.drawerId = artist.id;
  const a = await connect(artist), b = await connect(viewer);
  const packet = { type: "canvas:stroke", roundId: room.round.id, epoch: room.canvasEpoch, stroke: { id: "stroke", tool: "pen", offset: 0, width: 4, color: "#000000", points: [{ x: 1, y: 1 }] } };
  a.send(JSON.stringify(packet));
  const first = await message(b, (m) => m.type === "canvas:stroke");
  expect(first.room).toBeUndefined();
  expect(first.stroke.points).toHaveLength(1);
  a.send(JSON.stringify({ ...packet, stroke: { ...packet.stroke, offset: 1, points: [{ x: 2, y: 2 }] } }));
  await message(b, (m) => m.type === "canvas:stroke" && m.stroke.offset === 1);
  expect(room.canvas[0].points).toHaveLength(2);
  a.send(JSON.stringify({ type: "canvas:clear", roundId: room.round.id, epoch: room.canvasEpoch }));
  await message(b, (m) => m.type === "canvas:snapshot" && !m.canvas.length);
  a.send(JSON.stringify(packet));
  await message(a, (m) => m.error === "CANVAS_CHANGED");
  expect(room.canvas).toHaveLength(0);
});
it("rejects foreign origins and sessions unknown to a restarted app", async () => {
  const user = await player("Restart");
  const restarted = createApp();
  expect((await request(restarted).get("/api/bootstrap").set("Authorization", `Bearer ${user.token}`)).status).toBe(401);
  restarted.get("store").dispose();
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${user.token}`, { origin: "https://foreign.invalid" });
  const response = await new Promise((resolve) => socket.on("unexpected-response", (_, response) => { resolve(response.statusCode); response.destroy(); }));
  socket.on("error", () => {}); socket.terminate();
  expect(response).toBe(403);
});
