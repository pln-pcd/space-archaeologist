// Synthetic hand-landmark sequences for tools/gestures_check.ts.
// A simple kinematic hand (21 MediaPipe-style points) posed and moved procedurally, with jitter and
// dropouts. It checks the state machines' logic and thresholds; it does NOT replace recordings of
// real kids' hands (record those with the F9 debug overlay → "Record").
import type { HandFrame, TrackFrame, Vec3 } from "../apps/web/src/input/types.ts";

export type Pose = {
  curl: [number, number, number, number, number]; // thumb, index, middle, ring, pinky (0 straight .. 1 curled)
  pinch?: number; // 0..1: thumb tip moves onto the index tip
  thumbUp?: boolean; // thumb points along the hand's "up" while fingers curl
  lThumb?: boolean; // thumb sticks straight out sideways (L-shape)
};
export type Place = { x: number; y: number; size: number; roll: number; back?: boolean };

const MCP: [number, number][] = [
  [-0.36, -0.95],
  [-0.06, -1.0],
  [0.22, -0.95],
  [0.46, -0.84],
];
const SEG = [
  [0.45, 0.27, 0.22],
  [0.5, 0.3, 0.23],
  [0.46, 0.28, 0.22],
  [0.36, 0.22, 0.2],
];

/** Local hand: wrist at origin, palm length 1, fingers toward -y, palm facing the camera (-z). Right hand, mirrored view. */
export function handLocal(p: Pose): Vec3[] {
  const pts: Vec3[] = new Array(21);
  pts[0] = { x: 0, y: 0, z: 0 };
  for (let f = 0; f < 4; f++) {
    const [mx, my] = MCP[f];
    const base = 5 + f * 4;
    pts[base] = { x: mx, y: my, z: 0 };
    const dl = Math.hypot(mx * 0.35, my);
    const d = { x: (mx * 0.35) / dl, y: my / dl };
    const c = p.curl[f + 1];
    const flex = [70 * c, 100 * c, 65 * c].map((a) => (a * Math.PI) / 180);
    let th = 0;
    let cur = pts[base];
    for (let s = 0; s < 3; s++) {
      th += flex[s];
      const L = SEG[f][s];
      const nxt = { x: cur.x + d.x * Math.cos(th) * L, y: cur.y + d.y * Math.cos(th) * L, z: cur.z - Math.sin(th) * L };
      pts[base + s + 1] = nxt;
      cur = nxt;
    }
  }
  // thumb
  const tc = p.curl[0];
  pts[1] = { x: -0.22, y: -0.22, z: -0.05 };
  if (p.thumbUp) {
    // thumb runs along the finger direction (it will point "up" once the hand is rolled 90°)
    pts[2] = { x: -0.42, y: -0.55, z: -0.2 };
    pts[3] = { x: -0.45, y: -1.0, z: -0.25 };
    pts[4] = { x: -0.47, y: -1.45, z: -0.28 };
  } else if (p.lThumb) {
    pts[2] = { x: -0.5, y: -0.3, z: -0.05 };
    pts[3] = { x: -0.78, y: -0.34, z: -0.05 };
    pts[4] = { x: -1.02, y: -0.37, z: -0.05 };
  } else if (tc > 0.7) {
    // thumb tucked across the curled fingers
    pts[2] = { x: -0.4, y: -0.45, z: -0.15 };
    pts[3] = { x: -0.3, y: -0.68, z: -0.3 };
    pts[4] = { x: -0.1, y: -0.74, z: -0.4 };
  } else {
    const a = (-2.25 + tc * 1.4) as number; // fan angle
    const r = [0.33, 0.6, 0.85].map((v) => v * (1 - tc * 0.35));
    for (let s = 0; s < 3; s++) pts[2 + s] = { x: -0.22 + Math.cos(a) * r[s] * 0.75, y: -0.3 + Math.sin(a) * r[s] * 0.75, z: -0.05 - tc * 0.25 * (s + 1) };
  }
  const pn = p.pinch ?? 0;
  if (pn > 0) {
    // move the thumb chain so its tip meets the index tip
    const tip = pts[8];
    const from = pts[4];
    for (let s = 2; s <= 4; s++) {
      const w = ((s - 1) / 3) * pn;
      pts[s] = { x: pts[s].x + (tip.x - from.x) * w, y: pts[s].y + (tip.y - from.y) * w, z: pts[s].z + (tip.z - from.z) * w };
    }
  }
  return pts;
}

