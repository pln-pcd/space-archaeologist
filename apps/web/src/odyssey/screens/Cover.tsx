// THE COVER (v4.6 §1): a 3D cosmic vista in the after-p2 toon style. Real solar-system bodies, stylized
// but recognizable (scene/bodies.tsx): a richly cratered Moon, Mars, Jupiter with the Great Red Spot,
// Saturn with the Cassini gap, Earth with clouds, and small Uranus and Neptune far back. A twinkling
// starfield, two slow shooting stars, a muted lavender/denim haze, and Nova floating on his thrusters,
// waving, blinking, eyes following the cursor. The title is the hero; one big START button.
//
// Layout: every body is placed by screen fraction at its own depth, so the composition holds on wide
// laptops and tall phones alike. The 3D reveal (bodies drift in, Nova flies in) is a pure function of
// the clock, so the HyperFrames `cover-reveal` composition renders the same thing; the DOM entrance
// (title pop, START pulse) is a GSAP timeline.
import { AdaptiveDpr } from "../../fx/AdaptiveDpr";
import { GAME_TITLE } from "../../missions/constants";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { Info, Rocket, Settings as Gear, Volume2, VolumeX } from "lucide-react";
import Nova3D from "../nova/Nova3D";
import { gaze, nova } from "../nova/state";
import { Starship } from "../scene/props";
import { Body, type BodyKind } from "../scene/bodies";
import { Lights } from "../scene/props";
import { OdysseyPost } from "../Post";
import { OutlineSync } from "../../fx/outline";
import { motion } from "../../anim/kit";
import { play } from "../../audio/sfx";
import { useStore } from "../../store";
import { speak, stopSpeaking } from "../nova/voice";
import "@fontsource/lilita-one/400.css";
import "../ui/title.css";
import "./Cover.css";

const CAM_Z = 10;
/** v8: Nova's spoken welcome (pre-rendered clip "cover-welcome" in content/nova-lines.json) */
export const WELCOME = "Welcome to Space Archaeologist! I'm Nova. Ready to discover the machines explorers left on the Moon and Mars? Click Start!";
const FOV = 40;
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
const backOut = (k: number) => {
  const x = clamp01(k);
  return 1 + 2.3 * Math.pow(x - 1, 3) + 1.3 * Math.pow(x - 1, 2);
};

/** [screen x -1..1, screen y -1..1, depth z, radius, spin, tilt, reveal delay s] */
type Slot = [number, number, number, number, number, number, number];
const WIDE: Record<BodyKind, Slot> = {
  // v7.1 (reference look): the Moon rises as a big half-moon under START, Mars glows on the right
  moon: [0, -1.3, -1, 4.1, 0.012, 0.08, 0.1],
  saturn: [-0.8, 0.52, -14, 1.25, 0.05, 0.42, 0.55],
  jupiter: [-1.02, -0.12, -22, 2.4, 0.06, 0.05, 0.4],
  mars: [0.66, 0.08, -9, 2.7, 0.03, 0.44, 0.3],
  earth: [0.6, 0.8, -12, 0.62, 0.08, 0.41, 0.85],
  uranus: [-0.42, 0.92, -34, 1.0, 0.05, 1.7, 1.0],
  neptune: [0.28, 0.95, -40, 0.95, 0.06, 0.5, 1.1],
};
const TALL: Record<BodyKind, Slot> = {
  moon: [-0.78, 0.86, -5, 1.55, 0.025, 0.12, 0.2],
  saturn: [0.7, 0.3, -10, 0.85, 0.05, 0.42, 0.55],
  jupiter: [-1.02, -0.02, -15, 1.9, 0.06, 0.05, 0.4],
  mars: [0.78, -0.3, -4, 0.46, 0.07, 0.44, 0.7],
  earth: [-0.78, -0.56, -7, 0.46, 0.08, 0.41, 0.85],
  uranus: [0.72, 0.92, -32, 0.95, 0.05, 1.7, 1.0],
  neptune: [-0.05, 0.97, -38, 0.85, 0.06, 0.5, 1.1],
};
/** Nova: [screen x, screen y, z, scale] */
// v8: Nova is bigger (she is the host) and stands a little further left of START
const NOVA_WIDE: [number, number, number, number] = [-0.46, -0.6, 2.5, 1.85];
const NOVA_TALL: [number, number, number, number] = [-0.12, -0.46, 2.5, 1.5];
/** the Starship Odyssey cruising through the middle distance: [screen x, screen y, z, scale] */
const SHIP_WIDE: [number, number, number, number] = [-0.62, 0.3, -6, 0.42];
const SHIP_TALL: [number, number, number, number] = [-0.5, -0.12, -3, 0.34];

