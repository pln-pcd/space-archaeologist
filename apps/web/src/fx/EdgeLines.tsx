// Environment outlines (bible §22, CUTE POLISH v2 §C2): a depth edge pass. A line is drawn where a
// surface stands in front of what is behind it (the Laplacian of linear depth, NEARER side only). At a
// character's silhouette that nearer side is the character's own hull line, so lines never double.
// 1.5-2 px at 1080p, warm dark per world, fading out with distance (25 → 80 m) so far detail stays calm.
// Order: lines → Cineon tone mapping (the renderer's own tone mapping is skipped once a composer
// renders) → SMAA, so lines are anti-aliased and don't crawl.
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { EffectComposer, SMAA, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { isLegacyStyle } from "../style/styleMode";

const frag = /* glsl */ `
uniform vec3 lineColor;
uniform float thick;
uniform float fadeNear;
uniform float fadeFar;
uniform float strength;
float lz(const in vec2 p) { return -getViewZ(readDepth(p)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (depth >= 0.99999) return;
  vec2 px = texelSize * thick;
  float c = -getViewZ(depth);
  float l = lz(uv - vec2(px.x, 0.0)), r = lz(uv + vec2(px.x, 0.0));
  float d = lz(uv - vec2(0.0, px.y)), u = lz(uv + vec2(0.0, px.y));
  // nearer side of a depth step: neighbours on average farther away
  float lap = (l + r + u + d - 4.0 * c) / max(c, 0.001);
  float edge = smoothstep(0.035, 0.09, lap);
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, c);
  outputColor.rgb = mix(inputColor.rgb, lineColor, clamp(edge * fade * strength, 0.0, 1.0));
}`;

class EdgeEffect extends Effect {
  constructor({ color = "#3A3340", thick = 1.0, near = 25, far = 80, strength = 0.85 } = {}) {
    super("EdgeEffect", frag, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["lineColor", new THREE.Uniform(new THREE.Color(color).convertSRGBToLinear())],
        ["thick", new THREE.Uniform(thick)],
        ["fadeNear", new THREE.Uniform(near)],
        ["fadeFar", new THREE.Uniform(far)],
        ["strength", new THREE.Uniform(strength)],
      ]),
    });
  }
}

export const WORLD_INK = { earth: "#4A3A33", ship: "#3A3340", moon: "#2E2E31", mars: "#4A2C22" } as const;
export type InkWorld = keyof typeof WORLD_INK;

/** phones: lines at half thickness when the drawing buffer is small; off with ?noedges */
export function EdgeLines({ world = "ship", near = 25, far = 80 }: { world?: InkWorld; near?: number; far?: number }) {
  const { gl, size } = useThree();
  const off = typeof location !== "undefined" && new URLSearchParams(location.search).has("noedges");
  // sample offset in drawing-buffer pixels: ~1 at 1080p (a ~1.75 px line), never under 0.75
  const thick = Math.max(0.75, (size.height * gl.getPixelRatio()) / 1080);
  const effect = useMemo(() => new EdgeEffect({ color: WORLD_INK[world], thick, near, far }), [world, thick, near, far]);
  if (isLegacyStyle() || off) return null;
  // HyperFrames compositions: SMAA loads its lookup images asynchronously, which made the first
  // frames differ from later ones; MSAA is synchronous, so renders stay pixel-identical
  const hf = typeof window !== "undefined" && (window as unknown as { __hfComposition?: boolean }).__hfComposition;
  return (
    <EffectComposer multisampling={hf ? 4 : 0}>
      <primitive object={effect} />
      <ToneMapping mode={ToneMappingMode.CINEON} />
      {hf ? <></> : <SMAA />}
    </EffectComposer>
  );
}
