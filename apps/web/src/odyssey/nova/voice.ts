// NOVA'S VOICE (new-flow prompt §7c/§7e). Every line is spoken AND shown. Order of voices:
//   1. pre-rendered clip of a scripted line (/audio/nova/<id>.mp3, instant)
//   2. our local server (POST /api/nova/speak → Kokoro on this laptop), sentence by sentence
//   4. the browser's speechSynthesis, last resort ("Nova's voice is in simple mode"); lines with the
//      player's name only use on-device voices (localService), never a cloud voice
// The mouth follows the audio amplitude (AnalyserNode RMS); it never moves in silence.
import { useStore } from "../../store";
import { mouth } from "./state";
import { audio as music } from "../../audio/engine";
import { create } from "zustand";
import { claimVoice } from "../../audio/voiceBus";
import { capLog } from "../../fx/capture";

export const useVoiceMode = create<{ simple: boolean; reason: string }>(() => ({ simple: false, reason: "" }));

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let out: GainNode | null = null;
function graph() {
  if (!ctx) {
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    out = ctx.createGain();
    analyser.connect(out);
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, analyser: analyser!, out: out! };
}

const settings = () => useStore.getState().settings;
const voiceOn = () => settings().novaVoice !== false && settings().sound !== false;
const volume = () => (settings().novaVolume ?? 0.9) * (settings().volumes?.master ?? 0.8) * 1.25;

/** reading-time estimate for when there's no audio */
export const readSeconds = (text: string) => Math.max(1.6, text.split(/\s+/).length * 0.36 + 0.5);

// ---------- the mouth meter ----------
let meterOn = false;
const buf = new Float32Array(512);
function meter() {
  if (meterOn) return;
  meterOn = true;
  const step = () => {
    if (analyser && mouth.speaking) {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      mouth.level = Math.min(1, Math.max(0, (rms - 0.012) * 7));
    } else if (!synthTalking) mouth.level = 0;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- sources ----------
const clipCache = new Map<string, Promise<AudioBuffer | null>>();
function fetchBuffer(url: string, init?: RequestInit): Promise<AudioBuffer | null> {
  const { ctx } = graph();
  return fetch(url, init)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => ctx.decodeAudioData(b))
    .catch(() => null);
}
export function clipUrl(id: string) {
  return `/audio/nova/${id}.mp3`;
}
function loadClip(id: string) {
  let p = clipCache.get(id);
  if (!p) {
    p = fetchBuffer(clipUrl(id));
    clipCache.set(id, p);
  }
  return p;
}
/** warm the cache for the next scripted lines */
export function prefetchClips(ids: string[]) {
  if (!voiceOn()) return;
  ids.forEach((id) => void loadClip(id));
}

let serverDown = 0;
/** the local Kokoro server; a short back-off after a failure */
function serverSpeak(text: string, signal: AbortSignal, privateLine = false, voice?: string) {
  if (Date.now() < serverDown) return Promise.resolve(null);
  // our own server on this computer; "private" lines (with the player's name) never use a cloud voice
  return fetchBuffer("/api/nova/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, private: privateLine, voice }),
    signal,
  }).then((b) => {
    if (!b) serverDown = Date.now() + 20000;
    return b;
  });
}

const UNIFORM_VOICE = true;

// ---------- playback ----------
type Playing = { stop: () => void };
let current: Playing | null = null;
let synthTalking = false;

function playBuffer(b: AudioBuffer, onProgress: (k: number) => void, signal: AbortSignal): Promise<void> {
  const { ctx, analyser, out } = graph();
  meter();
  out.gain.value = volume();
  const src = ctx.createBufferSource();
  src.buffer = b;
  src.connect(analyser);
  mouth.speaking = true;
  music.setDuck(true);
  const t0 = ctx.currentTime;
  let raf = 0;
  const tick = () => {
    onProgress(Math.min(1, (ctx.currentTime - t0) / b.duration));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return new Promise((resolve) => {
    const end = () => {
      cancelAnimationFrame(raf);
      mouth.speaking = false;
      mouth.level = 0;
      music.setDuck(false);
      onProgress(1);
      resolve();
    };
    src.onended = end;
    signal.addEventListener("abort", () => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    });
    src.start();
  });
}

function speakSynth(text: string, privateLine: boolean, onProgress: (k: number) => void, signal: AbortSignal): Promise<boolean> {
  // v7.1: ONE voice for the whole game. The browser's built-in voices sound robotic and different,
  // so when the laptop voice is unavailable the line is shown as text (captions) instead.
  if (UNIFORM_VOICE || typeof speechSynthesis === "undefined") return Promise.resolve(false);
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const local = voices.filter((v) => v.localService);
  const voice = privateLine ? local[0] : local[0] ?? voices[0];
  if (!voice) return Promise.resolve(false);
  useVoiceMode.setState({ simple: true, reason: "Nova's voice is in simple mode." });
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.rate = 1.02;
    u.pitch = 1.15;
    u.volume = Math.min(1, volume());
    synthTalking = true;
    let flap = 0;
    // no audio samples from speechSynthesis: the mouth follows word boundaries while it's audible
    const iv = setInterval(() => (mouth.level = 0.25 + 0.5 * Math.abs(Math.sin((flap += 0.9)))), 90);
    mouth.speaking = true;
    u.onboundary = (e) => onProgress(Math.min(1, e.charIndex / Math.max(1, text.length)));
    const done = (ok: boolean) => {
      clearInterval(iv);
      synthTalking = false;
      mouth.speaking = false;
      mouth.level = 0;
      onProgress(1);
      resolve(ok);
    };
    u.onend = () => done(true);
    u.onerror = () => done(false);
    signal.addEventListener("abort", () => speechSynthesis.cancel());
    speechSynthesis.speak(u);
  });
}

