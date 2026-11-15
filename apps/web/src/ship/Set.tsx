import { useOutlines } from "../fx/outline";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import * as THREE from "three";
import { chapters, type ChapterState } from "../chapters";
import { ambient, Spring, hump, life, popEase } from "../anim/kit";
import { PAL } from "../style/palette";
import { blobTexture, glowMaterial, toonMaterial, toonUnique, windy } from "../style/toon";
import { rampMaterial } from "../fx/ramp";
import { isLegacyStyle } from "../style/styleMode";
import { Steam } from "../fx/Steam";
import { BOOK_POS, CTRL_R, CTRL_Z, DOOR1, DOOR2, HUB_R, where } from "./layout";
import { Pedestal, bookLook, highlight } from "./Pedestal";

/*
 * The ship set, "Quiet Afternoon in Space" (bible §6 MASTER): a working spacecraft interior in
 * warm neutrals. Bone hull panels with seams, warm-grey ribs and handrails, sandstone deck with
 * slate seams, graphite ceiling, slate consoles with soft green readouts. Colour only on a few
 * indicator lights and the one launch button. Nothing moves without a reason.
 */

const T = toonMaterial;
/** canvas lettering on in-world panels: Bigelow Rules for signs, Roboto Mono for technical readouts (or legacy Stylish / Plex Mono) */
export const FONT = isLegacyStyle() ? '"Stylish", sans-serif' : '"Bigelow Rules", cursive, serif';
export const MONO = isLegacyStyle() ? '"IBM Plex Mono", ui-monospace, monospace' : '"Roboto Mono", monospace';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function canvasTexture(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function useCanvas(key: string, w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const t = useMemo(() => canvasTexture(w, h, draw), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => t.dispose(), [t]);
  return t;
}
const rr = (x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) => {
  x.beginPath();
  x.roundRect(X, Y, W, H, r);
};

/** Hide a group while `hidden(z)` is true for the explorer (keeps the camera's view clear). */
export function Occluder({ hidden, children }: { hidden: (z: number) => boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.visible = !hidden(where.z);
  });
  return <group ref={g}>{children}</group>;
}

/**
 * Clickable station. It never moves: no hover bounce, no squash when pressed (bible §1). The
 * cursor and the action prompt say it can be used.
 */
