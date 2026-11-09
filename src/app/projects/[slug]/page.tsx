import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { factLabels, getAdjacent, getProject, projects, type FactState } from "@/content/projects";
import { site } from "@/content/site";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import Magnetic from "@/components/ui/Magnetic";
import { TransitionLink } from "@/components/shell/PageTransition";
import ProjectSigil from "@/components/projects/ProjectSigil";
import ProjectStage from "@/components/projects/ProjectStage";
import Footer from "@/components/shell/Footer";
import { ArrowIcon, ExternalIcon, GitHubIcon } from "@/components/ui/Icons";

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.summary,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { title: `${p.title} — ${site.name}`, description: p.summary, url: `/projects/${p.slug}`, type: "article" },
    twitter: { title: `${p.title} — ${site.name}`, description: p.summary },
  };
}

const factTone: Record<FactState, string> = {
  built: "border-white/25 text-ink",
  "in-progress": "border-cyan/50 text-cyan",
  direction: "border-violet/50 text-[#b9a1ff]",
  exploratory: "border-[#ff6bd6]/50 text-[#ff9be6]",
  illustrative: "border-white/10 text-faint",
};

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();
  const { prev, next } = getAdjacent(slug);
  const style = { "--accent": p.accent.a, "--accent-b": p.accent.b } as CSSProperties;

  return (
    <article style={style} aria-labelledby="project-title">
      <header className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 70% at 80% 30%, ${p.accent.a}1f, transparent 70%)` }} />
        <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(60%_60%_at_70%_40%,#000,transparent)]" />
        <div className="relative mx-auto grid max-w-[1800px] gap-10 px-[var(--gutter)] pb-20 pt-36 md:pt-48 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <Reveal className="label mb-8 flex flex-wrap items-center gap-3">
              <TransitionLink href="/#work" label="work" className="transition-colors hover:text-ink">
                ← All work
              </TransitionLink>
              <span className="h-px w-8 bg-line" />
              <span style={{ color: p.accent.a }}>{p.index} / 05</span>
              <span className="chip !text-[0.62rem]" style={{ borderColor: `${p.accent.a}77`, color: p.accent.a }}>
                {p.statusLabel}
              </span>
            </Reveal>
            <h1 id="project-title" aria-label={p.title} className="font-display text-[clamp(2.8rem,9vw,8.5rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.035em]">
              {p.titleLines.map((l, i) => (
                <SplitText key={l} text={l} className={`block ${i === 0 ? "metal-text" : ""}`} stagger={0.04} />
              ))}
            </h1>
            <Reveal as="p" className="mt-8 max-w-xl font-display text-xl font-semibold leading-snug md:text-2xl" style={{ color: p.accent.a }}>
              {p.tagline}
            </Reveal>
          </div>
          <Reveal className="h-56 md:h-72 lg:h-80" aria-hidden>
            <ProjectSigil project={p} />
          </Reveal>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-[var(--gutter)] py-20 md:py-28">
        <ProjectStage project={p} />
      </div>

      <div className="mx-auto grid max-w-[1800px] gap-16 px-[var(--gutter)] pb-24 lg:grid-cols-[1fr_1fr] lg:gap-24">
        <section aria-labelledby="overview">
          <Reveal as="h2" id="overview" className="label mb-6">
            Overview
          </Reveal>
          <div className="space-y-6 text-lg leading-relaxed text-ink/90">
            {p.description.map((para, i) => (
              <Reveal as="p" key={i} delay={i * 0.06}>
                {para}
              </Reveal>
            ))}
          </div>

          <Reveal as="h2" className="label mb-4 mt-14">
            Topics
          </Reveal>
          <Reveal as="ul" className="flex flex-wrap gap-2">
            {p.topics.map((t) => (
              <li key={t} className="chip">
                {t}
              </li>
            ))}
          </Reveal>

          <Reveal as="h2" className="label mb-4 mt-10">
            Stack
          </Reveal>
          <Reveal as="ul" className="flex flex-wrap gap-2">
            {p.stack.map((t) => (
              <li key={t} className="chip !text-ink">
                {t}
              </li>
            ))}
          </Reveal>

          {p.links.length > 0 ? (
            <Reveal className="mt-10 flex flex-wrap gap-3">
              {p.links.map((l) => (
                <Magnetic key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 rounded-full border border-white/25 px-6 py-3.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    <GitHubIcon /> {l.label} <ExternalIcon />
                  </a>
                </Magnetic>
              ))}
            </Reveal>
          ) : (
            <Reveal as="p" className="label mt-10 !text-faint">
              No public repository or live URL for this project. This page is the case study.
            </Reveal>
          )}
        </section>

        <section aria-labelledby="status">
          <Reveal as="h2" id="status" className="label mb-6">
            What is real here
          </Reveal>
          <ul className="divide-y divide-line border-y border-line">
            {p.facts.map((f, i) => (
              <Reveal as="li" key={i} delay={i * 0.04} className="grid grid-cols-[auto_1fr] items-start gap-5 py-5">
                <span className={`chip mt-0.5 !text-[0.6rem] ${factTone[f.state]}`}>{factLabels[f.state]}</span>
                <span className="leading-relaxed text-mute">{f.text}</span>
              </Reveal>
            ))}
          </ul>
        </section>
      </div>

      <nav aria-label="More projects" className="border-t border-line">
        <div className="mx-auto grid max-w-[1800px] sm:grid-cols-2">
          {[
            { dir: "Previous", p: prev },
            { dir: "Next", p: next },
          ].map(({ dir, p: q }, i) => (
            <TransitionLink
              key={dir}
              href={`/projects/${q.slug}`}
              label={q.title}
              data-cursor={dir}
              className={`group flex flex-col gap-4 px-[var(--gutter)] py-14 transition-colors hover:bg-white/[0.03] ${i === 1 ? "sm:border-l sm:border-line sm:text-right sm:items-end" : "border-b border-line sm:border-b-0"}`}
            >
              <span className="label flex items-center gap-2">
                {i === 0 && <ArrowIcon className="h-3.5 w-3.5 rotate-180" />}
                {dir} · {q.index}
                {i === 1 && <ArrowIcon className="h-3.5 w-3.5" />}
              </span>
              <span className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight transition-colors md:text-5xl" style={{ color: q.accent.a }}>
                {q.title}
              </span>
            </TransitionLink>
          ))}
        </div>
      </nav>
      <Footer />
    </article>
  );
}
