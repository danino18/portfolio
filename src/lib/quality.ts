"use client";

import { useSyncExternalStore } from "react";

/**
 * Adaptive quality. Tier 0 = no WebGL (CSS/SVG fallback visuals),
 * 1 = low, 2 = medium, 3 = high. The tier is detected once on the client and
 * can only be lowered at runtime by the frame-time monitor.
 */
export type Tier = 0 | 1 | 2 | 3;

export interface QualityState {
  tier: Tier;
  dpr: number;
  reducedMotion: boolean;
  coarse: boolean;
}

let state: QualityState | null = null;
const listeners = new Set<() => void>();

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function detect(): QualityState {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const forced = new URLSearchParams(window.location.search).get("quality");

  let tier: Tier;
  if (!webglAvailable() || forced === "0") tier = 0;
  else if (forced === "1" || forced === "2" || forced === "3") tier = Number(forced) as Tier;
  else if (coarse || cores <= 4 || mem <= 2) tier = 1;
  else if (cores <= 8 || mem <= 4) tier = 2;
  else tier = 3;

  const maxDpr = tier === 3 ? 2 : tier === 2 ? 1.5 : 1.25;
  return { tier, dpr: Math.min(window.devicePixelRatio || 1, maxDpr), reducedMotion, coarse };
}

function ensure(): QualityState {
  if (!state) state = detect();
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

export function downgradeQuality() {
  const s = ensure();
  if (s.tier <= 1) {
    if (s.dpr > 1) {
      state = { ...s, dpr: Math.max(1, s.dpr - 0.25) };
      emit();
    }
    return;
  }
  state = { ...s, tier: (s.tier - 1) as Tier, dpr: Math.max(1, s.dpr - 0.25) };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onChange = () => {
    state = state ? { ...state, reducedMotion: mq.matches } : null;
    ensure();
    emit();
  };
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onChange);
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

/** Scales an instance/particle count by tier. */
export function scaleByTier(base: number, tier: Tier): number {
  const f = tier >= 3 ? 1 : tier === 2 ? 0.6 : tier === 1 ? 0.3 : 0.1;
  return Math.max(16, Math.floor(base * f));
}
