// Outlines (bible §22, CUTE POLISH v2 §C2): inverted-hull lines on characters, Nova and interactables.
// Each mesh gets a back-face twin that is pushed outwards in SCREEN space, so the line keeps its pixel
// width while the camera zooms. Line weights are given at 1080p and scale with the drawing height:
// characters 3.25 px, interactables/machines/astronauts 2.5 px, environment pieces 1.75 px.
// The colour is a warm dark version of the mesh's own colour (value × 0.35, nudged warm), never black.
// Skipped: transparent or glassy materials, points, sprites, lines, and anything marked noOutline.
import { useEffect, useLayoutEffect, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isLegacyStyle } from "../style/styleMode";

export type OutlineKind = "character" | "interactable" | "env";
// new-flow prompt §1d.3: Nova 3 px, objects 2–2.5 px, environment 1.5 px (at 1080p)
export const LINE_PX: Record<OutlineKind, number> = { character: 3, interactable: 2.25, env: 1.5 };
/** base line colours per world (used when a mesh has no readable colour) */
export const WORLD_LINE = { earth: "#4A3A33", ship: "#3A3340", moon: "#2E2E31", mars: "#4A2C22", skin: "#3B2A26" };

/** shared: drawing-buffer height in px (set by <OutlineSync/>) */
const uScale = { value: new THREE.Vector2(1 / 540, 1 / 960) };

const cache = new Map<string, THREE.ShaderMaterial>();
function lineMaterial(color: THREE.Color, px: number) {
  const key = color.getHexString() + px;
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uColor: { value: color.clone() }, uPx: { value: px }, uScale },
    vertexShader: /* glsl */ `
      uniform float uPx;
      uniform vec2 uScale;
      void main() {
        // blend the face normal with the direction from the mesh centre: closed boxes and cylinders
        // keep a continuous line at their corners
        vec3 dir = normalize(mix(normal, normalize(position + vec3(1e-5)), 0.55));
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * dir);
        vec2 off = normalize(n.xy + vec2(1e-6)) * uPx * uScale * clip.w;
        clip.xy += off;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  cache.set(key, m);
  return m;
}

/** warm dark of a colour: value × 0.35, a little warmer */
export function inkOf(c: THREE.Color) {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const warm = hsl.h > 0.12 && hsl.h < 0.6 ? hsl.h - 0.03 : hsl.h;
  return new THREE.Color().setHSL(warm, Math.min(0.45, hsl.s * 0.7 + 0.08), Math.max(0.1, Math.min(0.2, hsl.l * 0.35)));
}

function meshColor(mesh: THREE.Mesh): THREE.Color | null {
  const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material & { color?: THREE.Color; uniforms?: Record<string, { value: unknown }> };
  if (mat?.color instanceof THREE.Color) return mat.color;
  const u = mat?.uniforms?.uColor?.value ?? mat?.uniforms?.color?.value ?? mat?.uniforms?.diffuse?.value;
  return u instanceof THREE.Color ? u : null;
}

/** add hull outlines to every eligible mesh under `root` (idempotent) */
export function withOutlines(root: THREE.Object3D, { kind = "interactable" as OutlineKind, color }: { kind?: OutlineKind; color?: string } = {}) {
  if (isLegacyStyle()) return;
  const px = LINE_PX[kind];
  const todo: THREE.Mesh[] = [];
  const skipTree = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p && p !== root.parent; p = p.parent) if (p.userData.noOutline) return true;
    return false;
  };
  const box = new THREE.Box3(),
    size = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.outline || m.userData.hasOutline || skipTree(m)) return;
    // tiny details (eyes, buttons, rivets) get ink in their texture instead of a hull
    box.setFromObject(m).getSize(size);
    if (Math.max(size.x, size.y, size.z) < (kind === "env" ? 0.25 : 0.06)) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material & { transmission?: number };
    if (!mat || mat.transparent || (mat.transmission ?? 0) > 0 || mat.blending === THREE.AdditiveBlending) return;
    if (!(m.geometry as THREE.BufferGeometry).attributes?.normal) return;
    // flat decals (planes, circles) don't need a hull
    const g = m.geometry as THREE.BufferGeometry & { type?: string };
    if (g.type === "PlaneGeometry" || g.type === "CircleGeometry" || g.type === "RingGeometry") return;
    todo.push(m);
  });
  for (const m of todo) {
    const base = color ? new THREE.Color(color) : meshColor(m);
    const ink = base ? inkOf(base) : new THREE.Color(WORLD_LINE.ship);
    const hull = new THREE.Mesh(m.geometry, lineMaterial(ink, px));
    hull.userData.outline = true;
    hull.renderOrder = m.renderOrder - 1;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.raycast = () => {};
    hull.layers.mask = m.layers.mask;
    m.add(hull);
    m.userData.hasOutline = true;
  }
}

/** React: outline a group once it has mounted (and once more after late children arrive) */
export function useOutlines(ref: RefObject<THREE.Object3D | null>, kind: OutlineKind = "interactable", deps: unknown[] = []) {
  // during the commit, so a HyperFrames composition (flushSync mount) has its lines on frame 0
  useLayoutEffect(() => {
    if (ref.current) withOutlines(ref.current, { kind });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  // in the game, late children (lazy parts) get theirs a moment later; never inside a composition
  useEffect(() => {
    if ((window as unknown as { __hfComposition?: boolean }).__hfComposition) return;
    const t = setTimeout(() => ref.current && withOutlines(ref.current, { kind }), 600);
    return () => clearTimeout(t);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/** keeps the outline pixel width tied to the drawing height (1080p reference); mount once per Canvas */
export function OutlineSync() {
  const { gl } = useThree();
  const v = new THREE.Vector2();
  useFrame(() => {
    gl.getDrawingBufferSize(v);
    // clip-space size of one 1080p pixel at this drawing size: (2/w, 2/h) × (h/1080)
    const k = Math.max(1, v.y) / 1080;
    uScale.value.set((2 / Math.max(1, v.x)) * k, (2 / Math.max(1, v.y)) * k);
  });
  return null;
}
