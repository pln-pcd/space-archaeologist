// S03c (v7.6): one full find with the new screens. Mouse brushes and taps; the HAND IS SIMULATED
// (synthetic landmarks through the game's real gesture engine, no webcam image, labelled in the
// edit): a fist turns the find, then 1 to 4 fingers answer the evidence quiz.
//   node video/capture/shot_dig2.mjs
import { readFileSync } from "node:fs";
import { launch, seed, open, Rec } from "./lib.mjs";
import * as G from "../../tools/gesture_synth.ts";

const moon = JSON.parse(readFileSync("apps/web/src/content/missions/moon-001.json", "utf8"));
// the quiz's own answer order (EvidenceQuiz.tsx: the right answer sits at hash(seed) % choices)
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
const answerIndex = (id, q) => hash(id + q) % 4;

const { browser, page, errors } = await launch();
await seed(page, { input: { mode: "gloves", consented: true } });
await open(page, "?inject=1&mission=moon-001&artifact=retroreflector", 9000);
const r = await new Rec(page, "dig2").start();
const at = (x, y, size = 0.17) => ({ x, y, size, roll: 0 });
const K = (t, pose, a, gesture) => ({ t, pose, at: a, gesture });
const FIST = G.FIST;
const fingers = (n) => ({ curl: [0.85, ...[0, 1, 2, 3].map((i) => (i < n ? 0.02 : 0.95))] });
async function hand(keys, ms) {
  const frames = G.render([{ hand: "Right", keys }], ms, { dropout: 0, jitter: 0.0007 });
  await page.evaluate((f) => {
    window.__playDone = false;
    window.__gloves.play(f).then(() => (window.__playDone = true));
  }, frames);
  await r.until(() => window.__playDone === true, ms / 1000 + 2);
}
r.mark("howto");
await r.hold(1.4);
await r.tap(/Start digging/, { move: 0.6, after: 0.4 });
r.mark("brush");
const st = await r.box(".iv3-stage");
const x0 = st.x - st.w / 2 + 40, x1 = st.x + st.w / 2 - 40, y0 = st.y - st.h / 2 + 40, y1 = st.y + st.h / 2 - 40;
const zig = [];
for (let k = 0; k < 9; k++) zig.push([k % 2 ? x1 : x0, y0 + (k * (y1 - y0)) / 8]);
for (let pass = 0; pass < 3 && !(await page.locator('[aria-label="Inspect clue 1"]').count()); pass++) await r.drag(zig, 2.2);
r.showCursor(false);
await r.until(() => !!document.querySelector('[aria-label="Inspect clue 1"]'), 5);
r.mark("found");
await r.hold(1.2);
// a fist turns and tilts the find
r.mark("rotate");
await hand([K(0, G.OPEN, at(0.38, 0.62), "Open_Palm"), K(350, G.OPEN, at(0.38, 0.62), "Open_Palm"), K(600, FIST, at(0.38, 0.62), "Closed_Fist"), K(2300, FIST, at(0.66, 0.56), "Closed_Fist"), K(2600, G.OPEN, at(0.66, 0.56), "Open_Palm")], 2700);
await r.hold(0.4);
r.mark("parts");
for (let i = 1; i <= 3; i++) {
  await r.tap(`Inspect clue ${i}`, { move: 0.45, after: 1.3 });
}
r.showCursor(false);
r.mark("laser");
for (let i = 0; i < 3; i++) {
  await r.tap("Send laser ping", { move: 0.4, after: 0.2 });
  r.mark("ping");
  await r.until(() => {
    const b = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Send laser ping"));
    return !b || !b.disabled;
  }, 4);
}
r.mark("record");
await r.hold(1.2);
await page.locator('[aria-label="Evidence board"]').scrollIntoViewIfNeeded();
const eb = await r.box('[aria-label="Evidence board"]');
await r.click(eb.x, eb.y, { move: 0.5, after: 1.2 });
r.mark("quiz-howto");
await r.hold(1.0);
await r.tap(/Start the quiz/, { move: 0.5, after: 0.6 });
r.showCursor(false);
const art = moon.artifacts.find((a) => a.id === "retroreflector");
for (const [qi, q] of ["job", "why", "part"].entries()) {
  r.mark(`q${qi + 1}`);
  await r.hold(1.6);
  const n = answerIndex(art.id, q) + 1;
  // hold up n fingers in front of the camera, still, until the answer fills
  await hand([K(0, fingers(n), at(0.3, 0.72, 0.19)), K(1500, fingers(n), at(0.305, 0.72, 0.19))], 1500);
  r.mark(`a${qi + 1}`);
  await r.hold(1.6);
}
r.mark("done");
await r.hold(1.6);
await r.tap("Save it!", { move: 0.5, after: 0.3 });
r.showCursor(false);
await r.hold(1.5);
await r.finish({ errors, simulatedHands: true });
await browser.close();
