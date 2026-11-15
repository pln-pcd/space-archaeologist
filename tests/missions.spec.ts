// End-to-end: the v7.6 Moon mission in a real browser (Vite dev server on 5173).
//   mouse:    title, intro, name, explorer, ship, film, launch, story, all four finds (dig, parts,
//             activity, evidence quiz), Rock Box, badge, archive
//   keyboard: Tab + Enter (and number keys in the quiz) only, through onboarding and one full find
// Both runs assert: no console errors, no third-party requests, and no camera use.
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const moon = JSON.parse(readFileSync("apps/web/src/content/missions/moon-001.json", "utf8"));

test.use({
  viewport: { width: 1366, height: 768 },
  reducedMotion: "reduce",
  launchOptions: { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] },
});

async function setup(page: Page) {
  const errors: string[] = [], external: string[] = [];
  let cameraCalls = 0;
  await page.exposeFunction("__recordMissionCameraCall", () => void cameraCalls++);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 250)));
  page.on("request", (r) => /^https?:/.test(r.url()) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.url()) && external.push(r.url()));
  await page.addInitScript(() => {
    if (!localStorage.getItem("mission-qa-initialized")) {
      localStorage.clear();
      // preferences only: no profile, mission state or answers are injected
      localStorage.setItem("homeward-session-v1", JSON.stringify({ version: 2, state: { profile: null, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: false, novaVoice: false, askNova: false, aiNotice: true, talkMode: "chat", reducedMotion: true } } }));
      localStorage.setItem("mission-qa-initialized", "1");
    }
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => {
        await (window as unknown as { __recordMissionCameraCall: () => Promise<void> }).__recordMissionCameraCall();
        throw new Error("No camera in the desktop playthrough");
      };
  });
  return { errors, external, cameraCalls: () => cameraCalls };
}
const records = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("odyssey-missions-v5") ?? "{}")["moon-001"]?.records ?? []);
const step = (page: Page, n: number) => expect(page.locator(".m-runner")).toHaveAttribute("data-step", String(n).padStart(2, "0"), { timeout: 20_000 });

test("Mission 001 completes using the mouse", async ({ page }) => {
  test.setTimeout(600_000);
  const out = "docs/audit/v76/playthrough-mouse";
  mkdirSync(out, { recursive: true });
  const s = await setup(page);
  const click = async (name: string | RegExp) => {
    const l = page.getByRole("button", { name, exact: typeof name === "string" }).first();
    await expect(l).toBeVisible({ timeout: 45_000 });
    await l.click({ force: true });
  };
  const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
  await page.goto("/");
  await click("Start the game");
  for (let i = 0; i < 3; i++) await click("Next");
  await click("Let's go!");
  await page.locator("input").first().fill("Luna");
  await click("Let's go!");
  await click("I'm ready!");
  await shot("01-ship");
  await click("Mission 1: Moon");
  await click("Let's go!");
  await step(page, 4);
  await click("Skip the video");
  await click("Skip");
  await click("Skip the story");
  await step(page, 5);
  await click(/Skip briefing/);
  let firstDig = true, firstQuiz = true;
  for (let n = 0; n < 4; n++) {
    // walk to the next beacon until an unfinished find is close enough to investigate
    let target: Locator | null = null;
    for (let tries = 0; tries < 10 && !target; tries++) {
      const done = await records(page);
      for (const a of moon.artifacts) {
        const l = page.locator(`[aria-label="Investigate ${a.id}"]`);
        if (!done.includes(a.id) && (await l.count()) && (await l.first().isVisible())) target = l.first();
      }
      if (!target) {
        await click("Walk to the next beacon");
        await page.waitForTimeout(3500);
      }
    }
    expect(target, "a find within reach").not.toBeNull();
    await target!.click({ force: true });
    await step(page, 6);
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("odyssey-missions-v5")!)["moon-001"].artifactId);
    const art = moon.artifacts.find((a: { id: string }) => a.id === id);
    if (firstDig) await click("Start digging!"), (firstDig = false);
    // brush the dust off the stage
    const box = (await page.locator(".iv3-stage").boundingBox())!;
    for (let pass = 0; pass < 6 && !(await page.locator('[aria-label="Inspect clue 1"]').count()); pass++) {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      for (let k = 0; k < 12; k++) await page.mouse.move(box.x + (k % 2 ? box.width - 20 : 20), box.y + 20 + (k * (box.height - 40)) / 11, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    for (let i = 1; i <= art.cluesRequired; i++) {
      await click(`Inspect clue ${i}`);
      await expect(page.locator(".iv3-part h2")).toBeVisible();
    }
    if (n === 0) await shot("02-parts");
    if (art.activity === "laser") for (let i = 0; i < 3; i++) (await click("Send laser ping"), await page.waitForTimeout(2800));
    else await click(art.activity === "seismic" ? "Tap the ground" : art.activity === "message" ? "Preserve the message" : "Try a soft touchdown");
    await page.locator('[aria-label="Evidence board"]').click();
    await step(page, 7);
    if (firstQuiz) await click("Start the quiz"), (firstQuiz = false);
    for (let q = 0; q < 3; q++) {
      await expect(page.locator(".qz-choice").first()).toBeVisible();
      if (n === 0 && q === 0) await shot("03-quiz");
      for (let c = 0; c < 4 && !(await page.locator(".qz-choice.right").count()); c++) {
        const b = page.locator(".qz-choice").nth(c);
        if (await b.isEnabled()) await b.click();
        await page.waitForTimeout(250);
      }
      await expect(page.locator(".qz-choice.right")).toHaveCount(1);
      await page.waitForTimeout(1500);
    }
    await click("Save it!");
    await step(page, 5);
  }
  expect(await records(page)).toHaveLength(4);
  // the Rock Box: 90 seconds of Moonwalk, then the laser finale (hold the pointer on the reflector)
  await click("Play Fill the Rock Box");
  await click("Let's play!");
  const reflector = page.locator(".rb-reflector");
  await expect(reflector).toBeVisible({ timeout: 110_000 });
  const rb = (await reflector.boundingBox())!;
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(rb.x + rb.width / 2 + (i % 2), rb.y + rb.height / 2);
    await page.waitForTimeout(80);
  }
  await expect(page.getByRole("button", { name: "Go get your badge", exact: true })).toBeVisible({ timeout: 30_000 });
  await click("Go get your badge");
  await step(page, 11);
  await click("Stamp my archaeology passport");
  await step(page, 12);
  await shot("04-archive");
  for (const a of moon.artifacts) await expect(page.getByRole("button", { name: `Open archive ${a.id}`, exact: true })).toBeEnabled();
  writeFileSync(`${out}/result.json`, JSON.stringify({ errors: s.errors, external: s.external, cameraCalls: s.cameraCalls() }, null, 2));
  expect(s.errors).toEqual([]);
  expect(s.external).toEqual([]);
  expect(s.cameraCalls()).toBe(0);
});

