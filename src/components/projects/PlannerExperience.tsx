"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { sfx } from "@/lib/sfx";

/** Made-up sample courses. They illustrate the rule model, not a real Technion curriculum. */
interface Course {
  id: string;
  name: string;
  cr: number;
  g: number;
  pre: string[];
  track?: boolean;
}

const COURSES: Course[] = [
  { id: "calc1", name: "Calculus I", cr: 5.5, g: 88, pre: [] },
  { id: "lin", name: "Linear Algebra", cr: 5, g: 91, pre: [] },
  { id: "prog", name: "Intro Programming", cr: 4, g: 95, pre: [] },
  { id: "logic", name: "Discrete Math", cr: 4, g: 86, pre: [] },
  { id: "calc2", name: "Calculus II", cr: 5.5, g: 84, pre: ["calc1"] },
  { id: "ds", name: "Data Structures", cr: 4.5, g: 90, pre: ["prog", "logic"] },
  { id: "dd", name: "Digital Design", cr: 4, g: 93, pre: ["logic"], track: true },
  { id: "prob", name: "Probability", cr: 3.5, g: 82, pre: ["calc1"] },
  { id: "arch", name: "Comp. Architecture", cr: 4, g: 89, pre: ["dd", "prog"], track: true },
  { id: "alg", name: "Algorithms", cr: 4, g: 87, pre: ["ds", "prob"] },
  { id: "os", name: "Operating Systems", cr: 4, g: 92, pre: ["arch", "ds"], track: true },
  { id: "par", name: "Parallel Systems", cr: 3.5, g: 90, pre: ["os", "alg"], track: true },
];
const IDX = Object.fromEntries(COURSES.map((c, i) => [c.id, i]));
const SEMS = 5;
const TRAY = -1;

const PLANS = [
  { name: "Plan A", sem: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 4] },
  { name: "Plan B · compressed draft", sem: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3] },
];

const depth = (() => {
  const d: Record<string, number> = {};
  const f = (c: Course): number => (d[c.id] ??= c.pre.length ? 1 + Math.max(...c.pre.map((p) => f(COURSES[IDX[p]]))) : 0);
  COURSES.forEach(f);
  return d;
})();

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Layout {
  boxes: Record<string, Box>;
  zones: Box[];
  H: number;
}

