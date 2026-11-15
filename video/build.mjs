// Builds the demo video's HyperFrames project (video/hf/) from:
//   video/narration/lines.json + narration/out/*.wav (the voice is the clock)
//   video/footage/*.mp4 + *.json (real gameplay, cursor paths, the game's own sound events)
//   the EDL below (one beat per narration line or idea)
// and writes video/build/timeline.json (for the audio mix), video/build/captions.srt.
//   node video/build.mjs [--cut=30]      (--cut=30 builds the 30-second global cut, see README)
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { T, SCREEN, PARTS, KIT_CSS, ICON } from "./kit.mjs";

const V = resolve("video");
const HF = join(V, "hf");
const FPS = 30;
const FF = process.env.FFMPEG || "ffmpeg";
const TEAM = JSON.parse(readFileSync(join(V, "team.json"), "utf8"));
const LINES = Object.fromEntries(JSON.parse(readFileSync(join(V, "narration/lines.json"), "utf8")).lines.map((l) => [l.id, l]));
const KID = JSON.parse(readFileSync(join(V, "narration/lines.json"), "utf8")).kid;
const dur = (id) => {
  const p = join(V, "narration/out", `${id}.wav`);
  const b = readFileSync(p);
  return (b.readUInt32LE(40) / b.readUInt32LE(28)) || 0;
};
const foot = {};
const F = (shot) => (foot[shot] ??= JSON.parse(readFileSync(join(V, "footage", `${shot}.json`), "utf8")));
const M = (shot, label, fallback = 0) => {
  const m = F(shot).marks.find((x) => x.label === label);
  return m ? m.frame / FPS : fallback;
};
const has = (shot) => existsSync(join(V, "footage", `${shot}.mp4`));
const noDash = (s) => {
  if (/[–—]/.test(s)) throw new Error("dash in on-screen text: " + s);
  return s;
};
const esc = (s) => noDash(String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------------------------------------------------------- the EDL
// seg: a footage segment inside the screen. from = seconds into the shot, d = seconds on screen
// (or "rest"), r = playback rate, z = zoom keys [[tRel, scale, focusX, focusY], ...] in footage px.
const seg = (shot, from, d = "rest", o = {}) => ({ t: "seg", shot, from, d, r: o.r ?? 1, z: o.z, cursor: o.cursor ?? true, credit: o.credit, dim: o.dim });
const card = (n, title, q) => ({ t: "part", n, title, q });
const line = (texts, at = 0.2, o = {}) => ({ t: "line", texts, at, ...o });
const bubble = (text, x, y, at = 0.3, o = {}) => ({ t: "bubble", text, x, y, at, ...o });
const chips = (items, x, y, at = 0.3, o = {}) => ({ t: "chips", items, x, y, at, ...o });
const badge = (icon, text, cls = "mint") => ({ t: "badge", icon, text, cls });
const credit = (text) => ({ t: "credit", text });
const label = (text, x, y, at = 0.2, dur) => ({ t: "label", text, x, y, at, dur });
const photo = (src, cap, x, y, w, at = 0.2, o = {}) => ({ t: "photo", src, cap, x, y, w, at, ...o });
const stat = (value, text, x, y, at = 0.2) => ({ t: "stat", value, text, x, y, at });

const NASA_FILM = "Footage: Apollo 11 activities, July 16, 1969 · NASA Kennedy Space Center";
const REAL = "Real gameplay · current build";

const BEATS = [
  // 1 INTRO: a cold open from real gameplay, then the title
  { part: 0, lines: ["n01"], pre: 0.35, sfx: [[0.05, "sfx-whoosh"]], layers: [
    seg("mission1", M("mission1", "push") - 0.2, 2.3, { z: [[0, 1.12, 1500, 560]] }),
    seg("mission1", 40.5, 1.4, { cursor: false, z: [[0, 1.1, 1250, 380]] }),
    seg("mission1", M("mission1", "arrival") + 2.5, 2.0, { cursor: false }),
    ...(has("rockbox") ? [seg("rockbox", M("rockbox", "grab", 6) - 1.4, "rest", { cursor: false }), label("Simulated hand input (no webcam)", 210, 950, 5.75)] : []),
  ] },
  { part: 0, lines: ["n02"], pre: 0.25, post: 0.5, kind: "title", sfx: [[0, "sfx-warpRiser"], [0.9, "cute-sparkle"]], layers: [
    seg("onboarding", 1.0, "rest", { cursor: false, r: 0.4 }),
    chips([{ icon: "sparkle", text: TEAM.teamLabel, cls: "sun" }, { icon: "globe", text: "Philippines" }], 960, 1040, 0.6, { center: true, below: true }),
  ] },

  // 2 PROBLEM
  { part: 1, lines: [], min: 3.4, kind: "card", layers: [card(2, "The problem", "Why do these machines need new storytellers?")] },
  { part: 1, lines: ["n03"], pre: 0.2, post: 0.3, kind: "full", layers: [{ t: "quote", kicker: "Our challenge · NASA Space Apps Challenge 2026", title: "Abandoned but not Forgotten", sub: "Storytelling about NASA's Discarded Equipment on the Moon and Mars" }] },
  { part: 1, lines: ["n04"], pre: 0.15, layers: [
    seg("mission1", M("mission1", "arrival") + 0.3, 2.6, { cursor: false }),
    label("Moon · Apollo 11 lander, 1969", 210, 160, 0.3, 2.2),
    seg("marsrover", 0.6, "rest", { cursor: false, z: [[0, 1.3, 960, 500]] }),
    label("Mars · Opportunity rover, 2004 to 2018", 210, 160, 2.75),
  ] },
  { part: 1, lines: ["n05"], pre: 0.15, kind: "full", layers: [
    photo("img/reflector.jpg", "Aldrin carries Apollo 11's science experiments · Photo: NASA", 260, 210, 640, 0.15),
    chips([{ icon: "check", text: "Still used by scientists", cls: "mint" }], 580, 840, 1.6, { center: true }),
    photo("img/descent.jpg", "Eagle on the Moon, 1969 · Photo: NASA", 1020, 230, 640, 2.9, { tilt: 2 }),
    chips([{ icon: "rocket", text: "Opportunity drove 45 km on Mars", cls: "sun" }], 1340, 860, 3.6, { center: true }),
  ] },
  { part: 1, lines: ["n06"], pre: 0.15, kind: "full", layers: [
    line(["Kids hear about", "today's missions."], 0.2, { y: 300 }),
    line(["The old machines?", "Dense websites. Textbooks."], 3.3, { y: 600, ink: false, hi: 1 }),
    chips([{ icon: "book", text: "From the challenge brief" }], 960, 836, 0.8, { center: true }),
  ] },
  { part: 1, lines: ["n07"], pre: 0.15, post: 0.2, layers: [
    seg("dig2", M("dig2", "brush", 3) + 1.4, "rest", { r: 1.2, dim: 0.5 }),
    line(["What if kids could", "dig the stories up?"], 2.4, { y: 470, hi: 1 }),
  ] },

  // 3 SOLUTION
  { part: 2, lines: [], min: 3.4, kind: "card", layers: [card(3, "Our solution", "What does Space Archaeologist do?")] },
  { part: 2, lines: ["n08"], pre: 0.15, layers: [
    seg("onboarding", 24.8, 4.3, { cursor: false, dim: 0.8, z: [[0, 1, 960, 540], [0.1, 1.08, 960, 520, 4.2]] }),
    seg("onboarding", 26.5, "rest", { cursor: false, dim: 0.8, r: 0.45, z: [[0, 1.08, 960, 520], [0.1, 1.16, 960, 500, 5]] }),
    line(["A free browser game", "for kids 7 to 12."], 0.4, { y: 330 }),
    line(["Real machines. True stories."], 4.6, { y: 640, hi: 0 }),
  ] },
  { part: 2, lines: ["n09"], pre: 0.15, kind: "full", layers: [{ t: "flow", at: 0.2 }] },
  { part: 2, lines: ["n10"], pre: 0.15, post: 0.3, layers: [
    seg("onboarding", 25.4, "rest", { cursor: false, z: [[0, 1, 960, 540], [1.2, 1.35, 520, 560]] }),
    bubble("Nova, your AI space guide", 980, 560, 1.0, { small: "Meet" }),
  ] },

  // 4 DEMO
  { part: 3, lines: [], min: 3.4, kind: "card", layers: [card(4, "Live demo", "How does it play?"), chips([{ icon: "check", text: REAL, cls: "mint" }], 960, 900, 0.6, { center: true })] },
  { part: 3, lines: ["n11", "n12"], pre: 0.15, layers: [
    badge("mouse", "Mouse + keyboard"),
    seg("onboarding", 1.8, 2.3),
    seg("onboarding", M("onboarding", "intro") + 0.6, 2.4, { r: 2.2 }),
    seg("onboarding", M("onboarding", "name") + 0.4, 3.0, { z: [[0, 1.3, 960, 470]] }),
    seg("onboarding", M("onboarding", "designer") + 0.6, "rest", { r: 1.5 }),
  ] },
  { part: 3, lines: ["n13"], pre: 1.1, layers: [
    seg("onboarding", M("onboarding", "warp") + 0.3, 1.1, { r: 1.6, cursor: false }),
    seg("onboarding", M("onboarding", "ship") - 0.1, "rest", { cursor: false, z: [[0, 1, 960, 540], [0.3, 1.1, 960, 520, 4]] }),
  ] },
  { part: 3, lines: ["n14"], pre: 0.1, layers: [
    seg("mission1", M("mission1", "film") + 0.4, "rest", { cursor: false, z: [[0, 1.25, 960, 560]], credit: NASA_FILM }),
  ] },
  { part: 3, lines: ["n15"], pre: 0.1, sfx: [[0.9, "sfx-portalWhump"]], layers: [
    badge("mouse", "Mouse"),
    seg("mission1", M("mission1", "pull") - 0.5, 1.8, { z: [[0, 1.2, 1500, 520]] }),
    seg("mission1", M("mission1", "push") - 0.3, 2.6),
    seg("mission1", M("mission1", "climb") + 2.5, 1.8, { r: 1.6, cursor: false }),
    seg("mission1", 38.5, "rest", { cursor: false, r: 1.3 }),
  ] },
  { part: 3, lines: ["n16"], pre: 0.1, layers: [
    seg("briefing", 0.4, 2.2, { cursor: false }),
    seg("explore", 0.8, "rest", { cursor: false }),
    bubble("The mission path", 960, 210, 1.6, { small: "Every step" }),
  ] },
  { part: 3, lines: ["n17"], pre: 0.1, layers: [badge("mouse", "Mouse"), seg("dig2", M("dig2", "brush") - 0.3, "rest", { r: 1.0 })] },
  { part: 3, lines: ["n18"], pre: 0.1, post: 1.2, layers: [
    badge("hand", "Hands", "lilac"),
    seg("dig2", M("dig2", "rotate") - 0.2, 2.9, { cursor: false }),
    seg("dig2", M("dig2", "parts"), "rest", { r: 1.1 }),
    label("Simulated hand input (no webcam)", 210, 950, 0.2),
  ] },
  { part: 3, lines: ["n19"], pre: 0.1, post: 1.2, layers: [
    seg("dig2", M("dig2", "laser"), "rest", { r: 1.1, z: [[0, 1, 960, 540], [1.6, 1.35, 1280, 880]] }),
    { t: "term", word: "Retroreflector", meaning: "a mirror that sends light straight back", at: 0.5 },
    chips([{ icon: "sparkle", text: "Light round trip: about 2.5 seconds", cls: "sun" }], 960, 836, 3.4, { center: true }),
  ] },
  { part: 3, lines: ["n20"], pre: 0.1, post: 1.2, layers: [
    badge("hand", "Hands", "lilac"),
    seg("dig2", M("dig2", "q1") - 0.4, "rest", { r: 1.55, cursor: false, z: [[0, 1, 960, 540], [3, 1.4, 1430, 560]] }),
    label("Simulated hand input (no webcam)", 210, 950, 0.2),
  ] },
  { part: 3, lines: ["n21"], pre: 0.1, post: 1.2, layers: [
    badge("hand", "Hands", "lilac"),
    ...(has("rockbox") ? [seg("rockbox", M("rockbox", "play", 4.4) + 0.2, "rest", { cursor: false })] : []),
    label("Simulated hand input (no webcam)", 210, 950, 0.2),
    bubble("21.5 kg: Apollo 11's real total", 1380, 470, 2.6, { small: "True story" }),
  ] },
  { part: 3, lines: ["n22"], pre: 0.1, post: 1.2, layers: [seg("rebuild", M("rebuild", "assemble") - 0.2, "rest", { r: 1.6 })] },
  { part: 3, lines: ["n23"], pre: 0.1, post: 1.2, layers: [
    seg("report", M("report", "q1") - 0.2, "rest"),
    bubble("No fail screens", 1360, 820, 2.2, { small: "Kind by design" }),
  ] },
  { part: 3, lines: ["n24"], pre: 0.1, sfx: [[1.6, "cute-fanfare"]], layers: [seg("report", M("report", "warp") - 0.3, "rest", { r: 1.6, cursor: false })] },
  { part: 3, lines: ["n25"], pre: 0.1, layers: [
    badge("mouse", "Mouse"),
    seg("marsrover", 6.2, 2.2, { cursor: false, z: [[0, 1.3, 960, 500]] }),
    seg("mars", M("mars", "play") - 0.2, "rest"),
    { t: "term", word: "Sol", meaning: "one day on Mars, about 24 h 40 min", at: 3.2 },
  ] },
  { part: 3, lines: ["n26"], pre: 0.1, post: 0.2, kind: "voice", layers: [badge("mic", "Voice", "sky")] },

  // 5 FEATURES
  { part: 4, lines: ["n27"], pre: 0.2, min: 3.6, kind: "card", layers: [card(5, "Why it works", "Every feature has a reason.")] },
  { part: 4, lines: ["n28"], pre: 0.1, layers: [
    { t: "heading", text: "Why Nova?" },
    seg("novachat", M("novachat", "reflector") - 1.0, 4.6, { r: 1.2, z: [[0, 1.3, 1210, 720]] }),
    seg("novachat", M("novachat", "offtopic") - 0.6, "rest", { cursor: false, z: [[0, 1.3, 1210, 760]] }),
    chips([{ icon: "mic", text: "Voice or text" }, { icon: "shield", text: "Stays on space" }, { icon: "check", text: "Sourced facts", cls: "mint" }], 960, 836, 1.2, { center: true, stagger: 0.9 }),
  ] },
  { part: 4, lines: ["n29"], pre: 0.1, layers: [
    { t: "heading", text: "Why hands?" },
    badge("hand", "Hands", "lilac"),
    ...(has("rockbox") ? [seg("rockbox", M("rockbox", "play", 4.4) + 2.6, "rest", { cursor: false })] : [seg("dig2", M("dig2", "brush"), "rest")]),
    label("Simulated hand input (no webcam)", 210, 950, 0.2),
    chips([{ icon: "mouse", text: "Mouse" }, { icon: "keys", text: "Keyboard" }, { icon: "hand", text: "Touch" }], 960, 836, 3.6, { center: true, stagger: 0.35 }),
  ] },
  { part: 4, lines: ["n30"], pre: 0.1, layers: [
    { t: "heading", text: "Why voices?" },
    seg("mission1", M("mission1", "arrival") + 2.5, "rest", { cursor: false, z: [[0, 1.15, 960, 820]] }),
    chips([{ icon: "cc", text: "Read aloud + captions", cls: "sun" }], 960, 836, 1.4, { center: true }),
  ] },
  { part: 4, lines: ["n31"], pre: 0.1, layers: [
    seg("facts", 0, "rest", { cursor: false, r: 0.48, z: [[0, 2.1, 560, 330]] }),
    stat("275", "facts, each with a NASA source", 1240, 330, 2.2),
    stat("46", "NASA sources", 1240, 640, 4.1),
  ] },
  { part: 4, lines: ["n32"], pre: 0.1, layers: [
    seg("novachat", M("novachat", "asteroids") - 0.3, "rest", { cursor: false, z: [[0, 1.45, 1210, 760]] }),
    chips([{ icon: "globe", text: "Asteroids today" }, { icon: "sparkle", text: "Space weather" }, { icon: "rocket", text: "Mars weather" }], 960, 836, 1.6, { center: true, stagger: 0.6 }),
    label("Live from NASA open APIs: NeoWs, DONKI, Curiosity REMS", 210, 160, 0.4),
  ] },
  { part: 4, lines: ["n33"], pre: 0.1, layers: [
    seg("settings", M("settings", "open") - 0.3, "rest", { z: [[0, 1.8, 1800, 520], [0.3, 1.92, 1800, 520, 5]] }),
    chips([{ icon: "user", text: "No accounts" }, { icon: "shield", text: "Camera + voice stay on device" }, { icon: "check", text: "AI off switch", cls: "mint" }], 960, 836, 1.0, { center: true, stagger: 1.0 }),
  ] },
  { part: 4, lines: ["n34"], pre: 0.1, post: 0.2, layers: [
    seg("settings", M("settings", "font") - 1.0, "rest", { z: [[0, 1.8, 1800, 520], [0.3, 1.92, 1800, 520, 5]] }),
    chips([{ icon: "cc", text: "Captions on" }, { icon: "sparkle", text: "Calm motion" }, { icon: "book", text: "Easy-read font" }, { icon: "wifi", text: "Offline fact sheet", cls: "mint" }], 960, 836, 0.8, { center: true, stagger: 1.2 }),
  ] },

  // 6 IMPACT
  { part: 5, lines: [], min: 3.4, kind: "card", layers: [card(6, "Impact", "Who does it help, and why will it last?")] },
  { part: 5, lines: ["n35"], pre: 0.15, layers: [
    seg("onboarding", 25.8, "rest", { cursor: false, dim: 0.5, z: [[0, 1, 960, 540], [0.1, 1.12, 960, 520, 6]] }),
    chips([{ icon: "star", text: "Free", cls: "sun" }, { icon: "globe", text: "Any web browser" }, { icon: "check", text: "No downloads" }, { icon: "user", text: "No accounts" }], 960, 500, 0.4, { center: true, stagger: 0.55, big: true }),
    chips([{ icon: "book", text: "One link to share with a class", cls: "mint" }], 960, 650, 3.0, { center: true }),
  ] },
  { part: 5, lines: ["n36"], pre: 0.1, layers: [
    seg("onboarding", M("onboarding", "designer") + 1, "rest", { cursor: false, r: 0.8, dim: 0.6 }),
    line(["Built for ages 7 to 12"], 0.3, { y: 420, hi: 0 }),
  ] },
  { part: 5, lines: ["n37"], pre: 0.1, kind: "full", layers: [{ t: "takeaways", items: ["What was left behind", "Why it stayed", "Science still uses it"], at: 0.4 }] },
  { part: 5, lines: ["n38"], pre: 0.1, layers: [
    seg("onboarding", 25.2, "rest", { cursor: false, r: 0.5, z: [[0, 1, 960, 540], [1.2, 1.45, 960, 380]] }),
    chips([{ text: "Viking 1" }, { text: "Pioneer 10" }, { text: "Voyager 1" }], 960, 836, 1.6, { center: true, stagger: 0.5 }),
  ] },
  { part: 5, lines: ["n39"], pre: 0.1, post: 0.6, kind: "full", layers: [line(["Machines NASA left behind,", "turned into a game kids can play,", "so their stories are never forgotten."], 0, { y: 330, small: true, hi: 2 })] },

  // END CARD
  { part: 6, lines: ["n40"], pre: 0.5, post: 6.5, kind: "end", sfx: [[0.4, "cute-fanfare"]], layers: [{ t: "end" }] },
];

// ---------------------------------------------------------------- timing
const GAP = 0.32;
let t = 0;
const placed = [];
const voice = []; // narration clips: { id, start, dur }
for (const b of BEATS) {
  const start = t;
  let cur = start + (b.pre ?? 0.2);
  const lines = [];
  for (const id of b.lines) {
    const d = dur(id);
    lines.push({ id, start: cur, dur: d });
    voice.push({ id, start: cur, dur: d });
    cur += d + GAP;
  }
  if (b.kind === "voice") cur += 0; // extended below once the voice shot is known
  let d = Math.max(b.min ?? 0, cur - start - (b.lines.length ? GAP : 0) + (b.post ?? 0.25));
  if (b.kind === "voice") {
    const v = F("novavoice");
    const end = Math.max(v.seconds - (v.trimStart ?? 0), ...(v.nova ?? []).map((c) => c.at + c.dur));
    d += Math.min(end + 0.8, 32);
  }
  placed.push({ ...b, start, dur: d, lineAt: lines });
  t += d;
}
const TOTAL = +t.toFixed(3);

// parts: contiguous beats with the same part index
const parts = [];
for (const b of placed) {
  const last = parts.at(-1);
  if (!last || last.part !== b.part) parts.push({ part: b.part, start: b.start, beats: [b] });
  else last.beats.push(b);
}
for (const p of parts) p.dur = p.beats.at(-1).start + p.beats.at(-1).dur - p.start;

// ---------------------------------------------------------------- html helpers
const r3 = (x) => +x.toFixed(3);
const base = SCREEN.w / 1920;
function zoomXY(s, fx, fy) {
  const S = base * s;
  let x = SCREEN.w / 2 - fx * S, y = SCREEN.h / 2 - fy * S;
  x = Math.min(0, Math.max(SCREEN.w - 1920 * S, x));
  y = Math.min(0, Math.max(SCREEN.h - 1080 * S, y));
  return { x: r3(x), y: r3(y), scale: r3(S) };
}
const chipHtml = (c, big) => `<span class="k-chip ${c.cls ?? ""}" style="${big ? "font-size:44px;padding:16px 30px 16px 22px" : ""}">${c.icon ? ICON[c.icon] : ""}${esc(c.text)}</span>`;

const sfxOut = [];
const creditsOut = [];
const voiceShot = { used: false };
const thumbs = [];

function buildPart(p, idx) {
  const id = `p${idx + 1}`;
  const el = [];
  const js = [];
  let z = 10;
  let vid = 0;
  js.push(`tl.set("#${id}-zoom", { x: 0, y: 0, scale: ${r3(base)} }, 0);`);
  for (const b of p.beats) {
    const bs = r3(b.start - p.start), be = r3(bs + b.dur);
    const segs = b.layers.filter((l) => l.t === "seg");
    const screenOn = segs.length > 0 || b.kind === "voice";
    js.push(`tl.set("#${id}-screen", { opacity: ${screenOn ? 1 : 0} }, ${bs});`);
    // footage segments, back to back
    let at = bs;
    segs.forEach((s, i) => {
      const meta = F(s.shot);
      const remain = be - at;
      let d = s.d === "rest" ? remain : Math.min(s.d, remain);
      const maxD = (meta.seconds - s.from - 0.05) / s.r;
      if (d > maxD) d = Math.max(0.3, maxD);
      if (i === segs.length - 1 && at + d < be - 0.05) {
        // stretch the last segment to the beat end by slowing it (never beyond 0.55x)
        const need = be - at;
        const slow = Math.max(0.45, (meta.seconds - s.from - 0.05) / need);
        s.r = Math.min(s.r, slow);
        d = Math.min(need, (meta.seconds - s.from - 0.05) / s.r);
      }
      d = r3(d);
      const vId = `${id}-v${++vid}`;
      el.push(`<video id="${vId}" class="clip" src="assets/footage/${s.shot}.mp4" muted playsinline data-start="${r3(at)}" data-duration="${d}" data-media-start="${r3(s.from)}" data-playback-rate="${s.r}" data-track-index="1" style="z-index:${z++}"></video>`);
      if (s.dim) el.push(`<div id="${vId}-dim" class="clip" data-start="${r3(at)}" data-duration="${d}" data-layout-ignore style="position:absolute;inset:0;z-index:${z++};background:rgba(22,14,58,${s.dim})"></div>`);
      // zoom keys
      const keys = s.z ?? [[0, 1, 960, 540]];
      keys.forEach(([kt, ks, fx, fy, kd], k) => {
        const zz = zoomXY(ks, fx, fy);
        if (k === 0) js.push(`tl.set("#${id}-zoom", ${JSON.stringify(zz)}, ${r3(at)});`);
        else js.push(`tl.to("#${id}-zoom", { ...${JSON.stringify(zz)}, duration: ${kd ?? 0.9}, ease: "${kd ? "sine.inOut" : "power2.inOut"}" }, ${r3(at + kt)});`);
      });
      // cursor (from the recorder's per-frame log)
      if (s.cursor && meta.cursor) {
        let last = null;
        for (let k = 0; k <= d * 15; k++) {
          const lt = at + k / 15;
          const fr = Math.round((s.from + (k / 15) * s.r) * FPS);
          const c = meta.cursor[Math.min(meta.cursor.length - 1, fr)];
          const key = c ? `${c[0]},${c[1]},${c[2]}` : "x";
          if (key === last) continue;
          last = key;
          js.push(c ? `tl.set("#${id}-cur", { x: ${c[0]}, y: ${c[1]}, opacity: 1, scale: ${c[2] ? 0.82 : 1} }, ${r3(lt)});` : `tl.set("#${id}-cur", { opacity: 0 }, ${r3(lt)});`);
        }
      }
      js.push(`tl.set("#${id}-cur", { opacity: 0 }, ${r3(at + d)});`);
      // the game's own sounds inside this segment, on their frame
      for (const e of meta.events ?? []) {
        const es = e.frame / FPS;
        if (es < s.from || es > s.from + d * s.r) continue;
        if (e.kind === "speak" || e.name === "hover" || e.name === "dustyBeep" || e.name === "tick") continue;
        sfxOut.push({ t: r3(p.start + at + (es - s.from) / s.r), file: `${e.kind === "cute" ? "cute" : "sfx"}-${e.name}`, src: "game" });
      }
      if (s.credit) creditsOut.push({ start: p.start + at, dur: d, text: s.credit });
      at += d;
    });
    // beat-level sfx
    for (const [st, f] of b.sfx ?? []) sfxOut.push({ t: r3(b.start + st), file: f, src: "design" });
    // overlays
    for (const L of b.layers) {
      const oid = `${id}-o${++z}`;
      const start = r3(bs + (L.at ?? 0));
      const odur = r3(Math.max(0.4, Math.min(L.dur ?? 1e9, be - start - 0.05)));
      const wrap = (inner, style = "", extra = "") => `<div id="${oid}" class="clip" data-start="${start}" data-duration="${odur}" ${extra} style="position:absolute;z-index:${z};${style}"><div id="${oid}-in">${inner}</div></div>`;
      const pop = (sel = `#${oid}-in`, delay = 0) => {
        js.push(`tl.fromTo("${sel}", { opacity: 0, scale: 0.7, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.7)" }, ${r3(start + delay)});`);
        sfxOut.push({ t: r3(p.start + start + delay + 0.03), file: "pop", src: "design" });
      };
      const out = (sel = `#${oid}-in`) => js.push(`tl.to("${sel}", { opacity: 0, scale: 0.94, duration: 0.18, ease: "power2.in" }, ${r3(start + odur - 0.2)});`);
      if (L.t === "part") {
        const inner = `<div class="k-card" style="position:absolute;left:330px;top:250px;width:1260px;height:560px;padding:70px 90px 0 150px;overflow:hidden">
          <i class="k-tag-hole" style="left:48px;top:62px"></i>
          <div class="k-kicker">Field report ${String(L.n).padStart(2, "0")} of 06</div>
          <div class="k-title" style="margin-top:22px">${esc(L.title)}</div>
          <div class="k-q" style="margin-top:28px;max-width:900px">${esc(L.q)}</div>
          <div id="${oid}-dust" class="k-dust"></div></div>
          <div id="${oid}-ring" class="k-ring" style="left:960px;top:540px;width:2600px;height:2600px;margin:-1300px 0 0 -1300px;opacity:0"></div>`;
        el.push(`<div id="${oid}" class="clip" data-start="${start}" data-duration="${odur}" data-layout-allow-overlap style="position:absolute;inset:0;z-index:${z}"><div id="${oid}-in" style="position:absolute;inset:0">${inner}</div></div>`);
        js.push(`tl.fromTo("#${oid}-in", { opacity: 0, y: 40, rotation: -2 }, { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: "back.out(1.4)" }, ${start});`);
        js.push(`tl.fromTo("#${oid}-dust", { xPercent: 0, skewX: 0, opacity: 1 }, { xPercent: 108, skewX: -12, opacity: 0.2, duration: 0.6, ease: "power2.inOut" }, ${r3(start + 0.15)});`);
        js.push(`tl.fromTo("#${oid}-ring", { scale: 0.015, opacity: 0.9 }, { scale: 1, opacity: 0, duration: 0.6, ease: "power2.out" }, ${r3(start + odur - 0.55)});`);
        js.push(`tl.to("#${oid}-in", { opacity: 0, y: -60, duration: 0.3, ease: "power3.in" }, ${r3(start + odur - 0.35)});`);
        sfxOut.push({ t: r3(p.start + start + 0.35), file: "cute-brush", src: "design" }, { t: r3(p.start + start + odur - 0.5), file: "cute-scan", src: "design" });
      } else if (L.t === "quote") {
        el.push(wrap(`<div class="k-card" style="position:absolute;left:260px;top:270px;width:1400px;padding:60px 80px;text-align:center">
          <div class="k-kicker">${esc(L.kicker)}</div>
          <div style="font:400 104px/1.02 'Lilita One';color:${T.ink};margin-top:26px">${esc(L.title)}</div>
          <div class="k-q" style="margin-top:26px;font-size:36px">${esc(L.sub)}</div></div>`, "inset:0", "data-layout-allow-overlap"));
        pop();
        out();
      } else if (L.t === "line") {
        const html = L.texts.map((s, i) => `<div id="${oid}-l${i}" style="${L.small ? "font-size:68px;" : ""}">${i === L.hi ? `<span class="k-hi">${esc(s)}</span>` : esc(s)}</div>`).join("");
        el.push(wrap(`<div class="k-line" style="text-align:center">${html}</div>`, `left:0;right:0;top:${L.y ?? 380}px`, "data-layout-allow-overflow"));
        L.texts.forEach((_, i) => js.push(`tl.fromTo("#${oid}-l${i}", { opacity: 0, filter: "blur(8px)", y: 18 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.32, ease: "power3.out" }, ${r3(start + i * 0.5)});`));
        out();
      } else if (L.t === "bubble") {
        el.push(wrap(`<div class="k-bubble" style="position:relative;transform:translate(-50%,-50%)">${L.small ? `<small>${esc(L.small)}</small>` : ""}${esc(L.text)}</div>`, `left:${L.x}px;top:${L.y}px`));
        pop();
        out();
      } else if (L.t === "chips") {
        const inner = L.items.map((c, i) => `<span id="${oid}-c${i}" style="display:inline-block;margin:0 10px">${chipHtml(c, L.big)}</span>`).join("");
        el.push(wrap(`<div style="text-align:center;white-space:nowrap">${inner}</div>`, `left:0;right:0;top:${L.y - (L.big ? 50 : 34)}px`));
        L.items.forEach((_, i) => pop(`#${oid}-c${i}`, i * (L.stagger ?? 0.25)));
        out();
      } else if (L.t === "badge") {
        el.push(`<div id="${oid}" class="clip" data-start="${bs}" data-duration="${r3(b.dur - 0.05)}" style="position:absolute;left:${SCREEN.x}px;top:26px;z-index:60"><div id="${oid}-in">${chipHtml({ icon: L.icon, text: L.text, cls: L.cls })}</div></div>`);
        js.push(`tl.fromTo("#${oid}-in", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, ${r3(bs + 0.1)});`);
      } else if (L.t === "label") {
        el.push(wrap(`<div class="k-label">${esc(L.text)}</div>`, `left:${L.x}px;top:${L.y}px`));
        js.push(`tl.fromTo("#${oid}-in", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, ${start});`);
      } else if (L.t === "photo") {
        const w = L.w, h = Math.round(w * 0.66);
        el.push(wrap(`<div style="background:#fff;border:6px solid ${T.ink};box-shadow:0 10px 0 ${T.ink};padding:14px 14px 0;transform:rotate(${L.tilt ?? -2}deg)">
          <img src="assets/${L.src}" style="display:block;width:${w}px;height:${h}px;object-fit:cover" />
          <div style="font:500 24px/1.3 'Fredoka';color:${T.ink};padding:12px 4px 14px">${esc(L.cap)}</div></div>`, `left:${L.x}px;top:${L.y}px`));
        pop();
        out();
      } else if (L.t === "stat") {
        el.push(wrap(`<div class="k-card" style="padding:26px 40px 30px;min-width:470px"><div class="k-stat">${esc(L.value)}</div><div style="font:600 32px/1.2 'Fredoka';margin-top:10px">${esc(L.text)}</div></div>`, `left:${L.x}px;top:${L.y}px`));
        pop();
        out();
      } else if (L.t === "term") {
        el.push(wrap(`<div class="k-card" style="padding:20px 32px;border-radius:24px"><div style="font:400 44px/1 'Lilita One'">${esc(L.word)}</div><div style="font:600 28px/1.25 'Fredoka';color:#4b4380;margin-top:8px">${esc(L.meaning)}</div></div>`, `left:${SCREEN.x + 40}px;top:${SCREEN.y + 40}px`));
        pop();
        out();
      } else if (L.t === "heading") {
        el.push(`<div id="${oid}" class="clip" data-start="${bs}" data-duration="${r3(b.dur - 0.05)}" style="position:absolute;right:${1920 - SCREEN.x - SCREEN.w}px;top:22px;z-index:60"><div id="${oid}-in"><span class="k-chip sun" style="font:400 36px/1 'Lilita One';padding:12px 26px">${esc(L.text)}</span></div></div>`);
        js.push(`tl.fromTo("#${oid}-in", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.6)" }, ${r3(bs + 0.05)});`);
      } else if (L.t === "flow") {
        const steps = [["Explorer", "designer"], ["Ship", "ship"], ["NASA film", "film"], ["Launch", "launch"], ["Explore + dig", "dig"], ["Games", "games"], ["Badge", "badge"]];
        const lineTimes = b.lineAt[0];
        const per = (lineTimes.dur - 0.6) / steps.length;
        const inner = steps.map(([lbl, th], i) => {
          const x = 140 + i * 240, y = i % 2 ? 560 : 330;
          thumbs.push(th);
          return `<div id="${oid}-s${i}" style="position:absolute;left:${x}px;top:${y}px;width:220px;text-align:center">
            <div style="width:220px;height:124px;border:5px solid ${T.ink};border-radius:18px;overflow:hidden;box-shadow:0 7px 0 ${T.ink};background:#000"><img src="assets/thumbs/${th}.jpg" style="width:100%;height:100%;object-fit:cover" /></div>
            <div class="k-chip ${i === steps.length - 1 ? "sun" : ""}" style="margin-top:16px;font-size:26px;padding:8px 18px">${esc(lbl)}</div></div>`;
        }).join("");
        el.push(wrap(`<svg width="1920" height="1080" style="position:absolute;left:0;top:0"><path id="${oid}-path" d="M250 400 L490 630 L730 400 L970 630 L1210 400 L1450 630 L1690 400" fill="none" stroke="${T.sun}" stroke-width="8" stroke-dasharray="18 16" stroke-linecap="round"/></svg>${inner}`, "inset:0", "data-layout-allow-overlap"));
        js.push(`tl.fromTo("#${oid}-path", { opacity: 0 }, { opacity: 1, duration: 0.6 }, ${start});`);
        steps.forEach((_, i) => {
          const at2 = r3(lineTimes.start - p.start - (b.start - p.start) + bs + 0.2 + i * per);
          js.push(`tl.fromTo("#${oid}-s${i}", { opacity: 0, scale: 0.6, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(1.8)" }, ${at2});`);
          sfxOut.push({ t: r3(p.start + at2 + 0.03), file: i % 2 ? "sfx-pop" : "cute-pop", src: "design" });
        });
        out();
      } else if (L.t === "takeaways") {
        const inner = L.items.map((s, i) => `<div id="${oid}-t${i}" class="k-card" style="position:absolute;left:${170 + i * 540}px;top:330px;width:500px;height:360px;padding:40px 36px;text-align:center">
          <div style="width:96px;height:96px;margin:0 auto;border-radius:50%;border:6px solid ${T.ink};background:${[T.sun, T.mint, T.lilac][i]};font:400 56px/84px 'Lilita One'">${i + 1}</div>
          <div style="font:400 50px/1.1 'Lilita One';margin-top:34px">${esc(s)}</div></div>`).join("");
        el.push(wrap(`<div class="k-kicker" style="position:absolute;left:0;right:0;top:220px;text-align:center;color:#fff;font-size:30px">What kids walk away with</div>${inner}`, "inset:0", "data-layout-allow-overlap"));
        js.push(`tl.fromTo("#${oid}-in", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${start});`);
        L.items.forEach((_, i) => {
          js.push(`tl.fromTo("#${oid}-t${i}", { opacity: 0, y: 60, rotation: ${i - 1} }, { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: "back.out(1.5)" }, ${r3(start + i * 1.3)});`);
          sfxOut.push({ t: r3(p.start + start + i * 1.3 + 0.05), file: "cute-coin", src: "design" });
        });
        out();
      } else if (L.t === "end") {
        const names = TEAM.members.map((m, i) => `<div id="${oid}-m${i}" style="font:600 28px/1.5 'Fredoka';color:#fff">${esc(m)}</div>`).join("");
        el.push(wrap(`
          <div style="position:absolute;left:0;right:0;top:120px;text-align:center">
            <div id="${oid}-t1" style="font:400 150px/0.95 'Lilita One';color:${T.coral};-webkit-text-stroke:6px ${T.ink};paint-order:stroke fill;text-shadow:0 9px 0 ${T.ink}">Space</div>
            <div id="${oid}-t2" style="font:400 120px/1 'Lilita One';color:#fff;-webkit-text-stroke:6px ${T.ink};paint-order:stroke fill;text-shadow:0 9px 0 ${T.ink}">Archaeologist</div>
          </div>
          <div id="${oid}-play" style="position:absolute;left:0;right:0;top:470px;text-align:center"><span class="k-chip sun" style="font-size:42px;padding:16px 34px">${ICON.rocket}Play free: space-archaeologist.vercel.app</span></div>
          <div id="${oid}-repo" style="position:absolute;left:0;right:0;top:575px;text-align:center"><span class="k-chip" style="font-size:30px">${ICON.book}Code: github.com/pln-pcd/space-archaeologist</span></div>
          <div id="${oid}-team" style="position:absolute;left:0;right:0;top:670px;text-align:center">
            <div style="font:400 40px/1 'Lilita One';color:${T.sun}">${esc(TEAM.teamLabel)} · Philippines</div>
            <div style="display:grid;grid-template-columns:repeat(3,auto);justify-content:center;gap:2px 46px;margin-top:16px">${names}</div></div>
          <div id="${oid}-legal" style="position:absolute;left:0;right:0;top:948px;text-align:center;font:500 22px/1.4 'Fredoka';color:#d9d2ff">NASA Space Apps Challenge 2026 · Not endorsed by NASA · NASA footage and photos courtesy of NASA</div>`, "inset:0", "data-layout-allow-overlap"));
        js.push(`tl.fromTo("#${oid}-t1", { opacity: 0, y: -80, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, ${start});`);
        js.push(`tl.fromTo("#${oid}-t2", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" }, ${r3(start + 0.25)});`);
        js.push(`tl.fromTo("#${oid}-play", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, ${r3(start + 0.9)});`);
        js.push(`tl.fromTo("#${oid}-repo", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${r3(start + 1.3)});`);
        js.push(`tl.fromTo("#${oid}-team", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, ${r3(start + 1.7)});`);
        js.push(`tl.fromTo("#${oid}-legal", { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${r3(start + 2.2)});`);
        sfxOut.push({ t: r3(p.start + start + 0.9), file: "cute-coin", src: "design" });
      }
    }
    if (b.kind === "voice") {
      // the real-time voice shot (Chrome's fake microphone into the game's own speech-to-text)
      const v = F("novavoice");
      const from = v.trimStart ?? 0;
      const vd = r3(Math.min(v.seconds - from, b.dur - (b.lineAt[0]?.dur ?? 0) - 0.4));
      const vs = r3(bs + (b.lineAt[0] ? b.lineAt[0].start - b.start + b.lineAt[0].dur + 0.15 : 0.2));
      // narration plays over the opening of the chat, then the real exchange
      el.push(`<video id="${id}-vv" class="clip" src="assets/footage/novavoice.mp4" muted playsinline data-start="${bs}" data-duration="${r3(b.dur)}" data-media-start="${r3(Math.max(0, from - (vs - bs)))}" data-track-index="1" style="z-index:${z++}"></video>`);
      // wide on the chat, in on the question as it is heard, then on Nova while she answers
      js.push(`tl.set("#${id}-zoom", ${JSON.stringify(zoomXY(1, 960, 540))}, ${bs});`);
      js.push(`tl.to("#${id}-zoom", { ...${JSON.stringify(zoomXY(1.3, 1150, 640))}, duration: 0.9, ease: "power2.inOut" }, ${r3(vs + (v.kidAt ?? 1) - 0.8)});`);
      const firstNova = (v.nova ?? [])[0];
      if (firstNova) js.push(`tl.to("#${id}-zoom", { ...${JSON.stringify(zoomXY(1.45, 470, 760))}, duration: 1.0, ease: "power2.inOut" }, ${r3(vs + firstNova.at - 0.5)});`);
      el.push(`<div id="${id}-vlab" class="clip" data-start="${vs}" data-duration="${r3(be - vs - 0.05)}" style="position:absolute;left:210px;top:950px;z-index:70"><div class="k-label">Question spoken by a text-to-speech voice</div></div>`);
      if (existsSync(join(V, "narration/out/n26b.wav"))) voice.push({ id: "n26b", start: r3(p.start + vs + (v.kidAt ?? 1) + dur("k01") + 0.6), dur: dur("n26b") });
      voiceShot.used = { abs: r3(p.start + vs), from, dur: vd, kidAt: v.kidAt ?? 0.6, nova: (v.nova ?? []).map((c) => ({ file: `nova_ans_${c.i}`, at: c.at, dur: c.dur, text: c.text })) };
    }
  }
  const html = `<template>
<style>${KIT_CSS}
#root { position: absolute; inset: 0; overflow: hidden; }
</style>
<div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
  <div class="k-bg"></div><div class="k-stars"></div>
  <div class="k-planet" style="left:-90px;top:640px;width:260px;height:260px;background:${T.lilac};opacity:.35"></div>
  <div class="k-planet" style="left:1780px;top:70px;width:200px;height:200px;background:${T.coral};opacity:.3"></div>
  <div id="${id}-screen" class="k-screen"><div id="${id}-zoom" class="k-zoom">
    ${el.filter((e) => e.startsWith("<video")).join("\n    ")}
    <div id="${id}-cur" class="k-cursor" style="z-index:500;opacity:0">${ICON.cursor}</div>
  </div></div>
  ${el.filter((e) => !e.startsWith("<video")).join("\n  ")}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${js.join("\n  ")}
  window.__timelines["${id}"] = tl;
</script>
</template>`;
  writeFileSync(join(HF, "compositions", `${id}.html`), html);
  return { id, start: r3(p.start), dur: r3(p.dur) };
}

// ---------------------------------------------------------------- captions
function groups(text, start, d) {
  const words = text.split(/\s+/);
  const out = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    const n = cur.length;
    if ((n >= 4 && /[.,:;?!]$/.test(w)) || n >= 7) (out.push(cur.join(" ")), (cur = []));
  }
  if (cur.length) out.push(cur.join(" "));
  const chars = out.reduce((a, s) => a + s.length, 0);
  let t0 = start + 0.06;
  const speak = d - 0.12;
  return out.map((s) => {
    const gd = (s.length / chars) * speak;
    const g = { text: s, start: r3(t0), end: r3(t0 + gd) };
    t0 += gd;
    return g;
  });
}