let seed = 12345;
export function reseed(s: number) {
  seed = s;
}
export const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

/** Place a local hand into the mirrored image (normalised coords) + world landmarks. */
export function place(local: Vec3[], at: Place, aspect: number, jitter = 0.0018): { lm: Vec3[]; world: Vec3[] } {
  const c = Math.cos(at.roll),
    s = Math.sin(at.roll);
  const flip = at.back ? -1 : 1; // back of the hand: mirror x
  const lm = local.map((p) => {
    const lx = p.x * flip,
      ly = p.y;
    const rx = lx * c - ly * s,
      ry = lx * s + ly * c;
    return { x: at.x + (rx * at.size) / aspect + gauss() * jitter, y: at.y + ry * at.size + gauss() * jitter, z: p.z * at.size + gauss() * jitter };
  });
  const world = local.map((p) => {
    const lx = p.x * flip;
    return { x: (lx * c - p.y * s) * 0.09 + gauss() * 0.0015, y: (lx * s + p.y * c) * 0.09 + gauss() * 0.0015, z: p.z * 0.09 + gauss() * 0.0015 };
  });
  return { lm, world };
}

export const OPEN: Pose = { curl: [0, 0.03, 0.02, 0.04, 0.05] };
export const RELAXED: Pose = { curl: [0.3, 0.3, 0.38, 0.45, 0.5] };
export const FIST: Pose = { curl: [0.85, 0.95, 0.97, 0.97, 0.95] };

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    curl: a.curl.map((v, i) => v + (b.curl[i] - v) * k) as Pose["curl"],
    pinch: (a.pinch ?? 0) + ((b.pinch ?? 0) - (a.pinch ?? 0)) * k,
    thumbUp: k > 0.5 ? b.thumbUp : a.thumbUp,
    lThumb: k > 0.5 ? b.lThumb : a.lThumb,
  };
}

export type Key = { t: number; pose: Pose; at: Place; gesture?: string };
export type HandTrack = { hand: "Left" | "Right"; keys: Key[] };

/** Sample keyframed hand tracks at fps into TrackFrames (linear interpolation, jitter, dropouts). */
export function render(tracks: HandTrack[], durationMs: number, opts: { fps?: number; aspect?: number; dropout?: number; jitter?: number } = {}): TrackFrame[] {
  const fps = opts.fps ?? 30,
    aspect = opts.aspect ?? 16 / 9,
    drop = opts.dropout ?? 0.02;
  const frames: TrackFrame[] = [];
  for (let t = 0; t <= durationMs; t += 1000 / fps) {
    const hands: HandFrame[] = [];
    for (const tr of tracks) {
      const k = tr.keys;
      if (!k.length || t < k[0].t || t > k[k.length - 1].t) continue;
      let i = 0;
      while (i < k.length - 2 && t > k[i + 1].t) i++;
      const a = k[i],
        b = k[i + 1] ?? a;
      const u = b.t === a.t ? 0 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      const e = u * u * (3 - 2 * u);
      const pose = lerpPose(a.pose, b.pose, e);
      const at: Place = { x: a.at.x + (b.at.x - a.at.x) * e, y: a.at.y + (b.at.y - a.at.y) * e, size: a.at.size + (b.at.size - a.at.size) * e, roll: a.at.roll + (b.at.roll - a.at.roll) * e, back: a.at.back };
      if (rand() < drop) continue;
      let local = handLocal(pose);
      if (tr.hand === "Left") local = local.map((p) => ({ ...p, x: -p.x }));
      const { lm, world } = place(local, at, aspect, opts.jitter);
      hands.push({ landmarks: lm, world, handedness: tr.hand, score: 0.95, gesture: (u < 0.5 ? a.gesture : b.gesture) ?? "None", gestureScore: 0.8 });
    }
    frames.push({ t: Math.round(t), hands, aspect });
  }
  return frames;
}
