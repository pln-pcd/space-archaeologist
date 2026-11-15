// Local check (not a test): a full play-through of the NEW flow, with screenshots, console errors,
// fps per screen and a privacy log of every request.
//   node tools/flow_qa.mjs [computer|tablet|phone] [--voice]
// cover → name → dashboard greeting + how-to → Ask Nova (typed, on/off topic) → Moon mission (video,
// launch, story, check-in with a typed question, camera check → mouse, mini-game, results, stamp)
// → dashboard → Mars mission (same, "No questions" path) → final dashboard line → returning player.
// The long middle of each mission (trip, landing, mini-game rounds) is jumped with the dev flow hooks.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
if (process.argv.includes("--missions")) { await import("./mission_qa.mjs"); process.exit(process.exitCode ?? 0); }

const device = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "computer";
const VIEW = { computer: [1280, 720, false], tablet: [1024, 768, true], phone: [844, 390, true] }[device];
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? `docs/audit/new-flow/flow-${device}`;
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
const ctx = await b.newContext({ viewport: { width: VIEW[0], height: VIEW[1] }, hasTouch: VIEW[2], isMobile: VIEW[2] && device === "phone" });
const p = await ctx.newPage();
const errors = [];
const requests = [];
const fps = {};
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
p.on("console", (m) => m.text().includes("[privacy]") && errors.push(m.text()));
p.on("request", (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? "" }));
let n = 0;
const shot = async (name) => p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-${name}.png` });
const wait = (ms) => p.waitForTimeout(ms);
const measure = async (name) => (fps[name] = await p.evaluate(() => new Promise((r) => { let k = 0; const t0 = performance.now(); const f = () => { k++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round((k * 1000) / (performance.now() - t0))); }; requestAnimationFrame(f); })));
const click = async (sel, t = 15000) => p.locator(sel).first().click({ timeout: t });
const chip = async (text, t = 30000) => p.getByRole("button", { name: text, exact: true }).first().click({ timeout: t });
/** the grown-ups' AI notice appears the first time the chat opens */
const okNotice = async () => {
  if (await p.locator(".od-notice").count()) await p.locator(".od-notice .k-btn.primary").click();
};
const step = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    errors.push(`STEP ${label}: ${e.message.split("\n")[0]}`);
    await shot(`FAILED-${label}`);
  }
};

await p.goto("http://127.0.0.1:5173/?inject=1");
await p.evaluate((voice) => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: null, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: true, novaVoice: voice } }, version: 2 }));
}, process.argv.includes("--voice"));
await p.goto("http://127.0.0.1:5173/");

await step("cover", async () => {
  await wait(4200);
  await shot("cover");
  await measure("cover");
  await p.locator(".od-start").hover();
  await wait(900);
  await shot("cover-hover-wave");
  await click(".od-start");
  await wait(1600);
});
await step("name", async () => {
  await wait(1200);
  await shot("name-card");
  await p.locator(".od-namecard input").fill("Comet");
  await p.keyboard.press("Enter");
  await wait(1800);
});
await step("onboarding", async () => {
  if (await p.getByRole("button", { name: "Confirm astronaut", exact: true }).count()) {
    await chip("Confirm astronaut");
    for (let i = 0; i < 2; i++) await chip("Next welcome");
    await chip("Board the starship");
  }
  await p.waitForSelector(".ob-choice", { timeout: 40000 });
  await shot("dash-talk-choice");
  await measure("dashboard");
  await p.locator(".ob-choice").nth(1).click();
  await p.waitForSelector(".tut-root", { timeout: 30000 });
  await wait(1500);
  await shot("dash-tutorial-1");
  for (let i = 0; i < 2; i++) (await p.keyboard.press("ArrowRight"), await wait(900));
  await shot("dash-tutorial-3");
  await p.getByRole("button", { name: "Skip tutorial" }).click();
  await wait(2500);
  await shot("dash-after-tutorial");
});
await step("ask-nova", async () => {
  await click(".od-ask");
  await wait(1200);
  await shot("ai-notice");
  await okNotice();
  await wait(2500);
  await p.locator(".cv-chat .k-input").fill("What are Martian blueberries? I'm Comet");
  await p.keyboard.press("Enter");
  await wait(7000);
  await shot("chat-answer");
  await wait(3200);
  await p.locator(".cv-chat .k-input").fill("how old are you");
  await p.keyboard.press("Enter");
  await wait(6000);
  await shot("chat-redirect");
  await click(".cv-close");
  await wait(800);
});
for (const [mission, flow, label] of [["eagle", "__ch1Flow", "Mission 1"], ["opportunity", "__marsFlow", "Mission 2"]]) {
  await step(`${mission}-open`, async () => {
    await wait(1500);
    await p.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
    await wait(900);
    await shot(`${mission}-confirm`);
    await chip("Let's go!");
    // This script covers the preserved legacy chapter player. Mission 001's new board route
    // is played normally (without state injection) by tests/missions.spec.ts.
    if(mission==="eagle")await p.goto("http://127.0.0.1:5173/?chapter=1");
    await wait(4500);
    await shot(`${mission}-video`);
    await measure(`${mission}-video`);
    await p.getByRole("button", { name: "Skip the video" }).click();
    await wait(4000);
    await shot(`${mission}-launch`);
    await measure(`${mission}-launch`);
  });
  await step(`${mission}-story`, async () => {
    await p.evaluate((f) => window[f].getState().go("E_STORY"), flow);
    await wait(7000);
    await shot(`${mission}-story`);
    await measure(`${mission}-story`);
    await p.getByRole("button", { name: "Skip the story" }).click();
    await wait(2500);
  });
  await step(`${mission}-checkin`, async () => {
    await chip("It was awesome!", 30000);
    await shot(`${mission}-checkin-1`);
    await chip("Yes!", 30000);
    if (mission === "eagle") {
      await chip("Yes, I have a question", 40000);
      await wait(1200);
      await okNotice();
      await wait(2000);
      await p.locator(".k-ask-row input").first().fill("Why is there no wind on the Moon?");
      await p.keyboard.press("Enter");
      await wait(6000);
      await shot(`${mission}-checkin-answer`);
      await chip("I'm done", 30000);
    } else await chip("No questions", 40000);
    await chip("Yes, let's play!", 30000);
    await wait(3000);
    await shot(`${mission}-camera-check`);
  });
  await step(`${mission}-minigame`, async () => {
    const mouse = p.getByRole("button", { name: /mouse|tap|without the camera|no camera/i }).first();
    await mouse.click({ timeout: 15000 });
    await wait(4500);
    await shot(`${mission}-minigame`);
    await measure(`${mission}-minigame`);
    await p.evaluate(([f, m]) => {
      const s = window[f].getState();
      s.set({ result: m === "eagle" ? { kg: 21.5, stars: 3, mode: "mouse" } : { sols: 120, blueberries: 14, events: 3, stars: 2 }, camera: false });
      s.go("RESULTS");
    }, [flow, mission]);
    await wait(1500);
    await shot(`${mission}-results`);
    await p.getByRole("button", { name: "Stamp my passport" }).click();
    await wait(1500);
    await p.getByRole("button", { name: "Stamp the passport" }).click();
    await wait(4500);
    await shot(`${mission}-back-on-dashboard`);
  });
}
await step("returning", async () => {
  await p.goto("http://127.0.0.1:5173/");
  await wait(4000);
  await click(".od-start");
  await wait(4500);
  await shot("returning-welcome-back");
});

// privacy: the name never goes to a third party; only our local voice server may say it (private)
const third = requests.filter((r) => /^https?:/.test(r.url) && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(r.url));
const nameLeaks = requests.filter((r) => /comet/i.test(r.url + r.body) && !(r.url.includes("/api/nova/speak") && r.body.includes('"private":true')));
const report = { device, viewport: VIEW, errors, fps, requests: requests.length, thirdParty: [...new Set(third.map((r) => new URL(r.url).host))], nameLeaks: nameLeaks.map((r) => r.url), chatRequests: requests.filter((r) => r.url.includes("/api/nova/chat")).map((r) => r.body) };
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, chatRequests: report.chatRequests.length }, null, 1));
await b.close();
process.exitCode = errors.length || nameLeaks.length ? 1 : 0;
