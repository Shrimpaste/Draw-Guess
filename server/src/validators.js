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
  roundId: z.string().min(1).max(32),
});

export const promptSubmitSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
  roundId: z.string().min(1).max(32),
  word: trimmedString(config.maxWordLength),
});

export const guessSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
  roundId: z.string().min(1).max(32),
  guess: trimmedString(config.maxWordLength),
});

export const judgeSchema = z.object({
  roomCode: z.string().trim().length(config.roomCodeLength),
  roundId: z.string().min(1).max(32),
  guessId: z.string().min(1).max(32),
  accepted: z.boolean(),
});

const pointSchema = z.object({
  x: z.number().finite().min(0).max(960),
  y: z.number().finite().min(0).max(620),
}).strict();

const canvasBase = { roundId: z.string().min(1).max(32), epoch: z.number().int().min(0) };
export const realtimeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("canvas:stroke"), ...canvasBase,
    stroke: z.object({
      id: z.string().min(1).max(64), offset: z.number().int().min(0),
      tool: z.enum(["pen", "eraser"]),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      width: z.number().finite().min(1).max(24),
      points: z.array(pointSchema).min(1).max(config.maxStrokePoints),
    }).strict(),
  }).strict(),
  z.object({ type: z.literal("canvas:clear"), ...canvasBase }).strict(),
  z.object({ type: z.literal("canvas:undo"), ...canvasBase }).strict(),
]);
