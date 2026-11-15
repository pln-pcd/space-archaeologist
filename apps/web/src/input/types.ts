// Shared types for the Star Gloves input system (bible §4–5).
// Pure: no DOM imports, so tools/gestures_check.ts can run this code in Node.

import type { MissionCommand } from "../missions/types";
export type Vec3 = { x: number; y: number; z: number };
export type Handedness = "Left" | "Right";

/**
 * One tracked hand, already corrected for the mirror:
 * - `landmarks` are normalised image coords where x = 0 is the LEFT of what the kid sees
 *   (the preview is mirrored like a bathroom mirror), y = 0 is the top.
 * - `handedness` is the kid's real hand.
 */
export type HandFrame = {
  landmarks: Vec3[];
  world?: Vec3[];
  handedness: Handedness;
  score: number;
  gesture: string; // MediaPipe canned label: Closed_Fist, Open_Palm, Pointing_Up, Thumb_Up, Thumb_Down, Victory, ILoveYou, None
  gestureScore: number;
};

export type TrackFrame = {
  /** milliseconds (performance.now or recording time) */
  t: number;
  hands: HandFrame[];
  /** video aspect ratio (width / height) */
  aspect: number;
};

export type Source = "gesture" | "mouse" | "touch" | "keyboard";

/** The verbs a scene can enable (bible §4). */
export const VERBS = [
  "pointer",
  "pinch",
  "grab",
  "palmHold",
  "wave",
  "swipe",
  "dial",
  "steer",
  "push",
  "pilot",
  "frame",
  "thumbsUp",
  "fistStamp",
  "count",
] as const;
export type VerbId = (typeof VERBS)[number];

/** Intent payloads (bible §5 step 8) plus a few navigation helpers that are not gestures. */
export type IntentMap = {
  archiveSelect: { id: string };
  reconstructionPick: Record<string, never>;
  activityControl: { artifactId: string; action: string };
  evidencePick: { id: string };
  hubStation: { id: string };
  avatarAction: { action: string; value: string };
  missionAction: { missionId: string; command: MissionCommand };
  destination: { x: number; z: number };
  activate: Record<string, never>;
  jump: Record<string, never>;
  look: { dx:number; dy:number };
  /** Screen-space hand intent; feature/landmark interpretation stays inside the input engine. */
  handMotion: { hand: string; x: number; y: number; open: boolean; pointing: boolean };
  pointer: { x: number; y: number; visible: boolean; snapped?: string | null };
  pinchStart: { x: number; y: number };
  pinchMove: { x: number; y: number; dx: number; dy: number };
  pinchEnd: { x: number; y: number; cancelled?: boolean };
  grab: { x: number; y: number };
  release: { x: number; y: number; vx: number; vy: number; speed: number };
  palmHold: { progress: number; done: boolean; x: number; y: number };
  wave: { strength: number };
  swipe: { dir: "left" | "right" | "up" | "down" };
  dial: { delta: number; angle: number };
  steer: { value: number; active: boolean };
  push: { strength: number };
  pilot: { throttle: number; steer: number; active: boolean };
  frame: Record<string, never>;
  thumbsUp: Record<string, never>;
  fistStamp: { x: number; y: number };
  /** v7.6 finger counting (quizzes): 1-4 straight fingers held still; progress fills, done fires once */
  fingers: { count: number; progress: number; done: boolean };
  // navigation and UI helpers (fallback-friendly, always enabled)
  move: { x: number; y: number };
  turnView: { delta: number };
  zoomView: { delta: number };
  choose: { index: number };
  back: Record<string, never>;
};
export type IntentName = keyof IntentMap;
export type IntentEvent<K extends IntentName = IntentName> = IntentMap[K] & { name: K; source: Source; t: number };

/** Which verb a given intent belongs to (for scene scoping). null = always allowed. */
export const INTENT_VERB: Record<IntentName, VerbId | null> = {
  archiveSelect: null,
  reconstructionPick: null,
  activityControl: null,
  evidencePick: null,
  hubStation: null,
  avatarAction: null,
  missionAction: null,
  destination: null,
  activate: null,
  jump: null,
  look: null,
  handMotion: "wave",
  pointer: null,
  pinchStart: "pinch",
  pinchMove: "pinch",
  pinchEnd: "pinch",
  grab: "grab",
  release: "grab",
  palmHold: "palmHold",
  wave: "wave",
  swipe: "swipe",
  dial: "dial",
  steer: "steer",
  push: "push",
  pilot: "pilot",
  frame: "frame",
  thumbsUp: "thumbsUp",
  fistStamp: "fistStamp",
  fingers: "count",
  move: null,
  turnView: null,
  zoomView: null,
  choose: null,
  back: null,
};

/** Per-kid calibration (bible §5 step 7). Thresholds sit 40% of the way between closed and open. */
export type Calibration = {
  /** average 4-finger extension (0 curled .. 1 straight) with an open hand */
  openExt: number;
  /** average 4-finger extension with a fist */
  fistExt: number;
  /** thumb–index distance / palm size, hand open */
  pinchOpen: number;
  /** thumb–index distance / palm size, pinching */
  pinchClosed: number;
  samples: number;
  /** v8 Hand Training: each digit's extension (thumb..pinky) with the hand open and with a fist,
   *  so finger counting uses this player's own hand instead of fixed thresholds */
  fingerOpen?: number[];
  fingerCurled?: number[];
};
export const DEFAULT_CALIBRATION: Calibration = { openExt: 0.9, fistExt: 0.15, pinchOpen: 0.9, pinchClosed: 0.12, samples: 0 };

export type Tuning = {
  /** One Euro filter on the cursor (pixels). Casiez procedure: beta 0, raise mincutoff until still = steady, then raise beta. */
  cursorMinCutoff: number;
  cursorBeta: number;
  /** central fraction of the camera frame that maps to the whole screen */
  boxSize: number;
  /** aim-assist snap radius in px */
  snapRadius: number;
  /** 0.5 (calm) .. 1.5 (sensitive) */
  sensitivity: number;
  /** palm hold time in ms */
  palmHoldMs: number;
};
export const DEFAULT_TUNING: Tuning = {
  cursorMinCutoff: 1.0,
  cursorBeta: 0.02,
  boxSize: 0.6,
  snapRadius: 80,
  sensitivity: 1,
  palmHoldMs: 1200,
};
