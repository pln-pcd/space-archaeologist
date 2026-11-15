// NOVA, the game's host (new-flow prompt §6): a small, cute astronaut, about 2.5 heads tall, with a
// big round helmet and a clear visor that always shows his face. Soft white suit with one accent
// colour (sky blue) on the chest panel, cuffs, neck ring and boots; a star badge of our own design;
// a tiny backpack whose two thrusters puff soft particles while he floats. Toon-ramp shading with
// painted fabric texture (after-p2 look), 3 px warm-dark outline.
//
// Everything is a pure function of the clock (no Math.random, no timers), so the same model renders
// identically inside HyperFrames compositions.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useOutlines } from "../../fx/outline";
import { motion } from "../../anim/kit";
import { LOOK, glass, glow, toon, blobTexture } from "../look";
import { makeFace } from "./face";
import { gaze, mouth, useNova, type Expression, type Gesture } from "./state";

// v4.6: brighter, cuter Nova: bigger helmet, sky-blue trim, sunny-orange gloves and boots, a yellow
// belt, an antenna with a glowing star, glowing ear pods and blinking chest lights.
const SUIT = "#FFF7FB"; // v7.2: Nova is a girl: blush-white suit
const ACCENT = "#FF8FBE"; // bubblegum pink trim
const GLOVE = "#B59CFF"; // lilac gloves and boots
const PACK = "#F3E9FF";
const BELT = "#FFD23F";

const R = 0.238; // helmet radius (chibi: big head)
const CAP = 0.92; // visor half-angle (radians)

/** a spherical cap facing +Z with planar UVs, so a flat face texture maps without distortion */
function capGeometry(r: number, theta: number) {
  const g = new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, theta);
  g.rotateX(Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const span = r * Math.sin(theta);
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / span / 2 + 0.5, pos.getY(i) / span / 2 + 0.5);
  uv.needsUpdate = true;
  return g;
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const backOut = (k: number) => {
  const c1 = 1.3,
    c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, k));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const damp = (c: number, t: number, l: number, dt: number) => c + (t - c) * (1 - Math.exp(-l * dt));

export type NovaProps = {
  /** float and bob (thrusters puff) or stand */
  float?: boolean;
  /** pop in from a side when mounted */
  enter?: "left" | "right" | "top" | "bottom" | "none";
  /** fixed expression/gesture (compositions); otherwise the shared Nova state drives him */
  expression?: Expression;
  gesture?: Gesture;
  /** turn the head toward the camera a little */
  lookAt?: [number, number, number];
  shadow?: boolean;
};

const GESTURE_LEN: Record<Gesture, number> = { none: 0, wave: 1.8, point: 2.2, thumbs: 1.5, spin: 1.0, pop: 0.7, shrug: 1.3, cup: 99, jump: 0.95 };