export function Clickable({ id, onSpot, children }: { id: string; onSpot: (id: string) => void; children: ReactNode }) {
  const st = useMemo(() => ({ hover: false }), []);
  // interactables wear a 2.5 px outline (bible §22)
  const g = useRef<THREE.Group>(null);
  useOutlines(g, "interactable");
  return (
    <group
      ref={g}
      name={id}
      onClick={(e) => {
        e.stopPropagation();
        onSpot(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        st.hover = true;
        highlight.hover = id;
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        st.hover = false;
        if (highlight.hover === id) highlight.hover = null;
        document.body.style.cursor = "auto";
      }}
    >
      {children}
    </group>
  );
}

/** Soft contact shadow under a prop. */
export function Blob({ size = 1, position = [0, 0, 0], opacity = 1 }: { size?: number; position?: [number, number, number]; opacity?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], 0.025 + position[1], position[2]]} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={blobTexture()} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** A small warm fixture (#FFE9C7 lamp light, flat, no glow). */
export function Lamp({ position, size = 0.13, color = PAL.lamp }: { position: [number, number, number]; size?: number; color?: string }) {
  return (
    <mesh position={position} material={glowMaterial(color, 1)}>
      <cylinderGeometry args={[size, size * 1.2, size * 0.6, 12]} />
    </mesh>
  );
}

export function Pipe({ points, radius = 0.11, color = PAL.ribs }: { points: [number, number, number][]; radius?: number; color?: string }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q)), false, "catmullrom", 0.05), 48, radius, 8), [points, radius]);
  const ends = [points[0], points[points.length - 1]];
  return (
    <group>
      <mesh geometry={geo} material={T(color)} castShadow />
      {ends.map((p, i) => (
        <mesh key={i} position={p} material={T(PAL.graphite)}>
          <sphereGeometry args={[radius * 1.4, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function screenTex(title: string, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  return canvasTexture(512, 352, (x, w, h) => {
    x.fillStyle = PAL.screen;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = PAL.screenInk;
    x.fillStyle = PAL.screenInk;
    x.lineWidth = 4;
    x.lineCap = "round";
    x.lineJoin = "round";
    draw(x, w, h);
    x.font = `400 30px ${MONO}`;
    x.textAlign = "center";
    x.fillText(title.toUpperCase(), w / 2, h - 30);
  });
}
export function Screen({ position, rotation, w = 1.6, h = 1.1, title, draw }: { position: [number, number, number]; rotation?: [number, number, number]; w?: number; h?: number; title: string; draw: (x: CanvasRenderingContext2D, w: number, h: number) => void }) {
  const tex = useMemo(() => screenTex(title, draw), [title]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[w + 0.3, h + 0.3, 0.2]} radius={0.04} material={T(PAL.graphite)} castShadow />
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Space outside                                                       */
/* ------------------------------------------------------------------ */

/** natural colours (bible §6: Earth, Moon and Mars as they look, softened by the grade) */
const PLANETS: Record<string, { a: string; b: string; bands?: boolean; craters?: boolean; ring?: boolean }> = {
  moon: { a: "#B9B6B0", b: "#8A8782", craters: true },
  mars: { a: "#B8714F", b: "#8C5038", craters: true },
  jupiter: { a: "#D9C7A8", b: "#A98663", bands: true },
  interstellar: { a: "#6F6B66", b: "#57534F" },
  saturn: { a: "#D8C9A6", b: "#B49C70", bands: true, ring: true },
  earth: { a: "#4F7395", b: "#7F936A" },
};
export function LowPolyPlanet({ kind, radius = 1, spin = 0.12 }: { kind: string; radius?: number; spin?: number }) {
  const p = PLANETS[kind] || PLANETS.moon;
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(radius, 2).toNonIndexed();
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const A = new THREE.Color(p.a),
      B = new THREE.Color(p.b),
      c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 / radius;
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 / radius;
      let k = 0.5 + 0.5 * Math.sin(x * 3.1 + y * 1.7);
      if (p.bands) k = 0.5 + 0.5 * Math.sin(y * 9);
      if (p.craters) k = Math.sin(x * 7) * Math.cos(y * 6) > 0.55 ? 0.95 : 0.25;
      if (kind === "earth") k = Math.sin(x * 4 + y * 3) > 0.2 ? 1 : 0;
      c.copy(A).lerp(B, k);
      // Earth: soft white cloud bands and polar caps
      if (kind === "earth" && (Math.abs(y) > 0.82 || Math.sin(x * 9 + y * 5) > 0.75)) c.set("#E6E8E6");
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, [kind, radius]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * spin * ambient();
  });
  return (
    <group ref={ref}>
      <mesh geometry={geo} material={T("#ffffff", { vertexColors: true })} />
      {p.ring && (
        <mesh rotation={[Math.PI / 2.4, 0, 0]} material={T(p.b, { side: THREE.DoubleSide })}>
          <ringGeometry args={[radius * 1.35, radius * 1.7, 28]} />
        </mesh>
      )}
    </group>
  );
}

/** Round brass porthole with a tiny low-poly planet (and moon) floating in a starry recess. */
export function Porthole({ position, rotation, kind, warpRef, size = 2.3 }: { position: [number, number, number]; rotation: [number, number, number]; kind: string; warpRef: MutableRefObject<number>; size?: number }) {
  const stars = useCanvas("porthole-stars", 256, 256, (x, w) => {
    const g = x.createLinearGradient(0, 0, 0, w);
    g.addColorStop(0, "#1B2230");
    g.addColorStop(1, "#3A4656");
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      x.fillStyle = `rgba(236,230,218,${0.25 + r() * 0.45})`;
      x.beginPath();
      x.arc(r() * w, r() * w, 0.6 + r() * 1.6, 0, Math.PI * 2);
      x.fill();
    }
  });
  const planet = useRef<THREE.Group>(null);
  const streaks = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const w = warpRef.current;
    if (planet.current) planet.current.scale.setScalar(Math.max(0.05, 1 - w * 0.9));
    if (streaks.current) (streaks.current.material as THREE.MeshBasicMaterial).opacity = w * 0.6;
  });
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[size / 2, 32]} />
        <meshBasicMaterial map={stars} />
      </mesh>
      <group ref={planet} position={[0.1, -0.05, 0.25]}>
        <LowPolyPlanet kind={kind} radius={size * 0.2} spin={0} />
      </group>
      <mesh ref={streaks} position={[0, 0, 0.3]}>
        <circleGeometry args={[size / 2, 32]} />
        <meshBasicMaterial color="#D8E3E6" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* glass: a faint cool tint, no glow */}
      <mesh position={[0, 0, 0.32]}>
        <circleGeometry args={[size / 2, 32]} />
        <meshBasicMaterial color={PAL.glass} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* graphite frame with a warm-grey bezel */}
      <mesh material={T(PAL.graphite)} castShadow>
        <torusGeometry args={[size / 2 + 0.1, 0.18, 6, 32]} />
      </mesh>
      <mesh position={[0, 0, 0.12]} material={T(PAL.ribs)}>
        <torusGeometry args={[size / 2 - 0.02, 0.05, 4, 32]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Architecture                                                        */
/* ------------------------------------------------------------------ */

/** Angle intervals of a full ring that are not inside any gap. */
function freeArcs(gaps: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let a = 0;
  const sorted = [...gaps].sort((x, y) => x[0] - y[0]);
  for (const [g0, g1] of sorted) {
    if (g0 > a) out.push([a, g0]);
    a = Math.max(a, g1);
  }
  if (a < Math.PI * 2) out.push([a, Math.PI * 2]);
  return out;
}

/**
 * Bone hull panels with thin seams all the way round a room, warm-grey ribs every ~3 m, a
 * handrail at hand height and a graphite cap. `doors` cut only the lower rows (up to the lintel
 * at 4.4); `windows` cut every row.
 */
export function PanelWall({ r, h, center, doors = [], windows = [], holes = [] }: { r: number; h: number; center: [number, number]; doors?: [number, number][]; windows?: [number, number][]; holes?: { a: number; y: number; r: number }[] }) {
  const LINTEL = 4.4;
  const rows = [
    { y0: 0, y1: 1.1, inset: 0.0, tone: 0 },
    { y0: 1.1, y1: LINTEL, inset: 0.06, tone: 1 },
    { y0: LINTEL, y1: h, inset: 0.0, tone: 2 },
  ];
  const panelW = 1.5;
  const step = (Math.PI * 2) / Math.round((Math.PI * 2 * r) / panelW);
  const items = useMemo(() => {
    const out: { m: THREE.Matrix4; c: THREE.Color; w: number; hh: number }[] = [];
    const tones = [PAL.ribs, PAL.bone, PAL.bone];
    let n = 0;
    for (let a = 0; a < Math.PI * 2 - 0.001; a += step) {
      const mid = a + step / 2;
      for (const row of rows) {
        const cut = [...windows, ...(row.y1 <= LINTEL + 0.01 ? doors : [])];
        if (cut.some(([g0, g1]) => mid > g0 && mid < g1)) continue;
        const ym = (row.y0 + row.y1) / 2;
        if (holes.some((o) => Math.abs(mid - o.a) < (o.r + 0.2) / r && Math.abs(ym - o.y) < o.r + 0.2)) continue;
        const rad = r - 0.12 - row.inset;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(Math.sin(mid) * rad, ym, Math.cos(mid) * rad),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mid + Math.PI),
          new THREE.Vector3(1, 1, 1),
        );
        const c = new THREE.Color(tones[row.tone]).offsetHSL(0, 0, ((n * 37) % 7) * 0.004 - 0.012);
        out.push({ m, c, w: r * step - 0.05, hh: row.y1 - row.y0 - 0.05 });
        n++;
      }
    }
    return out;
  }, [r, h, doors, windows, holes]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      const k = it.hh.toFixed(2);
      map.set(k, [...(map.get(k) || []), it]);
    }
    return [...map.entries()];
  }, [items]);
  const lowArcs = useMemo(() => freeArcs([...doors, ...windows]), [doors, windows]);
  const highArcs = useMemo(() => freeArcs(windows), [windows]);
  return (
    <group position={[center[0], 0, center[1]]}>
      {/* solid backing so no seam between panels ever shows outside */}
      {lowArcs.map(([a0, a1]) => (
        <mesh key={"l" + a0} position={[0, LINTEL / 2, 0]}>
          <cylinderGeometry args={[r + 0.05, r + 0.05, LINTEL, 32, 1, true, a0, a1 - a0]} />
          <meshBasicMaterial color="#4c4946" side={THREE.BackSide} />
        </mesh>
      ))}
      {highArcs.map(([a0, a1]) => (
        <mesh key={"h" + a0} position={[0, (LINTEL + h) / 2, 0]}>
          <cylinderGeometry args={[r + 0.05, r + 0.05, h - LINTEL, 32, 1, true, a0, a1 - a0]} />
          <meshBasicMaterial color="#4c4946" side={THREE.BackSide} />
        </mesh>
      ))}
      {groups.map(([k, list]) => (
        <PanelInstances key={k} list={list} />
      ))}
      {/* warm-grey handrail and graphite cap */}
      {lowArcs.map(([a0, a1]) => (
        <mesh key={"r" + a0} position={[0, 1.05, 0]} material={T(PAL.ribs, { side: THREE.DoubleSide, flat: false })}>
          <cylinderGeometry args={[r - 0.42, r - 0.42, 0.07, 48, 1, true, a0, a1 - a0]} />
        </mesh>
      ))}
      {highArcs.map(([a0, a1]) => (
        <mesh key={"c" + a0} position={[0, h + 0.05, 0]} material={T(PAL.graphite, { side: THREE.DoubleSide })}>
          <cylinderGeometry args={[r, r, 0.24, 32, 1, true, a0, a1 - a0]} />
        </mesh>
      ))}
      <Ribs r={r} h={h} gaps={[...doors, ...windows]} holes={holes} />
    </group>
  );
}

