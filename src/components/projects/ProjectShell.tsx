"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import type { Project } from "@/content/projects";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import Magnetic from "@/components/ui/Magnetic";
import { TransitionLink } from "@/components/shell/PageTransition";
import { ArrowIcon, ExternalIcon, GitHubIcon } from "@/components/ui/Icons";

export type ShellLayout = "overlay" | "left" | "right" | "stack";

const statusTone: Record<Project["status"], string> = {
  "ongoing-research": "border-cyan/50 text-cyan",
  project: "border-white/25 text-ink",
  workshop: "border-signal/50 text-signal",
  exploratory: "border-[#ff6bd6]/50 text-[#ff9be6]",
};

/**
 * Shared frame for each project: copy block + a stage for the project's own
 * interactive experience. The stage opens with a scroll-scrubbed clip-path
 * "aperture" so each project arrives as its own scene.
 */
export default function ProjectShell({
  project,
  layout,
  stageClass = "",
  children,
}: {
  project: Project;
  layout: ShellLayout;
  stageClass?: string;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const stageWrap = useRef<HTMLDivElement>(null);
  const p = project;
  const style = { "--accent": p.accent.a, "--accent-b": p.accent.b, "--stage-a": `${p.accent.a}14` } as CSSProperties;

  useEffect(() => {
    setupGsap();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = stageWrap.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { clipPath: "inset(14% 8% 14% 8% round 40px)", scale: 0.94 },
        {
          clipPath: "inset(0% 0% 0% 0% round 20px)",
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 95%", end: "top 40%", scrub: 0.6 },
        },
      );
    }, root.current ?? undefined);
    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  const copy = (
    <div className={layout === "overlay" ? "" : layout === "stack" ? "" : "lg:sticky lg:top-28"}>
      <Reveal className="label mb-6 flex flex-wrap items-center gap-3">
        <span style={{ color: p.accent.a }}>
          {p.index} / 05
        </span>
        <span className={`chip !text-[0.62rem] ${statusTone[p.status]}`}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" style={{ animation: "pulse-dot 1.8s infinite" }} />
          {p.statusLabel}
        </span>
      </Reveal>

      <h3 className={`font-display font-extrabold uppercase leading-[0.9] tracking-[-0.03em] ${layout === "left" || layout === "right" ? "text-[clamp(2rem,4.2vw,4.4rem)]" : "text-[clamp(2.4rem,6.2vw,6rem)]"}`} aria-label={p.title}>
        {p.titleLines.map((l, i) => (
          <SplitText key={l} text={l} className={`block ${i === 1 ? "" : "metal-text"}`} />
        ))}
      </h3>

      <div className={layout === "stack" || layout === "overlay" ? "mt-2 grid gap-x-16 lg:grid-cols-2 lg:items-start" : ""}>
        <div>
      <Reveal as="p" className="mt-6 font-display text-lg font-semibold leading-snug md:text-xl" style={{ color: p.accent.a }}>
        {p.tagline}
      </Reveal>
      <Reveal as="p" className="mt-4 max-w-lg leading-relaxed text-mute">
        {p.summary}
      </Reveal>

        </div>
        <div>
      <Reveal as="ul" className="mt-6 lg:mt-6 flex flex-wrap gap-2" aria-label="Topics">
        {p.topics.map((t) => (
          <li key={t} className="chip !text-[0.62rem]">
            {t}
          </li>
        ))}
      </Reveal>

      <Reveal className="mt-8 flex flex-wrap items-center gap-3">
        <Magnetic>
          <TransitionLink
            href={`/projects/${p.slug}`}
            label={p.title}
            data-cursor="Open"
            className="group inline-flex items-center gap-3 rounded-full border px-5 py-3 font-mono text-[0.72rem] uppercase tracking-[0.12em] transition-colors hover:bg-white/5"
            style={{ borderColor: `${p.accent.a}88`, color: p.accent.a }}
          >
            Case study <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </TransitionLink>
        </Magnetic>
        {p.links.map((l) => (
          <Magnetic key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 font-mono text-[0.72rem] uppercase tracking-[0.12em] transition-colors hover:border-white/60"
            >
              <GitHubIcon /> {l.label} <ExternalIcon />
            </a>
          </Magnetic>
        ))}
      </Reveal>
        </div>
      </div>
    </div>
  );

  const stage = (
    <div ref={stageWrap} className="relative will-change-[clip-path]">
      <div className={`stage rounded-[20px] ${stageClass}`}>{children}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="label flex items-center gap-2">
          <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: p.accent.a }} />
          {p.demoNote}
        </p>
        <p className="label hidden !text-faint md:block">{p.interaction}</p>
      </div>
    </div>
  );

  const grid =
    layout === "left"
      ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16"
      : layout === "right"
        ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16"
        : "";

  return (
    <article
      id={p.slug}
      ref={root}
      aria-labelledby={`${p.slug}-h`}
      style={style}
      className="relative border-t border-line py-20 md:py-32"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(60% 50% at ${layout === "right" ? "25%" : "75%"} 40%, ${p.accent.a}12, transparent 70%)` }} />
      <h2 id={`${p.slug}-h`} className="sr-only">
        {p.title}
      </h2>
      <div className="mx-auto max-w-[1800px] px-[var(--gutter)]">
        {layout === "overlay" || layout === "stack" ? (
          <div className="grid gap-12">
            {layout === "overlay" ? (
              <>
                {stage}
                <div className="lg:-mt-6">{copy}</div>
              </>
            ) : (
              <>
                {copy}
                {stage}
              </>
            )}
          </div>
        ) : (
          <div className={`grid items-start gap-12 ${grid}`}>
            {layout === "right" ? (
              <>
                {stage}
                {copy}
              </>
            ) : (
              <>
                {copy}
                {stage}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
