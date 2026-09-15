import { nanoid } from "nanoid";
import { config } from "./config.js";
import { canonicalWord, generateRoomCode, normalizeText, weightedPick } from "./utils.js";

function blankRound() {
  return {
    id: nanoid(12),
    status: "waiting",
    number: 0,
    drawerId: null,
    prompterId: null,
    word: null,
    maskedWord: null,
    startedAt: null,
    winnerIds: [],
  };
}

function summarizeRoom(room, viewerId) {
  const canSeeWord =
    !!room.round.word &&
    (viewerId === room.round.drawerId || viewerId === room.round.prompterId || room.round.status === "finished");

  return {
    code: room.code,
    name: room.name,
    mode: room.mode,
    hostId: room.hostId,
    playerCount: room.players.length,
    players: room.players,
    packs: room.packs.map(({ words, ...pack }) => ({ ...pack, wordCount: words.length })),
    messages: room.messages,
    round: {
      ...room.round,
      pendingGuesses: room.messages.filter((message) => message.roundId === room.round.id && message.status === "pending"),
      word: canSeeWord ? room.round.word : null,
      viewerIsGuesser:
        room.round.status === "active" &&
        viewerId !== room.round.drawerId &&
        (room.mode === "library" || viewerId !== room.round.prompterId),
    },
    canvas: room.canvas,
    me: room.players.find((player) => player.id === viewerId) || null,
  };
}

export class GameStore {
  constructor({ getPacks }) {
    this.rooms = new Map();
    this.sessions = new Map();
    this.socketToPlayer = new Map();
    this.disconnectTimers = new Map();
    this.getPacks = getPacks;
    this.revision = 0;
  }

  createSession(playerId, token) {
    if (this.sessions.size >= config.maxSessions) throw new Error("SERVER_FULL");
    const session = { playerId, token, roomCode: null, sockets: new Set() };
    this.sessions.set(token, session);
    this.scheduleDisconnect(token);
    return { id: playerId, token };
  }

  bindSocket(token, socket) {
    const session = this.sessions.get(token);
    if (!session) return null;
    this.cancelDisconnect(token);
    session.sockets.add(socket);
    this.socketToPlayer.set(socket, token);
    return session;
  }

  unbindSocket(socket) {
    const token = this.socketToPlayer.get(socket);
    this.socketToPlayer.delete(socket);
    const session = this.sessions.get(token);
    if (!session) return null;
    session.sockets.delete(socket);
    if (!session.sockets.size) this.scheduleDisconnect(token);
    return token;
  }

  getSession(token) {
    return this.sessions.get(token);
  }

  scheduleDisconnect(token) {
    this.cancelDisconnect(token);
    const timer = setTimeout(() => this.removeSession(token), config.disconnectMs);
    timer.unref?.();
    this.disconnectTimers.set(token, timer);
  }

  cancelDisconnect(token) {
    clearTimeout(this.disconnectTimers.get(token));
    this.disconnectTimers.delete(token);
  }

  removeSession(token) {
    this.cancelDisconnect(token);
    const session = this.sessions.get(token);
    if (!session) return;
    const code = session.roomCode;
    if (code) this.leaveRoom(session.playerId, code);
    this.sessions.delete(token);
    for (const socket of session.sockets) {
      this.socketToPlayer.delete(socket);
      socket.close(4001, "Session expired");
    }
    this.changed(code);
  }

  changed(roomCode) {
    this.revision += 1;
    this.notifyRoom?.(roomCode);
  }

  dispose() {
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
  }

  listLobby() {
    return Array.from(this.rooms.values()).map((room) => ({
      code: room.code,
      name: room.name,
      mode: room.mode,
      playerCount: room.players.length,
      status: room.round.status,
    }));
  }

  createRoom({ playerId, name, mode, packIds }) {
    if (this.getRoomForPlayer(playerId)) throw new Error("ALREADY_IN_ROOM");
    const code = generateRoomCode(this.rooms);
    const room = {
      code,
      name,
      mode,
      hostId: playerId,
      players: [],
      packs: this.resolvePacks(packIds),
      round: blankRound(),
      messages: [
        { id: nanoid(8), type: "system", text: `${playerId} 创建了房间`, createdAt: Date.now() },
      ],
      canvas: [],
      roleStats: new Map(),
      recentDrawers: [],
      recentPrompters: [],
    };
    this.rooms.set(code, room);
    this.joinRoom(playerId, code);
    return room;
  }

