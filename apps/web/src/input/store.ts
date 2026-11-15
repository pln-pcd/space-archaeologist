import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TUNING, type Tuning } from "./types";

export type InputMode = "gloves" | "touch" | "mouse";
export type CamStatus = "off" | "asking" | "on" | "denied" | "busy" | "missing" | "unsupported" | "error";
export type TrackerStatus = "idle" | "loading" | "warming" | "ready" | "error";
export type CoachTip = null | "show" | "closer" | "back" | "box" | "light" | "rest";

type Prefs = {
  /** null until the kid picks on first launch */
  mode: InputMode | null;
  mirror: boolean;
  cameraPreview: boolean;
  leftHanded: boolean;
  oneHand: boolean;
  tuning: Tuning;
  /** camera consent screen already accepted once on this device */
  consented: boolean;
  /** Glove Academy finished at least once on this device */
  academyDone: boolean;
};
type Runtime = {
  camera: CamStatus;
  tracker: TrackerStatus;
  delegate: "GPU" | "CPU" | null;
  backend: "main" | "worker";
  inferenceMs: number;
  trackerFps: number;
  hands: number;
  coach: CoachTip;
  resolution: string;
  debug: boolean;
  error: string;
  /** full-screen input overlays */
  overlay: null | "picker" | "consent" | "academy";
  /** how many mounted scenes want Star Gloves (chapters, Glove Academy); 0 = camera off */
  handScenes: number;
  /** v7.5: scenes that fill the screen with the mirrored camera (Rock Box): the glove sits ON the
   *  real hand (1:1 mapping, sized to the hand) and no Glove Cam is needed */
  backdrop: number;
  /** v7.5: scenes (games) that show the small Glove Cam; everywhere else it is hidden */
  gameCam: number;
};
type InputStore = Prefs &
  Runtime & {
    set: (p: Partial<Prefs & Runtime>) => void;
    setTuning: (t: Partial<Tuning>) => void;
  };

const debugFlag = typeof location !== "undefined" && new URLSearchParams(location.search).get("debug") === "gestures";

export const useInput = create<InputStore>()(
  persist(
    (set, get) => ({
      mode: null,
      mirror: true,
      cameraPreview: true,
      leftHanded: false,
      oneHand: false,
      tuning: DEFAULT_TUNING,
      consented: false,
      academyDone: false,
      camera: "off",
      tracker: "idle",
      delegate: null,
      backend: "main",
      inferenceMs: 0,
      trackerFps: 0,
      hands: 0,
      coach: null,
      resolution: "",
      debug: debugFlag,
      error: "",
      overlay: null,
      handScenes: 0,
      backdrop: 0,
      gameCam: 0,
      set: (p) => set(p),
      setTuning: (t) => set({ tuning: { ...get().tuning, ...t } }),
    }),
    {
      name: "odyssey-input-v1",
      partialize: (s) => ({
        mode: s.mode,
        mirror: s.mirror,
        cameraPreview: s.cameraPreview,
        leftHanded: s.leftHanded,
        oneHand: s.oneHand,
        tuning: s.tuning,
        consented: s.consented,
        academyDone: s.academyDone,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Prefs>;
        return { ...current, ...p, tuning: { ...DEFAULT_TUNING, ...(p.tuning ?? {}) } };
      },
    },
  ),
);

if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __inputStore: typeof useInput }).__inputStore = useInput;

/**
 * Star Gloves are only for scenes that use them (chapters, Glove Academy). The base is mouse,
 * keys and touch: there the camera is switched off (its light goes out) and no glove is drawn.
 */
/** count a scene in one of the runtime counters while it is mounted */
function useCounter(key: "backdrop" | "gameCam", active: boolean) {
  useEffect(() => {
    if (!active) return;
    const s = useInput.getState();
    s.set({ [key]: s[key] + 1 } as Partial<Runtime>);
    return () => {
      const t = useInput.getState();
      t.set({ [key]: Math.max(0, t[key] - 1) } as Partial<Runtime>);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}
/** the scene shows the mirrored camera full screen: gloves map 1:1 onto the real hands */
export const useCameraBackdrop = (active = true) => useCounter("backdrop", active);
/** the scene is a game that shows the small Glove Cam */
export const useGloveCam = (active = true) => useCounter("gameCam", active);

export function useHandsWanted(active = true) {
  useEffect(() => {
    if (!active) return;
    const s = useInput.getState();
    s.set({ handScenes: s.handScenes + 1 });
    return () => {
      const t = useInput.getState();
      t.set({ handScenes: Math.max(0, t.handScenes - 1) });
    };
  }, [active]);
}