function silent(text: string, onProgress: (k: number) => void, signal: AbortSignal): Promise<void> {
  const secs = readSeconds(text);
  const t0 = performance.now();
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      const k = (performance.now() - t0) / 1000 / secs;
      onProgress(Math.min(1, k));
      if (k >= 1 || signal.aborted) {
        clearInterval(iv);
        resolve();
      }
    }, 80);
  });
}

/** split text into speakable sentences (no emoji or symbols are read aloud) */
export function sentences(text: string) {
  const clean = speakable(text);
  return clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}
export function speakable(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[*_#~`<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type SpeakOpts = {
  voice?: "af_heart";
  /** a pre-rendered clip id (scripted lines) */
  clip?: string;
  /** the line carries the player's name: only local voices may say it */
  privateLine?: boolean;
  onProgress?: (k: number) => void;
};

/** speak one line; resolves when finished (or stopped) */
export function speak(text: string, o: SpeakOpts = {}): { done: Promise<void>; stop: () => void } {
  capLog("speak", o.clip ?? "live", { text: o.privateLine ? "" : text });
  stopSpeaking();
  const ac = new AbortController();
  const release = claimVoice(() => ac.abort());
  const onProgress = o.onProgress ?? (() => {});
  const run = async () => {
    if (!voiceOn()) return silent(text, onProgress, ac.signal);
    if (o.clip) {
      const b = await loadClip(o.clip);
      if (ac.signal.aborted) return;
      if (b) return playBuffer(b, onProgress, ac.signal);
    }
    // live: sentence by sentence, the next one synthesising while this one plays
    const parts = sentences(text);
    const total = parts.reduce((a, s) => a + s.length, 0) || 1;
    let before = 0;
    let next: Promise<AudioBuffer | null> | null = parts.length ? synth(parts[0], ac.signal) : null;
    for (let i = 0; i < parts.length; i++) {
      const b = await next;
      if (ac.signal.aborted) return;
      next = i + 1 < parts.length ? synth(parts[i + 1], ac.signal) : null;
      const share = parts[i].length / total;
      const prog = (k: number) => onProgress((before + k * parts[i].length) / total);
      if (b) await playBuffer(b, prog, ac.signal);
      else if (!(await speakSynth(parts[i], !!o.privateLine, prog, ac.signal))) await silent(parts[i], prog, ac.signal);
      before += parts[i].length;
      void share;
      if (ac.signal.aborted) return;
    }
  };
  const synth = async (s: string, signal: AbortSignal) => {
    const b = await serverSpeak(s, signal, !!o.privateLine, o.voice);
    if (b) {
      useVoiceMode.setState({ simple: false, reason: "" });
      return b;
    }
    return null;
  };
  const done = run().finally(() => {
    release();
    if (current === handle) current = null;
  });
  const handle: Playing = {
    stop: () => {
      ac.abort();
      mouth.speaking = false;
      mouth.level = 0;
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    },
  };
  current = handle;
  return { done, stop: handle.stop };
}

/**
 * A streaming speaker for free-form answers: push text as it arrives; each finished sentence is
 * synthesised and queued, so Nova starts talking while the rest is still being written.
 */
export function speechStream(o: { onSentence?: (s: string) => void } = {}) {
  stopSpeaking();
  const ac = new AbortController();
  let pending = "";
  const queue: string[] = [];
  let ended = false;
  let wake: (() => void) | null = null;
  const handle: Playing = { stop: () => (ac.abort(), (mouth.speaking = false), typeof speechSynthesis !== "undefined" && speechSynthesis.cancel()) };
  current = handle;
  let chunks = 0;
  const flush = (all = false) => {
    const m = pending.match(/^[\s\S]*?[.!?]+["')\]]*(\s|$)/);
    if (m) {
      // the very first chunk is kept short (split at an early comma) so Nova starts talking sooner
      const first = speakable(m[0]);
      const comma = chunks === 0 && first.split(" ").length > 9 ? first.indexOf(", ", 12) : -1;
      chunks++;
      if (comma > 0 && comma < first.length * 0.7) {
        queue.push(first.slice(0, comma + 1));
        queue.push(first.slice(comma + 2));
        pending = pending.slice(m[0].length);
        flush(all);
        return;
      }
      queue.push(first);
      pending = pending.slice(m[0].length);
      flush(all);
    } else if (all && pending.trim()) {
      queue.push(speakable(pending));
      pending = "";
    }
    wake?.();
  };
  const done = (async () => {
    let first: Promise<AudioBuffer | null> | null = null;
    for (;;) {
      if (ac.signal.aborted) return;
      if (!queue.length) {
        if (ended) return;
        await new Promise<void>((r) => (wake = r));
        continue;
      }
      const s = queue.shift()!;
      if (!s) continue;
      o.onSentence?.(s);
      if (!voiceOn()) {
        await silent(s, () => {}, ac.signal);
        continue;
      }
      const b = await (first ?? serverSpeak(s, ac.signal));
      first = null;
      if (ac.signal.aborted) return;
      // start synthesising the next sentence while this one plays
      if (queue[0]) first = serverSpeak(queue[0], ac.signal);
      if (b) await playBuffer(b, () => {}, ac.signal);
      else {
        if (!(await speakSynth(s, false, () => {}, ac.signal))) await silent(s, () => {}, ac.signal);
      }
    }
  })();
  return {
    push: (t: string) => {
      pending += t;
      flush();
    },
    end: () => {
      ended = true;
      flush(true);
    },
    done,
    stop: handle.stop,
  };
}

export function stopSpeaking() {
  current?.stop();
  current = null;
}

/** is anything audible right now (used to avoid talking over the NASA film) */
export const isSpeaking = () => mouth.speaking;
