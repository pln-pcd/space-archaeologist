// THE INTRO (v7.3): a short narrated three.js tour that explains the game before the first visit to the
// ship (and from Settings any time). One scene, the camera glides between six stops while Nova talks:
//   1 hello  2 machines visited the Moon and Mars  3 many are still there, quiet  4 your job: find,
//   dust off, learn  5 collect, ask Nova, earn badges  6 ready? Each stop advances when Nova finishes
//   (or on Next); Skip goes straight to the ship.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { ChevronRight, SkipForward } from "lucide-react";
import Nova3D from "../nova/Nova3D";
import { nova } from "../nova/state";
import { Body } from "../scene/bodies";
import { say } from "../nova/talk";
import { stopSpeaking } from "../nova/voice";
import { motion } from "../../anim/kit";
import { cute } from "../../audio/cute";
import { useWarpReady } from "../fx/Warp";
import { AdaptiveDpr } from "../../fx/AdaptiveDpr";
import { useTheme } from "../../audio/themes";
import "./intro.css";

type Stop = { id: string; text: string; cam: [number, number, number]; look: [number, number, number]; icon: string };
const STOPS: Stop[] = [
  { id: "intro-1", text: "Hi! I'm Nova. Welcome aboard, Space Archaeologist!", cam: [0, 0.6, 6], look: [0, 0.4, 0], icon: "👋" },
  { id: "intro-2", text: "Long ago, brave machines flew to the Moon and to Mars.", cam: [-3.2, 1.2, 4.6], look: [-4.2, 0.6, -3], icon: "🚀" },
  { id: "intro-4", text: "Your job: find them, dust them off and learn their true stories.", cam: [0.4, 2.6, 5.5], look: [0, 0.2, -1], icon: "🔍" },
  { id: "intro-5", text: "Keep your finds in your Passport, earn badges, and ask me anything!", cam: [0, 0.9, 4.2], look: [0, 0.6, 0], icon: "⭐" },
];

function Rig({ stop }: { stop: number }) {
  const cam = useRef(new THREE.Vector3(0, 0.6, 8));
  const look = useRef(new THREE.Vector3());
  useFrame((s, dt) => {
    const st = STOPS[stop];
    const k = motion.reduced ? 1 : 1 - Math.exp(-dt * 1.8);
    cam.current.lerp(new THREE.Vector3(...st.cam), k);
    look.current.lerp(new THREE.Vector3(...st.look), k);
    const t = s.clock.elapsedTime;
    s.camera.position.copy(cam.current).add(new THREE.Vector3(Math.sin(t * 0.3) * 0.08, Math.sin(t * 0.4) * 0.05, 0));
    s.camera.lookAt(look.current);
  });
  return null;
}

/** a tiny lander / rover, glowing like a beacon when it's their turn */
function Machine({ kind, glow }: { kind: "lander" | "rover"; glow: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ring.current) return;
    const k = motion.reduced ? 0.5 : (s.clock.elapsedTime * 0.7) % 1;
    ring.current.scale.setScalar(0.5 + k * (glow ? 1.6 : 0.6));
    (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (glow ? 0.9 : 0.2);
  });
  return (
    <group>
      {kind === "lander" ? (
        <group>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.22, 8]} />
            <meshToonMaterial color="#E9B949" />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <dodecahedronGeometry args={[0.18, 0]} />
            <meshToonMaterial color="#EDEAF4" />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = i * 1.571 + 0.78;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3]} rotation={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]}>
                <cylinderGeometry args={[0.025, 0.025, 0.34, 6]} />
                <meshToonMaterial color="#C9C3D6" />
              </mesh>
            );
          })}
        </group>
      ) : (
        <group>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.46, 0.14, 0.32]} />
            <meshToonMaterial color="#F1ECE4" />
          </mesh>
          <mesh position={[0, 0.29, 0]}>
            <boxGeometry args={[0.66, 0.02, 0.4]} />
            <meshToonMaterial color="#5E78D6" />
          </mesh>
          <mesh position={[0.14, 0.44, 0.1]}>
            <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
            <meshToonMaterial color="#C9C3D6" />
          </mesh>
          {[-1, 0, 1].flatMap((i) =>
            [-1, 1].map((sd) => (
              <mesh key={`${i}${sd}`} position={[i * 0.18, 0.08, sd * 0.2]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.05, 14]} />
                <meshToonMaterial color="#5B5470" />
              </mesh>
            )),
          )}
        </group>
      )}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.5, 0.6, 40]} />
        <meshBasicMaterial color="#FFE27A" transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** the scan pulse + magnifier for "find them, dust them off" */
function Scan({ on }: { on: boolean }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!m.current) return;
    m.current.visible = on;
    const k = motion.reduced ? 0.6 : (s.clock.elapsedTime * 0.6) % 1;
    m.current.scale.setScalar(0.3 + k * 4);
    (m.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
  });
  return (
    <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, -1]}>
      <ringGeometry args={[0.9, 1, 64]} />
      <meshBasicMaterial color="#7FD1FF" transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** badges orbiting Nova for "earn badges" */
