import * as THREE from "three";
import { rampMaterial } from "../fx/ramp";

/**
 * Matte "hand-painted" toon shading: a soft 3-step light ramp, no gloss.
 * Materials are shared by colour so the whole ship uses a handful of programs.
 */
let ramp: THREE.DataTexture | null = null;
export function toonRamp() {
  if (ramp) return ramp;
  // dark → mid → light, with a gentle lift so shadows stay pastel, never black
  // 4 bands (bible §12): shadow, mid, light, highlight; shadows stay pastel, never black
  const steps = [112, 168, 220, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

/** Soft rim light added to every toon material (bible §12), cheap: one fresnel term. */
export const RIM = { color: new THREE.Color("#C9B8FF"), strength: { value: 0.32 } };
function withRim<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM.color };
    shader.uniforms.uRimStrength = RIM.strength;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;")
      .replace(
        "#include <opaque_fragment>",
        "float rimF = 1.0 - saturate(dot(normalize(normal), normalize(vViewPosition)));\noutgoingLight += uRimColor * pow(rimF, 3.0) * uRimStrength;\n#include <opaque_fragment>",
      );
  };
  m.customProgramCacheKey = () => "toon-rim";
  return m;
}

type ToonOpts = { emissive?: string; glow?: number; vertexColors?: boolean; side?: THREE.Side; transparent?: boolean; opacity?: number; flat?: boolean; sway?: number; speckle?: number };
/**
 * World material (bible §12 "Quiet Afternoon in Space"): the painted-ramp shader, faceted by
 * default. Shared per colour + options.
 */
export function toonMaterial(color: string, o: ToonOpts = {}): THREE.MeshLambertMaterial {
  return rampMaterial(color, { flat: o.flat ?? true, ...o });
}

/** Character material: the same ramps, smooth normals, never dithered near the camera. */
export function characterMaterial(color: string) {
  return rampMaterial(color, { character: true, flat: false });
}
/** Posterised suit colour for the explorer (hue from the player's colour). */
export function suitMaterial(color: string) {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  return rampMaterial(color, { character: true, flat: false, suitHue: hsl.h });
}

/** A unique ramp material whose colour changes at runtime (waking machines, covers). */
export const toonUnique = (color: string, o: ToonOpts = {}) => rampMaterial(color, { ...o, flat: o.flat ?? true, dynamic: true });

/** Glossy only where it belongs: visors and glass. */
export const glassMaterial = (color: string) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 });

/** Flat bright colour for lamps and screens (no bloom: just a clean, slightly lifted colour). */
const glowCache = new Map<string, THREE.MeshBasicMaterial>();
export function glowMaterial(color: string, strength = 1.8) {
  const key = color + strength;
  let m = glowCache.get(key);
  if (!m) {
    const c = new THREE.Color(color);
    c.lerp(new THREE.Color("#ffffff"), Math.min(0.25, Math.max(0, strength - 1) * 0.12));
    m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    glowCache.set(key, m);
  }
  return m;
}

/** Wind sway for leaves and hanging things: vertices higher up move more. Shares one time uniform. */
export const windTime = { value: 0 };
export function windy(material: THREE.Material, strength = 0.08) {
  const m = material.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec4 wp = modelMatrix * vec4(position, 1.0);
         float h = max(position.y, 0.0);
         transformed.x += sin(uWind * 1.7 + wp.x * 1.3 + wp.z) * ${strength.toFixed(3)} * h;
         transformed.z += cos(uWind * 1.3 + wp.z * 1.1) * ${(strength * 0.6).toFixed(3)} * h;`,
      );
  };
  m.customProgramCacheKey = () => "windy" + strength;
  return m;
}

/** Soft round contact shadow texture (shared). */
let blob: THREE.CanvasTexture | null = null;
export function blobTexture() {
  if (blob) return blob;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(30,18,60,0.55)");
  g.addColorStop(0.55, "rgba(30,18,60,0.22)");
  g.addColorStop(1, "rgba(30,18,60,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  blob = new THREE.CanvasTexture(c);
  return blob;
}

/** Desaturate a colour toward a dusty grey (dormant machines). */
export function dusty(color: string, k: number) {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * (1 - 0.85 * k), hsl.l * (1 - 0.25 * k) + 0.08 * k);
}
