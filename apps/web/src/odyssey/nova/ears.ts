// NOVA'S EARS (new-flow prompt §7d): press to talk, press to stop (hold-to-talk on touch). Never
// always-on. The mic is asked for only when it is first tapped (separate from the camera).
// While listening: a level meter, Nova's "listening" pose; auto-stop after 1.5 s of silence or 12 s.
// Speech-to-text runs ON THIS DEVICE (stt.worker.ts). Raw audio never leaves the computer: if the
// on-device model can't load, Nova gently switches to typing (v4.6: no browser cloud speech service).
import { create } from "zustand";
import { useStore } from "../../store";
import sttCfg from "../../content/nova-stt.json";

export const STT_MODEL: string = sttCfg.model;

type Ears = {
  state: "idle" | "loading" | "listening" | "working" | "denied" | "unavailable";
  level: number;
  progress: number;
  error: string;
};
export const useEars = create<Ears>(() => ({ state: "idle", level: 0, progress: 0, error: "" }));

/** ask for the microphone from a click (the pre-permission card), then let it go again */
export async function requestMic(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

/** start loading the on-device model early (after the kid picks voice) */
export function warmEars() {
  void loadModel();
}

let worker: Worker | null = null;
let ready: Promise<boolean> | null = null;
let seq = 0;
const waiting = new Map<number, (t: string) => void>();
export const sttStats: { ms: number[]; device: string } = { ms: [], device: "" };

function loadModel(): Promise<boolean> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    try {
      worker = new Worker(new URL("./stt.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return resolve(false);
    }
    const files = new Map<string, number>();
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") {
        files.set(m.file, m.progress);
        const v = [...files.values()];
        useEars.setState({ progress: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length) });
      } else if (m.type === "ready") {
        sttStats.device = m.device;
        resolve(true);
      } else if (m.type === "error") resolve(false);
      else if (m.type === "text") {
        if (m.ms) sttStats.ms.push(m.ms);
        waiting.get(m.id)?.(m.text ?? "");
        waiting.delete(m.id);
      }
    };
    worker.postMessage({ type: "load", model: STT_MODEL, webgpu: "gpu" in navigator });
  });
  return ready;
}

function transcribe(audio: Float32Array): Promise<string> {
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    worker!.postMessage({ type: "run", id, audio }, [audio.buffer]);
    setTimeout(() => waiting.has(id) && (waiting.delete(id), resolve("")), 20000);
  });
}

let stopNow: (() => void) | null = null;
/** the last thing the microphone heard (so the brain knows a question was spoken, not typed) */
export const lastHeard = { text: "", at: 0 };