function Badges({ on }: { on: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    g.current.visible = on;
    g.current.rotation.y = motion.reduced ? 0 : s.clock.elapsedTime * 0.9;
  });
  const star = useMemo(() => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.07 : 0.16;
      if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
    geo.center();
    return geo;
  }, []);
  return (
    <group ref={g} position={[0, 0.7, 0]}>
      {["#FFD23F", "#FF8FBE", "#7FD1FF", "#9FF2C8", "#C9B3FF"].map((c, i) => (
        <mesh key={c} geometry={star} position={[Math.cos((i / 5) * Math.PI * 2) * 1.3, Math.sin(i) * 0.2, Math.sin((i / 5) * Math.PI * 2) * 1.3]}>
          <meshToonMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function World({ stop }: { stop: number }) {
  return (
    <>
      <color attach="background" args={["#1A0B46"]} />
      <hemisphereLight args={["#FFF1FF", "#3A2A80", 1.4]} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} />
      <Stars radius={60} depth={30} count={1600} factor={3} fade speed={motion.reduced ? 0 : 0.6} />
      <group position={[0, -3.2, -16]}>
        <Body kind="earth" radius={2.6} spin={0.04} tilt={0.41} />
      </group>
      {/* the Moon with a little lander */}
      <group position={[-4.6, -1.6, -3.4]}>
        <Body kind="moon" radius={1.7} spin={0.01} tilt={0.1} segments={48} />
        <group position={[0.2, 1.68, 0.3]} scale={0.9}>
          <Machine kind="lander" glow={stop === 1 || stop === 2} />
        </group>
      </group>
      {/* Mars with a little rover */}
      <group position={[4.9, -1.7, -3.4]}>
        <Body kind="mars" radius={1.7} spin={0.02} tilt={0.44} segments={48} />
        <group position={[-0.2, 1.68, 0.3]} scale={0.9}>
          <Machine kind="rover" glow={stop === 1 || stop === 2} />
        </group>
      </group>
      <group position={[0, -0.9, 0]} scale={1.6}>
        <Nova3D float enter="bottom" lookAt={[0, 0.8, 8]} />
      </group>
      <Scan on={stop === 2} />
      <Badges on={stop === 3} />
      <Rig stop={stop} />
      <AdaptiveDpr />
    </>
  );
}

export default function Intro({ onDone }: { onDone: () => void }) {
  const [stop, setStop] = useState(0);
  const [progress, setProgress] = useState(0);
  const alive = useRef(true);
  useWarpReady();
  useTheme("title");
  useEffect(() => () => void ((alive.current = false), stopSpeaking()), []);
  // Nova reads each stop, then the tour moves on by itself (Next skips ahead)
  useEffect(() => {
    let cancelled = false;
    const st = STOPS[stop];
    nova.feel(stop === 0 || stop === 3 ? "excited" : "happy");
    nova.act(stop === 0 ? "wave" : stop === 3 ? "thumbs" : "point", stop === 1 ? [-1, 0.2] : [1, 0.2]);
    setProgress(0);
    const t0 = performance.now();
    const iv = setInterval(() => setProgress(Math.min(1, (performance.now() - t0) / 5200)), 100);
    void say(st.id).then(() => {
      if (cancelled || !alive.current) return;
      setTimeout(() => !cancelled && alive.current && (stop < STOPS.length - 1 ? setStop(stop + 1) : undefined), 900);
    });
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [stop]);
  const next = () => {
    cute.pop(1.2);
    stopSpeaking();
    if (stop < STOPS.length - 1) setStop(stop + 1);
    else finish();
  };
  const finish = () => {
    stopSpeaking();
    cute.fanfare();
    onDone();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "Escape") finish();
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  const st = STOPS[stop];
  return (
    <section className="intro od-free" aria-label="How to play">
      <Canvas className="intro-canvas" dpr={[1, 1.5]} camera={{ fov: 45, near: 0.1, far: 120, position: [0, 0.6, 8] }} gl={{ toneMapping: THREE.NoToneMapping }}>
        <Suspense fallback={null}>
          <World stop={stop} />
        </Suspense>
      </Canvas>
      <button type="button" className="g-btn intro-skip" onClick={finish}>
        <SkipForward size={20} /> Skip intro
      </button>
      <div className="intro-card g-panel" key={st.id}>
        <span className="intro-ico" aria-hidden="true">
          {st.icon}
        </span>
        <p>{st.text}</p>
        <div className="intro-foot">
          <ol className="intro-dots" aria-label={`Part ${stop + 1} of ${STOPS.length}`}>
            {STOPS.map((s, i) => (
              <li key={s.id} className={i < stop ? "done" : i === stop ? "now" : ""}>
                {i === stop && <b style={{ width: `${progress * 100}%` }} />}
              </li>
            ))}
          </ol>
          <button type="button" className="g-btn primary big" onClick={next} autoFocus>
            {stop < STOPS.length - 1 ? "Next" : "Let's go!"} <ChevronRight size={22} strokeWidth={3} />
          </button>
        </div>
      </div>
    </section>
  );
}
