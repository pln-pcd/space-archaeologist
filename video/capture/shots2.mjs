// More gameplay shots for the demo video (same recorder as shots.mjs; see lib.mjs).
//   node video/capture/shots2.mjs <shot> [<shot> ...]   or   all
import { launch, seed, open, Rec, W, H, seedFinds, realtime } from "./lib.mjs";
import * as G from "../../tools/gesture_synth.ts";

const SHOTS = {};

// S02: Mission 1 from the ship: real NASA film, the launch lever, liftoff and the trip to the Moon
SHOTS.mission1 = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?screen=dashboard", 7000);
  const r = await new Rec(page, "mission1").start();
  r.mark("ship");
  await r.hold(1.2);
  await r.tap("Mission 1: Moon", { move: 0.7, after: 1.0 });
  await r.tap("Let's go!", { move: 0.5, after: 0.2 });
  r.showCursor(false);
  await r.until(() => !!document.querySelector('[aria-label="Skip the video"]'), 8);
  r.mark("film");
  await r.hold(6);
  await r.tap("Skip the video", { move: 0.5, after: 0.1 });
  r.showCursor(false);
  r.mark("launch");
  await r.until(() => !!document.querySelector(".lever-panel.active"), 25);
  r.mark("pull");
  const h = await r.box(".lever-handle"), tr = await r.box(".lever-track");
  await r.drag([[h.x, h.y], [h.x, h.y + 40], [h.x, tr.y + tr.h / 2 - 6]], 0.7);
  r.showCursor(false);
  r.mark("ignite");
  await r.until(() => !document.querySelector(".lever-panel.active"), 5);
  await r.until(() => !!document.querySelector(".lever-panel.active"), 25);
  r.mark("push");
  const h2 = await r.box(".lever-handle"), tr2 = await r.box(".lever-track");
  await r.drag([[h2.x, h2.y], [h2.x, h2.y - 40], [h2.x, tr2.y - tr2.h / 2 + 6]], 0.7);
  r.showCursor(false);
  r.mark("climb");
  await r.hold(18);
  r.mark("arrival");
  await r.hold(8);
  await r.finish({ errors });
  await browser.close();
};

// S03: the Moon: mission briefing film, the HUD, scan, hop, then a full find (the retroreflector)
SHOTS.moon = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?mission=moon-001&step=05", 9000);
  let r = await new Rec(page, "briefing").start();
  r.mark("briefing");
  await r.hold(7);
  await r.finish();
  await page.keyboard.press("Escape");
  r = await new Rec(page, "explore").start();
  await r.hold(1.5);
  r.mark("scan");
  await r.key("Space");
  await r.hold(1.8);
  r.mark("walk");
  await r.key("w", 1.4);
  await r.key("a", 0.6);
  r.mark("hop");
  await r.key("j");
  await r.hold(1.8);
  // walk to the retroreflector by clicking the ground next to it ("Click: go there")
  for (let i = 0; i < 4; i++) {
    if (await page.locator('[aria-label="Investigate retroreflector"]').count()) break;
    await r.click(1480, 730, { move: 0.6, after: 0.2 });
    r.showCursor(false);
    await r.until(() => !!document.querySelector('[aria-label="Investigate retroreflector"]'), 4);
  }
  const reached = await page.locator('[aria-label="Investigate retroreflector"]').count();
  console.log("  reached retroreflector:", !!reached);
  r.mark("found");
  await r.hold(1);
  if (reached) await r.tap("Investigate retroreflector", { move: 0.6, after: 0.4 });
  r.showCursor(false);
  await r.hold(1);
  await r.finish({ errors });
  if (!reached) {
    await open(page, "?mission=moon-001&artifact=retroreflector", 8000);
  }

  await browser.close();
};