  joinRoom(playerId, roomCode) {
    const room = this.mustRoom(roomCode);
    const previous = this.getRoomForPlayer(playerId);
    if (previous && previous.code !== roomCode) throw new Error("ALREADY_IN_ROOM");
    if (room.players.some((player) => player.id === playerId)) return room;
    if (room.players.length >= config.maxPlayersPerRoom) {
      throw new Error("ROOM_FULL");
    }
    if (!room.players.some((player) => player.id === playerId)) {
      room.players.push({ id: playerId, score: 0, joinedAt: Date.now() });
      this.pushMessage(room, `${playerId} 加入了房间`);
    }
    for (const session of this.sessions.values()) {
      if (session.playerId === playerId) {
        session.roomCode = roomCode;
      }
    }
    return room;
  }

  leaveRoom(playerId, roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || !room.players.some((player) => player.id === playerId)) return;

    room.players = room.players.filter((player) => player.id !== playerId);
    for (const message of room.messages) {
      if (message.status === "pending" && (message.playerId === playerId || [room.round.drawerId, room.round.prompterId].includes(playerId))) {
        message.status = "closed";
      }
    }
    this.pushMessage(room, `${playerId} 离开了房间`);

    if (room.hostId === playerId) {
      room.hostId = room.players[0]?.id || null;
    }

    if (room.round.drawerId === playerId || room.round.prompterId === playerId) {
      room.round = { ...blankRound(), number: room.round.number };
      room.canvas = [];
      this.pushMessage(room, "关键角色离线，本回合已重置");
    }

    for (const session of this.sessions.values()) {
      if (session.playerId === playerId) {
        session.roomCode = null;
      }
    }

