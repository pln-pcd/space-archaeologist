// MOON EXPLORATION (v7): walk the chibi explorer around Tranquility Base, follow glowing beacons to
// the things left behind, send scanner pulses, and investigate. A clean game HUD: objective chip on
// top, action dock bottom-right, a fading controls card bottom-left, one "nearby" prompt bottom-centre.
// Hands (when switched on in the mission HUD): point to walk, pinch to go there, open palm to scan,
// thumbs-up to investigate. Mouse: click the ground. Keys: WASD/arrows, Space scan, E investigate.
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Compass, Radar, Package, Search, HelpCircle, X, Award, Play, ArrowUpFromDot, Gem } from "lucide-react";
import { MoonGround, Earth, bootPrintTexture, Puffs } from "../story/ch1/props";
import { intents, useIntent, useIntentScope, useLastSource } from "../input/bus";
import { useGloveCam, useInput } from "../input/store";
import { OutlineSync } from "../fx/outline";
import { AdaptiveDpr } from "../fx/AdaptiveDpr";
import { motion } from "../anim/kit";
import { play } from "../audio/sfx";
import { cute } from "../audio/cute";
import { speak } from "../odyssey/nova/voice";
import { NovaAvatar } from "../odyssey/ui/kit";
import { DEFAULT_AVATAR, useAvatar } from "./avatar";
import { ExplorerAvatar } from "./ExplorerAvatar";
import { ArtifactModel } from "./ArtifactModel";
import { command } from "./session";
import { newChibiDriver, chibiAct, type ChibiDriver } from "../characters/Chibi";
import { blobTexture } from "../odyssey/look";
import type { MissionDefinition, MissionState } from "./types";
import "./explore.css";

type Print = { x: number; z: number; r: number };
const trails = new Map<string, Print[]>();
const BOUNDS = { x0: -7, x1: 7, z0: -4, z1: 9 };
/** shared between the 3D world and the HUD without re-rendering */
const live: {
  x: number;
  z: number;
  pulseAt: number;
  /** v7.4: the briefing camera (null = follow the explorer) */
  shot: { look: THREE.Vector3; r: number; h: number; a0: number; at: number } | null;
  focus: string | null;
  /** v7.5: a low-gravity Moon hop (performance.now() when it started) */
  hopAt: number;
} = { x: 0, z: 0, pulseAt: -99, shot: null, focus: null, hopAt: -1e9 };