// ---------------------------------------------------------------- write everything
mkdirSync(join(HF, "compositions"), { recursive: true });
mkdirSync(join(HF, "assets/footage"), { recursive: true });
mkdirSync(join(HF, "assets/thumbs"), { recursive: true });
mkdirSync(join(V, "build"), { recursive: true });
for (const f of readdirSync(join(V, "footage")).filter((f) => f.endsWith(".mp4"))) copyFileSync(join(V, "footage", f), join(HF, "assets/footage", f));
// thumbnails for the flow diagram, from real footage
const TH = { designer: ["onboarding", 18], ship: ["onboarding", 26], film: ["mission1", 7], launch: ["mission1", 31], dig: ["dig2", M("dig2", "parts", 8) + 2], games: [has("rockbox") ? "rockbox" : "mars", has("rockbox") ? 8 : 6], badge: ["report", M("report", "rewards", 22) + 1.5] };
for (const [k, [shot, at]] of Object.entries(TH)) spawnSync(FF, ["-v", "error", "-y", "-ss", String(at), "-i", join(V, "footage", `${shot}.mp4`), "-frames:v", "1", "-vf", "scale=440:-1", join(HF, "assets/thumbs", `${k}.jpg`)]);

const comps = parts.map((p, i) => buildPart(p, i));

