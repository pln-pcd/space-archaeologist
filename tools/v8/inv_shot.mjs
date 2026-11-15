// v8 local check: investigation phases (dig → parts → record) at a desktop size.
// node tools/v8/inv_shot.mjs <outDir> [artifact] [w] [h] [mission]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const [out = "docs/audit/v8/after", art = "seismometer", w = "1920", h = "910", mission = "moon-001"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate(() => {
  localStorage.clear();
  const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, novaVoice: false, aiNotice: true, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true } }, version: 2 }));
  localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
  localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
  localStorage.setItem("od-howto-dig", "1");
});
await p.goto(`http://127.0.0.1:5173/?mission=${mission}&artifact=${art}`);
await p.waitForTimeout(5000);
const howto = p.locator(".howto button").last();
if (await howto.count()) await howto.click().catch(() => {});
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/inv-${art}-0.png` });
const box = await p.locator(".iv-dust").boundingBox().catch(() => null);
if (box) {
  for (let row = 0; row < 14; row++) {
    const y = box.y + (row + 0.5) * (box.height / 14);
    await p.mouse.move(box.x + 5, y);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width - 5, y, { steps: 12 });
    await p.mouse.up();
  }
}
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/inv-${art}-1.png` });
for (const chip of await p.locator(".iv3-chip").all()) { await chip.click().catch(() => {}); await p.waitForTimeout(400); }
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/inv-${art}-2.png` });
console.log(JSON.stringify({ errors: errors.slice(0, 6) }));
await b.close();
