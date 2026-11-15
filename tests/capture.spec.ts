// The video capture hook must be inert in normal play, and work only behind ?capture.
import { test, expect } from "@playwright/test";

test("normal play keeps native time, timers and animation frames", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForTimeout(1500);
  const probe = await page.evaluate(() => ({
    capture: "__capture" in window,
    now: performance.now.toString().includes("[native code]"),
    timeout: window.setTimeout.toString().includes("[native code]"),
    raf: window.requestAnimationFrame.toString().includes("[native code]"),
    classOn: document.documentElement.classList.contains("capture"),
  }));
  expect(probe).toEqual({ capture: false, now: true, timeout: true, raf: true, classOn: false });
  expect(errors).toEqual([]);
});

test("?capture steps virtual time exactly, frame by frame", async ({ page }) => {
  await page.goto("/?capture=1");
  await page.waitForFunction(() => "__capture" in window);
  const out = await page.evaluate(async () => {
    const c = (window as any).__capture;
    c.stepMode(true);
    const t0 = performance.now();
    let fired = 0;
    setTimeout(() => fired++, 50);
    await c.step(1000 / 30);
    const afterOne = fired;
    await c.step(1000 / 30);
    return { dt: performance.now() - t0, afterOne, afterTwo: fired };
  });
  expect(out.dt).toBeCloseTo(66.67, 1);
  expect(out.afterOne).toBe(0);
  expect(out.afterTwo).toBe(1);
});