export default function Nova3D({ float = true, enter = "none", expression, gesture, lookAt, shadow = true }: NovaProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const antenna = useRef<THREE.Group>(null);
  const blob = useRef<THREE.Mesh>(null);
  useOutlines(root, "character");

  const face = useMemo(() => makeFace(), []);
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false }), [face]);
  const capG = useMemo(() => capGeometry(R * 1.006, CAP), []);
  const visorG = useMemo(() => capGeometry(R * 1.045, CAP + 0.04), []);
  const visorMat = useMemo(() => {
    const m = glass("#BFD9F2", 0.16);
    m.depthWrite = false;
    return m;
  }, []);
  const shine = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.55, depthWrite: false }), []);
  const rimGlass = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color("#9FD8FF") } },
        vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
        fragmentShader: "uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.6); gl_FragColor = vec4(uColor * f * 1.1, f * 0.85); }",
      }),
    [],
  );
  const puffMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFF4E2", transparent: true, opacity: 0.6, depthWrite: false }), []);
  const ring = R * Math.sin(CAP);
  const ringZ = R * Math.cos(CAP);

  const st = useRef({ t0: -1, g: "none" as Gesture, gId: -1, gT: 0, sp: 0, mouth: 0, x: { armLz: 0.35, armRz: -0.35, armLx: 0, armRx: 0, armRy: 0, headX: 0, headZ: 0, headY: 0, lean: 0, spin: 0 } });

  // gestures started from the shared state restart the local clock
  const gId = useNova((s) => s.gestureId);
  useEffect(() => {
    st.current.gT = 0;
  }, [gId]);
  useLayoutEffect(() => {
    face.draw({ expr: expression ?? useNova.getState().expression, blink: false, mouth: 0, round: false });
  }, [face, expression]);

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = st.current;
    const t = s.clock.elapsedTime;
    if (k.t0 < 0) k.t0 = t;
    const age = t - k.t0;
    const shared = useNova.getState();
    const expr = expression ?? shared.expression;
    const g: Gesture = gesture ?? shared.gesture;
    if (shared.gestureId !== k.gId && !gesture) {
      k.gId = shared.gestureId;
      k.gT = 0;
    }
    k.gT += dt;
    const live = motion.reduced ? 0 : 1;
    const gp = GESTURE_LEN[g] ? Math.min(1, k.gT / GESTURE_LEN[g]) : 1;
    const active = g !== "none" && (g === "cup" || k.gT < GESTURE_LEN[g]);

    // ---- face: blink every 2–5 s, mouth from the voice level ----
    const slot = Math.floor(t / 3.5);
    const at = slot * 3.5 + hash(slot) * 2.2;
    const blink = expr !== "happy" && t > at && t < at + 0.12;
    k.mouth = damp(k.mouth, mouth.speaking ? mouth.level : 0, 22, dt);
    const step = mouth.speaking ? Math.min(4, Math.round(k.mouth * 4.4)) : 0;
    // eyes follow the gaze target in 5 steps each way (few redraws)
    const gx = gaze.on ? Math.round(Math.max(-1, Math.min(1, gaze.x)) * 2) / 2 : 0;
    const gy = gaze.on ? Math.round(Math.max(-1, Math.min(1, gaze.y)) * 2) / 2 : 0;
    face.draw({ expr, blink, mouth: step, round: mouth.viseme === "o", gx, gy });

    // ---- pose targets ----
    const x = k.x;
    let aLz = 0.35,
      aRz = -0.35,
      aLx = 0,
      aRx = 0,
      aRy = 0,
      hX = 0,
      hZ = 0,
      hY = 0,
      lean = 0;
    const idle = Math.sin(t * 1.3) * 0.05 * live;
    aLz += idle * 0.6;
    aRz -= idle * 0.6;
    if (expr === "curious") hZ = 0.24;
    if (expr === "thinking") (hX = -0.16), (hZ = -0.08), (aRx = -1.9), (aRz = -0.55);
    if (expr === "listening") (lean = 0.16), (hZ = 0.12);
    if (expr === "sorry") hZ = -0.1;
    if (expr === "sleepy") (hZ = 0.2), (hX = 0.12);
    if (mouth.speaking) hX += Math.sin(t * 7.5) * 0.025 * k.mouth * live;
    if (active) {
      if (g === "wave") {
        aRz = -2.55;
        aRx = -0.2;
        aRy = Math.sin(k.gT * 10) * 0.45 * live;
        hZ = -0.08;
      } else if (g === "point") {
        const [px, py] = shared.pointAt;
        if (px >= 0) (aLz = 1.45 + py * 0.6), (aLx = -0.3);
        else (aRz = -1.45 - py * 0.6), (aRx = -0.3);
        hY = px * 0.35;
      } else if (g === "thumbs") {
        aRx = -1.35;
        aRz = -0.3;
      } else if (g === "shrug") {
        const h = Math.sin(gp * Math.PI);
        aLz = 0.35 + 0.75 * h;
        aRz = -0.35 - 0.75 * h;
        aLx = aRx = -0.5 * h;
        hZ = 0.14 * h;
      } else if (g === "jump") {
        // arms up for joy
        aLz = 1.9;
        aRz = -1.9;
        hX = -0.12;
      } else if (g === "cup") {
        aLz = 2.3;
        aLx = -0.4;
        lean = 0.14;
        hZ = 0.16;
      }
    }
    const L = 14;
    x.armLz = damp(x.armLz, aLz, L, dt);
    x.armRz = damp(x.armRz, aRz, L, dt);
    x.armLx = damp(x.armLx, aLx, L, dt);
    x.armRx = damp(x.armRx, aRx, L, dt);
    x.armRy = g === "wave" && active ? aRy : damp(x.armRy, aRy, L, dt);
    x.headX = damp(x.headX, hX + (gaze.on && !active ? gaze.y * 0.1 : 0), 8, dt);
    x.headZ = damp(x.headZ, hZ, 8, dt);
    x.headY = damp(x.headY, hY + (gaze.on && !active ? gaze.x * 0.3 : 0), 8, dt);
    x.lean = damp(x.lean, lean, 8, dt);
    if (armL.current) armL.current.rotation.set(x.armLx, 0, x.armLz);
    if (armR.current) armR.current.rotation.set(x.armRx, x.armRy, x.armRz);
    if (head.current) {
      head.current.rotation.set(x.headX, x.headY, x.headZ);
      if (lookAt && head.current.parent) {
        const target = new THREE.Vector3(...lookAt);
        head.current.parent.worldToLocal(target);
        head.current.rotation.y += Math.atan2(target.x, target.z) * 0.35;
      }
    }

    // ---- body: float bob, legs dangle, spin, entrance ----
    const bob = float ? Math.sin(t * 1.6) * 0.035 * live : 0;
    const spin = g === "spin" && active ? ease(gp) * Math.PI * 2 : 0;
    // the happy jump: crouch (0-0.15), hop up (0.15-0.75), land with a little squash (0.75-1)
    const jumpK = g === "jump" && active ? gp : -1;
    const jumpY = jumpK < 0 ? 0 : jumpK < 0.15 ? -0.03 * (jumpK / 0.15) : jumpK < 0.75 ? Math.sin(((jumpK - 0.15) / 0.6) * Math.PI) * 0.22 : 0;
    const hop = (g === "spin" && active ? Math.sin(gp * Math.PI) * 0.08 : 0) + (g === "thumbs" && active ? Math.sin(gp * Math.PI) * 0.03 : 0) + jumpY * live;
    if (body.current) {
      body.current.position.y = bob + hop;
      const squash = jumpK < 0 || !live ? 0 : jumpK < 0.15 ? 0.1 * (jumpK / 0.15) : jumpK < 0.45 ? -0.08 : jumpK > 0.75 ? 0.1 * Math.sin(((jumpK - 0.75) / 0.25) * Math.PI) : 0;
      body.current.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      body.current.rotation.set(x.lean, spin, float ? Math.sin(t * 0.9) * 0.04 * live : 0);
    }
    const dangle = float ? 0.12 + Math.sin(t * 1.6 + 0.6) * 0.06 * live : 0;
    if (legL.current) legL.current.rotation.x = dangle;
    if (legR.current) legR.current.rotation.x = dangle * 0.7;
    if (root.current) {
      const ek = enter === "none" ? 1 : motion.reduced ? Math.min(1, age / 0.3) : backOut(age / 0.75);
      const off = 1 - ek;
      const d = 2.2;
      root.current.position.set(enter === "left" ? -d * off : enter === "right" ? d * off : 0, enter === "top" ? d * off : enter === "bottom" ? -d * off : 0, 0);
      const pop = g === "pop" && active ? backOut(gp) : 1;
      const sc = enter !== "none" && motion.reduced ? Math.min(1, age / 0.3) : pop;
      root.current.scale.setScalar(Math.max(0.001, sc));
    }
    if (blob.current) {
      blob.current.visible = shadow;
      (blob.current.material as THREE.MeshBasicMaterial).opacity = 0.7 - bob * 3;
    }

    // ---- chest lights blink in turn; the antenna wobbles a little ----
    chest.current?.children.forEach((m, i) => {
      const on = live ? (Math.floor(t * 2.2 + i * 0.7) % 3 === i ? 1 : 0.45) : 1;
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = on;
    });
    if (antenna.current) antenna.current.rotation.z = -0.25 + Math.sin(t * 2.4) * 0.12 * live + (mouth.speaking ? Math.sin(t * 14) * 0.05 * live : 0);

    // ---- thruster puffs (deterministic): more while entering or flying ----
    if (puffs.current) {
      const burst = enter !== "none" && age < 1.2 ? 1 : 0;
      puffs.current.visible = float && !motion.reduced;
      puffs.current.children.forEach((p, i) => {
        const life = 0.9;
        const ph = (t * (1 + burst) + i * 0.137 * life) % life;
        const k2 = ph / life;
        const side = i % 2 ? 1 : -1;
        p.position.set(side * 0.05 + Math.sin(i * 3.1) * 0.02 * k2, 0.22 - k2 * 0.22, -0.17 - k2 * 0.05);
        p.scale.setScalar((0.018 + k2 * 0.03) * (0.5 + burst * 0.5));
        ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k2) * 0.55;
      });
    }
  });

  const suit = toon(SUIT, { grain: 0.7, grainScale: 9 });
  const accent = toon(ACCENT, { grain: 0.5, grainScale: 9 });
  const glove = toon(GLOVE, { grain: 0.4, grainScale: 9 });
  const pack = toon(PACK, { grain: 0.4 });
  const boot = toon(ACCENT, { grain: 0.9, grainScale: 5 });
  const seam = toon(BELT, { paint: 0.3 });
  const glowBoot = toon(GLOVE, { grain: 0.9, grainScale: 5 });
  const puffMats = useMemo(() => Array.from({ length: 10 }, () => puffMat.clone()), [puffMat]);

  return (
    <group ref={root} name="nova">
      <mesh ref={blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} userData={{ noOutline: true }}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} opacity={0.7} />
      </mesh>
      <group ref={body}>
        {/* legs + boots */}
        {[
          [legL, 0.065],
          [legR, -0.065],
        ].map(([ref, x], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.21, 0]}>
            <mesh material={suit} position={[0, -0.07, 0]}>
              <capsuleGeometry args={[0.056, 0.05, 6, 12]} />
            </mesh>
            <RoundedBox args={[0.13, 0.09, 0.17]} radius={0.04} smoothness={3} position={[0, -0.155, 0.02]} material={glowBoot} />
            <mesh material={boot} position={[0, -0.105, 0.0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.056, 0.014, 8, 18]} />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh material={suit} position={[0, 0.355, 0]} scale={[1.1, 1.02, 0.95]}>
          <capsuleGeometry args={[0.142, 0.12, 8, 18]} />
        </mesh>
        {/* belt seam + chest panel + star badge */}
        <mesh material={seam} position={[0, 0.265, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.06, 0.92, 1]}>
          <torusGeometry args={[0.139, 0.02, 8, 28]} />
        </mesh>
        <RoundedBox args={[0.13, 0.085, 0.03]} radius={0.014} smoothness={2} position={[0, 0.35, 0.122]} material={accent} />
        <group ref={chest}>
          {[-0.035, 0, 0.035].map((bx, i) => (
            <mesh key={i} position={[bx, 0.35, 0.139]} userData={{ noOutline: true }}>
              <circleGeometry args={[0.012, 12]} />
              <meshBasicMaterial color={["#7FF0C8", "#FFE27A", "#FF8A7A"][i]} transparent toneMapped={false} />
            </mesh>
          ))}
        </group>
        <Star position={[-0.06, 0.45, 0.112]} />
        <Star position={[0, 0.262, 0.13]} scale={0.6} />
        {/* backpack + thrusters */}
        <RoundedBox args={[0.2, 0.22, 0.1]} radius={0.04} smoothness={3} position={[0, 0.38, -0.15]} material={pack} />
        <RoundedBox args={[0.21, 0.04, 0.104]} radius={0.015} smoothness={2} position={[0, 0.43, -0.15]} material={accent} />
        {[-1, 1].map((fx) => (
          <mesh key={fx} position={[fx * 0.115, 0.3, -0.16]} rotation={[0, 0, fx * -0.5]} material={toon("#FF8A6B")}>
            <boxGeometry args={[0.05, 0.08, 0.02]} />
          </mesh>
        ))}
        {[-0.05, 0.05].map((tx) => (
          <group key={tx} position={[tx, 0.255, -0.165]}>
            <mesh material={toon("#A9A2B8")}>
              <cylinderGeometry args={[0.022, 0.03, 0.05, 12]} />
            </mesh>
            <mesh position={[0, -0.027, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow("#FFC58A", 1.6)} userData={{ noOutline: true }}>
              <circleGeometry args={[0.019, 12]} />
            </mesh>
          </group>
        ))}
        <group ref={puffs} userData={{ noOutline: true }}>
          {puffMats.map((m, i) => (
            <mesh key={i} material={m}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          ))}
        </group>
        {/* arms: shoulder pivots, cuffs, chunky gloves with a thumb */}
        {[
          [armL, 0.155, 1],
          [armR, -0.155, -1],
        ].map(([ref, x, side], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.47, 0]}>
            <mesh material={suit} position={[0, -0.085, 0]}>
              <capsuleGeometry args={[0.048, 0.1, 6, 12]} />
            </mesh>
            <mesh material={accent} position={[0, -0.165, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.046, 0.016, 8, 18]} />
            </mesh>
            <mesh material={glove} position={[0, -0.215, 0.005]} scale={[1, 0.95, 0.85]}>
              <sphereGeometry args={[0.058, 16, 12]} />
            </mesh>
            <mesh material={glove} position={[(side as number) * -0.045, -0.2, 0.03]} rotation={[0.3, 0, (side as number) * 0.6]}>
              <capsuleGeometry args={[0.02, 0.035, 4, 8]} />
            </mesh>
          </group>
        ))}
        {/* neck ring */}
        <mesh material={accent} position={[0, 0.555, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.118, 0.028, 10, 28]} />
        </mesh>
        {/* head: helmet shell, face inside the visor, glass with a soft shine */}
        <group ref={head} position={[0, 0.56, 0]}>
          <group position={[0, R * 0.98, 0]}>
            <mesh material={suit}>
              <sphereGeometry args={[R, 36, 24]} />
            </mesh>
            <mesh geometry={capG} material={faceMat} userData={{ noOutline: true }} />
            <mesh position={[0, 0, ringZ * 1.02]} material={accent}>
              <torusGeometry args={[ring * 1.02, 0.014, 8, 40]} />
            </mesh>
            <mesh geometry={visorG} material={visorMat} userData={{ noOutline: true }} />
            {/* v7.1: a glossy glass-bubble rim light around the whole helmet */}
            <mesh material={rimGlass} scale={1.075} userData={{ noOutline: true }} renderOrder={4}>
              <sphereGeometry args={[R, 36, 24]} />
            </mesh>
            <mesh position={[0.075, -0.06, R * 0.99]} rotation={[0, 0.3, -2.4]} material={shine} userData={{ noOutline: true }}>
              <torusGeometry args={[0.05, 0.005, 4, 14, 0.9]} />
            </mesh>
            <mesh position={[-0.07, 0.075, R * 0.98]} rotation={[0, -0.35, 0.6]} material={shine} userData={{ noOutline: true }}>
              <torusGeometry args={[0.07, 0.007, 4, 18, 1.1]} />
            </mesh>
            {/* ear pods with glowing rims */}
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * R * 0.97, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <mesh material={accent} scale={[1, 0.8, 1]}>
                  <sphereGeometry args={[0.062, 18, 14]} />
                </mesh>
                <mesh position={[0, sx * -0.021, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
                  <ringGeometry args={[0.024, 0.036, 18]} />
                  <meshBasicMaterial color="#FFE3F1" toneMapped={false} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
            {/* a big pink bow on top of the helmet */}
            <group position={[-0.08, R * 0.92, 0.05]} rotation={[0.2, 0, 0.35]}>
              {[-1, 1].map((bx) => (
                <mesh key={bx} material={accent} position={[bx * 0.042, 0, 0]} rotation={[0, 0, bx * -0.5]} scale={[1.25, 0.8, 0.55]}>
                  <sphereGeometry args={[0.04, 14, 10]} />
                </mesh>
              ))}
              <mesh material={toon("#FF6FA8")}>
                <sphereGeometry args={[0.018, 10, 8]} />
              </mesh>
            </group>
            {/* antenna with a glowing star bulb */}
            <group ref={antenna} position={[0.06, R * 0.94, -0.02]} rotation={[0, 0, -0.25]}>
              <mesh material={toon("#A9A2B8")} position={[0, 0.045, 0]}>
                <cylinderGeometry args={[0.008, 0.01, 0.09, 8]} />
              </mesh>
              <mesh position={[0, 0.105, 0]} rotation={[0, 0, 0]} material={glow("#FFD23F", 1.3)} userData={{ noOutline: true }}>
                <StarGeo r={0.036} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** our own five-point star badge (no agency insignia) */
/** a small five-point star geometry (the glowing antenna tip) */
function StarGeo({ r }: { r: number }) {
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: r * 0.4, bevelEnabled: true, bevelSize: r * 0.12, bevelThickness: r * 0.12, bevelSegments: 2 });
    g.center();
    return g;
  }, [r]);
  return <primitive object={geo} attach="geometry" />;
}

function Star({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.016 : 0.036;
      const px = Math.cos(a) * r,
        py = Math.sin(a) * r;
      if (i) s.lineTo(px, py);
      else s.moveTo(px, py);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
  }, []);
  return <mesh geometry={geo} position={position} scale={scale} material={toon(LOOK.butter, { paint: 0.4 })} />;
}
