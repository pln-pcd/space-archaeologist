// The adult figure (bible §3 "Echo Ranger"; also the real Apollo astronauts): adult proportions, about 6.4 heads tall, low-poly
// faceted and ramp-shaded. Indoors: a bone flight suit with accent panels, a terracotta shoulder
// patch and no helmet. On the Moon and Mars (`eva`): an EVA suit with a correctly sized helmet,
// a gold visor (#A8936A) and a backpack. The suit colour option changes only the accent panels
// (HSL saturation 0.4, lightness 0.3). No cartoon face, no squash and stretch, no glow.
// Animations: idle (breathing), walk, run, air, sit, bored (looking up at the dome), plus the
// short emotes the story uses (wave, hop, thumbs, think, wake, interact).
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { StateBlend, damp, hump, idle, life } from "../anim/kit";
import { PAL, type SuitStyle } from "../style/palette";
import { blobTexture } from "../style/toon";
import { rampMaterial } from "../fx/ramp";

export type Emote = "wave" | "hop" | "thumbs" | "think" | "wake" | "interact";
export const EMOTE_LEN: Record<Emote, number> = { wave: 1.6, hop: 0.7, thumbs: 1.3, think: 2.0, wake: 1.4, interact: 0.45 };

/** What the scene tells a character each frame. */
export type Driver = {
  /** 0..1 walking amount (from movement). */
  walk: number;
  /** true while running (faster cycle, more lean). */
  run: boolean;
  sitting: boolean;
  /** floating companion: gentle hover */
  float: boolean;
  emote: Emote | null;
  emoteT: number;
  /** world point to glance at (optional). */
  look: THREE.Vector3 | null;
  /** head turn toward something interesting, radians relative to the body (set by the scene) */
  lookYaw?: number;
  /** free roam, no input for ~60 s: looks up at the dome for a while */
  bored?: boolean;
  /** in the air (hop): 0..1 */
  air?: number;
  /** called on each foot contact while walking, with the walk amount 0..1 */
  onStep?: (walk: number) => void;
};
export const newDriver = (float = false): Driver => ({ walk: 0, run: false, sitting: false, float, emote: null, emoteT: 0, look: null });
export function playEmote(d: Driver, e: Emote) {
  d.emote = e;
  d.emoteT = 0;
}

type Pose = {
  bob: number;
  lean: number;
  legL: number;
  legR: number;
  kneeL: number;
  kneeR: number;
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  elbL: number;
  elbR: number;
  headX: number;
  headY: number;
  headZ: number;
  lift: number;
};
const ZERO: Pose = { bob: 0, lean: 0, legL: 0, legR: 0, kneeL: 0, kneeR: 0, armLx: 0, armLz: 0, armRx: 0, armRz: 0, elbL: 0, elbR: 0, headX: 0, headY: 0, headZ: 0, lift: 0 };
const add = (a: Pose, b: Partial<Pose>, w: number) => {
  for (const k in b) a[k as keyof Pose] += (b[k as keyof Pose] ?? 0) * w;
  return a;
};

/** faceted ramp material for characters (never dithered near the camera) */
const C = (color: string) => rampMaterial(color, { character: true, flat: true });
const accent = (color: string) => {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  return rampMaterial(color, { character: true, flat: true, suitHue: hsl.h });
};

/** a tapered limb segment hanging down from its pivot */
function Limb({ len, r0, r1, mat }: { len: number; r0: number; r1: number; mat: THREE.Material }) {
  return (
    <mesh position={[0, -len / 2, 0]} material={mat} castShadow>
      <cylinderGeometry args={[r0, r1, len, 6]} />
    </mesh>
  );
}

/** Body measures (metres-ish; total ≈ 1.8, head ≈ 0.28 → ≈ 6.4 heads). */
const HIP = 0.92;
const THIGH = 0.42;
const SHIN = 0.42;
const UPPER = 0.29;
const FORE = 0.26;

