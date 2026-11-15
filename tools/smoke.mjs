import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
const st = { profile: { nickname: "Comet", suit: "Commander", code: "qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: true }, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: false, aiNotice: true, talkMode: "chat", tutorialDone: true } };
for (const q of ["", "?screen=dashboard", "?chapter=1&scene=A", "?chapter=1&scene=B", "?chapter=1&scene=E", "?chapter=1&scene=F", "?chapter=2&scene=B", "?chapter=2&scene=G"]) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 140)));
  await p.addInitScript((s) => { if (!sessionStorage.getItem("x")) { sessionStorage.setItem("x", "1"); localStorage.clear(); localStorage.setItem("homeward-session-v1", JSON.stringify({ state: s, version: 2 })); } }, st);
  await p.goto("http://127.0.0.1:5173/" + q);
  await p.waitForTimeout(5000);
  if (q === "?screen=dashboard") { await p.locator(".od-ask").click().catch((e) => errs.push("ask " + e.message.slice(0, 80))); await p.waitForTimeout(2000); await p.keyboard.press("Escape"); await p.waitForTimeout(800); }
  const iris = await p.locator(".od-iris").count();
  console.log((q || "cover").padEnd(22), "errors:", errs.length, errs.slice(0, 2).join(" | "), iris ? "" : "(no iris)");
  await p.close();
}
await b.close();
