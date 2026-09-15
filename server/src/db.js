import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

if (config.databasePath !== ":memory:") mkdirSync(dirname(config.databasePath), { recursive: true });
const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
export const closeDatabase = () => db.close();

db.exec(`
  CREATE TABLE IF NOT EXISTS word_packs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY,
    pack_id TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (pack_id) REFERENCES word_packs(id) ON DELETE CASCADE
  );
`);

const timestamp = () => new Date().toISOString();

const statements = {
  insertPack: db.prepare(`
    INSERT INTO word_packs (id, name, description, status, created_by, created_at)
    VALUES (@id, @name, @description, @status, @createdBy, @createdAt)
  `),
  insertWord: db.prepare(`
    INSERT INTO words (id, pack_id, value, created_at)
    VALUES (@id, @packId, @value, @createdAt)
  `),
  listPublicPacks: db.prepare(`
    SELECT id, name, description, status, created_by AS createdBy, created_at AS createdAt
    FROM word_packs
    WHERE status = 'approved'
    ORDER BY created_at DESC
  `),
  listAllPacks: db.prepare(`
    SELECT id, name, description, status, created_by AS createdBy, created_at AS createdAt
    FROM word_packs
    ORDER BY created_at DESC
  `),
  getWordsByPack: db.prepare("SELECT value FROM words WHERE pack_id = ? ORDER BY value ASC"),
  setPackStatus: db.prepare("UPDATE word_packs SET status = ? WHERE id = ?"),
  deletePack: db.prepare("DELETE FROM word_packs WHERE id = ?"),
};

export function createWordPack(pack, words) {
  const insert = db.transaction(() => {
    statements.insertPack.run(pack);
    for (const word of words) {
      statements.insertWord.run(word);
    }
  });
  insert();
}

export function listWordPacks({ includePending = false } = {}) {
  const packs = includePending ? statements.listAllPacks.all() : statements.listPublicPacks.all();
  return packs.map((pack) => ({
    ...pack,
    words: statements.getWordsByPack.all(pack.id).map((row) => row.value),
  }));
}

export function setWordPackStatus(id, status) {
  return statements.setPackStatus.run(status, id).changes;
}

export function deleteWordPack(id) {
  return statements.deletePack.run(id).changes;
}

export function seedWordPacksIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM word_packs").get().count;
  if (count > 0) {
    return;
  }

  const baseTime = timestamp();
  const seedPacks = [
    {
      id: "pack-core",
      name: "灵感基础包",
      description: "适合聚会热身，词语直观且便于绘制。",
      words: ["火箭", "鲸鱼", "雨伞", "钢琴", "沙漏", "灯塔", "风筝", "龙卷风"],
    },
    {
      id: "pack-cinema",
      name: "戏剧感场景包",
      description: "更强调动作和故事感，适合想画面更丰富的房间。",
      words: ["侦探", "宇航员", "海盗船", "烟花", "面具", "指挥家", "陨石", "钟楼"],
    },
  ];

  for (const pack of seedPacks) {
    createWordPack(
      {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        status: "approved",
        createdBy: "system",
        createdAt: baseTime,
      },
      pack.words.map((value, index) => ({
        id: `${pack.id}-${index}`,
        packId: pack.id,
        value,
        createdAt: baseTime,
      })),
    );
  }
}
