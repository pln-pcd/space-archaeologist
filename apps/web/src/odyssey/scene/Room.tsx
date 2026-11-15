// THE DASHBOARD ROOM (new-flow prompt §5): a cozy room inside the Starship Odyssey. A big round window
// with space, the Moon and Mars outside; warm lamps, plants, a rug, a star chart; the mission wall
// with five big 3D icons (our own designs). Static camera with gentle parallax; no walking.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useOutlines } from "../../fx/outline";
import { motion } from "../../anim/kit";
import { LOOK, glow, toon, blobTexture } from "../look";
import { Lights } from "./props";
import { Body } from "./bodies";
import Nova3D from "../nova/Nova3D";

export type MissionTile = {
  id: string;
  label: string;
  sub: string;
  kind: "moon" | "mars" | "viking" | "pioneer" | "voyager";
  sealed: boolean;
  done: boolean;
  stars: number;
  /** v7.4: the machine waiting there (shown on the portal's name plate) */
  machine?: string;
};

/** screen anchors for the DOM labels under the icons (projected every frame, no extra React roots) */
export const labelAnchors = new Map<string, { pos: THREE.Vector3; el: HTMLElement | null; y: number; h?: number }>();
/** DOM boxes projected from 3D boxes (Nova's tap target, the mission-wall spotlight zone) */
export const boxAnchors = new Map<string, { min: THREE.Vector3; max: THREE.Vector3; el: HTMLElement | null }>();
function LabelProjector() {
  const { camera, size } = useThree();
  const v = new THREE.Vector3();
  useFrame(() => {
    labelAnchors.forEach((a) => {
      if (!a.el) return;
      v.copy(a.pos).project(camera);
      a.y = ((1 - v.y) / 2) * size.height;
      a.el.style.transform = `translate(-50%, 0) translate(${((v.x + 1) / 2) * size.width}px, ${a.y}px)`;
    });
    boxAnchors.forEach((b) => {
      if (!b.el) return;
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
        const sx = ((v.x + 1) / 2) * size.width;
        const sy = ((1 - v.y) / 2) * size.height;
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
      Object.assign(b.el.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    });
  });
  return null;
}


/** live layout numbers the DOM writes and the camera reads (no React re-renders) */
export const roomLayout = { safeBottom: 0, lift: 0 };

function Parallax() {
  const { camera, size } = useThree();
  const p = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  useEffect(() => {
    if (motion.reduced) return;
    const pm = (e: PointerEvent) => {
      p.current.tx = (e.clientX / innerWidth - 0.5) * 2;
      p.current.ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    addEventListener("pointermove", pm);
    return () => removeEventListener("pointermove", pm);
  }, []);
  useFrame((_, dt) => {
    const k = p.current;
    k.x += (k.tx - k.x) * Math.min(1, dt * 2);
    k.y += (k.ty - k.y) * Math.min(1, dt * 2);
    const aspect = size.width / size.height;
    const portrait = aspect < 0.8;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = portrait ? 60 : aspect < 1.2 ? 50 : 42;
    if (cam.fov !== fov) (cam.fov = fov), cam.updateProjectionMatrix();
    const back = portrait ? 12 : aspect < 1.2 ? 9.2 : aspect < 1.5 ? 7.9 : 7.0;
    // keep the mission labels above the dialogue box: the scene rides up (camera down) while they'd overlap
    const labelBottom = maxLabelBottom();
    const safe = roomLayout.safeBottom || size.height;
    if (labelBottom > safe - 10) roomLayout.lift = Math.min(portrait ? 2.6 : 1.4, roomLayout.lift + dt * 1.6);
    else if (labelBottom < safe - 48) roomLayout.lift = Math.max(0, roomLayout.lift - dt * 0.8);
    const L = roomLayout.lift;
    // phones: the wall sits in the top third, Nova stands on the rug below it
    const y0 = portrait ? 2.4 : 1.5;
    camera.position.set(0.3 + k.x * 0.16, y0 - k.y * 0.07 - L * 0.55, back);
    camera.lookAt(0.3, (portrait ? -1.6 : 1.16) - L, 0);
  });
  return null;
}
function maxLabelBottom() {
  let m = 0;
  labelAnchors.forEach((a) => {
    if (!a.el) return;
    const h = (a as { h?: number }).h ?? a.el.offsetHeight;
    (a as { h?: number }).h = h;
    m = Math.max(m, a.y + h);
  });
  return m;
}

/** the room shell: floor, walls, window, lamps, plants, rug, star chart */
function Shell() {
  const g = useRef<THREE.Group>(null);
  useOutlines(g, "env");
  const wall = toon(LOOK.wall, { paint: 1, grain: 0.3 });
  const wall2 = toon(LOOK.wall2, { paint: 1 });
  const floor = toon("#E9CFA8", { paint: 1, grain: 0.8, grainScale: 3 });
  const trim = toon(LOOK.brass, { paint: 0.7 });
  const cream = toon(LOOK.cream);
  const rug = toon("#FFFFFF", { grain: 0.6, grainScale: 8, map: rugTexture() });
  const pot = toon("#D98C6A");
  const leaf = toon(LOOK.sage, { paint: 1 });
  const metal = toon("#6F6390");
  return (
    <group ref={g}>
      {/* floor with plank lines */}
      <mesh material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 3.1]}>
        <planeGeometry args={[14, 12]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-6 + i * 1.5, 0.002, 3.1]} userData={{ noOutline: true }}>
          <planeGeometry args={[0.02, 12]} />
          <meshBasicMaterial color="#C9A982" />
        </mesh>
      ))}
      {/* back wall + side walls */}
      <mesh material={wall} position={[0, 2.25, -2.2]}>
        <boxGeometry args={[14, 4.5, 0.2]} />
      </mesh>
      <mesh material={wall2} position={[-5.4, 2.25, 0.4]} rotation={[0, Math.PI / 2.6, 0]}>
        <boxGeometry args={[5, 4.5, 0.2]} />
      </mesh>
      <mesh material={wall2} position={[5.9, 2.25, 0.4]} rotation={[0, -Math.PI / 2.6, 0]}>
        <boxGeometry args={[5, 4.5, 0.2]} />
      </mesh>
      {/* wainscot rail */}
      <mesh material={trim} position={[0, 0.9, -2.08]}>
        <boxGeometry args={[14, 0.08, 0.06]} />
      </mesh>
      <mesh material={toon(LOOK.wallLight, { paint: 1 })} position={[0, 0.45, -2.09]}>
        <boxGeometry args={[14, 0.9, 0.04]} />
      </mesh>
      {/* the big round window */}
      <group position={[-4.75, 2.3, -2.08]}>
        <mesh material={trim}>
          <torusGeometry args={[1.12, 0.13, 14, 48]} />
        </mesh>
        <mesh position={[0, 0, -0.02]} userData={{ noOutline: true }}>
          <circleGeometry args={[1.1, 48]} />
          <meshBasicMaterial color={LOOK.space} />
        </mesh>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} material={trim} rotation={[0, 0, r]}>
            <boxGeometry args={[2.2, 0.05, 0.05]} />
          </mesh>
        ))}
      </group>
      {/* star chart (right of the mission wall) */}
      <group position={[4.45, 2.6, -2.07]}>
        <RoundedBox args={[1.5, 1.05, 0.06]} radius={0.04} material={trim} />
        <mesh position={[0, 0, 0.035]} userData={{ noOutline: true }}>
          <planeGeometry args={[1.36, 0.92]} />
          <meshBasicMaterial color="#1E1846" />
        </mesh>
        <StarChart />
      </group>
      {/* rug: a woven round rug (painted rings, dots and a stitched border) */}
      <mesh material={rug} rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.008, 1.2]} userData={{ noOutline: true }}>
        <circleGeometry args={[1.9, 64]} />
      </mesh>
      {/* floor lamp (left) and a reading lamp (right) */}
      <group position={[-5.9, 0, -0.9]}>
        <mesh material={metal} position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
        </mesh>
        <mesh material={metal} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 0.06, 18]} />
        </mesh>
        <mesh material={toon(LOOK.butter)} position={[0, 1.9, 0]}>
          <coneGeometry args={[0.36, 0.42, 20, 1, true]} />
        </mesh>
        <mesh material={glow(LOOK.lamp, 1.15)} position={[0, 1.78, 0]} userData={{ noOutline: true }}>
          <sphereGeometry args={[0.12, 12, 10]} />
        </mesh>
      </group>
      <group position={[5.6, 0, -1.0]}>
        <RoundedBox args={[0.9, 0.7, 0.55]} radius={0.06} position={[0, 0.35, 0]} material={toon(LOOK.peach)} />
        <mesh material={metal} position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        </mesh>
        <mesh material={toon(LOOK.mint)} position={[0, 1.25, 0]}>
          <coneGeometry args={[0.24, 0.26, 18, 1, true]} />
        </mesh>
        <mesh material={glow(LOOK.lamp, 1.1)} position={[0, 1.16, 0]} userData={{ noOutline: true }}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </group>
      {/* plants */}
      {[
        [-6.1, 0.6, 1.1],
        [6.3, 0.6, 0.95],
        [3.55, -1.75, 0.8],
      ].map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh material={pot} position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.26, 0.2, 0.5, 16]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((j) => (
            <mesh key={j} material={leaf} position={[Math.sin(j * 1.3) * 0.16, 0.7 + j * 0.09, Math.cos(j * 1.3) * 0.12]} rotation={[Math.sin(j) * 0.6, j, Math.cos(j) * 0.5]} scale={[0.6, 1.6, 0.25]}>
              <sphereGeometry args={[0.16, 10, 8]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* a cushion bench under the window */}
      <RoundedBox args={[2.3, 0.45, 0.7]} radius={0.12} position={[-4.4, 0.24, -1.6]} material={toon(LOOK.lavender, { grain: 1, grainScale: 8 })} />
      {[-0.6, 0.6].map((x) => (
        <RoundedBox key={x} args={[0.6, 0.38, 0.22]} radius={0.1} position={[-4.4 + x, 0.62, -1.82]} rotation={[-0.2, 0, 0]} material={toon(x < 0 ? LOOK.butter : LOOK.sky, { grain: 1, grainScale: 8 })} />
      ))}
      <mesh material={cream} position={[0, 4.45, -2.0]}>
        <boxGeometry args={[14, 0.12, 0.3]} />
      </mesh>
      <Bookshelf />
      <Console />
    </group>
  );
}

