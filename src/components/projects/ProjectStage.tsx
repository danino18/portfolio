"use client";

import type { CSSProperties } from "react";
import type { Project } from "@/content/projects";
import { experiences } from "./experiences";

/** The project's interactive experience, framed for the detail page. */
export default function ProjectStage({ project }: { project: Project }) {
  const Experience = experiences[project.kind];
  const style = { "--accent": project.accent.a, "--accent-b": project.accent.b, "--stage-a": `${project.accent.a}14` } as CSSProperties;
  return (
    <div style={style}>
      <div className="stage rounded-[20px]">
        <Experience />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="label flex items-center gap-2">
          <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: project.accent.a }} />
          {project.demoNote}
        </p>
        <p className="label !text-faint">{project.interaction}</p>
      </div>
    </div>
  );
}
