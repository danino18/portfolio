"use client";

import { useSyncExternalStore } from "react";
import { isReducedMotion } from "./motion";

/**
 * Progressive rendering quality.
 *
 *   tier 0  no usable WebGL2 → animated CSS/SVG/2D-canvas fallbacks
 *   tier 1  low    → simplified geometry, ~35 % particles, DPR ≤ 1.25
 *   tier 2  medium → the same scenes with ~60 % particles, DPR ≤ 1.5
 *   tier 3  high   → everything, DPR ≤ 2
 *
 * The starting tier comes from what the GPU actually is (WebGL renderer
 * string, texture limits, software rasterizers) rather than from CPU core
 * counts or `deviceMemory` — the old heuristic put most 4-core laptops and
 * every Firefox/Safari visitor (no `deviceMemory`) on "low". It is then
 * corrected at runtime from measured frame times (see `reportFrameStats`),
 * in both directions, with hysteresis. The learned result is cached per GPU
 * for the session so later page views start at the right level.
 */
export type Tier = 0 | 1 | 2 | 3;

export interface QualityState {
  tier: Tier;
  /** Device-pixel ratio used by canvases (already capped). */
  dpr: number;
  reducedMotion: boolean;
  coarse: boolean;
  /** Short GPU description (for diagnostics only). */
  gpu: string;
  /** Why this tier was chosen. */
  reason: string;
  /** User/URL forced the tier: runtime adaptation is disabled. */
  forced: boolean;
}

const CACHE_KEY = "ed-quality-v2";
const MAX_DPR: Record<Tier, number> = { 0: 1, 1: 1.25, 2: 1.5, 3: 2 };

let state: QualityState | null = null;
let baseTier: Tier = 1;
const listeners = new Set<() => void>();

interface Probe {
  webgl2: boolean;
  webgl1: boolean;
  renderer: string;
  maxTex: number;
  caveat: boolean;
}

function probeWebGL(): Probe {
  const out: Probe = { webgl2: false, webgl1: false, renderer: "", maxTex: 0, caveat: false };
  try {
    const c = document.createElement("canvas");
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = c.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) {
      gl = c.getContext("webgl2");
      if (gl) out.caveat = true;
    }
    if (gl) out.webgl2 = true;
    else {
      const c1 = document.createElement("canvas");
      const g1 = c1.getContext("webgl");
      out.webgl1 = !!g1;
      g1?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      out.renderer = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "");
      out.maxTex = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
      // Release the probe context immediately: browsers cap live contexts.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* treated as no WebGL */
  }
  return out;
}

function gpuTier(p: Probe, coarse: boolean, smallScreen: boolean): { tier: Tier; reason: string } {
  const r = p.renderer.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software|mesa offscreen/.test(r) || p.caveat)
    return { tier: 1, reason: "software rasterizer — simplified scenes" };
  if (p.maxTex && p.maxTex < 4096) return { tier: 1, reason: "small GPU limits" };
  if (/apple m\d|apple gpu|apple/.test(r)) return coarse && smallScreen ? { tier: 2, reason: "Apple mobile GPU" } : { tier: 3, reason: "Apple GPU" };
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|radeon\(tm\) rx|arc\(tm\)|intel\(r\) arc|intel arc/.test(r)) return { tier: 3, reason: "discrete-class GPU" };
  if (/adreno.*(7\d\d|6[4-9]\d)|mali-g7\d|mali-g6[1-9]|immortalis|xclipse/.test(r)) return { tier: 2, reason: "high-end mobile GPU" };
  if (/iris|radeon|intel/.test(r)) return { tier: 2, reason: "integrated GPU" };
  if (/adreno|mali|powervr/.test(r)) return { tier: 1, reason: "entry mobile GPU" };
  return { tier: 2, reason: "unknown GPU — medium, adapts at runtime" };
}

function readCache(gpu: string): { tier: Tier; dprScale: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { gpu: string; tier: Tier; dprScale: number };
    return v.gpu === gpu ? { tier: v.tier, dprScale: v.dprScale } : null;
  } catch {
    return null;
  }
}

function writeCache(s: QualityState) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ gpu: s.gpu, tier: s.tier, dprScale: dprScale }));
  } catch {
    /* ignore */
  }
}

let dprScale = 1;

function dprFor(tier: Tier) {
  return Math.max(0.75, Math.min(window.devicePixelRatio || 1, MAX_DPR[tier]) * dprScale);
}