/** Domed ceiling with soft panel ribs and a ring of little lights (closes the hull from above). */
export function Dome({ r, wall, rise, center }: { r: number; wall: number; rise: number; center: [number, number] }) {
  const tex = useCanvas("dome-graphite" + r, 1024, 512, (x, w, h) => {
    x.fillStyle = PAL.graphite;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = "rgba(58,56,54,0.9)";
    x.lineWidth = 6;
    for (let i = 0; i < 16; i++) {
      const X = (i / 16) * w;
      x.beginPath();
      x.moveTo(X, 0);
      x.lineTo(X, h);
      x.stroke();
    }
    for (const y of [h * 0.35, h * 0.7]) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(w, y);
      x.stroke();
    }
  });
  const mat = useMemo(() => rampMaterial("#ffffff", { map: tex, side: THREE.BackSide }), [tex]);
  return (
    <group position={[center[0], wall, center[1]]}>
      <mesh scale={[1, rise / (r + 0.2), 1]} material={mat}>
        <sphereGeometry args={[r + 0.2, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const rr2 = r * 0.72;
        const y = rise * Math.sqrt(1 - (rr2 / (r + 0.2)) ** 2) - 0.25;
        return (
          <mesh key={i} position={[Math.sin(a) * rr2, y, Math.cos(a) * rr2]} rotation={[0, a, 0]} material={glowMaterial(PAL.lamp, 1)}>
            <boxGeometry args={[0.12, 0.05, 1.1]} />
          </mesh>
        );
      })}
      <mesh position={[0, rise - 0.1, 0]} material={T(PAL.graphiteDark, { side: THREE.DoubleSide })}>
        <cylinderGeometry args={[1.2, 1.4, 0.2, 20]} />
      </mesh>
      <mesh position={[0, rise - 0.22, 0]} material={glowMaterial(PAL.lamp, 1)}>
        <cylinderGeometry args={[1.0, 1.0, 0.04, 20]} />
      </mesh>
    </group>
  );
}

/** Warm-grey structural ribs about every 3 m around a round room (one instanced draw). */
function Ribs({ r, h, gaps, holes }: { r: number; h: number; gaps: [number, number][]; holes: { a: number; y: number; r: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => {
    const n = Math.max(8, Math.round((Math.PI * 2 * r) / 3));
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.06;
      if (gaps.some(([g0, g1]) => a > g0 - 0.06 && a < g1 + 0.06)) continue;
      if (holes.some((o) => Math.abs(a - o.a) < (o.r + 0.35) / r)) continue;
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * (r - 0.3), h / 2, Math.cos(a) * (r - 0.3)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI), new THREE.Vector3(1, 1, 1)));
    }
    return out;
  }, [r, h, gaps, holes]);
  const geo = useMemo(() => new THREE.BoxGeometry(0.22, h, 0.3), [h]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    list.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true;
  }, [list]);
  return <instancedMesh ref={ref} args={[geo, T(PAL.ribs), list.length]} castShadow receiveShadow />;
}