// S03b: one full find, the Laser Ranging Retroreflector (deep link straight into the investigation)
SHOTS.dig = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?mission=moon-001&artifact=retroreflector", 9000);
  const r = await new Rec(page, "dig").start();
  const T = async (name, o) => { try { await T(name, o); console.log("  ok", String(name)); } catch (e) { console.log("  MISS", String(name), e.message.slice(0, 80)); } };
  r.mark("howto");
  await r.until(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Start digging")), 6);
  await r.hold(1.6);
  await T(/Start digging/, { move: 0.6, after: 0.4 });
  r.mark("brush");
  const zig = [];
  for (let k = 0; k < 9; k++) {
    const y = 230 + k * 90;
    zig.push(k % 2 ? [1080, y] : [90, y]);
  }
  for (let pass = 0; pass < 3; pass++) {
    if (await page.locator('[aria-label="Inspect clue 1"]').count()) break;
    await r.drag(zig, 2.6);
  }
  r.showCursor(false);
  await r.until(() => !!document.querySelector('[aria-label="Inspect clue 1"]'), 6);
  r.mark("stars");
  await r.hold(0.6);
  for (let i = 1; i <= 4; i++) {
    if (!(await page.locator(`[aria-label="Inspect clue ${i}"]`).count())) break;
    await T(`Inspect clue ${i}`, { move: 0.45, after: 0.6 });
  }
  r.mark("laser");
  for (let i = 0; i < 4; i++) {
    const ping = page.getByRole("button", { name: "Send laser ping", exact: true });
    if (!(await ping.count()) || !(await ping.isEnabled())) break;
    await T("Send laser ping", { move: 0.45, after: 0.2 });
    r.mark("ping");
    await r.until(() => {
      const b = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Send laser ping"));
      return !b || !b.disabled;
    }, 5);
    await r.hold(0.3);
  }
  r.mark("record");
  await r.hold(1.6);
  await T("Evidence board", { move: 0.6, after: 1.2 });
  r.mark("evidence-howto");
  await r.hold(0.8);
  await T("Let's play!", { move: 0.5, after: 0.5 });
  r.mark("evidence");
  const slots = await page.$$eval('[aria-label^="Choose evidence "]', (bs) => bs.map((b) => b.getAttribute("aria-label").replace("Choose evidence ", "")));
  for (const s of slots) {
    await T(`Choose evidence ${s}`, { move: 0.35, after: 0.15 });
    await T(`Place evidence ${s}`, { move: 0.4, after: 0.35 });
  }
  r.mark("pairs");
  await r.hold(0.6);
  const parts = await page.$$eval('[aria-label^="Choose component "]', (bs) => bs.map((b) => b.getAttribute("aria-label").replace("Choose component ", "")));
  for (const id of parts) {
    await T(`Choose component ${id}`, { move: 0.35, after: 0.15 });
    await T(`Match function ${id}`, { move: 0.4, after: 0.35 });
  }
  await r.hold(0.8);
  await T("Save it!", { move: 0.5, after: 0.3 });
  r.showCursor(false);
  r.mark("saved");
  await r.hold(2.5);
  await r.finish({ errors });
  await browser.close();
};

// S04: the Rock Box with hands. The hand is SIMULATED: synthetic landmark frames
// (tools/gesture_synth.ts) go through the game's real gesture engine (filters, pinch and grab
// verbs, glove avatar), with no camera image. The edit labels this on screen.
SHOTS.rockbox = async () => {
  const { browser, page, errors } = await launch();
  await seed(page, { input: { mode: "gloves", consented: true } });
  await seedFinds(page);
  await open(page, "?inject=1&mission=moon-001&step=05", 9000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);
  const r = await new Rec(page, "rockbox").start();
  await r.hold(1.2);
  r.mark("card");
  await r.tap("Play Fill the Rock Box", { move: 0.6, after: 1.4 });
  r.showCursor(false);
  r.mark("howto");
  await r.hold(1.2);
  await page.keyboard.press("Enter");
  r.mark("play");
  await r.hold(1);
  const A = 16 / 9, SZ = 0.14;
  const toWrist = (sx, sy) => ({ x: sx / W + (0.236 * SZ) / A, y: sy / H + 0.889 * SZ, size: SZ, roll: 0 });
  const K = (t, pose, at, gesture) => ({ t, pose, at, gesture });
  const PIN = { curl: [0.2, 0.35, 0.15, 0.2, 0.25], pinch: 1 };
  let last = toWrist(1300, 560);
  let grabs = 0;
  for (let i = 0; i < 40 && grabs < 6; i++) {
    const t = await page.evaluate(() => {
      const rb = window.__rockbox, g = rb.game(), b = rb.box();
      const o = g.objs.find((o) => !o.gone && !o.held && o.y < innerHeight - 170 && o.y > 240 && o.x > 600 && o.x < innerWidth - 200 && Math.abs(o.vy) < 260 && !["leaf", "rain", "shell"].includes(o.kind));
      return o ? { x: o.x, y: o.y, vy: o.vy, box: { x: b.x + b.w / 2, y: b.y + b.h / 2 } } : null;
    });
    if (!t) {
      await r.hold(0.3);
      continue;
    }
    grabs++;
    const a = toWrist(t.x, t.y + t.vy * 0.55), bx = toWrist(t.box.x, t.box.y - 20);
    const frames = G.render([{ hand: "Right", keys: [K(0, G.OPEN, last, "Open_Palm"), K(420, G.OPEN, a, "Open_Palm"), K(560, G.OPEN, a, "Open_Palm"), K(720, PIN, a), K(860, PIN, a), K(1500, PIN, bx), K(1620, PIN, bx), K(1800, G.OPEN, bx, "Open_Palm"), K(1950, G.OPEN, bx, "Open_Palm")] }], 1950, { dropout: 0 });
    last = bx;
    await page.evaluate((f) => {
      window.__playDone = false;
      window.__gloves.play(f).then(() => (window.__playDone = true));
    }, frames);
    await r.until(() => window.__playDone === true, 4);
    r.mark("grab");
  }
  await r.hold(1);
  const kg = await page.evaluate(() => window.__rockbox?.game().kg);
  await r.finish({ errors, simulatedHands: true, kg });
  await browser.close();
};

