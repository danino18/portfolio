"use client";

/**
 * Synthesised interface sounds. Off by default; nothing is created or played
 * until the visitor opts in with the sound toggle (which is also the user
 * gesture the browser needs to start an AudioContext).
 */
let ctx: AudioContext | null = null;
let enabled = false;
const listeners = new Set<() => void>();
const KEY = "ed-sound";

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

let lastHover = 0;

export const sfx = {
  get enabled() {
    return enabled;
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  restore() {
    try {
      enabled = localStorage.getItem(KEY) === "1";
    } catch {
      enabled = false;
    }
    listeners.forEach((l) => l());
  },
  set(on: boolean) {
    enabled = on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
    if (on) {
      ac();
      blip(520, 0.14, "sine", 0.05, 980);
    }
    listeners.forEach((l) => l());
  },
  hover() {
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    blip(1320, 0.05, "triangle", 0.018);
  },
  click() {
    blip(220, 0.12, "square", 0.03, 440);
  },
  success() {
    blip(520, 0.1, "sine", 0.04);
    setTimeout(() => blip(780, 0.16, "sine", 0.04), 90);
  },
  error() {
    blip(160, 0.18, "sawtooth", 0.03, 90);
  },
};
