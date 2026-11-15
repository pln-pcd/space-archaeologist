// Shared pieces of the two story films: the camera rig (one power2.inOut move per shot, then a hold
// of at least 2.5 s; reduced motion = the final framing, no move), the seam veil drawn in the same
// WebGL pass (soft wipe, iris, dust swirl; a match cut has no veil), and dotted 3D diagram lines.
// Everything is a pure function of the film clock.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { motion } from "../../anim/kit";
import type { Seam } from "./storyline";

export type Pose = { pos: [number, number, number]; look: [number, number, number]; fov?: number };
export type FilmClock = MutableRefObject<{ t: number }>;

/** GSAP-style eases as closed forms (so any frame renders on its own) */
export const power2InOut = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const power3Out = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
export const backOut = (k: number, s = 1.3) => {
  const x = Math.min(1, Math.max(0, k)) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};
export const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
/** 0..1 progress of a window [a, b] in seconds */
export const win = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
/** move from → to during the first `moveFor` seconds (≤ 45 % of the shot), then hold */
export function placeCamera(cam: THREE.PerspectiveCamera, from: Pose, to: Pose, local: number, len: number, aspect: number) {
  const moveFor = Math.min(2.6, len * 0.45);
  const k = motion.reduced ? 1 : power2InOut(local / moveFor);
  v1.set(...from.pos).lerp(v2.set(...to.pos), k);
  // narrow windows step back a little so the subject stays in the top 70 %
  const back = aspect < 1.2 ? 1.35 : aspect < 1.5 ? 1.12 : 1;
  const look = new THREE.Vector3(...from.look).lerp(new THREE.Vector3(...to.look), k);
  cam.position.copy(look).add(v1.sub(look).multiplyScalar(back));
  cam.lookAt(look);
  const fov = (from.fov ?? 42) + ((to.fov ?? 42) - (from.fov ?? 42)) * k;
  if (Math.abs(cam.fov - fov) > 0.01) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
}

/** keep the subject in the top 70 %: shift the projection so the frame centre sits higher */
export function useFrameOffset(y = 0.12) {
  const { camera, size } = useThree();
  useFrame(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.setViewOffset(size.width, size.height, 0, size.height * y, size.width, size.height);
  });
}

const VEIL_FRAG = /* glsl */ `
uniform float uK;
uniform float uType;
uniform vec2 uCenter;
uniform vec3 uColor;
uniform float uAspect;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  float a = 0.0;
  if (uType < 1.5) {
    // v7.1 "dream dissolve": soft starlit clouds bloom from the centre and melt away (no sliding)
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float n = noise(vUv * 3.5 + uK * 0.6) * 0.55 + noise(vUv * 9.0 - uK) * 0.25;
    float r = length(p) * 0.55;
    float k = uK * 1.35;
    a = smoothstep(r + n - 0.25, r + n + 0.05, k);
    // tiny four-point sparkles riding on the cloud edge
    vec2 g = vUv * vec2(uAspect, 1.0) * 26.0;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(cell);
    float spark = step(0.86, h) * (smoothstep(0.08, 0.0, abs(f.x)) * smoothstep(0.32, 0.0, abs(f.y)) + smoothstep(0.08, 0.0, abs(f.y)) * smoothstep(0.32, 0.0, abs(f.x)));
    float edge = smoothstep(0.0, 0.5, a) * (1.0 - smoothstep(0.5, 1.0, a));
    a = clamp(a + spark * edge * 1.5, 0.0, 1.0);
  } else if (uType < 2.5) {
    // iris: a circle closes on the point, then opens on the next shot
    vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
    float r = (1.0 - uK) * 1.3;
    a = smoothstep(r, r + 0.05, length(p));
  } else {
    // dust swirl (Mars): rust dust spirals in and clears
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float ang = atan(p.y, p.x) + length(p) * 6.0 * uK;
    float n = noise(vec2(cos(ang), sin(ang)) * 2.5 + length(p) * 4.0 + uK * 3.0);
    a = smoothstep(0.15, 0.75, uK * 1.25 + n * 0.45 - length(p) * 0.35);
  }
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
}`;

/** the seam veil: a full-screen quad drawn last, in the same pass as the scene */
export function Veil({ clock, getVeil, color = "#F3ECFF", dust = "#C98D62", ink = "#14102E" }: { clock: FilmClock; getVeil: (t: number) => { veil: number; seam: Seam; center?: [number, number] }; color?: string; dust?: string; ink?: string }) {
  const { size } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uType: { value: 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uColor: { value: new THREE.Color(color) }, uAspect: { value: 1 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: VEIL_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const v = getVeil(clock.current.t);
    const on = !motion.reduced && v.veil > 0.001 && v.seam !== "cut" && v.seam !== "match";
    if (mesh.current) mesh.current.visible = on;
    if (!on) return;
    mat.uniforms.uK.value = v.veil;
    mat.uniforms.uType.value = v.seam === "wipe" ? 1 : v.seam === "iris" ? 2 : 3;
    mat.uniforms.uColor.value.set(v.seam === "dust" ? dust : v.seam === "iris" ? ink : color);
    mat.uniforms.uAspect.value = size.width / size.height;
    if (v.center) mat.uniforms.uCenter.value.set(...v.center);
  });
  return (
    <mesh ref={mesh} material={mat} frustumCulled={false} renderOrder={999} userData={{ noOutline: true }}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** a dotted diagram line along points, revealed 0..1 (no outline, glows softly) */
export function DottedPath({ points, reveal, color = "#FFE6A8", size = 0.06, gap = 0.35 }: { points: THREE.Vector3[]; reveal: MutableRefObject<number>; color?: string; size?: number; gap?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const n = Math.max(2, Math.floor(curve.getLength() / gap));
  const dots = useMemo(() => Array.from({ length: n }, (_, i) => curve.getPointAt(i / (n - 1))), [curve, n]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    g.current?.children.forEach((c, i) => (c.visible = i / (n - 1) <= reveal.current + 1e-4));
  });
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), toneMapped: false }), [color]);
  return (
    <group ref={g} userData={{ noOutline: true }}>
      {dots.map((p, i) => (
        <mesh key={i} position={p} material={mat}>
          <sphereGeometry args={[size, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}