// S05: rebuild the lander, the report quiz (one gentle wrong answer), badge and chapter complete
SHOTS.finale = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await seedFinds(page, { fieldDone: true });
  await open(page, "?mission=moon-001&step=05", 9000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);
  let r = await new Rec(page, "rebuild").start();
  await r.hold(1);
  await r.tap("Go rebuild the journey", { move: 0.6, after: 1.2 });
  r.mark("howto");
  await r.hold(0.8);
  await r.tap("Let's play!", { move: 0.5, after: 0.6 });
  r.mark("assemble");
  await r.tap("Grab ascent stage", { move: 0.5, after: 0.5 });
  await r.tap("Snap onto descent stage", { move: 0.5, after: 1.2 });
  r.mark("jobs");
  for (let i = 0; i < 2; i++) {
    const id = await page.evaluate(async () => {
      const { sessionFor } = await import("/src/missions/session.ts");
      const { MOON } = await import("/src/missions/registry.ts");
      const s = sessionFor(MOON).state;
      const st = MOON.reconstruction.stages.find((x) => !s.labels.includes(x.id));
      return st ? st.id : null;
    });
    if (!id) break;
    await r.tap(`Assign ${id} function`, { move: 0.5, after: 0.8 });
  }
  r.mark("timeline");
  const order = await page.evaluate(async () => (await import("/src/missions/registry.ts")).MOON.reconstruction.timeline.map((c) => c.id));
  for (const id of order) await r.tap(`Timeline ${id}`, { move: 0.4, after: 0.35 });
  r.showCursor(false);
  r.mark("replay");
  await r.hold(3);
  await r.finish({ errors });

  await page.getByRole("button", { name: "Continue to discovery", exact: true }).click({ force: true });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 9; i++) {
    if (await page.getByRole("button", { name: "Report to Mission Control", exact: true }).count()) break;
    await page.getByRole("button", { name: "Next discovery", exact: true }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
  r = await new Rec(page, "report").start();
  await r.tap("Report to Mission Control", { move: 0.6, after: 1.2 });
  r.mark("howto");
  await r.hold(0.6);
  await r.tap("Let's play!", { move: 0.5, after: 0.6 });
  r.mark("q1");
  await r.tap("Answer ascent", { move: 0.6, after: 1.6 });
  r.mark("wrong");
  const qs = await page.evaluate(async () => (await import("/src/missions/registry.ts")).MOON.challenge.map((q) => q.answer));
  for (const [i, ans] of qs.entries()) {
    for (const a of ans) await r.tap(`Answer ${a}`, { move: 0.45, after: 0.5 });
    r.mark(`answered-${i + 1}`);
    await r.hold(0.9);
  }
  await r.tap("Return through warp", { move: 0.5, after: 0.2 });
  r.showCursor(false);
  r.mark("warp");
  await r.hold(4.5);
  r.mark("rewards");
  await r.hold(2.5);
  await r.tap("Stamp my archaeology passport", { move: 0.6, after: 0.3 });
  r.showCursor(false);
  r.mark("archive");
  await r.hold(4);
  await r.finish({ errors });
  await browser.close();
};

// S06: Mars, the Sol Keeper mini-game (mouse): wipe dust off Opportunity's solar panels
SHOTS.mars = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?chapter=2&scene=G", 8000);
  const r = await new Rec(page, "mars").start();
  await r.hold(0.8);
  await r.tap("Not now", { move: 0.5, after: 1.4 });
  r.mark("play");
  for (let k = 0; k < 4; k++) await r.drag([[520, 380 + k * 25], [1000, 450 - k * 20], [1450, 400 + k * 15]], 1.3);
  r.showCursor(false);
  await r.hold(2);
  await r.finish({ errors });
  await browser.close();
};