/** screen fraction at a depth → world position (camera at z = 10 looking down -z) */
function place(sx: number, sy: number, z: number, aspect: number): [number, number, number] {
  const h = (CAM_Z - z) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return [sx * h * aspect, sy * h, z];
}

// ---------- twinkling stars (one draw call, a soft sparkle shader) ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function TwinkleStars({ count = 1100 }: { count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();
  const geo = useMemo(() => {
    const r = rng(42);
    const p = new Float32Array(count * 3);
    const a = new Float32Array(count * 3); // size, phase, speed
    const c = new Float32Array(count * 3);
    const tints = ["#FFF6E6", "#FFE6C2", "#DCE3FF", "#E8E2FF", "#FFFFFF"].map((h) => new THREE.Color(h));
    for (let i = 0; i < count; i++) {
      const x = (r() * 2 - 1) * 120;
      const y = (r() * 2 - 1) * 70;
      p.set([x, y, -60 - r() * 30], i * 3);
      const big = r() < 0.06;
      a.set([big ? 5 + r() * 4 : 1.4 + r() * 2.4, r() * 6.28, 0.6 + r() * 1.8], i * 3);
      const t = tints[Math.floor(r() * tints.length)];
      const b = 0.55 + r() * 0.45;
      c.set([t.r * b, t.g * b, t.b * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aStar", new THREE.BufferAttribute(a, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  }, [count]);
  useFrame((s) => {
    if (mat.current) mat.current.uniforms.uTime.value = motion.reduced ? 0 : s.clock.elapsedTime;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        toneMapped={false}
        vertexColors
        uniforms={{ uTime: { value: 0 }, uDpr: { value: Math.min(1.5, gl.getPixelRatio()) } }}
        vertexShader={`
          attribute vec3 aStar; uniform float uTime; uniform float uDpr; varying vec3 vC; varying float vBig; varying float vTw;
          void main(){ vC = color; vBig = step(4.5, aStar.x);
            vTw = 0.55 + 0.45 * sin(uTime * aStar.z + aStar.y);
            gl_PointSize = aStar.x * uDpr * (0.85 + 0.3 * vTw);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          varying vec3 vC; varying float vBig; varying float vTw;
          void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p);
            float core = smoothstep(0.5, 0.0, d);
            float cross = vBig * (smoothstep(0.06, 0.0, abs(p.x)) + smoothstep(0.06, 0.0, abs(p.y))) * smoothstep(0.5, 0.1, d);
            float a = clamp(core * core + cross * 0.8, 0.0, 1.0) * vTw;
            if (a < 0.01) discard; gl_FragColor = vec4(vC * (1.0 + vBig * 0.4), a); }`}
      />
    </points>
  );
}

// ---------- muted lavender / denim haze ----------
let hazeTex: THREE.CanvasTexture | null = null;
function haze() {
  if (hazeTex) return hazeTex;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const x = c.getContext("2d")!;
  const sky = x.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#1A0B46");
  sky.addColorStop(0.55, "#3B1475");
  sky.addColorStop(1, "#5A1C8C");
  x.fillStyle = sky;
  x.fillRect(0, 0, 1024, 512);
  const b = (cx: number, cy: number, r: number, col: string) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(18,15,42,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);
  };
  b(260, 150, 420, "rgba(150,70,210,0.55)"); // violet
  b(800, 300, 460, "rgba(230,90,180,0.45)"); // magenta behind Mars
  b(560, 420, 360, "rgba(255,120,170,0.35)"); // pink glow near the horizon
  b(900, 90, 240, "rgba(90,90,230,0.4)"); // blue
  b(110, 450, 260, "rgba(120,60,200,0.5)");
  for (let i = 0; i < 6; i++) b(150 + i * 150, 120 + ((i * 97) % 260), 120 + (i % 3) * 40, "rgba(255,180,240,0.12)");
  hazeTex = new THREE.CanvasTexture(c);
  hazeTex.colorSpace = THREE.SRGBColorSpace;
  return hazeTex;
}

/** DOM bits the 3D scene positions (Nova's speech bubble) */
export const coverDom = { bubble: null as HTMLElement | null };
const tmp = new THREE.Vector3();

/** the cover world; `reveal` plays the deterministic entrance from the scene clock */
export function CoverWorld({ leaving = 0, reveal = true }: { leaving?: number; reveal?: boolean }) {
  const { camera, size } = useThree();
  const aspect = size.width / size.height;
  const tall = aspect < 1;
  const L = tall ? TALL : WIDE;
  const novaSlot = tall ? NOVA_TALL : NOVA_WIDE;
  const groups = useRef<Partial<Record<BodyKind, THREE.Group | null>>>({});
  const novaRig = useRef<THREE.Group>(null);
  const ship = useRef<THREE.Group>(null);
  const shipSlot = tall ? SHIP_TALL : SHIP_WIDE;
  const look = useRef({ x: 0, y: 0, tx: 0, ty: 0, leave: 0 });

  useEffect(() => {
    if (motion.reduced) return;
    const pm = (e: PointerEvent) => {
      look.current.tx = (e.clientX / innerWidth - 0.5) * 2;
      look.current.ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      look.current.tx = Math.max(-1, Math.min(1, e.gamma / 30));
      look.current.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    };
    addEventListener("pointermove", pm);
    addEventListener("deviceorientation", tilt);
    gaze.on = true;
    return () => {
      removeEventListener("pointermove", pm);
      removeEventListener("deviceorientation", tilt);
      gaze.on = false;
      gaze.x = gaze.y = 0;
    };
  }, []);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const r = reveal && !motion.reduced ? t : 99;
    const k = look.current;
    k.x += (k.tx - k.x) * Math.min(1, dt * 2.5);
    k.y += (k.ty - k.y) * Math.min(1, dt * 2.5);
    k.leave += (leaving - k.leave) * Math.min(1, dt * 3);
    const lv = easeOut(k.leave);
    // camera: gentle parallax; on Start it glides forward toward the stars
    camera.position.set(k.x * 0.32 * (1 - lv), -k.y * 0.2 * (1 - lv), CAM_Z - lv * 3.5);
    camera.lookAt(k.x * 0.08, -k.y * 0.05, 0);
    // bodies drift in from beyond the frame edges, staggered
    (Object.keys(L) as BodyKind[]).forEach((kind) => {
      const g = groups.current[kind];
      if (!g) return;
      const [sx, sy, z, , , , delay] = L[kind];
      const [x, y] = place(sx, sy, z, aspect);
      const d = easeOut((r - delay) / 2.2);
      const out = 1 - d;
      g.position.set(x * (1 + out * 0.6), y * (1 + out * 0.6), z - out * 12);
      g.scale.setScalar(0.001 + 0.999 * clamp01((r - delay) / 0.5));
      // v8: the planets hold still (only the gentle camera parallax moves the vista)
    });
    // the ship glides in from the left and bobs
    if (ship.current) {
      const [sx, sy, z, sc] = shipSlot;
      const [x, y] = place(sx, sy, z, aspect);
      const a = easeOut((r - 0.9) / 2.6);
      ship.current.position.set(x - (1 - a) * 14, y, z + lv * 3);
      ship.current.rotation.set(0.12, -0.35, 0.05);
      ship.current.scale.setScalar(sc);
    }
    // Nova flies in from below right, bobbing on his thrusters
    if (novaRig.current) {
      const [sx, sy, z, sc] = novaSlot;
      const [x, y] = place(sx, sy, z, aspect);
      const f = backOut((r - 1.5) / 1.1);
      novaRig.current.visible = r > 1.45;
      novaRig.current.position.set(x + (1 - f) * 3, y - (1 - f) * 3.2 + lv * 0.4, z + lv * 2);
      novaRig.current.scale.setScalar(sc * Math.max(0.001, Math.min(1, f + 0.001)));
      novaRig.current.rotation.z = (1 - f) * -0.4;
      // turn the whole body toward the camera (he stands off-centre), plus a friendly lean
      novaRig.current.rotation.y = Math.atan2(-novaRig.current.position.x, CAM_Z - novaRig.current.position.z) + (motion.reduced ? 0 : Math.sin(t * 0.7) * 0.08);
      // Nova's speech bubble follows his head on screen
      const b = coverDom.bubble;
      if (b) {
        tmp.set(novaRig.current.position.x + 0.5 * sc, novaRig.current.position.y + 0.95 * sc, novaRig.current.position.z).project(camera);
        // keep the bubble on screen (narrow phones)
        b.style.left = `${Math.max(8, Math.min(((tmp.x + 1) / 2) * size.width, size.width - b.offsetWidth - 10))}px`;
        b.style.top = `${((1 - tmp.y) / 2) * size.height}px`;
        b.dataset.show = r > 3 && lv < 0.1 ? "1" : "0";
      }
    }
    // eyes follow the cursor (relative to Nova's spot on screen)
    gaze.x = (k.tx - novaSlot[0]) * 1.4;
    gaze.y = (k.ty + novaSlot[1]) * 1.4;
  });

  return (
    <>
      <color attach="background" args={["#1A0B46"]} />
      <Lights />
      <mesh position={[0, 0, -95]} userData={{ noOutline: true }}>
        <planeGeometry args={[330, 165]} />
        <meshBasicMaterial map={haze()} depthWrite={false} toneMapped={false} />
      </mesh>
      <TwinkleStars />
      {(Object.keys(L) as BodyKind[]).map((kind) => {
        const [, , , radius, spin, tilt] = L[kind];
        return (
          <group key={kind} ref={(g) => void (groups.current[kind] = g)} scale={0.001}>
            <Body kind={kind} radius={radius} spin={spin * 0} tilt={tilt} segments={kind === "uranus" || kind === "neptune" ? 32 : 64} ringTilt={kind === "saturn" ? 1.2 : undefined} />
          </group>
        );
      })}
      <MarsGlow aspect={aspect} />
      <MoonFinds aspect={aspect} reveal={reveal} />
      <Nebula />
      <Sparkles4 aspect={aspect} />
      <group ref={ship} scale={0.001}>
        <Starship />
      </group>
      <group ref={novaRig} visible={false}>
        <Nova3D float lookAt={[0, 0.4, 12]} />
      </group>
      <OutlineSync />
    </>
  );
}

/** a soft magenta halo behind Mars (the glowing planet of the reference look) */
function MarsGlow({ aspect }: { aspect: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(128, 128, 40, 128, 128, 128);
    g.addColorStop(0, "rgba(255,140,120,0.9)");
    g.addColorStop(0.45, "rgba(255,90,170,0.35)");
    g.addColorStop(1, "rgba(255,90,170,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const [sx, sy, z, r] = WIDE.mars;
  const [x, y] = place(sx, sy, z - 0.5, aspect);
  const m = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (m.current) m.current.scale.setScalar(1 + (motion.reduced ? 0 : Math.sin(st.clock.elapsedTime * 0.8) * 0.03));
  });
  return (
    <mesh ref={m} position={[x, y, z - 0.6]} userData={{ noOutline: true }}>
      <planeGeometry args={[r * 4.2, r * 4.2]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/** the things left behind, tiny and cute, sitting on the Moon's rim (instead of crystals) */
function MoonFinds({ aspect, reveal }: { aspect: number; reveal: boolean }) {
  const [sx, sy, z, r] = WIDE.moon;
  const [cx, cy] = place(sx, sy, z, aspect);
  // stand ON the sphere: a point on the surface facing the camera a little, "up" = the surface normal
  const place3 = (u: number) => {
    const n = new THREE.Vector3(Math.cos(Math.PI / 2 + u), Math.sin(Math.PI / 2 + u), 0.12).normalize();
    const p = new THREE.Vector3(cx, cy, z).addScaledVector(n, r * 0.995);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    return { p: p.toArray() as [number, number, number], q, n };
  };
  const L = place3(-0.68);
  const R2 = place3(-0.36);
  // v7.4: the Moon rises first; then the lander touches down and the rover drops in after it
  // (a soft bounce along the surface normal), then they idle: the rover rocks, the lander's light blinks
  const lander = useRef<THREE.Group>(null);
  const rover = useRef<THREE.Group>(null);
  const blink = useRef<THREE.Mesh>(null);
  const moonDone = WIDE.moon[6] + 2.1;
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const r = reveal && !motion.reduced ? t : 99;
    ([
      [lander.current, L, 1.05, 0],
      [rover.current, R2, 0.95, 0.5],
    ] as const).forEach(([g, at, sc, d]) => {
      if (!g) return;
      const k = clamp01((r - moonDone - d) / 0.8);
      const b = k <= 0 ? 0 : backOut(k);
      g.visible = k > 0;
      g.position.set(at.p[0] + at.n.x * (1 - easeOut(k)) * 1.6, at.p[1] + at.n.y * (1 - easeOut(k)) * 1.6, at.p[2] + at.n.z * (1 - easeOut(k)) * 1.6);
      g.scale.setScalar(sc * Math.max(0.001, Math.min(1.15, b)));
    });
    if (blink.current) blink.current.visible = motion.reduced || Math.sin(t * 3) > 0;
  });
  const gold = "#E9B949";
  return (
    <group>
      {/* a little lander on the right shoulder */}
      <group ref={lander} position={L.p} quaternion={L.q} scale={1.05} visible={false}>
        <group rotation={[0, -0.6, 0]}>
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.24, 8]} />
          <meshToonMaterial color={gold} />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <dodecahedronGeometry args={[0.2, 0]} />
          <meshToonMaterial color="#EDEAF4" />
        </mesh>
        <mesh position={[0.05, 0.86, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 5]} />
          <meshToonMaterial color="#C9C3D6" />
        </mesh>
        <mesh ref={blink} position={[0.05, 0.98, 0]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshBasicMaterial color="#FF6FA8" toneMapped={false} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = i * 1.571 + 0.78;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32]} rotation={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]}>
              <cylinderGeometry args={[0.025, 0.025, 0.36, 6]} />
              <meshToonMaterial color="#C9C3D6" />
            </mesh>
          );
        })}
      </group>
      </group>
      {/* a little rover on the left shoulder */}
      <group ref={rover} position={R2.p} quaternion={R2.q} scale={0.95} visible={false}>
        <group rotation={[0, 0.7, 0]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.5, 0.16, 0.34]} />
          <meshToonMaterial color="#F1ECE4" />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <boxGeometry args={[0.7, 0.02, 0.44]} />
          <meshToonMaterial color="#5E78D6" />
        </mesh>
        <mesh position={[0.15, 0.48, 0.1]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
          <meshToonMaterial color="#C9C3D6" />
        </mesh>
        <mesh position={[0.15, 0.64, 0.1]}>
          <boxGeometry args={[0.16, 0.08, 0.1]} />
          <meshToonMaterial color="#F1ECE4" />
        </mesh>
        {[-1, 0, 1].flatMap((i) =>
          [-1, 1].map((sd) => (
            <mesh key={`${i}${sd}`} position={[i * 0.2, 0.1, sd * 0.22]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.06, 14]} />
              <meshToonMaterial color="#5B5470" />
            </mesh>
          )),
        )}
        </group>
      </group>
    </group>
  );
}

