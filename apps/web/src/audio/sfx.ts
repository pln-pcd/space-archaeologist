// SFX bank (bible §14): ZzFX procedural sounds, rendered to buffers and routed through the SFX bus,
// plus a few Tone.js sounds that need pitch or time (warp riser, wake chord, musical gestures).
import * as Tone from "tone";
import { capLog } from "../fx/capture";
import { ZZFX } from "zzfx";
import { audio, scaleNote } from "./engine";

// ZzFX params: volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
// deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay
const P = {
  tick: [0.35, 0, 1500, 0, 0.01, 0.03, 1, 2],
  pop: [0.6, 0.05, 520, 0.01, 0.02, 0.09, 0, 1.6, 14],
  gulp: [0.6, 0.05, 260, 0.01, 0.05, 0.12, 0, 1.4, -18],
  sparkle: [0.45, 0, 1700, 0.01, 0.04, 0.3, 1, 1.8, 0, 0, 640, 0.05, 0.06],
  chime: [0.5, 0, 880, 0.01, 0.18, 0.6, 0, 1.4, 0, 0, 440, 0.12],
  whoosh: [0.35, 0, 220, 0.06, 0.08, 0.3, 4, 1, 0, 0, 0, 0, 0, 1.6],
  spin: [0.4, 0, 380, 0.02, 0.18, 0.2, 1, 1, 24],
  lamp: [0.5, 0, 660, 0.02, 0.2, 0.4, 0, 1.2, 0, 0, 330, 0.08],
  soft: [0.3, 0, 330, 0.02, 0.05, 0.25, 0, 1.2, -6],
  pageFlip: [0.3, 0.1, 900, 0.01, 0.02, 0.08, 4, 0.5, 0, 0, 0, 0, 0, 2.2],
  bookWhoosh: [0.45, 0.05, 300, 0.08, 0.12, 0.35, 4, 0.8, 4, 0, 0, 0, 0, 1.2],
  portalWhump: [0.8, 0.05, 90, 0.01, 0.1, 0.5, 0, 2.5, -2, 0, 0, 0, 0, 0.3],
  flashShimmer: [0.35, 0.1, 1200, 0.02, 0.2, 0.6, 0, 1, 0, 0, 900, 0.07, 0.04],
  landThud: [0.8, 0.05, 70, 0.005, 0.04, 0.25, 0, 3, -3, 0, 0, 0, 0, 0.4],
  dustPuff: [0.3, 0.2, 400, 0.01, 0.02, 0.2, 4, 1.5, 0, 0, 0, 0, 0, 3],
  wakeChime: [0.5, 0, 523, 0.02, 0.3, 0.9, 0, 1.2, 0, 0, 262, 0.15],
  dataSparkle: [0.35, 0.05, 2100, 0.005, 0.03, 0.15, 1, 2, 0, 0, 500, 0.03, 0.03],
  correct: [0.55, 0, 784, 0.01, 0.16, 0.45, 0, 1.3, 0, 0, 392, 0.1],
  tryAgain: [0.35, 0, 392, 0.02, 0.08, 0.3, 0, 1.2, -4, 0, 0, 0, 0, 0, 0, 0, 0.1],
  stampSlam: [0.9, 0.05, 110, 0.005, 0.03, 0.2, 3, 2, -6, 0, 0, 0, 0, 0.6],
  roverMotor: [0.3, 0.05, 160, 0.05, 0.4, 0.2, 2, 0.6, 0, 0, 0, 0, 0.07, 0.3, 4],
  laserPew: [0.5, 0, 1400, 0.005, 0.05, 0.15, 1, 2, -60],
  returnPing: [0.45, 0, 1800, 0.002, 0.04, 0.5, 0, 1.6, 0, 0, 0, 0, 0, 0, 0, 0, 0.12],
  dustyBeep: [0.3, 0, 1200, 0.005, 0.03, 0.05, 1, 1, 0, 0, 300, 0.05],
  lockedSeal: [0.4, 0, 300, 0.01, 0.05, 0.25, 0, 1.4, 0, 0, -60, 0.08],
} as const;
export type Sfx = keyof typeof P;
export const SFX_NAMES = Object.keys(P) as Sfx[];