function computeLayout(view: "graph" | "plan", sem: number[], W: number): Layout {
  const mobile = W < 640;
  const boxes: Record<string, Box> = {};
  const zones: Box[] = [];

  if (view === "plan") {
    const hdr = mobile ? 26 : 34;
    const ch = mobile ? 34 : 42;
    const gap = mobile ? 6 : 8;
    const pad = 8;
    const cols = W < 640 ? 2 : W < 900 ? 3 : 5;
    const colW = (W - pad * 2 - (cols - 1) * 10) / cols;
    const zoneH = hdr + 5 * (ch + gap) + 6;
    for (let s = 0; s < SEMS; s++) {
      const cx = pad + (s % cols) * (colW + 10);
      const cy = pad + Math.floor(s / cols) * (zoneH + 10);
      zones.push({ x: cx, y: cy, w: colW, h: zoneH });
      let k = 0;
      COURSES.forEach((c, i) => {
        if (sem[i] !== s) return;
        boxes[c.id] = { x: cx + 6, y: cy + hdr + k * (ch + gap), w: colW - 12, h: ch };
        k++;
      });
    }
    const rows = Math.ceil(SEMS / cols);
    const trayY = pad + rows * (zoneH + 10);
    const trayH = mobile ? 96 : 76;
    zones.push({ x: pad, y: trayY, w: W - pad * 2, h: trayH });
    const cw = mobile ? 118 : 140;
    let k = 0;
    COURSES.forEach((c, i) => {
      if (sem[i] !== TRAY) return;
      const per = Math.max(1, Math.floor((W - pad * 2 - 12) / (cw + 8)));
      boxes[c.id] = { x: pad + 8 + (k % per) * (cw + 8), y: trayY + 30 + Math.floor(k / per) * (ch - 4), w: cw, h: ch - 8 };
      k++;
    });
    return { boxes, zones, H: trayY + trayH + pad };
  }

  // Dependency graph: layers by prerequisite depth.
  const layers = 5;
  const groups: string[][] = Array.from({ length: layers }, () => []);
  COURSES.forEach((c) => groups[depth[c.id]].push(c.id));
  const nw = mobile ? 108 : 132;
  const nh = mobile ? 36 : 36;
  if (!mobile) {
    const H = 460;
    const lw = (W - nw - 24) / (layers - 1);
    groups.forEach((g, li) => {
      const total = g.length;
      g.forEach((id, k) => {
        boxes[id] = { x: 12 + li * lw, y: (H - 24) * ((k + 0.5) / total) - nh / 2 + 12, w: nw, h: nh };
      });
    });
    for (let s = 0; s <= SEMS; s++) zones.push({ x: W / 2, y: H / 2, w: 0, h: 0 });
    return { boxes, zones, H };
  }
  const H = 620;
  const lh = (H - nh - 24) / (layers - 1);
  groups.forEach((g, li) => {
    const total = g.length;
    g.forEach((id, k) => {
      boxes[id] = { x: (W - nw) * ((k + 0.5) / total) - 0 + (nw * 0) , y: 12 + li * lh, w: nw, h: nh };
      boxes[id].x = Math.max(6, Math.min(W - nw - 6, (W / total) * (k + 0.5) - nw / 2));
    });
  });
  for (let s = 0; s <= SEMS; s++) zones.push({ x: W / 2, y: H / 2, w: 0, h: 0 });
  return { boxes, zones, H };
}

const zoneAt = (zones: Box[], x: number, y: number) => {
  let best = TRAY;
  let bd = Infinity;
  zones.forEach((z, i) => {
    const cx = Math.max(z.x, Math.min(x, z.x + z.w));
    const cy = Math.max(z.y, Math.min(y, z.y + z.h));
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bd) {
      bd = d;
      best = i === SEMS ? TRAY : i;
    }
  });
  return best;
};