/** soft nebula clouds in three hues, drifting very slowly */
function Nebula() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.5, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const clouds = useMemo(
    () =>
      [
        [-14, 7, -40, 30, "#7A4DFF", 0.28],
        [16, -4, -42, 34, "#FF5FA2", 0.22],
        [2, 12, -48, 26, "#3FD1FF", 0.16],
        [-20, -8, -45, 28, "#B84DFF", 0.2],
        [22, 10, -50, 24, "#5B7BFF", 0.2],
      ] as [number, number, number, number, string, number][],
    [],
  );
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = motion.reduced ? 0 : s.clock.elapsedTime;
    g.current?.children.forEach((m, i) => {
      m.position.x = clouds[i][0] + Math.sin(t * 0.03 + i) * 1.5;
      m.rotation.z = t * 0.01 * (i % 2 ? 1 : -1);
    });
  });
  return (
    <group ref={g}>
      {clouds.map(([x, y, z, s, col, o], i) => (
        <mesh key={i} position={[x, y, z]} userData={{ noOutline: true }}>
          <planeGeometry args={[s, s * 0.6]} />
          <meshBasicMaterial map={tex} color={col} transparent opacity={o} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** a dozen four-point sparkles that twinkle in turn */
function Sparkles4({ aspect }: { aspect: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "#FFFFFF";
    x.beginPath();
    x.moveTo(32, 0);
    x.quadraticCurveTo(36, 28, 64, 32);
    x.quadraticCurveTo(36, 36, 32, 64);
    x.quadraticCurveTo(28, 36, 0, 32);
    x.quadraticCurveTo(28, 28, 32, 0);
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const spots = useMemo(
    () =>
      [
        [-0.55, 0.78],
        [0.35, 0.7],
        [-0.85, 0.15],
        [0.86, 0.45],
        [-0.25, 0.42],
        [0.62, -0.15],
        [-0.7, -0.35],
        [0.22, -0.42],
        [0.95, -0.7],
        [-0.95, 0.6],
        [0.05, 0.88],
        [-0.42, -0.1],
      ].map(([sx, sy]) => place(sx, sy, -12, aspect)),
    [aspect],
  );
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = motion.reduced ? 1 : s.clock.elapsedTime;
    g.current?.children.forEach((m, i) => {
      // v8: a soft twinkle only (no spinning)
      const k = Math.max(0, Math.sin(t * 0.9 + i * 1.7));
      m.scale.setScalar(0.35 + k * 0.3);
      m.rotation.z = i;
    });
  });
  return (
    <group ref={g}>
      {spots.map((p, i) => (
        <mesh key={i} position={p} userData={{ noOutline: true }}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color={i % 3 ? "#FFF3C4" : "#FFC2EC"} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** a tiny satellite drifting slowly across the top of the sky */
function Satellite({ aspect }: { aspect: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (!g.current) return;
    const t = motion.reduced ? 20 : st.clock.elapsedTime;
    const k = ((t * 0.018) % 1.4) - 0.2;
    const [x, y] = place(-1.1 + k * 2.2, 0.66 - k * 0.12, -6, aspect);
    g.current.position.set(x, y, -6);
    g.current.rotation.set(0.3, t * 0.2, 0.4);
  });
  return (
    <group ref={g} scale={0.45}>
      <mesh>
        <boxGeometry args={[0.35, 0.35, 0.5]} />
        <meshToonMaterial color="#FFD86B" />
      </mesh>
      {[-1, 1].map((s2) => (
        <mesh key={s2} position={[s2 * 0.62, 0, 0]}>
          <boxGeometry args={[0.8, 0.03, 0.34]} />
          <meshToonMaterial color="#4C6BD6" />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.16, 0.14, 16, 1, true]} />
        <meshToonMaterial color="#F4F1FA" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** a few small rocks tumbling gently in the distance */
function Asteroids() {
  const g = useRef<THREE.Group>(null);
  const rocks = useMemo(() => [[-5.5, 1.6, -9, 0.22], [6.5, -1.2, -11, 0.3], [-3.2, -0.4, -7, 0.14], [3.6, 3.1, -13, 0.2], [-8, 3.4, -16, 0.35]] as [number, number, number, number][], []);
  useFrame((st) => {
    const t = motion.reduced ? 0 : st.clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      c.rotation.set(t * 0.3 + i, t * 0.2 + i * 2, 0);
      c.position.y = rocks[i][1] + Math.sin(t * 0.4 + i) * 0.15;
    });
  });
  return (
    <group ref={g}>
      {rocks.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <dodecahedronGeometry args={[r, 0]} />
          <meshToonMaterial color={i % 2 ? "#8C7BB8" : "#A893D6"} />
        </mesh>
      ))}
    </group>
  );
}

export default function Cover({ onStart, onSettings, onCredits }: { onStart: () => void; onSettings: () => void; onCredits: () => void }) {
  const [leaving, setLeaving] = useState(0);
  const leavingRef = useRef(0);
  leavingRef.current = leaving;
  const sound = useStore((s) => s.settings.sound !== false);
  const configure = useStore((s) => s.configure);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);

  // Nova waves when she arrives, and again now and then
  useEffect(() => {
    nova.feel("excited");
    const a = setTimeout(() => nova.act("wave"), motion.reduced ? 200 : 2500);
    const iv = setInterval(() => nova.act("wave"), 12000);
    return () => (clearTimeout(a), clearInterval(iv));
  }, []);

  // v8: Nova welcomes the explorer out loud as the game opens. Browsers only allow sound after a
  // click or key press, so if the first try is blocked she says it on the first tap/key instead.
  useEffect(() => {
    let said = false,
      stop = () => {};
    const say = () => {
      if (said || leavingRef.current) return;
      said = true;
      off();
      nova.act("wave");
      stop = speak(WELCOME, { clip: "cover-welcome" }).stop;
    };
    const tryNow = setTimeout(() => {
      // AudioContext starts "running" only when the page may already play sound
      const ctx = new AudioContext();
      const ok = ctx.state === "running";
      void ctx.close();
      if (ok) say();
    }, motion.reduced ? 400 : 3000);
    const first = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.(".od-start")) return off();
      setTimeout(say, 60);
    };
    const off = () => {
      removeEventListener("pointerdown", first, true);
      removeEventListener("keydown", first, true);
    };
    addEventListener("pointerdown", first, true);
    addEventListener("keydown", first, true);
    return () => (clearTimeout(tryNow), off(), stop());
  }, []);

  // DOM entrance: title pops, START rises then pulses gently, corner tools fade in
  useEffect(() => {
    const title = titleRef.current;
    const start = startRef.current;
    const tools = toolsRef.current;
    const mid = midRef.current;
    if (!title || !start || !tools || !mid) return;
    if (motion.reduced) {
      gsap.set([title, start, tools, mid], { opacity: 1, scale: 1, y: 0 });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(title, { opacity: 0, scale: 0.7, y: -20 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.8)" }, 0.9)
      .fromTo(mid, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.6)" }, 1.7)
      .fromTo(start, { opacity: 0, y: 40, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(2)" }, 2.2)
      .fromTo(tools, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 2.4);
    return () => void tl.kill();
  }, []);

  const start = () => {
    if (leaving) return;
    play("pop", 1.2, 0.8);
    play("chime", 1, 0.5);
    nova.feel("excited");
    nova.act("thumbs");
    gsap.killTweensOf(startRef.current);
    stopSpeaking();
    setLeaving(1);
    setTimeout(onStart, motion.reduced ? 100 : 260);
  };

  // Enter / Space start the game (when no other button has focus)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const a = document.activeElement;
      if (a && a !== document.body && a !== startRef.current) return;
      e.preventDefault();
      start();
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  return (
    <div className="od-cover" data-leaving={leaving ? "1" : "0"}>
      <Canvas className="od-canvas" dpr={[1, 1.5]} camera={{ fov: FOV, near: 0.1, far: 220, position: [0, 0, CAM_Z] }} gl={{ antialias: true, toneMapping: THREE.NoToneMapping }} aria-hidden="true">
        <Suspense fallback={null}>
          <CoverWorld leaving={leaving} />
          <OdysseyPost near={14} far={60} />
          <AdaptiveDpr />
        </Suspense>
      </Canvas>
      <h1 ref={titleRef} className="od-hero-title od-cover-title od-free" aria-label={GAME_TITLE} style={{ opacity: 0 }}>
        <span className="od-tl" aria-hidden="true">
          {GAME_TITLE.split(" ")[0].split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${900 + i * 50}ms` }}>
              {ch}
            </span>
          ))}
        </span>{" "}
        <span className="od-tl" aria-hidden="true">
          {GAME_TITLE.split(" ").slice(1).join(" ").split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1300 + i * 50}ms` }}>
              {ch}
            </span>
          ))}
        </span>
      </h1>
      <div ref={midRef} className="od-cover-mid od-free" style={{ opacity: 0 }}>
        <p className="od-tagline">Explore the Moon and Mars. Find the brave machines left behind!</p>
      </div>
      <div className="od-nova-says od-free" ref={(el) => void (coverDom.bubble = el)} aria-hidden="true" data-show="0">
        {WELCOME}
      </div>
      <div ref={toolsRef} className="od-cover-tools" style={{ opacity: 0 }}>
        <button type="button" className="od-round" aria-label={sound ? "Turn sound off" : "Turn sound on"} aria-pressed={sound} onClick={() => (configure({ sound: !sound }), play("tick"))}>
          {sound ? <Volume2 size={28} strokeWidth={2.2} /> : <VolumeX size={28} strokeWidth={2.2} />}
        </button>
        <button type="button" className="od-round" aria-label="Credits" onClick={onCredits}>
          <Info size={28} strokeWidth={2.2} />
        </button>
        <button type="button" className="od-round" aria-label="Settings" onClick={onSettings}>
          <Gear size={28} strokeWidth={2.2} />
        </button>
      </div>
      <button
        ref={startRef}
        type="button"
        className="od-start od-start-pill od-free"
        aria-label="Start the game"
        style={{ opacity: 0 }}
        onClick={start}
        onPointerEnter={() => nova.act("wave")}
        onFocus={() => nova.act("wave")}
      >
        <Rocket size={40} strokeWidth={2.4} aria-hidden="true" />
        <span>Start</span>
      </button>
    </div>
  );
}
