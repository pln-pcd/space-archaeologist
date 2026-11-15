// Web Worker backend: same recognizer, off the main thread. Kept only if it measurably helps
// (see docs/research/gestures.md). Frames arrive as transferred ImageBitmaps and are always closed.
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { createRecognizer, toHands, warmUp } from "./tracker-core";

let rec: GestureRecognizer | null = null;
let lastTs = 0;

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    for (const delegate of (m.forceCpu ? ["CPU"] : ["GPU", "CPU"]) as ("GPU" | "CPU")[]) {
      try {
        rec = await createRecognizer(delegate, m.numHands, m.origin, true);
        const t0 = performance.now();
        warmUp(rec, 1);
        lastTs = 1;
        self.postMessage({ type: "ready", delegate, warmMs: performance.now() - t0 });
        return;
      } catch (err) {
        rec = null;
        console.warn(`[gloves-worker] ${delegate} failed:`, String((err as Error)?.message ?? err));
        if (delegate === "CPU") self.postMessage({ type: "error", message: String((err as Error)?.message ?? err) });
      }
    }
  } else if (m.type === "frame") {
    const bmp: ImageBitmap = m.frame;
    try {
      if (!rec) return;
      const ts = Math.max(lastTs + 1, m.t);
      lastTs = ts;
      const t0 = performance.now();
      const r = rec.recognizeForVideo(bmp, ts);
      self.postMessage({ type: "result", t: m.t, ms: performance.now() - t0, hands: toHands(r) });
    } catch (err) {
      self.postMessage({ type: "result", t: m.t, ms: 0, hands: [], error: String((err as Error)?.message ?? err) });
    } finally {
      bmp.close();
    }
  }
};
