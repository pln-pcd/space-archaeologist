// Time from "Send" to Nova's first audible word, for 10 questions (Ask Nova on the dashboard).
// node tools/latency.mjs [w] [h] [--touch]  → docs/audit/new-flow/latency-<w>x<h>.json
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const [w = "1280", h = "720"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const Q = ["Why is there no wind on the Moon?", "What did they leave on the Moon?", "How far away is the Moon?", "Who walked on the Moon?", "What are Martian blueberries?", "How did Opportunity get power?", "Why did Opportunity stop working?", "How long was the trip to Mars?", "Does Mars have moons?", "What is Voyager 1?"];
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: process.argv.includes("--touch") })).newPage();
await p.addInitScript(() => {
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__firstAudio ??= performance.now();
    return start.apply(this, a);
  };
});
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: { nickname: "x", suit: "Commander", code: "q", mode: "device", playerName: "Comet", greeted: true }, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: true, novaVoice: true, aiNotice: true } }, version: 2 }));
});
await p.goto("http://127.0.0.1:5173/?screen=dashboard");
await p.waitForTimeout(6000);
await p.locator(".od-ask").click();
await p.waitForTimeout(5000);
const rows = [];
for (const q of Q) {
  await p.locator(".od-ask-row input").fill(q);
  await p.evaluate(() => ((window.__firstAudio = undefined), (window.__sent = performance.now())));
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => window.__firstAudio, null, { timeout: 20000 }).catch(() => {});
  const ms = await p.evaluate(() => (window.__firstAudio ? Math.round(window.__firstAudio - window.__sent) : null));
  rows.push({ q, ms });
  console.log(ms, q);
  await p.waitForTimeout(9000);
}
const ok = rows.filter((r) => r.ms != null).map((r) => r.ms).sort((a, c) => a - c);
const res = { viewport: `${w}x${h}`, brain: "offline (no API key): local fact sheet", voice: "Kokoro on the local server", median: ok[Math.floor(ok.length / 2)], max: ok.at(-1), rows };
writeFileSync(`docs/audit/new-flow/latency-${w}x${h}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ median: res.median, max: res.max }));
await b.close();