function detect(): QualityState {
  const reducedMotion = isReducedMotion();
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const smallScreen = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) < 600;
  const forcedRaw = new URLSearchParams(window.location.search).get("quality");
  const p = probeWebGL();
  const gpu = p.renderer.replace(/\s+/g, " ").slice(0, 80) || (p.webgl2 ? "WebGL2" : p.webgl1 ? "WebGL1 only" : "none");

  let tier: Tier;
  let reason: string;
  let forced = false;
  if (forcedRaw === "0" || forcedRaw === "1" || forcedRaw === "2" || forcedRaw === "3") {
    tier = Number(forcedRaw) as Tier;
    if (tier > 0 && !p.webgl2) tier = 0;
    reason = "forced by ?quality";
    forced = true;
  } else if (!p.webgl2) {
    tier = 0;
    reason = p.webgl1 ? "WebGL2 unavailable (WebGL1 only) — 2D fallbacks" : "WebGL unavailable — 2D fallbacks";
  } else {
    ({ tier, reason } = gpuTier(p, coarse, smallScreen));
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (mem !== undefined && mem <= 2 && tier > 1) {
      tier = 1;
      reason += "; ≤2 GB device memory";
    }
    const cached = readCache(gpu);
    if (cached) {
      tier = Math.max(1, Math.min(3, cached.tier)) as Tier;
      dprScale = cached.dprScale;
      reason += "; adjusted from measured frame times";
    }
  }
  baseTier = tier;
  const s: QualityState = { tier, dpr: 1, reducedMotion, coarse, gpu, reason, forced };
  s.dpr = tier === 0 ? 1 : dprFor(tier);
  const d = document.documentElement.dataset;
  d.quality = String(tier);
  return s;
}

function ensure(): QualityState {
  if (!state) state = detect();
  return state;
}

function emit() {
  if (state) document.documentElement.dataset.quality = String(state.tier);
  listeners.forEach((l) => l());
}

function commit(next: QualityState) {
  state = next;
  writeCache(next);
  emit();
}

/* ---------------------------------------------------------------------------
 * Runtime adaptation from measured frame times.
 *
 * Every visible canvas reports windows of frame durations. A window is "slow"
 * when the average frame takes clearly longer than the display's own refresh
 * interval (estimated from the fastest frames) — so a laptop that throttles
 * rAF to 30 Hz on battery is NOT mistaken for a slow GPU, which the old guard
 * (fixed 28 ms threshold, global and one-way) did. Resolution drops before
 * geometry does, and quality climbs back when there is headroom again.
 * ------------------------------------------------------------------------- */
let slowStreak = 0;
let fastStreak = 0;
let lastChange = 0;
let upgrades = 0;

export function reportFrameStats(avg: number, vsync: number) {
  const s = ensure();
  if (s.forced || s.tier === 0) return;
  const now = performance.now();
  if (now - lastChange < 2500) return;
  const interval = Math.max(1 / 144, Math.min(vsync, 1 / 24));
  const slow = avg > Math.max(interval * 1.45, 1 / 45);
  const fast = avg < interval * 1.12;
  slowStreak = slow ? slowStreak + 1 : 0;
  fastStreak = fast ? fastStreak + 1 : 0;

  if (slowStreak >= 2) {
    slowStreak = 0;
    lastChange = now;
    if (dprScale > 0.7 && s.dpr > 1) {
      dprScale = Math.max(0.7, dprScale - 0.15);
      commit({ ...s, dpr: dprFor(s.tier), reason: s.reason + " · DPR lowered" });
    } else if (s.tier > 1) {
      const t = (s.tier - 1) as Tier;
      dprScale = 1;
      commit({ ...s, tier: t, dpr: dprFor(t), reason: s.reason + " · tier lowered" });
    }
    return;
  }
  if (fastStreak >= 4 && upgrades < 3) {
    fastStreak = 0;
    lastChange = now;
    if (dprScale < 1) {
      upgrades++;
      dprScale = Math.min(1, dprScale + 0.15);
      commit({ ...s, dpr: dprFor(s.tier) });
    } else if (s.tier < 3 && s.tier < baseTier + 1) {
      upgrades++;
      const t = (s.tier + 1) as Tier;
      commit({ ...s, tier: t, dpr: dprFor(t), reason: s.reason + " · tier raised" });
    }
  }
}

/** Called when a WebGL context is lost: be more conservative from here on. */
export function noteContextLoss() {
  const s = ensure();
  if (s.forced || s.tier <= 1) return;
  const t = (s.tier - 1) as Tier;
  lastChange = performance.now();
  commit({ ...s, tier: t, dpr: dprFor(t), reason: s.reason + " · context lost" });
}

let globalAttached = false;
function attachGlobal() {
  if (globalAttached) return;
  globalAttached = true;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener?.("change", () => {
    if (state) state = { ...state, reducedMotion: isReducedMotion() };
    emit();
  });
  // Moving the window to a monitor with another pixel ratio (or zooming).
  let lastRatio = window.devicePixelRatio;
  window.addEventListener("resize", () => {
    if (window.devicePixelRatio === lastRatio) return;
    lastRatio = window.devicePixelRatio;
    if (state && state.tier > 0) {
      state = { ...state, dpr: dprFor(state.tier) };
      emit();
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  attachGlobal();
  return () => {
    listeners.delete(cb);
  };
}

/** Returns null until the client has measured the device (avoids hydration mismatch). */
export function useQuality(): QualityState | null {
  return useSyncExternalStore(
    subscribe,
    () => ensure(),
    () => null,
  );
}

export function getQuality(): QualityState {
  return ensure();
}

/** Scales an instance/particle count by tier. */
export function scaleByTier(base: number, tier: Tier): number {
  const f = tier >= 3 ? 1 : tier === 2 ? 0.6 : tier === 1 ? 0.35 : 0.1;
  return Math.max(16, Math.floor(base * f));
}

/** Ambient time scale: reduced motion keeps scenes alive, just slower and calmer. */
export function timeScale(q: QualityState | null): number {
  return q?.reducedMotion ? 0.35 : 1;
}
