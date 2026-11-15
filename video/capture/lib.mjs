// Frame-exact footage recorder for the demo video (real gameplay from the current build).
// The game runs with ?capture=1 in stepped mode (apps/web/src/fx/capture.ts): every recorded
// frame advances the game by exactly 1/30 s of virtual time, then we screenshot it. So the footage
// is smooth even when rendering or screenshots are slow, and nothing is faked or re-timed.
// Each shot writes video/footage/<shot>.mp4 (H.264, 1920x1080, 30 fps) and <shot>.json with:
//   cursor: the mouse position per frame (the edit draws a big cursor from it; headless Chrome
//           has no visible pointer), clicks, marks (named moments) and the game's own events
//           (sounds and spoken lines) converted to frame numbers, so sound effects land exactly.
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
const require = createRequire(resolve("package.json"));
const { chromium } = require("@playwright/test");

export const W = 1920, H = 1080, FPS = 30, DT = 1000 / FPS;
export const BASE = process.env.GAME_URL || "http://127.0.0.1:5173";
export const FOOT = resolve("video/footage");
const FF = process.env.FFMPEG || "ffmpeg";

export async function launch({ inject = false, fakeAudio = null, fakeVideo = null } = {}) {
  const args = ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required", "--disable-features=CalculateNativeWinOcclusion"];
  if (fakeAudio || fakeVideo) args.push("--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream");
  if (fakeAudio) args.push(`--use-file-for-fake-audio-capture=${fakeAudio}`);
  if (fakeVideo) args.push(`--use-file-for-fake-video-capture=${fakeVideo}`);
  const browser = await chromium.launch({ channel: "chrome", headless: true, args });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, permissions: fakeAudio || fakeVideo ? ["microphone", "camera"] : [] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 240)));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 240)));
  return { browser, ctx, page, errors, inject };
}

/** Seed localStorage like a returning player (or a brand-new one when fresh=true). */
export async function seed(page, { fresh = false, settings = {}, input = {}, missions = null, progress = null } = {}) {
  await page.goto(`${BASE}/?capture=1`);
  await page.evaluate(({ fresh, settings, input, missions, progress }) => {
    localStorage.clear();
    const profile = fresh ? null : { nickname: "Luna", suit: "Commander", code: "device-video", mode: "device", playerName: "Luna", playerPatch: "LUNA", introDone: true, greeted: true, characterId: "maya" };
    localStorage.setItem("homeward-session-v1", JSON.stringify({ version: 2, state: { profile, progress: progress ?? { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, novaVoice: false, quality: "high", aiNotice: true, talkMode: "chat", tutorialDone: true, introSeen: !fresh, ...settings } } }));
    localStorage.setItem("odyssey-input-v1", JSON.stringify({ version: 0, state: { mode: "mouse", academyDone: true, consented: false, mirror: true, cameraPreview: true, ...input } }));
    if (!fresh) localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 3, skin: 3, hair: 0, helmet: 0, visor: 1, accessory: 0, hairColor: 0 }));
    if (missions) localStorage.setItem("odyssey-missions-v5", JSON.stringify(missions));
  }, { fresh, settings, input, missions, progress });
}

