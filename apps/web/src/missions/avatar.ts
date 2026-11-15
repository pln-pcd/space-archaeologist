import { create } from "zustand";
import { AVATAR_SAVE_KEY } from "./constants";
import { KIDS, type KidId, type KidLook } from "../characters/kids";
import type { ChibiLook } from "../characters/chibiModel";

export const SUIT_COLORS = [
  "#5FA39C",
  "#5BB8FF",
  "#FF8A4C",
  "#B9A8FF",
  "#FFD23F",
  "#E6EDF5",
  "#DA829E",
  "#6D82C9",
];
export const SKIN_TONES = [
  "#F6DFCB",
  "#EFC4A0",
  "#DEA77E",
  "#BE835F",
  "#986345",
  "#714832",
  "#4F3329",
  "#35241F",
];
export const HAIR_STYLES: KidLook["hairStyle"][] = [
  "messy-flick",
  "bob-messy",
  "wavy-flick",
  "ponytail",
  "curls",
  "crew",
  "bun",
];
export const ACCESSORIES = [
  "Star patch",
  "Scarf",
  "Badge",
  "Tool pouch",
  "Notebook",
  "Bow",
  "Headphones",
  "None",
];
export const VISORS = ["#FFD98A", "#80C8D8", "#B9A8E0", "#9EE6C8", "#FFB3C7"];
export const HAIR_COLORS = ["#3A2A26", "#16131A", "#7A4A2E", "#C8693A", "#E8C26A", "#B49CF0", "#6FB7F0"];
export const HELMETS = ["Bubble", "Wide", "Tall"];
export type AvatarConfig = {
  base: KidId;
  suitColor: number;
  skin: number;
  hair: number;
  helmet: number;
  visor: number;
  accessory: number;
  /** hair colour index (added in v7; older saves default to 0) */
  hairColor?: number;
};
export const DEFAULT_AVATAR: AvatarConfig = {
  base: "maya",
  suitColor: 0,
  skin: 3,
  hair: 0,
  helmet: 0,
  visor: 1,
  accessory: 0,
  hairColor: 0,
};
export function validAvatar(raw: unknown): AvatarConfig | null {
  const a = raw as AvatarConfig;
  if (!a || !(a.base in KIDS)) return null;
  const bounds: [keyof AvatarConfig, number][] = [
    ["suitColor", SUIT_COLORS.length],
    ["skin", SKIN_TONES.length],
    ["hair", HAIR_STYLES.length],
    ["helmet", HELMETS.length],
    ["visor", VISORS.length],
    ["accessory", ACCESSORIES.length],
  ];
  if (a.hairColor !== undefined && !(Number.isInteger(a.hairColor) && a.hairColor >= 0 && a.hairColor < HAIR_COLORS.length)) return null;
  return bounds.every(
    ([key, max]) =>
      Number.isInteger(a[key]) && Number(a[key]) >= 0 && Number(a[key]) < max,
  )
    ? a
    : null;
}
function saved() {
  try {
    return validAvatar(
      JSON.parse(localStorage.getItem(AVATAR_SAVE_KEY) ?? "null"),
    );
  } catch {
    return null;
  }
}
export const useAvatar = create<{
  config: AvatarConfig | null;
  warning: boolean;
}>(() => ({ config: saved(), warning: false }));
export function saveAvatar(config: AvatarConfig) {
  let warning = false;
  try {
    localStorage.setItem(AVATAR_SAVE_KEY, JSON.stringify(config));
  } catch {
    warning = true;
  }
  useAvatar.setState({ config, warning });
}
export function avatarAppearance(a: AvatarConfig) {
  return {
    skin: SKIN_TONES[a.skin],
    hairStyle: HAIR_STYLES[a.hair],
    accent: SUIT_COLORS[a.suitColor],
    suitColor: SUIT_COLORS[a.suitColor],
    visorTint: VISORS[a.visor],
    helmetStyle: a.helmet,
    accessory: ACCESSORIES[a.accessory],
    hairColor: HAIR_COLORS[a.hairColor ?? 0],
  };
}
export function randomAvatar(): AvatarConfig {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    base: (["maya", "leo", "amara", "migo"] as const)[pick(4)],
    suitColor: pick(SUIT_COLORS.length),
    skin: pick(SKIN_TONES.length),
    hair: pick(HAIR_STYLES.length),
    helmet: pick(HELMETS.length),
    visor: pick(VISORS.length),
    accessory: pick(ACCESSORIES.length),
    hairColor: pick(HAIR_COLORS.length),
  };
}

/** the saved avatar → the chibi explorer's look */
export function chibiLook(a: AvatarConfig, helmetOn = true): ChibiLook {
  return {
    suit: SUIT_COLORS[a.suitColor],
    skin: SKIN_TONES[a.skin],
    hair: HAIR_STYLES[a.hair],
    hairColor: HAIR_COLORS[a.hairColor ?? 0],
    helmet: a.helmet,
    visor: VISORS[a.visor],
    accessory: a.accessory,
    helmetOn,
  };
}