// S07: Ask Nova by typing: a live NASA data question, then an off-topic question (kind redirect)
SHOTS.novachat = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?screen=dashboard", 7000);
  const r = await new Rec(page, "novachat").start();
  await r.hold(0.6);
  await r.tap("Ask Nova a question", { move: 0.7, after: 1.2 });
  const novaBubbles = () => page.locator(".cv-list .k-chat.nova");
  const ask = async (q, mark) => {
    // real-time pause, not recorded (the capture clock is stepped): lets Gemini's per-minute limit reset
    await page.waitForTimeout(15000);
    const n0 = await novaBubbles().count();
    const box = await r.box("textarea, input[type=text]");
    await r.click(box.x, box.y, { move: 0.4, after: 0.2 });
    await r.type(q, 0.05);
    await r.tap("Send", { move: 0.4, after: 0.2 });
    r.showCursor(false);
    r.mark(mark);
    await r.hold(1.2);
    // Nova takes the next question only after she finishes speaking; her idea chips come back then.
    // Wait for: a new Nova bubble, no typing dots, and the chips back (stable for 10 frames).
    const busy = '[aria-label="Nova is thinking"], [aria-label="Nova is typing"]';
    let still = 0;
    for (let i = 0; i < 1500 && still < 10; i++) {
      const more = (await novaBubbles().count()) > n0;
      const waiting = (await page.locator(busy).count()) > 0;
      const chips = (await page.locator('[aria-label="Ideas to ask"]').count()) > 0;
      still = more && !waiting && chips ? still + 1 : 0;
      if (i % 90 === 0) console.log(`  [${mark}] frame ${i} newBubble=${more} busy=${waiting} chips=${chips}`);
      await r.frame();
    }
    await r.hold(1.5);
    const reply = (await novaBubbles().count()) > n0 ? (await novaBubbles().last().innerText()).replace(/\s+/g, " ") : "";
    console.log(`  [${mark}] reply: ${reply.slice(0, 300)}`);
    return reply;
  };
  await ask("Why did the astronauts leave the laser reflector on the Moon?", "reflector");
  const live = await ask("Are any asteroids flying past Earth today?", "asteroids");
  // the video claims live NASA data here: refuse a take where Gemini timed out to the offline sheet
  if (!/asteroid/i.test(live)) throw new Error("asteroid answer was not live: retake");
  await ask("What is your favorite video game?", "offtopic");
  await r.finish({ errors });
  await browser.close();
};

// S08: Settings: easy-read font, calm motion, the AI switch for grown-ups
SHOTS.settings = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?screen=dashboard", 7000);
  const r = await new Rec(page, "settings").start();
  await r.hold(0.5);
  await r.tap("Settings", { move: 0.7, after: 1.2 });
  r.mark("open");
  await r.tap(/Easy font/, { move: 0.6, after: 1.3 });
  r.mark("font");
  await r.tap(/Calm motion/, { move: 0.5, after: 1.0 });
  const ai = await r.box(page.getByRole("button", { name: /AI helper/ }));
  await r.moveTo(ai.x, ai.y, 0.6);
  r.mark("ai");
  await r.hold(1.6);
  await r.tap(/Easy font/, { move: 0.5, after: 0.6 });
  await r.tap(/Calm motion/, { move: 0.4, after: 0.6 });
  await r.finish({ errors });
  await browser.close();
};

// S06b: Mars, the rover Opportunity itself (the chapter's roll-off film)
SHOTS.marsrover = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "?chapter=2&scene=D", 9000);
  const r = await new Rec(page, "marsrover").start();
  await r.hold(9);
  await r.finish({ errors });
  await browser.close();
};

// S09: the facts page: every fact with its NASA source
SHOTS.facts = async () => {
  const { browser, page, errors } = await launch();
  await seed(page);
  await open(page, "dev/facts", 4000);
  const r = await new Rec(page, "facts").start();
  await r.hold(1.5);
  await r.moveTo(960, 600, 0.4);
  r.showCursor(false);
  for (let k = 0; k < 30; k++) {
    await page.mouse.wheel(0, 40);
    await r.frame();
  }
  await r.hold(1.5);
  await r.finish({ errors });
  await browser.close();
};

