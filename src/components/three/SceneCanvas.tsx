"use client";

import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame, type CanvasProps, type RootState } from "@react-three/fiber";
import { noteContextLoss, reportFrameStats, useQuality } from "@/lib/quality";

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[scene] falling back to 2D visual:", error.message, info.componentStack?.slice(0, 300));
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Measures frame time in windows and reports to the quality controller.
 * The first frames after mount (shader compilation, geometry upload) are
 * ignored, as are frames while the tab is hidden.
 */
function PerfProbe() {
  const acc = useRef({ n: 0, t: 0, min: 1, warm: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    if (document.hidden || dt <= 0 || dt > 0.25) return;
    if (a.warm < 50) {
      a.warm++;
      return;
    }
    a.n++;
    a.t += dt;
    a.min = Math.min(a.min, dt);
    if (a.n >= 90) {
      reportFrameStats(a.t / a.n, a.min);
      a.n = 0;
      a.t = 0;
      a.min = 1;
    }
  });
  return null;
}

interface Props extends Omit<CanvasProps, "children" | "frameloop" | "dpr"> {
  children: ReactNode;
  /** Shown for tier 0, before measurement, off-screen, and when the scene throws. Should itself be animated. */
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
 * contexts), adapts DPR, recovers from context loss and degrades to an
 * animated fallback when WebGL is missing or a scene fails.
 */
export default function SceneCanvas({ children, fallback, className = "", mountMargin = "60% 0px", alwaysOn, ...canvasProps }: Props) {
  const q = useQuality();
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [dead, setDead] = useState(false);
  const losses = useRef(0);

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

  const onCreated = useCallback(
    (st: RootState) => {
      const canvas = st.gl.domElement;
      canvas.addEventListener(
        "webglcontextlost",
        (e) => {
          e.preventDefault();
          losses.current += 1;
          noteContextLoss();
          // Remount a fresh canvas shortly after (a few times at most).
          if (losses.current <= 2) window.setTimeout(() => setGeneration((g) => g + 1), 900);
          else setDead(true);
        },
        { once: true },
      );
      canvasProps.onCreated?.(st);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const live = q !== null && q.tier > 0 && near && !dead;
  const loop = q && (visible || alwaysOn) ? "always" : "never";

  return (
    <div ref={host} className={`relative h-full w-full ${className}`} data-scene={live ? "webgl" : "fallback"}>
      <SceneBoundary key={generation} fallback={fallback} onError={() => setDead(true)}>
        {live && q ? (
          <Canvas
            key={generation}
            {...canvasProps}
            frameloop={loop}
            dpr={q.dpr}
            gl={{ antialias: q.tier >= 2, alpha: true, powerPreference: q.tier >= 3 ? "high-performance" : "default", stencil: false }}
            onCreated={onCreated}
          >
            <PerfProbe />
            {children}
          </Canvas>
        ) : (
          fallback
        )}
      </SceneBoundary>
    </div>
  );
}
