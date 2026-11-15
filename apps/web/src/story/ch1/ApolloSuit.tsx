// v7.1 APOLLO ASTRONAUT: a smooth, rounded model for the story films (replaces the boxy one).
// Real astronauts stay adult and faceless: an all-white suit, gold visor down, the life-support
// backpack, blue-grey gloves, chunky Moon boots. Moves with a soft bunny-hop Moon walk (low gravity),
// an idle breath and sway. Everything is a pure function of the clock + driver (film-safe).
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { toon } from "../../odyssey/look";
import { motion } from "../../anim/kit";
import type { Driver } from "../../ship/Chubby";

const WHITE = "#F3F1EC";
const SHADE = "#D9D6CF";
const GREY = "#9C9AA3";
const GLOVE = "#7E8CA6";
const GOLD = "#E2B04A";

export function ApolloSuit({ driver, seed = 0 }: { driver: MutableRefObject<Driver>; seed?: number }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const elL = useRef<THREE.Group>(null);
  const elR = useRef<THREE.Group>(null);
  const st = useRef({ ph: seed * 1.7, walk: 0 });
  const m = useMemo(
    () => ({
      white: toon(WHITE, { grain: 0.8, grainScale: 7, paint: 0.6 }),
      shade: toon(SHADE, { grain: 0.6, grainScale: 7 }),
      grey: toon(GREY, { paint: 0.4 }),
      glove: toon(GLOVE, { paint: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.85, roughness: 0.22, emissive: "#5A3A08", emissiveIntensity: 0.25 }),
      shine: new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.55, depthWrite: false }),
      red: toon("#C8574A"),
      blue: toon("#4F78B8"),
    }),
    [],
  );
  useFrame((s, raw) => {
    const dt = Math.min(raw, 0.05);
    const k = st.current;
    const d = driver.current;
    const live = motion.reduced ? 0 : 1;
    k.walk += ((d.walk > 0.1 ? 1 : 0) - k.walk) * Math.min(1, dt * 6);
    k.ph += dt * 5.2 * Math.max(0.25, d.walk);
    const w = k.walk;
    const t = s.clock.elapsedTime + seed * 3;
    const sw = Math.sin(k.ph);
    // the Moon hop: both feet push off together, a long floaty arc
    const hop = Math.max(0, Math.sin(k.ph * 2)) * 0.09 * w * live;
    if (body.current) {
      body.current.position.y = hop + Math.sin(t * 1.6) * 0.006 * (1 - w) * live;
      body.current.rotation.x = 0.1 * w;
      body.current.rotation.z = Math.sin(t * 0.7) * 0.015 * live;
    }
    const legSwing = sw * 0.45 * w;
    if (hipL.current) hipL.current.rotation.x = -legSwing;
    if (hipR.current) hipR.current.rotation.x = legSwing;
    if (kneeL.current) kneeL.current.rotation.x = Math.max(0, Math.sin(k.ph + 0.6)) * 0.55 * w;
    if (kneeR.current) kneeR.current.rotation.x = Math.max(0, Math.sin(k.ph + 0.6 + Math.PI)) * 0.55 * w;
    if (shL.current) shL.current.rotation.set(legSwing * 0.7 - 0.05, 0, 0.16 + Math.sin(t * 1.3) * 0.02 * live);
    if (shR.current) shR.current.rotation.set(-legSwing * 0.7 - 0.05, 0, -0.16 - Math.sin(t * 1.3) * 0.02 * live);
    if (elL.current) elL.current.rotation.x = -0.35 - 0.2 * w;
    if (elR.current) elR.current.rotation.x = -0.35 - 0.2 * w;
    if (head.current) head.current.rotation.set(-0.05 * w, Math.sin(t * 0.4) * 0.12 * live * (1 - w), 0);
  });
  const leg = (side: number, hip: React.RefObject<THREE.Group | null>, knee: React.RefObject<THREE.Group | null>) => (
    <group ref={hip} position={[side * 0.11, 0.9, 0]}>
      <mesh material={m.white} position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.095, 0.22, 6, 16]} />
      </mesh>
      <group ref={knee} position={[0, -0.42, 0]}>
        <mesh material={m.shade}>
          <sphereGeometry args={[0.092, 16, 12]} />
        </mesh>
        <mesh material={m.white} position={[0, -0.19, 0]}>
          <capsuleGeometry args={[0.088, 0.2, 6, 16]} />
        </mesh>
        {/* chunky Moon boot */}
        <RoundedBox args={[0.17, 0.13, 0.3]} radius={0.05} smoothness={3} position={[0, -0.39, 0.04]} material={m.white} />
        <RoundedBox args={[0.18, 0.04, 0.31]} radius={0.015} smoothness={2} position={[0, -0.45, 0.04]} material={m.grey} />
      </group>
    </group>
  );
  const arm = (side: number, sh: React.RefObject<THREE.Group | null>, el: React.RefObject<THREE.Group | null>) => (
    <group ref={sh} position={[side * 0.25, 1.42, 0]}>
      <mesh material={m.white}>
        <sphereGeometry args={[0.1, 16, 12]} />
      </mesh>
      <mesh material={m.white} position={[side * 0.01, -0.15, 0]}>
        <capsuleGeometry args={[0.075, 0.17, 6, 14]} />
      </mesh>
      <group ref={el} position={[side * 0.01, -0.3, 0]}>
        <mesh material={m.white} position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.07, 0.16, 6, 14]} />
        </mesh>
        <mesh material={side < 0 ? m.red : m.blue} position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.065, 0.016, 8, 18]} />
        </mesh>
        <mesh material={m.glove} position={[0, -0.33, 0.01]} scale={[1, 1.1, 0.8]}>
          <sphereGeometry args={[0.075, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
  return (
    <group ref={body}>
      {leg(-1, hipL, kneeL)}
      {leg(1, hipR, kneeR)}
      {/* torso: rounded suit, belt ring and the chest control box */}
      <mesh material={m.white} position={[0, 1.18, 0]} scale={[1, 1, 0.78]}>
        <capsuleGeometry args={[0.24, 0.32, 8, 20]} />
      </mesh>
      <mesh material={m.shade} position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
        <torusGeometry args={[0.235, 0.03, 8, 28]} />
      </mesh>
      <RoundedBox args={[0.24, 0.13, 0.08]} radius={0.025} smoothness={2} position={[0, 1.24, 0.2]} material={m.shade} />
      {[-0.06, 0, 0.06].map((x) => (
        <mesh key={x} position={[x, 1.26, 0.245]} material={m.grey}>
          <cylinderGeometry args={[0.015, 0.015, 0.02, 10]} />
        </mesh>
      ))}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.1, 1.06, 0.17]} rotation={[Math.PI / 2, 0, 0]} material={sd < 0 ? m.red : m.blue}>
          <cylinderGeometry args={[0.022, 0.022, 0.04, 12]} />
        </mesh>
      ))}
      {/* the life-support backpack */}
      <RoundedBox args={[0.46, 0.56, 0.22]} radius={0.06} smoothness={3} position={[0, 1.27, -0.27]} material={m.white} />
      <RoundedBox args={[0.42, 0.12, 0.2]} radius={0.04} smoothness={2} position={[0, 1.62, -0.26]} material={m.shade} />
      {arm(-1, shL, elL)}
      {arm(1, shR, elR)}
      {/* helmet: white shell, gold visor down (no face), a soft highlight */}
      <group ref={head} position={[0, 1.67, 0.02]}>
        <mesh material={m.shade} position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.035, 10, 24]} />
        </mesh>
        <mesh material={m.white}>
          <sphereGeometry args={[0.2, 32, 24]} />
        </mesh>
        <mesh material={m.gold} rotation={[0, 0, 0]}>
          <sphereGeometry args={[0.205, 32, 20, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.22, Math.PI * 0.42]} />
        </mesh>
        <mesh material={m.shine} position={[0, 0, 0]} userData={{ noOutline: true }}>
          <sphereGeometry args={[0.208, 16, 8, Math.PI * 0.55, Math.PI * 0.1, Math.PI * 0.27, Math.PI * 0.16]} />
        </mesh>
        {/* sun shade ridge */}
        <mesh material={m.white} position={[0, 0.115, 0.06]} rotation={[0.5, 0, 0]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} userData={{ noOutline: true }}>
        <circleGeometry args={[0.38, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}
