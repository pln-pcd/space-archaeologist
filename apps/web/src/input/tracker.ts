// GestureRecognizer runner (bible §5 step 2): VIDEO mode, numHands 2 (4 for Duo later),
// GPU with CPU fallback, driven by requestVideoFrameCallback, at most 30 Hz, decoupled from the
// 60 fps render loop. Frames are dropped, never queued. Backend: main thread (default) or worker.
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { downgradeCamera } from "./camera";
import { useInput } from "./store";
import { createRecognizer, toHands, warmUp } from "./tracker-core";
import type { TrackFrame } from "./types";

type Listener = (f: TrackFrame) => void;
const MIN_INTERVAL = 1000 / 30;
const FRAME_W = 512;

export class Tracker {
  private rec: GestureRecognizer | null = null;
  private worker: Worker | null = null;
  private video: HTMLVideoElement | null = null;
  private running = false;
  private busy = false;
  private lastInfer = 0;
  private lastTs = 0;
  private listeners = new Set<Listener>();
  private emaMs = 0;
  private frames: number[] = [];
  private slowSince = 0;
  private downgraded = false;
  private handle = 0;
  backend: "main" | "worker";
  numHands: number;

  constructor(opts: { backend?: "main" | "worker"; numHands?: number } = {}) {
    const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("tracker") : null;
    // worker by default: measured in docs/research/gestures.md (no UI freeze during GPU warm-up,
    // render loop keeps its frame budget). ?tracker=main forces the main thread.
    this.backend = q === "worker" || q === "main" ? q : opts.backend ?? (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" ? "worker" : "main");
    this.numHands = opts.numHands ?? 2;
  }

  onFrame(f: Listener) {
    this.listeners.add(f);
    return () => void this.listeners.delete(f);
  }

  async init(): Promise<void> {
    const set = useInput.getState().set;
    if (this.rec || this.worker) return;
    set({ tracker: "loading", backend: this.backend, error: "" });
    const forceCpu = typeof location !== "undefined" && new URLSearchParams(location.search).get("delegate") === "cpu";
    if (this.backend === "worker") {
      const w = new Worker(new URL("./tracker.worker.ts", import.meta.url), { type: "module" });
      const ok = await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Hand tracker took too long to start")), 45000);
        w.onmessage = (e) => {
          if (e.data.type === "ready") {
            clearTimeout(t);
            set({ delegate: e.data.delegate });
            console.info(`[gloves] worker ready (${e.data.delegate}), warm-up ${Math.round(e.data.warmMs)} ms`);
            resolve();
          } else if (e.data.type === "error") {
            clearTimeout(t);
            reject(new Error(e.data.message));
          }
        };
        set({ tracker: "warming" });
        w.postMessage({ type: "init", numHands: this.numHands, origin: location.origin, forceCpu });
      }).catch((e) => {
        console.warn("[gloves] worker init failed, falling back to the main thread:", String(e?.message ?? e));
        w.terminate();
        return "fallback" as const;
      });
      if (ok === "fallback") {
        this.backend = "main";
        set({ backend: "main" });
        return this.init();
      }
      w.onmessage = (e) => {
        if (e.data.type !== "result") return;
        this.busy = false;
        this.publish(e.data.t, e.data.hands, e.data.ms);
      };
      this.worker = w;
    } else {
      let lastErr: unknown = null;
      for (const delegate of (forceCpu ? ["CPU"] : ["GPU", "CPU"]) as ("GPU" | "CPU")[]) {
        try {
          const rec = await createRecognizer(delegate, this.numHands);
          set({ tracker: "warming" });
          // let the "warming up" UI paint before a possibly long shader compile
          await new Promise((r) => setTimeout(r, 30));
          const t0 = performance.now();
          warmUp(rec, 1);
          this.lastTs = 1;
          console.info(`[gloves] main-thread ready (${delegate}), warm-up ${Math.round(performance.now() - t0)} ms`);
          this.rec = rec;
          set({ delegate });
          break;
        } catch (e) {
          console.warn(`[gloves] ${delegate} init failed:`, String((e as Error)?.message ?? e));
          lastErr = e;
        }
      }
      if (!this.rec) {
        set({ tracker: "error", error: String((lastErr as Error)?.message ?? lastErr) });
        throw lastErr;
      }
    }
    set({ tracker: "ready" });
  }

  start(video: HTMLVideoElement) {
    this.video = video;
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running || !this.video) return;
      this.schedule();
      this.infer();
    };
    this.tickFn = tick;
    this.schedule();
  }
  private tickFn: () => void = () => {};
  private useRaf = false;
  private lastTick = 0;
  private schedule() {
    const v = this.video as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
    if (!v) return;
    if (v.requestVideoFrameCallback && !this.useRaf) {
      this.handle = v.requestVideoFrameCallback(() => {
        this.lastTick = performance.now();
        this.tickFn();
      });
      // safety net: if no video frame callback arrives within 600 ms, poll with rAF instead
      const armed = performance.now();
      setTimeout(() => {
        if (this.running && this.lastTick < armed && !this.useRaf) {
          this.useRaf = true;
          console.info("[gloves] requestVideoFrameCallback silent; using rAF polling");
          this.handle = requestAnimationFrame(this.tickFn);
        }
      }, 600);
    } else this.handle = requestAnimationFrame(this.tickFn);
  }

  stop() {
    this.running = false;
    const v = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }) | null;
    if (v?.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this.handle);
    else cancelAnimationFrame(this.handle);
    this.video = null;
  }

  dispose() {
    this.stop();
    this.rec?.close();
    this.rec = null;
    this.worker?.terminate();
    this.worker = null;
    useInput.getState().set({ tracker: "idle", delegate: null });
  }

  private infer() {
    const v = this.video;
    if (!v || this.busy || v.readyState < 2 || !v.videoWidth) return;
    const now = performance.now();
    if (now - this.lastInfer < MIN_INTERVAL - 2) return; // ≤ 30 Hz
    this.lastInfer = now;
    if (this.worker) {
      this.busy = true;
      // the palm detector looks at 192 px and the landmark model at 224 px: a 512-wide copy keeps
      // detail for small hands and cuts the copy and GPU upload cost ~4× versus 960×540
      const w = Math.min(v.videoWidth, FRAME_W);
      createImageBitmap(v, { resizeWidth: w, resizeHeight: Math.round((w * v.videoHeight) / v.videoWidth), resizeQuality: "low" })
        .then((frame) => this.worker?.postMessage({ type: "frame", frame, t: now }, [frame]))
        .catch(() => (this.busy = false));
      return;
    }
    if (!this.rec) return;
    const ts = Math.max(this.lastTs + 1, now);
    this.lastTs = ts;
    const t0 = performance.now();
    let hands: TrackFrame["hands"] = [];
    try {
      hands = toHands(this.rec.recognizeForVideo(v, ts));
    } catch {
      hands = [];
    }
    this.publish(now, hands, performance.now() - t0);
  }

  private publish(t: number, hands: TrackFrame["hands"], ms: number) {
    this.emaMs = this.emaMs ? this.emaMs * 0.9 + ms * 0.1 : ms;
    this.frames.push(t);
    while (this.frames.length && t - this.frames[0] > 1000) this.frames.shift();
    // too slow for 30 Hz for 2 s → drop the camera to 640×360 once
    if (this.emaMs > 28) {
      if (!this.slowSince) this.slowSince = t;
      if (!this.downgraded && t - this.slowSince > 2000) {
        this.downgraded = true;
        void downgradeCamera();
      }
    } else this.slowSince = 0;
    const v = this.video;
    const aspect = v && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    const frame: TrackFrame = { t, hands, aspect };
    this.listeners.forEach((l) => l(frame));
  }

  stats() {
    return { inferenceMs: this.emaMs, fps: this.frames.length };
  }
}