test("Onboarding and one full find using only the keyboard", async ({ page }) => {
  test.setTimeout(300_000);
  const s = await setup(page);
  const activate = async (target: Locator) => {
    await expect(target).toBeVisible({ timeout: 45_000 });
    for (let n = 0; n < 200; n++) {
      if (await target.evaluate((el) => el === document.activeElement)) return page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
    }
    throw new Error(`Keyboard could not reach ${await target.getAttribute("aria-label")}`);
  };
  const button = (name: string) => activate(page.getByRole("button", { name, exact: true }).first());
  await page.goto("/");
  await button("Start the game");
  // the intro tour (Enter can also advance it, so its steps are optional here)
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4 && !(await page.locator("input").count()); i++) {
    const next = page.getByRole("button", { name: /^(Next|Let's go!)$/ }).first();
    if (await next.count()) await activate(next);
    await page.waitForTimeout(800);
  }
  await page.locator("input").first().focus();
  await page.keyboard.type("Luna");
  await button("Let's go!");
  await button("I'm ready!");
  await button("Mission 1: Moon");
  await button("Let's go!");
  await step(page, 4);
  await button("Skip the video");
  await button("Skip");
  await button("Skip the story");
  await step(page, 5);
  await activate(page.getByRole("button", { name: /Skip briefing/ }).first());
  await button("Walk to the next beacon");
  await page.waitForTimeout(3500);
  const inv = page.locator('[aria-label^="Investigate "]').first();
  await activate(inv);
  await step(page, 6);
  await button("Start digging!");
  // hold Space to blow the dust away (nothing focused, so Space is the blow key)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 8 && !(await page.locator('[aria-label="Inspect clue 1"]').count()); i++) {
    await page.keyboard.down(" ");
    await page.waitForTimeout(1600);
    await page.keyboard.up(" ");
    await page.waitForTimeout(300);
  }
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem("odyssey-missions-v5")!)["moon-001"].artifactId);
  const art = moon.artifacts.find((a: { id: string }) => a.id === id);
  for (let i = 1; i <= art.cluesRequired; i++) await button(`Inspect clue ${i}`);
  if (art.activity === "laser") for (let i = 0; i < 3; i++) (await button("Send laser ping"), await page.waitForTimeout(2800));
  else await button(art.activity === "seismic" ? "Tap the ground" : art.activity === "message" ? "Preserve the message" : "Try a soft touchdown");
  await activate(page.locator('[aria-label="Evidence board"]'));
  await step(page, 7);
  await button("Start the quiz");
  for (let q = 0; q < 3; q++) {
    await expect(page.locator(".qz-choice").first()).toBeVisible();
    // number keys 1 to 4 answer A to D
    for (let k = 1; k <= 4 && !(await page.locator(".qz-choice.right").count()); k++) {
      await page.keyboard.press(String(k));
      await page.waitForTimeout(250);
    }
    await expect(page.locator(".qz-choice.right")).toHaveCount(1);
    await page.waitForTimeout(1500);
  }
  await button("Save it!");
  await step(page, 5);
  expect(await records(page)).toEqual([id]);
  expect(s.errors).toEqual([]);
  expect(s.external).toEqual([]);
  expect(s.cameraCalls()).toBe(0);
});
