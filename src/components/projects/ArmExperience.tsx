"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ArmControl } from "@/components/three/ArmScene";
import { sfx } from "@/lib/sfx";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false, loading: () => <ArmFallback /> });
const ArmScene = dynamic(() => import("@/components/three/ArmScene"), { ssr: false });

const JOINT_NAMES = ["Base", "Shoulder", "Elbow", "Wrist 1", "Wrist 2", "Wrist 3"];

export function ArmFallback() {
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 400 260" className="w-[88%] max-w-2xl" fill="none" stroke="#aebdd3" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 220 H180" stroke="#1a2230" strokeWidth="14" />
        <path d="M110 220 V190 L200 70 L290 130 V200" />
        <circle cx="110" cy="190" r="12" fill="#ff8a3d" stroke="none" />
        <circle cx="200" cy="70" r="12" fill="#ff8a3d" stroke="none" />
        <circle cx="290" cy="130" r="10" fill="#ff8a3d" stroke="none" />
        <path d="M274 208 h32" strokeWidth="6" />
        <rect x="300" y="196" width="40" height="24" rx="3" fill="#e4d9ff" stroke="none" />
        <rect x="340" y="172" width="40" height="24" rx="3" fill="#38e8ff" stroke="none" opacity=".8" />
      </svg>
    </div>
  );
}

export default function ArmExperience() {
  const ctl = useRef<ArmControl>({
    manual: false,
    grip: false,
    height: 0.4,
    perception: false,
    orbit: { az: 1.2, pol: 1.12 },
    joints: [0, 0, 0, 0, 90, 0],
    phase: "Initializing",
    restart: false,
  });
  const [manual, setManual] = useState(false);
  const [grip, setGrip] = useState(false);
  const [percep, setPercep] = useState(false);
  const [height, setHeight] = useState(0.4);
  const jointEls = useRef<(HTMLSpanElement | null)[]>([]);
  const phaseEl = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // HUD readout at ~8 Hz, written straight to the DOM (no React renders).
  useEffect(() => {
    const id = setInterval(() => {
      const c = ctl.current;
      c.joints.forEach((q, i) => {
        const el = jointEls.current[i];
        if (el) el.textContent = `${q >= 0 ? "+" : "−"}${Math.abs(q).toFixed(1).padStart(5, "0")}°`;
      });
      if (phaseEl.current) phaseEl.current.textContent = c.phase;
    }, 125);
    return () => clearInterval(id);
  }, []);

  const set = <K extends keyof ArmControl>(k: K, v: ArmControl[K]) => {
    ctl.current[k] = v;
    ctl.current.invalidate?.();
  };

  const onDown = (e: React.PointerEvent) => {
    if (manual) return;
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const o = ctl.current.orbit;
    o.az -= (e.clientX - d.x) * 0.006;
    o.pol = Math.min(1.45, Math.max(0.45, o.pol - (e.clientY - d.y) * 0.005));
    drag.current = { x: e.clientX, y: e.clientY };
    ctl.current.invalidate?.();
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div
      className="relative h-[clamp(520px,80vh,800px)] w-full touch-pan-y"
      data-cursor={manual ? "Move" : "Drag"}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="absolute inset-0" aria-hidden>
        <SceneCanvas fallback={<ArmFallback />} camera={{ position: [6, 5, 6], fov: 36, near: 0.1, far: 60 }}>
          <ArmScene ctl={ctl} />
        </SceneCanvas>
      </div>

      <div className="label pointer-events-none absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-signal/40 bg-bg/75 px-3 py-1.5 !text-[0.6rem] !text-signal backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-signal" style={{ animation: "pulse-dot 1.6s infinite" }} />
        Illustrative visualization · not robot data
      </div>

      {/* Telemetry HUD */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 hidden w-52 rounded-xl border border-white/10 bg-bg/70 p-3 font-mono text-[0.62rem] backdrop-blur-md sm:block lg:hidden xl:block">
        <div className="label mb-2 flex items-center justify-between !text-[0.55rem]">
          <span>Joint state · live IK</span>
        </div>
        {JOINT_NAMES.map((n, i) => (
          <div key={n} className="flex items-center justify-between py-[2px] text-mute">
            <span>
              q{i + 1} {n}
            </span>
            <span ref={(el) => { jointEls.current[i] = el; }} className="text-signal">
              +000.0°
            </span>
          </div>
        ))}
        <div className="mt-2 border-t border-white/10 pt-2 text-ink">
          <span className="text-faint">PHASE </span>
          <span ref={phaseEl}>—</span>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-bg/90 to-transparent p-4 pt-20 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={manual}
            onClick={() => {
              const v = !manual;
              setManual(v);
              set("manual", v);
              if (!v) {
                setGrip(false);
                set("grip", false);
              }
              sfx.click();
            }}
            className={`chip transition-colors ${manual ? "!border-signal !bg-signal/15 !text-signal" : "hover:!text-ink"}`}
          >
            {manual ? "Manual control: on" : "Take manual control"}
          </button>
          <button
            type="button"
            aria-pressed={percep}
            onClick={() => {
              setPercep(!percep);
              set("perception", !percep);
              sfx.click();
            }}
            className={`chip transition-colors ${percep ? "!border-cyan !bg-cyan/10 !text-cyan" : "hover:!text-ink"}`}
          >
            Camera view {percep ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => {
              set("restart", true);
              setManual(false);
              set("manual", false);
              setGrip(false);
              set("grip", false);
            }}
            className="chip transition-colors hover:!text-ink"
          >
            Restart demo
          </button>
        </div>
        {manual && (
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-bg/75 px-4 py-3 backdrop-blur-md">
            <label className="label flex items-center gap-3 !text-[0.6rem]">
              Height
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={height}
                aria-label="Tool height"
                onChange={(e) => {
                  setHeight(Number(e.target.value));
                  set("height", Number(e.target.value));
                }}
                className="tech-range w-28"
                style={{ ["--accent" as string]: "#ff8a3d", ["--fill" as string]: `${height * 100}%` }}
              />
            </label>
            <button
              type="button"
              aria-pressed={grip}
              onClick={() => {
                setGrip(!grip);
                set("grip", !grip);
              }}
              className={`chip transition-colors ${grip ? "!border-signal !bg-signal/15 !text-signal" : ""}`}
            >
              Gripper: {grip ? "closed" : "open"}
            </button>
            <span className="label hidden !text-[0.58rem] lg:inline">Move the pointer over the scene</span>
          </div>
        )}
      </div>
    </div>
  );
}
