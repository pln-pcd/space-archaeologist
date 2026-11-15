// Adapted from TensorFlow.js models shared/filters (relative_velocity_filter.ts) and MediaPipe
// landmarks_smoothing_calculator: Copyright 2021 Google LLC. Licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Re-written here; see CREDITS.md.
//
// Landmark smoothing (pure, Node-safe). A port of the "relative velocity filter" that MediaPipe's
// LandmarksSmoothingCalculator and TF.js shared/filters use (Apache-2.0; see CREDITS.md):
// each coordinate is low-pass filtered with an alpha that grows with how fast the hand moves,
// measured relative to the hand's size. Still hands stop jittering (steadier pinch / pose
// detection), fast moves pass through with no lag.
import type { HandFrame, Vec3 } from "./types.ts";

type Win = { distance: number; duration: number };

class VelocityFilter {
  private win: Win[] = [];
  private last = 0;
  private lastScale = 1;
  private lastT = -1;
  private out = 0;
  private init = false;
  private windowSize: number;
  private velocityScale: number;
  constructor(windowSize: number, velocityScale: number) {
    this.windowSize = windowSize;
    this.velocityScale = velocityScale;
  }
  apply(value: number, tMs: number, valueScale: number) {
    if (this.lastT >= tMs) return this.init ? this.out : value;
    let alpha = 1;
    if (this.lastT >= 0) {
      const distance = value * valueScale - this.last * this.lastScale;
      const duration = tMs - this.lastT;
      let cd = distance,
        ct = duration;
      const maxT = (1 + this.win.length) * (1000 / 30);
      for (const w of this.win) {
        if (ct + w.duration > maxT) break;
        cd += w.distance;
        ct += w.duration;
      }
      const velocity = cd / (ct / 1000);
      alpha = 1 - 1 / (1 + this.velocityScale * Math.abs(velocity));
      this.win.unshift({ distance, duration });
      if (this.win.length > this.windowSize) this.win.pop();
    }
    this.last = value;
    this.lastScale = valueScale;
    this.lastT = tMs;
    this.out = this.init ? this.out + alpha * (value - this.out) : value;
    this.init = true;
    return this.out;
  }
}

class PointsFilter {
  private f: VelocityFilter[][] = [];
  constructor(n: number, windowSize = 5, velocityScale = 10) {
    this.f = Array.from({ length: n }, () => [0, 1, 2].map(() => new VelocityFilter(windowSize, velocityScale)));
  }
  apply(pts: Vec3[], tMs: number, scale: number): Vec3[] {
    const vs = 1 / Math.max(1e-6, scale);
    return pts.map((p, i) => ({ x: this.f[i][0].apply(p.x, tMs, vs), y: this.f[i][1].apply(p.y, tMs, vs), z: this.f[i][2].apply(p.z, tMs, vs) }));
  }
}

/** object scale as MediaPipe defines it: mean of the landmark bounding box width and height */
function objectScale(pts: Vec3[]) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return (x1 - x0 + (y1 - y0)) / 2;
}

type Track = { img: PointsFilter; world: PointsFilter; seen: number; wrist: { x: number; y: number } };

/**
 * Smooths every tracked hand between frames. Hands are matched to their track by wrist position
 * (MediaPipe's left/right label can flip for a frame; matching by place keeps the filter going).
 */
export class HandSmoother {
  private tracks: Track[] = [];
  apply(hands: HandFrame[], tMs: number): HandFrame[] {
    this.tracks = this.tracks.filter((t) => tMs - t.seen < 300);
    const used = new Set<Track>();
    return hands.map((h) => {
      const w = h.landmarks[0];
      let best: Track | null = null,
        bd = 0.25;
      for (const t of this.tracks) {
        if (used.has(t)) continue;
        const d = Math.hypot(t.wrist.x - w.x, t.wrist.y - w.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (!best) {
        best = { img: new PointsFilter(21), world: new PointsFilter(21), seen: tMs, wrist: { x: w.x, y: w.y } };
        this.tracks.push(best);
      }
      used.add(best);
      best.seen = tMs;
      best.wrist = { x: w.x, y: w.y };
      const landmarks = best.img.apply(h.landmarks, tMs, objectScale(h.landmarks));
      const world = h.world && h.world.length === 21 ? best.world.apply(h.world, tMs, objectScale(h.world)) : h.world;
      return { ...h, landmarks, world };
    });
  }
  reset() {
    this.tracks = [];
  }
}
