"use client";

import { isReducedMotion } from "@/lib/motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap, setupGsap } from "@/lib/gsap";
import { scrollState } from "@/lib/scrollState";
import { projects } from "@/content/projects";
import { groupColor, groupLabel, skillEdges, skillNodes, type SkillNode } from "@/content/skills";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import { TransitionLink } from "@/components/shell/PageTransition";
import { ArrowIcon } from "@/components/ui/Icons";
import { fitVars } from "@/lib/type";

type Orientation = "d" | "m";

const FIELD: Record<Orientation, { w: number; h: number; font: number; pr: number; nr: number }> = {
  d: { w: 100, h: 68, font: 1.75, pr: 1.7, nr: 1.05 },
  m: { w: 60, h: 108, font: 1.75, pr: 1.8, nr: 1.1 },
};

const projPos = (o: Orientation, i: number, n: number): [number, number] =>
  o === "d" ? [10 + (i * 80) / Math.max(1, n - 1), 63] : [6 + (i * 48) / Math.max(1, n - 1), 98];

function Constellation({ orientation, active, setActive }: { orientation: Orientation; active: string | null; setActive: (id: string | null) => void }) {
  const f = FIELD[orientation];
  const svg = useRef<SVGSVGElement>(null);
  const nodeEls = useRef<Record<string, SVGGElement | null>>({});
  const lineEls = useRef<Record<string, SVGLineElement | null>>({});
  const root = useRef<SVGGElement>(null);

  const nodes = useMemo(
    () =>
      [
        ...skillNodes.map((n) => ({ id: n.id, kind: "skill" as const, label: n.label, pos: (orientation === "d" ? n.d : n.m) as [number, number], color: groupColor[n.group], node: n })),
        ...projects.map((p, i) => ({ id: p.slug, kind: "project" as const, label: p.titleLines.join(" "), pos: projPos(orientation, i, projects.length), color: p.accent.a, node: null })),
      ],
    [orientation],
  );

  const edges = useMemo(() => {
    const e: { a: string; b: string; kind: "skill" | "project"; color: string }[] = skillEdges.map(([a, b]) => ({ a, b, kind: "skill", color: "#8d96ab" }));
    skillNodes.forEach((s) => s.projects.forEach((p) => e.push({ a: s.id, b: p, kind: "project", color: projects.find((x) => x.slug === p)!.accent.a })));
    return e;
  }, []);

  // Connected set for the active node.
  const connected = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    edges.forEach((e) => {
      if (e.a === active) set.add(e.b);
      if (e.b === active) set.add(e.a);
    });
    // for a skill, also light its projects' siblings lightly? keep strict: direct neighbours only
    return set;
  }, [active, edges]);

  // Gentle drift + pointer parallax, only while visible.
  useEffect(() => {
    setupGsap();
    const el = svg.current;
    if (!el) return;
    const reduced = isReducedMotion();
    const phase = nodes.map((_, i) => ({ a: i * 1.7, b: i * 2.3, s: 0.35 + (i % 5) * 0.08 }));
    const cur: Record<string, [number, number]> = {};
    const apply = (t: number) => {
      nodes.forEach((n, i) => {
        const ph = phase[i];
        const amp = n.kind === "project" ? 0.25 : 0.7;
        const x = n.pos[0] + (reduced ? 0 : Math.sin(t * ph.s + ph.a) * amp);
        const y = n.pos[1] + (reduced ? 0 : Math.cos(t * ph.s * 0.9 + ph.b) * amp);
        cur[n.id] = [x, y];
        nodeEls.current[n.id]?.setAttribute("transform", `translate(${x.toFixed(3)} ${y.toFixed(3)})`);
      });
      edges.forEach((e, i) => {
        const l = lineEls.current[`${e.a}>${e.b}>${i}`];
        if (!l) return;
        const a = cur[e.a];
        const b = cur[e.b];
        l.setAttribute("x1", a[0].toFixed(3));
        l.setAttribute("y1", a[1].toFixed(3));
        l.setAttribute("x2", b[0].toFixed(3));
        l.setAttribute("y2", b[1].toFixed(3));
      });
      if (root.current && !reduced) {
        const px = scrollState.pointer.x * -0.8;
        const py = scrollState.pointer.y * 0.6;
        root.current.setAttribute("transform", `translate(${px.toFixed(3)} ${py.toFixed(3)})`);
      }
    };
    apply(0);
    if (reduced) return;
    let on = false;
    const tick = (time: number) => apply(time);
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !on) {
        on = true;
        gsap.ticker.add(tick);
      } else if (!en.isIntersecting && on) {
        on = false;
        gsap.ticker.remove(tick);
      }
    });
    io.observe(el);

    // entrance: nodes pop in, edges fade
    const ctx = gsap.context(() => {
      gsap.from(el.querySelectorAll("[data-node-inner]"), { scale: 0, transformOrigin: "50% 50%", opacity: 0, duration: 0.9, ease: "back.out(2)", stagger: 0.045, scrollTrigger: { trigger: el, start: "top 75%", once: true } });
      gsap.from(el.querySelectorAll("[data-edge]"), { opacity: 0, duration: 1.2, stagger: 0.03, scrollTrigger: { trigger: el, start: "top 75%", once: true } });
    }, el);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
      ctx.revert();
    };
  }, [nodes, edges]);

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${f.w} ${f.h}`}
      className="h-auto w-full"
      onClick={() => setActive(null)}
      role="group"
      aria-label="Technical universe: topics connected to the projects they appear in"
    >
      <g ref={root}>
        {edges.map((e, i) => {
          const hot = connected ? connected.has(e.a) && connected.has(e.b) && (e.a === active || e.b === active) : false;
          const dim = connected && !hot;
          return (
            <line
              key={`${e.a}>${e.b}>${i}`}
              data-edge
              ref={(n) => {
                lineEls.current[`${e.a}>${e.b}>${i}`] = n;
              }}
              stroke={e.kind === "project" ? e.color : "#8d96ab"}
              strokeWidth={hot ? 0.28 : 0.1}
              strokeOpacity={dim ? 0.04 : hot ? 0.95 : e.kind === "project" ? 0.2 : 0.28}
              strokeDasharray={e.kind === "project" ? "0.6 0.6" : undefined}
              style={{ transition: "stroke-opacity .35s, stroke-width .35s" }}
            />
          );
        })}
        {nodes.map((n) => {
          const isActive = active === n.id;
          const dim = connected && !connected.has(n.id);
          const r = n.kind === "project" ? f.pr : f.nr;
          const labelRight = orientation === "d" ? n.pos[0] < 78 : n.pos[0] < 31;
          const below = orientation === "d" || n.kind === "project";
          return (
            <g
              key={n.id}
              ref={(el) => {
                nodeEls.current[n.id] = el;
              }}
              role="button"
              tabIndex={0}
              aria-label={n.kind === "skill" ? `${n.label}. Appears in ${n.node!.projects.length} project${n.node!.projects.length > 1 ? "s" : ""}.` : `Project: ${n.label}`}
              aria-pressed={isActive}
              data-cursor={n.kind === "project" ? "Project" : "Explore"}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(n.id)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive(null)}
              onClick={(e) => {
                e.stopPropagation();
                setActive(n.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive(n.id);
                }
              }}
              style={{ cursor: "pointer", outline: "none", opacity: dim ? 0.22 : 1, transition: "opacity .35s" }}
            >
              <g data-node-inner>
                <circle r={r * 3.2} fill="transparent" />
                {n.kind === "skill" ? (
                  <>
                    <circle r={r * (isActive ? 2.6 : 1.9)} fill={n.color} opacity={isActive ? 0.2 : 0.08} style={{ transition: "all .35s" }} />
                    <circle r={r} fill="#05060a" stroke={n.color} strokeWidth={0.22} />
                    <circle r={r * 0.4} fill={n.color} />
                  </>
                ) : (
                  <>
                    <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} fill="#05060a" stroke={n.color} strokeWidth={0.26} transform="rotate(45)" />
                    <circle r={r * 0.35} fill={n.color} />
                    {isActive && <circle r={r * 2.2} fill="none" stroke={n.color} strokeWidth={0.12} opacity={0.6} />}
                  </>
                )}
                <text
                  x={below ? 0 : labelRight ? r + 1.1 : -(r + 1.1)}
                  y={below ? r + f.font * 1.35 : f.font * 0.35}
                  textAnchor={below ? "middle" : labelRight ? "start" : "end"}
                  fontSize={orientation === "m" && n.kind === "project" ? f.font * 0.8 : f.font}
                  fill={isActive ? "#ffffff" : n.kind === "project" ? n.color : "#c9d0e0"}
                  fontFamily="var(--font-geist-mono), monospace"
                  style={{ letterSpacing: "0.05em", textTransform: "uppercase", pointerEvents: "none", transition: "fill .3s" }}
                >
                  {n.kind === "project" && orientation === "m" ? n.label.split(" ")[0] : n.label}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function Detail({ active }: { active: string | null }) {
  const skill = skillNodes.find((s) => s.id === active) as SkillNode | undefined;
  const project = projects.find((p) => p.slug === active);

  if (!active) {
    return (
      <div className="text-mute">
        <p className="label mb-3 !text-cyan">Topic graph</p>
        <p className="text-lg leading-snug text-ink">Hover, tap or tab through the nodes.</p>
        <p className="mt-3 text-sm leading-relaxed">
          Round nodes are topics, diamonds are projects. A line means the topic shows up in that project. It is a map of what I work with, not a rating of how well.
        </p>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(groupColor) as (keyof typeof groupColor)[]).map((g) => (
            <li key={g} className="label flex items-center gap-2 !text-[0.6rem]">
              <span className="h-2 w-2 rounded-full" style={{ background: groupColor[g] }} />
              {groupLabel[g]}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (skill) {
    return (
      <div aria-live="polite">
        <p className="label mb-3" style={{ color: groupColor[skill.group] }}>
          {groupLabel[skill.group]}
        </p>
        <h3 className="fit-title font-display font-extrabold uppercase leading-[0.95] tracking-tight" style={fitVars(skill.label, "clamp(1.75rem, 1.3rem + 1.4vw, 2.25rem)")}>
          {skill.label}
        </h3>
        <p className="mt-4 text-mute">{skill.blurb}</p>
        <p className="label mt-6 !text-[0.6rem]">Appears in</p>
        <ul className="mt-3 flex flex-col gap-2">
          {skill.projects.map((slug) => {
            const p = projects.find((x) => x.slug === slug)!;
            return (
              <li key={slug}>
                <TransitionLink href={`/projects/${slug}`} label={p.title} className="group flex items-center justify-between gap-3 rounded-lg border border-line px-4 py-2.5 transition-colors hover:border-white/30">
                  <span className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 rotate-45" style={{ background: p.accent.a }} />
                    {p.title}
                  </span>
                  <ArrowIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </TransitionLink>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (project) {
    const linked = skillNodes.filter((s) => s.projects.includes(project.slug));
    return (
      <div aria-live="polite">
        <p className="label mb-3" style={{ color: project.accent.a }}>
          {project.statusLabel}
        </p>
        <h3 className="fit-title font-display font-extrabold uppercase leading-[0.95] tracking-tight" style={fitVars(project.title, "clamp(1.75rem, 1.3rem + 1.4vw, 2.25rem)")}>
          {project.title}
        </h3>
        <p className="mt-4 text-mute">{project.tagline}</p>
        <p className="label mt-6 !text-[0.6rem]">Topics involved</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {linked.map((s) => (
            <li key={s.id} className="chip !text-[0.62rem]" style={{ borderColor: `${groupColor[s.group]}66` }}>
              {s.label}
            </li>
          ))}
        </ul>
        <TransitionLink href={`/projects/${project.slug}`} label={project.title} className="label mt-6 inline-flex items-center gap-2 !text-ink hover:!text-cyan">
          Open case study <ArrowIcon className="h-3.5 w-3.5" />
        </TransitionLink>
      </div>
    );
  }
  return null;
}

export default function Universe() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <section id="universe" aria-labelledby="universe-title" className="relative border-t border-line">
      <div className="mx-auto max-w-[1800px] px-[var(--gutter)] py-24 md:py-36 xl:py-44">
        <Reveal className="label mb-8 flex items-center gap-4">
          <span className="text-cyan">04</span>
          <span className="h-px w-12 bg-line" />
          Memory · Technical universe
        </Reveal>
        <h2 id="universe-title" className="section-title metal-text">
          <SplitText text="How it all connects." />
        </h2>

        <div className="mt-12 grid gap-8 md:mt-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-[radial-gradient(70%_70%_at_50%_40%,rgba(139,92,255,0.09),transparent_70%)] p-2 md:p-6">
            <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_70%_at_50%_45%,#000,transparent)]" />
            <div className="relative hidden md:block">
              <Constellation orientation="d" active={active} setActive={setActive} />
            </div>
            <div className="relative mx-auto max-w-[26rem] md:hidden">
              <Constellation orientation="m" active={active} setActive={setActive} />
            </div>
          </div>
          <aside className="panel cq min-h-[18rem] min-w-0 p-6 md:p-8 lg:sticky lg:top-28 lg:self-start">
            <Detail active={active} />
          </aside>
        </div>
      </div>
    </section>
  );
}