export async function open(page, query, waitMs = 6000) {
  await page.goto(`${BASE}/${query}${query.includes("?") ? "&" : "?"}capture=1`);
  await page.waitForFunction(() => "__capture" in window, null, { timeout: 30000 });
  await page.waitForTimeout(waitMs);
}

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export class Rec {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.dir = join(FOOT, "_frames", name);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.n = 0;
    this.cursor = [];
    this.clicks = [];
    this.marks = [];
    this.mouse = { x: W / 2, y: H / 2, down: false, visible: false };
  }
  async start() {
    await this.page.evaluate(() => window.__capture.stepMode(true));
    this.t0 = await this.page.evaluate(() => window.__capture.time());
    await this.page.evaluate(() => window.__capture.drain());
    await this.page.mouse.move(this.mouse.x, this.mouse.y);
    return this;
  }
  /** advance the game without recording (fast-forward), in virtual seconds */
  async ff(sec) {
    const n = Math.round((sec * 1000) / DT);
    for (let i = 0; i < n; i++) await this.page.evaluate((ms) => window.__capture.step(ms), DT);
    this.skipped = (this.skipped ?? 0) + n;
  }
  async frame() {
    const vt = await this.page.evaluate(async (ms) => {
      await window.__capture.step(ms);
      await window.__capture.settled();
      return window.__capture.time();
    }, DT);
    (this.vts ??= []).push(vt);
    const buf = await this.page.screenshot({ type: "jpeg", quality: 93 });
    writeFileSync(join(this.dir, String(this.n).padStart(5, "0") + ".jpg"), buf);
    this.cursor.push(this.mouse.visible ? [Math.round(this.mouse.x), Math.round(this.mouse.y), this.mouse.down ? 1 : 0] : null);
    this.n++;
  }
  /** record frames until a page condition (JS expression) is true, at most maxSec */
  async until(expr, maxSec = 20) {
    const n = Math.round(maxSec * FPS);
    for (let i = 0; i < n; i++) {
      if (await this.page.evaluate(expr).catch(() => false)) return true;
      await this.frame();
    }
    return false;
  }
  async hold(sec) {
    const n = Math.max(1, Math.round(sec * FPS));
    for (let i = 0; i < n; i++) await this.frame();
  }
  mark(label) {
    this.marks.push({ frame: this.n, label });
  }
  showCursor(on = true) {
    this.mouse.visible = on;
  }
  async moveTo(x, y, sec = 0.55) {
    this.mouse.visible = true;
    const a = { ...this.mouse };
    const n = Math.max(1, Math.round(sec * FPS));
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      this.mouse.x = a.x + (x - a.x) * k;
      this.mouse.y = a.y + (y - a.y) * k;
      await this.page.mouse.move(this.mouse.x, this.mouse.y);
      await this.frame();
    }
  }
  async click(x, y, { move = 0.55, after = 0.35 } = {}) {
    await this.moveTo(x, y, move);
    this.mouse.down = true;
    await this.page.mouse.down();
    await this.frame();
    await this.page.mouse.up();
    this.mouse.down = false;
    this.clicks.push({ frame: this.n - 1, x: Math.round(x), y: Math.round(y) });
    await this.hold(after);
  }
  async box(locator) {
    const l = typeof locator === "string" ? this.page.locator(locator).first() : locator.first();
    await l.waitFor({ state: "visible", timeout: 8000 });
    const b = await l.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
  }
  /** click a control by its accessible name (aria-label or text), moving the cursor there */
  async tap(name, opts = {}) {
    const p = this.page;
    let l = name instanceof RegExp ? p.getByRole("button", { name }) : p.locator(`[aria-label="${name}"]`);
    if (!(await l.count())) l = p.getByRole("button", { name, exact: typeof name === "string" });
    const b = await this.box(l);
    await this.click(b.x + (opts.dx ?? 0), b.y + (opts.dy ?? 0), opts);
  }
  async drag(points, sec) {
    await this.moveTo(points[0][0], points[0][1], 0.4);
    this.mouse.down = true;
    await this.page.mouse.down();
    const n = Math.max(2, Math.round(sec * FPS));
    // points spread evenly over the frames
    const seg = [];
    for (let i = 1; i < points.length; i++) seg.push(Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const total = seg.reduce((a, b) => a + b, 0) || 1;
    for (let f = 1; f <= n; f++) {
      let d = (total * f) / n, i = 0;
      while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
      const k = Math.min(1, d / (seg[i] || 1));
      this.mouse.x = points[i][0] + (points[i + 1][0] - points[i][0]) * k;
      this.mouse.y = points[i][1] + (points[i + 1][1] - points[i][1]) * k;
      await this.page.mouse.move(this.mouse.x, this.mouse.y);
      await this.frame();
    }
    await this.page.mouse.up();
    this.mouse.down = false;
  }
  async type(text, perChar = 0.09) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await this.hold(perChar);
    }
  }
  async key(k, holdSec = 0) {
    if (!holdSec) {
      await this.page.keyboard.press(k);
      await this.frame();
      return;
    }
    await this.page.keyboard.down(k);
    await this.hold(holdSec);
    await this.page.keyboard.up(k);
  }
  async finish(extra = {}) {
    const ev = await this.page.evaluate(() => window.__capture.drain());
    // each event lands on the first recorded frame at or after its virtual time (events inside a
    // fast-forwarded stretch land on the next recorded frame)
    const vts = this.vts ?? [];
    const at = (t) => {
      let lo = 0, hi = vts.length - 1;
      if (!vts.length || t > vts[hi]) return -1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (vts[mid] >= t - 0.01) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    };
    const events = ev.map((e) => ({ ...e, frame: at(e.t) })).filter((e) => e.frame >= 0);
    const out = join(FOOT, `${this.name}.mp4`);
    const r = spawnSync(FF, ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(this.dir, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("ffmpeg failed for " + this.name);
    writeFileSync(join(FOOT, `${this.name}.json`), JSON.stringify({ shot: this.name, fps: FPS, frames: this.n, seconds: +(this.n / FPS).toFixed(2), cursor: this.cursor, clicks: this.clicks, marks: this.marks, events, ...extra }, null, 0));
    if (!process.env.KEEP_FRAMES) rmSync(this.dir, { recursive: true, force: true });
    await this.page.evaluate(() => window.__capture.stepMode(false));
    console.log(`${this.name}: ${this.n} frames (${(this.n / FPS).toFixed(1)} s), ${events.length} events`);
    return out;
  }
}

export function frames() {
  return readdirSync(FOOT).filter((f) => f.endsWith(".mp4"));
}

/** Play every Moon find through the game's own mission commands (the same reducer the UI uses),
 *  so later shots start from a real, honestly earned state. Optionally finish the Rock Box too. */
export async function seedFinds(page, { fieldDone = false } = {}) {
  return page.evaluate(async (fieldDone) => {
    const { command, resetMissions, sessionFor } = await import("/src/missions/session.ts");
    const { MOON: m } = await import("/src/missions/registry.ts");
    sessionFor(m);
    resetMissions();
    const act = (c) => command(m, c);
    for (let i = 0; i < 4; i++) act({ type: "next" });
    for (const a of m.artifacts) {
      act({ type: "investigate", id: a.id });
      act({ type: "next" });
      act({ type: "scan", id: a.id });
      for (const c of a.components) act({ type: "clue", id: c.id });
      act({ type: "activity", id: a.id });
      act({ type: "next" });
      for (const card of a.evidence) act({ type: "match", card: card.id, slot: card.slot });
      for (const part of a.components.slice(0, 2)) act({ type: "match", card: "part:" + part.id, slot: "job:" + part.id });
      act({ type: "next" });
    }
    if (fieldDone) act({ type: "fieldDone" });
    return JSON.parse(localStorage.getItem("odyssey-missions-v5"))["moon-001"];
  }, fieldDone);
}

/** Real-time recording (CDP screencast) for the one shot that needs real time: a spoken question
 *  through the microphone. Frames are resampled to a constant 30 fps by timestamp. */
export async function realtime(page, name, actions, { tail = 2 } = {}) {
  const dir = join(FOOT, "_frames", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const got = [];
  cdp.on("Page.screencastFrame", async (f) => {
    got.push({ t: f.metadata.timestamp, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const marks = [];
  const mark = (label) => marks.push({ t: Date.now() / 1000 - t0, label });
  await actions(mark);
  await new Promise((r) => setTimeout(r, tail * 1000));
  await cdp.send("Page.stopScreencast");
  const start = got[0].t;
  const end = got[got.length - 1].t;
  let n = 0, j = 0;
  for (let t = start; t <= end; t += 1 / FPS) {
    while (j + 1 < got.length && got[j + 1].t <= t) j++;
    writeFileSync(join(dir, String(n++).padStart(5, "0") + ".jpg"), Buffer.from(got[j].data, "base64"));
  }
  const out = join(FOOT, `${name}.mp4`);
  spawnSync(FF, ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(dir, "%05d.jpg"), "-vf", `scale=${W}:${H}`, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", out], { stdio: "inherit" });
  writeFileSync(join(FOOT, `${name}.json`), JSON.stringify({ shot: name, fps: FPS, frames: n, seconds: +(n / FPS).toFixed(2), realtime: true, sourceFrames: got.length, offset: +(start - t0).toFixed(3), marks: marks.map((m) => ({ frame: Math.max(0, Math.round((m.t - (start - t0)) * FPS)), label: m.label })) }));
  if (!process.env.KEEP_FRAMES) rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${n} frames from ${got.length} screencast frames`);
}
