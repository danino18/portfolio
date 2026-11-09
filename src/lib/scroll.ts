"use client";

import type Lenis from "lenis";

let lenisRef: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  lenisRef = l;
};
export const getLenis = () => lenisRef;

/** Smooth-scrolls to a section id, falling back to native scrolling without Lenis. */
export function scrollToId(id: string, opts?: { immediate?: boolean }) {
  const target = id === "top" ? 0 : document.getElementById(id);
  if (target === null) return;
  const l = lenisRef;
  if (l) {
    l.scrollTo(target as HTMLElement | number, { duration: opts?.immediate ? 0 : 1.6, immediate: opts?.immediate, offset: 0 });
  } else {
    const top = target === 0 ? 0 : (target as HTMLElement).getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: opts?.immediate ? "auto" : "smooth" });
  }
}

export function scrollToTopInstant() {
  if (lenisRef) lenisRef.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}
