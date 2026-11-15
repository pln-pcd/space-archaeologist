// Silent per-kid calibration (bible §5 step 7): Glove Academy steps feed samples while the kid
// plays; thresholds then sit 40% of the way between their own closed and open values.
import { useStore } from "../store";
import type { HandFeatures } from "./features";
import { DEFAULT_CALIBRATION, type Calibration } from "./types";

type Kind = "open" | "fist" | "pinch";
const samples: Record<Kind, { ext: number[]; pinch: number[]; fingers: number[][] }> = { open: { ext: [], pinch: [], fingers: [] }, fist: { ext: [], pinch: [], fingers: [] }, pinch: { ext: [], pinch: [], fingers: [] } };

export function observe(kind: Kind, f: HandFeatures) {
  const s = samples[kind];
  s.ext.push(f.ext4);
  s.pinch.push(f.pinch);
  s.fingers.push([...f.ext]);
  if (s.ext.length > 90) {
    s.ext.shift();
    s.pinch.shift();
    s.fingers.shift();
  }
}
/** v8: how many samples of a kind Hand Training has collected (for its progress ring) */
export const sampleCount = (kind: Kind) => samples[kind].ext.length;

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};

export function currentCalibration(): Calibration {
  return useStore.getState().profile?.calibration ?? DEFAULT_CALIBRATION;
}

export const hasSamples = () => samples.open.ext.length + samples.fist.ext.length + samples.pinch.ext.length > 0;

/** Merge new samples into the profile. Values are clamped so a bad sample can't break a verb. */
export function commitCalibration() {
  const base = currentCalibration();
  const openExt = median(samples.open.ext);
  const fistExt = median(samples.fist.ext);
  const pinchOpen = median(samples.open.pinch);
  const pinchClosed = median(samples.pinch.pinch);
  const pick = (v: number, fallback: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);
  const next: Calibration = {
    openExt: pick(openExt, base.openExt, 0.55, 1),
    fistExt: pick(fistExt, base.fistExt, 0, 0.45),
    pinchOpen: pick(pinchOpen, base.pinchOpen, 0.5, 1.6),
    pinchClosed: pick(pinchClosed, base.pinchClosed, 0.02, 0.35),
    samples: base.samples + samples.open.ext.length + samples.fist.ext.length + samples.pinch.ext.length,
    fingerOpen: base.fingerOpen,
    fingerCurled: base.fingerCurled,
  };
  // v8: per-digit open and curled values (median per digit), kept only when they make sense
  const perDigit = (rows: number[][]) => (rows.length >= 8 ? [0, 1, 2, 3, 4].map((d) => median(rows.map((r) => r[d]))) : undefined);
  const fo = perDigit(samples.open.fingers), fc = perDigit(samples.fist.fingers);
  if (fo && fo.slice(1).every((v) => v > 0.5)) next.fingerOpen = fo.map((v) => Math.min(1, v));
  if (fc && fc.slice(1).every((v) => v < 0.55)) next.fingerCurled = fc.map((v) => Math.max(0, v));
  // keep a usable gap between closed and open
  if (next.openExt - next.fistExt < 0.3) next.fistExt = Math.max(0, next.openExt - 0.3);
  if (next.pinchOpen - next.pinchClosed < 0.3) next.pinchClosed = Math.max(0.02, next.pinchOpen - 0.3);
  useStore.getState().updateProfile({ calibration: next });
  (Object.keys(samples) as Kind[]).forEach((k) => {
    samples[k].ext = [];
    samples[k].pinch = [];
    samples[k].fingers = [];
  });
  return next;
}
