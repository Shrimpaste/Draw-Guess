import { fileURLToPath } from "url";

export const config = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  adminKey: process.env.ADMIN_KEY || "local-admin-key",
  databasePath: process.env.DATABASE_PATH || fileURLToPath(new URL("../data/app.db", import.meta.url)),
  roomCodeLength: 5,
  maxPlayersPerRoom: 10,
  maxRoomNameLength: 32,
  maxWordLength: 28,
  roundSeconds: 100,
  maxRecentRoles: 3,
  maxStrokePoints: 512,
};
