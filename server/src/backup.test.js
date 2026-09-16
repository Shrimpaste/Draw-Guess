import { expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

it("backs up a live WAL database, preserves rows on restore, and refuses overwrite", () => {
  const directory = mkdtempSync(join(tmpdir(), "draw-guess-backup-"));
  const source = join(directory, "source.db"), target = join(directory, "backup.db");
  const db = new Database(source);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES ('词包测试');");
  try {
    const run = () => spawnSync(process.execPath, [fileURLToPath(new URL("./backup.js", import.meta.url)), target], { env: { ...process.env, DATABASE_PATH: source }, encoding: "utf8" });
    expect(run().status).toBe(0);
    db.exec("DELETE FROM sample");
    const backup = new Database(target);
    try { expect(backup.prepare("SELECT value FROM sample").get().value).toBe("词包测试"); }
    finally { backup.close(); }
    expect(run().status).not.toBe(0);
  } finally {
    db.close();
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});
