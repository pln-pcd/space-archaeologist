// v8 local check: the static build (no Nova server) answers NASA questions from the fact sheet
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://127.0.0.1:8399/";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await p.goto(base);
await p.evaluate(() => {
  localStorage.clear();
  const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, aiNotice: true, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true } }, version: 2 }));
  localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
});
await p.goto(base + "?screen=dashboard");
await p.waitForTimeout(7000);
await p.getByRole("button", { name: /ask nova/i }).first().click();
await p.waitForTimeout(1500);
const out = [];
for (const q of ["what is NASA", "NASA stands for?", "how many planets are there", "what is your favourite pizza"]) {
  await p.locator(".k-input").fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4200);
  out.push([q, (await p.locator(".cv-list .k-bubble, .cv-list [class*=bubble]").last().innerText().catch(() => "?")).slice(0, 140)]);
}
await p.screenshot({ path: "docs/audit/v8/after/offline-nova.png" });
console.log(JSON.stringify(out, null, 1));
await b.close();