function PanelInstances({ list }: { list: { m: THREE.Matrix4; c: THREE.Color; w: number; hh: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new RoundedBoxGeometry(list[0].w, list[0].hh, 0.2, 1, 0.025), [list]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    list.forEach((it, i) => {
      m.setMatrixAt(i, it.m);
      m.setColorAt(i, it.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [list]);
  return <instancedMesh ref={ref} args={[geo, T("#ffffff"), list.length]} receiveShadow />;
}

export function Floor({ radius, center, onFloor, rings = 5 }: { radius: number; center: [number, number]; onFloor: (e: ThreeEvent<MouseEvent>) => void; rings?: number }) {
  // Bible §6 MASTER floor: sandstone tiles with thin slate seams, a slate inlay ring with darker
  // engraved orbit lines (no glow, no sparkles), and a warm floor-light strip along the walkway.
  const tex = useCanvas("floor-sandstone-v6" + radius + rings, 1024, 1024, (x, w) => {
    const R = w / 2;
    const px = R / (radius + 0.3); // pixels per unit
    // sandstone tiles: slight tone variation per tile, thin slate seams on a 1.2 m grid
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tile = 1.2 * px;
    for (let ty = 0; ty < w; ty += tile)
      for (let tx = 0; tx < w; tx += tile) {
        const v = rnd();
        x.fillStyle = v < 0.33 ? "#B3A792" : v < 0.66 ? "#B8AC97" : "#AEA28D";
        x.fillRect(tx, ty, tile, tile);
      }
    x.strokeStyle = "rgba(85,100,107,0.55)";
    x.lineWidth = 2;
    for (let t = 0; t <= w; t += tile) {
      x.beginPath();
      x.moveTo(t, 0);
      x.lineTo(t, w);
      x.moveTo(0, t);
      x.lineTo(w, t);
      x.stroke();
    }
    // fine grit (paint texture, very low contrast)
    for (let k = 0; k < 5000; k++) {
      x.fillStyle = rnd() < 0.5 ? "rgba(122,116,104,0.12)" : "rgba(216,205,184,0.12)";
      x.fillRect(rnd() * w, rnd() * w, 2, 2);
    }
    // warm floor-light strip along the walkway ring
    x.strokeStyle = "#7A7468";
    x.lineWidth = R * 0.035;
    x.beginPath();
    x.arc(R, R, R * 0.8, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = "#F3E3C4";
    x.lineWidth = R * 0.012;
    x.beginPath();
    x.arc(R, R, R * 0.8, 0, Math.PI * 2);
    x.stroke();
    // slate inlay ring with a sandstone centre disc
    const inlay = R * 0.6;
    x.fillStyle = "#55646B";
    x.beginPath();
    x.arc(R, R, inlay, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#3B464C";
    x.lineWidth = 5;
    x.stroke();
    // engraved orbit lines: concentric, darker slate, a few small marker ticks
    x.strokeStyle = "#3B464C";
    x.lineWidth = 3;
    for (const k of [0.92, 0.82, 0.7]) {
      x.beginPath();
      x.arc(R, R, inlay * k, 0, Math.PI * 2);
      x.stroke();
    }
    x.lineWidth = 4;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      x.beginPath();
      x.moveTo(R + Math.cos(a) * inlay * 0.94, R + Math.sin(a) * inlay * 0.94);
      x.lineTo(R + Math.cos(a) * inlay * (i % 6 ? 0.9 : 0.84), R + Math.sin(a) * inlay * (i % 6 ? 0.9 : 0.84));
      x.stroke();
    }
    // a light-slate engraved line just inside the rim (catches the light)
    x.strokeStyle = "#7E9097";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(R, R, inlay * 0.97, 0, Math.PI * 2);
    x.stroke();
    // sandstone centre: the slate reads as a ring around the library
    x.fillStyle = "#B3A792";
    x.beginPath();
    x.arc(R, R, inlay * 0.56, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#3B464C";
    x.lineWidth = 4;
    x.stroke();
  });
  const mat = useMemo(() => rampMaterial("#ffffff", { map: tex }), [tex]);
  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onFloor} material={mat}>
        <circleGeometry args={[radius + 0.3, 64]} />
      </mesh>
      <mesh position={[0, -0.28, 0]} material={T(PAL.graphite)}>
        <cylinderGeometry args={[radius + 0.2, radius + 0.35, 0.5, 48]} />
      </mesh>
      {/* graphite kick plate where the deck meets the hull */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={T(PAL.graphite)}>
        <torusGeometry args={[radius - 0.05, 0.1, 4, 64]} />
      </mesh>
    </group>
  );
}

/** A low planter with sage leaves (bible §6: at most two in the whole base). The leaves sway
 *  only sometimes, gently (seeded per plant, grows with height); the pot never moves. */
export function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number; near?: boolean }) {
  const leafA = useMemo(() => T(PAL.sage, { sway: 0.3, flat: true }), []);
  const leafB = useMemo(() => T("#82AD8C", { sway: 0.3, flat: true }), []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]} material={T(PAL.ribs)} castShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
      </mesh>
      <mesh position={[0, 0.61, 0]} material={T(PAL.graphite)}>
        <boxGeometry args={[0.84, 0.04, 0.84]} />
      </mesh>
      <group position={[0, 0.62, 0]}>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.14, 0.38 + (i % 3) * 0.1, Math.sin(a) * 0.14]} rotation={[Math.cos(a) * 0.45, -a, Math.sin(a) * 0.45]} scale={[0.16, 0.7, 0.07]} material={i % 2 ? leafA : leafB} castShadow>
              <octahedronGeometry args={[0.6, 0]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export function DoorFrame({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.1, 2.35, 0]} material={T(PAL.graphite)} castShadow>
          <boxGeometry args={[0.7, 4.7, 0.9]} />
        </mesh>
      ))}
      <mesh position={[0, 4.62, 0]} material={T(PAL.graphite)} castShadow>
        <boxGeometry args={[4.9, 0.8, 0.9]} />
      </mesh>
      {/* one steady sage status light over the door */}
      <BlinkLight position={[1.55, 4.62, 0.47]} color={PAL.sage} />
    </group>
  );
}

/** A small steady indicator LED (sage = ok, terracotta = attention). No blinking. */
export function BlinkLight({ position, color, size = 0.05 }: { position: [number, number, number]; color: string; phase?: number; size?: number }) {
  return (
    <mesh position={position} material={glowMaterial(color, 1)}>
      <cylinderGeometry args={[size, size, 0.03, 10]} />
    </mesh>
  );
}