// captions: narration, plus the spoken question and Nova's answer in the voice shot
const caps = [];
for (const v of voice) caps.push(...groups(LINES[v.id].caption, v.start, v.dur));
if (voiceShot.used) {
  const vs = voiceShot.used;
  caps.push(...groups(`Player: ${KID.caption}`, vs.abs + vs.kidAt, dur("k01")));
  vs.nova.forEach((c, i) => caps.push(...groups(`${i === 0 ? "Nova: " : ""}${c.text}`, vs.abs + c.at, c.dur)));
}
caps.sort((a, b) => a.start - b.start);
for (let i = 0; i < caps.length - 1; i++) caps[i].end = Math.min(caps[i].end, caps[i + 1].start - 0.02);
const capHtml = caps.map((c, i) => `<div id="cg${i}" class="clip" data-start="${c.start}" data-duration="${r3(c.end - c.start)}" style="position:absolute;left:0;right:0;bottom:118px;text-align:center"><span id="cg${i}-in" class="cap">${esc(c.text)}</span></div>`).join("\n  ");
const capJs = caps.map((c, i) => `tl.fromTo("#cg${i}-in", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, ${c.start}); tl.to("#cg${i}-in", { opacity: 0, duration: 0.08 }, ${r3(c.end - 0.08)});`).join("\n  ");
writeFileSync(join(HF, "compositions/caps.html"), `<template>
<style>${KIT_CSS}
#root { position: absolute; inset: 0; }
.cap { display: inline-block; max-width: 1400px; padding: 12px 30px 14px; border-radius: 22px; background: rgba(255,255,255,.96); border: 4px solid ${T.ink}; box-shadow: 0 6px 0 ${T.ink}; font: 600 40px/1.25 "Fredoka"; color: ${T.ink}; }
</style>
<div id="root" data-composition-id="caps" data-width="1920" data-height="1080" data-layout-allow-caption-zone>
  ${capHtml}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${capJs}
  window.__timelines["caps"] = tl;
</script>
</template>`);