// S10: Nova by voice (REAL TIME): a player's question (adult text-to-speech, labelled in the edit) is
// played into Chrome's fake microphone; the game's own speech-to-text hears it and Nova answers.
SHOTS.novavoice = async () => {
  const wav = process.env.KID_WAV || "video/narration/out/k01_mic.wav";
  const { browser, page, errors } = await launch({ fakeAudio: wav + "%noloop" });
  await seed(page, { settings: { talkMode: "voice", sound: true, novaVoice: true } });
  // Nova's real voice clips and the answer text, captured from the game's own server responses
  const fs0 = await import("node:fs");
  const clips = [];
  let chatText = "";
  page.on("response", async (res) => {
    const u = res.url();
    try {
      if (u.includes("/api/nova/speak")) {
        const body = await res.body();
        const i = clips.length;
        fs0.writeFileSync(`video/narration/out/nova_ans_${i}.wav`, body);
        clips.push({ i, at: Date.now() / 1000, text: JSON.parse(res.request().postData() || "{}").text });
      }
      if (u.includes("/api/nova/chat")) chatText = await res.text();
    } catch {}
  });
  await page.goto("http://127.0.0.1:5173/?screen=dashboard");
  await page.waitForTimeout(7000);
  let answer = null;
  const dialog = [];
  let base = 0;
  await realtime(page, "novavoice", async (mark) => {
    base = Date.now() / 1000;
    await page.getByRole("button", { name: "Ask Nova a question", exact: true }).click();
    await page.waitForTimeout(1800);
    mark("open");
    const before = await page.locator(".cv-root").innerText().catch(() => "");
    await page.locator('[aria-label="Talk to Nova"]').first().click();
    mark("listening");
    // log every change of the conversation text with its time (Nova's answer is paged)
    const t0 = Date.now();
    let last = "", heard = false, stable = 0;
    for (let i = 0; i < 260; i++) {
      await page.waitForTimeout(120);
      const txt = (await page.locator(".cv-root").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      if (txt !== last) {
        dialog.push({ t: +((Date.now() - t0) / 1000).toFixed(2), text: txt });
        last = txt;
        stable = 0;
      } else stable++;
      if (!heard && /far away/i.test(txt)) (heard = true), mark("heard");
      if (heard && /Tap to talk/i.test(txt) && stable > 40) break;
    }
    const prev = last;
    answer = (prev.match(/how far away is the moon\?\s*Nova\s*(.+?)\s*(Tap to talk|$)/i) || [])[1] || prev;
    mark("answered");
  }, { tail: 3 });
  // the answer's text and timing go into the shot's json; mix.mjs places Nova's real voice there
  const fs = await import("node:fs");
  const jp = "video/footage/novavoice.json";
  const j = JSON.parse(fs.readFileSync(jp, "utf8"));
  const at = (l) => (j.marks.find((m) => m.label === l)?.frame ?? 0) / 30;
  j.trimStart = Math.max(0, at("open") - 0.4);
  j.kidAt = at("listening") - j.trimStart + 0.5;
  j.answerAt = at("answer") - j.trimStart;
  j.answer = answer;
  j.dialog = dialog;
  j.clips = clips.map((c) => ({ ...c, at: +(c.at - base - j.offset - j.trimStart).toFixed(2) }));
  j.chat = chatText.slice(0, 2000);
  fs.writeFileSync(jp, JSON.stringify(j));
  console.log("answer:", answer);
  console.log("novavoice text tail:", (await page.locator(".od-app").innerText()).slice(-500).replace(/\s+/g, " "));
  if (errors.length) console.log("errors:", errors.slice(0, 5));
  await browser.close();
};

const which = process.argv.slice(2);
const list = which[0] === "all" ? Object.keys(SHOTS).filter((s) => s !== "novavoice") : which;
for (const name of list) {
  if (!SHOTS[name]) throw new Error("no shot " + name);
  const t = Date.now();
  try {
    await SHOTS[name]();
  } catch (e) {
    console.log(`SHOT ${name} FAILED: ${e.message.split("\n")[0]}`);
  }
  console.log(`  (${((Date.now() - t) / 1000).toFixed(0)} s real time)`);
}
