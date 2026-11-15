import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Calibration } from "./input/types";
export type Profile = {
  nickname: string;
  suit: string;
  code: string;
  mode: "device" | "api";
  token?: string;
  /** per-kid Star Gloves calibration (bible §5 step 7) */
  calibration?: Calibration;
  /** Glove Academy licence earned */
  gloveLicence?: boolean;
  // ---- opening sequence (bible §21). Saved only in this browser, never sent anywhere. ----
  /** which of the four kids the player is (maya, leo, amara, migo) */
  characterId?: string;
  /** the explorer name, shown exactly as typed */
  playerName?: string;
  /** the same name in capitals for the stitched suit patch */
  playerPatch?: string;
  /** the kid's suit accent colour */
  accentColor?: string;
  /** the opening (hide and seek → portal → suit) has been played */
  introDone?: boolean;
  /** Nova's welcome on the ship (scene 7) still to play */
  arrival?: boolean;
  createdAt?: string;
  /** Local-only second-half resume point and the finished-cover badge. */
  journey?: string;
  gameCompleted?: boolean;
  /** new flow: Nova's first-visit greeting + how-to has played */
  greeted?: boolean;
};
/** the name to show (new profiles: playerName; older saves: their callsign) */
export const explorerName = (p?: Profile | null) => p?.playerName || p?.nickname || "Explorer";
export type Progress = {
  completed: string[];
  pages: Record<string, number>;
  scores: Record<string, number>;
  choices: Record<string, string>;
  sceneResults?: Record<string, unknown>;
  /** Chapter the ship is parked at (index into stories). Older saves omit it. */
  chapter?: number;
};
export const emptyProgress = (): Progress => ({
  completed: [],
  pages: {},
  scores: {},
  choices: {},
  chapter: 0,
});
export const suits = [
  { name: "Commander", color: "#8E5CF0" },
  { name: "Scout", color: "#16B39C" },
  { name: "Engineer", color: "#F2871C" },
  { name: "Scientist", color: "#3C74F0" },
  { name: "Pilot", color: "#EE4F86" },
  { name: "Medic", color: "#E2455C" },
];
export type Settings = {
  sound: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  dyslexia: boolean;
  lowData: boolean;
  /** Tilt-shift diorama blur on the top and bottom of the ship view. */
  tiltShift?: boolean;
  /** Stronger HUD contrast; also turns tilt-shift off. */
  highContrast?: boolean;
  /** "Easy-read": Lexend everywhere instead of the Stylish display font */
  easyRead?: boolean;
  /** suit colour hue 0..1 from the nav colour button (posterised suit shader) */
  suitHue?: number;
  /** 3D effects quality. "auto" picks Low on weak devices. */
  quality?: "auto" | "high" | "low" | "off";
  /** read captions aloud with the browser's speech voice */
  readAloud?: boolean;
  /** 0..1 mixer levels (bible §14) */
  volumes?: { master: number; music: number; sfx: number; voice: number };
  // ---- new flow (Nova host) ----
  /** Nova speaks aloud (text always shows) */
  novaVoice?: boolean;
  /** Nova's voice volume 0..1 */
  novaVolume?: number;
  /** the "Ask Nova" microphone may be used */
  mic?: boolean;
  /** "Ask Nova" chat is on (a grown-up can turn it off from the first-use notice) */
  askNova?: boolean;
  /** the grown-ups' AI notice has been seen */
  aiNotice?: boolean;
  /** the browser speech-service notice has been accepted */
  webSpeechOk?: boolean;
  /** layout: auto-detected, or forced */
  device?: "auto" | "computer" | "tablet" | "phone";
  /** caption / card text size step */
  textSize?: "normal" | "large" | "larger";
  // ---- v4.6 ----
  /** how the kid talks with Nova (chosen on the first visit, changeable in Settings) */
  talkMode?: "voice" | "chat" | null;
  /** Nova's guided tutorial was finished or skipped */
  tutorialDone?: boolean;
  // ---- v7 ----
  /** how many questions the explorer has asked Nova (for the Curious Mind badge) */
  novaAsked?: number;
  /** Nova's voice: "puck" (playful, default), "michael" (calm), "heart" (warm) */
  novaVoiceName?: "puck" | "michael" | "heart";
  /** background music on/off (sound effects stay) */
  music?: boolean;
  /** in-game memory Nova may use: topics the explorer liked (short tags only, never chat text) */
  novaTopics?: string[];
  /** the hand-gesture training was finished once */
  handsTrained?: boolean;
  /** the intro tour was watched once */
  introSeen?: boolean;
  /** the days (YYYY-MM-DD) the explorer played, for the passport streak (this device only) */
  playDays?: string[];
};
type Store = {
  profile: Profile | null;
  guest: boolean;
  progress: Progress;
  settings: Settings;
  enter: (p: Profile, progress?: Progress) => void;
  enterGuest: () => void;
  logout: () => void;
  page: (id: string, page: number) => void;
  complete: (id: string, choice: string) => void;
  score: (id: string, score: number) => void;
  saveSceneResult: (id:string, result:unknown) => void;
  travel: (chapter: number) => void;
  setting: (key: Exclude<keyof Settings, "quality" | "volumes">, value: boolean) => void;
  setQuality: (q: NonNullable<Settings["quality"]>) => void;
  setVolume: (k: "master" | "music" | "sfx" | "voice", v: number) => void;
  /** any settings field (new flow) */
  configure: (patch: Partial<Settings>) => void;
  updateProfile: (p: Partial<Profile>) => void;
  /** "Delete my save": forget the explorer, progress and settings on this computer */
  deleteSave: () => void;
};
function saveDevice(profile: Profile | null, progress: Progress) {
  if (!profile || profile.mode !== "device") return;
  const profiles = JSON.parse(
    localStorage.getItem("homeward-explorers") || "{}",
  );
  profiles[profile.code] = { profile, progress };
  localStorage.setItem("homeward-explorers", JSON.stringify(profiles));
}
export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      profile: null,
      guest: false,
      progress: emptyProgress(),
      settings: {
        sound: true,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        largeText: false,
        dyslexia: false,
        lowData: false,
        tiltShift: true,
        highContrast: false,
        quality: "auto",
      },
      enter: (profile, progress = emptyProgress()) => {
        set({ profile, guest: false, progress });
        saveDevice(profile, progress);
      },
      enterGuest: () =>
        set({ profile: null, guest: true, progress: emptyProgress() }),
      logout: () =>
        set({ profile: null, guest: false, progress: emptyProgress() }),
      page: (id, page) => {
        const { profile, guest, progress } = get();
        if (guest) return;
        const next = { ...progress, pages: { ...progress.pages, [id]: page } };
        set({ progress: next });
        saveDevice(profile, next);
      },
      complete: (id, choice) => {
        const { profile, guest, progress } = get();
        if (guest) return;
        const next = {
          ...progress,
          completed: [...new Set([...progress.completed, id])],
          choices: { ...progress.choices, [id]: choice },
        };
        set({ progress: next });
        saveDevice(profile, next);
      },
      score: (id, score) => {
        const { profile, guest, progress } = get();
        if (guest) return;
        const next = {
          ...progress,
          scores: {
            ...progress.scores,
            [id]: Math.max(score, progress.scores[id] || 0),
          },
        };
        set({ progress: next });
        saveDevice(profile, next);
      },
      saveSceneResult: (id,result) => {
        const {profile,progress,guest}=get();if(guest)return;
        const next={...progress,sceneResults:{...progress.sceneResults,[id]:result}};
        set({progress:next});saveDevice(profile,next);
      },
      travel: (chapter) => {
        const { profile, progress } = get();
        const next = { ...progress, chapter };
        set({ progress: next });
        saveDevice(profile, next);
      },
      updateProfile: (patch) => {
        const { profile, progress } = get();
        if (!profile) return;
        const next = { ...profile, ...patch };
        set({ profile: next });
        saveDevice(next, progress);
      },
      deleteSave: () => {
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith("homeward-") || k.startsWith("odyssey-")) localStorage.removeItem(k);
        } catch {
          /* private mode */
        }
        set({ profile: null, guest: false, progress: emptyProgress() });
      },
      setVolume: (k, v) => {
        const cur = get().settings.volumes ?? { master: 0.8, music: 0.7, sfx: 0.8, voice: 0.9 };
        set({ settings: { ...get().settings, volumes: { ...cur, [k]: v } } });
      },
      setQuality: (quality) => set({ settings: { ...get().settings, quality } }),
      configure: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setting: (key, value) =>
        set({ settings: { ...get().settings, [key]: value } }),
    }),
    {
      name: "homeward-session-v1",
      // v1 (opening sequence): older saves keep playing; they count as having seen the intro
      // v2 (new flow): the mission scene lists changed, so saved resume points restart
      version: 2,
      migrate: (old, from) => {
        const st = old as { profile?: Profile | null; progress?: Progress };
        if (from < 1 && st?.profile) st.profile = { ...st.profile, introDone: st.profile.introDone ?? true, playerName: st.profile.playerName ?? st.profile.nickname };
        if (from < 2 && st?.progress) st.progress = { ...st.progress, pages: {} };
        return st as never;
      },
      partialize: (s) => ({
        profile: s.profile,
        progress: s.guest ? emptyProgress() : s.progress,
        settings: s.settings,
      }),
    },
  ),
);
/** UI blip through the game mixer (kept for older call sites). */
export function beep(kind: "click" | "success" = "click") {
  void import("./audio/sfx").then((m) => m.play(kind === "success" ? "chime" : "tick"));
}
