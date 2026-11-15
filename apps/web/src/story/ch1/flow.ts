// Chapter 1 flow (bible §8): one state machine, no hand tracking until the
// post-story mini-game.
// (new flow) A_VIDEO → B_LAUNCH → C_TRIP_AND_LANDING → D_FIRST_STEPS → E_STORY →
// F_CHECKIN (Nova) → G_CAMERA_CHECK → G_MINIGAME → RESULTS → STAMP → BACK_TO_SHIP (the dashboard).
// Autosaves after each state (resume at the start of the last one); deep links ?chapter=1&scene=A…G.
import { chapterFlow } from "../shared/chapterFlow";
import ch1 from "../../content/chapters/ch1-moon.json";
import { useStore } from "../../store";

export const SCENES = ["A_VIDEO", "B_LAUNCH", "C_TRIP_AND_LANDING", "D_FIRST_STEPS", "E_STORY", "F_CHECKIN", "G_CAMERA_CHECK", "G_MINIGAME", "RESULTS", "STAMP", "BACK_TO_SHIP"] as const;
export type SceneId = (typeof SCENES)[number];
const LETTER: Record<string, SceneId> = { A: "A_VIDEO", B: "B_LAUNCH", C: "C_TRIP_AND_LANDING", D: "D_FIRST_STEPS", E: "E_STORY", F: "F_CHECKIN", G: "G_CAMERA_CHECK" };

export type Line = { id: string; speaker: string; type: "fact" | "imagine"; text: string; sourceIds?: string[]; glossary?: string[]; vo?: boolean; audio?: string; who?: string; shot?: string; icon?: string; verbatim?: boolean };
type Beat = { id: string; title: string; lines: Line[]; video?: { src: string; poster: string; captions: string; credit: string } };
const BEATS = (ch1 as unknown as { beats: Beat[] }).beats;
export const beat = (id: string) => BEATS.find((b) => b.id === id)!;
export const LINES: Record<string, Line> = Object.fromEntries(BEATS.flatMap((b) => b.lines).map((l) => [l.id, l]));
export const line = (id: string) => LINES[id];

/** the starting scene: ?scene=A…G, a saved resume point, or the NASA video */
export const { startScene, next, useFlow: useCh1 } = chapterFlow<SceneId, Result>("eagle", SCENES, LETTER, "A_VIDEO");

type Result = { kg: number; stars: number; mode: "camera" | "mouse" };
if (import.meta.env.DEV) (window as unknown as { __ch1Flow: typeof useCh1 }).__ch1Flow = useCh1;
export const sceneLetter = (s: SceneId) => Object.entries(LETTER).find(([, v]) => v === s)?.[0] ?? "";
