"use client";

import { isReducedMotion } from "@/lib/motion";
import { useEffect, useRef, type ElementType } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";

interface Props {
  text: string;
  as?: ElementType;
  className?: string;
  /** "scroll" reveals when scrolled into view; "manual" leaves chars untouched for a parent timeline. */
  trigger?: "scroll" | "manual";
  delay?: number;
  stagger?: number;
  start?: string;
}

/**
 * Character-level text. The whole string is exposed to assistive tech via
 * aria-label while the per-character spans are hidden from the a11y tree.
 */
export default function SplitText({ text, as: Tag = "span", className = "", trigger = "scroll", delay = 0, stagger = 0.025, start = "top 88%" }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (trigger !== "scroll") return;
    const el = ref.current;
    if (!el) return;
    setupGsap();
    const reduced = isReducedMotion();
    if (reduced) return;
    const ctx = gsap.context(() => {
      const chars = el.querySelectorAll(".split-char");
      gsap.fromTo(
        chars,
        { yPercent: 115, rotate: 6, opacity: 0 },
        {
          yPercent: 0,
          rotate: 0,
          opacity: 1,
          duration: 1.1,
          ease: "expo.out",
          stagger,
          delay,
          scrollTrigger: { trigger: el, start, once: true },
        },
      );
    }, el);
    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, [trigger, delay, stagger, start, text]);

  const words = text.split(" ");
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} aria-hidden className="split-word">
          {Array.from(w).map((c, ci) => (
            <span key={ci} className="split-char">
              {c}
            </span>
          ))}
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
