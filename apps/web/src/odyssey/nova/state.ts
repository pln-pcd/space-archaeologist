// Nova's live state, shared by every place he appears (cover, name card, dashboard, check-ins).
// Expression and gesture go through zustand (rare changes); the mouth level is a plain object the
// voice player writes every audio frame, read by the 3D face without React re-renders.
import { create } from "zustand";

export type Expression = "neutral" | "happy" | "excited" | "curious" | "thinking" | "listening" | "sorry" | "sleepy";
export type Gesture = "none" | "wave" | "point" | "thumbs" | "spin" | "pop" | "shrug" | "cup" | "jump";

type NovaState = {
  expression: Expression;
  gesture: Gesture;
  /** bumps each time a gesture is (re)started, so the same gesture can replay */
  gestureId: number;
  /** where Nova points (screen-space hint: -1 left … 1 right, -1 down … 1 up) */
  pointAt: [number, number];
  set: (p: Partial<Pick<NovaState, "expression" | "pointAt">>) => void;
  gesture_: (g: Gesture, pointAt?: [number, number]) => void;
};

export const useNova = create<NovaState>((set) => ({
  expression: "happy",
  gesture: "none",
  gestureId: 0,
  pointAt: [0.6, 0],
  set: (p) => set(p),
  gesture_: (g, pointAt) => set((s) => ({ gesture: g, gestureId: s.gestureId + 1, ...(pointAt ? { pointAt } : {}) })),
}));

export const nova = {
  feel: (e: Expression) => useNova.getState().set({ expression: e }),
  act: (g: Gesture, pointAt?: [number, number]) => useNova.getState().gesture_(g, pointAt),
};

/** written by the voice player each frame: 0 = closed … 1 = wide open; viseme hint if timings exist */
export const mouth = { level: 0, speaking: false, viseme: "" as "" | "a" | "o" | "e" | "m" };

/** where Nova's eyes look (x: -1 left … 1 right, y: -1 up … 1 down); `on` = follow it (the cover sets it from the cursor) */
export const gaze = { x: 0, y: 0, on: false };
