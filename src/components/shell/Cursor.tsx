"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { sfx } from "@/lib/sfx";

/**
 * Custom cursor: a precise dot plus a lagging ring that expands over
 * interactive elements and can carry a short label via `data-cursor="Drag"`.
 * Only active for fine pointers.
 */
export default function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const r = ring.current!;
    const d = dot.current!;
    const l = label.current!;
    gsap.set([r, d], { xPercent: -50, yPercent: -50, opacity: 0 });
    const rx = gsap.quickTo(r, "x", { duration: 0.45, ease: "power3.out" });
    const ry = gsap.quickTo(r, "y", { duration: 0.45, ease: "power3.out" });
    const dx = gsap.quickTo(d, "x", { duration: 0.06, ease: "none" });
    const dy = gsap.quickTo(d, "y", { duration: 0.06, ease: "none" });

    let shown = false;
    const move = (e: PointerEvent) => {
      if (!shown) {
        shown = true;
        gsap.set([r, d], { x: e.clientX, y: e.clientY });
        gsap.to([r, d], { opacity: 1, duration: 0.3 });
      }
      rx(e.clientX);
      ry(e.clientY);
      dx(e.clientX);
      dy(e.clientY);
    };

    let current: Element | null = null;
    const over = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.("a,button,[role='button'],[data-cursor],input,label,summary") ?? null;
      if (t === current) return;
      current = t;
      if (t) {
        const text = t.getAttribute("data-cursor");
        l.textContent = text && text !== "true" ? text : "";
        const big = !!text && text !== "true";
        gsap.to(r, { scale: big ? 2.4 : 1.7, backgroundColor: "rgba(56,232,255,0.12)", borderColor: "rgba(56,232,255,0.9)", duration: 0.35, ease: "power3.out" });
        gsap.to(d, { scale: 0.4, duration: 0.25 });
        gsap.to(l, { opacity: big ? 1 : 0, duration: 0.2 });
        sfx.hover();
      } else {
        l.textContent = "";
        gsap.to(r, { scale: 1, backgroundColor: "rgba(56,232,255,0)", borderColor: "rgba(255,255,255,0.45)", duration: 0.35, ease: "power3.out" });
        gsap.to(d, { scale: 1, duration: 0.25 });
        gsap.to(l, { opacity: 0, duration: 0.2 });
      }
    };
    const down = () => {
      gsap.to(r, { scale: current ? 1.2 : 0.8, duration: 0.15 });
      sfx.click();
    };
    const up = () => gsap.to(r, { scale: current ? 1.7 : 1, duration: 0.3, ease: "back.out(2)" });
    const leave = () => {
      shown = false;
      gsap.to([r, d], { opacity: 0, duration: 0.2 });
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed left-0 top-0 z-[120] hidden [@media(hover:hover)_and_(pointer:fine)]:block">
      <div
        ref={ring}
        className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-white/45 will-change-transform"
        style={{ mixBlendMode: "difference" }}
      >
        <span ref={label} className="label !text-[0.5rem] !tracking-[0.1em] text-white opacity-0" style={{ transform: "scale(0.42)" }} />
      </div>
      <div ref={dot} className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_12px_#38e8ff] will-change-transform" />
    </div>
  );
}
