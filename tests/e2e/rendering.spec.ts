import { test, expect } from "@playwright/test";
import { brightFraction, disableWebGL, isolate, scrollThrough, watchErrors } from "./helpers";

test.describe("rendering & fallbacks", () => {
  test("hero: intro completes and the hero visual is not blank", async ({ page }) => {
    await isolate(page);
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: /skip intro/i })).toHaveCount(0, { timeout: 12_000 });
    const quality = await page.evaluate(() => document.documentElement.dataset.quality);
    const hero = page.locator("#top > div").first();
    if (quality !== "0") await expect(page.locator("#top [data-scene=webgl] canvas")).toHaveCount(1);
    await page.waitForTimeout(1200);
    expect(await brightFraction(page, hero)).toBeGreaterThan(0.004);
    expect(errors).toEqual([]);
  });

  test("without WebGL every scene shows an animated fallback, not an empty box", async ({ page }) => {
    await disableWebGL(page);
    await isolate(page);
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-quality", "0");
    // the intro must still finish (it used to wait for the WebGL loop forever)
    await expect(page.getByRole("button", { name: /skip intro/i })).toHaveCount(0, { timeout: 12_000 });
    await scrollThrough(page);
    const scenes = await page.locator("[data-scene]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.scene));
    expect(scenes.length).toBeGreaterThan(3);
    expect(scenes.every((s) => s === "fallback")).toBe(true);
    // the maze still plays on its 2D VGA screen and Wi-Fi sensing draws its 2D top view
    await page.locator("#controlled-maze-fpga").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(await brightFraction(page, page.locator("[aria-roledescription=game]"))).toBeGreaterThan(0.1);
    await page.locator("#advanced-explorations [role=tabpanel]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(await brightFraction(page, page.locator("#advanced-explorations [role=tabpanel]"))).toBeGreaterThan(0.01);
    expect(errors).toEqual([]);
  });

  test("reduced motion keeps content visible and ambient animation alive; visitor can opt in to full motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await isolate(page);
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.locator("h1 .split-char").first().evaluate((e) => getComputedStyle(e).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
    // CSS animations are no longer globally zeroed
    const dur = await page.locator("#top [style*=pulse-dot]").first().evaluate((e) => getComputedStyle(e).animationDuration);
    expect(parseFloat(dur)).toBeGreaterThan(0.5);
    await scrollThrough(page);
    expect(errors).toEqual([]);
    const toggle = page.getByRole("button", { name: /motion is reduced/i }).first();
    if (await toggle.isVisible()) {
      await Promise.all([page.waitForEvent("load"), toggle.click()]);
      await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    }
  });

  test("a lost WebGL context is recovered", async ({ page }) => {
    await isolate(page);
    const errors = watchErrors(page);
    await page.goto("/");
    const q = await page.evaluate(() => document.documentElement.dataset.quality);
    test.skip(q === "0", "no WebGL in this browser");
    await expect(page.locator("#top canvas")).toHaveCount(1, { timeout: 15_000 });
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("#top canvas")!;
      const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await page.waitForTimeout(2500);
    await expect(page.locator("#top [data-scene=webgl] canvas")).toHaveCount(1);
    expect(errors.filter((e) => !/context lost/i.test(e))).toEqual([]);
  });
});
