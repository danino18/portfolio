"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { useAnimatedCanvas } from "@/lib/useAnimatedCanvas";
import { clamp, lerp, mulberry32, smooth } from "@/lib/rng";
import { scrollState } from "@/lib/scrollState";
import { isReducedMotion } from "@/lib/motion";

/**
 * Canvas-2D versions of the two signature scenes (the GPU chip in the hero
 * and the DNA → thread-grid morph). They run on the CPU canvas every
 * browser has, so machines without usable WebGL — hardware acceleration
 * off, a blocklisted GPU driver (Chrome no longer falls back to software
 * WebGL), WebGL1-only browsers, strict anti-fingerprinting, or a scene
 * error — still get the real animation instead of a static picture.
 * The point budget adapts to measured frame time.
 */

type RGB = [number, number, number];
const CYAN: RGB = [56, 232, 255];
const VIOLET: RGB = [139, 92, 255];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Soft round glow sprites, pre-rendered once per colour. */
function makeSprites(colors: RGB[]) {
  return colors.map(([r, g, b]) => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const x = c.getContext("2d")!;
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, `rgba(255,255,255,1)`);
    gr.addColorStop(0.18, `rgba(${r},${g},${b},0.95)`);
    gr.addColorStop(0.5, `rgba(${r},${g},${b},0.28)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 32, 32);
    return c;
  });
}

/** Frame-time based budget: draw every `stride`-th point when the CPU struggles. */
function useBudget() {
  return useRef({ avg: 1 / 60, stride: 1, n: 0 });
}
function updateBudget(b: { avg: number; stride: number; n: number }, dt: number) {
  if (dt <= 0 || dt > 0.25) return;
  b.avg = lerp(b.avg, dt, 0.05);
  if (++b.n % 60 !== 0) return;
  if (b.avg > 1 / 32 && b.stride < 4) b.stride++;
  else if (b.avg < 1 / 55 && b.stride > 1) b.stride--;
}

/* ===================================================================== */
/* Hero: GPU die assembling from particles                                */
/* ===================================================================== */
const GRID = 8;
const TILE = 0.62;
const GAP = 0.1;
const PITCH = TILE + GAP;
const HALF = (GRID * PITCH - GAP) / 2;

function buildChip() {
  const rng = mulberry32(1337);
  const pts: { x: number; y: number; z: number; sx: number; sy: number; sz: number; d: number; s: number; tone: number; seed: number }[] = [];
  const scatter = () => {
    const r = 9 + rng() * 14;
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(2 * rng() - 1);
    return [r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph) - 2];
  };
  const add = (x: number, y: number, z: number, s: number, tone: number, d: number) => {
    const [sx, sy, sz] = scatter();
    pts.push({ x, y, z, sx, sy, sz, d, s, tone, seed: rng() });
  };
  const n = 4;
  const tiles: { cx: number; cy: number; on: number; tone: number }[] = [];
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      const cx = (i - (GRID - 1) / 2) * PITCH;
      const cy = (j - (GRID - 1) / 2) * PITCH;
      const tone = rng() < 0.22 ? 0.85 : 0.1 + rng() * 0.3;
      tiles.push({ cx, cy, on: rng(), tone });
      const dist = Math.hypot(i - 3.5, j - 3.5) / 5;
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++)
          add(cx + (a / (n - 1) - 0.5) * TILE * 0.8, cy + (b / (n - 1) - 0.5) * TILE * 0.8, 0.02, 1 + rng(), tone, clamp(dist * 0.7 + rng() * 0.3));
    }
  const traces: { pts: [number, number][]; lens: number[]; total: number; tone: number; seed: number; delay: number }[] = [];
  const per = 18;
  for (let side = 0; side < 4; side++) {
    const ang = (side * Math.PI) / 2;
    const ox = Math.cos(ang);
    const oy = Math.sin(ang);
    const lx = -oy;
    const ly = ox;
    for (let k = 0; k < per; k++) {
      const u = ((k + 0.5) / per - 0.5) * (HALF * 2 - 0.4);
      const l1 = 0.5 + rng() * 1.1;
      const jog = (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.9);
      const l2 = 0.7 + rng() * 1.6;
      const p0: [number, number] = [ox * (HALF + 0.02) + lx * u, oy * (HALF + 0.02) + ly * u];
      const p1: [number, number] = [p0[0] + ox * l1, p0[1] + oy * l1];
      const p2: [number, number] = [p1[0] + ox * Math.abs(jog) + lx * jog, p1[1] + oy * Math.abs(jog) + ly * jog];
      const p3: [number, number] = [p2[0] + ox * l2, p2[1] + oy * l2];
      const P = [p0, p1, p2, p3];
      const lens = [0];
      for (let q = 1; q < 4; q++) lens.push(lens[q - 1] + Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]));
      const tone = rng() < 0.3 ? 0.9 : 0.05 + rng() * 0.25;
      const t = { pts: P, lens, total: lens[3], tone, seed: rng(), delay: rng() };
      traces.push(t);
      for (let d = 0.15; d < t.total; d += 0.3) {
        let q = 1;
        while (q < 3 && lens[q] < d) q++;
        const f = (d - lens[q - 1]) / (lens[q] - lens[q - 1]);
        add(lerp(P[q - 1][0], P[q][0], f), lerp(P[q - 1][1], P[q][1], f), 0.01, 0.8 + rng() * 0.5, tone, clamp(0.25 + (d / t.total) * 0.5 + t.delay * 0.2));
      }
      add(p3[0], p3[1], 0.015, 2.4, tone, clamp(0.75 + rng() * 0.25));
    }
  }
  for (let i = 0; i < 420; i++) add((rng() - 0.5) * 22, (rng() - 0.5) * 16, 0.4 + rng() * 5, 0.8 + rng() * 1.4, rng() < 0.5 ? 0.05 : 0.9, rng());
  return { pts, traces, tiles };
}

export function HeroCanvas2D() {
  const chip = useMemo(() => (typeof document === "undefined" ? null : buildChip()), []);
  const sprites = useRef<HTMLCanvasElement[] | null>(null);
  const budget = useBudget();
  const local = useRef({ px: 0, py: 0, time: 0, reduced: false, init: false });

  const { ref } = useAnimatedCanvas(
    (c, w, h, t, dt) => {
      if (!chip || w < 10 || h < 10) return;
      const L = local.current;
      if (!L.init) {
        L.init = true;
        L.reduced = isReducedMotion();
      }
      if (!sprites.current) sprites.current = makeSprites([0, 0.33, 0.66, 1].map((k) => mix(CYAN, VIOLET, k)));
      updateBudget(budget.current, dt);
      L.time += dt * (L.reduced ? 0.35 : 1);
      const time = L.time;
      const intro = scrollState.intro;
      const hs = scrollState.hero;
      const fade = 1 - smooth(0.55, 1, hs);
      if (fade <= 0.01) return;

      // pointer (auto-drift on touch / reduced motion, as in the WebGL scene)
      const coarse = matchMediaCoarse();
      const tx = coarse || L.reduced ? Math.sin(time * 0.35) * 0.55 : scrollState.pointer.tx;
      const ty = coarse || L.reduced ? Math.cos(time * 0.27) * 0.35 : scrollState.pointer.ty;
      L.px = lerp(L.px, tx, 1 - Math.exp(-dt * 4));
      L.py = lerp(L.py, ty, 1 - Math.exp(-dt * 4));

      const aspect = w / h;
      const portrait = aspect < 0.9;
      const fit = portrait ? clamp(aspect * 1.18, 0.5, 1) : clamp(aspect / 1.7, 0.7, 1.05);
      const sh = smooth(0, 1, hs);
      const m = L.reduced ? 0.4 : 1;
      const rx = lerp(-0.95, -0.08, sh) + L.py * 0.07 * m;
      const rz = L.px * -0.1 * m + hs * 0.5;
      const ry = L.px * 0.08 * m;
      const scale = fit * lerp(1, 1.55, sh);
      const offY = lerp(portrait ? 1.2 : 0.2, 0, hs);
      const camZ = lerp(portrait ? 15 : 12, portrait ? 11 : 8.5, sh);
      const camX = L.px * 0.35;
      const f = h / 2 / Math.tan((19 * Math.PI) / 180);
      const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      const out = { x: 0, y: 0, k: 0 };
      const project = (x: number, y: number, z: number) => {
        // Euler XYZ (three.js): Rz, then Ry, then Rx
        let x1 = x * cz - y * sz;
        let y1 = x * sz + y * cz;
        let z1 = z;
        const x2 = x1 * cy + z1 * sy;
        z1 = -x1 * sy + z1 * cy;
        x1 = x2;
        const y2 = y1 * cx - z1 * sx;
        z1 = y1 * sx + z1 * cx;
        y1 = y2;
        const X = x1 * scale - camX;
        const Y = y1 * scale + offY;
        const Z = camZ - z1 * scale;
        const k = Z > 0.1 ? f / Z : 0;
        out.x = w / 2 + X * k;
        out.y = h / 2 - Y * k;
        out.k = k;
        return out;
      };

      c.globalCompositeOperation = "lighter";
      const reveal = smooth(0, 0.5, intro);

      // die tiles
      if (reveal > 0) {
        for (const tl of chip.tiles) {
          const act = Math.sin(time * 0.7 * (0.6 + tl.on) + tl.on * 40) > 0.82 ? 1 : 0;
          const col = mix(CYAN, VIOLET, tl.tone > 0.5 ? 1 : 0);
          c.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.035 + act * 0.1) * reveal * fade})`;
          c.beginPath();
          const hw = TILE / 2;
          [
            [-hw, -hw],
            [hw, -hw],
            [hw, hw],
            [-hw, hw],
          ].forEach(([dx, dy], i) => {
            const p = project(tl.cx + dx, tl.cy + dy, 0);
            if (i) c.lineTo(p.x, p.y);
            else c.moveTo(p.x, p.y);
          });
          c.closePath();
          c.fill();
        }
        // rim
        c.strokeStyle = `rgba(56,232,255,${0.55 * reveal * fade})`;
        c.lineWidth = 1.5;
        c.beginPath();
        [
          [-HALF, -HALF],
          [HALF, -HALF],
          [HALF, HALF],
          [-HALF, HALF],
        ].forEach(([x, y], i) => {
          const p = project(x, y, 0);
          if (i) c.lineTo(p.x, p.y);
          else c.moveTo(p.x, p.y);
        });
        c.closePath();
        c.stroke();
      }

      // traces + travelling pulses
      const spr = sprites.current;
      c.lineWidth = 1;
      for (const tr of chip.traces) {
        const rv = clamp((intro * 1.7 - tr.delay * 0.55) * 2);
        if (rv <= 0) continue;
        const col = mix(CYAN, VIOLET, tr.tone);
        c.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${0.22 * rv * fade})`;
        c.beginPath();
        tr.pts.forEach(([x, y], i) => {
          const p = project(x, y, 0.01);
          if (i) c.lineTo(p.x, p.y);
          else c.moveTo(p.x, p.y);
        });
        c.stroke();
        const head = (((tr.seed * 7 - time * (0.22 + tr.seed * 0.3)) % 1) + 1) % 1;
        const d = (1 - head) * tr.total;
        let q = 1;
        while (q < 3 && tr.lens[q] < d) q++;
        const ff = (d - tr.lens[q - 1]) / Math.max(1e-4, tr.lens[q] - tr.lens[q - 1]);
        const p = project(lerp(tr.pts[q - 1][0], tr.pts[q][0], ff), lerp(tr.pts[q - 1][1], tr.pts[q][1], ff), 0.01);
        const s = Math.max(4, 0.16 * p.k * scale);
        c.globalAlpha = rv * fade;
        c.drawImage(spr[tr.tone > 0.5 ? 3 : 0], p.x - s / 2, p.y - s / 2, s, s);
        c.globalAlpha = 1;
      }

      // particles (assembling from a swirl during the intro)
      const stride = budget.current.stride;
      const plx = L.px * 6;
      const ply = L.py * 4;
      for (let i = 0; i < chip.pts.length; i += stride) {
        const pt = chip.pts[i];
        const tt = clamp((intro - pt.d * 0.62) / 0.38);
        const e = 1 - Math.pow(1 - tt, 3);
        let x = lerp(pt.sx, pt.x, e);
        let y = lerp(pt.sy, pt.y, e);
        const z = lerp(pt.sz, pt.z, e) + Math.sin(time * 1.1 + pt.seed * 6.28 + pt.x * 0.7) * 0.035 * e;
        const sw = (1 - e) * 2.2;
        const cs = Math.cos(sw), sn = Math.sin(sw);
        const xx = x * cs - y * sn;
        y = x * sn + y * cs;
        x = xx;
        const dd = Math.hypot(x - plx, y - ply);
        const glow = Math.exp(-dd * dd * 0.42);
        const p = project(x, y, z + glow * 0.85);
        if (p.k === 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) continue;
        const tw = 0.65 + 0.35 * Math.sin(time * 2 + pt.seed * 40);
        const s = Math.max(1.5, pt.s * 0.055 * p.k * scale * (0.75 + 0.25 * tw) * (1 + glow * 1.4)) * stride ** 0.35;
        c.globalAlpha = Math.min(1, (0.35 + 0.65 * e) * (0.55 + 0.45 * tw) * fade);
        c.drawImage(spr[Math.min(3, Math.round(pt.tone * 3))], p.x - s / 2, p.y - s / 2, s, s);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
      void t;
    },
    undefined,
    { maxDpr: 1.5 },
  );

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" data-canvas2d="hero" />;
}

let coarseMq: MediaQueryList | null = null;
function matchMediaCoarse() {
  if (!coarseMq) coarseMq = window.matchMedia("(pointer: coarse)");
  return coarseMq.matches;
}

/* ===================================================================== */
/* DART: double helix of reads ↔ CUDA thread grid                          */
/* ===================================================================== */
export interface MorphControl {
  target: number;
}

function buildDart() {
  const blocks = 30;
  const cols = 6;
  const TPB = 48;
  const N = blocks * TPB;
  const rng = mulberry32(20240);
  const L = 15;
  const R = 1.55;
  const turns = 3.2;
  const strand = (t: number, which: number): [number, number, number] => {
    const a = t * turns * Math.PI * 2 + which * Math.PI;
    return [(t - 0.5) * L, Math.cos(a) * R, Math.sin(a) * R];
  };
  const rows = Math.ceil(blocks / cols);
  const pitch = 1.42;
  const tp = 0.16;
  const per = N / 3;
  const P: { h: [number, number, number]; g: [number, number, number]; d: number; tone: number; seed: number; s: number; block: number }[] = [];
  for (let i = 0; i < N; i++) {
    const cat = i % 3;
    const k = (i - cat) / 3;
    const t = k / per;
    let p: [number, number, number];
    let tone: number;
    let s: number;
    if (cat < 2) {
      p = strand(t, cat);
      tone = cat === 0 ? 0 : 0.33;
      s = 1.5 + rng() * 0.7;
    } else {
      const tq = Math.floor(t * 90) / 90;
      const a = strand(tq, 0);
      const b = strand(tq, 1);
      const u = rng();
      p = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
      tone = Math.floor(tq * 90) % 4 < 2 ? 0.66 : 1;
      s = 1 + rng() * 0.6;
    }
    const bi = Math.floor(i / TPB);
    const th = i % TPB;
    const bx = bi % cols;
    const by = Math.floor(bi / cols);
    const gx = (bx - (cols - 1) / 2) * pitch * 1.9 + ((th % 8) - 3.5) * tp;
    const gy = -((by - (rows - 1) / 2) * pitch + (Math.floor(th / 8) - 2.5) * tp);
    P.push({ h: p, g: [gx, gy, 0], d: clamp(t * 0.8 + rng() * 0.2), tone, seed: rng(), s, block: bi });
  }
  return { P };
}

export function DartCanvas2D({ ctl, colors }: { ctl: MutableRefObject<MorphControl>; colors: [string, string] }) {
  const data = useMemo(() => (typeof document === "undefined" ? null : buildDart()), []);
  const sprites = useRef<HTMLCanvasElement[] | null>(null);
  const budget = useBudget();
  const local = useRef({ m: 0, time: 0, reduced: false, init: false, px: 0, py: 0 });

  const { ref } = useAnimatedCanvas(
    (c, w, h, _t, dt) => {
      if (!data || w < 10 || h < 10) return;
      const L = local.current;
      if (!L.init) {
        L.init = true;
        L.reduced = isReducedMotion();
      }
      const palette = [hex(colors[0]), hex(colors[1]), hex("#8b5cff"), hex("#e9edf6")];
      if (!sprites.current) sprites.current = makeSprites(palette);
      updateBudget(budget.current, dt);
      L.time += dt * (L.reduced ? 0.35 : 1);
      const time = L.time;
      const target = ctl.current.target;
      L.m = L.reduced ? target : lerp(L.m, target, 1 - Math.exp(-dt * 2.2));
      const m = L.m;
      L.px = lerp(L.px, scrollState.pointer.tx, 1 - Math.exp(-dt * 4));
      L.py = lerp(L.py, scrollState.pointer.ty, 1 - Math.exp(-dt * 4));

      const aspect = w / h;
      const fit = clamp(aspect / 1.6, 0.42, 1.1) * lerp(1, 0.96, m);
      const f = h / 2 / Math.tan((20 * Math.PI) / 180);
      const camZ = 15.5;
      const ang = time * 0.32;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const spr = sprites.current;
      const stride = budget.current.stride;
      const bandX = lerp(-8.5, 8.5, (time * 0.11) % 1);
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < data.P.length; i += stride) {
        const p = data.P[i];
        const e = smooth(p.d * 0.55, p.d * 0.55 + 0.45, m);
        // helix rotates around its long axis and breathes
        let hy = p.h[1] * ca - p.h[2] * sa;
        let hz = p.h[1] * sa + p.h[2] * ca;
        const br = 1 + 0.05 * Math.sin(time * 1.3 + p.h[0] * 0.8);
        hy *= br;
        hz *= br;
        const arc = Math.sin(e * Math.PI) * 3.4;
        const x = lerp(p.h[0], p.g[0], e);
        const y = lerp(hy, p.g[1], e) + Math.sin(p.seed * 6.28) * arc;
        const z = lerp(hz, p.g[2], e) + Math.cos(p.seed * 6.28) * arc;
        const Z = camZ - z * fit;
        const k = f / Z;
        const sxp = w / 2 + x * fit * k;
        const syp = h / 2 - y * fit * k;
        const band = Math.exp(-Math.pow((p.g[0] - bandX) * 0.55, 2)) * e;
        const act = Math.sin(time * 1.6 * (0.5 + p.seed) + p.block * 7.13) > 0.93 ? e : 0;
        const s = Math.max(1.5, p.s * 0.06 * k * fit * (1 + act * 1.6 + band * 0.9) * lerp(1, 0.85, e)) * stride ** 0.35;
        const tone = p.tone < 0.2 ? 0 : p.tone < 0.5 ? 1 : p.tone < 0.8 ? 2 : 3;
        c.globalAlpha = Math.min(1, lerp(0.8, 0.55 + act * 0.45 + band * 0.4, e));
        c.drawImage(spr[e > 0.6 ? (tone === 2 ? 0 : tone === 3 ? 1 : tone) : tone], sxp - s / 2, syp - s / 2, s, s);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
    undefined,
    { maxDpr: 1.5 },
  );
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" data-canvas2d="dart" />;
}
