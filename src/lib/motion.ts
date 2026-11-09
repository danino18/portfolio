/**
 * Motion preference. The OS setting `prefers-reduced-motion` is the default,
 * but a visitor can override it from the nav ("Motion: full / reduced"); the
 * choice is stored in localStorage and applied before first paint by an
 * inline script in the root layout (it sets `html[data-motion]`).
 *
 * "reduced" removes the vestibular triggers — smooth-scroll inertia, pinned
 * scroll scenes, zooms, parallax, flying letters and the route wipe — but it
 * does NOT freeze the site: WebGL scenes keep a slow ambient animation and
 * small CSS indicators keep pulsing. (Previously every animation was killed,
 * which is why the site looked "broken" on machines with Windows' "Animation
 * effects" switched off.)
 */
export type MotionPref = "system" | "full" | "reduced";

export const MOTION_KEY = "ed-motion";

/** Inline, dependency-free script executed in <head> before hydration. */
export const motionBootScript = `(function(){try{var d=document.documentElement,p=null;try{p=localStorage.getItem('${MOTION_KEY}')}catch(e){}var s=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;d.dataset.motion=(p==='reduced'||(p!=='full'&&s))?'reduced':'full';d.dataset.motionSystem=s?'reduced':'full';}catch(e){}})();`;

export function isReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.documentElement.dataset.motion;
  if (v === "reduced") return true;
  if (v === "full") return false;
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function systemPrefersReduced(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function getMotionPref(): MotionPref {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    return v === "full" || v === "reduced" ? v : "system";
  } catch {
    return "system";
  }
}

/**
 * Applies a new preference. Scroll choreography is built once on mount, so
 * the cleanest way to switch every system consistently is a reload.
 */
export function setMotionPref(p: MotionPref) {
  try {
    if (p === "system") localStorage.removeItem(MOTION_KEY);
    else localStorage.setItem(MOTION_KEY, p);
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
  const reduced = p === "reduced" || (p === "system" && systemPrefersReduced());
  document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  window.location.reload();
}
