// /dev/stt?model=<hf id>: speech-to-text benchmark. Kid-style questions are spoken by Kokoro (our local
// server, three voices), resampled to 16 kHz and transcribed ON THIS DEVICE by the same worker the game
// uses. Results (word error rate, ms per clip, device) land in window.__stt for tools/stt_bench.mjs.
import { useEffect, useState } from "react";

const PHRASES = [
  "why is there no wind on the moon",
  "what are martian blueberries",
  "how did opportunity get power",
  "who walked on the moon first",
  "how long did the trip take",
  "why did the rover stop working",
  "can astronauts jump really high on the moon",
  "what did they leave on the moon",
  "is mars really red",
  "how far away is the moon",
];
const VOICES = ["af_sky", "am_puck", "af_bella"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
function wer(ref: string, hyp: string) {
  const r = norm(ref), h = norm(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => Array.from({ length: h.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}

let started = false;
export default function SttBench() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    if (started) return; // React StrictMode runs effects twice in dev: one benchmark only
    started = true;
    const model = new URLSearchParams(location.search).get("model") ?? "onnx-community/whisper-tiny.en";
    const worker = new Worker(new URL("../odyssey/nova/stt.worker.ts", import.meta.url), { type: "module" });
    const say = (s: string) => setLog((l) => [...l, s]);
    let seq = 0;
    const waiting = new Map<number, (t: { text: string; ms: number; device: string }) => void>();
    let ready: () => void;
    const isReady = new Promise<void>((r) => (ready = r));
    const t0 = performance.now();
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") (say(`ready on ${m.device} in ${Math.round(performance.now() - t0)} ms`), ready());
      if (m.type === "error") say("error " + m.error);
      if (m.type === "text") waiting.get(m.id)?.(m);
    };
    worker.postMessage({ type: "load", model, webgpu: "gpu" in navigator && !location.search.includes("wasm") });
    void (async () => {
      await isReady;
      const rows: { ref: string; hyp: string; voice: string; wer: number; ms: number }[] = [];
      const ctx = new AudioContext();
      for (const voice of VOICES)
        for (const ref of PHRASES) {
          const r = await fetch("/api/nova/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: ref, voice }) });
          const buf = await ctx.decodeAudioData(await r.arrayBuffer());
          const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
          const src = off.createBufferSource();
          src.buffer = buf;
          src.connect(off.destination);
          src.start();
          const pcm = (await off.startRendering()).getChannelData(0).slice();
          const id = ++seq;
          const res = await new Promise<{ text: string; ms: number; device: string }>((resolve) => {
            waiting.set(id, resolve);
            worker.postMessage({ type: "run", id, audio: pcm }, [pcm.buffer]);
          });
          rows.push({ ref, hyp: res.text, voice, wer: wer(ref, res.text), ms: res.ms });
          say(`${voice} · ${ref} → ${res.text} (${res.ms} ms)`);
        }
      const avg = (k: "wer" | "ms") => rows.reduce((a, r) => a + r[k], 0) / rows.length;
      (window as unknown as { __stt: unknown }).__stt = { model, wer: +avg("wer").toFixed(3), msPerClip: Math.round(avg("ms")), exact: rows.filter((r) => r.wer === 0).length, n: rows.length, rows, loadMs: 0 };
      say("done");
    })();
  }, []);
  return <pre style={{ font: "14px monospace", padding: 16 }}>{log.join("\n")}</pre>;
}
