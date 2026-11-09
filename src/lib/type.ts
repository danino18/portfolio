import type { CSSProperties } from "react";

/** Length of the longest word (what limits how large a non-wrapping display line can be). */
export function longestWord(text: string | readonly string[]): number {
  const all = Array.isArray(text) ? text.join(" ") : (text as string);
  return Math.max(4, ...all.split(/\s+/).map((w) => w.length));
}

/**
 * CSS variables for `.fit-title`: the heading uses `fs` (a clamp()) but never
 * grows past the width its longest word can occupy in its container.
 */
export function fitVars(text: string | readonly string[], fs: string, k?: number): CSSProperties {
  const v: Record<string, string | number> = { "--chars": longestWord(text), "--fs": fs };
  if (k) v["--fit-k"] = k;
  return v as CSSProperties;
}
