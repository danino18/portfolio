"use client";

import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame, type CanvasProps } from "@react-three/fiber";
import { downgradeQuality, useQuality } from "@/lib/quality";

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[scene] falling back to static visual:", error.message, info.componentStack);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let downgrades = 0;

/** Watches frame time and steps quality down (at most twice) if the GPU can't keep up. */
function PerfGuard() {
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    if (dt > 0.5 || document.hidden) return;
    const a = acc.current;
    a.t += dt;
    a.n += 1;
    if (a.n >= 90) {
      const avg = a.t / a.n;
      a.t = 0;
      a.n = 0;
      if (avg > 0.028 && downgrades < 2) {
        downgrades += 1;
        downgradeQuality();
      }
    }
  });
  return null;
}

interface Props extends Omit<CanvasProps, "children" | "frameloop" | "dpr"> {
  children: ReactNode;
  /** Shown for tier 0, before measurement, off-screen, and when the scene throws. */
  fallback: ReactNode;
  className?: string;
  /** Mount the canvas only when within this margin of the viewport. */
  mountMargin?: string;
  /** Always render regardless of visibility (rare). */
  alwaysOn?: boolean;
}

/**
 * Shared WebGL host. Lazily mounts a Canvas near the viewport, pauses its
 * render loop off-screen, unmounts it when far away (browsers cap WebGL
 * contexts), adapts DPR, and degrades to a static fallback on failure.
 */
export default function SceneCanvas({ children, fallback, className = "", mountMargin = "60% 0px", alwaysOn, ...canvasProps }: Props) {
  const q = useQuality();
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const a = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: mountMargin });
    const b = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "0px" });
    a.observe(el);
    b.observe(el);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, [mountMargin]);

  const live = q !== null && q.tier > 0 && near;
  const loop = q && !q.reducedMotion && (visible || alwaysOn) ? "always" : "demand";

  return (
    <div ref={host} className={`relative h-full w-full ${className}`}>
      <SceneBoundary fallback={fallback}>
        {live && q ? (
          <Canvas
            frameloop={loop}
            dpr={q.dpr}
            gl={{ antialias: q.tier >= 2, alpha: true, powerPreference: "high-performance" }}
            {...canvasProps}
          >
            <PerfGuard />
            {children}
          </Canvas>
        ) : (
          fallback
        )}
      </SceneBoundary>
    </div>
  );
}
