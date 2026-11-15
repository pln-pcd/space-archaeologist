// Scenes D and E (bible §8): first steps and the story, at Tranquility Base.
// D: Eagle's hatch opens, an astronaut backs out, climbs down the ladder and pauses on the
//    footpad; the real NASA audio "That's one small step…"; a boot print; Aldrin follows; the
//    camera rises to frame both, Eagle and Earth.
// E: short animated shots with a calm narrator (pre-rendered voice) and the same line in the
//    bottom card. Respectful: visors down, no faces, no made-up astronaut dialogue.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { newDriver } from "../../ship/Chubby";
import { Caption, Controls, FactCard, useSequence, type Clock, type Step } from "./ui";
import { Apollonaut, BootPrint, Columbia, Eagle, Earth, Flag, LADDER, MoonGround, MoonSphere, Reflector, RockBoxModel, Seismometer, SolarWindSheet, newEagle } from "./props";
import { SkySphere, Stage, StillStars, newCam, type CamCtl, type Shot } from "./stage";
import { beat } from "./flow";
import { motion } from "../../anim/kit";

/* ---------------- poses ---------------- */
const A_SPOT = new THREE.Vector3(-1.4, 0, 4.6); // Armstrong
const B_SPOT = new THREE.Vector3(1.6, 0, 4.9); // Aldrin
const FLAG = new THREE.Vector3(-3.2, 0, 3.6);
const SEIS = new THREE.Vector3(-3.4, 0, 6.6);
const REFL = new THREE.Vector3(3.2, 0, 6.2);
const SWC = new THREE.Vector3(0.6, 0, 7.4);
const BOX = new THREE.Vector3(2.4, 0, 3.6);
const PRINTS: [number, number, number, number][] = Array.from({ length: 14 }, (_, i) => [-0.4 + (i % 2) * 0.24 - i * 0.12, 0.012, 3.3 + i * 0.36, 0.2]);

/** where an astronaut climbing the ladder is, k = 0 porch .. 1 footpad */
const ladderAt = (k: number) => {
  if (k < 0.15) return LADDER.porch.clone().lerp(LADDER.top.clone().add(new THREE.Vector3(0, 0.1, 0.12)), k / 0.15);
  return LADDER.top.clone().add(new THREE.Vector3(0, 0.1, 0.12)).lerp(LADDER.pad.clone().add(new THREE.Vector3(0, 0, 0.1)), (k - 0.15) / 0.85);
};

