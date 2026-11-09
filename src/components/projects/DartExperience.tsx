"use client";

import { isReducedMotion } from "@/lib/motion";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { mulberry32 } from "@/lib/rng";
import { sfx } from "@/lib/sfx";
import type { DartControl } from "@/components/three/DartScene";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false, loading: () => <DartFallback /> });
const DartScene = dynamic(() => import("@/components/three/DartScene"), { ssr: false });

const ACCENT: [string, string] = ["#38e8ff", "#5df0c0"];

export function DartFallback() {
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 600 240" className="w-[90%] max-w-3xl" fill="none" strokeWidth="1.4">
        {[0, 1].map((s) => (
          <path
            key={s}
            stroke={s ? "#5df0c0" : "#38e8ff"}
            d={`M0 120 ${Array.from({ length: 30 }, (_, i) => `L${i * 21} ${120 + Math.sin(i * 0.55 + s * Math.PI) * 70}`).join(" ")}`}
            strokeDasharray="6 6"
            style={{ animation: "dash-flow 3s linear infinite" }}
          />
        ))}
        {Array.from({ length: 30 }, (_, i) => (
          <path key={i} stroke="#ffffff22" d={`M${i * 21} ${120 + Math.sin(i * 0.55) * 70} V${120 + Math.sin(i * 0.55 + Math.PI) * 70}`} />
        ))}
      </svg>
    </div>
  );
}

/** Illustrative seed → extend → verify strip. The sequences are generated, not real data. */
function ReadAligner({ reduced }: { reduced: boolean }) {
  const { ref, read, hit } = useMemo(() => {
    const r = mulberry32(99);
    const bases = "ACGT";
    const ref = Array.from({ length: 44 }, () => bases[Math.floor(r() * 4)]).join("");
    const hit = 17;
    const readArr = ref.slice(hit, hit + 18).split("");
    readArr[13] = readArr[13] === "A" ? "G" : "A";
    return { ref, read: readArr.join(""), hit };
  }, []);
  const steps = ["SEED", "LOCATE", "EXTEND", "VERIFY"] as const;
  const [step, setStep] = useState(reduced ? 3 : 0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % steps.length), 1500);
    return () => clearInterval(id);
  }, [reduced, steps.length]);

  const seedEnd = 8;
  return (
    <div className="rounded-xl border border-white/10 bg-bg/70 p-4 font-mono text-[0.7rem] leading-none backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="label !text-[0.6rem] !text-cyan">Read mapping · illustrative</span>
        <span className="flex gap-1.5">
          {steps.map((s, i) => (
            <span key={s} className={`rounded px-1.5 py-1 text-[0.55rem] tracking-wider transition-colors ${i === step ? "bg-cyan text-bg" : "bg-white/5 text-mute"}`}>
              {s}
            </span>
          ))}
        </span>
      </div>
      <div className="overflow-hidden whitespace-nowrap" aria-hidden>
        <div className="text-mute tracking-[0.28em]">
          {ref.split("").map((c, i) => {
            const inRead = i >= hit && i < hit + read.length;
            const inSeed = i >= hit && i < hit + seedEnd;
            return (
              <span key={i} className={inSeed && step >= 0 ? "text-cyan" : inRead && step >= 2 ? "text-ink" : ""}>
                {c}
              </span>
            );
          })}
        </div>
        <div className="mt-2 tracking-[0.28em]" style={{ paddingLeft: `${hit * 1.28}ch`, transition: "padding .8s var(--ease-out)", opacity: step >= 1 ? 1 : 0.35 }}>
          {read.split("").map((c, i) => {
            const mismatch = ref[hit + i] !== c;
            return (
              <span key={i} className={i < seedEnd ? "text-cyan" : mismatch && step >= 3 ? "text-signal" : step >= 2 ? "text-ink" : "text-faint"}>
                {c}
              </span>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-[0.62rem] leading-snug text-faint">
        {step === 0 && "Pick a short exact-match seed from the read."}
        {step === 1 && "Look the seed up in an index of the reference."}
        {step === 2 && "Extend the match outward along the reference."}
        {step === 3 && "Verify the full alignment and count mismatches."}
      </p>
    </div>
  );
}

export default function DartExperience() {
  const ctl = useRef<DartControl>({ target: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(0);
  const touched = useRef(false);
  const [reduced, setReduced] = useState(false);

  const apply = (v: number) => {
    setValue(v);
    ctl.current.target = v;
    ctl.current.invalidate?.();
  };

  useEffect(() => {
    setupGsap();
    const r = isReducedMotion();
    setReduced(r);
    if (r) return;
    // First time the stage is on screen: hold on the helix, then transform it.
    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: "top 55%",
      once: true,
      onEnter: () => {
        gsap.delayedCall(1.4, () => {
          if (touched.current) return;
          const o = { v: 0 };
          gsap.to(o, { v: 1, duration: 3.2, ease: "power2.inOut", onUpdate: () => !touched.current && apply(o.v) });
        });
      },
    });
    return () => st.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    touched.current = true;
    sfx.click();
    const to = value > 0.5 ? 0 : 1;
    const o = { v: value };
    gsap.to(o, { v: to, duration: reduced ? 0 : 2.4, ease: "power2.inOut", onUpdate: () => apply(o.v) });
  };

  return (
    <div ref={wrap} className="relative h-[clamp(520px,82vh,820px)] w-full" data-cursor="Drag">
      <div className="absolute inset-0" aria-hidden>
        <SceneCanvas fallback={<DartFallback />} camera={{ position: [0, 0, 15.5], fov: 40 }}>
          <DartScene ctl={ctl} colors={ACCENT} />
        </SceneCanvas>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 bg-gradient-to-t from-bg/90 via-bg/50 to-transparent p-5 pt-24 md:flex-row md:items-end md:justify-between md:p-8">
        <div className="pointer-events-auto w-full max-w-md" style={{ ["--accent" as string]: "#38e8ff" }}>
          <div className="label mb-2 flex items-center justify-between">
            <span className={value < 0.5 ? "text-cyan" : ""}>DNA reads</span>
            <span className={value >= 0.5 ? "text-cyan" : ""}>GPU thread grid</span>
          </div>
          <input
            ref={range}
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={value}
            aria-label="Morph between DNA strands and the GPU thread grid"
            className="tech-range"
            style={{ ["--fill" as string]: `${value * 100}%` }}
            onChange={(e) => {
              touched.current = true;
              apply(Number(e.target.value));
            }}
          />
          <button
            type="button"
            onClick={toggle}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan/50 px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-cyan transition-colors hover:bg-cyan/10"
          >
            {value > 0.5 ? "Back to the helix" : "Map the reads →"}
          </button>
        </div>
        <div className="pointer-events-none hidden w-[22rem] md:block">
          <ReadAligner reduced={reduced} />
        </div>
      </div>

      <div className="label pointer-events-none absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-cyan/40 bg-bg/70 px-3 py-1.5 !text-[0.6rem] !text-cyan backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan" style={{ animation: "pulse-dot 1.6s infinite" }} />
        Ongoing research · concept visual
      </div>
    </div>
  );
}