/** v7.5: sparkly Moon samples scattered around the site, picked up by walking over them */
const SAMPLES: [number, number][] = [[-6, 5.5], [5.8, 6.2], [-2.5, -3.2], [3.2, -3.4], [-6.2, -1.2], [6.4, 0.2], [1.8, 7.8], [-3.6, 8.2]];
const picked = new Set<number>();
function SampleRocks({ onPick }: { onPick: (n: number) => void }) {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      if (picked.has(i)) return void (c.visible = false);
      c.position.y = 0.35 + (motion.reduced ? 0 : Math.sin(t * 2 + i) * 0.08);
      c.rotation.y = motion.reduced ? 0 : t * 1.2 + i;
      if (Math.hypot(SAMPLES[i][0] - live.x, SAMPLES[i][1] - live.z) < 0.9) {
        picked.add(i);
        c.visible = false;
        onPick(picked.size);
      }
    });
  });
  return (
    <group ref={g}>
      {SAMPLES.map(([x, z], i) => (
        <group key={i} position={[x, 0.35, z]}>
          <mesh>
            <dodecahedronGeometry args={[0.18, 0]} />
            <meshToonMaterial color={i % 2 ? "#C9B8FF" : "#9FE8FF"} emissive={i % 2 ? "#5B3FB0" : "#1E7A9C"} emissiveIntensity={0.6} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.33, 0]} userData={{ noOutline: true }}>
            <ringGeometry args={[0.3, 0.42, 24]} />
            <meshBasicMaterial color="#C9F3FF" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BootTrails({ prints }: { prints: Print[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const stamp = new THREE.Object3D();
    prints.forEach((p, i) => {
      stamp.position.set(p.x, 0.02, p.z);
      stamp.rotation.set(-Math.PI / 2, 0, p.r);
      stamp.updateMatrix();
      mesh.current?.setMatrixAt(i, stamp.matrix);
    });
    if (mesh.current) {
      mesh.current.count = prints.length;
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [prints]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 512]} frustumCulled={false}>
      <planeGeometry args={[0.16, 0.32]} />
      <meshBasicMaterial map={bootPrintTexture()} transparent depthWrite={false} />
    </instancedMesh>
  );
}

/** a glowing beacon over a thing to find: a floating gem, a light pillar and a soft ground ring */
function Beacon({ id, found, near, pulse }: { id: string; found: boolean; near: boolean; pulse: boolean }) {
  const gem = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const col = found ? "#7FE8C4" : "#FFD23F";
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (gem.current) {
      gem.current.position.y = 2.15 + (motion.reduced ? 0 : Math.sin(t * 2.2) * 0.1);
      gem.current.rotation.y = motion.reduced ? 0 : t * 1.4;
      const lit = near || live.focus === id;
      gem.current.scale.setScalar(lit ? 1.6 + (motion.reduced ? 0 : Math.sin(t * 5) * 0.15) : 1);
    }
    if (ring.current) {
      const k = motion.reduced ? 0.5 : (t * 0.6) % 1;
      const big = pulse || live.focus === id;
      ring.current.scale.setScalar(0.6 + k * (big ? 1.8 : 0.9));
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (big ? 0.9 : 0.45);
    }
  });
  return (
    <group>
      <mesh ref={gem} userData={{ noOutline: true }}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color={col} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.1, 0]} userData={{ noOutline: true }}>
        <cylinderGeometry args={[0.05, 0.22, 2.2, 16, 1, true]} />
        <meshBasicMaterial color={col} transparent opacity={pulse ? 0.32 : 0.14} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} userData={{ noOutline: true }}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color={col} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** the scanner pulse: a ring that sweeps out from the explorer */
function PulseRing() {
  const m = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!m.current) return;
    const k = (s.clock.elapsedTime - live.pulseAt) / 1.4;
    m.current.visible = k >= 0 && k < 1;
    if (!m.current.visible) return;
    m.current.position.set(live.x, 0.06, live.z);
    m.current.scale.setScalar(0.3 + k * 9);
    (m.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85;
  });
  return (
    <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} visible={false} userData={{ noOutline: true }}>
      <ringGeometry args={[0.92, 1, 64]} />
      <meshBasicMaterial color="#7FD1FF" transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** a little ground arrow next to the explorer pointing at the next thing to find */
