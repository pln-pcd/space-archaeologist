// CH1 STORY (new-flow prompt §8b): ten shots, same narration and facts (e01–e21), timed from the
// narration (storyline.ts). Restored after-p2 look (warm key, cool rim, lilac fill, ACES) + ink lines.
// Real astronauts stay adult and respectful: white suits, gold visors down, no faces. Machines have
// no faces. 3D diagrams drawn inside the shots: the dotted Earth→Moon path, Collins's orbit ring, the
// 1/6-gravity hop arc, the laser beam bouncing back. One clear idea per shot; the bottom 30 % stays
// free for the caption card. No haze, no wind, no sound on the Moon; the Moon stays grey, sky black.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Apollonaut, BootPrint, Columbia, Eagle, Earth, Flag, MoonGround, MoonSphere, Reflector, RockBoxModel, Seismometer, SolarWindSheet, newEagle, PLAQUE, LADDER } from "../ch1/props";
import { StillStars } from "../ch1/stage";
import { newDriver } from "../../ship/Chubby";
import { OutlineSync } from "../../fx/outline";
import { OdysseyPost } from "../../odyssey/Post";
import { CH1_STORY, at, type Storyline } from "./storyline";
import { DottedPath, Veil, backOut, placeCamera, power3Out, useFrameOffset, win, type FilmClock, type Pose } from "./stage";
import { motion } from "../../anim/kit";
import { setWorldLook } from "../../fx/uniforms";

const P = (pos: [number, number, number], look: [number, number, number], fov = 42): Pose => ({ pos, look, fov });
/** from → to camera per shot (after-p2: high three-quarter views, gentle dollies) */
const CAMS: Record<string, [Pose, Pose]> = {
  landed: [P([11, 7.5, 16], [0, 2.2, 0], 44), P([7.5, 4.2, 11.5], [0, 2.0, 0], 42)],
  "first-step": [P([5.4, 2.6, 6.2], [0, 1.3, 1.8], 38), P([4.4, 2.0, 5.2], [0, 1.0, 2.0], 36)],
  hop: [P([7.5, 2.2, 6.5], [2.2, 1.0, 2.6], 40), P([6.5, 1.9, 5.6], [2.6, 0.9, 2.6], 40)],
  bootprint: [P([4.6, 2.5, 7.6], [1.9, 0.0, 4.1], 22), P([3.8, 2.0, 6.7], [1.9, 0.0, 4.2], 16)],
  columbia: [P([0, 17, 27], [0, 0, 0], 40), P([0, 13, 21], [0, 0, 0], 42)],
  "flag-rocks": [P([6.5, 3.2, 9.5], [2.6, 0.9, 3.0], 40), P([5.6, 2.4, 7.6], [2.8, 0.8, 3.2], 38)],
  experiments: [P([-1.2, 2.2, 7.5], [-3.0, 0.5, 3.2], 40), P([-3.8, 2.6, 7.2], [-4.2, 0.9, 1.6], 40)],
  plaque: [P([1.1, 2.1, 4.6], [PLAQUE.x, PLAQUE.y, PLAQUE.z], 30), P([0.35, 1.55, 3.25], [PLAQUE.x, PLAQUE.y, PLAQUE.z], 26)],
  liftoff: [P([8, 3.2, 11], [0, 2.4, 0], 42), P([9, 5.5, 13], [0, 5.0, 0], 46)],
  today: [P([6.5, 2.6, 9], [-2, 2.2, 0], 42), P([5.0, 1.8, 7.5], [-2.5, 2.8, 0], 44)],
};