export function CrewCorner({ onSpot }: { onSpot: (id: string) => void }) {
  return (
    <group position={[-5.9, 0, 5.4]} rotation={[0, 0.75, 0]}>
      {/* plain woven rug in warm grey */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.6]} material={T(PAL.ribsLight)} receiveShadow>
        <planeGeometry args={[3.4, 2.4]} />
      </mesh>
      <Clickable id="sofa" onSpot={onSpot}>
        <group>
          {/* dusty-blue sofa: straight lines, soft bevels */}
          <RoundedBox args={[2.7, 0.5, 1.1]} radius={0.06} position={[0, 0.38, 0]} material={T(PAL.blue)} castShadow receiveShadow />
          <RoundedBox args={[2.7, 0.85, 0.32]} radius={0.06} position={[0, 0.85, -0.42]} material={T(PAL.blue)} castShadow />
          {[-1, 1].map((s) => (
            <RoundedBox key={s} args={[0.3, 0.7, 1.1]} radius={0.05} position={[s * 1.35, 0.55, 0]} material={T(PAL.blue)} castShadow />
          ))}
          {[-1, 1].map((s) => (
            <mesh key={"leg" + s} position={[s * 1.25, 0.07, 0]} material={T(PAL.graphite)}>
              <boxGeometry args={[0.06, 0.14, 0.9]} />
            </mesh>
          ))}
          <RoundedBox args={[0.55, 0.42, 0.14]} radius={0.05} position={[-0.75, 0.82, -0.2]} rotation={[0.25, 0.15, 0]} material={T(PAL.boneLight)} />
        </group>
      </Clickable>
      {/* cozy low table with steaming mug (Mistwood aesthetic) */}
      {!isLegacyStyle() && (
        <group position={[0, 0, 0.75]}>
          <mesh position={[0, 0.14, 0]} material={T(PAL.graphite)}>
            <cylinderGeometry args={[0.38, 0.38, 0.03, 16]} />
          </mesh>
          <mesh position={[0, 0.07, 0]} material={T(PAL.ribs)}>
            <cylinderGeometry args={[0.04, 0.04, 0.14, 8]} />
          </mesh>
          <group position={[0.1, 0.16, -0.04]}>
            <mesh material={T(PAL.bone)}>
              <cylinderGeometry args={[0.04, 0.036, 0.08, 12]} />
            </mesh>
            <Steam position={[0, 0.05, 0]} width={0.07} height={0.32} color="#ffe7dd" />
          </group>
        </group>
      )}
      <Clickable id="lamp-sofa" onSpot={onSpot}>
        <group position={[1.95, 0, -0.1]}>
          <mesh position={[0, 0.03, 0]} material={T(PAL.graphite)}>
            <cylinderGeometry args={[0.24, 0.24, 0.06, 12]} />
          </mesh>
          <mesh position={[0, 0.8, 0]} material={T(PAL.ribs)}>
            <cylinderGeometry args={[0.03, 0.03, 1.5, 6]} />
          </mesh>
          <mesh position={[0, 1.62, 0]} material={T(PAL.ribs, { side: THREE.DoubleSide })}>
            <cylinderGeometry args={[0.2, 0.32, 0.34, 14, 1, true]} />
          </mesh>
          <mesh position={[0, 1.47, 0]} rotation={[Math.PI / 2, 0, 0]} material={glowMaterial(PAL.lamp, 1)}>
            <circleGeometry args={[0.3, 14]} />
          </mesh>
        </group>
      </Clickable>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Corridor                                                            */
/* ------------------------------------------------------------------ */

export function Corridor({ onSpot, onFloor, doors }: { onSpot: (id: string) => void; onFloor: (e: ThreeEvent<MouseEvent>) => void; doors: MutableRefObject<(THREE.Group | null)[]> }) {
  const len = DOOR1 - DOOR2;
  const mid = (DOOR1 + DOOR2) / 2;
  const panels = Math.round(len / 1.4);
  return (
    <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, mid]} receiveShadow onClick={onFloor} material={T(PAL.sand)}>
          <planeGeometry args={[3.6, len + 1.4]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, mid]} material={T(PAL.slate)}>
          <planeGeometry args={[1.4, len + 1.2]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 1.95, 2.2, mid]} rotation={[0, (s * -Math.PI) / 2, 0]}>
              <planeGeometry args={[len - 0.2, 4.4]} />
              <meshBasicMaterial color="#4c4946" side={THREE.DoubleSide} />
            </mesh>
            {Array.from({ length: panels }, (_, i) => (
              <mesh key={i} position={[s * 1.82, 2.4, DOOR1 - 0.7 - i * (len / panels)]} material={T(PAL.bone)} receiveShadow>
                <boxGeometry args={[0.2, 3.0, len / panels - 0.06]} />
              </mesh>
            ))}
            <mesh position={[s * 1.8, 0.4, mid]} material={T(PAL.ribs)}>
              <boxGeometry args={[0.26, 0.8, len]} />
            </mesh>
            <mesh position={[s * 1.6, 1.05, mid]} rotation={[Math.PI / 2, 0, 0]} material={T(PAL.ribs, { flat: false })}>
              <cylinderGeometry args={[0.035, 0.035, len, 8]} />
            </mesh>
            {/* warm floor-light strip */}
            <mesh position={[s * 1.62, 0.06, mid]} material={glowMaterial(PAL.lamp, 1)}>
              <boxGeometry args={[0.04, 0.03, len - 0.4]} />
            </mesh>
          </group>
        ))}
        <Pipe points={[[-1.55, 4.0, DOOR1], [-1.55, 4.0, DOOR2]]} color={PAL.ribs} radius={0.09} />
        {[DOOR1, DOOR2].map((z, i) => (
          <group key={z} position={[0, 0, z]} ref={(g) => void (doors.current[i] = g)}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.95, 0, 0]}>
                <mesh position={[0, 2.05, 0]} material={T(PAL.bone)} castShadow>
                  <boxGeometry args={[1.85, 4.1, 0.2]} />
                </mesh>
                <mesh position={[-s * 0.85, 2.05, 0]} material={T(PAL.graphite)}>
                  <boxGeometry args={[0.12, 4.1, 0.24]} />
                </mesh>
                <mesh position={[0, 2.6, 0.11]} material={T(PAL.graphite)}>
                  <boxGeometry args={[1.2, 0.5, 0.02]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        <DoorFrame z={DOOR2} />
        {/* corridor ceiling, so the hull stays closed above, with one long warm light */}
        <mesh position={[0, 4.4, mid]} rotation={[Math.PI / 2, 0, 0]} material={T(PAL.graphite, { side: THREE.DoubleSide })}>
          <planeGeometry args={[4.0, len + 0.4]} />
        </mesh>
        <mesh position={[0, 4.36, mid]} material={glowMaterial(PAL.lamp, 1)}>
          <boxGeometry args={[0.16, 0.04, len - 0.6]} />
        </mesh>
      </group>
  );
}

