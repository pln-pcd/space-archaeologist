// v8 local check: click something, then take a burst of screenshots (transitions).
// node tools/v8/seq.mjs <outPrefix> <query> <clickSel> <ms,ms,...> [w] [h] [settingsJSON]
import { chromium } from "@playwright/test";
const [pre, query, sel, times, w = "1920", h = "910", extra = "{}"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate((extra) => {
  localStorage.clear();
  const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true, ...JSON.parse(extra) } }, version: 2 }));
  localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
}, extra);
await p.goto("http://127.0.0.1:5173/" + query);
await p.waitForTimeout(5500);
const t0 = Date.now();
if (sel && sel !== "-") await p.locator(sel).first().click({ timeout: 8000 }).catch((e) => errors.push(String(e).slice(0, 120)));
for (const ms of times.split(",").map(Number)) {
  const wait = t0 + ms - Date.now();
  if (wait > 0) await p.waitForTimeout(wait);
  await p.screenshot({ path: `${pre}-${ms}.png` });
}
console.log(JSON.stringify({ errors: errors.slice(0, 6) }));
await b.close();