// HUD: the field-report path (6 parts), the AI watermark, credit lines
const steps = PARTS.map((name, i) => `<span id="hs${i}" class="hs"><i id="hs${i}-done" class="hs-done">${ICON.check}</i><b id="hs${i}-now" class="hs-now"></b><span class="hs-t">${esc(name)}</span></span>`).join('<span class="hs-dash"></span>');
const hudJs = [];
parts.filter((p) => p.part < 6).forEach((p) => {
  const i = p.part;
  hudJs.push(`tl.set("#hs${i}-now", { opacity: 1 }, ${r3(p.start)}); tl.fromTo("#hs${i}", { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, ${r3(p.start)});`);
  hudJs.push(`tl.set("#hs${i}-now", { opacity: 0 }, ${r3(p.start + p.dur)}); tl.set("#hs${i}-done", { opacity: 1 }, ${r3(p.start + p.dur)});`);
});
const endPart = parts.find((p) => p.part === 6);
hudJs.push(`tl.to("#hud-path", { opacity: 0, y: -30, duration: 0.4, ease: "power2.in" }, ${r3(endPart.start)});`);
const credHtml = creditsOut.map((c, i) => `<div id="cr${i}" class="clip k-credit" data-start="${r3(c.start)}" data-duration="${r3(c.dur)}">${esc(c.text)}</div>`).join("\n  ");
writeFileSync(join(HF, "compositions/hud.html"), `<template>
<style>${KIT_CSS}
#root { position: absolute; inset: 0; }
#hud-path { position: absolute; left: 0; right: 0; top: 24px; text-align: center; }
.hud-bar { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,.95); border: 4px solid ${T.ink}; box-shadow: 0 5px 0 ${T.ink}; }
.hs { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 7px 18px; border-radius: 999px; font: 600 26px/1 "Fredoka"; color: ${T.muted}; }
.hs-now { position: absolute; inset: 0; border-radius: 999px; background: ${T.sun}; border: 3px solid ${T.ink}; opacity: 0; }
.hs-t { position: relative; }
.hs-done { position: relative; width: 22px; height: 22px; color: #2a9d74; opacity: 0; display: inline-block; }
.hs-done svg { width: 22px; height: 22px; }
.hs-dash { width: 14px; height: 3px; border-radius: 2px; background: #d9d2f5; }
#wm { position: absolute; right: ${1920 - SCREEN.x - SCREEN.w}px; bottom: 24px; display: inline-flex; align-items: center; gap: 8px; padding: 7px 16px; border-radius: 999px; background: rgba(255,255,255,.92); border: 3px solid ${T.ink}; font: 600 22px/1 "Fredoka"; color: ${T.ink}; }
#wm svg { width: 22px; height: 22px; color: #8a6fe0; }
</style>
<div id="root" data-composition-id="hud" data-width="1920" data-height="1080">
  <div id="hud-path"><span class="hud-bar">${steps}</span></div>
  ${credHtml}
  <div id="wm">${ICON.sparkle}Made with AI tools</div>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${hudJs.join("\n  ")}
  window.__timelines["hud"] = tl;
</script>
</template>`);

