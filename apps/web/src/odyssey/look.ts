// The restored "after-p2" look (docs/research/after-p2-style.md) plus the four additions of the
// new-flow prompt §1d: just-enough colour, painted texture + shadow hatch, outlines, readable cards.
//
// Shading: MeshToonMaterial with the after-p2 three-step ramp (118 / 186 / 255): matte, lifted
// shadows that stay pastel. On top, a painted value variation (±10 %, world-anchored, triplanar on the
// real surface normal) and a faint screen-aligned hatch that only appears in the darkest ramp step.
import * as THREE from "three";
import { fx } from "../fx/uniforms";

/** after-p2 palette (indigo architecture, cream floors, brass frames) + soft hues for the 25 % */
export const LOOK = {
  // neutrals (≈ 65 %)
  space: "#14102E",
  // the after-p2 indigo, one step softer so the room reads as a calm base (new-flow colour budget)
  wall: "#34305A",
  wall2: "#433D6B",
  wallLight: "#56507F",
  cream: "#FFE7C7",
  creamDeep: "#F2D3AA",
  paper: "#FFF8EC",
  bone: "#F4EEE6",
  stone: "#B9B2C4",
  ink: "#3A2A24",
  // soft colour (≈ 25 %)
  lilac: "#C7BDF5",
  lavender: "#9B8CE8",
  peach: "#F5B98A",
  sky: "#8EC5E8",
  sage: "#9CC9A6",
  rose: "#F0A9B8",
  butter: "#F2D68A",
  rust: "#C8714A",
  // accents (≈ 10 %)
  brass: "#E8B84A",
  brassDeep: "#C9963A",
  mint: "#7FD8BE",
  coral: "#FF8E8A",
  lamp: "#FFD7A0",
} as const;

let ramp: THREE.DataTexture | null = null;
/** after-p2 three-step light ramp: dark → mid → light, shadows never black */
export function toonRamp() {
  if (ramp) return ramp;
  const steps = [118, 186, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

export type ToonOpts = {
  emissive?: string;
  glow?: number;
  side?: THREE.Side;
  /** painted texture strength 0..1 (1 = ±10 % value) */
  paint?: number;
  /** fine grain, e.g. regolith or fabric weave 0..1 */
  grain?: number;
  /** grain scale (bigger = finer) */
  grainScale?: number;
  flat?: boolean;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture;
};

const PAINT_VERT = /* glsl */ `
#include <project_vertex>
vec4 oWP = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  oWP = instanceMatrix * oWP;
#endif
vPaintPos = ( modelMatrix * oWP ).xyz;
`;
const PAINT_FRAG = /* glsl */ `
vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
{
  vec3 pN = normalize( cross( dFdx( vPaintPos ), dFdy( vPaintPos ) ) );
  vec3 pW = pow( abs( pN ), vec3( 4.0 ) );
  pW /= ( pW.x + pW.y + pW.z + 1e-4 );
  vec3 pp = vPaintPos * 0.42;
  float paint = texture2D( tNoise, pp.zy ).r * pW.x + texture2D( tNoise, pp.xz ).r * pW.y + texture2D( tNoise, pp.xy ).r * pW.z;
  vec3 gp = vPaintPos * uGrainScale;
  float fine = texture2D( tSpeckle, gp.zy ).r * pW.x + texture2D( tSpeckle, gp.xz ).r * pW.y + texture2D( tSpeckle, gp.xy ).r * pW.z;
  outgoingLight *= 1.0 + uPaint * ( 0.2 * paint - 0.1 ) - uGrain * 0.09 * fine;
  // hatch only in the darkest ramp step: compare the lit colour to the unlit albedo
  float lum = dot( outgoingLight, vec3( 0.299, 0.587, 0.114 ) ) / max( 0.02, dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) );
  float shade = 1.0 - smoothstep( 0.42, 0.62, lum );
  float hatch = smoothstep( 0.55, 0.85, fract( ( gl_FragCoord.x + gl_FragCoord.y ) / 7.0 ) );
  outgoingLight *= 1.0 - shade * hatch * 0.1 * uPaint;
}
`;

const cache = new Map<string, THREE.MeshToonMaterial>();
/** a shared toon material for one colour (after-p2 ramp + painted texture) */
export function toon(color: string, o: ToonOpts = {}) {
  const key = color + JSON.stringify({ ...o, map: o.map?.uuid });
  const hit = cache.get(key);
  if (hit) return hit;
  const m = toonUnique(color, o);
  cache.set(key, m);
  return m;
}

/** a toon material of its own (for colours that animate) */
export function toonUnique(color: string, o: ToonOpts = {}) {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    emissive: o.emissive ?? "#000000",
    emissiveIntensity: o.glow ?? 1,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    map: o.map ?? null,
  });
  const own = { uPaint: { value: o.paint ?? 1 }, uGrain: { value: o.grain ?? 0.35 }, uGrainScale: { value: o.grainScale ?? 1.6 } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, own, { tNoise: fx.tNoise, tSpeckle: fx.tSpeckle });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vPaintPos;").replace("#include <project_vertex>", PAINT_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPaintPos;\nuniform sampler2D tNoise;\nuniform sampler2D tSpeckle;\nuniform float uPaint;\nuniform float uGrain;\nuniform float uGrainScale;")
      .replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;", PAINT_FRAG);
  };
  m.customProgramCacheKey = () => "odyssey-toon";
  return m;
}

/** gloss only where it belongs: visors and glass (no outline, no paint) */
export const glass = (color: string, opacity = 1) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.14, metalness: 0.3, transparent: opacity < 1, opacity, envMapIntensity: 1.2 });

const glowCache = new Map<string, THREE.MeshBasicMaterial>();
/** unlit glow for lamps, screens and engine flames (picked up by the light bloom) */
export function glow(color: string, strength = 1.8) {
  const key = color + strength;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false });
    glowCache.set(key, m);
  }
  return m;
}

let blob: THREE.CanvasTexture | null = null;
/** soft round contact shadow (after-p2) */
export function blobTexture() {
  if (blob) return blob;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(30,18,60,0.5)");
  g.addColorStop(0.55, "rgba(30,18,60,0.2)");
  g.addColorStop(1, "rgba(30,18,60,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  blob = new THREE.CanvasTexture(c);
  return blob;
}

/** settings a scene can read once: phones get half-resolution edges, low quality none */
export function edgeBudget(): { edges: boolean; scale: number } {
  if (typeof window === "undefined") return { edges: false, scale: 1 };
  const q = new URLSearchParams(location.search);
  if (q.has("noedges")) return { edges: false, scale: 1 };
  const small = Math.min(window.innerWidth, window.innerHeight) < 500;
  return { edges: true, scale: small ? 0.5 : 1 };
}
