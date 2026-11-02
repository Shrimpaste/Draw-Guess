import { beforeEach, expect, it, vi } from "vitest";

function fakeAudio() {
  const made = { oscillators: 0, sources: 0 };
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = (extra = {}) => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra });
  class FakeContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.sampleRate = 8000; this.destination = node(); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    createGain() { return node({ gain: param() }); }
    createOscillator() { made.oscillators += 1; return node({ frequency: param(), type: "sine" }); }
    createBiquadFilter() { return node({ frequency: param(), Q: param(), type: "lowpass" }); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { made.sources += 1; return node({ buffer: null, loop: false, playbackRate: param() }); }
  }
  return { FakeContext, made };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.unstubAllGlobals();
});

it("is on by default and remembers the mute choice", async () => {
  const sound = await import("./sound.js");
  expect(sound.soundEnabled()).toBe(true);
  sound.setSoundEnabled(false);
  expect(localStorage.getItem("inkmuse-sound")).toBe("off");
  vi.resetModules();
  expect((await import("./sound.js")).soundEnabled()).toBe(false);
});

it("stays silent when the browser has no Web Audio", async () => {
  const { sfx, pencilScratch, unlockSound } = await import("./sound.js");
  expect(() => {
    unlockSound();
    Object.values(sfx).forEach((play) => play());
    const scratch = pencilScratch();
    scratch.move(2);
    scratch.end();
  }).not.toThrow();
});

it("synthesizes cues only after unlock and while enabled", async () => {
  const { FakeContext, made } = fakeAudio();
  vi.stubGlobal("AudioContext", FakeContext);
  const sound = await import("./sound.js");
  sound.sfx.correct();
  expect(made.oscillators).toBe(0);
  sound.unlockSound();
  sound.sfx.correct();
  expect(made.oscillators).toBeGreaterThan(0);
  const before = made.oscillators + made.sources;
  sound.setSoundEnabled(false);
  sound.sfx.correct();
  sound.sfx.tap();
  expect(made.oscillators + made.sources).toBe(before);
});
