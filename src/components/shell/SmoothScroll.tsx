"use client";

import { isReducedMotion } from "@/lib/motion";
import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { scrollState } from "@/lib/scrollState";
import { setLenis } from "@/lib/scroll";
import { sfx } from "@/lib/sfx";

/**
 * Lenis drives inertial scrolling from GSAP's ticker (autoRaf off) and
 * forwards every scroll event to ScrollTrigger so both stay in lockstep.
 * Also publishes scroll/pointer state for WebGL loops.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setupGsap();
    sfx.restore();
    // Mobile URL-bar show/hide changes innerHeight constantly; don't rebuild
    // every trigger for it (real rotations/resizes still refresh below).
    ScrollTrigger.config({ ignoreMobileResize: true });
    const reduced = isReducedMotion();
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let lenis: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;

    const publish = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollState.page = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      scrollState.hero = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 1.1)));
    };

    if (!reduced) {
      lenis = new Lenis({ autoRaf: false, lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
      setLenis(lenis);
      lenis.on("scroll", (l: Lenis) => {
        ScrollTrigger.update();
        scrollState.velocity = Math.max(-1, Math.min(1, l.velocity / 40));
        publish();
      });
      tick = (t: number) => lenis?.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener("scroll", publish, { passive: true });
    }
    publish();

    const onMove = (e: PointerEvent) => {
      scrollState.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    if (finePointer) document.documentElement.classList.add("has-cursor");

    // One debounced refresh for layout changes: window resize, rotation,
    // late fonts, lazy sections growing the page.
    let refreshT = 0;
    const refresh = () => {
      window.clearTimeout(refreshT);
      refreshT = window.setTimeout(() => {
        ScrollTrigger.refresh();
        lenis?.resize();
        publish();
      }, 180);
    };
    const onLoad = () => refresh();
    window.addEventListener("load", onLoad);
    window.addEventListener("orientationchange", refresh);
    document.fonts?.ready.then(refresh).catch(() => {});
    let lastW = window.innerWidth;
    let lastH = document.body.scrollHeight;
    const ro = new ResizeObserver(() => {
      const w = window.innerWidth;
      const h = document.body.scrollHeight;
      if (w === lastW && Math.abs(h - lastH) < 2) return;
      lastW = w;
      lastH = h;
      refresh();
    });
    ro.observe(document.body);

    return () => {
      ro.disconnect();
      window.clearTimeout(refreshT);
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", publish);
      document.documentElement.classList.remove("has-cursor");
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      setLenis(null);
    };
  }, []);

  return <>{children}</>;
}
