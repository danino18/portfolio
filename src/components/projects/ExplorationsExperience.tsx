"use client";

import { useRef, useState } from "react";
import { useAnimatedCanvas } from "@/lib/useAnimatedCanvas";
import { mulberry32, clamp, lerp } from "@/lib/rng";
import { sfx } from "@/lib/sfx";

const MAG = "#ff6bd6";
const ICE = "#7fe8ff";

/* -------------------------------------------------------------------------- */
/* 1. Laundry: a verlet cloth the user can grab and fold                      */
/* -------------------------------------------------------------------------- */
interface P {
  x: number;
  y: number;
  px: number;
  py: number;
  pin: boolean;
}

function Cloth() {
  const COLS = 26;
  const ROWS = 17;
  const pts = useRef<P[]>([]);
  const rest = useRef(14);
  const grab = useRef<number | null>(null);
  const mouse = useRef({ x: 0, y: 0, down: false });
  const released = useRef(false);
  const size = useRef({ w: 0, h: 0 });

  const init = (w: number, h: number) => {
    size.current = { w, h };
    const r = clamp(Math.min((w - 80) / COLS, (h * 0.55) / ROWS), 9, 18);
    rest.current = r;
    const x0 = (w - COLS * r) / 2;
    const arr: P[] = [];
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const x = x0 + i * r;
        const y = 56 + j * r;
        arr.push({ x, y, px: x, py: y, pin: j === 0 && (i === 0 || i === COLS - 1 || i === Math.floor(COLS / 2)) });
      }
    pts.current = arr;
    released.current = false;
  };

  const { ref, redraw } = useAnimatedCanvas((c, w, h, t, dt) => {
    const P_ = pts.current;
    if (!P_.length) return;
    const r = rest.current;
    const floor = h - 22;
    const steps = 2;
    for (let s = 0; s < steps; s++) {
      for (const p of P_) {
        if (p.pin) continue;
        const vx = (p.x - p.px) * 0.992;
        const vy = (p.y - p.py) * 0.992;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + 0.32;
        if (p.y > floor) {
          p.y = floor;
          p.x = lerp(p.x, p.px, 0.15);
        }
      }
      if (grab.current !== null) {
        const g = P_[grab.current];
        g.x = mouse.current.x;
        g.y = mouse.current.y;
        g.px = g.x;
        g.py = g.y;
      }
      for (let k = 0; k < 5; k++) {
        for (let j = 0; j < ROWS; j++)
          for (let i = 0; i < COLS; i++) {
            const a = P_[j * COLS + i];
            if (i < COLS - 1) link(a, P_[j * COLS + i + 1], r);
            if (j < ROWS - 1) link(a, P_[(j + 1) * COLS + i], r);
          }
      }
    }
    void dt;

    // table
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.beginPath();
    c.moveTo(0, floor + 4);
    c.lineTo(w, floor + 4);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.025)";
    c.fillRect(0, floor + 4, w, h);

    // cloth cells, shaded by local orientation and stretch
    for (let j = 0; j < ROWS - 1; j++)
      for (let i = 0; i < COLS - 1; i++) {
        const a = P_[j * COLS + i];
        const b = P_[j * COLS + i + 1];
        const d = P_[(j + 1) * COLS + i];
        const e = P_[(j + 1) * COLS + i + 1];
        const area = (b.x - a.x) * (d.y - a.y) - (d.x - a.x) * (b.y - a.y);
        const back = area < 0;
        const sh = clamp(0.45 + Math.abs(area) / (r * r) * 0.35 + ((i + j) % 2) * 0.04, 0.2, 1);
        c.fillStyle = back ? `rgba(127,232,255,${0.28 * sh + 0.12})` : `rgba(255,107,214,${0.34 * sh + 0.12})`;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.lineTo(e.x, e.y);
        c.lineTo(d.x, d.y);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(255,255,255,0.07)";
        c.stroke();
      }

    // robot grippers on pinned corners
    for (const p of P_) {
      if (!p.pin) continue;
      c.fillStyle = "#e9edf6";
      c.fillRect(p.x - 6, p.y - 20, 12, 12);
      c.strokeStyle = MAG;
      c.beginPath();
      c.moveTo(p.x, p.y - 20);
      c.lineTo(p.x, 0);
      c.stroke();
    }
    if (grab.current !== null) {
      const g = P_[grab.current];
      c.strokeStyle = ICE;
      c.beginPath();
      c.arc(g.x, g.y, 12, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "rgba(233,237,246,0.55)";
    c.font = "11px var(--font-geist-mono), monospace";
    c.fillText(released.current ? "Grippers released" : "Held by 3 grippers · drag the cloth", 16, h - 6);
    void t;
  }, init);

  function link(a: P, b: P, len: number) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const diff = (d - len) / d;
    const ax = a.pin ? 0 : b.pin ? 1 : 0.5;
    const bx = b.pin ? 0 : a.pin ? 1 : 0.5;
    if (!a.pin) {
      a.x += dx * diff * ax;
      a.y += dy * diff * ax;
    }
    if (!b.pin) {
      b.x -= dx * diff * bx;
      b.y -= dy * diff * bx;
    }
  }

  const pos = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={ref}
        className="h-full w-full touch-pan-y"
        data-cursor="Grab"
        onPointerDown={(e) => {
          const m = pos(e);
          mouse.current = { ...m, down: true };
          let best = -1;
          let bd = 40 * 40;
          pts.current.forEach((p, i) => {
            const d = (p.x - m.x) ** 2 + (p.y - m.y) ** 2;
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          if (best >= 0) {
            grab.current = best;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            sfx.click();
          }
        }}
        onPointerMove={(e) => {
          mouse.current = { ...pos(e), down: mouse.current.down };
          if (grab.current !== null) redraw();
        }}
        onPointerUp={() => {
          grab.current = null;
          mouse.current.down = false;
        }}
        onPointerCancel={() => (grab.current = null)}
      />
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          className="chip bg-bg/70 backdrop-blur hover:!text-ink"
          onClick={() => {
            pts.current.forEach((p) => (p.pin = false));
            released.current = true;
            sfx.click();
            redraw();
          }}
        >
          Release grippers
        </button>
        <button type="button" className="chip bg-bg/70 backdrop-blur hover:!text-ink" onClick={() => { init(size.current.w, size.current.h); redraw(); }}>
          Reset
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Wi-Fi channel-state sensing: simulated CSI spectrogram                   */
/* -------------------------------------------------------------------------- */
function CsiLab() {
  const SUB = 52;
  const person = useRef({ x: 0.5, y: 0.75, vx: 0, vy: 0, active: false, px: 0.5, py: 0.75 });
  const history = useRef<Float32Array[]>([]);
  const score = useRef(0);
  const rng = useRef(mulberry32(31));

  const { ref, redraw } = useAnimatedCanvas((c, w, h, t, dt) => {
    const room = { x: 14, y: 36, w: Math.min(w * 0.4, 360), h: h - 72 };
    const spec = { x: room.x + room.w + 28, y: 36, w: w - (room.x + room.w + 28) - 14, h: h - 72 };
    const tx = { x: room.x + 18, y: room.y + room.h * 0.35 };
    const rx = { x: room.x + room.w - 18, y: room.y + room.h * 0.35 };
    const p = person.current;

    // person motion (cursor); decays to rest
    const mx = room.x + p.x * room.w;
    const my = room.y + p.y * room.h;
    const speed = Math.hypot(p.vx, p.vy);
    p.vx *= 0.9;
    p.vy *= 0.9;

    // distance of person to the TX-RX line of sight
    const lx = rx.x - tx.x;
    const ly = rx.y - tx.y;
    const tproj = clamp(((mx - tx.x) * lx + (my - tx.y) * ly) / (lx * lx + ly * ly));
    const dx = tx.x + lx * tproj - mx;
    const dy = tx.y + ly * tproj - my;
    const dist = Math.hypot(dx, dy);
    const influence = Math.exp(-(dist * dist) / (2 * 38 * 38));
    const disturbance = influence * clamp(speed * 28, 0, 1);

    // synthesise a CSI amplitude row
    const row = new Float32Array(SUB);
    for (let k = 0; k < SUB; k++) {
      const base = 0.52 + 0.22 * Math.sin(k * 0.34 + 0.6) + 0.12 * Math.sin(k * 0.9);
      const noise = (rng.current() - 0.5) * 0.05;
      const move = disturbance * Math.sin(k * 0.55 + t * 9) * 0.38 * (0.6 + 0.4 * Math.sin(k * 0.21));
      const slow = influence * 0.08 * Math.sin(k * 0.4 - t * 2);
      row[k] = clamp(base + noise + move + slow, 0, 1);
    }
    history.current.push(row);
    const cols = Math.floor(spec.w / 3);
    if (history.current.length > cols) history.current.shift();

    // motion score = variation between consecutive rows
    const prev = history.current[history.current.length - 2];
    if (prev) {
      let d = 0;
      for (let k = 0; k < SUB; k++) d += Math.abs(row[k] - prev[k]);
      score.current = lerp(score.current, d / SUB, 0.2);
    }
    const detected = score.current > 0.035;

    // ---- draw room
    c.font = "10px var(--font-geist-mono), monospace";
    c.fillStyle = "rgba(233,237,246,0.5)";
    c.fillText("ROOM · top view (simulated)", room.x, room.y - 12);
    c.strokeStyle = "rgba(255,255,255,0.16)";
    c.strokeRect(room.x, room.y, room.w, room.h);
    c.strokeStyle = "rgba(127,232,255,0.5)";
    c.setLineDash([4, 5]);
    c.beginPath();
    c.moveTo(tx.x, tx.y);
    c.lineTo(rx.x, rx.y);
    c.stroke();
    c.setLineDash([]);
    // wave rings
    for (let i = 0; i < 3; i++) {
      const rr = ((t * 30 + i * 28) % 84) + 4;
      c.strokeStyle = `rgba(127,232,255,${0.28 * (1 - rr / 88)})`;
      c.beginPath();
      c.arc(tx.x, tx.y, rr, -0.9, 0.9);
      c.stroke();
    }
    for (const [pt, label] of [[tx, "ESP32 TX"], [rx, "ESP32 RX"]] as const) {
      c.fillStyle = ICE;
      c.fillRect(pt.x - 5, pt.y - 5, 10, 10);
      c.fillStyle = "rgba(233,237,246,0.6)";
      c.fillText(label, pt.x - 22, pt.y + 22);
    }
    // person
    c.fillStyle = detected ? MAG : "rgba(233,237,246,0.8)";
    c.beginPath();
    c.arc(mx, my, 7, 0, Math.PI * 2);
    c.fill();
    if (detected) {
      c.strokeStyle = MAG;
      c.beginPath();
      c.arc(mx, my, 14 + Math.sin(t * 10) * 2, 0, Math.PI * 2);
      c.stroke();
    }
    if (!p.active) {
      c.fillStyle = "rgba(233,237,246,0.55)";
      c.fillText("Move your pointer in the room", room.x + 10, room.y + room.h - 10);
    }

    // ---- spectrogram
    c.fillStyle = "rgba(233,237,246,0.5)";
    c.fillText("CSI AMPLITUDE · 52 subcarriers × time (simulated)", spec.x, spec.y - 12);
    const hist = history.current;
    const cw = 3;
    const ch = spec.h / SUB;
    for (let i = 0; i < hist.length; i++) {
      const col = hist[i];
      const x = spec.x + spec.w - (hist.length - i) * cw;
      for (let k = 0; k < SUB; k++) {
        const v = col[k];
        c.fillStyle = `hsla(${200 - v * 120}, 90%, ${18 + v * 50}%, ${0.25 + v * 0.75})`;
        c.fillRect(x, spec.y + k * ch, cw, ch + 0.5);
      }
    }
    c.strokeStyle = "rgba(255,255,255,0.14)";
    c.strokeRect(spec.x, spec.y, spec.w, spec.h);

    // score bar
    const by = spec.y + spec.h + 14;
    c.fillStyle = "rgba(255,255,255,0.08)";
    c.fillRect(spec.x, by, spec.w, 6);
    c.fillStyle = detected ? MAG : ICE;
    c.fillRect(spec.x, by, spec.w * clamp(score.current / 0.12), 6);
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.fillRect(spec.x + spec.w * (0.035 / 0.12), by - 3, 1, 12);
    c.fillStyle = detected ? MAG : "rgba(233,237,246,0.6)";
    c.fillText(detected ? "MOTION DETECTED (toy threshold)" : "no motion", spec.x, by + 22);
    void dt;
  });

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const roomW = Math.min(r.width * 0.4, 360);
    const roomH = r.height - 72;
    const nx = clamp((e.clientX - r.left - 14) / roomW);
    const ny = clamp((e.clientY - r.top - 36) / roomH);
    const p = person.current;
    p.vx += (nx - p.x) * 0.9;
    p.vy += (ny - p.y) * 0.9;
    p.x = nx;
    p.y = ny;
    p.active = true;
    redraw();
  };

  return <canvas ref={ref} className="h-full w-full touch-pan-y" data-cursor="Wave" onPointerMove={move} />;
}

/* -------------------------------------------------------------------------- */
/* 3. Electronic nose: toy fingerprints on an 8-sensor array                   */
/* -------------------------------------------------------------------------- */
const ODORS = [
  { name: "Odor A", fp: [0.9, 0.3, 0.2, 0.6, 0.1, 0.4, 0.2, 0.3] },
  { name: "Odor B", fp: [0.2, 0.8, 0.7, 0.2, 0.5, 0.2, 0.3, 0.6] },
  { name: "Odor C", fp: [0.4, 0.4, 0.9, 0.7, 0.2, 0.8, 0.1, 0.2] },
  { name: "Odor D", fp: [0.1, 0.5, 0.3, 0.3, 0.9, 0.3, 0.8, 0.7] },
];

function ENose() {
  const [sel, setSel] = useState<number | null>(0);
  const selRef = useRef<number | null>(0);
  selRef.current = sel;
  const level = useRef(new Float32Array(8));
  const exposure = useRef(0);
  const rng = useRef(mulberry32(77));

  const { ref } = useAnimatedCanvas((c, w, h, t) => {
    const s = selRef.current;
    exposure.current = lerp(exposure.current, s === null ? 0 : 1, 0.04);
    const target = s === null ? new Array(8).fill(0.04) : ODORS[s].fp;
    for (let i = 0; i < 8; i++) {
      const noise = (rng.current() - 0.5) * 0.06;
      level.current[i] = lerp(level.current[i], target[i] + noise, 0.05 + i * 0.004);
    }
    const lv = level.current;

    // radar
    const cx = Math.min(w * 0.28, 190);
    const cy = h / 2 + 4;
    const R = Math.min(cx - 20, h / 2 - 34);
    c.font = "10px var(--font-geist-mono), monospace";
    c.fillStyle = "rgba(233,237,246,0.5)";
    c.fillText("SENSOR ARRAY RESPONSE (toy model)", 14, 22);
    for (let ring = 1; ring <= 4; ring++) {
      c.strokeStyle = "rgba(255,255,255,0.08)";
      c.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R * (ring / 4);
        const y = cy + Math.sin(a) * R * (ring / 4);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      c.strokeStyle = "rgba(255,255,255,0.08)";
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      c.stroke();
      c.fillStyle = "rgba(233,237,246,0.45)";
      c.fillText(`S${i + 1}`, cx + Math.cos(a) * (R + 14) - 7, cy + Math.sin(a) * (R + 14) + 3);
    }
    c.beginPath();
    for (let i = 0; i <= 8; i++) {
      const k = i % 8;
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      const v = clamp(lv[k]);
      const x = cx + Math.cos(a) * R * v;
      const y = cy + Math.sin(a) * R * v;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.fillStyle = "rgba(255,107,214,0.2)";
    c.fill();
    c.strokeStyle = MAG;
    c.lineWidth = 1.6;
    c.stroke();
    c.lineWidth = 1;

    // sensor traces
    const gx = cx + R + 56;
    const gw = w - gx - 14;
    c.fillStyle = "rgba(233,237,246,0.5)";
    c.fillText("SIMILARITY TO TOY TEMPLATES", gx, 22);
    const dot = (a: number[], b: Float32Array) => a.reduce((s2, v, i) => s2 + v * b[i], 0);
    const norm = (a: ArrayLike<number>) => Math.sqrt(Array.from(a).reduce((s2, v) => s2 + v * v, 0)) || 1;
    const scores = ODORS.map((o) => (s === null ? 0 : clamp(dot(o.fp, lv) / (norm(o.fp) * norm(lv)))));
    const sharp = scores.map((v) => Math.pow(v, 14));
    const sum = sharp.reduce((a, b) => a + b, 0) || 1;
    ODORS.forEach((o, i) => {
      const y = 44 + i * 40;
      const p = (sharp[i] / sum) * (s === null ? 0 : 1);
      c.fillStyle = "rgba(233,237,246,0.7)";
      c.fillText(o.name, gx, y + 11);
      c.fillStyle = "rgba(255,255,255,0.07)";
      c.fillRect(gx + 56, y, gw - 96, 14);
      c.fillStyle = i === s ? MAG : ICE;
      c.fillRect(gx + 56, y, (gw - 96) * p, 14);
      c.fillStyle = "rgba(233,237,246,0.6)";
      c.fillText(`${Math.round(p * 100)}%`, gx + gw - 32, y + 11);
    });
    // drifting baseline trace
    c.strokeStyle = "rgba(127,232,255,0.5)";
    c.beginPath();
    for (let x = 0; x < gw; x += 3) {
      const yy = h - 38 - (lv[(x / 3) % 8 | 0] * 22 + Math.sin(x * 0.06 + t * 3) * 3 * exposure.current);
      x ? c.lineTo(gx + x, yy) : c.moveTo(gx, yy);
    }
    c.stroke();
    c.fillStyle = "rgba(233,237,246,0.4)";
    c.fillText("Made-up fingerprints · not measured data", gx, h - 10);
  });

  return (
    <div className="relative h-full w-full">
      <canvas ref={ref} className="h-full w-full" />
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        {ODORS.map((o, i) => (
          <button key={o.name} type="button" aria-pressed={sel === i} onClick={() => { setSel(i); sfx.click(); }} className={`chip bg-bg/70 backdrop-blur ${sel === i ? "!border-[#ff6bd6] !text-[#ff9be6]" : "hover:!text-ink"}`}>
            {o.name}
          </button>
        ))}
        <button type="button" onClick={() => setSel(null)} className={`chip bg-bg/70 backdrop-blur ${sel === null ? "!border-white/50 !text-ink" : "hover:!text-ink"}`}>
          Clean air
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const TABS = [
  { id: "laundry", label: "Robotic laundry", sub: "Household robotics", Comp: Cloth },
  { id: "csi", label: "Wi-Fi sensing", sub: "ESP32 channel state", Comp: CsiLab },
  { id: "enose", label: "Electronic nose", sub: "Sensor arrays + AI", Comp: ENose },
] as const;

export default function ExplorationsExperience() {
  const [tab, setTab] = useState(0);
  const Active = TABS[tab].Comp;
  return (
    <div className="relative w-full">
      <div role="tablist" aria-label="Explorations" className="flex flex-wrap gap-2 border-b border-line p-3 md:p-4">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === i}
            aria-controls={`panel-${t.id}`}
            type="button"
            onClick={() => {
              setTab(i);
              sfx.click();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setTab((tab + 1) % TABS.length);
              if (e.key === "ArrowLeft") setTab((tab + TABS.length - 1) % TABS.length);
            }}
            className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${tab === i ? "border-[#ff6bd6]/60 bg-[#ff6bd6]/10" : "border-line hover:border-white/30"}`}
          >
            <span className="block font-display text-sm font-bold uppercase tracking-tight">{t.label}</span>
            <span className="label !text-[0.58rem]">{t.sub}</span>
          </button>
        ))}
        <span className="chip ms-auto self-center !border-[#ff6bd6]/50 !text-[#ff9be6]">Exploratory · toy simulation</span>
      </div>
      <div id={`panel-${TABS[tab].id}`} role="tabpanel" aria-labelledby={`tab-${TABS[tab].id}`} className="relative h-[clamp(380px,56vh,520px)] w-full">
        <Active key={TABS[tab].id} />
      </div>
    </div>
  );
}