    if (!room.players.length) {
      this.rooms.delete(roomCode);
    }
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  getRoomForPlayer(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.some((player) => player.id === playerId)) {
        return room;
      }
    }
    return null;
  }

  serializeRoomFor(playerId, roomCode) {
    return summarizeRoom(this.memberRoom(playerId, roomCode), playerId);
  }

  startRound(playerId, roomCode, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (!["waiting", "finished"].includes(room.round.status)) throw new Error("ROUND_STATE_INVALID");
    if (room.hostId !== playerId) throw new Error("FORBIDDEN");
    if (room.players.length < (room.mode === "host-judged" ? 3 : 2)) throw new Error("NOT_ENOUGH_PLAYERS");

    const drawer = this.pickRole(room, "drawer");
    const prompter = room.mode === "host-judged" ? this.pickRole(room, "prompter", [drawer.id]) : null;
    const nextRound = {
      id: nanoid(12),
      status: room.mode === "host-judged" ? "collecting-word" : "active",
      number: room.round.number + 1,
      drawerId: drawer.id,
      prompterId: prompter?.id || null,
      word: null,
      maskedWord: null,
      startedAt: Date.now(),
      winnerIds: [],
    };

    if (room.mode === "library") {
      const word = this.pickLibraryWord(room);
      nextRound.word = word;
      nextRound.maskedWord = `${word[0]}${"·".repeat(Math.max(word.length - 1, 0))}`;
    }

    room.round = nextRound;
    room.canvas = [];
    this.pushMessage(
      room,
      room.mode === "host-judged"
        ? `第 ${nextRound.number} 回合开始，${prompter.id} 给词，${drawer.id} 作画`
        : `第 ${nextRound.number} 回合开始，${drawer.id} 作画`,
    );
    return room;
  }

  submitPrompt(playerId, roomCode, word, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.round.prompterId !== playerId || room.round.status !== "collecting-word") {
      throw new Error("FORBIDDEN");
    }
    room.round.word = normalizeText(word);
    room.round.maskedWord = `${room.round.word[0]}${"·".repeat(Math.max(room.round.word.length - 1, 0))}`;
    room.round.status = "active";
    room.round.startedAt = Date.now();
    this.pushMessage(room, `${playerId} 已提交词语，开始猜词`);
    return room;
  }

  submitGuess(playerId, roomCode, guess, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.round.status !== "active") throw new Error("ROUND_STATE_INVALID");
    if ([room.round.drawerId, room.round.prompterId].includes(playerId)) throw new Error("ROLE_CANNOT_GUESS");
    if (room.messages.filter((message) => message.status === "pending").length >= 100) throw new Error("GUESS_QUEUE_FULL");
    const text = normalizeText(guess);
    const correct = room.mode === "library" && canonicalWord(text) === canonicalWord(room.round.word);
    room.messages.push({
      id: nanoid(12), type: "guess", playerId, text, roundId: room.round.id,
      status: correct ? "accepted" : room.mode === "host-judged" ? "pending" : "rejected",
      createdAt: Date.now(),
    });
    this.trimMessages(room);
    if (correct) this.finishRound(room, [playerId], `${playerId} 猜中了 ${room.round.word}`);
    return room;
  }

  judgeGuess(playerId, roomCode, guessId, accepted, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.round.status !== "active") throw new Error("ROUND_STATE_INVALID");
    if (room.round.prompterId !== playerId) throw new Error("FORBIDDEN");
    const guess = room.messages.find((message) => message.id === guessId && message.roundId === room.round.id && message.status === "pending");
    if (!guess) throw new Error("GUESS_NOT_PENDING");
    guess.status = accepted ? "accepted" : "rejected";
    if (accepted) this.finishRound(room, [guess.playerId], `${playerId} 判定 ${guess.playerId} 猜对了`);
    else this.pushMessage(room, `${playerId} 判定 ${guess.playerId} 的答案不正确`);
    return room;
  }

  addStroke(playerId, roomCode, stroke, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.round.status !== "active") throw new Error("ROUND_STATE_INVALID");
    if (room.round.drawerId !== playerId) throw new Error("FORBIDDEN");
    room.canvas.push(stroke);
    if (room.canvas.length > 240) {
      room.canvas = room.canvas.slice(-240);
    }
  }

  clearCanvas(playerId, roomCode, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.round.status !== "active") throw new Error("ROUND_STATE_INVALID");
    if (room.round.drawerId !== playerId) throw new Error("FORBIDDEN");
    room.canvas = [];
    this.pushMessage(room, `${playerId} 清空了画布`);
  }

  resolvePacks(packIds) {
    const approvedPacks = this.getPacks().filter((pack) => pack.status === "approved");
    if (!packIds?.length) {
      return approvedPacks.slice(0, 2);
    }
    return approvedPacks.filter((pack) => packIds.includes(pack.id));
  }

  pickRole(room, role, exclude = []) {
    const excluded = new Set(exclude);
    const recent = role === "drawer" ? room.recentDrawers : room.recentPrompters;
    const candidates = room.players
      .filter((player) => !excluded.has(player.id))
      .map((player) => ({
        id: player.id,
        score: room.roleStats.get(`${role}:${player.id}`) || 0,
      }));
    const picked = weightedPick(candidates, recent);
    const key = `${role}:${picked.id}`;
    room.roleStats.set(key, (room.roleStats.get(key) || 0) + 1);
    recent.push(picked.id);
    while (recent.length > config.maxRecentRoles) {
      recent.shift();
    }
    return picked;
  }

  pickLibraryWord(room) {
    const pool = room.packs.flatMap((pack) => pack.words);
    if (!pool.length) return "流星";
    return pool[Math.floor(Math.random() * pool.length)];
  }

  finishRound(room, winnerIds, message) {
    room.round.status = "finished";
    for (const message of room.messages) {
      if (message.status === "pending") message.status = "closed";
    }
    room.round.winnerIds = winnerIds;
    room.canvas = [];
    for (const player of room.players) {
      if (winnerIds.includes(player.id)) player.score += 2;
      if (player.id === room.round.drawerId) player.score += 1;
      if (player.id === room.round.prompterId) player.score += 1;
    }
    this.pushMessage(room, message);
  }

  pushMessage(room, text) {
    room.messages.push({
      id: nanoid(8),
      type: "system",
      text,
      createdAt: Date.now(),
    });
    this.trimMessages(room);
  }

  trimMessages(room) {
    while (room.messages.length > 200) {
      const index = room.messages.findIndex((message) => message.status !== "pending");
      if (index < 0) break;
      room.messages.splice(index, 1);
    }
  }

  memberRoom(playerId, code, roundId) {
    const room = this.mustRoom(code);
    if (!room.players.some((player) => player.id === playerId)) throw new Error("FORBIDDEN");
    if (roundId !== undefined && room.round.id !== roundId) throw new Error("ROUND_STATE_INVALID");
    return room;
  }

  mustRoom(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    return room;
  }
}
