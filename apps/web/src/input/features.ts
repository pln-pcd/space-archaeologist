// Hand features from 21 landmarks (bible §5 step 4). Pure, Node-safe.
import type { HandFrame, Vec3 } from "./types.ts";

export type HandFeatures = {
  handedness: "Left" | "Right";
  /** aspect-correct image coords (x scaled by aspect so 1 unit in x == 1 unit in y) */
  wrist: { x: number; y: number };
  palm: { x: number; y: number };
  /** cursor anchor: index knuckle (5) blended 70/30 with palm centre */
  anchor: { x: number; y: number };
  indexTip: { x: number; y: number };
  thumbTip: { x: number; y: number };
  /** palm size in aspect-correct image units: the apparent size, a depth proxy */
  palmScale: number;
  /** 0 curled .. 1 straight, per finger: thumb, index, middle, ring, pinky */
  ext: [number, number, number, number, number];
  /** mean extension of index..pinky */
  ext4: number;
  /** thumb–index tip distance / palm size */
  pinch: number;
  /** palm faces the camera (> 0) or shows its back (< 0), roughly -1..1 */
  facing: number;
  /** in-plane hand roll in radians (0 = fingers up, + = tilted to the kid's right) */
  roll: number;
  /** thumb points up (tip clearly above its joints) */
  thumbUp: number;
  /** L-shape: thumb and index out, others curled, wide angle between them */
  lShape: number;
  /** v8: the thumb is clearly held OUT, away from the palm (0..1). Strict: a thumb resting on the
   *  curled fingers or tucked across the palm scores ~0. Used to count fingers (1-4, never 5). */
  thumbOut: number;
  /** v8: a pointing hand: index straight, middle/ring/pinky curled (0..1). Never a fist. */
  pointing: number;
  /** v8: lenient "the thumb is not tucked" (0..1): with four fingers up this means FIVE */
  thumbAway: number;
  gesture: string;
  gestureScore: number;
};

const sub = (a: Vec3, b: Vec3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const angle = (a: Vec3, b: Vec3) => {
  const d = len(a) * len(b);
  return d < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d)));
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** total bend along a chain of joints, in radians */
function bend(p: Vec3[], chain: number[]) {
  let total = 0;
  for (let i = 1; i < chain.length - 1; i++) total += angle(sub(p[chain[i]], p[chain[i - 1]]), sub(p[chain[i + 1]], p[chain[i]]));
  return total;
}

const FINGERS = [
  [1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];

export function computeFeatures(hand: HandFrame, aspect: number): HandFeatures {
  const L = hand.landmarks;
  // 3D for angles: world landmarks if present (metric, depth-correct), else image coords with aspect.
  const P: Vec3[] = hand.world && hand.world.length === 21 ? hand.world : L.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }));
  const I = L.map((p) => ({ x: p.x * aspect, y: p.y }));
  const d2 = (a: number, b: number) => Math.hypot(I[a].x - I[b].x, I[a].y - I[b].y);
  const palmScale = (d2(0, 9) + d2(5, 17) * 1.15 + d2(0, 5) * 0.95) / 3;
  const palm = {
    x: (I[0].x + I[5].x + I[9].x + I[13].x + I[17].x) / 5,
    y: (I[0].y + I[5].y + I[9].y + I[13].y + I[17].y) / 5,
  };
  const anchor = { x: I[5].x * 0.7 + palm.x * 0.3, y: I[5].y * 0.7 + palm.y * 0.3 };

  // extension from joint angles: a straight finger bends ~0, a curled one ~200°+
  const ext = FINGERS.map((chain, i) => {
    const b = bend(P, chain);
    const full = i === 0 ? 1.4 : 3.2; // radians for "fully curled"
    return clamp01(1 - b / full);
  }) as HandFeatures["ext"];
  // thumb: also require the tip to be away from the index knuckle
  const palmP = len(sub(P[0], P[9])) || 1e-6;
  const thumbOut = clamp01((len(sub(P[4], P[5])) / palmP - 0.35) / 0.5);
  ext[0] = Math.min(ext[0] * 0.5 + thumbOut * 0.5 + 0.1, 1);
  const ext4 = (ext[1] + ext[2] + ext[3] + ext[4]) / 4;

  const pinch = len(sub(P[4], P[8])) / palmP;

  // palm facing from the winding of wrist → index MCP → pinky MCP in the mirrored image
  const v1 = { x: I[5].x - I[0].x, y: I[5].y - I[0].y };
  const v2 = { x: I[17].x - I[0].x, y: I[17].y - I[0].y };
  const cross = (v1.x * v2.y - v1.y * v2.x) / Math.max(1e-6, palmScale * palmScale);
  const facing = Math.max(-1, Math.min(1, (hand.handedness === "Right" ? cross : -cross) * 1.2));

  const up = { x: I[9].x - I[0].x, y: I[9].y - I[0].y };
  const roll = Math.atan2(up.x, -up.y);

  // thumbs up: thumb tip clearly above the thumb MCP, fingers curled
  const thumbRise = (I[2].y - I[4].y) / palmScale;
  const thumbUp = clamp01((thumbRise - 0.45) / 0.5) * clamp01((0.55 - ext4) / 0.3) * clamp01((ext[0] - 0.4) / 0.3);

  // L-shape: thumb + index out, middle/ring/pinky curled, 50–130° between thumb and index
  const tDir = sub(P[4], P[2]);
  const iDir = sub(P[8], P[5]);
  const lAngle = angle(tDir, iDir);
  const curled3 = 1 - (ext[2] + ext[3] + ext[4]) / 3;
  const lShape = clamp01((ext[1] - 0.45) / 0.25) * clamp01((ext[0] - 0.5) / 0.3) * clamp01((curled3 - 0.45) / 0.3) * (lAngle > 0.85 && lAngle < 2.3 ? 1 : 0);

  // v8 strict thumb: the tip must sit well away from the index knuckle AND from the palm centre
  // (a thumb laid across the palm or on the curled fingers is near one of them), and the thumb
  // chain itself must be fairly straight
  const d45 = len(sub(P[4], P[5])) / palmP;
  const d49 = len(sub(P[4], P[9])) / palmP;
  const d413 = len(sub(P[4], P[13])) / palmP;
  const thumbStraight = clamp01(1 - bend(P, [1, 2, 3, 4]) / 1.6);
  const thumbOutV = clamp01((d45 - 0.42) / 0.28) * clamp01((d49 - 0.62) / 0.3) * clamp01((d413 - 0.7) / 0.3) * clamp01((thumbStraight - 0.35) / 0.35);
  const thumbAway = clamp01((d45 - 0.36) / 0.22) * clamp01((d49 - 0.5) / 0.25);
  const rest3 = (ext[2] + ext[3] + ext[4]) / 3;
  const pointing = clamp01((ext[1] - 0.55) / 0.25) * clamp01((0.5 - rest3) / 0.25);

  return {
    handedness: hand.handedness,
    wrist: I[0],
    palm,
    anchor,
    indexTip: I[8],
    thumbTip: I[4],
    palmScale,
    ext,
    ext4,
    pinch,
    facing,
    roll,
    thumbUp,
    lShape,
    thumbOut: thumbOutV,
    thumbAway,
    pointing: Math.max(pointing, hand.gesture === "Pointing_Up" ? hand.gestureScore * 0.9 : 0),
    gesture: hand.gesture,
    gestureScore: hand.gestureScore,
  };
}
