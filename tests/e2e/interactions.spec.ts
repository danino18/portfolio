import { test, expect } from "@playwright/test";
import { isMobileProject, isolate, watchErrors } from "./helpers";

test("navigation: primary nav scrolls to sections; mobile menu covers the screen", async ({ page }, info) => {
  await isolate(page);
  const errors = watchErrors(page);
  await page.goto("/");
  await page.waitForTimeout(800);
  if (isMobileProject(info.project.name)) {
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /menu/i }).click();
    const menu = page.locator("#mobile-menu");
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box!.height, "menu must not be clipped to the header").toBeGreaterThan(vh * 0.6);
    await menu.getByRole("link", { name: /universe/i }).click();
    await expect(menu).toBeHidden();
  } else {
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Universe" }).click();
  }
  await expect.poll(async () => page.evaluate(() => Math.abs(document.getElementById("universe")!.getBoundingClientRect().top)), { timeout: 8000 }).toBeLessThan(120);
  expect(errors).toEqual([]);
});

test("Controlled Maze: the player steers the coral; the bird flies on its own", async ({ page }, info) => {
  await isolate(page);
  const errors = watchErrors(page);
  await page.goto("/projects/controlled-maze-fpga");
  const game = page.locator("[aria-roledescription=game]");
  await game.scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /autopilot on/i })).toBeVisible();
  await page.waitForTimeout(2500);
  if (isMobileProject(info.project.name)) {
    const up = page.getByRole("button", { name: /hold to move the openings up/i });
    const b = (await up.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  } else {
    await game.focus();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowUp");
  }
  await expect(page.getByRole("button", { name: /autopilot off/i })).toBeVisible();
  await expect(game.getByText(/READY|PLAY|HIT|GAME OVER/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("Wi-Fi Sensing is the future project, labeled conceptual; laundry and e-nose are gone", async ({ page }) => {
  await isolate(page);
  await page.goto("/");
  await expect(page.locator("#wifi-sensing")).toContainText(/future project/i);
  await expect(page.locator("#wifi-sensing").getByText(/conceptual visualization/i).first()).toBeVisible();
  await expect(page.getByText(/laundry|electronic nose|e-nose/i)).toHaveCount(0);
});

test("Case study navigation opens the project page without crashing", async ({ page }) => {
  await isolate(page);
  const errors = watchErrors(page);
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.locator("#dart-cuda").scrollIntoViewIfNeeded();
  await page.locator("#dart-cuda").getByRole("link", { name: /case study/i }).click();
  await expect(page).toHaveURL(/\/projects\/dart-cuda$/, { timeout: 10_000 });
  await expect(page.locator("h1#project-title")).toBeVisible();
  await page.getByRole("link", { name: /all work/i }).click();
  await expect(page).toHaveURL(/\/(#work)?$/, { timeout: 10_000 });
  await expect(page.locator("h1").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("The Reef: stages are selectable and sourced", async ({ page }) => {
  await isolate(page);
  await page.goto("/projects/navy-reef");
  const tabs = page.getByRole("tablist", { name: /program stages/i }).getByRole("tab");
  await expect(tabs).toHaveCount(5);
  await tabs.nth(3).click();
  await expect(page.locator("#reef-stage")).toContainText(/shark tank/i);
  await expect(page.getByText(/innovation officer in a technological unit/i).first()).toBeVisible();
});

test("Robotic arm: manual mode follows the pointer over the canvas", async ({ page }, info) => {
  test.skip(isMobileProject(info.project.name), "pointer hover");
  await isolate(page);
  const errors = watchErrors(page);
  await page.goto("/projects/physical-ai-robot-arm");
  const stage = page.locator("[data-cursor=Drag], [data-cursor=Move]").first();
  await stage.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /take manual control/i }).click();
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.waitForTimeout(1200);
  await expect(page.getByText(/manual control/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("robotic arm: real video embed is lazy, muted, inline, with a fallback link", async ({ page }) => {
  await isolate(page);
  const errors = watchErrors(page);
  await page.goto("/");
  const section = page.locator("#physical-ai-robot-arm");
  const facade = section.getByRole("link", { name: /play video/i });
  await expect(facade).toHaveAttribute("href", /youtube\.com\/shorts\/yq8GpWCdJY8/);
  await expect(section.locator("iframe")).toHaveCount(0);
  await section.scrollIntoViewIfNeeded();
  const iframe = section.locator("iframe");
  await expect(iframe).toHaveCount(1, { timeout: 10_000 });
  const src = (await iframe.getAttribute("src"))!;
  expect(src).toContain("youtube-nocookie.com/embed/yq8GpWCdJY8");
  expect(src).toContain("mute=1");
  expect(src).toContain("playsinline=1");
  await expect(section.getByRole("button", { name: /^(play|pause)$/i })).toBeVisible();
  expect(errors).toEqual([]);
});
