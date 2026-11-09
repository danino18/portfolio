"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimatedCanvas } from "@/lib/useAnimatedCanvas";
import { HISTORY, ROOM, RX, SUBCARRIERS, TX, WifiSim } from "@/lib/wifiSim";
import { clamp } from "@/lib/rng";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false });
const WifiScene = dynamic(() => import("@/components/three/WifiScene"), { ssr: false });

const MAG = "#ff6bd6";
const ICE = "#7fe8ff";
const MONO = "10px var(--font-geist-mono), ui-monospace, monospace";

/** Animated 2D top view: the fallback when WebGL is unavailable (same simulation). */
function TopView({ sim, inset = 0 }: { sim: WifiSim; inset?: number }) {
  const insetRef = useRef(inset);
  insetRef.current = inset;
  const { ref } = useAnimatedCanvas((c, w0, h, t) => {
    const pad = 18;
    const w = w0 - (w0 - insetRef.current > 320 ? insetRef.current : 0);
    const s = Math.min((w - pad * 2) / ROOM.w, (h - pad * 2 - 20) / ROOM.d);
    if (!(s > 1)) return;
    const ox = w / 2;
    const oz = h / 2 + 6;
    const X = (x: number) => ox + x * s;
    const Z = (z: number) => oz + z * s;
    c.strokeStyle = "rgba(255,255,255,0.16)";
    c.strokeRect(X(-ROOM.w / 2), Z(-ROOM.d / 2), ROOM.w * s, ROOM.d * s);
    c.save();
    c.beginPath();
    c.rect(X(-ROOM.w / 2), Z(-ROOM.d / 2), ROOM.w * s, ROOM.d * s);
    c.clip();
    for (let i = 0; i < 3; i++) {
      const R = ((t * 1.7 + i * 3) % 9) * s;
      c.strokeStyle = `rgba(127,232,255,${0.5 * (1 - R / (9 * s))})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(X(TX.x), Z(TX.z), R, 0, Math.PI * 2);
      c.stroke();
      const dPT = Math.hypot(sim.person.x - TX.x, sim.person.z - TX.z) * s;
      if (R > dPT) {
        c.strokeStyle = `rgba(255,107,214,${0.45 * (1 - R / (9 * s))})`;
        c.beginPath();
        c.arc(X(sim.person.x), Z(sim.person.z), R - dPT, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.restore();
    c.lineWidth = 1;
    RX.forEach((rx, i) => {
      c.strokeStyle = `rgba(255,107,214,${0.15 + sim.influence[i] * 0.6})`;
      c.beginPath();
      c.moveTo(X(TX.x), Z(TX.z));
      c.lineTo(X(sim.person.x), Z(sim.person.z));
      c.lineTo(X(rx.x), Z(rx.z));
      c.stroke();
    });
    const nodes: { x: number; z: number; col: string }[] = [{ x: TX.x, z: TX.z, col: ICE }, ...RX.map((r) => ({ x: r.x, z: r.z, col: MAG }))];
    for (const d of nodes) {
      c.fillStyle = d.col;
      c.fillRect(X(d.x) - 5, Z(d.z) - 4, 10, 8);
    }
    // estimate
    c.strokeStyle = ICE;
    c.beginPath();
    c.arc(X(sim.est.x), Z(sim.est.z), sim.estSigma * s, 0, Math.PI * 2);
    c.stroke();
    // person
    c.fillStyle = MAG;
    c.beginPath();
    c.arc(X(sim.person.x), Z(sim.person.z), 6, 0, Math.PI * 2);
    c.fill();
    c.font = MONO;
    c.fillStyle = "rgba(233,237,246,0.55)";
    c.fillText("TOP VIEW · simulated", pad, h - 8);
  });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

/** The sensing pipeline, drawn live: CSI → features → model → estimate. Also drives the simulation. */
function Pipeline({ sim }: { sim: WifiSim }) {
  const track = useMemo<[number, number][]>(() => [], []);
  const { ref } = useAnimatedCanvas((c, w, h, t, dt) => {
    sim.step(dt);
    if (w < 120 || h < 120) return;
    const pad = 14;
    let y = 16;
    const head = (n: string, label: string) => {
      c.font = MONO;
      c.fillStyle = ICE;
      c.fillText(n, pad, y);
      c.fillStyle = "rgba(233,237,246,0.62)";
      c.fillText(label, pad + 18, y);
      y += 8;
    };
    const wide = w > 520;
    const colW = wide ? (w - pad * 3) / 2 : w - pad * 2;

    // ① CSI waterfalls
    head("①", "CSI amplitude · 3 links × 52 subcarriers");
    const wfH = wide ? 44 : 34;
    const lw = (colW - 16) / 3;
    RX.forEach((rx, li) => {
      const x0 = pad + li * (lw + 8);
      const hist = sim.csi[li];
      const cw = lw / HISTORY;
      const ch = wfH / SUBCARRIERS;
      for (let i = 0; i < hist.length; i++) {
        const row = hist[i];
        const x = x0 + lw - (hist.length - i) * cw;
        for (let k = 0; k < SUBCARRIERS; k += 2) {
          const v = row[k];
          c.fillStyle = `hsla(${210 - v * 140}, 90%, ${14 + v * 52}%, 1)`;
          c.fillRect(x, y + k * ch, cw + 0.6, ch * 2 + 0.4);
        }
      }
      c.strokeStyle = `rgba(255,107,214,${0.2 + sim.influence[li] * 0.8})`;
      c.strokeRect(x0 + 0.5, y + 0.5, lw - 1, wfH - 1);
      c.fillStyle = "rgba(233,237,246,0.5)";
      c.fillText(rx.name, x0, y + wfH + 11);
    });
    y += wfH + 26;

    // ② features
    const fx = wide ? pad * 2 + colW : pad;
    let fy = wide ? 16 : y;
    if (!wide) {
      head("②", "Features · motion energy, link disturbance");
      fy = y;
    } else {
      c.font = MONO;
      c.fillStyle = ICE;
      c.fillText("②", fx, fy);
      c.fillStyle = "rgba(233,237,246,0.62)";
      c.fillText("Features", fx + 18, fy);
      fy += 8;
    }
    const bars: [string, number, string][] = [
      ["motion", sim.motion, MAG],
      ...RX.map((r, i) => [`Δ ${r.name.slice(3)}`, sim.influence[i], ICE] as [string, number, string]),
    ];
    bars.forEach(([name, v, col], i) => {
      const by = fy + i * 13;
      c.fillStyle = "rgba(233,237,246,0.5)";
      c.fillText(name, fx, by + 8);
      c.fillStyle = "rgba(255,255,255,0.07)";
      c.fillRect(fx + 52, by, colW - 60, 7);
      c.fillStyle = col;
      c.fillRect(fx + 52, by, (colW - 60) * clamp(v), 7);
    });
    if (!wide) y = fy + bars.length * 13 + 14;
    else y = Math.max(y, fy + bars.length * 13 + 14);

    // ③ model
    head("③", "Model · CSI features → presence, motion, position");
    const L = sim.layers;
    const nnH = wide ? 70 : 58;
    const nnW = wide ? colW : colW * 0.62;
    const pos = L.map((layer, li) => Array.from(layer, (_, i) => [pad + 6 + (li / (L.length - 1)) * (nnW - 12), y + 6 + ((i + 0.5) / layer.length) * (nnH - 12)] as const));
    for (let li = 0; li < L.length - 1; li++)
      for (let i = 0; i < pos[li].length; i++)
        for (let j = 0; j < pos[li + 1].length; j++) {
          const a = L[li][i] * L[li + 1][j];
          c.strokeStyle = `rgba(127,232,255,${0.03 + a * 0.22})`;
          c.beginPath();
          c.moveTo(pos[li][i][0], pos[li][i][1]);
          c.lineTo(pos[li + 1][j][0], pos[li + 1][j][1]);
          c.stroke();
        }
    // signal packets flowing through the net
    for (let k = 0; k < 6; k++) {
      const f = (t * 0.6 + k / 6) % 1;
      const li = Math.min(L.length - 2, Math.floor(f * (L.length - 1)));
      const u = f * (L.length - 1) - li;
      const i = (k * 3) % pos[li].length;
      const j = (k * 5) % pos[li + 1].length;
      c.fillStyle = MAG;
      c.fillRect(pos[li][i][0] + (pos[li + 1][j][0] - pos[li][i][0]) * u - 1.5, pos[li][i][1] + (pos[li + 1][j][1] - pos[li][i][1]) * u - 1.5, 3, 3);
    }
    pos.forEach((layer, li) =>
      layer.forEach(([x, yy], i) => {
        const v = L[li][i];
        c.fillStyle = li === L.length - 1 ? `rgba(255,107,214,${0.3 + v * 0.7})` : `rgba(127,232,255,${0.25 + v * 0.75})`;
        c.beginPath();
        c.arc(x, yy, li === L.length - 1 ? 3.6 : 2.6, 0, Math.PI * 2);
        c.fill();
      }),
    );
    // ④ outputs next to the net
    const ox = wide ? pad : pad + nnW + 14;
    const oy = wide ? y + nnH + 18 : y + 4;
    if (wide) {
      y += nnH + 6;
      head("④", "Estimate (simulated output)");
    }
    const rows: [string, string][] = [
      ["presence", `${Math.round(sim.presence * 100)}%`],
      ["motion", sim.motion > 0.18 ? "walking" : sim.motion > 0.06 ? "moving" : "still"],
      ["x, z", `${sim.est.x.toFixed(1)}, ${sim.est.z.toFixed(1)} m`],
      ["±", `${sim.estSigma.toFixed(2)} m`],
    ];
    c.font = MONO;
    rows.forEach(([k, v], i) => {
      const ry = (wide ? y + 4 : oy) + i * 14;
      c.fillStyle = "rgba(233,237,246,0.45)";
      c.fillText(k, ox, ry + 8);
      c.fillStyle = i === 0 ? MAG : "rgba(233,237,246,0.9)";
      c.fillText(v, ox + 58, ry + 8);
    });
    // mini map: truth vs estimate
    const mw = wide ? colW * 0.5 : w - pad * 2;
    const mh = mw * (ROOM.d / ROOM.w);
    const mx = wide ? pad + colW - mw : pad;
    const my = wide ? y + 2 : y + nnH + 10;
    if (my + mh < h - 4) {
      c.strokeStyle = "rgba(255,255,255,0.14)";
      c.strokeRect(mx, my, mw, mh);
      const MX = (x: number) => mx + (x / ROOM.w + 0.5) * mw;
      const MZ = (z: number) => my + (z / ROOM.d + 0.5) * mh;
      // metre grid, the ESP32 nodes and the person's recent track
      c.strokeStyle = "rgba(255,255,255,0.05)";
      for (let gx = -3; gx <= 3; gx++) {
        c.beginPath();
        c.moveTo(MX(gx), my);
        c.lineTo(MX(gx), my + mh);
        c.stroke();
      }
      for (let gz = -2; gz <= 2; gz++) {
        c.beginPath();
        c.moveTo(mx, MZ(gz));
        c.lineTo(mx + mw, MZ(gz));
        c.stroke();
      }
      c.fillStyle = ICE;
      c.fillRect(MX(TX.x) - 3, MZ(TX.z) - 3, 6, 6);
      c.fillStyle = MAG;
      RX.forEach((r) => c.fillRect(MX(r.x) - 3, MZ(r.z) - 3, 6, 6));
      track.push([sim.est.x, sim.est.z]);
      if (track.length > 90) track.shift();
      c.strokeStyle = "rgba(127,232,255,0.35)";
      c.beginPath();
      track.forEach(([x, z], i) => (i ? c.lineTo(MX(x), MZ(z)) : c.moveTo(MX(x), MZ(z))));
      c.stroke();
      c.strokeStyle = ICE;
      c.beginPath();
      c.arc(MX(sim.est.x), MZ(sim.est.z), Math.max(3, (sim.estSigma / ROOM.w) * mw), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = MAG;
      c.beginPath();
      c.arc(MX(sim.person.x), MZ(sim.person.z), 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(233,237,246,0.4)";
      c.fillText("● simulated person  ○ model estimate", mx, my + mh + 12);
    }
  });
  return <canvas ref={ref} className="h-full w-full" aria-hidden />;
}

export default function WifiSensing() {
  const sim = useMemo(() => new WifiSim(), []);
  const stage = useRef<HTMLDivElement>(null);
  // Width of the HUD overlaying the scene on large screens (the scene re-centres beside it).
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const lg = window.matchMedia("(min-width: 1024px)");
    const xl = window.matchMedia("(min-width: 1280px)");
    const on = () => setInset(xl.matches ? 26 * 16 + 12 : lg.matches ? 23 * 16 + 12 : 0);
    on();
    lg.addEventListener("change", on);
    xl.addEventListener("change", on);
    return () => {
      lg.removeEventListener("change", on);
      xl.removeEventListener("change", on);
    };
  }, []);

  const guide = (e: React.PointerEvent) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    const visW = r.width - (r.width - inset > 320 ? inset : 0);
    const nx2 = ((e.clientX - r.left) / visW) * 1;
    sim.setTarget({ x: (Math.min(1, nx2) - 0.5) * (ROOM.w - 1), z: (ny - 0.45) * (ROOM.d - 0.6) * 1.3 });
    void nx;
  };

  return (
    <div className="relative grid w-full lg:block lg:h-[clamp(36rem,calc(var(--svh)*82),50rem)]">
      {/* 3D room (2D top view when WebGL is unavailable) */}
      <div
        ref={stage}
        className="relative h-[min(calc(var(--svh)*54),26rem)] w-full touch-pan-y lg:absolute lg:inset-0 lg:h-full"
        onPointerMove={(e) => e.pointerType === "mouse" && guide(e)}
        onPointerDown={guide}
        data-cursor="Walk"
        aria-label="Conceptual Wi-Fi sensing visualization: a simulated person walks through a room while Wi-Fi waves from an ESP32 transmitter reach three receivers. Move the pointer or tap to guide the person."
        role="img"
      >
        <SceneCanvas fallback={<TopView sim={sim} inset={inset} />} camera={{ position: [0, 7, 10], fov: 40, near: 0.1, far: 80 }}>
          <WifiScene sim={sim} insetRight={inset} />
        </SceneCanvas>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_40%_50%,transparent,rgba(5,6,10,0.55))]" />
      </div>

      {/* labels */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2 sm:left-4 sm:top-4">
        <span className="label rounded-full border border-[#ff6bd6]/50 bg-bg/80 px-3 py-1.5 !text-[0.58rem] !text-[#ff9be6] backdrop-blur">Future project · conceptual visualization</span>
        <span className="label hidden rounded-full border border-white/15 bg-bg/80 px-3 py-1.5 !text-[0.58rem] backdrop-blur sm:inline-block">Simulated signals — not a validated system</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-col gap-1.5 lg:flex">
        <span className="label flex items-center gap-2 !text-[0.58rem]">
          <span className="h-2 w-2 rounded-sm bg-[#7fe8ff]" /> ESP32 TX · wavefronts
        </span>
        <span className="label flex items-center gap-2 !text-[0.58rem]">
          <span className="h-2 w-2 rounded-sm bg-[#ff6bd6]" /> ESP32 RX × 3 · person (simulated)
        </span>
        <span className="label flex items-center gap-2 !text-[0.58rem]">
          <span className="h-2 w-2 rounded-full border border-[#7fe8ff]" /> model estimate · body-shape ghost = research goal
        </span>
      </div>

      {/* pipeline HUD */}
      <div className="relative z-10 border-t border-line bg-bg/85 backdrop-blur-md lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:w-[23rem] lg:rounded-2xl lg:border lg:border-white/10 xl:w-[26rem]">
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
          <p className="label min-w-0 !text-[0.58rem] !tracking-[0.1em] !text-ink">Wi-Fi → CSI → features → model → estimate</p>
        </div>
        <div className="h-[22rem] w-full sm:h-[17rem] lg:h-[calc(100%-2rem)]">
          <Pipeline sim={sim} />
        </div>
      </div>
    </div>
  );
}
