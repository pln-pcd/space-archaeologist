// Local check (not a test): screenshots of the new flow (cover → name → dashboard → missions).
// Usage: node tools/od_shot.mjs <out.png> [query] [waitMs] [w] [h] [profile=none|new|greeted|done] [--touch] [--reduced] [--click=selector] [--script=js]
// Example: node tools/od_shot.mjs docs/audit/new-flow/cover.png "" 4500 1280 720 none
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=") || true]; }));
const [out, query = "", wait = "6000", w = "1280", h = "720", prof = "greeted"] = args;
mkdirSync(dirname(out), { recursive: true });
const progress = prof === "done" ? { completed: ["eagle", "opportunity"], pages: {}, scores: { eagle: 3, opportunity: 2 }, choices: {}, chapter: 1 } : { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 };
const profile = prof === "none" ? null : { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: prof !== "new" };
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!flags.touch, isMobile: !!flags.touch, reducedMotion: flags.reduced ? "reduce" : "no-preference" });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate(({ profile, progress, reduced, voice, notice }) => {
  localStorage.clear();
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress, settings: { sound: true, novaVoice: !!voice, aiNotice: notice ? false : true, reducedMotion: !!reduced } }, version: 2 }));
  localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
}, { profile, progress, reduced: !!flags.reduced, voice: !!flags.voice, notice: !!flags.notice });
await p.goto("http://127.0.0.1:5173/" + query);
await p.waitForTimeout(+wait);
if (flags.click) {
  for (const sel of String(flags.click).split("|")) {
    await p.locator(sel).first().click({ timeout: 8000 }).catch((e) => errors.push("click " + sel + ": " + e.message.split("\n")[0]));
    await p.waitForTimeout(+(flags.after ?? 1500));
  }
}
if (flags.script) await p.evaluate(String(flags.script)).catch((e) => errors.push("script: " + e.message));
if (flags.after2) await p.waitForTimeout(+flags.after2);
await p.screenshot({ path: out });
const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round((n * 1000) / (performance.now() - t0))); }; requestAnimationFrame(f); }));
console.log(JSON.stringify({ out, fps, errors: errors.slice(0, 8) }));
await b.close();
