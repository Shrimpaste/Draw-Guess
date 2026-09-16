import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";

const target = process.argv[2];
if (!target || config.databasePath === ":memory:" || !existsSync(config.databasePath)) throw new Error("Usage: DATABASE_PATH=/path/app.db node server/src/backup.js /path/new-backup.db");
if (resolve(target) === resolve(config.databasePath) || existsSync(target)) throw new Error("Backup target must be a new file");
mkdirSync(dirname(resolve(target)), { recursive: true });
const database = new Database(config.databasePath, { readonly: true, fileMustExist: true });
try {
  await database.backup(target);
  const backup = new Database(target, { readonly: true });
  try { if (backup.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Backup integrity check failed"); }
  finally { backup.close(); }
  console.log(`Verified backup: ${resolve(target)}`);
} finally { database.close(); }
