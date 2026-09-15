import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { realtimeSchema } from "./validators.js";

function send(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  if (socket.bufferedAmount > 4 * 1024 * 1024) return socket.terminate();
  socket.send(JSON.stringify(payload));
}

export function attachRealtime(server, store) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const upgrade = (request, socket, head) => {
    let url;
    try { url = new URL(request.url, "http://localhost"); }
    catch { socket.destroy(); return; }
    const session = store.getSession(url.searchParams.get("token"));
    const allowed = !request.headers.origin || request.headers.origin === config.clientOrigin;
    if (url.pathname !== "/ws" || !session || !allowed || session.sockets.size >= 4) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, session.token));
  };
  server.on("upgrade", upgrade);

  const snapshot = (session) => ({
    type: "room:update", revision: store.revision,
    room: session.roomCode ? store.serializeRoomFor(session.playerId, session.roomCode) : null,
  });
  function broadcastState(roomCode) {
    const lobby = store.listLobby();
    for (const session of store.sessions.values()) {
      for (const socket of session.sockets) {
        if (session.roomCode === roomCode || !session.roomCode) send(socket, snapshot(session));
        if (!session.roomCode) send(socket, { type: "lobby:update", lobby, revision: store.revision });
      }
    }
  }
  wss.on("error", (error) => console.error("Realtime server error:", error.message));
  wss.on("connection", (socket, token) => {
    socket.on("error", () => socket.terminate());
    const session = store.bindSocket(token, socket);
    if (!session) return socket.close(4001, "Session expired");
    socket.alive = true;
    socket.on("pong", () => { socket.alive = true; });
    send(socket, { type: "connected", playerId: session.playerId, lobby: store.listLobby(), revision: store.revision });
    send(socket, snapshot(session));
    let windowStart = Date.now();
    let count = 0;
    socket.on("message", (raw) => {
      if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); count = 0; }
      if (++count > 60) return socket.close(4008, "Rate limit");
      try {
        const parsed = realtimeSchema.safeParse(JSON.parse(String(raw)));
        if (!parsed.success) return send(socket, { type: "error", error: "INVALID_REALTIME_MESSAGE" });
        const active = store.getSession(token);
        if (!active?.roomCode) return send(socket, { type: "error", error: "ROOM_NOT_FOUND" });
        const data = parsed.data;
        if (data.type === "canvas:stroke") store.addStroke(active.playerId, active.roomCode, data.stroke, data.roundId);
        if (data.type === "canvas:clear") store.clearCanvas(active.playerId, active.roomCode, data.roundId);
        store.changed(active.roomCode);
      } catch (error) {
        send(socket, { type: "error", error: error instanceof SyntaxError ? "INVALID_REALTIME_MESSAGE" : error.message });
      }
    });
    socket.on("close", () => store.unbindSocket(socket));
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.alive) socket.terminate();
      else { socket.alive = false; socket.ping(); }
    }
  }, 30_000);
  heartbeat.unref();
  wss.on("close", () => {
    clearInterval(heartbeat);
    server.off("upgrade", upgrade);
    store.notifyRoom = undefined;
  });
  store.notifyRoom = broadcastState;
  return wss;
}