let rugTex: THREE.CanvasTexture | null = null;
function rugTexture() {
  if (rugTex) return rugTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!;
  const ring = (r: number, col: string) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(256, 256, r, 0, Math.PI * 2);
    x.fill();
  };
  ring(256, "#E9B98F");
  ring(232, "#D9876F");
  ring(214, "#F2C79A");
  ring(176, "#E7A4A9");
  ring(150, "#F5D9A8");
  ring(96, "#E7A4A9");
  ring(70, "#F5D9A8");
  // a woven weave: fine lines
  x.globalAlpha = 0.08;
  x.strokeStyle = "#5A3A30";
  for (let i = 0; i < 512; i += 6) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 512);
    x.stroke();
  }
  x.globalAlpha = 1;
  // dots and stitched borders
  x.fillStyle = "#FFF3DA";
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    x.beginPath();
    x.arc(256 + Math.cos(a) * 195, 256 + Math.sin(a) * 195, 7, 0, Math.PI * 2);
    x.fill();
  }
  x.setLineDash([10, 8]);
  x.lineWidth = 4;
  x.strokeStyle = "#FFF3DA";
  for (const r of [244, 123]) {
    x.beginPath();
    x.arc(256, 256, r, 0, Math.PI * 2);
    x.stroke();
  }
  rugTex = new THREE.CanvasTexture(c);
  rugTex.colorSpace = THREE.SRGBColorSpace;
  return rugTex;
}