export function MoonStoryWorld({ clock, story = CH1_STORY }: { clock: FilmClock; story?: Storyline }) {
  const { camera, size } = useThree();
  useFrameOffset(0.1);
  // the Moon's own look: no atmosphere, no haze, no drifting light
  useEffect(() => setWorldLook("moon"), []);
  const eagle = useRef(newEagle());
  const neil = useRef(newDriver());
  const buzz = useRef(newDriver());
  const neilG = useRef<THREE.Group>(null);
  const buzzG = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Group>(null);
  const space = useRef<THREE.Group>(null);
  const columbiaG = useRef<THREE.Group>(null);
  const flag = useRef<THREE.Group>(null);
  const rocks = useRef<THREE.Group>(null);
  const instruments = useRef<THREE.Group>(null);
  const solarWind = useRef<THREE.Group>(null);
  const laser = useRef<THREE.Mesh>(null);
  const laserBack = useRef<THREE.Mesh>(null);
  const earthSky = useRef<THREE.Group>(null);
  const printDepth = useRef(0);
  const pathReveal = useRef(0);
  const hopReveal = useRef(0);
  const orbitReveal = useRef(0);
  const upReveal = useRef(0);

  // diagram curves
  const earthPos = new THREE.Vector3(-26, 22, -60);
  const earthToMoon = useMemo(() => [earthPos.clone(), new THREE.Vector3(-14, 18, -30), new THREE.Vector3(-5, 9, -8), new THREE.Vector3(0, 3.2, 0)], []); // eslint-disable-line react-hooks/exhaustive-deps
  const hop = useMemo(() => Array.from({ length: 9 }, (_, i) => new THREE.Vector3(1.0 + i * 0.42, 0.15 + Math.sin((i / 8) * Math.PI) * 1.25, 2.6)), []);
  const orbit = useMemo(() => Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos((i / 48) * Math.PI * 2) * 9, Math.sin((i / 48) * Math.PI * 2) * 2.2, Math.sin((i / 48) * Math.PI * 2) * 9)), []);
  const upPath = useMemo(() => [new THREE.Vector3(0, 3, 0), new THREE.Vector3(0.6, 7, -1), new THREE.Vector3(3, 12, -4)], []);

  useFrame(() => {
    const t = clock.current.t;
    const a = at(story, t);
    const id = a.shot.id;
    const L = a.local;
    const [from, to] = CAMS[id];
    placeCamera(camera as THREE.PerspectiveCamera, from, to, L, a.len, size.width / size.height);
    const inSpace = id === "columbia";
    if (surface.current) surface.current.visible = !inSpace;
    if (space.current) space.current.visible = inSpace;
    // Eagle: whole until the lift-off shot
    const e = eagle.current;
    e.ascentOn = true;
    e.ascentY = 0;
    e.flame = 0;
    if (id === "liftoff") {
      const k = win(L, a.len * 0.55, a.len * 0.95);
      e.ascentY = motion.reduced ? (k > 0 ? 6 : 0) : k * k * 9;
      e.flame = k > 0 ? 0.8 : 0;
    }
    if (id === "today") e.ascentOn = false;
    // the astronauts
    const show = (g: THREE.Group | null, v: boolean) => g && (g.visible = v);
    show(neilG.current, ["first-step", "hop", "flag-rocks", "experiments"].includes(id));
    show(buzzG.current, ["hop", "flag-rocks", "experiments"].includes(id));
    neil.current.walk = 0;
    buzz.current.walk = 0;
    if (neilG.current) {
      if (id === "first-step") {
        const k = power3Out(win(L, 0.6, 3.2));
        neilG.current.position.set(0, (1 - k) * 0.75, LADDER.bottom.z + 0.15 + k * 0.35);
        neilG.current.rotation.y = 0;
      } else if (id === "hop") {
        neilG.current.position.set(-0.6, 0, 3.0);
        neilG.current.rotation.y = 0.6;
      } else if (id === "flag-rocks") {
        neilG.current.position.set(3.4, 0, 3.6);
        neilG.current.rotation.y = -0.6;
      } else {
        neilG.current.position.set(-2.4, 0, 2.6);
        neilG.current.rotation.y = -1.3;
      }
    }
    if (buzzG.current) {
      if (id === "hop") {
        // one low, floaty 1/6-g hop along the dotted arc
        const k = win(L, 1.0, 1.0 + 2.6);
        const i = Math.min(hop.length - 1.001, k * (hop.length - 1));
        const p = hop[Math.floor(i)].clone().lerp(hop[Math.ceil(i)], i % 1);
        buzzG.current.position.set(p.x, Math.max(0, p.y - 0.15), p.z);
        buzzG.current.rotation.y = Math.PI / 2;
        buzz.current.walk = k > 0 && k < 1 ? 0.6 : 0;
      } else if (id === "flag-rocks") {
        buzzG.current.position.set(1.6, 0, 2.2);
        buzzG.current.rotation.y = 0.4;
      } else {
        buzzG.current.position.set(-4.6, 0, 3.0);
        buzzG.current.rotation.y = -0.9;
      }
    }
    // the diagrams
    pathReveal.current = id === "landed" ? (motion.reduced ? 1 : win(L, 0.8, 4.2)) : 0;
    hopReveal.current = id === "hop" ? (motion.reduced ? 1 : win(L, 0.8, 3.4)) : 0;
    orbitReveal.current = inSpace ? (motion.reduced ? 1 : win(L, 0.5, 4.5)) : 0;
    upReveal.current = id === "liftoff" ? win(L, a.len * 0.7, a.len) : 0;
    printDepth.current = id === "bootprint" ? win(L, 0.4, 1.6) : id === "first-step" ? win(L, 2.8, 3.4) : ["landed"].includes(id) ? 0 : 1;
    if (columbiaG.current) {
      const ang = (L / Math.max(1, a.len)) * Math.PI * 1.2 + 0.4;
      columbiaG.current.position.set(Math.cos(ang) * 9, Math.sin(ang) * 2.2, Math.sin(ang) * 9);
      columbiaG.current.rotation.y = -ang;
    }
    if (flag.current) flag.current.visible = !["landed", "first-step", "hop", "bootprint"].includes(id);
    if (rocks.current) {
      rocks.current.visible = ["flag-rocks", "experiments", "plaque", "liftoff", "today"].includes(id);
      rocks.current.children.forEach((r, i) => {
        // rocks hop into the box one after another (a little back.out pop)
        const k = id === "flag-rocks" ? backOut(win(L, 2.2 + i * 0.45, 2.7 + i * 0.45)) : 1;
        r.position.y = 0.55 + (1 - k) * 0.8;
        r.scale.setScalar(Math.max(0.001, k) * 0.14);
      });
    }
    if (instruments.current) instruments.current.visible = ["experiments", "plaque", "liftoff", "today"].includes(id);
    // The foil was brought home. It is never present among today's abandoned artifacts.
    if (solarWind.current) solarWind.current.visible = id === "experiments";
    // the laser: a beam comes down from Earth, bounces off the reflector and goes back
    // during e10 ("They placed a laser reflector…") in the experiments shot, and again at the very end
    const e10 = a.shot.lines[1] ? a.shot.lines[1].start - a.shot.start : 3;
    const beam = id === "experiments" ? win(L, e10, e10 + 1.6) : id === "today" ? win(L, a.len * 0.55, a.len * 0.8) : 0;
    if (laser.current) {
      laser.current.visible = beam > 0;
      laser.current.scale.y = Math.max(0.001, Math.min(1, beam * 2));
    }
    if (laserBack.current) {
      laserBack.current.visible = beam > 0.5;
      laserBack.current.scale.y = Math.max(0.001, (beam - 0.5) * 2);
    }
    if (earthSky.current) earthSky.current.visible = !inSpace;
  });

  const reflectorAt = new THREE.Vector3(-4.2, 0.3, 1.6);
  const beamDir = earthPos.clone().sub(reflectorAt);
  const beamLen = beamDir.length();
  const beamQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().normalize());

  return (
    <>
      <color attach="background" args={["#000000"]} />
      {/* after-p2 lights: warm key, lilac fill, cool rim (the Moon itself stays grey) */}
      <hemisphereLight args={["#FFF1E2", "#3A3550", 0.55]} />
      <ambientLight intensity={0.25} color="#C7BDF5" />
      <directionalLight position={[-12, 14, 8]} intensity={2.4} color="#FFF0DC" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <directionalLight position={[10, 5, -12]} intensity={0.6} color="#9FB4FF" />
      <StillStars count={700} />
      <group ref={earthSky}>
        <Earth radius={4.2} position={[earthPos.x, earthPos.y, earthPos.z]} />
      </group>
      <group ref={surface}>
        <MoonGround radius={70} />
        <Eagle ctl={eagle} />
        <group ref={neilG}>
          <Apollonaut driver={neil} seed={1} />
        </group>
        <group ref={buzzG}>
          <Apollonaut driver={buzz} seed={2} />
        </group>
        {[0, 1, 2, 3].map((i) => (
          <BootPrint key={i} position={[1.75 + 0.15 * (i % 2 ? 1 : -1), 0.012, 3.6 + i * 0.32]} rotation={0.05} depth={printDepth} />
        ))}
        <group ref={flag} position={[2.6, 0, 1.4]}>
          <Flag />
        </group>
        <group position={[2.4, 0, 3.6]}>
          <RockBoxModel />
          <group ref={rocks}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[(i - 1.5) * 0.12, 0.55, 0]}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshLambertMaterial color={["#8E8C8A", "#9B9895", "#7E7C7B", "#A5A29E"][i]} />
              </mesh>
            ))}
          </group>
        </group>
        <group ref={instruments}>
          <group position={[-2.6, 0, 3.4]}>
            <Seismometer />
          </group>
          <group position={[reflectorAt.x, 0, reflectorAt.z]}>
            <Reflector />
          </group>
          <group ref={solarWind} position={[-1.2, 0, 0.9]}>
            <SolarWindSheet />
          </group>
        </group>
        <mesh ref={laser} position={reflectorAt.clone().add(beamDir.clone().multiplyScalar(0.5))} quaternion={beamQuat} userData={{ noOutline: true }} visible={false}>
          <cylinderGeometry args={[0.035, 0.035, beamLen, 6]} />
          <meshBasicMaterial color={new THREE.Color("#7CFFB0").multiplyScalar(1.6)} toneMapped={false} transparent opacity={0.85} />
        </mesh>
        <mesh ref={laserBack} position={reflectorAt.clone().add(new THREE.Vector3(0.12, 0, 0)).add(beamDir.clone().multiplyScalar(0.5))} quaternion={beamQuat} userData={{ noOutline: true }} visible={false}>
          <cylinderGeometry args={[0.02, 0.02, beamLen, 6]} />
          <meshBasicMaterial color={new THREE.Color("#C9FFD9").multiplyScalar(1.4)} toneMapped={false} transparent opacity={0.7} />
        </mesh>
        <DottedPath points={earthToMoon} reveal={pathReveal} size={0.16} gap={1.1} />
        <DottedPath points={hop} reveal={hopReveal} size={0.045} gap={0.18} color="#BFE6FF" />
        <DottedPath points={upPath} reveal={upReveal} size={0.08} gap={0.45} />
      </group>
      <group ref={space} visible={false}>
        <MoonSphere radius={6} />
        <DottedPath points={orbit} reveal={orbitReveal} size={0.09} gap={0.55} />
        <group ref={columbiaG} scale={0.9}>
          <Columbia />
        </group>
      </group>
      <Veil clock={clock} getVeil={(t) => ({ ...at(story, t), center: [0.5, 0.42] })} />
      <OdysseyPost ink="#2E2E31" near={10} far={60} />
      <OutlineSync />
    </>
  );
}
