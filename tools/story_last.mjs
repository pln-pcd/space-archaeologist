// Saves each story's LAST frame (no UI) as the Nova check-in backdrop: public/media/ch<N>/story-last.jpg
import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"] });
for (const ch of ["1", "2"]) {
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await p.goto("http://127.0.0.1:5173/?inject=1");
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("homeward-session-v1", JSON.stringify({ state: { profile: { nickname: "x", suit: "Commander", code: "q", mode: "device", playerName: "x", greeted: true }, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: false, aiNotice: true } }, version: 2 }));
  });
  await p.goto(`http://127.0.0.1:5173/?chapter=${ch}&scene=E`);
  await p.waitForFunction(() => window.__story, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.__story.seek(window.__story.shots.at(-1).end - 0.4));
  await p.addStyleTag({ content: ".subtitle,.ch1-controls,.ch1-hud,.od-gear,.od-judge{display:none!important} .od-app::after{display:none!important}" });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `apps/web/public/media/ch${ch}/story-last.jpg`, type: "jpeg", quality: 82 });
  console.log("saved ch" + ch);
}
await b.close();