function Pointer({ target }: { target: [number, number] | null }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    g.current.visible = !!target && Math.hypot(target[0] - live.x, target[1] - live.z) > 3;
    if (!target || !g.current.visible) return;
    const a = Math.atan2(target[0] - live.x, target[1] - live.z);
    const r = 1.1 + (motion.reduced ? 0 : Math.sin(s.clock.elapsedTime * 4) * 0.08);
    g.current.position.set(live.x + Math.sin(a) * r, 0.07, live.z + Math.cos(a) * r);
    g.current.rotation.y = a;
  });
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.28);
    s.lineTo(0.2, 0);
    s.lineTo(0.08, 0);
    s.lineTo(0.08, -0.18);
    s.lineTo(-0.08, -0.18);
    s.lineTo(-0.08, 0);
    s.lineTo(-0.2, 0);
    s.closePath();
    return s;
  }, []);
  return (
    <group ref={g} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#FFD23F" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WalkWorld({ mission, state, pulse, target, onNear, onReady, onSample }: { mission: MissionDefinition; state: MissionState; pulse: boolean; target: [number, number] | null; onNear: (ids: string[]) => void; onReady: (ready: boolean) => void; onSample: (n: number) => void }) {
  const avatar = useAvatar((s) => s.config) ?? DEFAULT_AVATAR;
  const root = useRef<THREE.Group>(null);
  const driver = useRef<ChibiDriver>(newChibiDriver());
  const position = useRef(new THREE.Vector3(mission.artifacts[0].spawnPosition[0] + 0.5, 0, mission.artifacts[0].spawnPosition[2] + 3.4));
  const facing = useRef(Math.PI);
  const movement = useRef({ x: 0, y: 0 });
  const velRef = useRef(new THREE.Vector2());
  const target_ = useRef<THREE.Vector3 | null>(null);
  const footprintState = useRef<Print[]>(trails.get(mission.meta.id) ?? []);
  const [prints, setPrints] = useState<Print[]>([...footprintState.current]);
  const lastPrint = useRef(position.current.clone());
  const dust = useRef(0);
  const near = useRef("");
  const step = useRef(0);
  const { camera } = useThree();
  const camPos = useRef(new THREE.Vector3(position.current.x, 4, position.current.z + 7));
  const camLook = useRef(new THREE.Vector3(position.current.x, 0.9, position.current.z));
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const pointAt = useRef(0);
  useEffect(() => {
    onReady(true);
    chibiAct(driver.current, "wave");
    return () => onReady(false);
  }, [onReady]);
  const groundAt = (sx: number, sy: number) => {
    ray.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, 1 - (sy / innerHeight) * 2), camera);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  };
  const clampTo = (v: THREE.Vector3) => v.set(THREE.MathUtils.clamp(v.x, BOUNDS.x0, BOUNDS.x1), 0, THREE.MathUtils.clamp(v.z, BOUNDS.z0, BOUNDS.z1));
  useIntent("move", (e) => {
    movement.current = { x: e.x, y: e.y };
    if (e.x || e.y) target_.current = null;
  });
  useIntent("destination", (e) => {
    target_.current = clampTo(new THREE.Vector3(e.x, 0, e.z));
    movement.current = { x: 0, y: 0 };
  });
  // hands: pinch where you want to go; point with one finger to keep walking that way
  useIntent("pinchStart", (e) => {
    if (e.source !== "gesture") return;
    const p = groundAt(e.x, e.y);
    if (p) intents.emit("destination", { x: p.x, z: p.z }, "gesture");
  });
  useIntent("handMotion", (e) => {
    if (!e.pointing) return;
    const now = performance.now();
    if (now - pointAt.current < 140) return;
    pointAt.current = now;
    const p = groundAt(e.x, e.y);
    if (p) target_.current = clampTo(p);
  });
  useFrame((frame, dt0) => {
    const dt = Math.min(dt0, 0.05),
      p = position.current;
    let dx = live.shot ? 0 : movement.current.x,
      dz = live.shot ? 0 : -movement.current.y;
    if (live.shot) target_.current = null;
    if (target_.current) {
      const d = target_.current.clone().sub(p);
      if (d.length() < 0.15) target_.current = null;
      else {
        dx = d.x;
        dz = d.z;
      }
    }
    const len = Math.hypot(dx, dz);
    // v7.3: velocity with gentle acceleration and braking (no instant start/stop), Moon-floaty
    const vel = velRef.current;
    const want = len > 0.01 ? new THREE.Vector2((dx / len) * 2.7, (dz / len) * 2.7) : new THREE.Vector2(0, 0);
    vel.lerp(want, Math.min(1, dt * (len > 0.01 ? 5 : 3.5)));
    const sp = vel.length();
    const moving = sp > 0.25;
    if (sp > 0.01) {
      p.x = THREE.MathUtils.clamp(p.x + vel.x * dt, BOUNDS.x0, BOUNDS.x1);
      p.z = THREE.MathUtils.clamp(p.z + vel.y * dt, BOUNDS.z0, BOUNDS.z1);
      const face = Math.atan2(vel.x, vel.y);
      let diff = face - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, dt * 9);
    }
    driver.current.walk = Math.min(1, sp / 2.2);
    live.x = p.x;
    live.z = p.z;
    if (root.current) {
      // a floaty Moon hop in every stride, a little lean into the turn
      const hop = moving && !motion.reduced ? Math.abs(Math.sin(frame.clock.elapsedTime * 4.2)) * 0.14 * Math.min(1, sp / 2) : 0;
      const hk = (performance.now() - live.hopAt) / 1400;
      const big = hk >= 0 && hk < 1 ? Math.sin(hk * Math.PI) * 1.3 : 0;
      root.current.position.set(p.x, hop + big, p.z);
      root.current.rotation.y = facing.current;
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, -vel.x * 0.03, 6, dt);
    }
    if (moving && p.distanceTo(lastPrint.current) > 0.42) {
      lastPrint.current.copy(p);
      step.current++;
      const side = step.current % 2 ? 0.07 : -0.07;
      if (footprintState.current.length < 512) {
        footprintState.current.push({ x: p.x + Math.cos(facing.current) * side, z: p.z - Math.sin(facing.current) * side, r: facing.current });
        trails.set(mission.meta.id, footprintState.current);
        setPrints([...footprintState.current]);
      }
      dust.current = 1;
      cute.step(step.current);
    }
    dust.current = Math.max(0, dust.current - dt * 2);
    const nearby = mission.artifacts
      .map((a) => ({ id: a.id, d: Math.hypot(a.spawnPosition[0] - p.x, a.spawnPosition[2] - p.z) }))
      .filter((a) => a.d < 2.3)
      .sort((a, b) => a.d - b.d)
      .slice(0, 1)
      .map((a) => a.id);
    const signature = nearby.join(",");
    if (signature !== near.current) {
      near.current = signature;
      onNear(nearby);
      if (nearby.length) cute.sparkle();
    }
    // third-person camera: behind and above, easing; looks a little ahead of the explorer
    // a springy follow camera: pulls back a little while walking and looks ahead where you are going
    const pull = Math.min(1, vel.length() / 2.7);
    const sh = live.shot;
    if (sh) {
      // v7.4 briefing: a slow, smooth orbit around what Nova is talking about
      const a = sh.a0 + (motion.reduced ? 0 : (performance.now() - sh.at) / 1000) * 0.09;
      camPos.current.lerp(new THREE.Vector3(sh.look.x + Math.sin(a) * sh.r, sh.h, sh.look.z + Math.cos(a) * sh.r), 1 - Math.exp(-dt * 1.5));
      camLook.current.lerp(sh.look, 1 - Math.exp(-dt * 2.0));
    } else {
      camPos.current.lerp(new THREE.Vector3(p.x * 0.9 - vel.x * 0.25, 4.0 + pull * 0.5, p.z + 6.8 + pull * 0.9), 1 - Math.exp(-dt * 2.6));
      camLook.current.lerp(new THREE.Vector3(p.x + vel.x * 0.45, 0.7, p.z - 1.0 + vel.y * 0.45), 1 - Math.exp(-dt * 3.2));
    }
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);
    // the explorer steps out of the way of briefing close-ups (never a big head in the shot)
    if (root.current) root.current.visible = !(sh && camPos.current.distanceTo(p) < 4.2);
  });
  return (
    <>
      <color attach="background" args={["#0B0E22"]} />
      <fog attach="fog" args={["#1A1838", 22, 46]} />
      <hemisphereLight args={["#CFD8FF", "#4A4560", 0.9]} />
      <directionalLight position={[8, 9, 5]} intensity={2.6} color="#FFF2DE" />
      <directionalLight position={[-6, 3, -6]} intensity={0.7} color="#9EB8FF" />
      <Stars radius={90} depth={25} count={900} factor={3} fade speed={motion.reduced ? 0 : 0.4} />
      <MoonGround radius={30} />
      <Earth radius={1.4} position={[-6, 6.5, -22]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 2.5]}
        onClick={(e) => {
          e.stopPropagation();
          intents.emit("destination", { x: e.point.x, z: e.point.z }, intents.lastSource);
          play("tick", 1.4, 0.3);
        }}
      >
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {mission.artifacts.map((a) => {
        const found = state.records.includes(a.id);
        return (
          <group
            key={a.id}
            position={a.spawnPosition}
            onClick={(e) => {
              e.stopPropagation();
              intents.emit("destination", { x: a.spawnPosition[0], z: a.spawnPosition[2] + 1.4 }, intents.lastSource);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            {a.modelRef !== "plaque" && (
              <group scale={a.modelRef === "descent" ? 0.62 : 0.58}>
                <ArtifactModel modelRef={a.modelRef} hologram={!state.scanned.includes(a.id)} />
              </group>
            )}
            <Beacon id={a.id} found={found} near={false} pulse={pulse} />
          </group>
        );
      })}
      <PulseRing />
      <SampleRocks onPick={onSample} />
      <Pointer target={target} />
      <group ref={root}>
        <group scale={1.25}>
          <ExplorerAvatar config={avatar} driver={driver} />
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} userData={{ noOutline: true }}>
          <planeGeometry args={[1.1, 1.1]} />
          <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} opacity={0.55} />
        </mesh>
        <Puffs count={6} spread={0.4} size={0.16} opacity={0.22} amount={dust} color="#C9CCD8" />
      </group>
      <BootTrails prints={prints} />
      <AdaptiveDpr />
      <OutlineSync />
    </>
  );
}

