import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { factLabels, getAdjacent, getProject, projects, type FactState } from "@/content/projects";
import { site } from "@/content/site";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import { TransitionLink } from "@/components/shell/PageTransition";
import ProjectSigil from "@/components/projects/ProjectSigil";
import ProjectStage from "@/components/projects/ProjectStage";
import Footer from "@/components/shell/Footer";
import ProjectLinks from "@/components/projects/ProjectLinks";
import { ArrowIcon } from "@/components/ui/Icons";
import { fitVars } from "@/lib/type";

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
        <div className="relative mx-auto grid max-w-[1800px] gap-8 px-[var(--gutter)] pb-14 pt-[calc(var(--nav-h)+3rem)] sm:pb-20 md:pt-44 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div className="cq min-w-0">
            <Reveal className="label mb-8 flex flex-wrap items-center gap-3">
              <TransitionLink href="/#work" label="work" className="transition-colors hover:text-ink">
                ← All work
              </TransitionLink>
              <span className="h-px w-8 bg-line" />
              <span style={{ color: p.accent.a }}>
                {p.index} / {String(projects.length).padStart(2, "0")}
              </span>
              <span className="chip !text-[0.62rem]" style={{ borderColor: `${p.accent.a}77`, color: p.accent.a }}>
                {p.statusLabel}
              </span>
            </Reveal>
            <h1
              id="project-title"
              aria-label={p.title}
              className="fit-title font-display font-extrabold uppercase leading-[0.9] tracking-[-0.035em]"
              style={fitVars(p.titleLines, "clamp(2.6rem, 1.2rem + 6.5vw, 8.5rem)")}
            >
              {p.titleLines.map((l, i) => (
                <SplitText key={l} text={l} className={`block ${i === 0 ? "metal-text" : ""}`} stagger={0.04} />
              ))}
            </h1>
            <Reveal as="p" className="mt-6 max-w-xl font-display text-[clamp(1.15rem,1rem+0.7vw,1.6rem)] font-semibold leading-snug sm:mt-8" style={{ color: p.accent.a }}>
              {p.tagline}
            </Reveal>
            {p.credit && (
              <Reveal as="p" className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                {p.credit}
              </Reveal>
            )}
            {p.links.length > 0 && (
              <Reveal className="mt-8">
                <ProjectLinks project={p} size="lg" />
              </Reveal>
            )}
          </div>
          <Reveal className="hidden h-56 sm:block md:h-72 lg:h-80" aria-hidden>
            <ProjectSigil project={p} />
          </Reveal>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-[var(--gutter)] py-14 sm:py-20 md:py-28">
        <ProjectStage project={p} />
      </div>

      <div className="mx-auto grid max-w-[1800px] gap-14 px-[var(--gutter)] pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-24">
        <section aria-labelledby="overview" className="min-w-0">
          <Reveal as="h2" id="overview" className="label mb-6">
            Overview
          </Reveal>
          <div className="max-w-[68ch] space-y-6 text-[1.05rem] leading-relaxed text-ink/90 sm:text-lg">
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
            <Reveal className="mt-10">
              <ProjectLinks project={p} size="lg" />
            </Reveal>
          ) : (
            <Reveal as="p" className="label mt-10 !text-faint">
              {p.status === "exploratory"
                ? "Future / experimental work — no public repository or live demo yet. This page is the case study."
                : "No public repository or live URL for this project yet. This page is the case study."}
            </Reveal>
          )}
        </section>

        <section aria-labelledby="status" className="min-w-0">
          <Reveal as="h2" id="status" className="label mb-6">
            What is real here
          </Reveal>
          <ul className="divide-y divide-line border-y border-line">
            {p.facts.map((f, i) => (
              <Reveal as="li" key={i} delay={i * 0.04} className="grid items-start gap-3 py-5 sm:grid-cols-[auto_1fr] sm:gap-5">
                <span className={`chip mt-0.5 w-fit !text-[0.6rem] ${factTone[f.state]}`}>{factLabels[f.state]}</span>
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
              className={`cq group flex min-w-0 flex-col gap-4 px-[var(--gutter)] py-12 transition-colors sm:py-14 hover:bg-white/[0.03] ${i === 1 ? "sm:border-l sm:border-line sm:text-right sm:items-end" : "border-b border-line sm:border-b-0"}`}
            >
              <span className="label flex items-center gap-2">
                {i === 0 && <ArrowIcon className="h-3.5 w-3.5 rotate-180" />}
                {dir} · {q.index}
                {i === 1 && <ArrowIcon className="h-3.5 w-3.5" />}
              </span>
              <span className="fit-title font-display font-extrabold uppercase leading-none tracking-tight transition-colors" style={{ color: q.accent.a, ...fitVars(q.title, "clamp(1.75rem, 1.2rem + 2.2vw, 3rem)") }}>
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
