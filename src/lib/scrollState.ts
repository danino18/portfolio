/**
 * Mutable, non-reactive state shared between DOM scroll choreography and
 * WebGL render loops. Reading it in useFrame never triggers a React render.
 */
export const scrollState = {
  /** 0..1 over the whole page. */
  page: 0,
  /** 0..1 while the hero section scrolls out. */
  hero: 0,
  /** Normalised scroll velocity, roughly -1..1. */
  velocity: 0,
  /** Pointer in NDC (-1..1), y up. */
  pointer: { x: 0, y: 0, tx: 0, ty: 0 },
  /** 0..1 contact convergence progress. */
  contact: 0,
  /** Intro sequence progress 0..1 (hero particles assembling). */
  intro: 0,
  introSkip: false,
};