// ---------- the laptop's recogniser (server/nova/ears.py: Parakeet / Whisper on onnxruntime) ----------
let serverEars: Promise<boolean> | null = null;
let serverDownUntil = 0;
function serverHasEars(): Promise<boolean> {
  if (Date.now() < serverDownUntil) return Promise.resolve(false);
  if (!serverEars)
    serverEars = fetch("/api/nova/status", { signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !!j && j.ears && j.ears !== "off")
      .catch(() => false)
      .then((ok) => {
        if (!ok) (serverDownUntil = Date.now() + 30000), (serverEars = null);
        return ok;
      });
  return serverEars;
}
async function transcribeOnServer(audio: Float32Array): Promise<string | null> {
  try {
    const t0 = performance.now();
    const r = await fetch("/api/nova/hear", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: audio.buffer as ArrayBuffer, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { text?: string; model?: string };
    sttStats.ms.push(performance.now() - t0);
    sttStats.device = `laptop:${j.model ?? "?"}`;
    return j.text ?? "";
  } catch {
    serverDownUntil = Date.now() + 30000;
    serverEars = null;
    return null;
  }
}

/** start listening; resolves with the transcript ("" if nothing was heard) */
export async function listen(): Promise<string> {
  if (stopNow) {
    stopNow();
    return "";
  }
  if (useStore.getState().settings.mic === false) return "";
  // ask for the microphone first (only now, on the kid's tap)
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    useEars.setState({ state: "denied" });
    return "";
  }
  const onLaptop = await serverHasEars();
  if (!onLaptop) {
    const onDevice = useEars.getState().state === "unavailable" ? false : await (useEars.setState({ state: "loading" }), loadModel());
    if (!onDevice) {
      stream.getTracks().forEach((t) => t.stop());
      useEars.setState({ state: "unavailable" });
      return "";
    }
  }
  const audio = await record(stream);
  if (!audio) return "";
  useEars.setState({ state: "working", level: 0 });
  let text: string | null = onLaptop ? await transcribeOnServer(audio) : null;
  if (text === null) {
    // the laptop recogniser is unavailable: the in-browser model takes over
    if (await loadModel()) text = await transcribe(audio);
    else text = "";
  }
  useEars.setState({ state: "idle" });
  const heard = cleanTranscript(text);
  if (heard) Object.assign(lastHeard, { text: heard, at: Date.now() });
  return heard;
}

/** stop listening early (press the mic again) */
export function stopListening() {
  stopNow?.();
}

/** linear resample to 16 kHz (the context runs at the device rate; forcing 16 kHz fails on some browsers) */
function to16k(x: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return x;
  const n = Math.floor((x.length * 16000) / rate);
  const out = new Float32Array(n);
  const k = rate / 16000;
  for (let i = 0; i < n; i++) {
    const p = i * k;
    const j = Math.floor(p);
    const f = p - j;
    out[i] = (x[j] ?? 0) * (1 - f) + (x[j + 1] ?? 0) * f;
  }
  return out;
}

/**
 * Record one utterance. Voice activity is judged against the room's own noise floor (measured in the
 * first 300 ms), so quiet voices and quiet mics still count. Stops 1.3 s after speech ends, 15 s max,
 * or 7 s if nothing is said. Returns 16 kHz audio, or null if no speech was heard.
 */
function record(stream: MediaStream): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const ctx = new AudioContext();
    const rate = ctx.sampleRate;
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const chunks: Float32Array[] = [];
    let floor = 0.004;
    let calib = 0;
    let voiced = 0;
    let heard = false;
    let quietFor = 0;
    const t0 = performance.now();
    useEars.setState({ state: "listening", level: 0 });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      stopNow = null;
      proc.disconnect();
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      useEars.setState({ state: heard ? "working" : "idle", level: 0 });
      if (!heard) return resolve(null);
      const all = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
      let o = 0;
      for (const c of chunks) all.set(c, (o += c.length) - c.length);
      resolve(tidy(to16k(all, rate)));
    };
    // pressing the mic again sends what was said so far (a press with no speech still tries)
    stopNow = () => {
      if (chunks.length > 4) heard = true;
      finish();
    };
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d));
      let sum = 0;
      for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      const rms = Math.sqrt(sum / d.length);
      const secs = (performance.now() - t0) / 1000;
      if (secs < 0.3) {
        // v7.5: the quietest block is the room (a kid who starts talking at once won't raise it)
        floor = calib++ ? Math.min(floor, rms) : rms;
        floor = Math.min(floor, 0.02);
        return;
      }
      const on = Math.max(0.006, floor * 2.6);
      useEars.setState({ level: Math.min(1, (rms / Math.max(on, 0.01)) * 0.45) });
      if (rms > on) {
        voiced++;
        quietFor = 0;
        if (voiced >= 2) heard = true;
      } else {
        voiced = 0;
        quietFor += d.length / rate;
        // the floor follows the room slowly while nobody talks
        if (!heard) floor = floor * 0.97 + rms * 0.03;
      }
      // kids pause mid-sentence: wait 1.6 s of quiet before sending
      if ((heard && quietFor > 1.6) || secs > 15 || (!heard && secs > 8)) finish();
    };
    src.connect(proc);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.connect(mute);
    mute.connect(ctx.destination);
  });
}

/**
 * v7.5: trim the silence around the words (keeping 0.25 s of air) and lift quiet voices to a steady
 * level: speech recognisers are much more accurate on a clean, normalised clip.
 */
function tidy(x: Float32Array): Float32Array {
  const win = 320; // 20 ms at 16 kHz
  const e: number[] = [];
  for (let i = 0; i < x.length; i += win) {
    let s = 0;
    for (let j = i; j < Math.min(x.length, i + win); j++) s += x[j] * x[j];
    e.push(Math.sqrt(s / win));
  }
  const peakE = Math.max(...e, 1e-6);
  const gate = Math.max(0.004, peakE * 0.08);
  let a = e.findIndex((v) => v > gate);
  let b = e.length - 1 - [...e].reverse().findIndex((v) => v > gate);
  if (a < 0) return x;
  a = Math.max(0, a * win - 4000);
  b = Math.min(x.length, (b + 1) * win + 4000);
  const y = x.slice(a, b);
  let peak = 0;
  for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
  const g = peak > 1e-4 ? Math.min(12, 0.9 / peak) : 1;
  for (let i = 0; i < y.length; i++) y[i] *= g;
  return y;
}

/** Whisper sometimes "hears" captions in silence; drop those */
function cleanTranscript(t: string) {
  const s = t.replace(/\[[^\]]*\]|\([^)]*\)/g, "").trim();
  if (/^(thank you\.?|thanks for watching!?|you\.?|\.+)$/i.test(s)) return "";
  return s;
}
