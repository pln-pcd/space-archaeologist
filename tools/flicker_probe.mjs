// Local check: hunts black-screen flicker. Logs WebGL context losses / canvas creation and samples the
// screen every 120 ms (a frame whose JPEG is tiny is mostly one flat colour = black flash suspect).
//   node tools/flicker_probe.mjs [query] [seconds] [--first]
import { chromium } from "@playwright/test";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [query = "?screen=dashboard", secs = "12"] = args;
const first = process.argv.includes("--first");
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const log = [];
p.on("console", (m) => /context|webgl|error/i.test(m.text()) && log.push(`${m.type()}: ${m.text().slice(0, 160)}`));
p.on("pageerror", (e) => log.push("pageerror: " + e.message.slice(0, 160)));
await p.addInitScript((first) => {
  if (!sessionStorage.getItem("seeded")) {
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    const profile = { nickname: "Comet", suit: "Commander", code: "qa", mode: "device", playerName: "Comet", playerPatch: "COMET", introDone: true, greeted: !first };
    localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: false, novaVoice: false, aiNotice: true, talkMode: first ? null : "chat", tutorialDone: !first } }, version: 2 }));
  }
  window.__gl = { made: 0, lost: 0 };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...r) {
    const c = orig.call(this, t, ...r);
    if (c && /webgl/.test(t) && !this.__counted) {
      this.__counted = true;
      window.__gl.made++;
      this.addEventListener("webglcontextlost", () => (window.__gl.lost++, console.log("context LOST")));
    }
    return c;
  };
}, first);
await p.goto("http://127.0.0.1:5173/" + query);
const sizes = [];
const t0 = Date.now();
while (Date.now() - t0 < +secs * 1000) {
  const buf = await p.screenshot({ type: "jpeg", quality: 40 });
  sizes.push(buf.length);
  if (first) await p.keyboard.press("ArrowRight").catch(() => {});
  const click = process.argv.find((a) => a.startsWith("--click="));
  if (click && sizes.length % 12 === 6) for (const sel of click.slice(8).split("|")) await p.locator(sel).first().click({ timeout: 1500 }).catch(() => {});
  await p.waitForTimeout(120);
}
const gl = await p.evaluate(() => window.__gl);
const med = [...sizes].sort((a, b) => a - b)[sizes.length >> 1];
const flat = sizes.map((s, i) => [i, s]).filter(([, s]) => s < med * 0.35);
console.log(JSON.stringify({ gl, frames: sizes.length, median: med, flatFrames: flat.slice(0, 20), log: log.slice(0, 20) }, null, 1));
await b.close();