/* ------------------------------------------------------------------ */
/* Control Room                                                        */
/* ------------------------------------------------------------------ */

const NODE_A = [-150, -112, -74, -36, 2].map((d) => (d * Math.PI) / 180);
const FLIGHT_PLANET: Record<string, string> = { moon: "moon", mars: "mars", jupiter: "jupiter", interstellar: "interstellar" };

/**
 * Launch Bay (bible §6 MASTER): a big window onto space, a graphite console with slate screens,
 * the terracotta dome button in a brass guard ring, a warm-grey throttle and the Reality Check
 * screen. Dusty-blue pilot seats. No toys, no blinking rainbow buttons.
 */
export const ControlRoom = memo(function ControlRoom({ here, states, onSpot, onFloor, warpRef, stage }: { here: number; states: string; onSpot: (id: string) => void; onFloor: (e: ThreeEvent<MouseEvent>) => void; warpRef: MutableRefObject<number>; stage: string }) {
  const st = states.split(",") as ChapterState[];
  const shieldA = Math.PI - 0.8,
    shieldB = Math.PI + 0.8;
  const windows = useMemo(() => [[shieldA, shieldB]] as [number, number][], [shieldA, shieldB]);
  // the corridor enters from the south (angle 0 / 2π around the room centre)
  const doors = useMemo(() => [[0, 0.28], [Math.PI * 2 - 0.28, Math.PI * 2]] as [number, number][], []);
  const planet = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!planet.current) return;
    const w = warpRef.current;
    planet.current.scale.setScalar(Math.max(0.02, 1 - w * 0.95));
  });
  return (
    <group>
      <Floor radius={CTRL_R} center={[0, CTRL_Z]} onFloor={onFloor} rings={4} />
      <PanelWall r={CTRL_R} h={5.6} center={[0, CTRL_Z]} doors={doors} windows={windows} />
      <Dome r={CTRL_R} wall={5.6} rise={3.6} center={[0, CTRL_Z]} />
      <SpaceBox stage={stage} />
      {/* the big window: graphite sill and header, warm-grey mullions */}
      <group position={[0, 0, CTRL_Z]}>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[CTRL_R - 0.1, CTRL_R - 0.1, 1.7, 32, 1, true, shieldA, shieldB - shieldA]} />
          <meshBasicMaterial color={PAL.graphite} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, 5.2, 0]}>
          <cylinderGeometry args={[CTRL_R - 0.1, CTRL_R - 0.1, 0.9, 32, 1, true, shieldA, shieldB - shieldA]} />
          <meshBasicMaterial color={PAL.graphiteDark} side={THREE.BackSide} />
        </mesh>
        <WarpGlass a={shieldA} b={shieldB} warpRef={warpRef} />
        {[shieldA + 0.03, shieldA + 0.53, shieldA + 1.07, shieldB - 0.03].map((a) => (
          <mesh key={a} position={[Math.sin(a) * (CTRL_R - 0.15), 3.2, Math.cos(a) * (CTRL_R - 0.15)]} rotation={[0, a, 0]} material={T(PAL.ribs)}>
            <boxGeometry args={[0.24, 3.3, 0.3]} />
          </mesh>
        ))}
      </group>
      {/* the destination outside the glass, in natural colours */}
      <group ref={planet} position={[3.2, 3.6, CTRL_Z - 12.5]}>
        <LowPolyPlanet kind={FLIGHT_PLANET[stage] || "moon"} radius={2.8} spin={0} />
      </group>
      <ConsoleDesk />
      <LaunchConsole onSpot={onSpot} warpRef={warpRef} here={here} states={st} />
      <FlightMonitor here={here} warpRef={warpRef} />
      {[-2.6, 2.6].map((x, i) => (
        <Clickable key={x} id={i === 0 ? "pilot-seat-left" : "pilot-seat-right"} onSpot={onSpot}>
          <group position={[x, 0, CTRL_Z - 2.6]}>
            <mesh position={[0, 0.35, 0]} material={T(PAL.graphite)}>
              <cylinderGeometry args={[0.1, 0.28, 0.7, 8]} />
            </mesh>
            <RoundedBox args={[1.1, 0.24, 1.0]} radius={0.05} position={[0, 0.8, 0]} material={T(PAL.blue)} castShadow />
            <RoundedBox args={[1.1, 1.25, 0.24]} radius={0.05} position={[0, 1.45, 0.42]} material={T(PAL.blue)} castShadow />
            <RoundedBox args={[0.6, 0.26, 0.22]} radius={0.04} position={[0, 2.18, 0.46]} material={T(PAL.graphite)} />
          </group>
        </Clickable>
      ))}
      <Clickable id="nav" onSpot={onSpot}>
        <group position={[0, 0, CTRL_Z]}>
          <mesh position={[0, 0.5, 0]} material={T(PAL.graphite)} castShadow receiveShadow>
            <cylinderGeometry args={[0.8, 1.05, 1.0, 14]} />
          </mesh>
          <mesh position={[0, 1.02, 0]} material={T(PAL.slate)}>
            <cylinderGeometry args={[0.86, 0.86, 0.06, 24]} />
          </mesh>
          <StarChart here={here} st={st} />
        </group>
      </Clickable>
      <RealityCheck />
    </group>
  );
});

/** Reality Check (bible §6): how long the real trips took, next to the pretend warp drive. A
 *  framed bone panel in the card style. */
