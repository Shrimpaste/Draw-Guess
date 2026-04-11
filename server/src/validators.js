import { z } from "zod";
import { config } from "./config.js";

const trimmedString = (max) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[\p{L}\p{N}\s_-]+$/u, "contains unsupported characters");

export const sessionSchema = z.object({
  preferredId: trimmedString(18).optional(),
});

export const roomSchema = z.object({
  name: trimmedString(config.maxRoomNameLength),
  mode: z.enum(["host-judged", "library"]),
  packIds: z.array(z.string().min(1)).max(6).default([]),
});

export const joinSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
});

export const wordPackSchema = z.object({
  name: trimmedString(24),
  description: z.string().trim().min(8).max(120),
  words: z.array(trimmedString(config.maxWordLength)).min(4).max(32),
});

export const startRoundSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
});

export const promptSubmitSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
  word: trimmedString(config.maxWordLength),
});

export const guessSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
  guess: trimmedString(config.maxWordLength),
});

export const judgeSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
  guesserId: z.string().trim().min(1).max(32),
  accepted: z.boolean(),
});
