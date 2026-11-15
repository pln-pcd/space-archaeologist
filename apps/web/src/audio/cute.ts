// CUTE SOUND EFFECTS (v7.1): little musical sounds made with Tone.js, all in C major so they sit on
// top of the songs (audio/themes.ts). Short, soft and bouncy: nothing harsh, no buzzers.
//   cute.pop()      a bubbly button pop          cute.coin()    a two-note "ding-ding" pickup
//   cute.jingle()   a happy 4-note success       cute.fanfare() a bigger unlock fanfare
//   cute.boing()    a springy hop                cute.scan()    a sci-fi "bloop" sweep
//   cute.sparkle()  a twinkly glissando          cute.warp()    a rising whoosh into hyperspace
//   cute.step()     a soft Moon-boot tap         cute.oops()    a gentle "hmm?" (never a fail)
//   cute.hover()    a tiny tick on hover         cute.brush()   a soft dusty swish
import * as Tone from "tone";
import { audio } from "./engine";
import { capLog } from "../fx/capture";

let built = false;
let bell: Tone.PolySynth;
let pluck: Tone.PolySynth;
let boingS: Tone.Synth;
let noise: Tone.NoiseSynth;
let noiseF: Tone.Filter;
let sweep: Tone.Synth;
let soft: Tone.MembraneSynth;
let out: Tone.Gain;

function build() {
  if (built || !audio.ready) return audio.ready;
  built = true;
  out = new Tone.Gain(0.9).connect(audio.bus("sfx"));
  const verb = new Tone.Gain(0.25).connect(audio.reverb);
  bell = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 1.6, oscillator: { type: "sine" }, modulation: { type: "sine" }, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.6 }, modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 } });
  bell.volume.value = -10;
  bell.connect(out);
  bell.connect(verb);
  pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.15 } });
  pluck.volume.value = -9;
  pluck.connect(out);
  boingS = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.1 } }).connect(out);
  boingS.volume.value = -8;
  noiseF = new Tone.Filter(1800, "bandpass").connect(out);
  noise = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.01, decay: 0.18, sustain: 0 } }).connect(noiseF);
  noise.volume.value = -16;
  sweep = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.05, decay: 0.6, sustain: 0.2, release: 0.5 } }).connect(out);
  sweep.volume.value = -14;
  sweep.connect(verb);
  soft = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 3, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(out);
  soft.volume.value = -20;
  return true;
}

function run(f: (now: number) => void) {
  if (!audio.ready) {
    void audio.unlock();
    return;
  }
  if (!build()) return;
  try {
    f(Tone.now() + 0.01);
  } catch {
    /* a sound is never worth an error */
  }
}

const cuteRaw = {
  pop: (pitch = 1) => run((t) => {
    boingS.frequency.setValueAtTime(520 * pitch, t);
    boingS.frequency.exponentialRampToValueAtTime(900 * pitch, t + 0.06);
    boingS.triggerAttackRelease(520 * pitch, 0.08, t, 0.6);
  }),
  hover: () => run((t) => pluck.triggerAttackRelease("C7", 0.03, t, 0.12)),
  coin: () => run((t) => {
    bell.triggerAttackRelease("B5", 0.08, t, 0.5);
    bell.triggerAttackRelease("E6", 0.3, t + 0.08, 0.6);
  }),
  jingle: () => run((t) => ["C5", "E5", "G5", "C6"].forEach((n, i) => bell.triggerAttackRelease(n, 0.25, t + i * 0.09, 0.55))),
  fanfare: () => run((t) => {
    ["G4", "C5", "E5", "G5"].forEach((n, i) => pluck.triggerAttackRelease(n, 0.12, t + i * 0.08, 0.6));
    bell.triggerAttackRelease(["C5", "E5", "G5", "C6"], 0.9, t + 0.34, 0.5);
    ["E6", "G6", "C7"].forEach((n, i) => bell.triggerAttackRelease(n, 0.2, t + 0.5 + i * 0.07, 0.3));
  }),
  boing: () => run((t) => {
    boingS.frequency.setValueAtTime(180, t);
    boingS.frequency.exponentialRampToValueAtTime(620, t + 0.12);
    boingS.frequency.exponentialRampToValueAtTime(320, t + 0.24);
    boingS.triggerAttackRelease(180, 0.26, t, 0.7);
  }),
  scan: () => run((t) => {
    sweep.frequency.setValueAtTime(300, t);
    sweep.frequency.exponentialRampToValueAtTime(1400, t + 0.35);
    sweep.triggerAttackRelease(300, 0.4, t, 0.5);
    bell.triggerAttackRelease("G6", 0.15, t + 0.38, 0.3);
  }),
  sparkle: () => run((t) => ["G6", "C7", "E7", "G7"].forEach((n, i) => bell.triggerAttackRelease(n, 0.12, t + i * 0.045, 0.22))),
  warp: () => run((t) => {
    sweep.frequency.setValueAtTime(120, t);
    sweep.frequency.exponentialRampToValueAtTime(1600, t + 0.9);
    sweep.triggerAttackRelease(120, 1.1, t, 0.55);
    noiseF.frequency.setValueAtTime(400, t);
    noiseF.frequency.exponentialRampToValueAtTime(4000, t + 0.9);
    noise.triggerAttackRelease(0.9, t, 0.5);
    ["C6", "E6", "G6", "C7"].forEach((n, i) => bell.triggerAttackRelease(n, 0.2, t + 0.85 + i * 0.06, 0.35));
  }),
  step: (k = 0) => run((t) => soft.triggerAttackRelease(k % 2 ? "G2" : "E2", 0.08, t, 0.5)),
  brush: () => run((t) => {
    noiseF.frequency.setValueAtTime(2600, t);
    noise.triggerAttackRelease(0.12, t, 0.25);
  }),
  oops: () => run((t) => {
    pluck.triggerAttackRelease("E5", 0.12, t, 0.4);
    pluck.triggerAttackRelease("C5", 0.2, t + 0.13, 0.4);
  }),
  magic: () => run((t) => ["C6", "D6", "E6", "G6", "A6", "C7"].forEach((n, i) => bell.triggerAttackRelease(n, 0.15, t + i * 0.05, 0.25 + i * 0.03))),
};
/** the cute sounds; in capture mode each call is also logged for the video edit (fx/capture.ts) */
export const cute = Object.fromEntries(
  Object.entries(cuteRaw).map(([k, fn]) => [k, (...a: unknown[]) => (capLog("cute", k), (fn as (...x: unknown[]) => unknown)(...a))]),
) as typeof cuteRaw;

