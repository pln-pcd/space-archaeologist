// Scene B (bible §8): Launch Complex 39A, morning. ONE lever: pull it down at T-9 to start the
// engines, push it up at liftoff to climb. Drag with mouse or touch, Space / arrow keys, or the
// button under it. It never fails: after 6 s the lever pulses and Nova repeats the hint.
import { Button } from "../../odyssey/ui/kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { play } from "../../audio/sfx";
import { say } from "./voice";
import { FactCard } from "./ui";
import { Earth, Flame, LaunchTower, MoonSphere, Puffs, SaturnV } from "./props";
import { OutlineSync, useOutlines } from "../../fx/outline";
import { SkySphere, Stage, StillStars, makeRumble, newCam, type CamCtl } from "./stage";

type Phase = "count" | "pull" | "ignite" | "push" | "climb" | "stage" | "space";
/** v7.5: the trip to the Moon: the spacecraft swings out of Earth orbit toward the growing Moon */
const SPACE_T = 7.5;
const MOON_AT = new THREE.Vector3(-46, 16, -150);
export function craftAt(t: number, out = new THREE.Vector3()) {
  const k = Math.min(1, t / SPACE_T);
  const e = k * k * (3 - 2 * k);
  // a gentle arc: out from Earth, then a long glide toward the Moon
  out.set(THREE.MathUtils.lerp(0, MOON_AT.x * 0.55, e), 2 + Math.sin(e * Math.PI) * 6 + e * MOON_AT.y * 0.35, THREE.MathUtils.lerp(-20, MOON_AT.z * 0.55, e));
  return out;
}
export type Sim = { phase: Phase; t: number; flame: number; vapour: number; smoke: number; y: number; stage: number; tPhase: number };

