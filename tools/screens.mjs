// Local check (not a test): one screenshot of EVERY screen at the three review sizes, for before/after
// comparison. Usage:
//   node tools/screens.mjs <outDir> [--only=cover,dashboard] [--sizes=laptop,desktop,mobile] [--overlap]
// Sizes: laptop 1366x768, desktop 1920x1080, mobile 390x844 (touch). With --overlap each shot also runs
// the overlap check from tools/overlap_lib.mjs and writes overlaps.json.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { findOverlaps } from "./overlap_lib.mjs";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) ?? "docs/audit/v46/shots";
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const only = flag("only")?.split(",");
const SIZES = { laptop: [1366, 768, false], desktop: [1920, 1080, false], mobile: [390, 844, true] };
// phone (390x844) is opt-in only: the user asked to stop fixing the phone view
const sizes = (flag("sizes")?.split(",") ?? ["laptop", "desktop"]).filter((s) => SIZES[s]);
const overlap = args.includes("--overlap");
const BASE = "http://127.0.0.1:5173/";

const greeted = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
const fresh = { ...greeted, greeted: false };
const prog = { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 };
const seed = (profile, extra = {}) => ({ profile, progress: prog, settings: { sound: false, novaVoice: false, aiNotice: true, talkMode: "chat", tutorialDone: true, ...extra } });

const flow = (f, scene, result) => `(() => { const s = window.${f}.getState(); ${result ? `s.set({ result: ${JSON.stringify(result)}, camera: false });` : ""} s.go(${JSON.stringify(scene)}); })()`;
/** name → { q: query, st: saved state, wait, click?: [selectors], script?: js } */
const SCREENS = {
  cover: { q: "", st: seed(null), wait: 5000 },
  name: { q: "?screen=name", st: seed(null), wait: 2500 },
  "dash-first": { q: "?screen=dashboard", st: { ...seed(fresh, { talkMode: null, tutorialDone: false }) }, wait: 3500 },
  "dash-choice": { q: "?screen=dashboard", st: { ...seed(fresh, { talkMode: null, tutorialDone: false }) }, wait: 8000 },
  "dash-mic": { q: "?screen=dashboard", st: { ...seed(fresh, { talkMode: null, tutorialDone: false }) }, wait: 8000, click: [".ob-choice"], after: 1500 },
  "dash-tutorial": { q: "?screen=dashboard", st: seed(fresh, { talkMode: "chat", tutorialDone: false }), wait: 4500 },
  dashboard: { q: "?screen=dashboard", st: seed(greeted), wait: 6000 },
  confirm: { q: "?screen=dashboard", st: seed(greeted), wait: 4500, click: ['button[aria-label^="Mission 1"]'] },
  chat: { q: "?screen=dashboard", st: seed(greeted), wait: 4000, click: [".od-ask"], after: 3000 },
  "chat-voice": { q: "?screen=dashboard", st: seed(greeted, { talkMode: "voice" }), wait: 4000, click: [".od-ask"], after: 3000 },
  "dash-tut-3": { q: "?screen=dashboard", st: seed(fresh, { talkMode: "chat", tutorialDone: false }), wait: 4500, click: [".tut-controls .k-btn.primary", ".tut-controls .k-btn.primary"], after: 1200 },
  settings: { q: "?screen=dashboard", st: seed(greeted), wait: 3000, click: [".od-gear"] },
  "m1-video": { q: "?chapter=1&scene=A", st: seed(greeted), wait: 7000 },
  "m1-video-turn": { q: "?chapter=1&scene=A", st: seed(greeted), wait: 4000, click: ['button[aria-label="Skip the video"]'], after: 1800 },
  "m1-launch": { q: "?chapter=1&scene=B", st: seed(greeted), wait: 6000 },
  "m1-story": { q: "?chapter=1&scene=E", st: seed(greeted), wait: 8000 },
  "m1-checkin": { q: "?chapter=1&scene=F", st: seed(greeted), wait: 6000 },
  "m1-camera": { q: "?chapter=1&scene=G", st: seed(greeted), wait: 4000 },
  "m1-game": { q: "?chapter=1&scene=G", st: seed(greeted), wait: 3500, script: flow("__ch1Flow", "G_MINIGAME"), after: 5000 },
  "m1-results": { q: "?chapter=1&scene=G", st: seed(greeted), wait: 3000, script: flow("__ch1Flow", "RESULTS", { kg: 21.5, stars: 3, mode: "mouse" }), after: 3000 },
  "m1-stamp": { q: "?chapter=1&scene=G", st: seed(greeted), wait: 3000, script: flow("__ch1Flow", "STAMP"), after: 3000 },
  "m2-video": { q: "?chapter=2&scene=A", st: seed(greeted), wait: 7000 },
  "m2-launch": { q: "?chapter=2&scene=B", st: seed(greeted), wait: 6000 },
  "m2-story": { q: "?chapter=2&scene=E", st: seed(greeted), wait: 8000 },
  "m2-checkin": { q: "?chapter=2&scene=F", st: seed(greeted), wait: 6000 },
  "m2-game": { q: "?chapter=2&scene=G", st: seed(greeted), wait: 3500, script: flow("__marsFlow", "G_MINIGAME"), after: 5000 },
  "m2-results": { q: "?chapter=2&scene=G", st: seed(greeted), wait: 3000, script: flow("__marsFlow", "RESULTS", { sols: 120, blueberries: 14, events: 3, stars: 2 }), after: 3000 },
};

const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
const report = {};
for (const size of sizes) {
  const [w, h, touch] = SIZES[size];
  mkdirSync(`${out}/${size}`, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  for (const [name, s] of Object.entries(SCREENS)) {
    if (only && !only.some((o) => name.startsWith(o))) continue;
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
    await p.addInitScript((st) => {
      if (sessionStorage.getItem("qa-seeded")) return;
      sessionStorage.setItem("qa-seeded", "1");
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
      localStorage.setItem("homeward-session-v1", JSON.stringify({ state: st, version: 2 }));
      localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
    }, s.st);
    try {
      await p.goto(BASE + s.q);
      await p.waitForTimeout(s.wait);
      for (const sel of s.click ?? []) {
        await p.locator(sel).first().click({ timeout: 8000 }).catch((e) => errors.push(`click ${sel}: ${e.message.split("\n")[0]}`));
        await p.waitForTimeout(s.after ?? 1500);
      }
      if (s.script) {
        await p.evaluate(s.script).catch((e) => errors.push("script: " + e.message.slice(0, 120)));
        await p.waitForTimeout(s.after ?? 2500);
      }
      await p.screenshot({ path: `${out}/${size}/${name}.png` });
      const r = { errors };
      if (overlap) r.overlaps = await p.evaluate(findOverlaps);
      report[`${size}/${name}`] = r;
      const o = r.overlaps?.length ?? "-";
      console.log(`${size}/${name}  errors=${errors.length}  overlaps=${o}`);
    } catch (e) {
      report[`${size}/${name}`] = { errors: [...errors, e.message.slice(0, 200)] };
      console.log(`${size}/${name}  FAILED ${e.message.slice(0, 120)}`);
    }
    await p.close();
  }
  await ctx.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
await b.close();
