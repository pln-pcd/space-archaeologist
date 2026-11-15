// Local check: one still per story shot (seeked to 70 % of each shot) + a contact sheet.
// Usage: node tools/story_sheet.mjs <1|2> [w] [h] [--reduced]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const [ch = "1", w = "1280", h = "720"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reduced = process.argv.includes("--reduced");
const out = `docs/audit/new-flow/story-ch${ch}/${w}x${h}${reduced ? "-rm" : ""}`;
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h }, reducedMotion: reduced ? "reduce" : "no-preference" })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate((rm) => {
  localStorage.clear();
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: { nickname: "Comet", suit: "Commander", code: "q", mode: "device", playerName: "Comet", greeted: true }, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: false, reducedMotion: rm, aiNotice: true } }, version: 2 }));
}, reduced);
await p.goto(`http://127.0.0.1:5173/?chapter=${ch}&scene=E`);
await p.waitForFunction(() => window.__story, null, { timeout: 30000 });
await p.waitForTimeout(3000);
const shots = await p.evaluate(() => window.__story.shots);
const files = [];
for (const [i, s] of shots.entries()) {
  const t = s.start + (s.end - s.start) * 0.72;
  await p.evaluate((t) => window.__story.seek(t), t);
  await p.waitForTimeout(900);
  const f = `${out}/${String(i + 1).padStart(2, "0")}-${s.id}.png`;
  await p.screenshot({ path: f });
  files.push(f);
}
console.log(JSON.stringify({ out, shots: shots.length, errors: errors.slice(0, 5) }));
await b.close();