function RealityCheck() {
  const tex = useCanvas("reality-check-v2", 768, 512, (x, w, h) => {
    x.fillStyle = "#F9F2E4";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#5D5A57";
    x.font = `400 64px ${FONT}`;
    x.fillText("Reality check", 48, 100);
    // "True story" tag
    x.fillStyle = "#716C66";
    x.fillRect(52, 128, 160, 40);
    x.fillStyle = "#E3E8E9";
    x.fillRect(48, 124, 160, 40);
    x.fillStyle = "#3B464C";
    x.font = `400 28px ${FONT}`;
    x.fillText("True story", 64, 154);
    x.fillStyle = "#6B665E";
    x.font = `400 42px ${FONT}`;
    x.fillText("Apollo 11 took about 4 days", 48, 236);
    x.fillText("to land on the Moon.", 48, 284);
    x.fillText("Opportunity took about 6½ months", 48, 360);
    x.fillText("to reach Mars.", 48, 408);
    x.fillStyle = "#6B665E";
    x.font = `400 22px ${MONO}`;
    x.fillText("OUR WARP DRIVE IS PRETEND · SOURCES F21, F4", 48, h - 36);
  });
  return (
    <group position={[Math.sin(Math.PI * 0.62) * (CTRL_R - 0.4), 2.9, CTRL_Z + Math.cos(Math.PI * 0.62) * (CTRL_R - 0.4)]} rotation={[0, Math.PI * 0.62 + Math.PI, 0]}>
      <mesh position={[0, 0, -0.06]} material={T(PAL.bone)}>
        <boxGeometry args={[2.56, 1.76, 0.1]} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.36, 1.57]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The view outside the big window: space #1B2230 → #3A4656 with a faint warm nebula band. */
function SpaceBox({ stage }: { stage: string }) {
  const tex = useCanvas("spacebox-quiet-" + stage, 2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1B2230");
    g.addColorStop(1, "#3A4656");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // nebula band #E8D5BC at ~15 %
    const band = x.createLinearGradient(0, h * 0.3, 0, h * 0.62);
    band.addColorStop(0, "rgba(232,213,188,0)");
    band.addColorStop(0.5, "rgba(232,213,188,0.15)");
    band.addColorStop(1, "rgba(232,213,188,0)");
    x.fillStyle = band;
    x.fillRect(0, 0, w, h);
    let sd = 11;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 700; i++) {
      x.fillStyle = `rgba(236,230,218,${0.2 + rnd() * 0.5})`;
      x.beginPath();
      x.arc(rnd() * w, rnd() * h, 0.5 + rnd() * 1.3, 0, Math.PI * 2);
      x.fill();
    }
  });
  return (
    <mesh position={[0, 3, CTRL_Z]}>
      <sphereGeometry args={[15, 40, 24]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} />
    </mesh>
  );
}