export function ChubbyAstronaut({ suit, driver, seed = 0, scale = 1, eva = false, apollo = false }: { suit: SuitStyle; driver: MutableRefObject<Driver>; seed?: number; face?: boolean; scale?: number; eva?: boolean; apollo?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbL = useRef<THREE.Group>(null);
  const elbR = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const st = useMemo(() => ({ blend: new StateBlend<"idle" | "walk" | "run" | "sit" | "float">(driver.current.float ? "float" : "idle"), phase: Math.random() * 6.28, look: 0, air: 0, bored: 0, pose: { ...ZERO } }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const suitMat = C(eva ? PAL.boneLight : PAL.bone);
  // Apollo astronauts (Chapter 1 story): an all-white suit, no colour accents, visor always down
  const acc = apollo ? C(PAL.ribsLight) : accent(suit.color);
  const graphite = C(PAL.graphite);
  const skin = C("#B08468");
  const hair = C("#3A3836");
  const terra = apollo ? C(PAL.ribsLight) : C(PAL.terra);
  const visor = C(PAL.brassTrim);
  // EVA suits are bulkier: thicker limbs and torso, bigger boots
  const k = eva ? 1.28 : 1;

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const d = driver.current;
    const t = s.clock.elapsedTime;
    const L = life();
    const moving = d.walk > 0.15;
    st.blend.set(d.sitting ? "sit" : d.float ? "float" : moving ? (d.run ? "run" : "walk") : "idle");
    const w = st.blend.step(dt);
    const cadence = d.run ? 10.5 : 7.2;
    const prevPh = st.phase;
    st.phase += dt * cadence * Math.max(0.35, d.walk);
    // a foot touches down each time the cycle crosses a half turn
    if (d.onStep && moving && !d.air && Math.floor(st.phase / Math.PI) !== Math.floor(prevPh / Math.PI)) d.onStep(d.walk);
    const ph = st.phase;
    const id = idle(t, seed);
    const sw = Math.sin(ph);
    // knees bend while the leg swings forward
    const kn = (a: number) => Math.max(0, Math.sin(a + 0.6));

    const p: Pose = { ...ZERO };
    // idle: breathing and a slow weight shift
    add(p, { bob: id.breathe * 0.008, armLz: 0.07, armRz: -0.07, elbL: -0.12, elbR: -0.12, headY: id.glance * 0.6, headX: Math.sin(t * 0.4 + seed) * 0.03 * L }, w.idle ?? 0);
    add(p, { bob: Math.abs(Math.cos(ph)) * 0.025, lean: 0.05, legL: sw * 0.45, legR: -sw * 0.45, kneeL: kn(ph) * 0.55, kneeR: kn(ph + Math.PI) * 0.55, armLx: -sw * 0.42, armRx: sw * 0.42, armLz: 0.06, armRz: -0.06, elbL: -0.25, elbR: -0.25 }, w.walk ?? 0);
    add(p, { bob: Math.abs(Math.cos(ph)) * 0.05, lean: 0.16, legL: sw * 0.75, legR: -sw * 0.75, kneeL: kn(ph) * 1.0, kneeR: kn(ph + Math.PI) * 1.0, armLx: -sw * 0.75, armRx: sw * 0.75, armLz: 0.08, armRz: -0.08, elbL: -1.0, elbR: -1.0, headX: -0.06 }, w.run ?? 0);
    add(p, { bob: -0.44, legL: -1.5, legR: -1.45, kneeL: 1.5, kneeR: 1.45, armLx: -0.55, armRx: -0.55, armLz: 0.1, armRz: -0.1, elbL: -0.6, elbR: -0.6, headY: id.glance * 0.4 }, w.sit ?? 0);
    add(p, { bob: Math.sin(t * 1.6 + seed) * 0.03 * L, legL: 0.1, legR: 0.05, kneeL: 0.2, kneeR: 0.15, armLz: 0.15, armRz: -0.15 }, w.float ?? 0);
    // air (hop): knees up a little, arms out for balance
    st.air += ((d.air ?? 0) - st.air) * (1 - Math.pow(0.9, dt * 60));
    add(p, { legL: -0.35, legR: -0.2, kneeL: 0.6, kneeR: 0.4, armLz: 0.5, armRz: -0.5 }, st.air);
    // bored: looks up at the dome, weight on one leg (bible §3)
    st.bored += ((d.bored ? 1 : 0) - st.bored) * (1 - Math.pow(0.95, dt * 60));
    add(p, { headX: -0.55, lean: -0.04, armLx: 0.15, armRx: 0.15, kneeR: 0.12 }, st.bored * (w.idle ?? 0));

    // look at nearby interesting things, damped so the head never snaps
    st.look = damp(st.look, Math.max(-0.9, Math.min(0.9, d.lookYaw ?? 0)), 5, dt);
    p.headY += st.look * (1 - (w.walk ?? 0) * 0.5);

    // emotes (layered on top, blended in/out)
    if (d.emote) {
      d.emoteT += dt;
      const len = EMOTE_LEN[d.emote];
      const q = d.emoteT / len;
      const ew = Math.min(1, d.emoteT / 0.2, (len - d.emoteT) / 0.2);
      const e: Pose = { ...ZERO };
      if (d.emote === "wave") {
        e.armRz = -2.6;
        e.elbR = -0.3 + Math.sin(d.emoteT * 9) * 0.35;
      } else if (d.emote === "hop") {
        e.lift = hump(q) * 0.35;
        e.kneeL = e.kneeR = 0.5 * hump(q);
        e.armLz = 0.5;
        e.armRz = -0.5;
      } else if (d.emote === "thumbs") {
        e.armRx = -1.3;
        e.elbR = -0.9;
      } else if (d.emote === "think") {
        e.armRx = -0.9;
        e.elbR = -2.1;
        e.headZ = 0.1;
        e.headX = 0.08;
      } else if (d.emote === "wake") {
        e.armLz = 1.4 * hump(Math.min(1, q * 1.4));
        e.armRz = -1.4 * hump(Math.min(1, q * 1.4));
        e.headX = -0.15 * hump(q);
      } else if (d.emote === "interact") {
        e.armRx = -1.2 * hump(q);
        e.elbR = -0.3 * hump(q);
        e.lean = 0.06 * hump(q);
      }
      p.armRx = THREE.MathUtils.lerp(p.armRx, e.armRx, ew);
      if (e.armRz) p.armRz = THREE.MathUtils.lerp(p.armRz, e.armRz, ew);
      if (e.armLz) p.armLz = THREE.MathUtils.lerp(p.armLz, e.armLz, ew);
      if (e.elbR) p.elbR = THREE.MathUtils.lerp(p.elbR, e.elbR, ew);
      p.lift += e.lift;
      p.kneeL += e.kneeL * ew;
      p.kneeR += e.kneeR * ew;
      p.headX += e.headX * ew;
      p.headZ += e.headZ * ew;
      p.lean += e.lean * ew;
      if (d.emoteT >= len) d.emote = null;
    }

    // smooth everything so state changes never pop
    const q = st.pose;
    for (const key in q) q[key as keyof Pose] = damp(q[key as keyof Pose], p[key as keyof Pose], 16, dt);
    if (body.current) {
      body.current.position.y = q.bob + q.lift;
      body.current.rotation.x = q.lean;
    }
    legL.current?.rotation.set(q.legL, 0, 0.02);
    legR.current?.rotation.set(q.legR, 0, -0.02);
    kneeL.current?.rotation.set(q.kneeL, 0, 0);
    kneeR.current?.rotation.set(q.kneeR, 0, 0);
    armL.current?.rotation.set(q.armLx, 0, q.armLz);
    armR.current?.rotation.set(q.armRx, 0, q.armRz);
    elbL.current?.rotation.set(q.elbL, 0, 0);
    elbR.current?.rotation.set(q.elbR, 0, 0);
    head.current?.rotation.set(q.headX, q.headY, q.headZ);
    if (shadow.current) shadow.current.scale.setScalar(1 - Math.min(0.5, q.lift));
  });

  const leg = (side: number, hip: MutableRefObject<THREE.Group | null>, knee: MutableRefObject<THREE.Group | null>) => (
    <group ref={hip} position={[side * 0.1 * (eva ? 1.1 : 1), HIP, 0]}>
      <Limb len={THIGH} r0={0.085 * k} r1={0.068 * k} mat={suitMat} />
      <group ref={knee} position={[0, -THIGH, 0]}>
        {/* knee pad: accent panel */}
        <mesh position={[0, 0, 0.06 * k]} material={acc}>
          <boxGeometry args={[0.1 * k, 0.1, 0.03]} />
        </mesh>
        <Limb len={SHIN} r0={0.064 * k} r1={0.052 * k} mat={suitMat} />
        {/* boot */}
        <mesh position={[0, -SHIN + 0.02, 0.04]} material={graphite} castShadow>
          <boxGeometry args={[0.12 * k, eva ? 0.14 : 0.1, 0.27 * (eva ? 1.1 : 1)]} />
        </mesh>
      </group>
    </group>
  );
  const arm = (side: number, sh: MutableRefObject<THREE.Group | null>, el: MutableRefObject<THREE.Group | null>) => (
    <group ref={sh} position={[side * 0.215 * (eva ? 1.12 : 1), 1.43, 0]}>
      <Limb len={UPPER} r0={0.055 * k} r1={0.047 * k} mat={suitMat} />
      {/* shoulder accent; the left one carries the terracotta patch */}
      <mesh position={[side * 0.012, -0.05, 0]} material={side < 0 ? terra : acc}>
        <boxGeometry args={[0.105 * k, 0.07, 0.1 * k]} />
      </mesh>
      <group ref={el} position={[0, -UPPER, 0]}>
        <Limb len={FORE} r0={0.046 * k} r1={0.04 * k} mat={suitMat} />
        <mesh position={[0, -FORE + 0.02, 0]} material={graphite}>
          <cylinderGeometry args={[0.048 * k, 0.048 * k, 0.04, 6]} />
        </mesh>
        {/* hand (skin indoors, bone gloves on EVA) */}
        <mesh position={[0, -FORE - 0.06, 0.005]} material={eva ? C(PAL.bone) : skin} castShadow>
          <boxGeometry args={[0.065 * k, 0.11, 0.035 * k]} />
        </mesh>
      </group>
    </group>
  );

  return (
    <group scale={scale}>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={blobTexture()} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {leg(-1, legL, kneeL)}
        {leg(1, legR, kneeR)}
        {/* pelvis, belt, abdomen, chest */}
        <mesh position={[0, 0.97, 0]} material={suitMat} castShadow>
          <boxGeometry args={[0.3 * (eva ? 1.15 : 1), 0.16, 0.19 * (eva ? 1.15 : 1)]} />
        </mesh>
        <mesh position={[0, 1.05, 0]} material={graphite}>
          <boxGeometry args={[0.31 * (eva ? 1.15 : 1), 0.04, 0.2 * (eva ? 1.15 : 1)]} />
        </mesh>
        <mesh position={[0, 1.15, 0]} material={suitMat} castShadow>
          <boxGeometry args={[0.28 * (eva ? 1.15 : 1), 0.18, 0.18 * (eva ? 1.15 : 1)]} />
        </mesh>
        <mesh position={[0, 1.34, 0]} material={suitMat} castShadow>
          <boxGeometry args={[0.37 * (eva ? 1.15 : 1), 0.26, 0.21 * (eva ? 1.2 : 1)]} />
        </mesh>
        {/* shoulder yoke: accent panel */}
        <mesh position={[0, 1.45, 0]} material={acc}>
          <boxGeometry args={[0.38 * (eva ? 1.15 : 1), 0.06, 0.22 * (eva ? 1.2 : 1)]} />
        </mesh>
        {/* side panels: accent */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.185 * (eva ? 1.15 : 1), 1.3, 0]} material={acc}>
            <boxGeometry args={[0.012, 0.2, 0.15]} />
          </mesh>
        ))}
        {eva ? (
          <>
            {/* chest control box and backpack (life support) */}
            <mesh position={[0, 1.3, 0.13]} material={C(PAL.slate)}>
              <boxGeometry args={[0.2, 0.12, 0.06]} />
            </mesh>
            <mesh position={[0, 1.28, -0.22]} material={suitMat} castShadow>
              <boxGeometry args={[0.4, 0.52, 0.2]} />
            </mesh>
            <mesh position={[0, 1.56, -0.22]} material={graphite}>
              <boxGeometry args={[0.36, 0.05, 0.18]} />
            </mesh>
          </>
        ) : (
          <mesh position={[0.1, 1.38, 0.108]} material={C(PAL.slate)}>
            <boxGeometry args={[0.08, 0.05, 0.01]} />
          </mesh>
        )}
        {arm(-1, armL, elbL)}
        {arm(1, armR, elbR)}
        {/* neck and head */}
        <mesh position={[0, 1.51, 0]} material={eva ? graphite : skin}>
          <cylinderGeometry args={[0.048, 0.052, 0.08, 6]} />
        </mesh>
        <group ref={head} position={[0, 1.665, 0]}>
          {eva ? (
            <>
              {/* helmet: bone shell, gold visor, graphite neck ring */}
              <mesh material={C(PAL.boneLight)} castShadow>
                <icosahedronGeometry args={[0.185, 2]} />
              </mesh>
              {/* the visor faces forward (+z) and sits just outside the shell, so it always shows */}
              <mesh position={[0, -0.005, 0.012]} material={visor}>
                <sphereGeometry args={[0.19, 16, 10, Math.PI / 2 - 1.05, 2.1, 0.95, 1.05]} />
              </mesh>
              <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={graphite}>
                <torusGeometry args={[0.12, 0.025, 4, 12]} />
              </mesh>
            </>
          ) : (
            <>
              <mesh scale={[0.095, 0.14, 0.11]} material={skin} castShadow>
                <icosahedronGeometry args={[1, 1]} />
              </mesh>
              {/* short hair cap, set back so the face stays plain */}
              <mesh position={[0, 0.045, -0.018]} scale={[0.1, 0.1, 0.112]} material={hair}>
                <icosahedronGeometry args={[1, 1]} />
              </mesh>
            </>
          )}
        </group>
      </group>
    </group>
  );
}

/** Same explorer, clearer name for new code. */
export const Explorer = ChubbyAstronaut;