export default function PlannerExperience() {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(900);
  const [view, setView] = useState<"graph" | "plan">("graph");
  const [planIdx, setPlanIdx] = useState(0);
  const [plans, setPlans] = useState(() => PLANS.map((p) => [...p.sem]));
  const [focus, setFocus] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [shared, setShared] = useState<string | null>(null);

  const sem = plans[planIdx];
  const layout = useMemo(() => computeLayout(view, sem, W), [view, sem, W]);

  const pos = useRef<Record<string, Box & { o: number }>>({});
  const els = useRef<Record<string, HTMLElement | null>>({});
  const edgeEls = useRef<Record<string, SVGPathElement | null>>({});
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const viewRef = useRef(view);
  viewRef.current = view;
  const reduced = useRef(false);

  // Violations: prerequisite not scheduled in a strictly earlier semester.
  const { bad, badEdges } = useMemo(() => {
    const bad = new Set<string>();
    const badEdges = new Set<string>();
    COURSES.forEach((c, i) => {
      if (sem[i] === TRAY) return;
      c.pre.forEach((p) => {
        const ps = sem[IDX[p]];
        if (ps === TRAY || ps >= sem[i]) {
          bad.add(c.id);
          badEdges.add(`${p}>${c.id}`);
        }
      });
    });
    return { bad, badEdges };
  }, [sem]);

  const stats = useMemo(() => {
    let cr = 0;
    let w = 0;
    let tr = 0;
    let trTotal = 0;
    COURSES.forEach((c, i) => {
      if (c.track) trTotal += 1;
      if (sem[i] === TRAY) return;
      cr += c.cr;
      w += c.cr * c.g;
      if (c.track) tr += 1;
    });
    return { cr, avg: cr ? w / cr : 0, tr, trTotal };
  }, [sem]);

  const related = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    const up = (id: string) => COURSES[IDX[id]].pre.forEach((p) => !set.has(p) && (set.add(p), up(p)));
    const down = (id: string) => COURSES.forEach((c) => c.pre.includes(id) && !set.has(c.id) && (set.add(c.id), down(c.id)));
    up(focus);
    down(focus);
    return set;
  }, [focus]);

  const edges = useMemo(() => COURSES.flatMap((c) => c.pre.map((p) => ({ from: p, to: c.id, key: `${p}>${c.id}` }))), []);

  const draw = useCallback(() => {
    const vertical = viewRef.current === "graph" && wrap.current ? wrap.current.clientWidth < 640 : false;
    for (const c of COURSES) {
      const p = pos.current[c.id];
      const el = els.current[c.id];
      if (!p || !el) continue;
      el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
      el.style.width = `${p.w}px`;
      el.style.height = `${p.h}px`;
    }
    for (const e of edges) {
      const a = pos.current[e.from];
      const b = pos.current[e.to];
      const path = edgeEls.current[e.key];
      if (!a || !b || !path) continue;
      let d: string;
      if (vertical) {
        const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
        const m = Math.max(24, Math.abs(y2 - y1) / 2);
        d = `M${x1} ${y1} C${x1} ${y1 + m} ${x2} ${y2 - m} ${x2} ${y2}`;
      } else {
        const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
        const m = Math.max(30, Math.abs(x2 - x1) / 2);
        d = `M${x1} ${y1} C${x1 + m} ${y1} ${x2 - m} ${y2} ${x2} ${y2}`;
      }
      path.setAttribute("d", d);
    }
  }, [edges]);

  // Morph all chips to the current layout.
  useLayoutEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const first = Object.keys(pos.current).length === 0;
    COURSES.forEach((c, i) => {
      const t = layout.boxes[c.id];
      if (!t) return;
      if (!pos.current[c.id]) pos.current[c.id] = { ...t, x: W / 2 - t.w / 2, y: layout.H / 2, o: 0 };
      if (drag.current?.id === c.id) return;
      const dur = reduced.current ? 0 : first ? 1.1 : 0.85;
      gsap.to(pos.current[c.id], { ...t, o: 1, duration: dur, ease: "expo.inOut", delay: reduced.current ? 0 : view === "plan" ? i * 0.03 : (depth[c.id] || 0) * 0.06, overwrite: "auto" });
    });
    if (reduced.current) draw();
  }, [layout, view, W, draw]);

  // Render loop only while on screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let on = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) {
        on = true;
        gsap.ticker.add(draw);
      } else if (!e.isIntersecting && on) {
        on = false;
        gsap.ticker.remove(draw);
      }
    });
    io.observe(el);
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(300, el.clientWidth));
    return () => {
      io.disconnect();
      ro.disconnect();
      gsap.ticker.remove(draw);
    };
  }, [draw]);

  const move = useCallback(
    (id: string, to: number) => {
      const i = IDX[id];
      if (sem[i] === to) return;
      const next = plans.map((p) => [...p]);
      next[planIdx][i] = to;
      setPlans(next);
      const c = COURSES[i];
      const violating = to !== TRAY && c.pre.some((p) => next[planIdx][IDX[p]] === TRAY || next[planIdx][IDX[p]] >= to);
      setStatus(`${c.name} moved to ${to === TRAY ? "the unplaced tray" : `semester ${to + 1}`}${violating ? ". Prerequisite conflict." : "."}`);
      violating ? sfx.error() : sfx.click();
    },
    [plans, planIdx, sem],
  );

  const onDown = (e: React.PointerEvent, id: string) => {
    if (view !== "plan" || e.button !== 0) return;
    const box = wrap.current!.getBoundingClientRect();
    const p = pos.current[id];
    drag.current = { id, dx: e.clientX - box.left - p.x, dy: e.clientY - box.top - p.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gsap.killTweensOf(p);
    els.current[id]!.style.zIndex = "30";
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const box = wrap.current!.getBoundingClientRect();
    const p = pos.current[d.id];
    p.x = e.clientX - box.left - d.dx;
    p.y = e.clientY - box.top - d.dy;
    d.moved = true;
    const z = zoneAt(layoutRef.current.zones, p.x + p.w / 2, p.y + p.h / 2);
    setHoverZone((h) => (h === (z === TRAY ? SEMS : z) ? h : z === TRAY ? SEMS : z));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setHoverZone(null);
    els.current[d.id]!.style.zIndex = "";
    const p = pos.current[d.id];
    const z = zoneAt(layoutRef.current.zones, p.x + p.w / 2, p.y + p.h / 2);
    const t = layoutRef.current.boxes[d.id];
    if (z === sem[IDX[d.id]] || !d.moved) {
      gsap.to(p, { ...t, duration: 0.5, ease: "expo.out" });
    } else {
      move(d.id, z);
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const onKey = (e: React.KeyboardEvent, id: string) => {
    if (view !== "plan") return;
    const cur = sem[IDX[id]];
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(id, cur === TRAY ? 0 : Math.min(SEMS - 1, cur + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(id, cur <= 0 ? TRAY : cur - 1);
    }
  };

  const share = async () => {
    const code = sem.map((s) => (s + 1).toString(36)).join("");
    const url = `${location.origin}${location.pathname}#plan=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setShared("Link copied");
    } catch {
      setShared(`#plan=${code}`);
    }
    sfx.success();
    setTimeout(() => setShared(null), 2600);
  };

  const issues = bad.size;

  return (
    <div className="relative w-full p-3 sm:p-5">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Visualization" className="inline-flex rounded-full border border-line p-1">
          {(["graph", "plan"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              type="button"
              onClick={() => {
                setView(v);
                sfx.click();
              }}
              className={`rounded-full px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] transition-colors ${view === v ? "bg-[var(--accent)] text-bg" : "text-mute hover:text-ink"}`}
            >
              {v === "graph" ? "Dependency graph" : "Semester plan"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PLANS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={planIdx === i}
              onClick={() => setPlanIdx(i)}
              className={`chip transition-colors ${planIdx === i ? "!border-[var(--accent)] !text-[var(--accent)]" : "hover:!text-ink"}`}
            >
              {p.name}
            </button>
          ))}
          <button type="button" onClick={share} className="chip transition-colors hover:!border-white/40 hover:!text-ink">
            {shared ?? "Share plan ↗"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrap}
        className="relative w-full select-none overflow-hidden rounded-xl border border-white/[0.06] bg-[#06080d]"
        style={{ height: layout.H, transition: "height .6s var(--ease-out)", touchAction: view === "plan" ? "pan-y" : "auto" }}
        onPointerMove={onMove}
      >
        <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-40" />

        {/* Semester zones */}
        {layout.zones.map((z, i) => {
          const label = i === SEMS ? "Unplaced" : `Semester ${i + 1}`;
          const credits = i === SEMS ? 0 : COURSES.reduce((a, c, k) => a + (sem[k] === i ? c.cr : 0), 0);
          return (
            <div
              key={i}
              aria-hidden
              className={`pointer-events-none absolute rounded-lg border transition-[opacity,background-color,border-color] duration-500 ${
                view === "plan" ? "opacity-100" : "opacity-0"
              } ${hoverZone === i ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/[0.07] bg-white/[0.02]"}`}
              style={{ left: z.x, top: z.y, width: z.w, height: z.h }}
            >
              <div className="label flex items-center justify-between px-3 pt-2 !text-[0.58rem]">
                <span>{label}</span>
                {i !== SEMS && <span className="text-faint">{credits.toFixed(1)} cr</span>}
              </div>
            </div>
          );
        })}

        {/* Edges */}
        <svg ref={svg} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {edges.map((e) => {
            const isBad = badEdges.has(e.key);
            const hot = related ? related.has(e.from) && related.has(e.to) : false;
            const dim = related && !hot;
            return (
              <path
                key={e.key}
                ref={(n) => {
                  edgeEls.current[e.key] = n;
                }}
                fill="none"
                stroke={isBad ? "#ff5d73" : hot ? "#ffffff" : "var(--accent)"}
                strokeWidth={hot || isBad ? 1.8 : 1.1}
                strokeOpacity={dim ? 0.06 : isBad ? 0.95 : hot ? 0.95 : view === "graph" ? 0.5 : 0.22}
                strokeDasharray={isBad ? "5 4" : undefined}
                style={{ transition: "stroke-opacity .3s, stroke .3s" }}
              />
            );
          })}
        </svg>

        {/* Courses */}
        {COURSES.map((c, i) => {
          const isBad = bad.has(c.id);
          const dim = related && !related.has(c.id);
          const small = view === "graph";
          return (
            <button
              key={c.id}
              ref={(n) => {
                els.current[c.id] = n;
              }}
              type="button"
              data-cursor={view === "plan" ? "Drag" : undefined}
              onPointerDown={(e) => onDown(e, c.id)}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={(e) => onKey(e, c.id)}
              onPointerEnter={() => setFocus(c.id)}
              onPointerLeave={() => setFocus(null)}
              onFocus={() => setFocus(c.id)}
              onBlur={() => setFocus(null)}
              aria-label={`${c.name}, ${c.cr} credits${c.pre.length ? `, requires ${c.pre.map((p) => COURSES[IDX[p]].name).join(" and ")}` : ""}${isBad ? ", prerequisite conflict" : ""}${view === "plan" ? ". Use left and right arrow keys to change semester." : ""}`}
              className={`absolute left-0 top-0 flex items-center justify-between gap-2 overflow-hidden rounded-lg border px-2.5 text-left will-change-transform ${
                isBad ? "border-[#ff5d73] bg-[#ff5d73]/10 text-[#ffd1d8]" : "border-[var(--accent)]/45 bg-[#12101f]/90 hover:border-[var(--accent)]"
              } ${view === "plan" ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{ opacity: dim ? 0.25 : 1, transition: "opacity .3s, border-color .3s, background-color .3s", touchAction: view === "plan" ? "none" : "auto" }}
            >
              <span className={`font-medium leading-tight ${small ? "line-clamp-2 text-[0.62rem] md:text-xs" : "truncate text-[0.72rem] md:text-[0.82rem]"}`}>{c.name}</span>
              {!small && <span className="label shrink-0 !text-[0.55rem] text-[var(--accent)]">{c.cr}</span>}
            </button>
          );
        })}

      </div>

      {/* Stats */}
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/[0.07] px-4 py-3">
          <p className="label !text-[0.58rem]">Validation</p>
          <p className={`mt-1 font-display text-lg font-bold ${issues ? "text-[#ff8a9a]" : "text-[var(--accent)]"}`}>{issues ? `${issues} conflict${issues > 1 ? "s" : ""}` : "Plan is valid"}</p>
        </div>
        <div className="rounded-lg border border-white/[0.07] px-4 py-3">
          <p className="label !text-[0.58rem]">Credits (sample)</p>
          <p className="mt-1 font-display text-lg font-bold">{stats.cr.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.07] px-4 py-3">
          <p className="label !text-[0.58rem]">Weighted avg (sample)</p>
          <p className="mt-1 font-display text-lg font-bold">{stats.avg.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.07] px-4 py-3">
          <p className="label !text-[0.58rem]">Systems track</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${(stats.tr / stats.trTotal) * 100}%` }} />
          </div>
          <p className="label mt-1.5 !text-[0.58rem]">
            {stats.tr}/{stats.trTotal} courses placed
          </p>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
