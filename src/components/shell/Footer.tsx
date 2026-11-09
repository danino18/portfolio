"use client";

import { site } from "@/content/site";
import { projects } from "@/content/projects";
import { TransitionLink } from "./PageTransition";
import { scrollToId } from "@/lib/scroll";
import { GitHubIcon, LinkedInIcon } from "@/components/ui/Icons";

export default function Footer() {
  return (
    <footer className="relative border-t border-line bg-bg">
      <div className="mx-auto grid max-w-[1800px] gap-12 px-[var(--gutter)] py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight">{site.name}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-mute">Computer Engineering student at the Technion. GPU computing, hardware &amp; software, robotics.</p>
          <div className="mt-6 flex gap-3">
            <a href={site.links.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub profile" className="grid h-10 w-10 place-items-center rounded-full border border-line transition-colors hover:border-cyan hover:text-cyan">
              <GitHubIcon />
            </a>
            <a href={site.links.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile" className="grid h-10 w-10 place-items-center rounded-full border border-line transition-colors hover:border-violet hover:text-[#b9a1ff]">
              <LinkedInIcon />
            </a>
          </div>
        </div>

        <nav aria-label="Footer sections">
          <p className="label mb-4">Sections</p>
          <ul className="space-y-2 text-sm text-mute">
            {site.nav.map((n) => (
              <li key={n.id}>
                <TransitionLink href={`/#${n.id}`} className="transition-colors hover:text-ink">
                  {n.label}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer projects">
          <p className="label mb-4">Projects</p>
          <ul className="space-y-2 text-sm text-mute">
            {projects.map((p) => (
              <li key={p.slug}>
                <TransitionLink href={`/projects/${p.slug}`} label={p.title} className="transition-colors hover:text-ink">
                  {p.title}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="label mb-4">About this site</p>
          <p className="text-sm leading-relaxed text-mute">
            Every interactive visual here is an original illustration built for this site. Case-study pages say what is real work, what is ongoing and what is illustrative.
          </p>
          <p className="label mt-4 !text-[0.6rem] !text-faint">Next.js · React Three Fiber · GSAP · Lenis</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-[var(--gutter)] py-6">
          <p className="label !text-[0.62rem]">© {new Date().getFullYear()} {site.name}</p>
          <button type="button" onClick={() => scrollToId("top")} className="label flex items-center gap-2 !text-[0.62rem] transition-colors hover:text-cyan">
            Back to top <span aria-hidden>↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