const hosts = comps.map((c, i) => `<div id="${c.id}" data-composition-id="${c.id}" data-composition-src="compositions/${c.id}.html" data-start="${c.start}" data-duration="${c.dur}" data-track-index="${i + 1}" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index:${i + 1}"></div>`).join("\n      ");
writeFileSync(join(HF, "index.html"), `<!doctype html>
<html lang="en" data-composition-variables='[{"id":"teamLabel","type":"string","label":"Team label","default":${JSON.stringify(TEAM.teamLabel)}}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Space Archaeologist demo</title>
    <!-- Generated by video/build.mjs from video/narration/lines.json, video/footage/ and the EDL. Edit the EDL, not this file. -->
    <script src="assets/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: ${T.night}; }
      #root { position: absolute; inset: 0; }
      .bg { position: absolute; inset: 0; background: ${T.night}; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <div class="bg"></div>
      ${hosts}
      <div id="hud" data-composition-id="hud" data-composition-src="compositions/hud.html" data-start="0" data-duration="${TOTAL}" data-track-index="20" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index:40"></div>
      <div id="caps" data-composition-id="caps" data-composition-src="compositions/caps.html" data-start="0" data-duration="${TOTAL}" data-track-index="21" data-track-kind="captions" data-width="1920" data-height="1080" style="z-index:50"></div>
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`);

// timeline for the audio mix and the .srt
const music = parts.map((p) => ({ part: p.part, start: r3(p.start), dur: r3(p.dur) }));
writeFileSync(join(V, "build/timeline.json"), JSON.stringify({ total: TOTAL, voice, sfx: sfxOut.sort((a, b) => a.t - b.t), music, voiceShot: voiceShot.used, captions: caps, beats: placed.map((b) => ({ part: b.part, start: r3(b.start), dur: r3(b.dur), lines: b.lines })) }, null, 1));
const srtTime = (s) => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};
writeFileSync(join(V, "build/captions.srt"), caps.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n"));
console.log(`built ${comps.length} parts + hud + captions · ${TOTAL.toFixed(1)} s · ${caps.length} caption groups · ${sfxOut.length} sounds`);
