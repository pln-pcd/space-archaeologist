// v8 local check: ship → Mars card → Let's go → the Mars opening (screens along the way)
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "docs/audit/v8/after/marsflow";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 910 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate(() => {
  localStorage.clear();
  const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true } }, version: 2 }));
  localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
});
await p.goto("http://127.0.0.1:5173/?screen=dashboard");
await p.waitForTimeout(7000);
await p.getByRole("button", { name: /mars/i }).first().click().catch((e) => errors.push("mars tile: " + e.message.split("\n")[0]));
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}-1-card.png` });
await p.getByRole("button", { name: /let's go/i }).click().catch((e) => errors.push("go: " + e.message.split("\n")[0]));
await p.waitForTimeout(6000);
await p.screenshot({ path: `${out}-2-open.png` });
console.log(JSON.stringify({ url: p.url(), errors: errors.slice(0, 6) }));
await b.close();
