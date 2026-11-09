"use client";

import { useEffect, useRef, useState } from "react";
import { useAnimatedCanvas } from "@/lib/useAnimatedCanvas";
import { clamp, lerp, mulberry32 } from "@/lib/rng";
import { sfx } from "@/lib/sfx";
import { fitVars } from "@/lib/type";

/**
 * The Reef accelerator's process, as described on the program's own site
 * (navyreef.netlify.app), drawn as a flow of ideas. Purely illustrative:
 * the particles are not real challenges and no numbers are implied.
 * Plain Canvas 2D, so it runs on every device.
 */

const GOLD = "#ffcf5a";
const ROLE_COLORS = ["#ffcf5a", "#7dff9a", "#3ec7ff", "#ff8fd8"];

const STAGES = [
  {
    id: "intake",
    title: "Challenge intake",
    short: "Challenges",
    text: "Bottom-up initiatives from across the Navy are collected alongside top-down challenges published by senior command. Service members register as participants and commit to taking an active part in solving the challenge they choose.",
  },
  {
    id: "screening",
    title: "Screening & team building",
    short: "Screening",
    text: "Challenges and initiatives are sorted, and the ventures that fit the cycle best are chosen by: impact on the Navy and the IDF; fit for fast, small-scale procurement; how many people it affects; how certain the demand is; and technological feasibility. Teams are formed around them.",
  },
  {
    id: "acceleration",
    title: "Acceleration",
    short: "Acceleration",
    text: "Teams learn to shape a concept with inventive and systematic thinking, work as a team, research the market, interview customers, build a business model and flow charts, design the user experience, plan an MVP, manage risk, run the project with Lean Product Design, write a management plan, build a demo and market it — everything needed to become a “military startupper”.",
  },
  {
    id: "sharks",
    title: "Shark tank",
    short: "Shark tank",
    text: "Each team pitches its venture to the “sharks” — lieutenant colonels to brigadier generals in the receiving unit — and to the Navy's senior command, who decide how the venture continues.",
  },
  {
    id: "mvp",
    title: "MVP & prototype",
    short: "MVP",
    text: "The goal is an MVP (minimal viable product), an in-house prototype demonstrator and, when the venture is mature enough, a move to full project development.",
  },
] as const;

const ROLES = [
  { name: "Champion", note: "owns the idea and the need from the field" },
  { name: "Maker (CTO)", note: "hands-on technical lead" },
  { name: "Team lead (CEO)", note: "experienced officer who drives the process" },
  { name: "Program manager (PMO)", note: "plans resources and integrates the tasks" },
];

interface Idea {
  s: number; // position along the pipeline, 0..4
  lane: number;
  src: number; // -1 top-down, +1 bottom-up
  passScreen: boolean;
  passShark: boolean;
  dead: number; // >0 while fading out
  gone?: boolean;
  speed: number;
  seed: number;
}

