import { test, expect } from "@playwright/test";
import { isolate } from "./helpers";

/** Verified destinations only (see `verified` in src/content/projects.ts). */
const EXPECTED: Record<string, string[]> = {
  "dart-cuda": [],
  "degree-planner": ["https://ee-planer.vercel.app"],
  "controlled-maze-fpga": ["https://github.com/danino18/basic_controled_mazed"],
  "physical-ai-robot-arm": ["https://github.com/danino18/physAI-arm-ex", "https://youtube.com/shorts/yq8GpWCdJY8"],
  "advanced-explorations": [],
};

test("project links on the home page are exactly the verified ones", async ({ page }) => {
  await isolate(page);
  await page.goto("/");
  for (const [slug, hrefs] of Object.entries(EXPECTED)) {
    const found = await page.locator(`#${slug} a[data-link-kind]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(found.sort(), slug).toEqual([...hrefs].sort());
  }
  await expect(page.locator("#degree-planner a[data-link-kind=live]")).toContainText(/visit live website/i);
  await expect(page.locator("#controlled-maze-fpga a[data-link-kind=github]")).toContainText(/view on github/i);
  await expect(page.locator("#physical-ai-robot-arm a[data-link-kind=github]")).toContainText(/view on github/i);
});

test("case-study pages carry the same links", async ({ page }) => {
  await isolate(page);
  for (const [slug, hrefs] of Object.entries(EXPECTED)) {
    await page.goto(`/projects/${slug}`);
    const found = new Set(await page.locator("main a[data-link-kind]").evaluateAll((as) => as.map((a) => a.getAttribute("href"))));
    expect([...found].sort(), slug).toEqual([...hrefs].sort());
  }
});

test("no placeholder or unsafe external links anywhere", async ({ page }) => {
  await isolate(page);
  for (const path of ["/", ...Object.keys(EXPECTED).map((s) => `/projects/${s}`)]) {
    await page.goto(path);
    const links = await page.locator("a[href]").evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute("href") ?? "", target: a.getAttribute("target"), rel: a.getAttribute("rel") ?? "" })),
    );
    for (const l of links) {
      expect(l.href, path).not.toMatch(/^(#|javascript:|)$/);
      expect(l.href, path).not.toMatch(/example\.com|placeholder|todo/i);
      if (/^https?:/.test(l.href)) {
        expect(l.href, path).toMatch(/^https:\/\//);
        expect(l.target, l.href).toBe("_blank");
        expect(l.rel, l.href).toContain("noopener");
      }
    }
  }
});

test("internal routes resolve", async ({ request }) => {
  for (const path of ["/", "/sitemap.xml", "/robots.txt", "/manifest.webmanifest", ...Object.keys(EXPECTED).map((s) => `/projects/${s}`)]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
  }
  expect((await request.get("/projects/does-not-exist")).status()).toBe(404);
});
