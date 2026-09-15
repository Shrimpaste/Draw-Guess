import cors from "cors";
import express from "express";
import helmet from "helmet";
import { nanoid } from "nanoid";
import { config } from "./config.js";
import {
  createWordPack,
  deleteWordPack,
  listWordPacks,
  seedWordPacksIfEmpty,
  setWordPackStatus,
} from "./db.js";
import { GameStore } from "./gameStore.js";
import { rateLimit, requireAdmin, validateOrigin } from "./security.js";
import {
  guessSchema,
  joinSchema,
  judgeSchema,
  promptSubmitSchema,
  roomSchema,
  sessionSchema,
  startRoundSchema,
  wordPackSchema,
} from "./validators.js";
import { normalizeText } from "./utils.js";

seedWordPacksIfEmpty();

function getToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function createUniquePlayerId(preferredId, store) {
  const base = normalizeText(preferredId) || `Player-${Math.floor(Math.random() * 900 + 100)}`;
  const online = new Set([...store.sessions.values()].map((session) => session.playerId));
  if (!online.has(base)) return base;
  let nextId = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
  while (online.has(nextId)) {
    nextId = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  return nextId;
}

const knownErrors = new Set([
  "ALREADY_IN_ROOM",
  "SERVER_FULL",
  "GUESS_QUEUE_FULL",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "FORBIDDEN",
  "NOT_ENOUGH_PLAYERS",
  "ROUND_STATE_INVALID",
  "ROLE_CANNOT_GUESS",
  "GUESS_NOT_PENDING",
]);

export function createApp() {
  const app = express();
  const store = new GameStore({ getPacks: () => listWordPacks({ includePending: true }) });
  const notifyRoom = (roomCode) => store.changed(roomCode);

  app.set("store", store);
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json({ ...body, revision: store.revision });
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: config.clientOrigin }));
  app.use(validateOrigin);
  app.use(rateLimit({ windowMs: 15_000, limit: 120 }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_, res) => {
    res.json({ ok: true, now: new Date().toISOString() });
  });

  app.post("/api/session", (req, res) => {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid session payload" });
    const id = createUniquePlayerId(parsed.data.preferredId, store);
    const token = nanoid(24);
    const player = store.createSession(id, token);
    return res.status(201).json({ player });
  });

  app.delete("/api/session", (req, res) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Missing token" });
    store.removeSession(token);
    return res.status(204).end();
  });

  app.use((req, res, next) => {
    if (req.path === "/api/health" || req.path === "/api/session") return next();
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Missing token" });
    const session = store.getSession(token);
    if (!session) return res.status(401).json({ error: "Session invalid" });
    req.player = { id: session.playerId, token };
    req.authToken = token;
    return next();
  });

  app.get("/api/bootstrap", (req, res) => {
    const room = store.getRoomForPlayer(req.player.id);
    return res.json({
      player: req.player,
      lobby: store.listLobby(),
      packs: listWordPacks(),
      room: room ? store.serializeRoomFor(req.player.id, room.code) : null,
      modeDescriptions: [
        {
          id: "host-judged",
          title: "灵感裁判局",
          description: "系统随机一人给词、一人作画，其余玩家猜测，由给词者最终裁定是否命中。",
        },
        {
          id: "library",
          title: "公共词库局",
          description: "从审核后的词库中随机抽题，一人作画，其余玩家直接匹配标准答案。",
        },
      ],
    });
  });

  app.get("/api/lobby", (_, res) => {
    return res.json({ rooms: store.listLobby(), packs: listWordPacks() });
  });

  app.post("/api/rooms", (req, res) => {
    const parsed = roomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid room payload" });
    const room = store.createRoom({ playerId: req.player.id, ...parsed.data });
    notifyRoom(room.code);
    return res.status(201).json({
      room: store.serializeRoomFor(req.player.id, room.code),
      lobby: store.listLobby(),
    });
  });

  app.post("/api/rooms/join", (req, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid join payload" });
    const room = store.joinRoom(req.player.id, parsed.data.roomCode);
    notifyRoom(room.code);
    return res.json({ room: store.serializeRoomFor(req.player.id, room.code), lobby: store.listLobby() });
  });

  app.post("/api/rooms/leave", (req, res) => {
    const room = store.getRoomForPlayer(req.player.id);
    if (room) {
      store.leaveRoom(req.player.id, room.code);
      notifyRoom(room.code);
    }
    return res.json({ room: null, lobby: store.listLobby() });
  });

  app.post("/api/rounds/start", (req, res) => {
    const parsed = startRoundSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid round payload" });
    const room = store.startRound(req.player.id, parsed.data.roomCode, parsed.data.roundId);
    notifyRoom(room.code);
    return res.json({ room: store.serializeRoomFor(req.player.id, room.code) });
  });

  app.post("/api/rounds/skip", (req, res) => {
    const parsed = startRoundSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid round payload" });
    const room = store.skipRound(req.player.id, parsed.data.roomCode, parsed.data.roundId);
    notifyRoom(room.code);
    return res.json({ room: store.serializeRoomFor(req.player.id, room.code) });
  });

  app.post("/api/rounds/prompt", (req, res) => {
    const parsed = promptSubmitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid prompt payload" });
    const room = store.submitPrompt(req.player.id, parsed.data.roomCode, parsed.data.word, parsed.data.roundId);
    notifyRoom(room.code);
    return res.json({ room: store.serializeRoomFor(req.player.id, room.code) });
  });

  app.post("/api/rounds/guess", (req, res) => {
    const parsed = guessSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid guess payload" });
    const room = store.submitGuess(req.player.id, parsed.data.roomCode, parsed.data.guess, parsed.data.roundId);
    notifyRoom(room.code);
    return res.json({ room: store.serializeRoomFor(req.player.id, room.code) });
  });

  app.post("/api/rounds/judge", (req, res) => {
    const parsed = judgeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid judge payload" });
    const room = store.judgeGuess(req.player.id, parsed.data.roomCode, parsed.data.guessId, parsed.data.accepted, parsed.data.roundId);
    notifyRoom(room.code);
    return res.json({ room: store.serializeRoomFor(req.player.id, room.code) });
  });

  app.get("/api/packs", (_, res) => {
    return res.json({ packs: listWordPacks() });
  });

  app.post("/api/packs", (req, res) => {
    const parsed = wordPackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid pack payload" });
    const createdAt = new Date().toISOString();
    const packId = nanoid(10);
    createWordPack(
      {
        id: packId,
        name: parsed.data.name,
        description: parsed.data.description,
        status: "pending",
        createdBy: req.player.id,
        createdAt,
      },
      parsed.data.words.map((value, index) => ({
        id: `${packId}-${index}`,
        packId,
        value,
        createdAt,
      })),
    );
    return res.status(201).json({ submittedPack: { id: packId, status: "pending" }, packs: listWordPacks() });
  });

  app.get("/api/admin/packs", requireAdmin, (_, res) => {
    return res.json({ packs: listWordPacks({ includePending: true }) });
  });

  app.post("/api/admin/packs/:packId/approve", requireAdmin, (req, res) => {
    setWordPackStatus(req.params.packId, "approved");
    return res.json({ packs: listWordPacks({ includePending: true }) });
  });

  app.delete("/api/admin/packs/:packId", requireAdmin, (req, res) => {
    deleteWordPack(req.params.packId);
    return res.status(204).end();
  });

  app.use((error, req, res, next) => {
    if (!error) return next();
    if (error.type === "entity.parse.failed" || error.type === "entity.too.large") return res.status(error.status).json({ error: "Invalid request body" });
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "PACK_NAME_TAKEN" });
    if (knownErrors.has(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
