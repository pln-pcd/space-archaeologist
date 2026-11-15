// Local fps probe (not a test): node tools/fps_probe.mjs "&nopm&quality=low" — use medians of 3 runs.
import { chromium } from "@playwright/test";
const q = process.argv[2] || "";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:5173/?inject=1" + q);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: { nickname: "T", suit: "Scout", code: "x", mode: "device" }, progress: { completed: [], pages: {}, scores: {}, choices: {}, chapter: 0 }, settings: { sound: false, reducedMotion: false, quality: "high", tiltShift: true } }, version: 0 }));
  localStorage.setItem("odyssey-input-v1", JSON.stringify({ state: { mode: "mouse", academyDone: true }, version: 0 }));
  localStorage.setItem("homeward-hint-dismissed", "1");
});
await p.reload();
await p.locator('.ship3d[data-ready="true"]').waitFor({ timeout: 60000 });
await p.waitForTimeout(6000);
const r = await p.evaluate(() => new Promise((res) => { const t = []; const f = (n) => (t.push(n), n - t[0] < 8000 ? requestAnimationFrame(f) : res(+((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1))); requestAnimationFrame(f); }));
const info = await p.evaluate(() => { const g = window.__shipDebug?.gl; return g ? { calls: g.info.render.calls, tris: g.info.render.triangles, geos: g.info.memory.geometries, tex: g.info.memory.textures, progs: g.info.programs?.length } : null; });
console.log(q || "(default high)", r, JSON.stringify(info));
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
await b.close();
