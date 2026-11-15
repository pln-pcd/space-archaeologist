// Local check (not a test): v7 screenshots with a finished onboarding (talk mode + tutorial done).
// Usage: node tools/v7_shot.mjs <out.png> [query] [waitMs] [w] [h] [--click=sel|sel] [--after=ms] [--done]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=") || true]; }));
const [out, query = "?screen=dashboard", wait = "6000", w = "1366", h = "768"] = args;
mkdirSync(dirname(out), { recursive: true });
const progress = flags.done ? { completed: ["eagle", "opportunity"], pages: {}, scores: { eagle: 3, opportunity: 2 }, choices: {}, chapter: 1 } : { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 };
const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://127.0.0.1:5173/");
await p.evaluate(({ profile, progress, extra }) => {
  localStorage.clear();
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress, settings: { sound: false, novaVoice: false, aiNotice: true, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true, ...extra } }, version: 2 }));
  localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
  localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
}, { profile, progress, extra: flags.settings ? JSON.parse(flags.settings) : {} });
await p.goto("http://127.0.0.1:5173/" + query);
await p.waitForTimeout(+wait);
if (flags.click)
  for (const sel of String(flags.click).split("|")) {
    await p.locator(sel).first().click({ timeout: 8000 }).catch((e) => errors.push("click " + sel + ": " + e.message.split("\n")[0]));
    await p.waitForTimeout(+(flags.after ?? 1500));
  }
await p.screenshot({ path: out });
console.log(JSON.stringify({ out, errors: errors.slice(0, 8) }));
await b.close();
