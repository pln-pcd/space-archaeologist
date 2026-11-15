/**
 * "Quiet Afternoon in Space" palette (bible §6 MASTER table). About 90 % of the screen is warm
 * neutrals (bone hull, warm-grey frames, sandstone deck, slate inlays, graphite ceiling); accents
 * (sage, terracotta, brass, dusty blue) stay small. Old key names are kept so existing props pick
 * up the new colours; they now mean "the neutral that plays this role".
 */
/** CUTE POLISH v2 (bible §22 A1): neutrals stay; fabrics, plants and a few props take the soft hues (fx/palette SOFT). */
export const PAL = {
  // ---- master rows (mid tones; the ramp shader adds shadow / light) ----
  bone: "#C9C2B4", // hull wall panels
  boneLight: "#ECE6DA",
  ribs: "#85817A", // ribs, frames, handrails (warm grey)
  ribsLight: "#A9A49A",
  sand: "#B3A792", // deck floor (sandstone)
  sandLight: "#D8CDB8",
  slate: "#55646B", // inlays, consoles, mats
  slateDark: "#3B464C",
  graphite: "#57534F", // ceiling, dome frame, plinth bases
  graphiteDark: "#3A3836",
  blue: "#8F98D4", // seats / fabric (cute polish: periwinkle)
  brassTrim: "#A8936A", // brass trim, ≤ 5 % of the screen
  sage: "#82B26E", // plants, "on" lights (cute polish: leaf)
  terra: "#B5674A", // one action light
  lamp: "#FFE9C7", // warm lamp light
  screen: "#2F3A3F",
  screenInk: "#CFE6D8",
  glass: "#D8E3E6",
  // ---- legacy role names → master neutrals ----
  wall: "#3A3836",
  wall2: "#57534F",
  wallLight: "#C9C2B4",
  lavender: "#85817A",
  lilac: "#A9A49A",
  cream: "#D8CDB8",
  peach: "#B3A792",
  creamDeep: "#B3A792",
  brass: "#A8936A",
  brassDeep: "#6E6046",
  mint: "#82B26E",
  teal: "#55646B",
  coral: "#E8A07A",
  pink: "#E0939F",
  space: "#1B2230",
  ink: "#3A3836",
  white: "#ECE6DA",
  dust: "#A9A49A",
} as const;

/** Suit styles for the explorer crew (and Nova). One natural-proportion suit; only the accent panels change. */
export type SuitStyle = {
  color: string;
  helmet: "round" | "bubble" | "lamp" | "fin" | "cross" | "dome";
  visor: string;
  patch: string;
  pack: string;
};
export const SUITS: Record<string, SuitStyle> = {
  Commander: { color: "#8E5CF0", helmet: "round", visor: "#2E2260", patch: "#FFC23D", pack: "#B89BFF" },
  Scout: { color: "#16B39C", helmet: "bubble", visor: "#173E4C", patch: "#7CF5D6", pack: "#8FE6D3" },
  Engineer: { color: "#F2871C", helmet: "lamp", visor: "#40260F", patch: "#FF6B6B", pack: "#FFC27A" },
  Scientist: { color: "#3C74F0", helmet: "dome", visor: "#172656", patch: "#7CF5D6", pack: "#9FBFFF" },
  Pilot: { color: "#EE4F86", helmet: "fin", visor: "#4E1A30", patch: "#FFC23D", pack: "#FF9DBF" },
  Medic: { color: "#E2455C", helmet: "cross", visor: "#3A2440", patch: "#FFFFFF", pack: "#FFB3BD" },
  Nova: { color: "#FBF7FF", helmet: "round", visor: "#2C2550", patch: PAL.coral, pack: PAL.lavender },
};
export const suitStyle = (name?: string, color?: string): SuitStyle => {
  const s = SUITS[name || "Commander"] || SUITS.Commander;
  return color && !SUITS[name || ""] ? { ...s, color } : s;
};

/** Chapter colours (bible §6): only on book covers, stamps and cases. Sealed chapters are graphite. */
export const CHAPTER_TONE: Record<string, { light: string; dark: string; ink: string }> = {
  eagle: { light: "#9A9C9F", dark: "#5F6266", ink: "#E8E2D6" },
  opportunity: { light: "#B8714F", dark: "#7A4632", ink: "#F3EADB" },
  viking: { light: "#6F6B66", dark: "#3A3836", ink: "#C9C2B4" },
  pioneer: { light: "#6F6B66", dark: "#3A3836", ink: "#C9C2B4" },
  voyager: { light: "#6F6B66", dark: "#3A3836", ink: "#C9C2B4" },
};
export const chapterTone = (id: string) => CHAPTER_TONE[id] ?? CHAPTER_TONE.viking;
