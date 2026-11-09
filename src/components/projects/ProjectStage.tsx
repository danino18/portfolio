"use client";

import type { CSSProperties } from "react";
import type { Project } from "@/content/projects";
import { experiences } from "./experiences";
import ProjectVideo from "./ProjectVideo";

/** The project's interactive experience (and real footage, if any), framed for the detail page. */
export default function ProjectStage({ project }: { project: Project }) {
  const Experience = experiences[project.kind];
  const style = { "--accent": project.accent.a, "--accent-b": project.accent.b, "--stage-a": `${project.accent.a}14` } as CSSProperties;
  const interactive = (
    <div className="min-w-0">
      <div className="stage rounded-[20px]">
        <Experience />
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="label flex items-start gap-2">
          <span aria-hidden className="mt-[0.35em] h-1 w-1 shrink-0 rounded-full" style={{ background: project.accent.a }} />
          {project.demoNote}
        </p>
        <p className="label !text-faint md:max-w-[50%] md:text-right">{project.interaction}</p>
      </div>
    </div>
  );
  return (
    <div style={style}>
      {project.media ? (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(15rem,0.42fr)_minmax(0,1fr)] lg:gap-10">
          <ProjectVideo media={project.media} accent={project.accent.a} className="mx-auto w-full max-w-[24rem] lg:sticky lg:top-24" />
          {interactive}
        </div>
      ) : (
        interactive
      )}
    </div>
  );
}
