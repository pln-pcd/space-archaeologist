// Records the game's own music and sound effects for the demo video, from the real engine.
//   node video/audio/record.mjs          -> video/audio/out/theme-*.wav and sfx-*.wav
// The page is the dev build; the audio modules are the same ones the game uses
// (apps/web/src/audio/themes.ts, cute.ts, sfx.ts). We tap Tone's destination with a
// ScriptProcessor and write 48 kHz stereo 16-bit WAV, so nothing is re-synthesised by hand.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
const require = createRequire(resolve("package.json"));
const { chromium } = require("@playwright/test");

const OUT = resolve("video/audio/out");
mkdirSync(OUT, { recursive: true });
const BASE = process.env.GAME_URL || "http://127.0.0.1:5173";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`${BASE}/?screen=dashboard`);
await page.evaluate(() => {
  localStorage.setItem("homeward-session-v1", JSON.stringify({ version: 2, state: { profile: null, progress: { completed: [], pages: {}, scores: {}, choices: {} }, settings: { sound: true, music: true, novaVoice: false, quality: "low" } } }));
});
async function init() {
  await page.goto(`${BASE}/dev/audio`);
  await page.waitForTimeout(3000);

await page.evaluate(async () => {
  // import the modules the game uses first, then unlock EVERY engine instance they loaded (a dev
  // server with hot updates can serve the engine under a versioned URL)
  const mods = { themes: (await import("/src/audio/themes.ts")).themes, cute: (await import("/src/audio/cute.ts")).cute, sfx: await import("/src/audio/sfx.ts") };
  const urls = (re) => [...new Set(performance.getEntriesByType("resource").map((e) => e.name).filter((u) => re.test(u)))];
  const Tone = await import(urls(/\.vite\/deps\/tone\.js/)[0]);
  // a native 48 kHz context (Tone's default wrapper has no ScriptProcessor for the tap)
  Tone.setContext(new Tone.Context(new AudioContext({ sampleRate: 48000 })));
  for (const u of urls(/\/src\/audio\/engine\.ts/)) await (await import(u)).audio.unlock();
  const ctx = Tone.getContext().rawContext;
  const tap = ctx.createScriptProcessor(16384, 2, 2);
  const sink = ctx.createGain();
  sink.gain.value = 0;
  tap.connect(sink).connect(ctx.destination);
  Tone.getDestination().connect(tap);
  const rec = { on: false, L: [], R: [] };
  tap.onaudioprocess = (e) => {
    if (!rec.on) return;
    rec.L.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    rec.R.push(new Float32Array(e.inputBuffer.getChannelData(1)));
  };
  window.__rec = rec;
  window.__rate = ctx.sampleRate;
  window.__mods = mods;
});
}
await init();

async function capture(name, seconds, start) {
  if (existsSync(join(OUT, `${name}.wav`))) return;
  try {
    await captureOnce(name, seconds, start);
  } catch (e) {
    console.log("retry", name, e.message.slice(0, 120));
    await init();
    await captureOnce(name, seconds, start);
  }
}
async function captureOnce(name, seconds, start) {
  await page.evaluate(() => {
    window.__rec.L = [];
    window.__rec.R = [];
    window.__rec.on = true;
  });
  await page.evaluate(start);
  await page.waitForTimeout(seconds * 1000);
  const { rate, l, r } = await page.evaluate(() => {
    const rec = window.__rec;
    rec.on = false;
    const join = (a) => {
      const n = a.reduce((s, x) => s + x.length, 0), o = new Float32Array(n);
      let i = 0;
      for (const x of a) o.set(x, i), (i += x.length);
      return Array.from(o, (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767))));
    };
    return { rate: window.__rate, l: join(rec.L), r: join(rec.R) };
  });
  const n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(l[i], 44 + i * 4), buf.writeInt16LE(r[i], 46 + i * 4);
  const got = n / rate;
  // a dropped buffer would leave a gap: only keep complete takes (>= 97% of the wall-clock time)
  if (got < seconds * 0.97 - 0.4) throw new Error(`dropped audio in ${name}: ${got.toFixed(1)} of ${seconds} s`);
  writeFileSync(join(OUT, `${name}.wav`), buf);
  console.log(name, got.toFixed(1) + " s");
}

// the four songs, long enough to cover the longest section they score
for (const [name, secs] of [["title", 62], ["explore", 72], ["ship", 66], ["game", 50]]) {
  await capture(`theme-${name}`, secs, `window.__mods.themes.push("${name}")`);
  await page.evaluate(() => window.__mods.themes.push(null));
  await page.waitForTimeout(2500);
}
// every cute sound and every sfx in the bank, one take each (2.5 s)
const names = await page.evaluate(() => ({ cute: Object.keys(window.__mods.cute), sfx: window.__mods.sfx.SFX_NAMES }));
for (const c of names.cute) await capture(`cute-${c}`, 2.5, `window.__mods.cute["${c}"]()`);
for (const s of names.sfx) await capture(`sfx-${s}`, 2.5, `window.__mods.sfx.play("${s}")`);
await capture("sfx-warpRiser", 4, `window.__mods.sfx.warpRiser(3)`);
await capture("sfx-chordSwell", 4, `window.__mods.sfx.chordSwell()`);
writeFileSync(join(OUT, "index.json"), JSON.stringify(names, null, 1));
await browser.close();
