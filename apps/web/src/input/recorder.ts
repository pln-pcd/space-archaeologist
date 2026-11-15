// Landmark recorder (bible §5): JSON landmarks only, NEVER video or images.
// In dev the file goes straight to tools/gesture-recordings/ for `npm run gestures:check`;
// otherwise it downloads as a .json file.
import type { TrackFrame, VerbId } from "./types";

let recording: { label: VerbId | "idle"; frames: TrackFrame[]; started: number } | null = null;

export function startRecording(label: VerbId | "idle") {
  recording = { label, frames: [], started: performance.now() };
}
export function isRecording() {
  return recording;
}
export function pushFrame(f: TrackFrame) {
  if (!recording) return;
  recording.frames.push({ t: Math.round(f.t - recording.started), aspect: f.aspect, hands: f.hands.map((h) => ({ ...h, landmarks: h.landmarks.map(r4), world: h.world?.map(r4) })) });
  if (recording.frames.length > 30 * 120) void stopRecording(); // 2 min cap
}
const r4 = (p: { x: number; y: number; z: number }) => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4) });

export async function stopRecording(): Promise<string | null> {
  const r = recording;
  recording = null;
  if (!r || !r.frames.length) return null;
  const name = `${r.label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const body = JSON.stringify({ version: 1, label: r.label, aspect: r.frames[0].aspect, frames: r.frames });
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`/__gesture-recordings/${name}`, { method: "POST", body, headers: { "Content-Type": "application/json" } });
      if (res.ok) return `tools/gesture-recordings/${name}`;
    } catch {
      /* fall through to download */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return `Downloads/${name}`;
}
