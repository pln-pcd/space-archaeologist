// The four explorers you can be (opening sequence, bible §21). Redesigned from the 4 turnaround
// reference sheets to capture each kid's unique traits, proportions (~4.5 heads tall), and outfit.
// Slot order and characterIds are preserved:
// Slot 1 (maya) -> Image 1: Calm, observant boy (teal camp-collar shirt, khaki shorts, sneakers)
// Slot 2 (leo)  -> Image 2: Sunny, cuddly girl (orange trapeze tunic dress, rust top, red boots)
// Slot 3 (amara)-> Image 3: Cheerful, curious boy (white tee, mint denim overalls, brick sneakers)
// Slot 4 (migo) -> Image 4: Determined, brave girl (high ponytail with lime bobbles, pale green pinafore)

export type KidId = "maya" | "leo" | "amara" | "migo";

export type KidLook = {
  id: KidId;
  name: string;
  age: number;
  title: string;
  line: string;
  accent: string;
  skin: string;
  hair: string;
  hairStyle: "messy-flick" | "bob-messy" | "wavy-flick" | "ponytail" | "curls" | "crew" | "bun";
  torso: string;
  upper: string;
  fore: string;
  thigh: string;
  shin: string;
  shoe: string;
  extra: "camp-shirt" | "tunic-dress" | "overalls" | "pinafore";
  eyeColor: string;
  earrings?: boolean;
  freckles?: boolean;
  idle: "thoughtful" | "bounce" | "curious" | "confident";
};

export const KIDS: Record<KidId, KidLook> = {
  maya: {
    id: "maya",
    name: "Maya",
    age: 10,
    title: "The curious one",
    line: "Always asks one more question.",
    accent: "#5fa39c", // K1 teal (a little sweeter)
    skin: "#e2a585",
    hair: "#3f3a42",
    hairStyle: "messy-flick",
    torso: "#5fa39c",
    upper: "#6f9a98",
    fore: "#e2a585",
    thigh: "#a8a888",
    shin: "#e2a585",
    shoe: "#4f6878",
    extra: "camp-shirt",
    eyeColor: "#6b4a3a",
    earrings: true,
    idle: "thoughtful",
  },
  leo: {
    id: "leo",
    name: "Leo",
    age: 11,
    title: "The tinkerer",
    line: "Wants to know how things work.",
    accent: "#ef8a3e", // K2 orange
    skin: "#f6dcc2",
    hair: "#6b3420",
    hairStyle: "bob-messy",
    torso: "#ef8a3e",
    upper: "#a8482c",
    fore: "#f6dcc2",
    thigh: "#f6dcc2",
    shin: "#f6dcc2",
    shoe: "#c94a36",
    extra: "tunic-dress",
    eyeColor: "#2c2420",
    idle: "bounce",
  },
  amara: {
    id: "amara",
    name: "Amara",
    age: 9,
    title: "The stargazer",
    line: "Counts the stars every night.",
    accent: "#6fb3a2", // K3 mint
    skin: "#f6dfcb",
    hair: "#8b4636",
    hairStyle: "wavy-flick",
    torso: "#ffffff",
    upper: "#ffffff",
    fore: "#f6dfcb",
    thigh: "#6fb3a2",
    shin: "#f6dfcb",
    shoe: "#b85c4a",
    extra: "overalls",
    eyeColor: "#7a2f2a",
    idle: "curious",
  },
  migo: {
    id: "migo",
    name: "Migo",
    age: 10,
    title: "The adventurer",
    line: "Nobody ever finds his hiding spots.",
    accent: "#b9cf3a", // K4 lime
    skin: "#f2d3b0",
    hair: "#4a3426",
    hairStyle: "ponytail",
    torso: "#9ccf8a",
    upper: "#f2d3b0",
    fore: "#f2d3b0",
    thigh: "#f2d3b0",
    shin: "#f2d3b0",
    shoe: "#d24a30",
    extra: "pinafore",
    eyeColor: "#7a5a3a",
    freckles: true,
    idle: "confident",
  },
};

export const KID_ORDER: KidId[] = ["maya", "leo", "amara", "migo"];
export const isKid = (id?: string | null): id is KidId => !!id && id in KIDS;
/** the friend who counts: Leo, or Maya if the player is Leo */
export const seekerFor = (me: KidId): KidId => (me === "leo" ? "maya" : "leo");
