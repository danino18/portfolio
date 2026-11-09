"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ProjectKind } from "@/content/projects";

function StageSkeleton({ height }: { height: string }) {
  return (
    <div className="grid place-items-center" style={{ height }} role="status" aria-label="Loading interactive scene">
      <div className="label flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan" style={{ animation: "pulse-dot 1s infinite" }} />
        Loading scene
      </div>
    </div>
  );
}

const TALL = "clamp(30rem,calc(var(--svh)*76),48rem)";

/** One interactive experience per project kind, code-split and client-only. */
export const experiences: Record<ProjectKind, ComponentType> = {
  dart: dynamic(() => import("./DartExperience"), { ssr: false, loading: () => <StageSkeleton height={TALL} /> }),
  planner: dynamic(() => import("./PlannerExperience"), { ssr: false, loading: () => <StageSkeleton height="640px" /> }),
  maze: dynamic(() => import("./MazeExperience"), { ssr: false, loading: () => <StageSkeleton height={TALL} /> }),
  arm: dynamic(() => import("./ArmExperience"), { ssr: false, loading: () => <StageSkeleton height={TALL} /> }),
  reef: dynamic(() => import("./ReefExperience"), { ssr: false, loading: () => <StageSkeleton height="clamp(30rem,calc(var(--svh)*70),42rem)" /> }),
  wifi: dynamic(() => import("./WifiSensing"), { ssr: false, loading: () => <StageSkeleton height="clamp(36rem,calc(var(--svh)*82),50rem)" /> }),
};
