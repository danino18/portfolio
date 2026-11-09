"use client";

import { projects, type ProjectKind } from "@/content/projects";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import ProjectShell, { type ShellLayout } from "@/components/projects/ProjectShell";
import { experiences } from "@/components/projects/experiences";
import { scrollToId } from "@/lib/scroll";

const layouts: Record<ProjectKind, ShellLayout> = {
  dart: "overlay",
  planner: "left",
  maze: "stack",
  arm: "right",
  explorations: "stack",
};

export default function Projects() {
  return (
    <section id="work" aria-labelledby="work-title" className="relative">
      <div className="mx-auto max-w-[1800px] px-[var(--gutter)] pb-20 pt-32 md:pt-48">
        <Reveal className="label mb-8 flex items-center gap-4">
          <span className="text-cyan">03</span>
          <span className="h-px w-12 bg-line" />
          Execute · Selected work
        </Reveal>
        <div className="grid gap-10">
          <h2 id="work-title" className="section-title metal-text">
            <SplitText text="Things I build, break & measure." />
          </h2>
          <Reveal as="p" className="max-w-md text-mute lg:ml-auto">
            Five pieces of work, each with its own small machine to play with. Ongoing and exploratory work is labeled as such, and every demo says what it is.
          </Reveal>
        </div>

        <Reveal as="ol" className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 sm:[&>li:last-child]:col-span-2 lg:grid-cols-5 lg:[&>li:last-child]:col-span-1">
          {projects.map((p) => (
            <li key={p.slug} className="bg-bg">
              <button
                type="button"
                onClick={() => scrollToId(p.slug)}
                data-cursor="Jump"
                className="group flex h-full w-full flex-col items-start gap-6 p-5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-3xl font-extrabold" style={{ color: p.accent.a }}>
                    {p.index}
                  </span>
                  <span aria-hidden className="h-2 w-2 rounded-full transition-transform group-hover:scale-150" style={{ background: p.accent.a, boxShadow: `0 0 12px ${p.accent.a}` }} />
                </span>
                <span>
                  <span className="block font-display text-base font-bold uppercase leading-tight tracking-tight">{p.title}</span>
                  <span className="label mt-2 block !text-[0.58rem]">{p.statusLabel}</span>
                </span>
              </button>
            </li>
          ))}
        </Reveal>
      </div>

      {projects.map((p) => {
        const Experience = experiences[p.kind];
        return (
          <ProjectShell key={p.slug} project={p} layout={layouts[p.kind]}>
            <Experience />
          </ProjectShell>
        );
      })}
    </section>
  );
}
