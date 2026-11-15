// Cream swirl dissolve (bible §7, §12): our own procedural mask (polar coordinates, a twist that
// grows toward the centre, soft fbm), sampled with a UV scale 1 → 2 as it plays and swept with a
// soft threshold. It reveals the scene from cream (boot, arriving in a chapter) or swirls cream in
// (boarding, diving into a storybook). Slow and low-contrast: safe for photosensitive players.
// Reduced motion: a 0.6 s crossfade instead.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import gsap from "gsap";
import { motion as motionPrefs } from "../anim/kit";
import { isLegacyStyle } from "../style/styleMode";

type Mode = "idle" | "cover" | "reveal" | "hold";
type SwirlState = { mode: Mode; progress: number };
export const useSwirl = create<SwirlState>()(() => ({ mode: "idle", progress: 0 }));
const CREAM = [1, 0.992, 0.973]; // #FFFDF8
const MIST = [0.875, 0.914, 0.953]; // #dfe9f3

let tween: gsap.core.Tween | null = null;
function run(mode: "cover" | "reveal", seconds: number, ease: string) {
  tween?.kill();
  const reduced = motionPrefs.reduced;
  const o = { p: 0 };
  useSwirl.setState({ mode, progress: 0 });
  return new Promise<void>((resolve) => {
    tween = gsap.to(o, {
      p: 1,
      duration: reduced ? 0.6 : seconds,
      ease: reduced ? "none" : ease,
      onUpdate: () => useSwirl.setState({ progress: o.p }),
      onComplete: () => {
        useSwirl.setState({ mode: mode === "cover" ? "hold" : "idle", progress: 1 });
        resolve();
      },
    });
  });
}
/** cream swirls in until the screen is cream (then holds) */
export const swirlCover = (seconds = 1.2) => run("cover", seconds, "inOut2");
/** the scene swirls out of cream */
export const swirlReveal = (seconds = 4) => run("reveal", seconds, "none");
/** jump straight to a full cream screen (e.g. before a reveal) */
export const swirlHold = () => {
  tween?.kill();
  useSwirl.setState({ mode: "hold", progress: 1 });
};

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uProgress, uMargin, uAspect, uAlphaMode;
uniform vec3 uCream;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// bright, curling centre fading to dark edges (our own swirl, no texture)
float swirl(vec2 uv) {
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float tw = a + 7.0 * pow(max(0.0, 0.8 - r), 1.6);
  vec2 q = vec2(cos(tw), sin(tw)) * r;
  float n = fbm(q * 4.5 + 3.1) * 0.65 + fbm(q * 9.0 - 1.7) * 0.35;
  float base = 1.0 - smoothstep(0.0, 0.78, r);
  return clamp(base * 0.78 + (n - 0.5) * 0.55 + 0.08, 0.0, 1.0);
}
void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uAspect;
  uv /= max(uAspect, 1.0);
  uv /= 1.0 + uProgress; // the mask zooms in as it plays
  float t = 1.0 - swirl(uv);
  float p = mix(-uMargin, 1.0, uProgress);
  float shown = smoothstep(p + uMargin, p, t); // 1 = scene visible
  float a = uAlphaMode > 0.5 ? 1.0 - shown : shown;
  gl_FragColor = vec4(uCream, a);
}`;
const VERT = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

/** Mount once near the app root. Draws only while a swirl is playing or holding. */
export function SwirlLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mode = useSwirl((s) => s.mode);
  const gl = useRef<{ g: WebGLRenderingContext; prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null> } | null>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || gl.current) return;
    const g = c.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!g) return;
    const sh = (type: number, src: string) => {
      const s = g.createShader(type)!;
      g.shaderSource(s, src);
      g.compileShader(s);
      return s;
    };
    const prog = g.createProgram()!;
    g.attachShader(prog, sh(g.VERTEX_SHADER, VERT));
    g.attachShader(prog, sh(g.FRAGMENT_SHADER, FRAG));
    g.linkProgram(prog);
    g.useProgram(prog);
    const buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(prog, "position");
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ["uProgress", "uMargin", "uAspect", "uAlphaMode", "uCream"]) u[n] = g.getUniformLocation(prog, n);
    gl.current = { g, prog, u };
  }, []);
  useEffect(() => {
    const draw = (s: SwirlState) => {
      const c = canvas.current,
        k = gl.current;
      if (!c || !k || s.mode === "idle") return;
      const dpr = Math.min(1, devicePixelRatio || 1); // a soft mask needs few pixels
      const w = Math.round(innerWidth * dpr * 0.6),
        h = Math.round(innerHeight * dpr * 0.6);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const { g, u } = k;
      g.viewport(0, 0, w, h);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      const reduced = motionPrefs.reduced;
      // cover runs the reveal backwards; hold = full cream
      const p = s.mode === "hold" ? 0 : s.mode === "cover" ? 1 - s.progress : s.progress;
      g.uniform1f(u.uProgress, reduced ? -0.2 : p);
      g.uniform1f(u.uMargin, 0.09);
      g.uniform1f(u.uAspect, innerWidth / Math.max(1, innerHeight));
      g.uniform1f(u.uAlphaMode, 1);
      g.uniform3fv(u.uCream, isLegacyStyle() ? CREAM : MIST);
      g.drawArrays(g.TRIANGLES, 0, 3);
      // reduced motion: a plain crossfade of the cream page
      if (canvas.current) canvas.current.style.opacity = reduced ? String(s.mode === "hold" ? 1 : s.mode === "cover" ? s.progress : 1 - s.progress) : "1";
    };
    draw(useSwirl.getState());
    return useSwirl.subscribe(draw);
  }, []);
  return <canvas ref={canvas} className={`swirl-layer ${mode === "idle" ? "off" : ""}`} aria-hidden="true" />;
}
