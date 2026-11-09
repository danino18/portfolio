import type { Project, ProjectLink } from "@/content/projects";
import Magnetic from "@/components/ui/Magnetic";
import { ExternalIcon, GitHubIcon, GlobeIcon, PlayIcon } from "@/components/ui/Icons";

const order: Record<ProjectLink["kind"], number> = { live: 0, github: 1, video: 2 };

/** The verified outbound links of a project, most important first. Renders nothing when there are none. */
export default function ProjectLinks({ project, size = "md", className = "" }: { project: Project; size?: "md" | "lg"; className?: string }) {
  const links = [...project.links].sort((a, b) => order[a.kind] - order[b.kind]);
  if (!links.length) return null;
  const pad = size === "lg" ? "px-6 py-3.5" : "px-5 py-3";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {links.map((l) => {
        const primary = l.kind === "live";
        return (
          <Magnetic key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              data-link-kind={l.kind}
              data-cursor={l.kind === "live" ? "Visit" : l.kind === "github" ? "Code" : "Watch"}
              className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full ${pad} font-mono text-[0.72rem] uppercase tracking-[0.12em] transition-colors ${
                primary
                  ? "bg-[var(--accent)] font-semibold text-bg shadow-[0_0_32px_-6px_var(--accent)] hover:bg-white"
                  : "border border-white/25 bg-white/[0.03] backdrop-blur hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {l.kind === "live" ? <GlobeIcon /> : l.kind === "github" ? <GitHubIcon /> : <PlayIcon className="h-3.5 w-3.5" />}
              <span>{l.label}</span>
              <ExternalIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Magnetic>
        );
      })}
    </div>
  );
}
