// The demo video's sound: narration (the clock), the game's own music ducked under the voice, the
// game's own sound effects on their frames, then loudness to -14 LUFS / -1 dBTP and the final mux.
//   node video/mix.mjs <video-only.mp4> <out.mp4>
// Inputs: video/build/timeline.json (from build.mjs), video/narration/out/*.wav,
// video/audio/out/*.wav (record.mjs). Writes video/build/mix.wav and the final MP4 (H.264 + AAC,
// captions burned in by the render, AI note in the metadata).
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const FF = process.env.FFMPEG || "ffmpeg";
const V = resolve("video");
const B = join(V, "build");
const A = join(V, "audio/out");
const N = join(V, "narration/out");
const tl = JSON.parse(readFileSync(join(B, "timeline.json"), "utf8"));
const [videoIn, out] = process.argv.slice(2);
const SR = 48000;
const run = (args, label) => {
  const r = spawnSync(FF, ["-v", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${label}: ${r.stderr.slice(-800)}`);
  return r.stderr;
};

// 1. voice: every narration line at its time (+ the child's question and Nova's real answer)
const vItems = tl.voice.map((v) => ({ file: join(N, `${v.id}.wav`), t: v.start, gain: 1 }));
if (tl.voiceShot) {
  // the player's spoken question (adult TTS, labelled) and Nova's real voice clips, on their times
  const vs = tl.voiceShot;
  if (existsSync(join(N, "k01.wav"))) vItems.push({ file: join(N, "k01.wav"), t: vs.abs + vs.kidAt, gain: 0.9 });
  for (const c of vs.nova ?? []) vItems.push({ file: join(N, `${c.file}.wav`), t: vs.abs + c.at, gain: 1 });
}
function place(items, outFile, label) {
  const inputs = items.flatMap((i) => ["-i", i.file]);
  const chains = items.map((i, k) => `[${k}:a]aresample=${SR},aformat=channel_layouts=stereo,volume=${i.gain},adelay=${Math.round(i.t * 1000)}|${Math.round(i.t * 1000)}[a${k}]`);
  const mix = `${items.map((_, k) => `[a${k}]`).join("")}amix=inputs=${items.length}:normalize=0:dropout_transition=0,apad=whole_dur=${tl.total.toFixed(3)},atrim=0:${tl.total.toFixed(3)}[out]`;
  writeFileSync(join(B, `${label}.filter`), [...chains, mix].join(";\n"));
  run([...inputs, "-/filter_complex", join(B, `${label}.filter`), "-map", "[out]", "-c:a", "pcm_s16le", outFile], label);
}
place(vItems, join(B, "voice.wav"), "voice");

// 2. effects: the game's own sounds (logged on their frames) and a few designed hits; repeated
// sounds rotate between takes; nothing closer than 120 ms to the previous hit
const ROT = { pop: ["cute-pop", "sfx-pop"], whoosh: ["sfx-whoosh", "sfx-bookWhoosh"] };
let rot = 0, lastT = -1;
const fx = [];
for (const s of tl.sfx) {
  let f = ROT[s.file] ? ROT[s.file][rot++ % 2] : s.file;
  if (!existsSync(join(A, `${f}.wav`))) continue;
  if (s.t - lastT < 0.12) continue;
  lastT = s.t;
  const quiet = /pop|tick|coin/.test(f) ? 0.55 : /fanfare|warpRiser|portal/.test(f) ? 0.8 : 0.65;
  fx.push({ file: join(A, `${f}.wav`), t: Math.max(0, s.t), gain: s.src === "game" ? quiet * 0.85 : quiet });
}
place(fx, join(B, "sfx.wav"), "sfx");

// 3. music: the game's four Tone.js songs, one per section, crossfaded
const lineAt = (id) => tl.voice.find((v) => v.id === id)?.start;
const cuts = [
  [0, "game"],
  [tl.music.find((m) => m.part === 1).start, "explore"],
  [tl.music.find((m) => m.part === 2).start, "title"],
  [tl.music.find((m) => m.part === 3).start, "title"],
  [lineAt("n16") - 0.3, "explore"],
  [lineAt("n21") - 0.3, "game"],
  [lineAt("n25") - 0.3, "ship"],
  [tl.music.find((m) => m.part === 4).start, "title"],
  [tl.music.find((m) => m.part === 5).start, "ship"],
  [tl.music.find((m) => m.part === 6).start, "title"],
];
const merged = cuts.filter((c, i) => i === 0 || c[1] !== cuts[i - 1][1]);
const XF = 0.8;
const mItems = merged.map(([t0, song], i) => {
  const t1 = i + 1 < merged.length ? merged[i + 1][0] + XF : tl.total;
  return { song, t0: Math.max(0, t0 - (i ? XF / 2 : 0)), d: t1 - t0 + (i ? XF / 2 : 0) };
});
const mInputs = mItems.flatMap((m) => ["-stream_loop", "-1", "-i", join(A, `theme-${m.song}.wav`)]);
const mChains = mItems.map((m, k) => `[${k}:a]aresample=${SR},atrim=0:${m.d.toFixed(3)},afade=t=in:d=${k ? XF : 0.4},afade=t=out:st=${(m.d - XF).toFixed(3)}:d=${XF},adelay=${Math.round(m.t0 * 1000)}|${Math.round(m.t0 * 1000)}[m${k}]`);
const mMix = `${mItems.map((_, k) => `[m${k}]`).join("")}amix=inputs=${mItems.length}:normalize=0,apad=whole_dur=${tl.total.toFixed(3)},atrim=0:${tl.total.toFixed(3)}[out]`;
writeFileSync(join(B, "music.filter"), [...mChains, mMix].join(";\n"));
run([...mInputs, "-/filter_complex", join(B, "music.filter"), "-map", "[out]", "-c:a", "pcm_s16le", join(B, "music.wav")], "music");

// 4. the mix: music ducked under the voice (sidechain), effects 3 to 6 dB over the bed, then
// loudness: two-pass loudnorm to -14 LUFS integrated, true peak <= -1 dBTP
const pre = join(B, "premix.wav");
run(["-i", join(B, "voice.wav"), "-i", join(B, "music.wav"), "-i", join(B, "sfx.wav"), "-filter_complex",
  "[0:a]asplit=2[v][vsc];[1:a]volume=0.42[mu];[mu][vsc]sidechaincompress=threshold=0.015:ratio=9:attack=25:release=420:makeup=1[duck];" +
  "[2:a]volume=3.2[fx];[v][duck][fx]amix=inputs=3:normalize=0,alimiter=limit=0.95:level=disabled[out]",
  "-map", "[out]", "-c:a", "pcm_s16le", pre], "premix");
const m1 = spawnSync(FF, ["-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-2:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr;
const j = JSON.parse(m1.slice(m1.lastIndexOf("{"), m1.lastIndexOf("}") + 1));
const final = join(B, "mix.wav");
run(["-i", pre, "-af", `loudnorm=I=-14:TP=-2:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=${SR}`, "-c:a", "pcm_s16le", final], "loudnorm");

// 5. mux: the rendered picture + the mix, AAC, AI note in the metadata
if (videoIn && out) {
  const note = "Made with AI tools. Narration: Kokoro-82M text-to-speech. Game footage is real gameplay of the current build; the hand input in the Rock Box, investigation and quiz shots is simulated and labelled. See AI_USE.md.";
  run(["-i", videoIn, "-i", final, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
    "-metadata", "title=Space Archaeologist: demo", "-metadata", `comment=${note}`, "-metadata", `description=${note}`, "-metadata", "artist=Space Archaeologist team (NASA Space Apps Challenge 2026)", "-metadata", "copyright=Not endorsed by NASA. NASA footage and photos courtesy of NASA.", out], "mux");
  const m2 = spawnSync(FF, ["-hide_banner", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr;
  const sum = m2.slice(m2.lastIndexOf("Summary:"));
  writeFileSync(join(B, "loudness.txt"), sum);
  console.log(sum.replace(/\s+/g, " ").slice(0, 400));
}
