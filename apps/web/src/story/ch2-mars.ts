import content from "../content/chapters/ch2-mars.json";
import type { Line } from "./ch1/flow";
import { chapterFlow } from "./shared/chapterFlow";
import { contentVoice } from "./shared/contentVoice";

// v7.2: the chapter opens on its story films (landing, roll-off, the story), then the real NASA
// video, then "your turn" launch, the check-in, hands-or-mouse and the Sol Keeper game
export const SCENES = ["C_CRUISE_AND_LANDING", "D_ROLL_OFF", "E_STORY", "A_VIDEO", "B_LAUNCH", "F_CHECKIN", "G_CAMERA_CHECK", "G_MINIGAME", "RESULTS", "STAMP", "BACK_TO_SHIP"] as const;
export type MarsScene = typeof SCENES[number];
export type SolResult = { sols: number; blueberries: number; events: number; stars: number };
const LETTER: Record<string, MarsScene> = { A: "A_VIDEO", B: "B_LAUNCH", C: "C_CRUISE_AND_LANDING", D: "D_ROLL_OFF", E: "E_STORY", F: "F_CHECKIN", G: "G_CAMERA_CHECK" };
export const { useFlow: useCh2, startScene, next } = chapterFlow<MarsScene, SolResult>("opportunity", SCENES, LETTER, "C_CRUISE_AND_LANDING");
if(import.meta.env.DEV)(window as unknown as {__marsFlow:typeof useCh2}).__marsFlow=useCh2;
type MarsBeat = { id:string; title:string; lines:Line[]; video?:{src:string;poster:string;captions:string;credit:string} };
export const beat = (id: string) => (content.beats as unknown as MarsBeat[]).find(b => b.id === id)!;
const lines = Object.fromEntries(content.beats.flatMap(b => b.lines).map(l => [l.id, l])) as Record<string, Line>;
export const line = (id: string) => lines[id];
export const voice = contentVoice("ch2", line);
