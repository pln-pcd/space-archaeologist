// v8 local check: evaluate an expression on a screen. node tools/v8/probe.mjs "<query>" "<js expr>" [settingsJSON]
import { chromium } from "@playwright/test";
const [query, expr, extra = "{}"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await (await b.newContext({ viewport: { width: 1920, height: 910 } })).newPage();
await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate((extra) => {
  localStorage.clear();
  const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true, ...JSON.parse(extra) } }, version: 2 }));
  localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
}, extra);
await p.goto("http://127.0.0.1:5173/" + query);
await p.waitForTimeout(5000);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
