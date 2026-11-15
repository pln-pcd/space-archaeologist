// Post stack for the new-flow scenes (cover, dashboard, Nova close-ups): the after-p2 finish (light
// bloom, soft vignette, ACES) plus the environment line pass of §1d.3: a depth edge (silhouettes) and a
// normal edge (creases), 1.5 px at 1080p, warm dark (never black), fading with distance. Particles,
// glass and glow are excluded because they don't write depth (depthWrite false on those materials).
// Phones: half-resolution edges; ?noedges or quality "off" turns the pass off.
import { useContext, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, EffectComposerContext, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { edgeBudget } from "./look";

const frag = /* glsl */ `
uniform vec3 lineColor;
uniform float thick;
uniform float fadeNear;
uniform float fadeFar;
uniform float strength;
uniform sampler2D tNormal;
uniform float useNormal;
float lz(const in vec2 p) { return -getViewZ(readDepth(p)); }
vec3 nrm(const in vec2 p) { return texture2D(tNormal, p).xyz * 2.0 - 1.0; }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (depth >= 0.99999) return;
  vec2 px = texelSize * thick;
  float c = -getViewZ(depth);
  float l = lz(uv - vec2(px.x, 0.0)), r = lz(uv + vec2(px.x, 0.0));
  float d = lz(uv - vec2(0.0, px.y)), u = lz(uv + vec2(0.0, px.y));
  float lap = (l + r + u + d - 4.0 * c) / max(c, 0.001);
  float edge = smoothstep(0.035, 0.09, lap);
  if (useNormal > 0.5) {
    vec3 n0 = nrm(uv);
    float k = 0.0;
    k = max(k, 1.0 - dot(n0, nrm(uv + vec2(px.x, 0.0))));
    k = max(k, 1.0 - dot(n0, nrm(uv + vec2(0.0, px.y))));
    edge = max(edge, smoothstep(0.32, 0.6, k) * 0.75);
  }
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, c);
  outputColor.rgb = mix(inputColor.rgb, lineColor, clamp(edge * fade * strength, 0.0, 1.0));
}`;

class InkEffect extends Effect {
  constructor({ color, thick, near, far, normal }: { color: string; thick: number; near: number; far: number; normal: THREE.Texture | null }) {
    super("OdysseyInk", frag, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["lineColor", new THREE.Uniform(new THREE.Color(color).convertSRGBToLinear())],
        ["thick", new THREE.Uniform(thick)],
        ["fadeNear", new THREE.Uniform(near)],
        ["fadeFar", new THREE.Uniform(far)],
        ["strength", new THREE.Uniform(0.85)],
        ["tNormal", new THREE.Uniform(normal)],
        ["useNormal", new THREE.Uniform(normal ? 1 : 0)],
      ]),
    });
  }
}

function Ink({ color, near, far }: { color: string; near: number; far: number }) {
  const { gl, size } = useThree();
  const ctx = useContext(EffectComposerContext);
  const thick = Math.max(0.75, (size.height * gl.getPixelRatio()) / 1080);
  const normal = ctx?.normalPass?.texture ?? null;
  const effect = useMemo(() => new InkEffect({ color, thick, near, far, normal }), [color, thick, near, far, normal]);
  return <primitive object={effect} />;
}

/** cover / dashboard post: ink lines → light bloom → vignette → ACES (after-p2 tone) */
export function OdysseyPost({ ink = "#3A2A30", near = 12, far = 60, bloom = true, low = false }: { ink?: string; near?: number; far?: number; bloom?: boolean; low?: boolean }) {
  const budget = edgeBudget();
  const hf = typeof window !== "undefined" && (window as unknown as { __hfComposition?: boolean }).__hfComposition;
  const edges = budget.edges && !low;
  // no MSAA in the composer (black-frame flicker on some integrated AMD GPUs); the outlines hide jaggies
  return (
    <EffectComposer multisampling={hf ? 4 : 0} enableNormalPass={edges} resolutionScale={budget.scale}>
      {edges ? <Ink color={ink} near={near} far={far} /> : <></>}
      {bloom && !low ? <Bloom intensity={0.35} luminanceThreshold={0.95} luminanceSmoothing={0.15} mipmapBlur /> : <></>}
      <Vignette offset={0.28} darkness={0.42} eskil={false} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
