// v8 local check: screenshots of key screens on phones and iPads (touch + mobile emulation) plus a
// simple overflow probe (elements sticking out of the viewport, page scroll).
// node tools/v8/devices.mjs <outDir> [phone,phone-land,ipad,ipad-land] [screen,...]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [out = "docs/audit/v8/devices", devList = "phone,phone-land,ipad,ipad-land", only = ""] = process.argv.slice(2);
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "phone-land": { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  "ipad-land": { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const SCREENS = {
  cover: ["?screen=cover", 6000],
  name: ["?screen=name", 5000],
  dash: ["?screen=dashboard", 7000],
  avatar: ["?screen=dashboard&mission=moon-001&step=2", 6000],
  explore: ["?mission=moon-001&step=5", 9000],
  dig: ["?mission=moon-001&artifact=seismometer", 6000],
  quiz: ["?mission=mars-001&step=7", 6000],
  video: ["?mission=mars-001&step=4", 6000],
};
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"] });
const report = {};
for (const dev of devList.split(",")) {
  const ctx = await b.newContext(DEVICES[dev]);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5173/?inject=1");
  await p.evaluate(() => {
    localStorage.clear();
    const profile = { nickname: "Comet", suit: "Commander", code: "device-qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true };
    localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, talkMode: "chat", tutorialDone: true, introSeen: true, handsAsked: true } }, version: 2 }));
    localStorage.setItem("odyssey-avatar-v5", JSON.stringify({ base: "maya", suitColor: 1, skin: 2, hair: 3, helmet: 0, visor: 1, accessory: 0, hairColor: 3 }));
    ["dig", "quiz", "evidence", "rockbox"].forEach((k) => sessionStorage.setItem("od-howto-" + k, "1"));
  });
  for (const [name, [q, wait]] of Object.entries(SCREENS)) {
    if (only && !only.split(",").includes(name)) continue;
    await p.goto("http://127.0.0.1:5173/" + q);
    await p.waitForTimeout(wait);
    // close a how-to card if one is up
    const how = p.locator(".howto button.g-btn").last();
    if (await how.count()) await how.click().catch(() => {});
    await p.waitForTimeout(500);
    const probe = await p.evaluate(() => {
      const W = innerWidth, H = innerHeight;
      const bad = [];
      for (const el of document.querySelectorAll("button, a, h1, h2, h3, p, input, .g-panel, [role=dialog]")) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
        if (r.right > W + 2 || r.left < -2 || r.bottom > H + 2 || r.top < -2) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}] "${(el.textContent || "").trim().slice(0, 24)}"`);
      }
      return { scrollW: document.documentElement.scrollWidth > W + 1, bad: bad.slice(0, 8) };
    });
    report[`${dev}/${name}`] = probe;
    await p.screenshot({ path: `${out}/${dev}-${name}.png` });
  }
  report[`${dev}/errors`] = errors.slice(0, 4);
  await ctx.close();
}
console.log(JSON.stringify(report, null, 1));
await b.close();
