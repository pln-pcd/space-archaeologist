// Local check (not a test suite): open /dev/audio, press every sound button, report errors and
// whether the audio graph actually produced signal. Usage: node tools/audio_check.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] || "docs/audit/base";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto((process.env.BASE || "http://127.0.0.1:5173") + "/dev/audio");
// tap a meter onto the destination so we can prove sound is produced
await page.locator("[data-sound]").first().waitFor();
const all = await page.$$eval("[data-sound]", (els) => els.map((e) => e.getAttribute("data-sound")));
// one-shot sounds first, while nothing else is playing; the looping theme and beds last
const oneShot = (id) => /^(sfx-|motif-|g-|voice-)/.test(id);
const ids = [...all.filter(oneShot), ...all.filter((id) => !oneShot(id))];
let pressed = 0;
const silent = [];
const loud = {};
for (const id of ids) {
  if (id === "voice-read") continue; // speech synthesis has no voices in headless Chrome
  await page.evaluate(() => window.__audioPeak?.());
  await page.locator(`[data-sound="${id}"]`).first().click();
  pressed++;
  await page.waitForTimeout(id.startsWith("bed-") || id.startsWith("layer-") || id === "theme" ? 900 : 450);
  const peak = await page.evaluate(() => window.__audioPeak?.() ?? -1);
  loud[id] = +peak.toFixed(4);
  if (!(peak > 0.0005) && !["theme-stop", "bed-null"].includes(id)) silent.push(id);
}
await page.screenshot({ path: `${OUT}/audio-lab.png`, fullPage: true });
const ctxState = await page.evaluate(() => {
  const w = window;
  return typeof w.AudioContext !== "undefined" ? "AudioContext available" : "no AudioContext";
});
const report = { buttons: ids.length, pressed, silent, errors, ctxState, peaks: loud };
writeFileSync(`${OUT}/audio-check.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
