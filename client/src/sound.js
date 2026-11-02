import { useSyncExternalStore } from "react";

// Cues synthesized for this game's own events: paper slips, a wooden check,
// a page turn for a new round and the pencil on paper while drawing. Nothing
// plays before the first user gesture, on hover, or while muted.
const KEY = "inkmuse-sound";
const listeners = new Set();
let enabled = readPreference();
let unlocked = false;
let context = null;
let master = null;
let noise = null;

function readPreference() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function soundEnabled() {
  return enabled;
}
export function setSoundEnabled(value) {
  enabled = !!value;
  try {
    localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // Private mode: keep the choice for this page only.
  }
  if (master && context) master.gain.setTargetAtTime(enabled ? 0.8 : 0, context.currentTime, 0.015);
  listeners.forEach((listener) => listener());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useSoundEnabled() {
  return useSyncExternalStore(subscribe, soundEnabled, soundEnabled);
}

export function unlockSound() {
  unlocked = true;
  audio();
}
function audio() {
  if (!enabled || !unlocked || typeof window === "undefined") return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  if (!context) {
    try {
      context = new Context();
    } catch {
      return null;
    }
    master = context.createGain();
    master.gain.value = 0.8;
    master.connect(context.destination);
  }
  if (context.state === "suspended") context.resume?.().catch(() => {});
  return context;
}
function noiseBuffer(ctx) {
  if (noise) return noise;
  const length = Math.floor(ctx.sampleRate * 1.2);
  noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let seed = 7;
  for (let index = 0; index < length; index += 1) {
    seed = (seed * 16807) % 2147483647;
    data[index] = (seed / 2147483647) * 2 - 1;
  }
  return noise;
}
function envelope(ctx, at, peak, attack, decay) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  gain.connect(master);
  return gain;
}
function hiss(ctx, at, { peak, attack = 0.004, decay, type = "bandpass", from, to = from, q = 1 }) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
  source.connect(filter);
  filter.connect(envelope(ctx, at, peak, attack, decay));
  source.start(at, Math.random() * 0.8);
  source.stop(at + attack + decay + 0.05);
}
// A struck wooden bar: fundamental plus a quickly fading fourth partial.
function wood(ctx, at, frequency, peak, decay = 0.28) {
  [[1, peak, decay], [3.98, peak * 0.32, decay * 0.35]].forEach(([ratio, level, length]) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * ratio, at);
    oscillator.connect(envelope(ctx, at, level, 0.003, length));
    oscillator.start(at);
    oscillator.stop(at + length + 0.05);
  });
}
function cue(play) {
  return () => {
    const ctx = audio();
    if (ctx) play(ctx, ctx.currentTime + 0.01);
  };
}

export const sfx = {
  // A guess slip set down on the notebook.
  tap: cue((ctx, at) => hiss(ctx, at, { peak: 0.09, decay: 0.05, from: 2600, q: 1.4 })),
  // Correct answer: pencil tick, then a rising pair of wooden notes.
  correct: cue((ctx, at) => {
    hiss(ctx, at, { peak: 0.05, decay: 0.08, from: 3200, to: 4600, q: 2 });
    wood(ctx, at + 0.06, 784, 0.2);
    wood(ctx, at + 0.18, 1175, 0.18, 0.4);
  }),
  // New round: a page turned over, landing with a soft knock.
  start: cue((ctx, at) => {
    hiss(ctx, at, { peak: 0.07, attack: 0.09, decay: 0.2, from: 700, to: 3200, q: 0.7 });
    wood(ctx, at + 0.26, 330, 0.12, 0.2);
  }),
  // Last seconds: a small wood block, brighter at the very end.
  tick: cue((ctx, at) => wood(ctx, at, 1320, 0.05, 0.06)),
  urgentTick: cue((ctx, at) => wood(ctx, at, 1660, 0.07, 0.07)),
  timeUp: cue((ctx, at) => {
    wood(ctx, at, 262, 0.16, 0.3);
    wood(ctx, at + 0.16, 196, 0.14, 0.42);
  }),
  // Judge's stamp: a felt thump with a little paper.
  stamp: cue((ctx, at) => {
    wood(ctx, at, 120, 0.2, 0.12);
    hiss(ctx, at, { peak: 0.05, decay: 0.07, type: "lowpass", from: 900 });
  }),
};

// Pencil on paper for the local drawer. Loudness follows pen speed, the eraser is duller.
export function pencilScratch(tool = "pen") {
  const ctx = audio();
  if (!ctx) return { move() {}, end() {} };
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.value = tool === "eraser" ? 900 : 3400;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(ctx.currentTime, Math.random());
  let stopped = false;
  return {
    move(speed) {
      if (stopped) return;
      const level = Math.min(tool === "eraser" ? 0.035 : 0.05, speed * 0.02);
      gain.gain.setTargetAtTime(level, ctx.currentTime, 0.03);
      filter.frequency.setTargetAtTime((tool === "eraser" ? 800 : 2800) + Math.min(1600, speed * 500), ctx.currentTime, 0.05);
    },
    end() {
      if (stopped) return;
      stopped = true;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
      source.stop(ctx.currentTime + 0.25);
    },
  };
}
