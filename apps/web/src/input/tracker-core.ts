// Shared by the main-thread and Web Worker tracker backends.
import { FilesetResolver, GestureRecognizer, type GestureRecognizerResult } from "@mediapipe/tasks-vision";
import type { HandFrame } from "./types";

export const WASM_BASE = "/mediapipe/wasm";
export const GESTURE_MODEL = "/models/gesture_recognizer.task";

export async function createRecognizer(delegate: "GPU" | "CPU", numHands: number, origin = "", useModule = false) {
  // module workers can't importScripts the classic loader: use MediaPipe's ES-module build there
  const files = await FilesetResolver.forVisionTasks(origin + WASM_BASE, useModule);
  return GestureRecognizer.createFromOptions(files, {
    baseOptions: { modelAssetPath: origin + GESTURE_MODEL, delegate },
    runningMode: "VIDEO",
    numHands,
    // kids' hands in ordinary rooms: slightly lenient detection, steady tracking
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/**
 * MediaPipe sees the raw (un-mirrored) camera frame and labels handedness as if the image were
 * mirrored, so on a raw frame the label is swapped. We mirror x for display and swap the label,
 * giving landmarks that match what the kid sees and the kid's real hand.
 */
export function toHands(r: GestureRecognizerResult): HandFrame[] {
  return r.landmarks.map((lm, i) => {
    const h = r.handedness[i]?.[0];
    const g = r.gestures[i]?.[0];
    return {
      landmarks: lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
      world: r.worldLandmarks[i]?.map((p) => ({ x: -p.x, y: p.y, z: p.z })),
      handedness: h?.categoryName === "Left" ? "Right" : "Left",
      score: h?.score ?? 0,
      gesture: g?.categoryName || "None",
      gestureScore: g?.score ?? 0,
    };
  });
}

/** First inference compiles GPU shaders (can take seconds); pay it once on a tiny blank frame. */
export function warmUp(rec: GestureRecognizer, t: number) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(64, 64) : null;
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#777";
  ctx.fillRect(0, 0, 64, 64);
  rec.recognizeForVideo(c as unknown as HTMLCanvasElement, t);
}
