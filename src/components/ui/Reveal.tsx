"use client";

import { useEffect, useRef, type ElementType } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";

/** Fade-and-rise on scroll. Children stay visible without JS or with reduced motion. */
export default function Reveal({
  as: Tag = "div",
  className = "",
  y = 36,
  delay = 0,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  y?: number;
  delay?: number;
  children: React.ReactNode;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setupGsap();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { y, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.1, delay, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } },
      );
    }, el);
    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, [y, delay]);

  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
