"use client";

import { isReducedMotion } from "@/lib/motion";
import { useEffect, useRef, type CSSProperties } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { projects, type Project } from "@/content/projects";
import { fitVars } from "@/lib/type";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import Magnetic from "@/components/ui/Magnetic";
import { TransitionLink } from "@/components/shell/PageTransition";
import { ArrowIcon } from "@/components/ui/Icons";
import ProjectLinks from "./ProjectLinks";
import ProjectVideo from "./ProjectVideo";

export type ShellLayout = "overlay" | "left" | "right" | "stack";

const statusTone: Record<Project["status"], string> = {
  "ongoing-research": "border-cyan/50 text-cyan",
  project: "border-white/25 text-ink",
  workshop: "border-signal/50 text-signal",
  exploratory: "border-[#ff6bd6]/50 text-[#ff9be6]",
};

/**
 * Shared frame for each project: copy block + a stage for the project's own
 * interactive experience (and real footage when there is some). The stage
 * opens with a scroll-scrubbed clip-path "aperture" — scrubbed, so it plays
 * in reverse when scrolling back up and re-measures on resize/rotation.
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
  // Projects with footage get a full-width stage row under the copy.
  const lay: ShellLayout = p.media ? "stack" : layout;
  const side = lay === "left" || lay === "right";

  useEffect(() => {
    setupGsap();
    if (isReducedMotion()) return;
    const el = stageWrap.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { clipPath: "inset(10% 6% 10% 6% round 40px)", scale: 0.95 },
        {
          clipPath: "inset(0% 0% 0% 0% round 20px)",
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 98%", end: "top 45%", scrub: 0.6, invalidateOnRefresh: true },
        },
      );
    }, root.current ?? undefined);
    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  const copy = (
    <div className={`cq min-w-0 ${side ? "lg:sticky lg:top-28" : ""}`}>
      <Reveal className="label mb-5 flex flex-wrap items-center gap-3 sm:mb-6">
        <span style={{ color: p.accent.a }}>
          {p.index} / {String(projects.length).padStart(2, "0")}
        </span>
        <span className={`chip !text-[0.62rem] ${statusTone[p.status]}`}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" style={{ animation: "pulse-dot 1.8s infinite" }} />
          {p.statusLabel}
        </span>
      </Reveal>

      <h3
        className="fit-title font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em]"
        style={fitVars(p.titleLines, side ? "var(--fs-project-side)" : "var(--fs-project)")}
        aria-label={p.title}
      >
        {p.titleLines.map((l, i) => (
          <SplitText key={l} text={l} className={`block ${i === 1 ? "" : "metal-text"}`} />
        ))}
      </h3>

      <div className={side ? "" : "mt-2 grid gap-x-16 lg:grid-cols-2 lg:items-start"}>
        <div className="min-w-0">
          <Reveal as="p" className="mt-5 max-w-[38ch] font-display text-[clamp(1.05rem,0.95rem+0.5vw,1.35rem)] font-semibold leading-snug sm:mt-6" style={{ color: p.accent.a }}>
            {p.tagline}
          </Reveal>
          <Reveal as="p" className="mt-4 max-w-[62ch] leading-relaxed text-mute">
            {p.summary}
          </Reveal>
        </div>
        <div className="min-w-0">
          <Reveal as="ul" className="mt-6 flex flex-wrap gap-2" aria-label="Topics">
            {p.topics.map((t) => (
              <li key={t} className="chip !text-[0.62rem]">
                {t}
              </li>
            ))}
          </Reveal>

          <Reveal className="mt-8 flex flex-wrap items-center gap-3">
            <ProjectLinks project={p} />
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
          </Reveal>
        </div>
      </div>
    </div>
  );

  const interactive = (
    <div className="min-w-0">
      <div className={`stage rounded-[20px] ${stageClass}`}>{children}</div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="label flex items-start gap-2">
          <span aria-hidden className="mt-[0.35em] h-1 w-1 shrink-0 rounded-full" style={{ background: p.accent.a }} />
          {p.demoNote}
        </p>
        <p className="label !text-faint md:max-w-[50%] md:text-right">{p.interaction}</p>
      </div>
    </div>
  );

  const stage = (
    <div ref={stageWrap} className="relative min-w-0 will-change-[clip-path]">
      {p.media ? (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(15rem,0.42fr)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(17rem,0.38fr)_minmax(0,1fr)]">
          <ProjectVideo media={p.media} accent={p.accent.a} className="mx-auto w-full max-w-[24rem] lg:sticky lg:top-24" />
          {interactive}
        </div>
      ) : (
        interactive
      )}
    </div>
  );

  const grid =
    lay === "left"
      ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-14 xl:gap-16"
      : lay === "right"
        ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16"
        : "";

  return (
    <article id={p.slug} ref={root} aria-labelledby={`${p.slug}-h`} style={style} className="relative scroll-mt-16 border-t border-line py-16 sm:py-20 md:py-28 xl:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(60% 50% at ${lay === "right" ? "25%" : "75%"} 40%, ${p.accent.a}12, transparent 70%)` }} />
      <h2 id={`${p.slug}-h`} className="sr-only">
        {p.title}
      </h2>
      <div className="mx-auto max-w-[1800px] px-[var(--gutter)]">
        {lay === "overlay" || lay === "stack" ? (
          <div className="grid gap-10 md:gap-12">
            {lay === "overlay" ? (
              <>
                {stage}
                <div className="lg:-mt-4">{copy}</div>
              </>
            ) : (
              <>
                {copy}
                {stage}
              </>
            )}
          </div>
        ) : (
          <div className={`grid items-start gap-10 md:gap-12 ${grid}`}>
            {lay === "right" ? (
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
