// Judge Mode (bible §19): ?judge=1 or the "Mission Control" button on the title screen.
// Unlocks Ch1 and Ch2 (Ch3–5 stay sealed), jump to any beat, a 5-minute guided path,
// a TRUE STORY / IMAGINE overlay and per-chapter learning goals. Lives in sessionStorage only.
import { create } from "zustand";

const KEY = "odyssey-judge";
const fromUrl = typeof location !== "undefined" && new URLSearchParams(location.search).get("judge") === "1";
const saved = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null") as { on: boolean; overlay: boolean } | null;
  } catch {
    return null;
  }
})();

type Judge = { on: boolean; overlay: boolean; panel: boolean; set: (p: Partial<Omit<Judge, "set">>) => void };
export const useJudge = create<Judge>()((set, get) => ({
  on: fromUrl || !!saved?.on,
  overlay: saved?.overlay ?? false,
  // ?judge=1 opens Mission Control once the explorer is aboard (same as the title-screen button)
  panel: fromUrl,
  set: (p) => {
    set(p);
    const { on, overlay } = get();
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ on, overlay }));
    } catch {
      /* private mode: Judge Mode still works for this page */
    }
  },
}));
export const judgeOn = () => useJudge.getState().on;