let briefedThisVisit = false;

type Shot = { kind: "wide" | "find" | "you"; tag: string; text: string; fact: boolean; at?: [number, number]; id?: string };

export default function Exploration({ mission, state, onFieldActivity }: { mission: MissionDefinition; state: MissionState; onFieldActivity: () => void }) {
  // v7.4: the mission briefing is a little film, not a pop-up. Letterbox bars slide in, the HUD steps
  // away, and the camera flies over Tranquility Base, then visits each mystery find while Nova reads
  // its clue (the sourced landing line first, the discovery hints, then the job). Lines advance on
  // their own when Nova finishes; Next jumps ahead, Skip ends it. Once per visit.
  const shots = useMemo<Shot[]>(
    () => [
      ...(mission.storyShots[0]?.lines.slice(0, 1) ?? []).map((l) => ({ kind: "wide" as const, tag: "Tranquility Base", text: l.text, fact: l.kind === "fact" })),
      ...mission.artifacts.map((a, i) => ({
        kind: "find" as const,
        tag: `Mystery find ${i + 1} of ${mission.artifacts.length}`,
        text: a.discoveryHint.text,
        fact: false,
        at: [a.spawnPosition[0], a.spawnPosition[2]] as [number, number],
        id: a.id,
      })),
      { kind: "you" as const, tag: "Your mission", text: `${mission.meta.briefing.map((l) => l.text).join(" ")} Follow the glowing beacons!`, fact: false },
    ],
    [mission],
  );
  const [brief, setBrief] = useState(() => (briefedThisVisit ? -1 : -2)); // -2 = waiting for the world
  const briefing = brief >= 0 || brief === -2;
  const endBrief = () => {
    briefedThisVisit = true;
    live.shot = null;
    live.focus = null;
    setBrief(-1);
    cute.jingle();
  };
  const nextBrief = () => {
    cute.pop(1.2);
    if (brief < shots.length - 1) setBrief(brief + 1);
    else endBrief();
  };
  useEffect(() => {
    if (brief < 0) return;
    const sh = shots[brief];
    const now = performance.now();
    live.focus = sh.id ?? null;
    if (sh.kind === "wide") live.shot = { look: new THREE.Vector3(0, 0, 1), r: 10, h: 7.5, a0: -0.5, at: now };
    else if (sh.kind === "find" && sh.at) {
      const big = mission.artifacts.find((a) => a.id === sh.id)?.modelRef === "descent";
      live.shot = { look: new THREE.Vector3(sh.at[0], big ? 1.1 : 0.6, sh.at[1]), r: big ? 6.2 : 3.6, h: big ? 3.6 : 2.2, a0: sh.at[0] > 0.5 ? 0.9 : sh.at[0] < -0.5 ? -0.9 : 0.75, at: now };
    }
    else live.shot = null; // "you": the camera comes home to the explorer
    if (sh.kind === "you") cute.sparkle();
    const v = speak(sh.text);
    let t: ReturnType<typeof setTimeout> | undefined;
    // the film moves on by itself after each line (the last one waits for "Let's explore!")
    void v.done.then(() => {
      if (brief < shots.length - 1) t = setTimeout(() => setBrief((b) => (b === brief ? b + 1 : b)), 1300);
    });
    return () => (v.stop(), t && clearTimeout(t));
  }, [brief, shots]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void ((live.shot = null), (live.focus = null)), []);
  useEffect(() => {
    if (brief < 0) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      endBrief();
    };
    addEventListener("keydown", k, true);
    return () => removeEventListener("keydown", k, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);
  const [pulseN, setPulseN] = useState(0);
  const [help, setHelp] = useState(true);
  useEffect(() => {
    if (!ready || brief !== -2) return;
    const t = setTimeout(() => setBrief(0), 700);
    return () => clearTimeout(t);
  }, [ready, brief]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const source = useLastSource();
  useGloveCam();
  const handsMode = useInput((s) => s.mode === "gloves");
  useIntentScope(["pointer", "pinch", "palmHold", "thumbsUp", "wave"], { walk: true }, "moon-exploration");
  const nextUp = mission.artifacts.find((a) => !state.records.includes(a.id)) ?? null;
  const target: [number, number] | null = nextUp ? [nextUp.spawnPosition[0], nextUp.spawnPosition[2]] : null;
  const nearby = mission.artifacts.filter((a) => near.includes(a.id));
  const doPulse = () => {
    if (briefing) return void (brief >= 0 && nextBrief());
    setPulse(true);
    setPulseN((n) => n + 1);
    cute.scan();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPulse(false), 3200);
  };
  const investigate = (id?: string) => {
    if (briefing) return void (brief >= 0 && nextBrief());
    const a = id ? mission.artifacts.find((x) => x.id === id) : nearby[0];
    if (!a) return;
    cute.jingle();
    command(mission, { type: "investigate", id: a.id });
  };
  const goNext = () => {
    if (!nextUp) return;
    intents.emit("destination", { x: nextUp.spawnPosition[0], z: nextUp.spawnPosition[2] + 1.4 }, intents.lastSource);
    cute.boing();
  };
  useIntent("jump", doPulse);
  useIntent("palmHold", (e) => {
    if (e.done) doPulse();
  });
  useIntent("activate", () => investigate());
  useIntent("thumbsUp", () => investigate());
  useEffect(() => {
    if (briefing) return;
    const t = setTimeout(() => setHelp(false), 12000);
    return () => clearTimeout(t);
  }, [briefing]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const total = mission.artifacts.length;
  const done = state.records.length;
  // v7.7 mission path: study every find (each with its quiz) → Rock Box → badge
  const stage = done < total ? 0 : !state.fieldDone ? 1 : 2;
  const [samples, setSamples] = useState(picked.size);
  const onSample = (n: number) => {
    setSamples(n);
    cute.sparkle();
    play("pop", 1.4, 0.4);
    if (n === SAMPLES.length) speak("You found every Moon sample! Great exploring!");
  };
  const hop = () => {
    if (briefing || performance.now() - live.hopAt < 1400) return;
    live.hopAt = performance.now();
    cute.boing();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.key === "j" || e.key === "J") && hop();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  const spokeStage = useRef(stage);
  useEffect(() => {
    if (briefing || stage === spokeStage.current) return;
    spokeStage.current = stage;
    if (stage === 1) speak("Amazing! You studied every find. Next game: fill the Rock Box!");
    if (stage === 2) speak("Rock Box done! Let's go get your badge!");
  }, [stage, briefing]);
  const hands = source === "gesture" || handsMode;
  return (
    <section className={`ex od-free ${briefing ? "briefing" : "playing"}`} aria-label="Explore Tranquility Base">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 4, 12], fov: 46 }} gl={{ toneMapping: THREE.NoToneMapping }}>
        <Suspense fallback={null}>
          <PulseClock n={pulseN} />
          <WalkWorld mission={mission} state={state} pulse={pulse} target={target} onNear={setNear} onReady={setReady} onSample={onSample} />
        </Suspense>
      </Canvas>

      <div className={`ex-cine ${briefing ? "on" : ""}`} aria-hidden="true">
        <i className="ex-cine-top" />
        <i className="ex-cine-bot" />
      </div>
      {brief >= 0 && (
        <div className="ex-cap" role="dialog" aria-label="Mission briefing">
          <div className="ex-cap-title">
            <span>Mission briefing</span>
            <span className="ex-cap-dots" aria-label={`${brief + 1} of ${shots.length}`}>
              {shots.map((_, i) => (
                <i key={i} className={i < brief ? "done" : i === brief ? "on" : ""} />
              ))}
            </span>
          </div>
          <button type="button" className="ex-cap-skip" onClick={endBrief}>
            Skip briefing <kbd>Esc</kbd>
          </button>
          <div className="ex-cap-line" key={brief}>
            <NovaAvatar size={72} />
            <div>
              <small>
                {shots[brief].tag}
                {shots[brief].fact && <span className="ex-true">True story</span>}
              </small>
              <p>{shots[brief].text}</p>
            </div>
            <button type="button" className={`g-btn primary ${brief === shots.length - 1 ? "big go" : ""}`} onClick={nextBrief} autoFocus>
              {brief < shots.length - 1 ? "Next" : "Let's explore!"}
            </button>
          </div>
        </div>
      )}
      <nav className="ex-path" aria-label="Mission path">
        {([
          [Search, `Finds ${done}/${total}`],
          [Package, "Rock Box"],
          [Award, "Badge"],
        ] as const).map(([Icon, label], i) => (
          <span key={i} className={`ex-step ${i < stage ? "done" : i === stage ? "now" : ""}`} aria-current={i === stage ? "step" : undefined}>
            <Icon size={18} strokeWidth={2.8} aria-hidden="true" />
            <span>{label}</span>
          </span>
        ))}
      </nav>
      <div className="ex-samples g-chip" aria-label={`${samples} of ${SAMPLES.length} Moon samples`}>
        <Gem size={18} strokeWidth={2.8} aria-hidden="true" /> {samples}/{SAMPLES.length}
      </div>

      {hands ? null : help ? (
        <div className="ex-help g-panel">
          <button type="button" className="ex-help-x" aria-label="Hide controls" onClick={() => setHelp(false)}>
            <X size={18} strokeWidth={3} />
          </button>
          {hands ? (
            <ul>
              <li>☝️ Point to walk</li>
              <li>🤏 Pinch to go there</li>
              <li>✋ Open palm: scan</li>
              <li>👍 Thumbs up: investigate</li>
            </ul>
          ) : (
            <ul>
              <li>
                <kbd className="g-key">W</kbd>
                <kbd className="g-key">A</kbd>
                <kbd className="g-key">S</kbd>
                <kbd className="g-key">D</kbd> walk
              </li>
              <li>
                <kbd className="g-key">Click</kbd> go there
              </li>
              <li>
                <kbd className="g-key">Space</kbd> scan
              </li>
              <li>
                <kbd className="g-key">E</kbd> investigate
              </li>
            </ul>
          )}
        </div>
      ) : (
        <button type="button" className="g-icon-btn ex-help-open" aria-label="Show controls" onClick={() => setHelp(true)}>
          <HelpCircle size={26} strokeWidth={2.6} />
          <span>Controls</span>
        </button>
      )}

      {stage > 0 && !briefing && (
        <div className="ex-near ex-next g-panel" role="dialog" aria-label="Next game">
          <div className="ex-near-row">
            <span className="ex-near-ico" aria-hidden="true">
              {stage === 1 ? <Package size={24} strokeWidth={2.6} /> : <Award size={24} strokeWidth={2.6} />}
            </span>
            <div className="ex-near-text">
              <small>{stage === 1 ? "Next game" : "Next step"}</small>
              <strong>{stage === 1 ? "Fill the Rock Box" : "Get your badge"}</strong>
            </div>
            <button type="button" className="g-btn primary big" aria-label={stage === 1 ? "Play Fill the Rock Box" : "Go get your badge"} onClick={() => (cute.jingle(), stage === 1 ? onFieldActivity() : command(mission, { type: "next" }))}>
              <Play size={22} strokeWidth={3} aria-hidden="true" /> {stage === 1 ? "Play" : "Go"}
            </button>
          </div>
        </div>
      )}
      {stage === 0 && !!nearby.length && (
        <div className="ex-near g-panel" role="dialog" aria-label="Something nearby">
          {nearby.slice(0, 2).map((a) => (
            <div className="ex-near-row" key={a.id}>
              <span className="ex-near-ico" aria-hidden="true">
                {state.records.includes(a.id) ? "✓" : "!"}
              </span>
              <div className="ex-near-text">
                <small>{state.records.includes(a.id) ? "Already found" : "You found something!"}</small>
                <strong>{a.name.text}</strong>
              </div>
              <button type="button" className="g-btn primary big" aria-label={`Investigate ${a.id}`} onClick={() => investigate(a.id)}>
                <Search size={22} strokeWidth={3} aria-hidden="true" /> Investigate <kbd>E</kbd>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ex-dock">
        <button type="button" className="ex-act sky" onClick={doPulse} aria-label="Scanner pulse">
          <Radar size={30} strokeWidth={2.4} aria-hidden="true" />
          <span>Scan</span>
          <kbd>Space</kbd>
        </button>
        <button type="button" className="ex-act sun" onClick={goNext} disabled={!ready || !nextUp} aria-label="Walk to the next beacon">
          <Compass size={30} strokeWidth={2.4} aria-hidden="true" />
          <span>Next</span>
        </button>
        <button type="button" className="ex-act pink" onClick={hop} aria-label="Moon hop">
          <ArrowUpFromDot size={30} strokeWidth={2.4} aria-hidden="true" />
          <span>Hop</span>
          <kbd>J</kbd>
        </button>
      </div>

      {matchMedia("(pointer: coarse)").matches && (
        <div
          className="m-joystick"
          role="group"
          aria-label="Touch movement joystick"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            intents.emit("move", { x: (e.clientX - r.left - r.width / 2) / 60, y: -(e.clientY - r.top - r.height / 2) / 60 }, "touch");
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const r = e.currentTarget.getBoundingClientRect();
            intents.emit("move", { x: (e.clientX - r.left - r.width / 2) / 60, y: -(e.clientY - r.top - r.height / 2) / 60 }, "touch");
          }}
          onPointerUp={() => intents.emit("move", { x: 0, y: 0 }, "touch")}
          onPointerCancel={() => intents.emit("move", { x: 0, y: 0 }, "touch")}
        >
          <i />
        </div>
      )}
    </section>
  );
}

/** starts the pulse ring on the r3f clock when the pulse begins */
function PulseClock({ n }: { n: number }) {
  const { clock } = useThree();
  const was = useRef(n);
  useEffect(() => {
    live.pulseAt = -99;
  }, []);
  useFrame(() => {
    if (n !== was.current) live.pulseAt = clock.elapsedTime;
    was.current = n;
  });
  return null;
}