/** a low bookshelf against the left wall: books, a tiny globe and a plant */
function Bookshelf() {
  const wood = toon("#B98A62", { paint: 1, grain: 0.6 });
  const cols = ["#C8714A", "#7FB8E6", "#E2BD6A", "#9CC9A6", "#C9BDEE", "#F0A9B8", "#6D8295", "#F2D68A", "#C8714A"];
  return (
    <group position={[-6.15, 0, 0.35]} rotation={[0, Math.PI / 2.6, 0]}>
      <RoundedBox args={[1.6, 1.25, 0.42]} radius={0.04} position={[0, 0.62, 0]} material={wood} />
      <mesh material={toon("#7A5640")} position={[0, 0.62, 0.05]}>
        <boxGeometry args={[1.48, 1.12, 0.36]} />
      </mesh>
      <mesh material={wood} position={[0, 0.64, 0.06]}>
        <boxGeometry args={[1.5, 0.05, 0.36]} />
      </mesh>
      {[0.12, 0.7].flatMap((y, row) =>
        cols.slice(row * 3, row * 3 + 6).map((c, i) => (
          <mesh key={`${row}${i}`} material={toon(c, { paint: 0.6 })} position={[-0.62 + i * 0.17 + row * 0.08, y + 0.2 + (i % 2) * 0.02, 0.1]} rotation={[0, 0, i === 4 ? 0.22 : 0]}>
            <boxGeometry args={[0.12, 0.36 + (i % 3) * 0.05, 0.26]} />
          </mesh>
        )),
      )}
      <mesh material={toon(LOOK.sky, { paint: 1 })} position={[0.48, 1.42, 0.02]}>
        <sphereGeometry args={[0.16, 20, 14]} />
      </mesh>
      <mesh material={toon(LOOK.brass)} position={[0.48, 1.28, 0.02]}>
        <cylinderGeometry args={[0.06, 0.09, 0.06, 12]} />
      </mesh>
      <group position={[-0.45, 1.25, 0.02]} scale={0.55}>
        <mesh material={toon("#D98C6A")} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.2, 0.16, 0.4, 14]} />
        </mesh>
        {[0, 1, 2, 3].map((j) => (
          <mesh key={j} material={toon(LOOK.sage, { paint: 1 })} position={[Math.sin(j * 1.6) * 0.12, 0.5 + j * 0.06, Math.cos(j * 1.6) * 0.08]} scale={[0.5, 1.3, 0.25]}>
            <sphereGeometry args={[0.16, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** the console strip on the mission shelf front: little lights that blink softly (the ship is alive) */
function Console() {
  const lights = useRef<THREE.Group>(null);
  const cols = [LOOK.mint, LOOK.butter, LOOK.coral, LOOK.sky, LOOK.mint, LOOK.butter, LOOK.sky, LOOK.coral, LOOK.mint];
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    lights.current?.children.forEach((m, i) => {
      const on = motion.reduced ? 1 : Math.sin(t * (0.7 + (i % 3) * 0.35) + i * 1.9) > -0.2 ? 1 : 0.35;
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = on;
    });
  });
  return (
    <group ref={lights} position={[0, 0.72, -1.3]}>
      {cols.map((c, i) => (
        <mesh key={i} position={[-2.6 + i * 0.65, 0, 0]} userData={{ noOutline: true }}>
          <circleGeometry args={[0.045, 14]} />
          <meshBasicMaterial color={new THREE.Color(c).multiplyScalar(1.05)} transparent opacity={1} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}


function StarChart() {
  const pts = useMemo(
    () =>
      [
        [-0.5, 0.25],
        [-0.25, 0.1],
        [0.0, 0.28],
        [0.2, 0.05],
        [0.45, 0.22],
        [-0.35, -0.25],
        [0.1, -0.2],
        [0.4, -0.3],
      ] as [number, number][],
    [],
  );
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(pts.slice(0, 5).map(([x, y]) => new THREE.Vector3(x, y, 0.045)));
    return g;
  }, [pts]);
  const stars = useRef<THREE.Group>(null);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    stars.current?.children.forEach((m, i) => m.scale.setScalar(motion.reduced ? 1 : 0.8 + 0.35 * Math.max(0, Math.sin(t * 1.3 + i * 2.1))));
  });
  return (
    <group>
      <primitive object={new THREE.Line(line, new THREE.LineBasicMaterial({ color: LOOK.brass }))} />
      <group ref={stars}>
        {pts.map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.045]} material={glow(i % 3 ? LOOK.butter : LOOK.mint, 1.2)} userData={{ noOutline: true }}>
            <circleGeometry args={[0.025 + (i % 2) * 0.01, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** what's outside the window: a painted starfield, the Moon, and a clean glass pane with one streak */
let windowSky: THREE.CanvasTexture | null = null;
function skyTexture() {
  if (windowSky) return windowSky;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(300, 220, 20, 256, 256, 360);
  g.addColorStop(0, "#2A2660");
  g.addColorStop(1, "#110E2A");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 512);
  let s = 7;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 260; i++) {
    const big = r() < 0.08;
    x.fillStyle = `rgba(255,${240 + r() * 15},${220 + r() * 35},${0.45 + r() * 0.55})`;
    x.beginPath();
    x.arc(r() * 512, r() * 512, big ? 1.8 + r() * 1.2 : 0.6 + r() * 0.9, 0, Math.PI * 2);
    x.fill();
  }
  windowSky = new THREE.CanvasTexture(c);
  windowSky.colorSpace = THREE.SRGBColorSpace;
  return windowSky;
}
function Outside() {
  return (
    <group position={[-4.75, 2.3, -2.12]}>
      <mesh position={[0, 0, -0.03]} userData={{ noOutline: true }}>
        <circleGeometry args={[1.1, 48]} />
        <meshBasicMaterial map={skyTexture()} toneMapped={false} />
      </mesh>
      <group position={[-0.32, 0.3, -0.02]} scale={[1, 1, 0.08]}>
        <Body kind="moon" radius={0.36} spin={0.02} tilt={0.1} segments={40} />
      </group>
      {/* the glass: a faint cool tint and one soft reflection streak */}
      <mesh position={[0, 0, 0.04]} userData={{ noOutline: true }}>
        <circleGeometry args={[1.1, 48]} />
        <meshBasicMaterial color="#BFD9F2" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh position={[0.25, 0.28, 0.05]} rotation={[0, 0, -0.75]} userData={{ noOutline: true }}>
        <planeGeometry args={[0.12, 1.5]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh position={[0.48, 0.12, 0.05]} rotation={[0, 0, -0.75]} userData={{ noOutline: true }}>
        <planeGeometry args={[0.04, 1.1]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** a vertical fade for light beams: bright at the floor, gone at the top (green channel = alpha) */
let beamTex: THREE.Texture | null = null;
function beamTexture() {
  if (beamTex) return beamTex;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#000");
  g.addColorStop(0.45, "#000");
  g.addColorStop(0.8, "#555");
  g.addColorStop(1, "#ccc");
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}

// ---------- mission icons ----------
/** the blueprint hologram for missions still to come */
const HOLO = new THREE.MeshBasicMaterial({ color: "#8FE9FF", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

function IconModel({ kind, sealed }: { kind: MissionTile["kind"]; sealed: boolean }) {
  const m = (c: string) => (sealed ? HOLO : toon(c, { paint: 0.9 }));
  if (kind === "moon")
    return (
      <group>
        {/* a little Moon hill */}
        <mesh material={m("#C9C6C2")} position={[0, -0.05, 0]} scale={[1, 0.4, 1]}>
          <sphereGeometry args={[0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {[[-0.16, 0.08], [0.14, -0.12], [0.02, 0.2]].map(([x, z], i) => (
          <mesh key={i} material={m("#A9A6A2")} position={[x, 0.075 - Math.hypot(x, z) * 0.18, z]} rotation={[-Math.PI / 2 + x, 0, 0]}>
            <torusGeometry args={[0.04, 0.012, 6, 14]} />
          </mesh>
        ))}
        {/* v7.4 Eagle: gold-foil octagonal descent stage, four splayed legs with pads, a ladder,
            the chunky silver ascent stage with its two dark windows, docking hatch and dish */}
        <group position={[0, 0.02, 0]} scale={1.22}>
          <mesh material={m("#E9B949")} position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.135, 0.135, 0.11, 8]} />
          </mesh>
          <mesh material={m("#5A4630")} position={[0, 0.11, 0]}>
            <cylinderGeometry args={[0.12, 0.1, 0.02, 8]} />
          </mesh>
          <mesh material={m("#FFE08A")} position={[0, 0.205, 0]}>
            <cylinderGeometry args={[0.138, 0.138, 0.015, 8]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const ang = i * (Math.PI / 2) + Math.PI / 4;
            const top = new THREE.Vector3(Math.cos(ang) * 0.11, 0.17, Math.sin(ang) * 0.11);
            const foot = new THREE.Vector3(Math.cos(ang) * 0.25, 0.035, Math.sin(ang) * 0.25);
            const mid = top.clone().add(foot).multiplyScalar(0.5);
            const dir = foot.clone().sub(top);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            return (
              <group key={i}>
                <mesh material={m("#C9C5D6")} position={mid.toArray()} quaternion={q}>
                  <cylinderGeometry args={[0.012, 0.012, dir.length(), 6]} />
                </mesh>
                <mesh material={m("#E9B949")} position={[foot.x, 0.028, foot.z]}>
                  <cylinderGeometry args={[0.032, 0.038, 0.016, 12]} />
                </mesh>
              </group>
            );
          })}
          {/* the ladder down the front leg */}
          <group position={[0.15, 0.1, 0.15]} rotation={[0, -Math.PI / 4, 0.62]}>
            {[-0.02, 0.02].map((x) => (
              <mesh key={x} material={m("#DCDDE6")} position={[x, 0, 0]}>
                <boxGeometry args={[0.006, 0.12, 0.006]} />
              </mesh>
            ))}
            {[-0.04, -0.013, 0.013, 0.04].map((y) => (
              <mesh key={y} material={m("#DCDDE6")} position={[0, y, 0]}>
                <boxGeometry args={[0.04, 0.005, 0.005]} />
              </mesh>
            ))}
          </group>
          {/* ascent stage */}
          <RoundedBox args={[0.2, 0.13, 0.17]} radius={0.03} position={[0, 0.28, 0]} material={m("#E4E5EE")} />
          <mesh material={m("#3B3561")} position={[-0.045, 0.3, 0.083]} rotation={[0, 0, 0.5]}>
            <circleGeometry args={[0.028, 3]} />
          </mesh>
          <mesh material={m("#3B3561")} position={[0.045, 0.3, 0.083]} rotation={[0, 0, -0.5 + Math.PI]}>
            <circleGeometry args={[0.028, 3]} />
          </mesh>
          <mesh material={m("#C9C5D6")} position={[0, 0.36, -0.02]}>
            <cylinderGeometry args={[0.035, 0.04, 0.035, 14]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={m("#B8B4C4")} position={[sx * 0.11, 0.3, 0]}>
              <boxGeometry args={[0.02, 0.03, 0.03]} />
            </mesh>
          ))}
          <mesh material={m("#C9C5D6")} position={[-0.07, 0.38, -0.05]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.005, 0.005, 0.07, 5]} />
          </mesh>
          <mesh material={m("#F2F0F8")} position={[-0.09, 0.42, -0.05]} rotation={[0.3, 0, 0.9]}>
            <cylinderGeometry args={[0.035, 0.004, 0.018, 14]} />
          </mesh>
        </group>
      </group>
    );
  if (kind === "mars")
    return (
      <group>
        <mesh material={m("#D9825A")} position={[0, -0.05, 0]} scale={[1, 0.4, 1]}>
          <sphereGeometry args={[0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* Opportunity: white body, blue solar wings, six wheels, a camera mast */}
        <RoundedBox args={[0.22, 0.07, 0.15]} radius={0.02} position={[0, 0.17, 0]} material={m("#F1ECE4")} />
        <mesh material={m("#4E64B8")} position={[0, 0.215, 0]}>
          <boxGeometry args={[0.3, 0.012, 0.2]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={m("#5E78D6")} position={[sx * 0.2, 0.215, 0.02]} rotation={[0, 0, sx * 0.12]}>
            <boxGeometry args={[0.12, 0.01, 0.15]} />
          </mesh>
        ))}
        <mesh material={m("#4E64B8")} position={[0, 0.215, -0.14]}>
          <boxGeometry args={[0.18, 0.01, 0.09]} />
        </mesh>
        <mesh material={m("#CFCAD6")} position={[0.07, 0.3, 0.06]}>
          <cylinderGeometry args={[0.012, 0.014, 0.17, 8]} />
        </mesh>
        <RoundedBox args={[0.09, 0.045, 0.05]} radius={0.012} position={[0.07, 0.4, 0.065]} material={m("#F1ECE4")} />
        {[-0.02, 0.02].map((x) => (
          <mesh key={x} material={m("#2E2A44")} position={[0.07 + x, 0.4, 0.092]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.01, 10]} />
          </mesh>
        ))}
        {[-1, 0, 1].flatMap((i) =>
          [-1, 1].map((sd) => (
            <mesh key={`${i}${sd}`} material={m("#5B5470")} position={[i * 0.09, 0.08, sd * 0.11]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.036, 0.036, 0.03, 14]} />
            </mesh>
          )),
        )}
      </group>
    );
  if (kind === "viking")
    return (
      <group>
        <mesh material={m("#C9C3B8")} position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.1, 6]} />
        </mesh>
        <mesh material={m("#C9C3B8")} position={[0.05, 0.36, 0]} rotation={[0.4, 0, 0.2]}>
          <cylinderGeometry args={[0.1, 0.02, 0.06, 16]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={m("#8F8A98")} position={[Math.cos(i * 2.09) * 0.18, 0.08, Math.sin(i * 2.09) * 0.18]}>
            <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
          </mesh>
        ))}
      </group>
    );
  // pioneer + voyager: dish spacecraft flying (never on the ground)
  return (
    <group position={[0, 0.24, 0]} rotation={[0.3, 1.15, 0.2]}>
      <mesh material={m("#E2DED6")} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.05, 0.08, 24, 1, true]} />
      </mesh>
      <RoundedBox args={[0.12, 0.08, 0.12]} radius={0.02} position={[0, 0, -0.08]} material={m("#B9B2C4")} />
      <mesh material={m("#8F8A98")} position={[kind === "voyager" ? 0.22 : 0.16, 0, -0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, kind === "voyager" ? 0.36 : 0.22, 6]} />
      </mesh>
    </group>
  );
}

