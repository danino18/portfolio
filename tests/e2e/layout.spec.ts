import { test, expect } from "@playwright/test";
import { expectHeadingsFit, expectNoHorizontalOverflow, isMobileProject, isolate, scrollThrough, watchErrors } from "./helpers";

const WIDTHS = [320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920, 2560];
const SLUGS = ["dart-cuda", "degree-planner", "controlled-maze-fpga", "physical-ai-robot-arm", "advanced-explorations"];

test.describe("responsive layout", () => {
  test.beforeEach(({}, info) => {
    test.skip(isMobileProject(info.project.name), "these tests set explicit viewports");
  });

  for (const w of WIDTHS) {
    test(`home at ${w}px: no overflow, headings fit, every section present`, async ({ page }) => {
      await isolate(page);
      const errors = watchErrors(page);
      await page.setViewportSize({ width: w, height: w < 600 ? 844 : w < 1100 ? 1024 : 900 });
      await page.goto("/");
      await expect(page.locator("h1")).toHaveAttribute("aria-label", "Eyal Danino");
      for (const id of ["top", "about", "work", ...SLUGS, "universe", "contact"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
      await scrollThrough(page);
      await expectNoHorizontalOverflow(page);
      await expectHeadingsFit(page);
      expect(errors).toEqual([]);
    });
  }

  for (const w of [320, 768, 1440]) {
    test(`case-study pages at ${w}px`, async ({ page }) => {
      await isolate(page);
      const errors = watchErrors(page);
      await page.setViewportSize({ width: w, height: 900 });
      for (const slug of SLUGS) {
        const res = await page.goto(`/projects/${slug}`);
        expect(res?.status()).toBe(200);
        await page.waitForTimeout(400);
        await expectNoHorizontalOverflow(page);
        await expectHeadingsFit(page);
      }
      expect(errors).toEqual([]);
    });
  }

  test("landscape phone (844×390) and live resizing", async ({ page }) => {
    await isolate(page);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(800);
    for (const [w, h] of [
      [390, 844],
      [844, 390],
      [1024, 768],
      [700, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(500);
      await expectNoHorizontalOverflow(page);
      await expectHeadingsFit(page);
    }
    await scrollThrough(page);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
});