/** Window glass: nearly clear (#D8E3E6 at ~15 %), with soft streaks only while jumping. */
function WarpGlass({ a, b, warpRef }: { a: number; b: number; warpRef: MutableRefObject<number> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: { time: { value: 0 }, warp: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform float time, warp; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          void main(){
            vec2 w = vUv - 0.5; w.x *= 3.0; float ang = atan(w.y, w.x); float id = floor(ang*40.);
            float lane = h(vec2(id, 3.)); float t = fract(lane + time*1.2); float rad = length(w);
            float streak = smoothstep(0.1, 0.0, abs(rad - t*1.4)) * step(0.4, lane);
            vec3 tint = vec3(0.847, 0.89, 0.902);
            float a = 0.15 + warp * (0.2 + streak * 0.35);
            gl_FragColor = vec4(mix(tint, vec3(1.0, 0.914, 0.78), streak * warp), a);
          }`,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.time.value += dt;
    mat.uniforms.warp.value = warpRef.current;
  });
  return (
    <mesh position={[0, 3.2, 0]} material={mat}>
      <cylinderGeometry args={[CTRL_R - 0.12, CTRL_R - 0.12, 3.3, 32, 1, true, a, b - a]} />
    </mesh>
  );
}

/** Navigation table: an engraved slate chart; small steady lights mark the five stops. */
function StarChart({ here, st }: { here: number; st: ChapterState[] }) {
  return (
    <group position={[0, 1.07, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={T(PAL.slateDark)}>
        <ringGeometry args={[0.5, 0.52, 40]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={T(PAL.slateDark)}>
        <ringGeometry args={[0.72, 0.74, 40]} />
      </mesh>
      <mesh position={[0, 0.04, 0]} material={T(PAL.brassTrim)}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
      </mesh>
      {chapters.map((c, i) => {
        const a = NODE_A[i];
        const col = i === here ? PAL.terra : st[i] === "done" ? PAL.sage : PAL.graphite;
        return (
          <mesh key={c.id} position={[Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62]} material={i === here || st[i] === "done" ? glowMaterial(col, 1) : T(col)}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 10]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Launch console: the terracotta dome button in a brass guard ring, five small destination
 *  keys, and a warm-grey throttle. The button presses down (no squash). */
function LaunchConsole({ onSpot, warpRef, here, states }: { onSpot: (id: string) => void; warpRef: MutableRefObject<number>; here: number; states: ChapterState[] }) {
  const lever = useRef<THREE.Group>(null);
  const button = useRef<THREE.Mesh>(null);
  const press = useRef(0);
  useFrame((_, dt) => {
    if (lever.current) lever.current.rotation.x = -0.2 - warpRef.current * 0.55;
    press.current = Math.max(0, press.current - dt * 4);
    if (button.current) button.current.position.y = 0.12 - Math.min(1, press.current) * 0.05;
  });
  return (
    <group position={[0, 1.3, CTRL_Z - 5.95]}>
      <RoundedBox args={[3.3, 0.14, 0.85]} radius={0.03} material={T(PAL.graphite)} castShadow />
      <group onPointerDown={() => (press.current = 1.4)}>
        <Clickable id="launch-warp" onSpot={onSpot}>
          <group position={[0, 0.06, 0.14]}>
            {/* brass guard ring */}
            <mesh position={[0, 0.06, 0]} material={T(PAL.brassTrim)}>
              <torusGeometry args={[0.36, 0.04, 6, 24]} />
            </mesh>
            <mesh position={[0, 0.03, 0]} material={T(PAL.graphiteDark)}>
              <cylinderGeometry args={[0.38, 0.4, 0.06, 20]} />
            </mesh>
            <mesh ref={button} position={[0, 0.12, 0]} rotation={[0, 0, 0]} material={T("#9A5639", { flat: false })} castShadow>
              <sphereGeometry args={[0.27, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          </group>
        </Clickable>
      </group>
      {chapters.map((c, i) => {
        const on = i === here || states[i] === "done";
        return (
          <group key={c.id} position={[(i - 2) * 0.5 - 0.1, 0.08, -0.26]}>
            <RoundedBox args={[0.34, 0.06, 0.2]} radius={0.02} material={T(PAL.ribs)} />
            <BlinkLight position={[0.1, 0.04, 0]} color={i === here ? PAL.terra : on ? PAL.sage : PAL.graphite} size={0.025} />
          </group>
        );
      })}
      <group ref={lever} position={[1.38, 0.07, 0.08]}>
        <mesh position={[0, 0.18, 0]} material={T(PAL.ribs)}>
          <cylinderGeometry args={[0.03, 0.03, 0.36, 8]} />
        </mesh>
        <mesh position={[0, 0.38, 0]} material={T(PAL.ribsLight)}>
          <boxGeometry args={[0.24, 0.1, 0.1]} />
        </mesh>
      </group>
    </group>
  );
}

/** Flight computer: slate glass, soft green IBM Plex Mono readout (in-world technical text). */
function FlightMonitor({ here, warpRef }: { here: number; warpRef: MutableRefObject<number> }) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 420;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const last = useRef("");
  useFrame((s) => {
    const warp = warpRef.current > 0.05;
    const prog = warp ? Math.floor(((s.clock.elapsedTime * 0.8) % 1) * 20) : -1;
    const key = `${here}-${warp}-${prog}`;
    if (key === last.current) return; // redraw only when something changes
    last.current = key;
    const x = canvas.getContext("2d")!;
    const w = canvas.width,
      h = canvas.height;
    const dest = chapters[here];
    x.fillStyle = PAL.screen;
    x.fillRect(0, 0, w, h);
    x.fillStyle = PAL.screenInk;
    x.font = `400 30px ${MONO}`;
    x.fillText(warp ? "JUMP IN PROGRESS" : `ORBIT · ${dest.location.toUpperCase()}`, 50, 70);
    x.font = `500 58px ${MONO}`;
    x.fillText(dest.machine.toUpperCase(), 50, 156);
    x.font = `400 30px ${MONO}`;
    x.globalAlpha = 0.8;
    x.fillText(dest.title, 50, 206);
    x.globalAlpha = 1;
    x.strokeStyle = PAL.screenInk;
    x.lineWidth = 2;
    x.strokeRect(50, 260, w - 100, 26);
    if (warp) x.fillRect(54, 264, (prog / 20) * (w - 108), 18);
    x.font = `400 24px ${MONO}`;
    x.globalAlpha = 0.75;
    x.fillText(warp ? "HOLD ON" : "SYSTEMS NOMINAL · READY", 50, 340);
    x.globalAlpha = 1;
    texture.needsUpdate = true;
  });
  return (
    <group position={[0, 4.1, CTRL_Z - 5.6]} rotation={[0.22, 0, 0]}>
      <RoundedBox args={[5.2, 2.25, 0.2]} radius={0.04} material={T(PAL.graphite)} castShadow />
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[4.9, 1.95]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Curved graphite console desk with a few slate screens and steady status lights. */
function ConsoleDesk() {
  const screens = useMemo(() => {
    const out: { p: [number, number, number]; a: number }[] = [];
    for (const a of [Math.PI - 0.72, Math.PI - 0.42, Math.PI + 0.42, Math.PI + 0.72]) {
      const r = CTRL_R - 1.5;
      out.push({ p: [Math.sin(a) * r, 1.42, CTRL_Z + Math.cos(a) * r], a });
    }
    return out;
  }, []);
  const screenTexA = useCanvas("desk-screen-a", 256, 160, (x, w, h) => {
    x.fillStyle = PAL.screen;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = PAL.screenInk;
    x.globalAlpha = 0.8;
    x.lineWidth = 2;
    x.beginPath();
    for (let i = 0; i <= 40; i++) x.lineTo((i / 40) * w, h * 0.55 + Math.sin(i * 0.6) * h * 0.18);
    x.stroke();
    x.font = `400 18px ${MONO}`;
    x.fillStyle = PAL.screenInk;
    x.fillText("CABIN · OK", 14, 28);
  });
  const [desk, trim] = useMemo(() => {
    const sector = (r0: number, r1: number, a0: number, a1: number, depth: number) => {
      const shape = new THREE.Shape();
      const pt = (r: number, a: number) => [Math.sin(a) * r, -Math.cos(a) * r] as const;
      shape.moveTo(...pt(r1, a0));
      for (let i = 1; i <= 24; i++) shape.lineTo(...pt(r1, a0 + ((a1 - a0) * i) / 24));
      for (let i = 24; i >= 0; i--) shape.lineTo(...pt(r0, a0 + ((a1 - a0) * i) / 24));
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 24 });
      g.rotateX(-Math.PI / 2);
      return g;
    };
    return [sector(CTRL_R - 2.05, CTRL_R - 0.95, Math.PI - 1.0, Math.PI + 1.0, 1.12), sector(CTRL_R - 2.1, CTRL_R - 0.9, Math.PI - 1.02, Math.PI + 1.02, 0.05)];
  }, []);
  return (
    <group>
      <mesh geometry={desk} position={[0, 0, CTRL_Z]} material={T(PAL.graphite)} castShadow receiveShadow />
      <mesh geometry={trim} position={[0, 1.2, CTRL_Z]} material={T(PAL.slate)} />
      {screens.map((q, i) => (
        <group key={i} position={q.p} rotation={[0, q.a + Math.PI, 0]}>
          <group rotation={[-0.5, 0, 0]}>
            <mesh material={T(PAL.graphiteDark)}>
              <boxGeometry args={[0.66, 0.44, 0.05]} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[0.6, 0.38]} />
              <meshBasicMaterial map={screenTexA} toneMapped={false} />
            </mesh>
          </group>
          <BlinkLight position={[0.38, -0.05, 0.1]} color={i === 1 ? PAL.terra : PAL.sage} size={0.03} />
        </group>
      ))}
    </group>
  );
}