type ShotDef = { a: Shot; b: Shot; dur: number; group: "moon" | "space" | "ocean" };
const SHOT: Record<string, ShotDef> = {
  // D
  hatch: { a: { pos: [4.6, 3.3, 9.6], look: [0, 2.6, 1.2] }, b: { pos: [3.8, 3.1, 8.6], look: [0, 2.5, 1.4] }, dur: 5, group: "moon" },
  ladder: { a: { pos: [5.2, 2.7, 9.6], look: [0, 1.7, 2.2] }, b: { pos: [4.4, 1.8, 9.0], look: [0, 0.9, 2.8] }, dur: 7, group: "moon" },
  smallstep: { a: { pos: [3.8, 1.3, 8.6], look: [0, 0.75, 3.3] }, b: { pos: [3.2, 1.15, 7.9], look: [0, 0.7, 3.4] }, dur: 8, group: "moon" },
  bootprint: { a: { pos: [1.35, 1.7, 5.5], look: [-0.1, 0.1, 3.85] }, b: { pos: [1.05, 1.35, 5.1], look: [-0.05, 0.08, 3.88] }, dur: 4, group: "moon" },
  aldrin: { a: { pos: [4.6, 2.8, 9.8], look: [0, 1.6, 2.4] }, b: { pos: [5.0, 2.4, 10.4], look: [0, 1.4, 2.8] }, dur: 6, group: "moon" },
  rise: { a: { pos: [5.0, 2.4, 10.4], look: [0, 1.4, 2.8] }, b: { pos: [2, 6.5, 15], look: [-2, 4, -8] }, dur: 6, group: "moon" },
  // E
  wide: { a: { pos: [8, 3.2, 14], look: [0, 2, 0] }, b: { pos: [6, 4.5, 15], look: [-2, 4, -6] }, dur: 7, group: "moon" },
  armstrong: { a: { pos: [-1.2, 1.7, 8], look: [-1.4, 1.2, 4.6] }, b: { pos: [-0.2, 1.5, 7.4], look: [-1.4, 1.2, 4.6] }, dur: 6, group: "moon" },
  bounce: { a: { pos: [0, 2.2, 11], look: [0, 1, 5] }, b: { pos: [-2, 2, 11], look: [-1, 1, 6] }, dur: 7, group: "moon" },
  prints: { a: { pos: [1.9, 2.0, 9.4], look: [-0.8, 0.1, 5.4] }, b: { pos: [1.3, 1.7, 8.8], look: [-0.9, 0.1, 5.0] }, dur: 6, group: "moon" },
  columbia: { a: { pos: [0, 4, 16], look: [0, 0, 0] }, b: { pos: [-4, 3, 14], look: [0, -1, 0] }, dur: 9, group: "space" },
  flag: { a: { pos: [-0.2, 1.9, 8.4], look: [-2.6, 1.1, 3.6] }, b: { pos: [-0.8, 1.7, 7.8], look: [-2.8, 1.1, 3.6] }, dur: 6, group: "moon" },
  rocks: { a: { pos: [5.4, 1.9, 7.6], look: [2.4, 0.6, 3.4] }, b: { pos: [4.8, 1.6, 7.0], look: [2.4, 0.5, 3.4] }, dur: 6, group: "moon" },
  seismometer: { a: { pos: [-1.2, 1.9, 9.8], look: [-3.2, 0.4, 6.4] }, b: { pos: [-1.7, 1.6, 9.2], look: [-3.3, 0.4, 6.4] }, dur: 6, group: "moon" },
  reflector: { a: { pos: [4.7, 1.35, 8.3], look: [3.1, 0.3, 6.1] }, b: { pos: [4.3, 1.15, 7.8], look: [3.15, 0.28, 6.15] }, dur: 6, group: "moon" },
  solarwind: { a: { pos: [2.4, 1.4, 9.6], look: [0.6, 1.1, 7.4] }, b: { pos: [1.8, 1.3, 9.2], look: [0.6, 1.1, 7.4] }, dur: 6, group: "moon" },
  plaque: { a: { pos: [0.35, 2.35, 3.45], look: [0, 1.24, 2.2] }, b: { pos: [0.12, 2.05, 3.05], look: [0, 1.22, 2.21] }, dur: 8, group: "moon" },
  ladderup: { a: { pos: [5.0, 2.5, 9.8], look: [0, 1.6, 2.4] }, b: { pos: [5.6, 2.9, 10.6], look: [0, 1.9, 1.8] }, dur: 8, group: "moon" },
  ascent: { a: { pos: [8, 2.6, 13], look: [0, 3, 0], fov: 50 }, b: { pos: [8.5, 3.2, 14], look: [0, 5, 0], fov: 52 }, dur: 8, group: "moon" },
  home: { a: { pos: [0, 2, 10], look: [0, 0, 0] }, b: { pos: [2, 1, 6], look: [0, 0, 0] }, dur: 7, group: "space" },
  splash: { a: { pos: [0, 3.2, 16], look: [0, 3.6, 0] }, b: { pos: [2.5, 1.8, 12.5], look: [0, 1.6, 0] }, dur: 7, group: "ocean" },
  today: { a: { pos: [9, 2.4, 13], look: [0, 1.6, 2] }, b: { pos: [7, 3.6, 14], look: [-3, 5, -6] }, dur: 8, group: "moon" },
};

