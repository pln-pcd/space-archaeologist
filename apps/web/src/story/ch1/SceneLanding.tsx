// Scene C (bible §8): the trip to the Moon (Earth shrinks, the Moon grows), Columbia and Eagle
// separating in lunar orbit, Eagle's descent (Armstrong steers past a crater), touchdown with flat
// dust sheets and silence, then the real NASA audio: "Houston, Tranquility Base here. The Eagle
// has landed." Slow authored rails, black sky, crisp Earth, no haze.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Caption, Controls, FactCard, useSequence, type Clock, type Step } from "./ui";
import { Columbia, DustSheet, Eagle, Earth, MoonGround, MoonSphere, newEagle } from "./props";
import { Stage, StillStars, newCam, type CamCtl, type Shot } from "./stage";
import { play } from "../../audio/sfx";

const STEPS: Step[] = [
  { id: "travel", line: "c-trip", min: 10 },
  { id: "orbit", line: "c-collins", min: 9 },
  { id: "descent", line: "c-steer", min: 10 },
  { id: "touchdown", min: 3 },
  { id: "landed", line: "c-landed", min: 4 },
  { id: "date", card: "c-date", min: 3.5 },
];
const SHOTS: Record<string, [Shot, Shot]> = {
  travel: [{ pos: [0, 2, 14], look: [0, 0, 0] }, { pos: [0, 2, 12], look: [0, 0, -40] }],
  orbit: [{ pos: [9, 4, 10], look: [0, 0, 0] }, { pos: [6, 3, 8], look: [0, -1, 0] }],
  descent: [{ pos: [-14, 6, 18], look: [0, 4, 0] }, { pos: [-10, 3, 14], look: [0, 2, 0] }],
  touchdown: [{ pos: [-10, 3, 14], look: [0, 2, 0] }, { pos: [-9, 2.6, 13], look: [0, 1.5, 0] }],
  landed: [{ pos: [-9, 2.6, 13], look: [0, 1.5, 0] }, { pos: [-8, 2.4, 12], look: [0, 1.6, 0] }],
  date: [{ pos: [-8, 2.4, 12], look: [0, 1.6, 0] }, { pos: [-8.5, 2.6, 12.5], look: [0, 1.6, 0] }],
};

function World({ clock, cam }: { clock: React.MutableRefObject<Clock>; cam: React.MutableRefObject<CamCtl> }) {
  const travel = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const lm = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Group>(null);
  const eagleLM = useRef<THREE.Group>(null);
  const ctl = useRef(newEagle());
  const dust = useRef(0);
  const thud = useRef(false);
  useFrame(() => {
    const c = clock.current;
    const id = STEPS[c.i]?.id ?? "date";
    const t = c.t;
    const pair = SHOTS[id];
    const dur = Math.max(STEPS[c.i]?.min ?? 6, 6);
    cam.current.from = pair[0];
    cam.current.to = pair[1];
    cam.current.k = Math.min(1, t / dur);
    if (travel.current) travel.current.visible = id === "travel";
    if (orbit.current) orbit.current.visible = id === "orbit";
    if (surface.current) surface.current.visible = id !== "travel" && id !== "orbit";
    // travel: Earth falls away behind, the Moon grows ahead
    if (earth.current) {
      const k = Math.min(1, t / 10);
      earth.current.position.set(-3 - k * 6, -1 + k * 1, 6 + k * 30);
      earth.current.scale.setScalar(1.6 - k * 1.2);
    }
    if (moon.current) {
      const k = Math.min(1, t / 10);
      moon.current.position.set(2, 0, -60 + k * 34);
      moon.current.scale.setScalar(0.6 + k * 1.8);
    }
    // orbit: Eagle undocks from Columbia and drifts down toward the Moon
    if (lm.current) {
      const k = Math.max(0, (t - 2) / 7);
      lm.current.position.set(-0.6 - k * 1.2, -k * 2.2, 0.2 * k);
      lm.current.rotation.z = k * 0.4;
    }
    // descent: down from 9 units, a sideways move past the crater, then touchdown
    const e = ctl.current;
    if (eagleLM.current) {
      if (id === "descent") {
        const k = Math.min(1, t / 10);
        eagleLM.current.position.set(-4 + k * 4 + Math.sin(k * Math.PI) * 1.5, 9 - k * 8.6, 0);
        e.descentFlame = 0.9;
      } else if (id === "touchdown") {
        const k = Math.min(1, t / 1.2);
        eagleLM.current.position.set(0, 0.4 - k * 0.4, 0);
        e.descentFlame = Math.max(0, 0.9 - t * 0.9);
        dust.current = Math.min(1.4, t * 1.2);
        if (t > 1.1 && !thud.current) {
          thud.current = true;
          play("landThud", 0.8, 0.6);
        }
      } else {
        eagleLM.current.position.set(0, 0, 0);
        e.descentFlame = 0;
        dust.current = id === "landed" || id === "date" ? Math.min(1.6, 1.4 + t * 0.2) : 0;
      }
    }
  });
  return (
    <>
      <StillStars />
      <group ref={travel}>
        <group ref={earth}>
          <Earth radius={2.2} />
        </group>
        <group ref={moon}>
          <MoonSphere radius={4} />
        </group>
        <group position={[0, 0, 0]} scale={0.25}>
          <Columbia />
        </group>
      </group>
      <group ref={orbit} visible={false}>
        <MoonSphere radius={40} position={[0, -46, -10]} />
        <Earth radius={1.4} position={[-12, 9, -40]} />
        <group position={[1.2, 0, 0]} scale={0.6}>
          <Columbia />
        </group>
        <group ref={lm} scale={0.22}>
          <Eagle ctl={ctl} plaque={false} />
        </group>
      </group>
      <group ref={surface} visible={false}>
        <MoonGround />
        <Earth radius={2.4} position={[-26, 22, -60]} />
        <group ref={eagleLM}>
          <Eagle ctl={ctl} plaque={false} />
        </group>
        <DustSheet amount={dust} />
      </group>
    </>
  );
}

export default function SceneLanding({ onDone }: { onDone: () => void }) {
  const cam = useRef<CamCtl>(newCam(SHOTS.travel[0]));
  const seq = useSequence(STEPS, onDone);
  const s = seq.step;
  return (
    <div className="ch1-scene landing">
      <Stage look="moon" cam={cam} sky="#000000">
        <World clock={seq.clock} cam={cam} />
      </Stage>
      {s?.card && <FactCard id={s.card} />}
      <Caption id={s?.line} />
      <Controls paused={seq.paused} onToggle={seq.toggle} onReplay={seq.replay} onSkip={seq.skip} />
    </div>
  );
}