function Lock() {
  const brass = toon(LOOK.brass);
  return (
    <group position={[0.2, 0.45, 0.22]} scale={0.8}>
      <RoundedBox args={[0.16, 0.13, 0.06]} radius={0.02} material={brass} />
      <mesh material={brass} position={[0, 0.08, 0]}>
        <torusGeometry args={[0.05, 0.016, 8, 16, Math.PI]} />
      </mesh>
      <mesh position={[0, -0.005, 0.032]} userData={{ noOutline: true }}>
        <circleGeometry args={[0.018, 10]} />
        <meshBasicMaterial color="#5A4630" />
      </mesh>
    </group>
  );
}

function MissionIcon({ tile, x, hot, highlight, onPick, onHover }: { tile: MissionTile; x: number; hot: boolean; highlight: boolean; onPick: () => void; onHover: (h: boolean) => void }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const st = useRef({ lift: 0 });
  const spin = useRef(0);
  const sparks = useRef<THREE.Group>(null);
  useOutlines(g, "interactable", [tile.sealed]);
  useEffect(() => {
    const a = labelAnchors.get(tile.id) ?? { pos: new THREE.Vector3(), el: null, y: 0 };
    a.pos.set(x, 0.93, -1.2);
    labelAnchors.set(tile.id, a);
  }, [tile.id, x]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const want = hot ? 1 : 0;
    st.current.lift += (want - st.current.lift) * Math.min(1, dt * 10);
    if (g.current) {
      g.current.position.y = 1.32 + st.current.lift * 0.1 + (highlight && !motion.reduced ? Math.abs(Math.sin(t * 3)) * 0.05 : 0);
      // a slow turntable (a little faster when hovered) so every mission shows off its machine
      spin.current += (motion.reduced ? 0 : 0.25 + st.current.lift * 1.2) * dt;
      g.current.rotation.y = spin.current + x;
    }
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(st.current.lift * 0.9, highlight ? 0.45 + 0.4 * Math.abs(Math.sin(t * 3)) : 0);
    }
    // tiny sparkles drifting up through the light beam
    sparks.current?.children.forEach((c, i) => {
      const k = motion.reduced ? 0.5 : (t * 0.25 + i * 0.27) % 1;
      c.position.set(Math.sin(i * 2.3 + t * 0.5) * 0.28, 1.3 + k * 1.1, Math.cos(i * 1.7) * 0.2);
      c.scale.setScalar(0.02 + Math.sin(k * Math.PI) * 0.025);
    });
  });
  return (
    <group position={[x, 0, -1.55]}>
      {/* pedestal */}
      <mesh material={toon(LOOK.cream)} position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.52, 0.56, 0.16, 32]} />
      </mesh>
      <mesh material={toon(tile.sealed ? "#8E86A6" : LOOK.brass)} position={[0, 1.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.03, 8, 36]} />
      </mesh>
      <mesh ref={ring} position={[0, 1.18, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
        <ringGeometry args={[0.54, 0.72, 40]} />
        <meshBasicMaterial color={tile.sealed ? "#C7BDF5" : "#FFE6A8"} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {tile.sealed && (
        <group position={[0, 1.32, 0]} scale={1.9}>
          <Lock />
        </group>
      )}
      <group ref={sparks} userData={{ noOutline: true }}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={tile.sealed ? "#8FE9FF" : i % 2 ? "#FFE27A" : "#FFFFFF"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {tile.sealed && (
        <mesh position={[0, 1.19, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
          <circleGeometry args={[0.46, 32]} />
          <meshBasicMaterial color="#5FD8FF" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      {!tile.sealed && (
        <mesh position={[0, 1.75, 0]} userData={{ noOutline: true }}>
          <cylinderGeometry args={[0.12, 0.44, 1.15, 28, 1, true]} />
          <meshBasicMaterial color={tile.kind === "mars" ? "#FFC7A8" : "#FFF1C2"} transparent opacity={0.06} depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      <group
        ref={g}
        position={[0, 1.32, 0]}
        scale={1.9}
        onClick={(e) => (e.stopPropagation(), onPick())}
        onPointerOver={(e) => (e.stopPropagation(), onHover(true), (document.body.style.cursor = "pointer"))}
        onPointerOut={() => (onHover(false), (document.body.style.cursor = "auto"))}
      >
        <IconModel kind={tile.kind} sealed={tile.sealed} />
        {/* an invisible, generous hit area */}
        <mesh position={[0, 0.2, 0]} visible={false}>
          <sphereGeometry args={[0.46, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/** register a 3D box whose screen rectangle a DOM element should cover */
function useBoxAnchor(id: string, min: [number, number, number], max: [number, number, number]) {
  useEffect(() => {
    const b = boxAnchors.get(id) ?? { min: new THREE.Vector3(), max: new THREE.Vector3(), el: null };
    b.min.set(...min);
    b.max.set(...max);
    boxAnchors.set(id, b);
  }, [id, ...min, ...max]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function DashboardRoom({ tiles, hot, setHot, highlight, onPick, onNova, novaGlow = false, portrait = false }: { tiles: MissionTile[]; hot: string | null; setHot: (id: string | null) => void; highlight: "wall" | "moon" | null; onPick: (t: MissionTile) => void; onNova?: () => void; novaGlow?: boolean; portrait?: boolean }) {
  // Nova: 1.6x the old size, standing clear of the mission plinths (right of the wall, nearer the camera)
  // v7.4: Nova stands at the front left, beside the Moon portal, talking in a speech bubble
  // (placed by screen fraction, so she is never cut off on narrower 16:9 / 16:10 laptops)
  const { size } = useThree();
  const aspect = size.width / size.height;
  const camBack = aspect < 1.2 ? 9.2 : aspect < 1.5 ? 7.9 : 7.0;
  const camFov = aspect < 1.2 ? 50 : 42;
  const novaX = 0.3 - 0.79 * (camBack - 1.8) * Math.tan(THREE.MathUtils.degToRad(camFov / 2)) * aspect;
  const novaAt: [number, number, number] = portrait ? [0, 0.05, 7] : [Math.max(-3.4, novaX), 0.05, 1.8];
  const novaScale = portrait ? 1.35 : 1.4;
  const ring = useRef<THREE.Mesh>(null);
  useBoxAnchor("nova", [novaAt[0] - 0.42 * novaScale, novaAt[1] + 0.05, novaAt[2] - 0.2], [novaAt[0] + 0.42 * novaScale, novaAt[1] + 1.02 * novaScale, novaAt[2] + 0.2]);
  useBoxAnchor("wall", [-3.6, 0.95, -1.6], [3.6, 2.6, -1.6]);
  // one "coming soon" chip for the shelf of sealed missions (instead of three labels)
  useEffect(() => {
    const a = labelAnchors.get("sealed") ?? { pos: new THREE.Vector3(), el: null, y: 0 };
    a.pos.set(0, 0.86, -1.18);
    labelAnchors.set("sealed", a);
  }, []);
  useFrame((s) => {
    if (!ring.current) return;
    const m = ring.current.material as THREE.MeshBasicMaterial;
    const t = s.clock.elapsedTime;
    m.opacity = novaGlow ? (motion.reduced ? 0.7 : 0.45 + 0.35 * Math.sin(t * 3)) : 0;
    ring.current.scale.setScalar(novaGlow && !motion.reduced ? 1 + 0.06 * Math.sin(t * 3) : 1);
  });
  return (
    <>
      <color attach="background" args={[LOOK.wall]} />
      <Parallax />
      <Lights lamps={[[0, 3.3, 0.8]]} />
      <Shell />
      <Outside />
      {/* v7.3: the playable chapters are the heroes: big mission portals on the floor */}
      {tiles.filter((t) => !t.sealed).map((t, i) => (
        <MissionPortal
          key={t.id}
          tile={t}
          at={i === 0 ? [-1.4, 0, 0.75] : [2.0, 0, 0.75]}
          hot={hot === t.id}
          highlight={highlight === "wall" || (highlight === "moon" && t.kind === "moon")}
          onPick={() => onPick(t)}
          onHover={(h) => setHot(h ? t.id : hot === t.id ? null : hot)}
        />
      ))}
      {/* the missions still to come wait on the shelf as holograms */}
      {tiles.filter((t) => t.sealed).map((t, i) => (
        <MissionIcon
          key={t.id}
          tile={t}
          x={-1.35 + i * 1.35}
          hot={hot === t.id}
          highlight={false}
          onPick={() => onPick(t)}
          onHover={(h) => setHot(h ? t.id : hot === t.id ? null : hot)}
        />
      ))}
      <ShelfBack />
      <NeonSign />
      <StringLights />
      <Posters />
      <LabelProjector />
      <group
        position={novaAt}
        scale={novaScale}
        onClick={(e) => (e.stopPropagation(), onNova?.())}
        onPointerOver={() => onNova && (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <group rotation={[0, Math.atan2(0.3 - novaAt[0], 7 - novaAt[2]), 0]}>
          <Nova3D float enter="left" lookAt={[0.3, 1.5, 7]} />
        </group>
      </group>
      {/* the "tap me" glow ring at Nova's feet */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[novaAt[0], 0.02, novaAt[2]]} userData={{ noOutline: true }}>
        <ringGeometry args={[0.55, 0.78, 48]} />
        <meshBasicMaterial color="#FFE6A8" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[novaAt[0], 0.01, novaAt[2]]} userData={{ noOutline: true }}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} opacity={0.5} />
      </mesh>
    </>
  );
}

function ShelfBack() {
  const g = useRef<THREE.Group>(null);
  useOutlines(g, "env");
  return (
    <group ref={g}>
      <RoundedBox args={[7.4, 1.7, 0.12]} radius={0.08} position={[0, 1.8, -2.04]} material={toon(LOOK.wallLight, { paint: 1 })} />
      <RoundedBox args={[7.2, 0.12, 0.7]} radius={0.04} position={[0, 0.98, -1.6]} material={toon(LOOK.creamDeep, { grain: 0.6 })} />
      <RoundedBox args={[7.2, 0.85, 0.6]} radius={0.06} position={[0, 0.5, -1.62]} material={toon(LOOK.wall2, { paint: 1 })} />
      <mesh position={[0, 2.42, -1.97]} userData={{ noOutline: true }}>
        <planeGeometry args={[2.4, 0.01]} />
        <meshBasicMaterial color={LOOK.brass} />
      </mesh>
    </group>
  );
}


/** a glowing "MISSIONS" sign above the shelf */
function NeonSign() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 192;
    const x = c.getContext("2d")!;
    x.font = "bold 132px 'Lilita One', 'Fredoka', sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.shadowColor = "#FF7AD9";
    x.shadowBlur = 36;
    x.fillStyle = "#FFE3F6";
    x.fillText("MISSIONS", 512, 100);
    x.shadowBlur = 12;
    x.fillText("MISSIONS", 512, 100);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const m = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((st) => {
    if (m.current) m.current.opacity = motion.reduced ? 1 : 0.9 + Math.sin(st.clock.elapsedTime * 2.2) * 0.08;
  });
  return (
    <mesh position={[0, 2.92, -1.98]} userData={{ noOutline: true }}>
      <planeGeometry args={[3.2, 0.6]} />
      <meshBasicMaterial ref={m} map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** a swag of warm fairy lights along the top of the back wall */
function StringLights() {
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let seg = 0; seg < 3; seg++)
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const x0 = -5.4 + seg * 3.6;
        out.push(new THREE.Vector3(x0 + k * 3.6, 4.05 - Math.sin(k * Math.PI) * 0.35, -2.05));
      }
    return out;
  }, []);
  const line = useMemo(() => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#2A2347" })), [pts]);
  const g = useRef<THREE.Group>(null);
  const cols = ["#FFD86B", "#FF8FBE", "#8FE9FF", "#B59CFF", "#9FF2C8"];
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      const on = motion.reduced ? 1 : 0.65 + 0.35 * Math.sin(t * 1.6 + i * 0.9);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = on;
    });
  });
  return (
    <group userData={{ noOutline: true }}>
      <primitive object={line} />
      <group ref={g}>
        {pts.filter((_, i) => i % 2 === 1).map((p, i) => (
          <mesh key={i} position={[p.x, p.y - 0.06, p.z + 0.02]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshBasicMaterial color={cols[i % cols.length]} transparent toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** two cute planet posters on the side walls */
function Posters() {
  const make = (draw: (x: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 340;
    const x = c.getContext("2d")!;
    draw(x);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const [a, b] = useMemo(
    () => [
      make((x) => {
        const g = x.createLinearGradient(0, 0, 0, 340);
        g.addColorStop(0, "#2B1C6E");
        g.addColorStop(1, "#7A3CB8");
        x.fillStyle = g;
        x.fillRect(0, 0, 256, 340);
        for (let i = 0; i < 40; i++) {
          x.fillStyle = "rgba(255,255,255,0.8)";
          x.fillRect((i * 67) % 256, (i * 131) % 340, 2, 2);
        }
        x.fillStyle = "#F3C77A";
        x.beginPath();
        x.arc(128, 150, 62, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#FFE7B0";
        x.lineWidth = 10;
        x.beginPath();
        x.ellipse(128, 150, 110, 26, -0.3, 0, Math.PI * 2);
        x.stroke();
        x.fillStyle = "#FFFFFF";
        x.font = "bold 34px 'Lilita One', sans-serif";
        x.textAlign = "center";
        x.fillText("SATURN", 128, 300);
      }),
      make((x) => {
        const g = x.createLinearGradient(0, 0, 0, 340);
        g.addColorStop(0, "#1D3D78");
        g.addColorStop(1, "#3FB3C9");
        x.fillStyle = g;
        x.fillRect(0, 0, 256, 340);
        x.fillStyle = "#FFFFFF";
        x.beginPath();
        x.moveTo(128, 40);
        x.quadraticCurveTo(180, 120, 160, 220);
        x.lineTo(96, 220);
        x.quadraticCurveTo(76, 120, 128, 40);
        x.fill();
        x.fillStyle = "#FF6B5E";
        x.beginPath();
        x.moveTo(96, 200);
        x.lineTo(70, 240);
        x.lineTo(100, 230);
        x.moveTo(160, 200);
        x.lineTo(186, 240);
        x.lineTo(156, 230);
        x.fill();
        x.fillStyle = "#FFD23F";
        x.beginPath();
        x.moveTo(108, 222);
        x.quadraticCurveTo(128, 290, 148, 222);
        x.fill();
        x.fillStyle = "#5BB8FF";
        x.beginPath();
        x.arc(128, 130, 18, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "#FFFFFF";
        x.font = "bold 30px 'Lilita One', sans-serif";
        x.textAlign = "center";
        x.fillText("BLAST OFF!", 128, 312);
      }),
    ],
    [],
  );
  return (
    <group userData={{ noOutline: true }}>
      <mesh position={[-5.2, 2.6, 0.9]} rotation={[0, Math.PI / 2.6, 0]}>
        <planeGeometry args={[1.1, 1.46]} />
        <meshBasicMaterial map={a} toneMapped={false} />
      </mesh>
      <mesh position={[5.55, 2.6, 0.9]} rotation={[0, -Math.PI / 2.6, 0]}>
        <planeGeometry args={[1.1, 1.46]} />
        <meshBasicMaterial map={b} toneMapped={false} />
      </mesh>
    </group>
  );
}


/** a playable chapter as a big floor portal: a glowing platform, a large diorama of the machine on its
 *  world, a light beam, sparkles and orbiting stars; hover lifts and spins it faster; click to start */
function MissionPortal({ tile, at, hot, highlight, onPick, onHover }: { tile: MissionTile; at: [number, number, number]; hot: boolean; highlight: boolean; onPick: () => void; onHover: (h: boolean) => void }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const st = useRef({ lift: 0, spin: 0 });
  useOutlines(g, "interactable", []);
  useEffect(() => {
    const a = labelAnchors.get(tile.id) ?? { pos: new THREE.Vector3(), el: null, y: 0 };
    a.pos.set(at[0], 0.16, at[2] + 0.96);
    labelAnchors.set(tile.id, a);
  }, [tile.id, at[0], at[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const tint = tile.kind === "mars" ? "#FF9A6B" : "#9FD8FF";
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const k = st.current;
    k.lift += ((hot ? 1 : 0) - k.lift) * Math.min(1, dt * 8);
    k.spin += (motion.reduced ? 0 : 0.22 + k.lift * 1.0) * dt;
    if (g.current) {
      g.current.position.y = 0.42 + k.lift * 0.14 + (highlight && !motion.reduced ? Math.abs(Math.sin(t * 3)) * 0.06 : 0) + (motion.reduced ? 0 : Math.sin(t * 1.2 + at[0]) * 0.03);
      g.current.rotation.y = k.spin;
      g.current.scale.setScalar(1.95 * (1 + k.lift * 0.08));
    }
    if (ring.current) {
      ring.current.rotation.z = motion.reduced ? 0 : t * 0.5;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + k.lift * 0.4 + (highlight ? 0.3 * Math.abs(Math.sin(t * 3)) : 0);
    }
    if (orbit.current) orbit.current.rotation.y = motion.reduced ? 0 : -t * 0.6;
  });
  return (
    <group position={at}>
      {/* platform */}
      <mesh material={toon("#FFFFFF")} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.85, 0.95, 0.2, 48]} />
      </mesh>
      <mesh material={toon(tile.kind === "mars" ? "#FFB28A" : "#B9DCFF")} position={[0, 0.215, 0]}>
        <cylinderGeometry args={[0.76, 0.76, 0.04, 48]} />
      </mesh>
      <mesh ref={ring} position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
        <ringGeometry args={[0.8, 0.92, 64, 1, 0, Math.PI * 1.7]} />
        <meshBasicMaterial color={tint} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.15, 0]} userData={{ noOutline: true }}>
        <cylinderGeometry args={[0.5, 0.8, 1.9, 40, 1, true]} />
        <meshBasicMaterial color={tint} alphaMap={beamTexture()} transparent opacity={0.3} depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* little stars orbiting the diorama */}
      <group ref={orbit} position={[0, 1.15, 0]} userData={{ noOutline: true }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.85, Math.sin(i * 1.9) * 0.22, Math.sin((i / 5) * Math.PI * 2) * 0.85]}>
            <octahedronGeometry args={[0.05, 0]} />
            <meshBasicMaterial color={i % 2 ? "#FFE27A" : "#FFFFFF"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group
        ref={g}
        position={[0, 0.42, 0]}
        scale={1.95}
        onClick={(e) => (e.stopPropagation(), onPick())}
        onPointerOver={(e) => (e.stopPropagation(), onHover(true), (document.body.style.cursor = "pointer"))}
        onPointerOut={() => (onHover(false), (document.body.style.cursor = "auto"))}
      >
        <IconModel kind={tile.kind} sealed={false} />
        <mesh position={[0, 0.2, 0]} visible={false}>
          <sphereGeometry args={[0.42, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}
