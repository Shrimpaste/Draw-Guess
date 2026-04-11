import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { deletePlayerByToken, getPlayerByToken, touchPlayer } from "./db.js";

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export function attachRealtime(server, store) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  function broadcastRoom(roomCode) {
    const room = store.getRoom(roomCode);
    if (!room) return;
    for (const session of store.sessions.values()) {
      if (session.roomCode === roomCode && session.socket) {
        send(session.socket, {
          type: "room:update",
          room: store.serializeRoomFor(session.playerId, roomCode),
          lobby: store.listLobby(),
        });
      }
    }
  }

  wss.on("connection", (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token) {
      socket.close();
      return;
    }

    const player = getPlayerByToken(token);
    if (!player) {
      socket.close();
      return;
    }

    touchPlayer(token);
    const session = store.bindSocket(token, socket);
    send(socket, { type: "connected", playerId: player.id, lobby: store.listLobby() });
    if (session?.roomCode) {
      broadcastRoom(session.roomCode);
    }

    socket.on("message", (raw) => {
      try {
        const data = JSON.parse(String(raw));
        const active = store.getSession(token);
        const roomCode = active?.roomCode;
        if (!roomCode) return;

        if (data.type === "canvas:stroke") {
          const points = Array.isArray(data.stroke?.points) ? data.stroke.points.slice(0, config.maxStrokePoints) : [];
          store.addStroke(player.id, roomCode, {
            color: data.stroke?.color || "#111827",
            width: Math.min(Math.max(Number(data.stroke?.width || 4), 1), 24),
            points,
          });
        }

        if (data.type === "canvas:clear") {
          store.clearCanvas(player.id, roomCode);
        }

        broadcastRoom(roomCode);
      } catch (error) {
        send(socket, { type: "error", error: error.message || "Realtime error" });
      }
    });

    socket.on("close", () => {
      const closedToken = store.unbindSocket(socket);
      if (!closedToken) return;

      const active = store.getSession(closedToken);
      const roomCode = active?.roomCode;
      const isClosing = active?.isClosing;

      store.scheduleDisconnect(closedToken, (expiredToken) => {
        const expiredSession = store.getSession(expiredToken);
        if (!expiredSession || expiredSession.socket) {
          return;
        }
        const expiredRoomCode = expiredSession.roomCode;
        store.removeSession(expiredToken);
        deletePlayerByToken(expiredToken);
        if (expiredRoomCode) {
          broadcastRoom(expiredRoomCode);
        }
      });

      if (isClosing && roomCode) {
        broadcastRoom(roomCode);
      }
    });
  });

  store.notifyRoom = broadcastRoom;
  return wss;
}