function LaunchWorld({ sim, cam }: { sim: React.MutableRefObject<Sim>; cam: React.MutableRefObject<CamCtl> }) {
  const rocket = useRef<THREE.Group>(null);
  const sic = useRef<THREE.Group>(null);
  const pad = useRef<THREE.Group>(null);
  const space = useRef<THREE.Group>(null);
  const craft = useRef<THREE.Group>(null);
  const flame = useRef(0);
  const flame2 = useRef(0);
  const vapour = useRef(0.6);
  const smoke = useRef(0);
  const dusk = useRef<THREE.MeshBasicMaterial>(null);
  const scene = useThree((t) => t.scene);
  const looks = useRef<THREE.Group>(null);
  useOutlines(looks, "interactable");
  useOutlines(rocket, "interactable");
  useOutlines(sic, "interactable");
  useOutlines(craft, "interactable");
  const burn = useRef(0.8);
  const tmpV = useRef(new THREE.Vector3());
  const tmpA = useRef(new THREE.Vector3());
  useFrame(() => {
    const s = sim.current;
    // v7.4: a clear morning: the haze only softens the far horizon, never the rocket
    if (scene.fog instanceof THREE.Fog) (scene.fog.near = 70), (scene.fog.far = 320);
    flame.current = s.stage < 1 ? s.flame : 0;
    // the second stage lights a moment after the first stage falls away
    flame2.current = s.stage >= 1 && s.tPhase > 1.5 ? 0.8 : 0;
    // the sky darkens as the rocket climbs
    if (dusk.current) dusk.current.opacity = Math.max(0, Math.min(0.82, (s.y - 10) / 55));
    vapour.current = s.vapour;
    smoke.current = s.smoke;
    const inSpace = s.phase === "space";
    if (pad.current) pad.current.visible = !inSpace;
    if (space.current) space.current.visible = inSpace;
    if (rocket.current) rocket.current.position.y = s.y;
    // in space: the spacecraft drifts away toward the Moon (upper left)
    if (craft.current && inSpace) {
      const p = craftAt(s.tPhase, tmpV.current);
      craft.current.position.copy(p);
      // nose along the path
      const a = craftAt(s.tPhase + 0.1, tmpA.current).sub(p);
      if (a.lengthSq() > 1e-6) craft.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.normalize());
    }
    burn.current = inSpace && s.tPhase < SPACE_T * 0.7 ? 0.9 : 0.15;
    // the first stage rides with the rocket, then drops away and tumbles slowly
    if (sic.current) {
      const k = s.stage >= 1 ? Math.max(0, s.tPhase - 0.6) : 0;
      sic.current.visible = !inSpace && (s.stage < 1 || k < 4);
      sic.current.position.y = s.y + 3.2 - k * k * 1.4 - k * 3.2;
      sic.current.rotation.z = k * 0.07;
      sic.current.rotation.x = k * 0.04;
    }
  });
  return (
    <>
      <group ref={pad}>
        <SkySphere top="#6FB8F2" bottom="#FFE3C4" />
        <mesh renderOrder={0}>
          <sphereGeometry args={[560, 32, 16]} />
          <meshBasicMaterial ref={dusk} color="#06070B" side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* ground: scrub and sand around the pad, the sea beyond */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[400, 48]} />
          <meshLambertMaterial color="#8CC98A" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[14, 40]} />
          <meshLambertMaterial color="#E9DDC4" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-60, 0.01, -120]}>
          <planeGeometry args={[600, 160]} />
          <meshLambertMaterial color="#5BB8FF" />
        </mesh>
        <group ref={looks}>
        <LaunchTower />
        </group>
        <group ref={rocket}>
          <group scale={[1.22, 1, 1.22]}>
            <SaturnV only="upper" />
          </group>
          <group position={[0, 0.3, 0]}>
            <Flame amount={flame} length={4.5} radius={1.1} />
          </group>
          <group position={[0, 6.0, 0]}>
            <Flame amount={flame2} length={3.2} radius={0.8} />
          </group>
        </group>
        <group ref={sic}>
          <group position={[0, -3.2, 0]} scale={[1.22, 1, 1.22]}>
            <SaturnV only="sic" />
          </group>
        </group>
        {/* venting vapour (morning), then exhaust smoke rolling out sideways */}
        <group position={[0, 2, 0]}>
          <Puffs amount={vapour} count={10} spread={1.4} rise={2.5} opacity={0.4} size={2.2} />
        </group>
        <group position={[0, 0.2, 0]}>
          <Puffs amount={smoke} count={26} spread={9} rise={1.6} color="#F4F0EA" opacity={0.7} size={4.2} />
        </group>
      </group>
      <group ref={space} visible={false}>
        <StillStars />
        <Earth radius={40} position={[6, -52, -70]} rotation={[-0.7, 2.4, 0]} />
        <MoonSphere radius={14} position={MOON_AT.toArray() as [number, number, number]} />
        <group ref={craft} position={[0, 2, -20]} scale={0.5}>
          <group position={[0, -9.6, 0]}>
            <SaturnV stage={2} />
          </group>
          <group position={[0, -0.1, 0]}>
            <Flame amount={burn} length={2.6} radius={0.55} />
          </group>
        </group>
      </group>
      <OutlineSync />
    </>
  );
}

