import { create } from "zustand";
import * as THREE from "three";
import gsap from "gsap";

export type MoodName = "sunrise" | "daylight" | "sunset" | "night" | "golden" | "lunar" | "mars" | "storm";

export interface MoodConfig {
  name: MoodName;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunPosition: [number, number, number];
  playerTint: string;
  shadeTint: string;
  ambientColor: string;
  clearColor: string;
}

export const MOODS: Record<MoodName, MoodConfig> = {
  sunrise: {
    name: "sunrise",
    fogColor: "#dfe9f3",
    fogNear: 1.4,
    fogFar: 71,
    sunPosition: [-0.5, 0.5, 0.5],
    playerTint: "#ff9b3d",
    shadeTint: "#b17412",
    ambientColor: "#6c6870",
    clearColor: "#dfe9f3",
  },
  golden: {
    name: "golden",
    fogColor: "#dfe9f3",
    fogNear: 1.4,
    fogFar: 71,
    sunPosition: [-0.6, 0.45, 0.4],
    playerTint: "#ff9b3d",
    shadeTint: "#b17412",
    ambientColor: "#756c60",
    clearColor: "#dfe9f3",
  },
  daylight: {
    name: "daylight",
    fogColor: "#dfe9f3",
    fogNear: 1.4,
    fogFar: 86,
    sunPosition: [-0.5, 0.8, 0.5],
    playerTint: "#fffd94",
    shadeTint: "#b17412",
    ambientColor: "#70737a",
    clearColor: "#dfe9f3",
  },
  sunset: {
    name: "sunset",
    fogColor: "#dfe9f3",
    fogNear: 1.4,
    fogFar: 71,
    sunPosition: [0.5, 0.3, -0.5],
    playerTint: "#fda0ef",
    shadeTint: "#72404e",
    ambientColor: "#594d65",
    clearColor: "#dfe9f3",
  },
  night: {
    name: "night",
    fogColor: "#1b2033",
    fogNear: 1.4,
    fogFar: 43,
    sunPosition: [0.5, -0.2, -0.5],
    playerTint: "#af58bb",
    shadeTint: "#332951",
    ambientColor: "#1e2440",
    clearColor: "#0d1020",
  },
  lunar: {
    name: "lunar",
    fogColor: "#000000",
    fogNear: 9999,
    fogFar: 10000,
    sunPosition: [0.95, 0.25, 0.1], // 14 deg low east sun
    playerTint: "#ffffff",
    shadeTint: "#222225",
    ambientColor: "#101014",
    clearColor: "#000000",
  },
  mars: {
    name: "mars",
    fogColor: "#c8a27c",
    fogNear: 1.4,
    fogFar: 90,
    sunPosition: [-0.4, 0.7, 0.5],
    playerTint: "#ffd8b5",
    shadeTint: "#7a4632",
    ambientColor: "#593e32",
    clearColor: "#c8a27c",
  },
  storm: {
    name: "storm",
    fogColor: "#7d5f48",
    fogNear: 1.0,
    fogFar: 28,
    sunPosition: [-0.2, 0.4, 0.2],
    playerTint: "#c29b7a",
    shadeTint: "#3d2a20",
    ambientColor: "#33241b",
    clearColor: "#7d5f48",
  },
};

interface MoodState {
  currentMood: MoodName;
  prevMood: MoodName | null;
  mixProgress: number; // 0..1
  config: MoodConfig;
  setMood: (mood: MoodName, duration?: number) => void;
  quickSetMood: (mood: MoodName) => void;
  preloadMood: (mood: MoodName) => void;
}

let activeTween: gsap.core.Tween | null = null;

export const useMoodStore = create<MoodState>((set, get) => ({
  currentMood: "golden",
  prevMood: null,
  mixProgress: 1.0,
  config: MOODS.golden,
  setMood: (nextMood: MoodName, duration = 2.0) => {
    const cur = get().currentMood;
    if (cur === nextMood && get().mixProgress >= 1.0) return;
    if (activeTween) activeTween.kill();

    const targetConfig = MOODS[nextMood] || MOODS.golden;
    set({
      prevMood: cur,
      currentMood: nextMood,
      config: targetConfig,
      mixProgress: 0,
    });

    const proxy = { p: 0 };
    activeTween = gsap.to(proxy, {
      p: 1.0,
      duration,
      ease: "power2.inOut",
      onUpdate: () => {
        set({ mixProgress: proxy.p });
      },
      onComplete: () => {
        set({ mixProgress: 1.0, prevMood: null });
        activeTween = null;
      },
    });
  },
  quickSetMood: (nextMood: MoodName) => {
    if (activeTween) activeTween.kill();
    const targetConfig = MOODS[nextMood] || MOODS.golden;
    set({
      currentMood: nextMood,
      prevMood: null,
      mixProgress: 1.0,
      config: targetConfig,
    });
  },
  preloadMood: (_mood: MoodName) => {
    // Assets/textures preload hook
  },
}));

