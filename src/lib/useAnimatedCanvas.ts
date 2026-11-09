"use client";

import { useEffect, useRef } from "react";

export type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void;

/**
 * 2D canvas with DPR scaling, resize handling and a render loop that only runs
 * while the canvas is on screen. With reduced motion it draws a single frame
 * (and again on `redraw()`).
 */
export function useAnimatedCanvas(draw: DrawFn, onResize?: (w: number, h: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;
  const api = useRef({ redraw: () => {} });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let visible = false;
    let t = 0;

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resizeRef.current?.(w, h);
      step(0);
    };

    const step = (dt: number) => {
      t += dt;
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, w, h, t, dt);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      if (visible && !reduced) raf = requestAnimationFrame(loop);
    };

    api.current.redraw = () => step(0.016);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    fit();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return { ref, redraw: () => api.current.redraw() };
}
