// "Quiet Afternoon in Space" palette ramps (bible §12). Each row is [shadow, mid, light]: flat
// painterly bands. Shadows keep the hue, drop to about half the value, lose some saturation and
// lean cool; lights lean warm and cream. Hand-tuned rows for the colours that cover most of the
// screen; every other colour gets an automatic row from makeRamp().
import * as THREE from "three";

export type Ramp = [string, string, string];

/** hand-tuned rows, keyed by the material's base colour (lower-case hex) */
/**
 * CUTE POLISH v2 soft hues (bible §22 A1): sweeter and brighter, saturation ~35-50 %, never neon.
 * Each is a 3-band ramp [shadow (same hue, cooler and darker), mid, light (warmer, cream-ish)].
 * Balance per frame ≈ 60 % neutrals / 28 % soft colour (environment) / 12 % accents (characters,
 * interactive things, UI).
 */
export const SOFT: Record<"apricot" | "teal" | "rose" | "butter" | "periwinkle" | "leaf" | "sky", Ramp> = {
  apricot: ["#A8694A", "#E8A07A", "#F8CDAE"],
  teal: ["#3E7570", "#6FAAA3", "#ABD6CE"],
  rose: ["#9A5664", "#E0939F", "#F5C6CC"],
  butter: ["#A48C45", "#EBCB72", "#F8E7AE"],
  periwinkle: ["#5A64A0", "#8F98D4", "#C3C9EE"],
  leaf: ["#4C7048", "#82B26E", "#BCDDA0"],
  sky: ["#4A7FA8", "#7FB3D9", "#BFDDF0"],
};

export const RAMPS: Record<string, Ramp> = {
  // the soft hues use their hand-tuned bands
  ...Object.fromEntries(Object.values(SOFT).map((r) => [r[1].toLowerCase(), r])),
  // ---- Odyssey Base: MASTER table (bible §6) ----
  "#c9c2b4": ["#8e8a82", "#c9c2b4", "#ece6da"], // hull wall panels (bone)
  "#ece6da": ["#a39e94", "#d9d2c5", "#f3eee4"], // bone, lit side (suits, book pages)
  "#85817a": ["#5c5a57", "#85817a", "#a9a49a"], // ribs / frames / handrails (warm grey)
  "#a9a49a": ["#6f6b66", "#99948b", "#bdb8ae"], // warm grey, light
  "#b3a792": ["#7a7468", "#b3a792", "#d8cdb8"], // deck floor (sandstone)
  "#d8cdb8": ["#8f887a", "#c7bca7", "#e3dac7"], // sandstone, light
  "#55646b": ["#3b464c", "#55646b", "#7e9097"], // slate inlay / consoles / mat
  "#3b464c": ["#2a3236", "#3b464c", "#55646b"], // slate, dark
  "#57534f": ["#3a3836", "#57534f", "#6f6b66"], // ceiling / dome frame / plinths (graphite)
  "#3a3836": ["#2a2927", "#3a3836", "#4c4946"], // graphite, dark
  "#6d8295": ["#4a5866", "#6d8295", "#8fa3b5"], // seats / fabric (dusty blue)
  "#a8936a": ["#6e6046", "#a8936a", "#cdb98e"], // brass trim (≤ 5 %)
  "#6e6046": ["#4e4432", "#6e6046", "#8a7a5a"], // brass, dark
  "#6a8c70": ["#4f684e", "#6a8c70", "#82ad8c"], // plants (sage)
  "#b5674a": ["#7a4632", "#b5674a", "#cd8a6c"], // terracotta (one action)
  "#9a5639": ["#5c3322", "#9a5639", "#b8714f"], // terracotta, deep (launch button)
  "#2f3a3f": ["#232b2f", "#2f3a3f", "#3b474d"], // screen glass
  "#1b2230": ["#141924", "#1b2230", "#2a3443"], // space
  // chapter book cloth (covers, stamps and cases only)
  "#5f6266": ["#45474b", "#5f6266", "#7a7d82"], // Moon cloth
  "#7a4632": ["#5a3324", "#7a4632", "#965a41"], // Mars cloth
  "#9a9c9f": ["#6c6e71", "#9a9c9f", "#b9bbbd"], // Moon light
  "#b8714f": ["#7a4632", "#b8714f", "#d0906f"], // Mars light
  // ---- Moon (Tranquility Base) ----
  "#8d8f94": ["#2a2c33", "#8d8f94", "#d9d6cf"], // regolith
  "#c99a3d": ["#6b4f1d", "#c99a3d", "#f1d38a"], // gold foil
  // ---- Mars (Perseverance Valley) ----
  "#a0623f": ["#5c3a2a", "#a0623f", "#d99a6a"], // ground
  "#8a4a2c": ["#4f2c1f", "#8a4a2c", "#b8714a"], // valley walls
  "#a65a32": ["#5a3221", "#a65a32", "#d0875a"], // rocks
  "#e0b98e": ["#7a5a44", "#b9926c", "#e0b98e"], // bedrock
};

const tmp = new THREE.Color();
/** Shift a hue toward a target hue (0..1 wheel) by `amt` of the shortest distance. */
function toward(h: number, target: number, amt: number) {
  let d = target - h;
  d -= Math.round(d);
  return (h + d * amt + 1) % 1;
}

/**
 * Automatic ramp row from a base colour: shadow = 8–15° cooler, value × 0.5, saturation × 0.8;
 * light = value × 1.08, a touch warmer. Used for every colour without a hand-tuned row and for
 * imported models (map each source colour to its row).
 */
export function makeRamp(base: string): Ramp {
  const c = tmp.set(base);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  // work in HSV for value scaling
  const r = c.clone().convertLinearToSRGB();
  const max = Math.max(r.r, r.g, r.b),
    min = Math.min(r.r, r.g, r.b);
  const v = max,
    s = max === 0 ? 0 : (max - min) / max;
  const hsv2hex = (h: number, sat: number, val: number) => {
    const i = Math.floor(h * 6),
      f = h * 6 - i;
    const p = val * (1 - sat),
      q = val * (1 - f * sat),
      t = val * (1 - (1 - f) * sat);
    const [rr, gg, bb] = [
      [val, t, p],
      [q, val, p],
      [p, val, t],
      [p, q, val],
      [t, p, val],
      [val, p, q],
    ][((i % 6) + 6) % 6];
    return "#" + [rr, gg, bb].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0")).join("");
  };
  const h = hsl.h;
  // neutrals (no hue) get a slightly cool slate shade instead of plain grey
  const shadowHue = s < 0.08 ? 0.56 : toward(h, 0.6, 0.1);
  const shadow = hsv2hex(shadowHue, Math.max(s * 0.8, s < 0.08 ? 0.08 : 0), v * 0.62);
  const light = hsv2hex(s < 0.08 ? 0.1 : toward(h, 0.09, 0.04), s < 0.08 ? 0.04 : s * 0.94, Math.min(1, v * 1.08 + 0.02));
  return [shadow, base, light];
}

/** The row for a colour: hand-tuned if we have one, automatic otherwise. */
export function rampFor(base: string): Ramp {
  return RAMPS[base.toLowerCase()] ?? makeRamp(base);
}