export function Lever({ value, active, dir, pulse, onChange, onCommit }: { value: number; active: boolean; dir: "down" | "up"; pulse: boolean; onChange: (v: number) => void; onCommit: (v?: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const fromEvent = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  };
  return (
    <div className={`lever-panel ${active ? "active" : ""} ${pulse ? "pulse" : ""}`} aria-label="Launch lever">
      <div className="lever-rail" />
      <div
        ref={track}
        className="lever-track"
        onPointerDown={(e) => {
          if (!active) return;
          drag.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          onChange(fromEvent(e));
        }}
        onPointerMove={(e) => drag.current && onChange(fromEvent(e))}
        onPointerUp={() => {
          drag.current = false;
          onCommit();
        }}
      >
        <div className="lever-handle" style={{ top: `${value * 100}%` }} />
      </div>
      <button type="button" className="chunky primary lever-btn" disabled={!active} onClick={() => { const v = dir === "down" ? 1 : 0; onChange(v); onCommit(v); }}>
        {dir === "down" ? "Pull" : "Push up"}
      </button>
    </div>
  );
}

export default function SceneLaunch({ onDone, mars }: { onDone: () => void; mars?: { World: typeof LaunchWorld; resolve: typeof import("./flow").line; speak: typeof say } }) {
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const speak = mars?.speak ?? say;
  const World = mars?.World ?? LaunchWorld;
  const sim = useRef<Sim>({ phase: "count", t: 10.9, flame: 0, vapour: 0.6, smoke: 0, y: 0, stage: 0, tPhase: 0 });
  const cam = useRef<CamCtl>(newCam({ pos: [-16, 6, 21], look: [0, 7.6, 0], fov: 45 }));
  const [phase, setPhase] = useState<Phase>("count");
  const [count, setCount] = useState(10);
  const [lever, setLever] = useState(0.15);
  const [idle, setIdle] = useState(false);
  const [card, setCard] = useState<string | undefined>("b-date");
  const rumble = useRef(makeRumble());
  const phaseAt = useRef(performance.now());

  const go = useCallback((p: Phase) => {
    sim.current.phase = p;
    sim.current.tPhase = 0;
    phaseAt.current = performance.now();
    setPhase(p);
    setIdle(false);
  }, []);

  // the timeline (wall clock, pausable by the tab being hidden)
  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (pausedRef.current || document.hidden) { raf = requestAnimationFrame(tick); return; }
      const s = sim.current;
      s.tPhase += dt;
      const c = cam.current;
      if (s.phase === "count" || s.phase === "pull" || s.phase === "ignite") {
        s.t = Math.max(0, s.t - dt);
        setCount(Math.ceil(s.t));
      }
      if (s.phase === "count" && s.t <= 9) go("pull");
      if (s.phase === "ignite") {
        s.flame = Math.min(1, s.flame + dt * 0.6);
        s.smoke = Math.min(1, s.smoke + dt * 0.35);
        s.vapour = Math.max(0, s.vapour - dt * 0.3);
        c.shake = 0.4 * s.flame;
        rumble.current.set(0.5 + s.flame * 0.4);
        if (s.t <= 0) go("push");
      }
      if (s.phase === "push") c.shake = 0.5;
      // the camera tilts up, then rides along with the rocket
      if (s.phase === "climb" || s.phase === "stage") {
        const lift = Math.max(0, s.y - 4);
        c.from = { pos: [-13, 3.4 + lift * 0.88, 19], look: [0, 11 + lift, 0], fov: 48 };
        c.to = c.from;
        c.k = 1;
      }
      if (s.phase === "climb") {
        const a = Math.min(1, s.tPhase / 2);
        s.y += dt * (0.6 + s.tPhase * 1.6) * a;
        c.shake = Math.max(0, 0.6 - s.tPhase * 0.08);
        rumble.current.set(Math.max(0.2, 0.9 - s.tPhase * 0.08));
        if (s.tPhase > 7) go("stage");
      }
      if (s.phase === "stage") {
        s.y += dt * 4;
        if (s.stage === 0 && s.tPhase > 0.6) s.stage = 1;
        if (s.tPhase > 4.5) go("space");
      }
      if (s.phase === "space") {
        const p = craftAt(s.tPhase);
        // a 3/4 side chase: the little spacecraft in profile, the Moon growing behind it
        const look = p.clone().lerp(MOON_AT, 0.1);
        c.from = { pos: [p.x + 11, p.y + 3.2, p.z + 4.5], look: look.toArray() as [number, number, number], fov: 44 };
        c.to = c.from;
        c.k = 1;
      }
      if (s.phase === "space" && s.tPhase > SPACE_T) onDoneRef.current();
      // never fails: after 6 s waiting, pulse the lever and repeat the hint once
      if ((s.phase === "pull" || s.phase === "push") && s.tPhase > 6 && !idleRef.current) {
        idleRef.current = true;
        setIdle(true);
        speak(s.phase === "pull" ? "b-pull" : "b-liftoff");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const r = rumble.current;
    return () => {
      cancelAnimationFrame(raf);
      r.stop();
    };
  }, [go]);
  const idleRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // camera per phase
  useEffect(() => {
    const c = cam.current;
    const set = (to: CamCtl["to"]) => {
      c.from = { ...c.to };
      c.to = to;
      c.k = 0;
    };
    idleRef.current = false;
    if (phase === "pull") {
      speak("b-pull");
      set({ pos: [-13.5, 4.6, 17.5], look: [0, 7.4, 0], fov: 45 });
    }
    if (phase === "ignite") setCard("b-pad");
    if (phase === "push") {
      speak("b-liftoff");
      set({ pos: [-12.5, 3.6, 16.5], look: [0, 7.6, 0], fov: 46 });
    }
    if (phase === "climb") {
      setCard("b-imagine");
      set({ pos: [-13, 3.4, 19], look: [0, 11, 0], fov: 48 });
    }
    if (phase === "stage") speak("b-stage");
    if (phase === "space") {
      c.from = { pos: [8, 5, 6], look: [0, -2, -24] };
      c.to = { pos: [5, 3, -2], look: [-3, 0, -26] };
      c.k = 0;
      setCard(undefined);
      rumble.current.stop();
    }
    let raf = 0,
      last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      c.k = Math.min(1, c.k + dt / (phase === "space" ? 6 : phase === "climb" ? 6 : 2.5));
      if (c.k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const commit = useCallback((value = lever) => {
    const s = sim.current;
    if (s.phase === "pull" && value > 0.7) {
      play("portalWhump", 0.7, 0.6);
      go("ignite");
    } else if (s.phase === "push" && value < 0.3) {
      play("whoosh", 0.6, 0.6);
      go("climb");
    }
  }, [lever, go]);
  useEffect(() => {
    // keyboard: Space / ArrowDown pulls, Space / ArrowUp pushes
    const k = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const s = sim.current;
      if (s.phase === "pull" && (e.key === " " || e.key === "ArrowDown")) {
        e.preventDefault();
        setLever(1);
        play("portalWhump", 0.7, 0.6);
        go("ignite");
      } else if (s.phase === "push" && (e.key === " " || e.key === "ArrowUp")) {
        e.preventDefault();
        setLever(0);
        play("whoosh", 0.6, 0.6);
        go("climb");
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go]);
  useEffect(() => {
    if (phase === "push") setLever(1);
  }, [phase]);

  const showCount = phase === "count" || phase === "pull" || phase === "ignite";
  const active = phase === "pull" || phase === "push";
  return (
    <div className="ch1-scene launch">
      <Stage night={!!mars} look={phase === "space" ? "moon" : "base"} cam={cam} sky={phase === "space" ? "#0B0A22" : mars ? "#182431" : "#FFE3C4"}>
        <World sim={sim} cam={cam} />
      </Stage>
      {showCount && (
        <div className="count-screen mono" role="timer" aria-live="off">
          <small className="caps">{mars ? "Space Launch Complex 17B" : "Launch Complex 39A"}</small>
          <b className="caps w500">T-minus {String(count).padStart(2, "0")}</b>
        </div>
      )}
      {(phase === "push" || phase === "climb") && (
        <div className="liftoff-tag lt-v74" role="status">
          <span>Liftoff!</span>
        </div>
      )}
      <FactCard id={card} resolve={mars?.resolve} />
      <div className="launch-controls od-toolrow od-free">
        <Button size="sm" onClick={() => { pausedRef.current = !paused; setPaused(!paused); }} quiet>{paused ? "Play" : "Pause"}</Button>
        <Button size="sm" onClick={() => { sim.current.y = 0; sim.current.stage = 0; sim.current.t = 10.9; sim.current.flame = 0; sim.current.smoke = 0; setLever(0.15); go("count"); }} quiet>Replay</Button>
        <Button size="sm" variant="sky" onClick={onDone}>Skip</Button>
      </div>
      <div className={`lever-wrap ${phase === "climb" || phase === "stage" || phase === "space" ? "done" : ""}`}>
        <p className="lever-label" aria-live="polite">
          {phase === "count" ? "Get ready" : phase === "pull" ? "Pull down to start the engines" : phase === "ignite" ? "Engines starting" : phase === "push" ? "Push up to climb" : phase === "climb" ? "Climbing" : phase === "stage" ? "Stage separation" : mars ? "On the way to Mars" : "On the way to the Moon"}
        </p>
        <Lever value={lever} active={active} dir={phase === "push" ? "up" : "down"} pulse={idle} onChange={setLever} onCommit={commit} />
      </div>
    </div>
  );
}
