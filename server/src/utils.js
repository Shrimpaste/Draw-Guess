import { customAlphabet } from "nanoid";
import { config } from "./config.js";

const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeRoomCode = customAlphabet(roomAlphabet, config.roomCodeLength);

export function generateRoomCode(existingRooms) {
  let code = makeRoomCode();
  while (existingRooms.has(code)) {
    code = makeRoomCode();
  }
  return code;
}

export function normalizeText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

export function canonicalWord(text) {
  return normalizeText(text).toLowerCase();
}

export function maskWord(word) {
  // Count Unicode characters rather than UTF-16 units, including rare Han characters.
  const characters = Array.from(word);
  return characters.length > 1 ? `${characters[0]}${"·".repeat(characters.length - 1)}` : "·";
}

export function weightedPick(candidates, recentIds = []) {
  const recentSet = new Set(recentIds);
  const scored = candidates.map((candidate) => ({
    ...candidate,
    score: candidate.score + (recentSet.has(candidate.id) ? 3 : 0),
  }));
  const minScore = Math.min(...scored.map((item) => item.score));
  const pool = scored.filter((item) => item.score === minScore);
  return pool[Math.floor(Math.random() * pool.length)];
}
