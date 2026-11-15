// Local check (not a test): Chapter 1 rebuild stills and a mouse play-through.
// Usage: node tools/ch1_qa.mjs [book,A,B,C,D,E,F,G,all] [w] [h] [--capture]
// Writes docs/audit/ch1/stills/<w>x<h>/*.png and docs/audit/ch1/qa.json (errors, camera guard, fps).
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const want = new Set((process.argv[2] || "all").split(","));
const W = +(process.argv[3] || 1280),
  H = +(process.argv[4] || 720);
const CAP = process.argv.includes("--capture");
// --touch: a touch-only phone context (taps and finger drags through Chrome's touch events)
const TOUCH = process.argv.includes("--touch");
const OUT = `docs/audit/ch1/stills/${W}x${H}${TOUCH ? "-touch" : ""}`;
mkdirSync(OUT, { recursive: true });
const all = want.has("all");
const report = { errors: [], cameraGuard: {}, fps: {}, notes: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });

async function open(scene, extra = "") {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: TOUCH, isMobile: TOUCH });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => report.errors.push(`${scene}: ${e.message.slice(0, 160)}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && report.errors.push(`${scene}: ${m.text().slice(0, 160)}`));
  await p.goto("http://127.0.0.1:5173/?inject=1");
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: { nickname: "Comet Otter", suit: "Scout", code: "qa", mode: "device" }, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false } }, version: 0 }));
    localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
  });
  const q = `?chapter=1${scene ? `&scene=${scene}` : ""}${CAP ? "&capture=1" : ""}${extra}`;
  await p.goto("http://127.0.0.1:5173/" + q);
  await p.locator(".ch1-player").waitFor({ timeout: 30000 });
  return { ctx, p };
}
const press = (loc) => (TOUCH ? loc.tap() : loc.click());
async function drag(p, a, b) {
  if (!TOUCH) {
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(b.x, b.y, { steps: 6 });
    await p.mouse.up();
    return;
  }
  const cdp = p.__cdp ?? (p.__cdp = await p.context().newCDPSession(p));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 6, y: a.y + ((b.y - a.y) * i) / 6 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const fps = (p, ms = 2500) => p.evaluate((ms) => new Promise((res) => { const t = []; const f = (n) => (t.push(n), n - t[0] < ms ? requestAnimationFrame(f) : res(+((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1))); requestAnimationFrame(f); }), ms);
const guard = (p, name) => p.evaluate(() => window.__cameraGuard ?? 0).then((n) => (report.cameraGuard[name] = n));
const wait = (p, ms) => p.waitForTimeout(ms);

// the ship and the Chapter 2 Story Portal: the camera must stay off (bible §5.2)
if (all || want.has("ship")) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => report.errors.push(`ship: ${e.message.slice(0, 160)}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && !m.text().includes("/api") && report.errors.push(`ship: ${m.text().slice(0, 160)}`));
  await p.goto("http://127.0.0.1:5173/");
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: { nickname: "Comet Otter", suit: "Scout", code: "qa", mode: "device" }, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false } }, version: 0 }));
    localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
  });
  await p.goto("http://127.0.0.1:5173/");
  await wait(p, 9000);
  await shot(p, "90-ship");
  report.notes.push("ship prompts: " + (await p.evaluate(() => [...document.querySelectorAll(".action-prompt, .ap")].map((e) => e.textContent?.trim()).join(" | "))));
  await guard(p, "ship");
  await p.goto("http://127.0.0.1:5173/?chapter=2&beat=0&portal=1");
  await wait(p, 6000);
  await shot(p, "91-portal-ch2");
  report.notes.push("portal text: " + (await p.evaluate(() => document.body.innerText.match(/Open the book.{0,40}/)?.[0] ?? "")));
  await guard(p, "portal");
  await ctx.close();
}
if (all || want.has("book")) {
  const { ctx, p } = await open("");
  await wait(p, 2500);
  await shot(p, "00-book");
  await guard(p, "book");
  await ctx.close();
}
if (all || want.has("A")) {
  const { ctx, p } = await open("A");
  await wait(p, 6000);
  await shot(p, "01-video-player");
  await press(p.locator(".ch1-video-btns .wide"));
  await wait(p, 1500);
  await shot(p, "02-video-end-nova");
  await guard(p, "A");
  await ctx.close();
}
if (all || want.has("B")) {
  const { ctx, p } = await open("B");
  await wait(p, 4500);
  await shot(p, "10-launch-count");
  await wait(p, 2500);
  await shot(p, "11-launch-T9-lever");
  report.fps.launch = await fps(p);
  if (TOUCH) await press(p.locator(".lever-btn"));
  else await p.keyboard.press("Space");
  await wait(p, 4000);
  await shot(p, "12-launch-ignition");
  await wait(p, 6000);
  await shot(p, "13-launch-liftoff-prompt");
  if (TOUCH) await press(p.locator(".lever-btn"));
  else await p.keyboard.press("Space");
  await wait(p, 3500);
  await shot(p, "14-launch-climb");
  await wait(p, 4500);
  await shot(p, "15-launch-stage-sep");
  await wait(p, 4000);
  await shot(p, "16-launch-space");
  await guard(p, "B");
  await ctx.close();
}
if (all || want.has("C")) {
  const { ctx, p } = await open("C");
  for (const [ms, n] of [[5000, "20-trip"], [10000, "21-orbit-separation"], [10000, "22-descent"], [7000, "23-landing-dust"], [5000, "24-eagle-has-landed"], [5000, "25-date-card"]]) {
    await wait(p, ms);
    await shot(p, n);
  }
  report.fps.landing = await fps(p);
  await guard(p, "C");
  await ctx.close();
}
if (all || want.has("D")) {
  const { ctx, p } = await open("D");
  for (const [ms, n] of [[3500, "30-hatch"], [5500, "31-ladder"], [7000, "32-small-step"], [7200, "33-boot-print"], [4500, "34-aldrin"], [5000, "35-rise"]]) {
    await wait(p, ms);
    await shot(p, n);
  }
  report.fps.steps = await fps(p);
  await guard(p, "D");
  await ctx.close();
}
if (all || want.has("E")) {
  const { ctx, p } = await open("E");
  let last = "";
  for (let i = 0; i < 46; i++) {
    await wait(p, 3500);
    const cap = await p.evaluate(() => document.querySelector(".ch1-caption .dlg-text")?.textContent?.slice(0, 24) ?? "");
    if (cap && cap !== last) {
      last = cap;
      await shot(p, `4${String(i).padStart(2, "0")}-story`);
    }
    if (await p.evaluate(() => document.querySelector(".ch1-player")?.getAttribute("data-scene") !== "E_STORY")) break;
  }
  report.fps.story = await fps(p);
  await guard(p, "E");
  await ctx.close();
}
// single story lines: E:e12,e16 (deep link &line=), one still 3.5 s and one 7 s into the shot
for (const w of want) {
  if (!w.startsWith("E:")) continue;
  for (const id of w.slice(2).split("+")) {
    const { ctx, p } = await open("E", `&line=${id}`);
    await wait(p, 3500);
    await shot(p, `4L-${id}-a`);
    await wait(p, 3500);
    await shot(p, `4L-${id}-b`);
    await ctx.close();
  }
}
if (all || want.has("F")) {
  const { ctx, p } = await open("F");
  await wait(p, 5000);
  await shot(p, "50-summary");
  await press(p.locator(".ch1-summary .chunky", { hasText: "Skip" })).catch(() => {});
  await wait(p, 2500);
  await shot(p, "51-ask");
  await guard(p, "F");
  await ctx.close();
}
if (all || want.has("G")) {
  const { ctx, p } = await open("G");
  await wait(p, 2500);
  await shot(p, "60-camera-check");
  await press(p.locator(".ch1-camcheck .chunky", { hasText: "mouse or touch" }));
  await p.locator(".rockbox").waitFor({ timeout: 15000 });
  // play with the mouse: grab the nearest sample and drop it in the box, again and again
  const playFor = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const t = await p.evaluate(() => {
        const r = window.__rockbox;
        if (!r) return null;
        const g = r.game();
        const o = g.objs.find((o) => !o.gone && !o.held && o.y < innerHeight - 80 && o.y > 120 && o.vy > -60);
        const box = r.box(), bin = r.bin();
        return o ? { x: o.x, y: o.y, earth: ["leaf", "rain", "shell"].includes(o.kind), box: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, bin: { x: bin.x + bin.w / 2, y: bin.y + bin.h / 2 } } : null;
      });
      if (t) await drag(p, { x: t.x, y: t.y }, t.earth ? t.bin : t.box);
      await wait(p, 250);
    }
  };
  await playFor(5000);
  await shot(p, "61-minigame-5s");
  report.fps.minigame = await fps(p);
  await playFor(33000);
  await shot(p, "62-minigame-40s");
  await playFor(43000);
  await shot(p, "63-minigame-85s");
  await p.locator(".rb-finale").waitFor({ timeout: 90000 });
  await wait(p, 1500);
  await shot(p, "64-laser-ping-aim");
  const c = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight * 0.55 }));
  if (TOUCH) {
    const cdp = p.__cdp ?? (p.__cdp = await p.context().newCDPSession(p));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] });
    for (let i = 0; i < 8; i++) {
      await wait(p, 200);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c.x + (i % 2), y: c.y }] });
    }
    await wait(p, 1800);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await p.mouse.move(c.x, c.y);
    await wait(p, 1200);
    await p.mouse.move(c.x + 2, c.y + 1);
  }
  await wait(p, 3500);
  await shot(p, "65-laser-ping-card");
  await p.locator(".ch1-results").waitFor({ timeout: 20000 });
  await wait(p, 1500);
  await shot(p, "66-results");
  report.notes.push(await p.evaluate(() => document.querySelector(".ch1-results h2")?.textContent));
  await press(p.locator(".ch1-results .chunky", { hasText: "Stamp my passport" }));
  await wait(p, 2500);
  await shot(p, "67-stamp");
  await press(p.locator(".ch1-stamp-pad"));
  await wait(p, 1000);
  await shot(p, "68-stamped");
  await wait(p, 4000);
  report.notes.push(await p.evaluate(() => JSON.parse(localStorage.getItem("homeward-session-v1")).state.progress.completed));
  await guard(p, "G");
  await ctx.close();
}
// motion contact sheets: frames every ~180 ms, tiled with ffmpeg into docs/audit/ch1/sheets/
if (want.has("sheets")) {
  const { execFileSync } = await import("node:child_process");
  const FF = `${process.env.LOCALAPPDATA}/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe`;
  const SD = "docs/audit/ch1/sheets";
  mkdirSync(`${SD}/frames`, { recursive: true });
  const grab = async (p, name, n, gap = 180) => {
    for (let i = 0; i < n; i++) {
      await p.screenshot({ path: `${SD}/frames/${name}-${String(i).padStart(2, "0")}.png` });
      await wait(p, gap);
    }
    execFileSync(FF, ["-v", "error", "-y", "-framerate", "1", "-i", `${SD}/frames/${name}-%02d.png`, "-vf", "scale=320:180,tile=4x" + Math.ceil(n / 4), "-frames:v", "1", `${SD}/${name}.png`]);
  };
  {
    const { ctx, p } = await open("");
    await wait(p, 2000);
    await press(p.locator(".ch1-book .chunky"));
    await grab(p, "swirl-book-to-video", 12, 120);
    await ctx.close();
  }
  {
    const { ctx, p } = await open("B");
    await wait(p, 7000);
    await p.keyboard.press("Space");
    await grab(p, "lever-pull-ignition", 16, 220);
    await wait(p, 4500);
    await p.keyboard.press("Space");
    await grab(p, "liftoff-climb", 16, 400);
    await ctx.close();
  }
  {
    const { ctx, p } = await open("C");
    await wait(p, 26500);
    await grab(p, "landing-touchdown", 16, 250);
    await ctx.close();
  }
  {
    const { ctx, p } = await open("D");
    await wait(p, 4500);
    await grab(p, "ladder-climb-down", 16, 400);
    await ctx.close();
  }
}
let prev = {};
try {
  prev = JSON.parse(readFileSync("docs/audit/ch1/qa.json", "utf8"));
} catch {}
writeFileSync("docs/audit/ch1/qa.json", JSON.stringify({ ...prev, [`${W}x${H}${TOUCH ? "-touch" : ""}`]: report }, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 2500));
await browser.close();