export default function ReefExperience() {
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  stageRef.current = stage;
  const userPicked = useRef(false);
  const rng = useRef(mulberry32(4242));
  const ideas = useRef<Idea[]>([]);
  const spawnT = useRef(0);
  const mvps = useRef(0);

  // Walk through the stages until the visitor picks one.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!userPicked.current) setStage((s) => (s + 1) % STAGES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const { ref } = useAnimatedCanvas((c, w, h, t, dt) => {
    if (w < 40 || h < 40) return;
    const r = rng.current;
    const wide = w >= 560;
    const pad = wide ? 64 : 44;
    const node = (i: number) =>
      wide ? { x: pad + (i * (w - pad * 2)) / 4, y: h * 0.5 } : { x: w / 2, y: pad + (i * (h - pad * 2)) / 4 };
    const along = (s: number) => {
      const i = clamp(Math.floor(s), 0, 3);
      const f = clamp(s - i, 0, 1);
      const a = node(i);
      const b = node(i + 1);
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
    };
    const nx = wide ? 0 : 1;
    const ny = wide ? 1 : 0;

    // backdrop: depth gradient, caustic lines, rising bubbles
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(62,199,255,0.07)");
    g.addColorStop(1, "rgba(5,6,10,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(62,199,255,0.06)";
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = h * (0.12 + k * 0.19) + Math.sin(x * 0.012 + t * 0.6 + k) * 8;
        if (x) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
    for (let k = 0; k < 18; k++) {
      const bx = ((k * 97.3) % w) + Math.sin(t * 0.8 + k) * 6;
      const by = h - (((t * (14 + (k % 5) * 6) + k * 53) % (h + 20)) - 10);
      c.fillStyle = "rgba(127,232,255,0.18)";
      c.beginPath();
      c.arc(bx, by, 1.2 + (k % 3), 0, Math.PI * 2);
      c.fill();
    }

    // pipeline
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const p = node(i);
      if (i) c.lineTo(p.x, p.y);
      else c.moveTo(p.x, p.y);
    }
    c.stroke();
    c.lineWidth = 1;

    // spawn ideas from both directions
    spawnT.current -= dt;
    if (spawnT.current <= 0 && ideas.current.length < 70) {
      spawnT.current = 0.12 + r() * 0.18;
      ideas.current.push({
        s: -0.6,
        lane: (r() - 0.5) * 2,
        src: r() < 0.55 ? 1 : -1,
        passScreen: r() < 0.55,
        passShark: r() < 0.6,
        dead: 0,
        speed: 0.42 + r() * 0.16,
        seed: r(),
      });
    }

    const sel = stageRef.current;
    c.globalCompositeOperation = "lighter";
    for (const idea of ideas.current) {
      if (idea.dead > 0) {
        idea.dead -= dt;
        if (idea.dead <= 0) idea.gone = true;
      } else {
        const before = idea.s;
        // teams linger a little in acceleration
        const slow = idea.s > 2 && idea.s < 3 ? 0.55 : 1;
        idea.s += dt * idea.speed * slow;
        if (before < 1 && idea.s >= 1 && !idea.passScreen) idea.dead = 1.2;
        if (before < 3 && idea.s >= 3 && !idea.passShark) idea.dead = 1.2;
        if (idea.s >= 4) {
          idea.dead = 0.9;
          mvps.current++;
          if (sel === 4) sfx.hover();
        }
      }
      // position: spawn from above / below into the first node, then along the pipe
      let x: number;
      let y: number;
      const spread = (wide ? h : w) * 0.16 * Math.exp(-Math.max(0, idea.s) * 0.9);
      if (idea.s < 0) {
        const n0 = node(0);
        const k = -idea.s / 0.6;
        x = n0.x + nx * idea.src * k * (wide ? 0 : w * 0.45) + (wide ? idea.lane * 14 : 0);
        y = n0.y + ny * idea.src * k * (wide ? h * 0.45 : 0) + (wide ? 0 : idea.lane * 14);
      } else {
        const p = along(Math.min(idea.s, 4));
        const wob = Math.sin(t * 2 + idea.seed * 20) * 3;
        x = p.x + nx * (idea.lane * spread + wob);
        y = p.y + ny * (idea.lane * spread + wob);
      }
      const dying = idea.dead > 0;
      const fadeA = dying ? clamp(idea.dead / 1.2) : 1;
      if (dying && idea.s < 3.99) y += (1 - fadeA) * 30;
      const col = dying && idea.s < 3.99 ? "160,170,190" : idea.s >= 3.99 ? "255,207,90" : idea.src > 0 ? "255,207,90" : "62,199,255";
      const rad = idea.s >= 3.99 ? 5 : 3;
      const gr = c.createRadialGradient(x, y, 0, x, y, rad * 3);
      gr.addColorStop(0, `rgba(${col},${0.95 * fadeA})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr;
      c.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
      // the four-role team orbiting each idea during acceleration and the pitch
      if (!dying && idea.s > 1.05 && idea.s < 3.2) {
        for (let k = 0; k < 4; k++) {
          const a = t * 2.2 + idea.seed * 10 + (k * Math.PI) / 2;
          c.fillStyle = ROLE_COLORS[k];
          c.globalAlpha = 0.85;
          c.fillRect(x + Math.cos(a) * 9 - 1.5, y + Math.sin(a) * 9 - 1.5, 3, 3);
        }
        c.globalAlpha = 1;
      }
    }
    c.globalCompositeOperation = "source-over";
    ideas.current = ideas.current.filter((i) => !i.gone);

    // nodes + labels
    c.font = "10px var(--font-geist-mono), ui-monospace, monospace";
    c.textAlign = wide ? "center" : "left";
    for (let i = 0; i < 5; i++) {
      const p = node(i);
      const on = i === sel;
      c.strokeStyle = on ? GOLD : "rgba(255,255,255,0.3)";
      c.lineWidth = on ? 2 : 1;
      c.fillStyle = "#07090f";
      c.beginPath();
      c.arc(p.x, p.y, on ? 15 : 11, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (on) {
        c.strokeStyle = "rgba(255,207,90,0.35)";
        c.beginPath();
        c.arc(p.x, p.y, 22 + Math.sin(t * 3) * 3, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = on ? GOLD : "rgba(233,237,246,0.75)";
      c.fillText(`0${i + 1}`, wide ? p.x : p.x - 6, p.y + 3.5);
      c.fillStyle = on ? "#ffffff" : "rgba(233,237,246,0.55)";
      const label = STAGES[i].short.toUpperCase();
      if (wide) c.fillText(label, p.x, p.y + (i % 2 ? -34 : 40));
      else c.fillText(label, p.x + 26, p.y + 4);
    }
    c.lineWidth = 1;
    c.textAlign = "left";
    c.fillStyle = "rgba(233,237,246,0.4)";
    c.fillText(wide ? "▼ bottom-up initiatives" : "", 12, h - 12);
    if (wide) c.fillText("▲ top-down challenges", 12, 18);
  });

  const st = STAGES[stage];
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <div className="relative min-w-0 h-[clamp(22rem,calc(var(--svh)*58),36rem)] lg:h-[clamp(30rem,calc(var(--svh)*70),42rem)]">
        <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />
        <div className="label pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-[#ffcf5a]/40 bg-bg/80 px-3 py-1.5 !text-[0.58rem] !text-[#ffdf8a] backdrop-blur sm:left-4 sm:top-4">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffcf5a]" style={{ animation: "pulse-dot 1.6s infinite" }} />
          Illustrative process diagram
        </div>
      </div>
      <div className="cq flex min-w-0 flex-col gap-4 border-t border-line p-4 sm:p-6 lg:border-l lg:border-t-0">
        <div role="tablist" aria-label="Program stages" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              type="button"
              aria-selected={stage === i}
              aria-controls="reef-stage"
              onClick={() => {
                userPicked.current = true;
                setStage(i);
                sfx.click();
              }}
              className={`label shrink-0 rounded-full border px-3 py-1.5 !text-[0.58rem] transition-colors ${stage === i ? "border-[#ffcf5a] bg-[#ffcf5a]/10 !text-[#ffdf8a]" : "border-line hover:!text-ink"}`}
            >
              0{i + 1} {s.short}
            </button>
          ))}
        </div>
        <div id="reef-stage" role="tabpanel" aria-live="polite">
          <h4 className="fit-title font-display font-extrabold uppercase leading-tight tracking-tight" style={fitVars(st.title, "clamp(1.1rem, 1rem + 0.45vw, 1.4rem)")}>
            {st.title}
          </h4>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-mute">{st.text}</p>
        </div>
        <div className="mt-auto">
          <p className="label mb-2 !text-[0.58rem]">Every team</p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {ROLES.map((r, i) => (
              <li key={r.name} className="flex items-start gap-2 text-sm leading-snug text-mute">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px]" style={{ background: ROLE_COLORS[i] }} />
                <span>
                  <span className="text-ink">{r.name}</span> — {r.note}
                </span>
              </li>
            ))}
          </ul>
          <p className="label mt-4 !text-[0.56rem] !text-faint">Source: the program site, navyreef.netlify.app</p>
        </div>
      </div>
    </div>
  );
}