const cache = new Map<string, AudioBuffer>();
function bufferFor(name: Sfx, pitch: number): AudioBuffer | null {
  const key = `${name}@${pitch.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = Tone.getContext().rawContext as AudioContext;
  const params = [...P[name]] as number[];
  params[2] *= pitch;
  params[1] = 0; // keep cached buffers deterministic
  const samples = (ZZFX as unknown as { buildSamples: (...p: number[]) => number[] }).buildSamples(...params);
  const buf = ctx.createBuffer(1, samples.length, ZZFX.sampleRate);
  buf.getChannelData(0).set(samples);
  cache.set(key, buf);
  return buf;
}

/**
 * UI sounds get a soft bell in the game's key on top of (or instead of) the raw ZzFX blip, so
 * every tap, chime and sparkle sounds like part of the music. [scale degrees, octave, gap s, gain]
 */
const MUSICAL: Partial<Record<Sfx, [number[], number, number, number, number]>> = {
  pop: [[4], 5, 0, 0.55, 0.35],
  soft: [[0], 5, 0, 0.4, 0],
  chime: [[0, 2, 4], 5, 0.07, 0.6, 0],
  sparkle: [[4, 6, 7, 9], 5, 0.045, 0.45, 0.3],
  correct: [[0, 2, 4, 7], 5, 0.06, 0.65, 0],
  wakeChime: [[0, 4, 7], 4, 0.09, 0.6, 0.4],
  pageFlip: [[2], 6, 0, 0.18, 1],
  lockedSeal: [[1], 4, 0, 0.35, 0.5],
};
function musical(name: Sfx, pitch: number, gain: number) {
  const m = MUSICAL[name];
  if (!m) return 1;
  const [deg, oct, gap, vel, keepRaw] = m;
  try {
    const t = Tone.now() + 0.005;
    // pitch nudges move up or down the scale, so repeated sounds stay in key
    const shift = Math.round(Math.log2(Math.max(0.25, pitch)) * 7);
    deg.forEach((d, i) => bellSynth().triggerAttackRelease(scaleNote(d + shift, oct), "16n", t + i * gap, vel * gain));
  } catch {
    /* overlapping notes: skip */
  }
  return keepRaw;
}

export function play(name: Sfx, pitch = 1, gain = 1) {
  capLog("sfx", name, { pitch, gain });
  if (!audio.ready) return;
  const raw = musical(name, pitch, gain);
  if (raw <= 0) return;
  gain *= raw;
  try {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const buf = bufferFor(name, pitch);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.9 * gain;
    src.connect(g);
    Tone.connect(g, audio.bus("sfx"));
    src.start();
  } catch {
    /* audio unavailable */
  }
}

/* ---------------- Tone-built sounds ---------------- */

let bell: Tone.PolySynth | null = null;
function bellSynth() {
  if (!bell) {
    bell = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 6, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.8 }, modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 } });
    bell.volume.value = -16;
    bell.connect(audio.bus("sfx"));
    bell.connect(audio.reverb);
  }
  return bell;
}

/** Pinch = one note in key, lightly snapped to the beat (bible §14 musical gestures). */
export function noteGesture(degree = Math.floor(Math.random() * 7)) {
  if (!audio.ready) return;
  const t = Tone.getTransport().state === "started" ? Tone.getTransport().nextSubdivision("16n") : Tone.now();
  bellSynth().triggerAttackRelease(scaleNote(degree, 5), "16n", t);
}
/** Wave = a quick arpeggio sweep. */
export function arpGesture() {
  if (!audio.ready) return;
  const now = Tone.now();
  [0, 2, 4, 6, 7].forEach((d, i) => bellSynth().triggerAttackRelease(scaleNote(d, 5), "32n", now + i * 0.05));
}
/** Wake / Power Palm = a soft chord swell. */
let pad: Tone.PolySynth | null = null;
export function chordSwell() {
  if (!audio.ready) return;
  if (!pad) {
    pad = new Tone.PolySynth(Tone.AMSynth, { envelope: { attack: 0.25, decay: 0.4, sustain: 0.5, release: 1.4 } });
    pad.volume.value = -14;
    pad.connect(audio.bus("sfx"));
    pad.connect(audio.reverb);
  }
  pad.triggerAttackRelease(["F4", "A4", "C5", "E5"], 1.2);
  play("wakeChime");
}
/** Warp riser: a Shepard-style endless rise (several octaves gliding up, faded at the edges). */
export function warpRiser(seconds = 3) {
  if (!audio.ready) return;
  const now = Tone.now();
  for (let k = 0; k < 4; k++) {
    const osc = new Tone.Oscillator(110 * 2 ** k, "sine");
    const g = new Tone.Gain(0).connect(audio.bus("sfx"));
    osc.connect(g);
    osc.frequency.exponentialRampTo(110 * 2 ** (k + 1), seconds, now);
    const peak = k === 0 || k === 3 ? 0.03 : 0.07;
    g.gain.linearRampTo(peak, seconds * 0.4, now);
    g.gain.linearRampTo(0, seconds * 0.6, now + seconds * 0.4);
    osc.start(now).stop(now + seconds + 0.1);
    setTimeout(() => (osc.dispose(), g.dispose()), (seconds + 0.5) * 1000);
  }
  play("whoosh", 0.6);
}
