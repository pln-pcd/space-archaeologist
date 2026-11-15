// Shared 3D props for the new flow (cover + dashboard): painted planets, the Starship Odyssey, soft
// painted stars and slow shooting stars. Our own designs; no agency logos, patches or insignia.
// Every animation is a pure function of the clock (deterministic for HyperFrames).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useOutlines } from "../../fx/outline";
import { motion } from "../../anim/kit";
import { LOOK, glass, glow, toon } from "../look";

// ---------- painted planet textures (seeded, made once) ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const texCache = new Map<string, THREE.CanvasTexture>();
function planetTexture(kind: "moon" | "mars" | "earth" | "ringed") {
  const hit = texCache.get(kind);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d")!;
  const r = rng(kind.length * 991 + 7);
  const base = { moon: "#C9C7C4", mars: "#C8714A", earth: "#5E9BD8", ringed: "#E8C99A" }[kind];
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 256);
  if (kind === "moon") {
    // dark maria + craters with a light rim (grey only: the Moon stays grey)
    x.fillStyle = "rgba(120,118,118,0.45)";
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      x.ellipse(r() * 512, 60 + r() * 140, 30 + r() * 60, 18 + r() * 40, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 70; i++) {
      const cx = r() * 512,
        cy = 20 + r() * 216,
        rad = 3 + Math.pow(r(), 2.2) * 22;
      x.fillStyle = "rgba(95,93,96,0.55)";
      x.beginPath();
      x.arc(cx, cy, rad, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "rgba(235,233,228,0.6)";
      x.lineWidth = Math.max(1, rad * 0.18);
      x.beginPath();
      x.arc(cx - rad * 0.12, cy - rad * 0.12, rad, Math.PI * 0.9, Math.PI * 1.9);
      x.stroke();
    }
  } else if (kind === "mars") {
    x.fillStyle = "rgba(122,58,38,0.55)";
    for (let i = 0; i < 12; i++) {
      x.beginPath();
      x.ellipse(r() * 512, 50 + r() * 160, 20 + r() * 70, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "rgba(232,170,120,0.45)";
    for (let i = 0; i < 10; i++) {
      x.beginPath();
      x.ellipse(r() * 512, 40 + r() * 180, 15 + r() * 40, 8 + r() * 20, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#F4EEE6";
    x.fillRect(0, 0, 512, 14);
    x.fillRect(0, 246, 512, 10);
  } else if (kind === "earth") {
    x.fillStyle = "#7DBB86";
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.ellipse(r() * 512, 50 + r() * 150, 25 + r() * 55, 18 + r() * 40, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 18; i++) {
      x.beginPath();
      x.ellipse(r() * 512, 20 + r() * 216, 20 + r() * 50, 4 + r() * 8, r() * 0.4, 0, Math.PI * 2);
      x.fill();
    }
    x.fillRect(0, 0, 512, 16);
    x.fillRect(0, 240, 512, 16);
  } else {
    for (let i = 0; i < 9; i++) {
      x.fillStyle = i % 2 ? "rgba(214,160,120,0.5)" : "rgba(246,226,190,0.6)";
      x.fillRect(0, 20 + i * 26 + r() * 6, 512, 10 + r() * 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(kind, t);
  return t;
}

const planetMaterial = (kind: "moon" | "mars" | "earth" | "ringed") =>
  toon("#FFFFFF", { paint: 0.6, grain: kind === "moon" || kind === "mars" ? 0.6 : 0.2, grainScale: 2.5, map: planetTexture(kind) });

export function Planet({ kind, radius, position, spin = 0.05, tilt = 0.2 }: { kind: "moon" | "mars" | "earth" | "ringed"; radius: number; position: [number, number, number]; spin?: number; tilt?: number }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  useOutlines(g, "env");
  useFrame((s) => {
    if (body.current) body.current.rotation.y = motion.reduced ? 0 : s.clock.elapsedTime * spin;
  });
  return (
    <group ref={g} position={position} rotation={[0, 0, tilt]}>
      <mesh ref={body} material={planetMaterial(kind)}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
      {kind === "earth" && (
        <mesh userData={{ noOutline: true }}>
          <sphereGeometry args={[radius * 1.06, 32, 20]} />
          <meshBasicMaterial color="#9CCBF2" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      )}
      {kind === "ringed" && (
        <mesh rotation={[Math.PI / 2.3, 0, 0]} userData={{ noOutline: true }}>
          <ringGeometry args={[radius * 1.35, radius * 2.1, 64]} />
          <meshBasicMaterial color="#D9C2E8" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ---------- soft painted stars ----------
let starTex: THREE.CanvasTexture | null = null;
function starSprite() {
  if (starTex) return starTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,246,230,0.8)");
  g.addColorStop(1, "rgba(255,246,230,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  starTex = new THREE.CanvasTexture(c);
  return starTex;
}
export function PaintedStars({ count = 700, radius = 60, seed = 3 }: { count?: number; radius?: number; seed?: number }) {
  const geo = useMemo(() => {
    const r = rng(seed);
    const p = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tints = ["#FFF6E6", "#FFE2B8", "#D6DCFF", "#F6D2E6"].map((h) => new THREE.Color(h));
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1,
        th = r() * Math.PI * 2,
        s = Math.sqrt(1 - u * u);
      p.set([Math.cos(th) * s * radius, u * radius * 0.7, -Math.abs(Math.sin(th) * s * radius) - 8], i * 3);
      const t = tints[Math.floor(r() * tints.length)];
      const b = 0.55 + r() * 0.45;
      col.set([t.r * b, t.g * b, t.b * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count, radius, seed]);
  return (
    <points geometry={geo}>
      <pointsMaterial map={starSprite()} vertexColors size={0.55} sizeAttenuation transparent depthWrite={false} toneMapped={false} />
    </points>
  );
}

/** a few slow shooting stars, each crossing every ~9–13 s (deterministic) */
export function ShootingStars({ n = 3 }: { n?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.visible = !motion.reduced;
    g.current.children.forEach((m, i) => {
      const period = 9 + i * 2.1;
      const k = ((t + i * 3.7) % period) / 1.4; // 1.4 s streak, then rest
      m.visible = k < 1;
      const y = 9 - i * 3;
      m.position.set(-18 + i * 9 + k * 14, y - k * 5, -30 - i * 4);
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.8;
    });
  });
  return (
    <group ref={g}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} rotation={[0, 0, -0.34]} userData={{ noOutline: true }}>
          <planeGeometry args={[2.6, 0.06]} />
          <meshBasicMaterial color="#FFF2D6" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Starship Odyssey (our own design: a round, friendly cruiser) ----------
export function Starship({ glowAmount = 1 }: { glowAmount?: number }) {
  const g = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  useOutlines(g, "interactable");
  useFrame((s) => {
    if (!flame.current) return;
    const t = s.clock.elapsedTime;
    const f = motion.reduced ? 1 : 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    flame.current.scale.set(1, f * glowAmount, 1);
  });
  const hull = toon("#F3D9B8", { grain: 0.5 });
  const band = toon(LOOK.peach);
  const fin = toon(LOOK.coral, { paint: 0.8 });
  const trim = toon(LOOK.brass);
  const dark = toon("#5A4E7A");
  return (
    <group ref={g} rotation={[0, 0, 0]}>
      {/* hull: a long rounded capsule lying along +X (nose to the right) */}
      <mesh material={hull} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.62, 1.9, 10, 28]} />
      </mesh>
      <mesh material={band} rotation={[0, 0, Math.PI / 2]} position={[-0.2, 0, 0]}>
        <cylinderGeometry args={[0.635, 0.635, 0.32, 28, 1, true]} />
      </mesh>
      {/* nose window: a glass dome on the front of the hull */}
      <mesh position={[1.22, 0.08, 0]} rotation={[0, 0, -Math.PI / 2]} material={glass("#8FD3F5")} userData={{ noOutline: true }}>
        <sphereGeometry args={[0.5, 28, 16, 0, Math.PI * 2, 0, 0.95]} />
      </mesh>
      <mesh position={[1.62, 0.25, 0.18]} userData={{ noOutline: true }}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.8} />
      </mesh>
      {/* three portholes */}
      {[-0.55, 0.05, 0.62].map((px) => (
        <group key={px} position={[px, 0.12, 0.6]}>
          <mesh material={trim} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.17, 0.045, 10, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.01]} material={glow("#9ED9F5", 1.05)} userData={{ noOutline: true }}>
            <circleGeometry args={[0.15, 24]} />
          </mesh>
          <mesh position={[-0.05, 0.05, 0.02]} userData={{ noOutline: true }}>
            <circleGeometry args={[0.035, 12]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      ))}
      {/* fins */}
      {[1, -1].map((s) => (
        <mesh key={s} material={fin} position={[-1.15, s * 0.62, 0]} rotation={[0, 0, s * 0.5]}>
          <boxGeometry args={[0.7, 0.42, 0.12]} />
        </mesh>
      ))}
      <mesh material={fin} position={[-1.15, 0, -0.62]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.7, 0.12, 0.42]} />
      </mesh>
      {/* antenna with a little lamp */}
      <mesh material={dark} position={[0.1, 0.78, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.32, 8]} />
      </mesh>
      <mesh material={glow(LOOK.butter, 1.6)} position={[0.1, 0.96, 0]}>
        <sphereGeometry args={[0.06, 12, 10]} />
      </mesh>
      <RoundedBox args={[0.42, 0.14, 0.3]} radius={0.05} position={[0.1, 0.64, 0]} material={band} />
      {/* engine bell + soft glow */}
      <mesh material={dark} position={[-1.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.46, 0.3, 24]} />
      </mesh>
      <group ref={flame} position={[-1.78, 0, 0]}>
        <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} userData={{ noOutline: true }}>
          <coneGeometry args={[0.3, 0.5, 20, 1, true]} />
          <meshBasicMaterial color={new THREE.Color("#FF9A5C").multiplyScalar(1.3)} transparent opacity={0.55} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} userData={{ noOutline: true }}>
          <coneGeometry args={[0.17, 0.28, 16, 1, true]} />
          <meshBasicMaterial color={new THREE.Color("#FFE6A8").multiplyScalar(1.6)} transparent opacity={0.85} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** after-p2 lights: warm cream hemisphere, lilac ambient, warm key with soft shadows, cool rim */
export function Lights({ shadows = false, lamps = [] as [number, number, number][] }) {
  return (
    <>
      <hemisphereLight args={["#FFF1E2", "#5A4A9A", 1.15]} />
      <ambientLight intensity={0.35} color={LOOK.lilac} />
      <directionalLight
        position={[-6, 9, 8]}
        intensity={2.1}
        color="#FFE2C2"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[8, 4, -10]} intensity={0.7} color="#9FB4FF" />
      {lamps.map((p, i) => (
        <pointLight key={i} position={p} intensity={4} distance={5} decay={2} color={LOOK.lamp} />
      ))}
    </>
  );
}

// ---------- a soft painted nebula far behind everything (the "25 % soft colour" of space) ----------
let nebTex: THREE.CanvasTexture | null = null;
function nebulaTexture() {
  if (nebTex) return nebTex;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#14102E";
  x.fillRect(0, 0, 1024, 512);
  const blob = (cx: number, cy: number, r: number, col: string) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(20,16,46,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);
  };
  blob(230, 140, 360, "rgba(74,64,136,0.75)");
  blob(820, 120, 300, "rgba(120,72,130,0.45)");
  blob(700, 420, 380, "rgba(58,49,112,0.7)");
  blob(120, 440, 260, "rgba(150,90,120,0.3)");
  blob(520, 260, 200, "rgba(110,120,190,0.25)");
  nebTex = new THREE.CanvasTexture(c);
  nebTex.colorSpace = THREE.SRGBColorSpace;
  return nebTex;
}
export function Nebula({ z = -70, w = 260, h = 130 }: { z?: number; w?: number; h?: number }) {
  return (
    <mesh position={[0, 0, z]} userData={{ noOutline: true }}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={nebulaTexture()} depthWrite={false} fog={false} />
    </mesh>
  );
}
