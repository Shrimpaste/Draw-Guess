import { fileURLToPath } from "url";

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535");
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const parsedOrigin = new URL(clientOrigin);
if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.origin !== clientOrigin) throw new Error("CLIENT_ORIGIN must be an exact HTTP(S) origin without a trailing slash");
export const config = {
  port,
  host: process.env.HOST || "127.0.0.1",
  trustProxy: process.env.TRUST_PROXY === "loopback" ? "loopback" : false,
  clientOrigin,
  adminKey: process.env.ADMIN_KEY || "",
  databasePath: process.env.DATABASE_PATH || fileURLToPath(new URL("../data/app.db", import.meta.url)),
  roomCodeLength: 5,
  maxPlayersPerRoom: 10,
  maxRoomNameLength: 32,
  maxWordLength: 28,
  roundSeconds: 100,
  maxRecentRoles: 3,
  maxStrokePoints: 512,
  disconnectMs: 60_000,
  maxSessions: 100,
};
