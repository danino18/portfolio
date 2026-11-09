import { expect, type Locator, type Page } from "@playwright/test";

/** Third-party hosts are blocked in tests: results must not depend on the network. */
export async function isolate(page: Page) {
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com|vercel\.app|github\.com|linkedin\.com/, (r) => r.abort());
}

/** Collects uncaught exceptions and console errors (ignoring blocked third-party loads). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource|ERR_FAILED|ERR_TUNNEL|net::|blocked/i.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return errors;
}

export async function scrollThrough(page: Page, step = 0.8) {
  const h = await page.evaluate(() => window.innerHeight);
  let y = 0;
  for (let i = 0; i < 80; i++) {
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    if (y > max) break;
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(90);
    y += h * step;
  }
  await page.waitForTimeout(300);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(r.sw, "page must not scroll horizontally").toBeLessThanOrEqual(r.cw);
}

/** Every visible heading and display title fits its own box and the viewport. */
export async function expectHeadingsFit(page: Page) {
  const bad = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("h1, h2, h3, .fit-title, .section-title").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || el.closest(".sr-only") || el.classList.contains("sr-only")) return;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") return;
      // words are nowrap inline-blocks: measure the widest one
      let right = r.right;
      el.querySelectorAll<HTMLElement>(".split-word").forEach((w) => (right = Math.max(right, w.getBoundingClientRect().right)));
      if (el.scrollWidth > el.clientWidth + 2 || right > vw + 1) out.push(`${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)} (${Math.round(right)} > ${vw})`);
    });
    return out;
  });
  expect(bad, "headings must not be clipped or overflow").toEqual([]);
}

/** Fraction of non-dark pixels in an element's on-screen pixels (canvas-agnostic). */
export async function brightFraction(page: Page, target: Locator) {
  const buf = await target.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let total = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      total++;
      if (d[i] + d[i + 1] + d[i + 2] > 110) n++;
    }
    return n / total;
  }, buf.toString("base64"));
}

/** Makes WebGL unavailable before any page script runs. */
export async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => unknown };
    const orig = proto.getContext;
    proto.getContext = function (type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return orig.call(this, type, ...rest);
    };
  });
}

export const isMobileProject = (name: string) => /mobile|iphone/.test(name);