type ShotState = { id: string; t: number; index: number };
function TranquilityBase({ shot, cam }: { shot: React.MutableRefObject<ShotState>; cam: React.MutableRefObject<CamCtl> }) {
  const order = useMemo(() => ["hatch", "ladder", "smallstep", "bootprint", "aldrin", "rise", "wide", "armstrong", "bounce", "prints", "columbia", "flag", "rocks", "seismometer", "reflector", "solarwind", "plaque", "ladderup", "ascent", "home", "splash", "today"], []);
  const after = (name: string) => order.indexOf(shot.current.id) >= order.indexOf(name);
  const eagle = useRef(newEagle());
  const dA = useRef(newDriver(false));
  const dB = useRef(newDriver(false));
  const gA = useRef<THREE.Group>(null);
  const gB = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Group>(null);
  const space = useRef<THREE.Group>(null);
  const ocean = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const flag = useRef<THREE.Group>(null);
  const seis = useRef<THREE.Group>(null);
  const refl = useRef<THREE.Group>(null);
  const swc = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const prints = useRef<THREE.Group>(null);
  const col = useRef<THREE.Group>(null);
  const asc = useRef<THREE.Group>(null);
  const capsule = useRef<THREE.Group>(null);
  const firstPrint = useRef(0);
  const ascCtl = useRef({ ...newEagle(), ascentOn: true });
  useFrame((_, dt) => {
    const s = shot.current;
    const def = SHOT[s.id] ?? SHOT.wide;
    const c = cam.current;
    c.from = def.a;
    c.to = def.b;
    c.k = Math.min(1, s.t / def.dur);
    if (moon.current) moon.current.visible = def.group === "moon";
    if (space.current) space.current.visible = def.group === "space";
    if (ocean.current) ocean.current.visible = def.group === "ocean";
    if (stars.current) stars.current.visible = def.group !== "ocean";
    const e = eagle.current;
    e.hatch = s.id === "hatch" ? Math.min(1, s.t / 1.5) : after("ascent") ? 0 : 1;
    e.ascentOn = !after("ascent") || s.id === "ascent";
    e.ascentY = s.id === "ascent" ? Math.min(9, Math.max(0, s.t - 1.8) ** 2 * 0.3) : 0;
    e.flame = s.id === "ascent" && s.t > 1.6 ? 1 : 0;
    const A = gA.current,
      B = gB.current;
    const out = after("ascent") ? false : true;
    if (A && B) {
      A.visible = out && s.id !== "hatch" ? true : s.id === "hatch" && s.t > 1.6;
      B.visible = out && (after("rise") || (s.id === "aldrin" && s.t > 0.5));
      dA.current.walk = 0;
      dB.current.walk = 0;
      dA.current.run = dB.current.run = false;
      // D: Armstrong backs out, climbs down, pauses on the footpad, steps off
      if (s.id === "hatch") {
        const k = Math.max(0, Math.min(1, (s.t - 1.6) / 2.5));
        A.position.copy(LADDER.porch).add(new THREE.Vector3(0, 0, -0.3 + k * 0.3));
        A.rotation.y = Math.PI;
      } else if (s.id === "ladder") {
        A.position.copy(ladderAt(Math.min(1, s.t / 6)));
        A.rotation.y = Math.PI;
      } else if (s.id === "smallstep") {
        const k = Math.max(0, Math.min(1, (s.t - 3) / 2.2));
        A.position.copy(LADDER.pad).add(new THREE.Vector3(0, 0, 0.1 + k * 0.7));
        A.position.y = LADDER.pad.y * (1 - k);
        A.rotation.y = k < 0.5 ? Math.PI : Math.PI + (k - 0.5) * 2 * Math.PI;
        dA.current.walk = k > 0 && k < 1 ? 0.3 : 0;
        if (k > 0.6) firstPrint.current = Math.min(1, firstPrint.current + dt * 1.5);
      } else if (s.id === "bootprint") {
        A.position.set(-0.62, 0, 3.75);
        A.rotation.y = -0.6;
        firstPrint.current = Math.min(1, firstPrint.current + dt);
      } else if (s.id === "aldrin" || s.id === "rise") {
        A.position.lerp(A_SPOT, 1 - Math.pow(0.02, dt));
        A.rotation.y = -0.3;
        if (s.id === "aldrin") {
          B.position.copy(ladderAt(Math.min(1, s.t / 5)));
          B.rotation.y = Math.PI;
        } else B.position.lerp(B_SPOT, 1 - Math.pow(0.05, dt));
      } else if (s.id === "bounce") {
        // slow bounces in 1/6 g (F19): high, floaty arcs
        const k = s.t;
        A.position.set(A_SPOT.x - k * 0.35, Math.abs(Math.sin(k * 1.4)) * 0.32, A_SPOT.z + Math.sin(k * 0.5) * 0.4);
        B.position.set(B_SPOT.x - k * 0.3, Math.abs(Math.sin(k * 1.4 + 1.2)) * 0.3, B_SPOT.z);
        A.rotation.y = B.rotation.y = -Math.PI / 2;
        dA.current.air = dB.current.air = 0.5;
      } else if (s.id === "ladderup") {
        A.position.copy(ladderAt(1 - Math.min(1, s.t / 3.5)));
        B.position.copy(s.t < 3.5 ? LADDER.pad.clone().add(new THREE.Vector3(0.75, -0.2, 0.45)) : ladderAt(1 - Math.min(1, (s.t - 3.5) / 3.5)));
        A.rotation.y = B.rotation.y = Math.PI;
        if (s.t > 3.5) A.visible = false;
        if (s.t > 7) B.visible = false;
      } else {
        const spots: Record<string, [THREE.Vector3, number, THREE.Vector3, number]> = {
          flag: [FLAG.clone().add(new THREE.Vector3(1.0, 0, -0.35)), -1.9, B_SPOT, -0.4],
          rocks: [A_SPOT, 0.2, BOX.clone().add(new THREE.Vector3(0.55, 0, -0.6)), -0.6],
          seismometer: [A_SPOT, 0.2, SEIS.clone().add(new THREE.Vector3(0.9, 0, -0.55)), -1.1],
          reflector: [REFL.clone().add(new THREE.Vector3(-1.7, 0, -0.4)), 1.2, B_SPOT.clone().add(new THREE.Vector3(-2.2, 0, -1.6)), 0.3],
          solarwind: [SWC.clone().add(new THREE.Vector3(-0.7, 0, 0.3)), 1.7, B_SPOT, 0.3],
        };
        const sp = spots[s.id] ?? [A_SPOT, -0.3, B_SPOT, -0.4];
        A.position.lerp(sp[0], 1 - Math.pow(0.05, dt));
        B.position.lerp(sp[2], 1 - Math.pow(0.05, dt));
        A.rotation.y = sp[1];
        B.rotation.y = sp[3];
        dA.current.air = dB.current.air = 0;
      }
    }
    if (flag.current) flag.current.visible = after("flag");
    if (seis.current) seis.current.visible = after("seismometer");
    if (refl.current) refl.current.visible = after("reflector");
    if (swc.current) swc.current.visible = after("solarwind") && !after("today");
    if (box.current) box.current.visible = after("rocks") && !after("ascent");
    if (prints.current) prints.current.visible = after("bounce");
    // space: Columbia circles above the Moon; later the ascent stage meets it
    if (col.current) {
      if (s.id === "columbia") col.current.position.set(Math.cos(s.t * 0.12) * 3, 2.2, Math.sin(s.t * 0.12) * 3 - 2);
      else col.current.position.set(0.9, 0, 0);
    }
    if (asc.current) {
      asc.current.visible = s.id === "home";
      asc.current.position.set(-2.6 + Math.min(1, s.t / 5) * 2.0, 0, 0);
    }
    if (capsule.current) {
      const k = Math.min(1, s.t / 6);
      capsule.current.position.y = 6 - k * 5.6;
    }
  });
  return (
    <>
      <group ref={stars}>
        <StillStars />
      </group>
      <group ref={moon}>
        <MoonGround />
        <Earth radius={2.4} position={[-26, 13, -62]} />
        <Eagle ctl={eagle} />
        <group ref={gA}>
          <Apollonaut driver={dA} seed={1} />
        </group>
        <group ref={gB} visible={false}>
          <Apollonaut driver={dB} seed={2} />
        </group>
        <BootPrint position={[0.05, 0.015, 3.95]} rotation={0.1} depth={firstPrint} />
        <group ref={prints} visible={false}>
          {PRINTS.map((p, i) => (
            <BootPrint key={i} position={[p[0], p[1], p[2]]} rotation={p[3]} />
          ))}
        </group>
        <group ref={flag} position={FLAG.toArray()} visible={false}>
          <Flag />
        </group>
        <group ref={seis} position={SEIS.toArray()} visible={false}>
          <Seismometer />
        </group>
        <group ref={refl} position={REFL.toArray()} rotation={[0, -0.5, 0]} visible={false}>
          <Reflector />
        </group>
        <group ref={swc} position={SWC.toArray()} visible={false}>
          <SolarWindSheet />
        </group>
        <group ref={box} position={BOX.toArray()} visible={false}>
          <RockBoxModel />
        </group>
      </group>
      <group ref={space} visible={false}>
        <MoonSphere radius={30} position={[0, -34, -8]} />
        <Earth radius={1.2} position={[-14, 7, -30]} />
        <group ref={col} scale={0.7}>
          <Columbia />
        </group>
        <group ref={asc} scale={0.3}>
          <mesh>
            <cylinderGeometry args={[1.05, 1.15, 1.1, 7]} />
            <meshLambertMaterial color="#B9B6B0" />
          </mesh>
        </group>
      </group>
      <group ref={ocean} visible={false}>
        <SkySphere top="#A9BAC4" bottom="#E6E0D4" radius={300} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[200, 32]} />
          <meshLambertMaterial color="#7D8F98" />
        </mesh>
        <group ref={capsule}>
          <mesh position={[0, 0, 0]}>
            <coneGeometry args={[0.6, 0.8, 16]} />
            <meshLambertMaterial color="#B9B6B0" />
          </mesh>
          {[-1, 0, 1].map((i) => (
            <group key={i} position={[i * 1.1, 2.6, 0]}>
              <mesh>
                <sphereGeometry args={[0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshLambertMaterial color={i === 0 ? "#ECE6DA" : "#B5674A"} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

/** keeps a running shot clock: time since the shot (not the line) started */
function useShotClock(clock: React.MutableRefObject<Clock>, steps: (Step & { shot: string })[]) {
  const shot = useRef<ShotState>({ id: steps[0].shot, t: 0, index: 0 });
  const last = useRef({ i: -1, t0: 0 });
  useFrame(() => {}); // placeholder so this hook is only used inside a Canvas child
  return { shot, last };
}

function ShotDriver({ clock, steps, shot }: { clock: React.MutableRefObject<Clock>; steps: (Step & { shot: string })[]; shot: React.MutableRefObject<ShotState> }) {
  const startTotal = useRef(0);
  const cur = useRef("");
  useFrame(() => {
    const c = clock.current;
    const id = steps[c.i]?.shot ?? steps[steps.length - 1].shot;
    if (id !== cur.current) {
      cur.current = id;
      startTotal.current = c.total - c.t;
    }
    shot.current.id = id;
    shot.current.t = c.total - startTotal.current;
    shot.current.index = c.i;
  });
  return null;
}

function MoonScene({ steps, onDone, skipLabel }: { steps: (Step & { shot: string })[]; onDone: () => void; skipLabel: string }) {
  const cam = useRef<CamCtl>(newCam(SHOT[steps[0].shot].a));
  const seq = useSequence(steps, onDone);
  const shot = useRef<ShotState>({ id: steps[0].shot, t: 0, index: 0 });
  void useShotClock;
  const s = seq.step as (Step & { shot: string }) | undefined;
  return (
    <div className="ch1-scene moon">
      <Stage look="moon" cam={cam} sky="#000000">
        <ShotDriver clock={seq.clock} steps={steps} shot={shot} />
        <TranquilityBase shot={shot} cam={cam} />
      </Stage>
      {s?.card && <FactCard id={s.card} />}
      {s?.shot === "seismometer" && (
        <div className="seis-screen mono" aria-hidden="true">
          <small className="caps">Seismometer</small>
          <svg viewBox="0 0 240 60" width="240" height="60">
            <path className="seis-line" d="M0 30 L30 30 L36 18 L42 40 L48 26 L54 32 L90 30 L96 22 L102 36 L108 30 L150 30 L156 12 L162 46 L168 24 L174 34 L180 30 L240 30" fill="none" stroke="#CFE6D8" strokeWidth="2" />
          </svg>
        </div>
      )}
      <Caption id={s?.line} />
      <Controls paused={seq.paused} onToggle={seq.toggle} onReplay={seq.replay} onSkip={seq.skip} skipLabel={skipLabel} />
    </div>
  );
}

const D_STEPS: (Step & { shot: string })[] = [
  { id: "hatch", shot: "hatch", min: 4.5 },
  { id: "ladder", shot: "ladder", min: 6.5 },
  { id: "smallstep", shot: "smallstep", line: "d-step", min: 7 },
  { id: "bootprint", shot: "bootprint", min: 4 },
  { id: "aldrin", shot: "aldrin", min: 5.5 },
  { id: "rise", shot: "rise", min: 5.5 },
];
export function SceneSteps({ onDone }: { onDone: () => void }) {
  return <MoonScene steps={D_STEPS} onDone={onDone} skipLabel="Skip" />;
}

export function SceneStory({ onDone }: { onDone: () => void }) {
  const steps = useMemo(() => {
    const all = beat("E").lines.map((l) => ({ id: l.id, line: l.id, shot: l.shot ?? "wide", min: l.verbatim ? 2 : 1.2 }));
    // deep link for checks and Judge Mode: ?chapter=1&scene=E&line=e12 starts at that line
    const from = all.findIndex((x) => x.id === new URLSearchParams(location.search).get("line"));
    return from > 0 ? all.slice(from) : all;
  }, []);
  return <MoonScene steps={steps} onDone={onDone} skipLabel="Skip to summary" />;
}
export const reduced = () => motion.reduced;
