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
  reef: "left",
  wifi: "stack",
};

export default function Projects() {
  return (
    <section id="work" aria-labelledby="work-title" className="relative">
      <div className="mx-auto max-w-[1800px] px-[var(--gutter)] pb-16 pt-24 sm:pb-20 md:pt-40 xl:pt-48">
        <Reveal className="label mb-8 flex items-center gap-4">
          <span className="text-cyan">03</span>
          <span className="h-px w-12 bg-line" />
          Execute · Selected work
        </Reveal>
        <div className="grid gap-8 md:gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
          <div className="cq min-w-0">
            <h2 id="work-title" className="section-title metal-text">
              <SplitText text="Things I build, break & measure." />
            </h2>
          </div>
          <Reveal as="p" className="max-w-md text-mute lg:ml-auto">
            Four engineering projects, the Navy innovation accelerator I founded, and a future project, each with its own small machine to play with. Ongoing and exploratory work is labeled as such, every demo says what it is, and real projects link to their code or live site.
          </Reveal>
        </div>

        <Reveal as="ol" className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 md:mt-16">
          {projects.map((p) => (
            <li key={p.slug} className="bg-bg">
              <button
                type="button"
                onClick={() => scrollToId(p.slug)}
                data-cursor="Jump"
                className="group flex h-full w-full flex-col items-start gap-4 p-4 text-left transition-colors hover:bg-white/[0.03] sm:gap-6 sm:p-5"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-3xl font-extrabold" style={{ color: p.accent.a }}>
                    {p.index}
                  </span>
                  <span aria-hidden className="h-2 w-2 rounded-full transition-transform group-hover:scale-150" style={{ background: p.accent.a, boxShadow: `0 0 12px ${p.accent.a}` }} />
                </span>
                <span>
                  <span className="block font-display text-base font-bold uppercase leading-tight tracking-tight [overflow-wrap:anywhere]">{p.title}</span>
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
