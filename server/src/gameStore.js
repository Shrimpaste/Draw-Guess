import { nanoid } from "nanoid";
import { config } from "./config.js";
import { canonicalWord, generateRoomCode, maskWord, normalizeText, weightedPick } from "./utils.js";

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
    canvasEpoch: room.canvasEpoch,
    canvasVersion: room.canvasVersion,
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
    this.roundTimers = new Map();
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
    for (const timer of this.roundTimers.values()) clearTimeout(timer);
    this.roundTimers.clear();
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
      canvasEpoch: 0,
      canvasVersion: 0,
      canvasPoints: 0,
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

    if (["active", "collecting-word"].includes(room.round.status) &&
      ([room.round.drawerId, room.round.prompterId].includes(playerId) || room.players.length < (room.mode === "host-judged" ? 3 : 2))) {
      this.finishRound(room, [], "玩家离开，本轮结束", "player-left");
    }

    for (const session of this.sessions.values()) {
      if (session.playerId === playerId) {
        session.roomCode = null;
      }
    }

    if (!room.players.length) {
      clearTimeout(this.roundTimers.get(roomCode));
      this.roundTimers.delete(roomCode);
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
      nextRound.maskedWord = maskWord(word);
    }

    room.round = nextRound;
    room.canvas = [];
    room.canvasPoints = 0;
    room.canvasEpoch += 1;
    room.canvasVersion += 1;
    this.scheduleRound(room, room.mode === "host-judged" ? 30 : config.roundSeconds);
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
    room.round.maskedWord = maskWord(room.round.word);
    room.round.status = "active";
    room.round.startedAt = Date.now();
    this.scheduleRound(room, config.roundSeconds);
    this.pushMessage(room, `${playerId} 已提交词语，开始猜词`);
    return room;
  }

  submitGuess(playerId, roomCode, guess, roundId, clientGuessId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    // A lost HTTP response may be retried after the guess already ended the round.
    if (clientGuessId && room.messages.some((message) => message.playerId === playerId && message.roundId === roundId && message.clientGuessId === clientGuessId)) return room;
    if (room.round.status !== "active") throw new Error("ROUND_STATE_INVALID");
    if ([room.round.drawerId, room.round.prompterId].includes(playerId)) throw new Error("ROLE_CANNOT_GUESS");
    if (room.messages.filter((message) => message.status === "pending").length >= 100) throw new Error("GUESS_QUEUE_FULL");
    const text = normalizeText(guess);
    const correct = room.mode === "library" && canonicalWord(text) === canonicalWord(room.round.word);
    room.messages.push({
      id: nanoid(12), type: "guess", playerId, text, roundId: room.round.id,
      ...(clientGuessId ? { clientGuessId } : {}),
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

  drawingRoom(playerId, roomCode, roundId, epoch) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.round.status !== "active") throw new Error("ROUND_STATE_INVALID");
    if (room.round.drawerId !== playerId) throw new Error("FORBIDDEN");
    if (epoch !== room.canvasEpoch) throw new Error("CANVAS_CHANGED");
    return room;
  }

  addStroke(playerId, roomCode, stroke, roundId, epoch) {
    const room = this.drawingRoom(playerId, roomCode, roundId, epoch);
    const existing = room.canvas.find((item) => item.id === stroke.id);
    if (stroke.offset !== (existing?.points.length || 0)) throw new Error("CANVAS_CHANGED");
    if (existing && ["color", "width", "tool"].some((key) => existing[key] !== stroke[key])) throw new Error("CANVAS_CHANGED");
    if (room.canvasPoints + stroke.points.length > 100_000 || (!existing && room.canvas.length >= 2000)) throw new Error("CANVAS_FULL");
    if (existing) existing.points.push(...stroke.points);
    else {
      const { offset, ...value } = stroke;
      room.canvas.push({ ...value, points: [...stroke.points] });
    }
    room.canvasPoints += stroke.points.length;
    room.canvasVersion += 1;
    return { type: "canvas:stroke", roomCode, roundId, epoch, version: room.canvasVersion, stroke };
  }

  clearCanvas(playerId, roomCode, roundId, epoch) {
    const room = this.drawingRoom(playerId, roomCode, roundId, epoch);
    room.canvas = [];
    room.canvasPoints = 0;
    room.canvasEpoch += 1;
    room.canvasVersion += 1;
    return this.canvasSnapshot(room);
  }

  undoStroke(playerId, roomCode, roundId, epoch) {
    const room = this.drawingRoom(playerId, roomCode, roundId, epoch);
    const removed = room.canvas.pop();
    room.canvasPoints -= removed?.points.length || 0;
    room.canvasEpoch += 1;
    room.canvasVersion += 1;
    return this.canvasSnapshot(room);
  }

  canvasSnapshot(room) {
    return { type: "canvas:snapshot", roomCode: room.code, roundId: room.round.id, epoch: room.canvasEpoch, version: room.canvasVersion, canvas: room.canvas };
  }

  scheduleRound(room, seconds) {
    clearTimeout(this.roundTimers.get(room.code));
    room.round.endsAt = Date.now() + seconds * 1000;
    const timer = setTimeout(() => this.expireRound(room), seconds * 1000);
    timer.unref?.();
    this.roundTimers.set(room.code, timer);
  }

  expireRound(room) {
    if (["active", "collecting-word"].includes(room.round.status) && Date.now() >= room.round.endsAt) {
      this.finishRound(room, [], room.round.status === "collecting-word" ? "出题超时，本轮结束" : `时间到，答案是 ${room.round.word}`, "timeout");
      this.changed(room.code);
    }
  }

  skipRound(playerId, roomCode, roundId) {
    const room = this.memberRoom(playerId, roomCode, roundId);
    if (room.hostId !== playerId) throw new Error("FORBIDDEN");
    if (!["active", "collecting-word"].includes(room.round.status)) throw new Error("ROUND_STATE_INVALID");
    this.finishRound(room, [], "房主结束了本轮", "skipped");
    return room;
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

  finishRound(room, winnerIds, message, reason = "guessed") {
    clearTimeout(this.roundTimers.get(room.code));
    this.roundTimers.delete(room.code);
    room.round.reason = reason;
    room.round.endsAt = null;
    room.round.scoreChanges = {};
    room.round.status = "finished";
    for (const message of room.messages) {
      if (message.status === "pending") message.status = "closed";
    }
    room.round.winnerIds = winnerIds;
    for (const player of room.players) {
      const delta = winnerIds.includes(player.id) ? 2 : winnerIds.length && [room.round.drawerId, room.round.prompterId].includes(player.id) ? 1 : 0;
      player.score += delta;
      room.round.scoreChanges[player.id] = delta;
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
    this.expireRound(room);
    if (roundId !== undefined && room.round.id !== roundId) throw new Error("ROUND_STATE_INVALID");
    return room;
  }

  mustRoom(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    return room;
  }
}
