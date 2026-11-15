// CH2 STORY (new-flow prompt §8b): ten shots, same narration and facts (m-story-01…18), timed from
// the narration (storyline.ts). Restored after-p2 look + ink lines. The rover has no face (a camera
// bank, not eyes). 3D diagrams drawn inside the shots: the ghost water of Mars's ancient sea, the
// power meter, the marathon ribbon, the signals from Earth. A dust swirl carries us into the storm.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Rover } from "../ch2/models";
import { Earth } from "../ch1/props";
import { StillStars } from "../ch1/stage";
import { rampMaterial } from "../../fx/ramp";
import { setWorldLook } from "../../fx/uniforms";
import { OutlineSync, useOutlines } from "../../fx/outline";
import { OdysseyPost } from "../../odyssey/Post";
import { motion } from "../../anim/kit";
import { CH2_STORY, at } from "./storyline";
import { DottedPath, Veil, backOut, placeCamera, power2InOut, useFrameOffset, win, type FilmClock, type Pose } from "./stage";

const P = (pos: [number, number, number], look: [number, number, number], fov = 42): Pose => ({ pos, look, fov });
const CAMS: Record<string, [Pose, Pose]> = {
  crater: [P([9, 7.5, 12], [0, 0.6, 0], 42), P([6.2, 4.4, 8.6], [0, 0.7, 0], 40)],
  blueberries: [P([2.6, 1.7, 3.6], [1.2, 0.0, 1.4], 26), P([2.0, 1.25, 2.9], [1.2, 0.0, 1.5], 20)],
  sea: [P([10, 5.5, 13], [0, 0.6, 0], 44), P([8, 3.8, 11], [0, 0.6, 0], 44)],
  power: [P([5.6, 2.8, 7.2], [0.4, 1.0, 0], 40), P([4.6, 2.2, 6.0], [0.4, 1.0, 0], 38)],
  stuck: [P([6.5, 2.4, 6.5], [0, 0.4, 0], 40), P([7.5, 2.6, 7.0], [1.6, 0.5, 0], 40)],
  marathon: [P([5, 3, 7], [-1, 0.6, 0], 42), P([9, 7, 13], [-4, 0.5, -2], 44)],
  endeavour: [P([0, 14, 22], [0, 0, -40], 46), P([0, 18, 18], [0, 0, -48], 46)],
  storm: [P([6, 3, 8], [0, 1.2, 0], 42), P([5, 2.4, 6.5], [0, 1.0, 0], 40)],
  messages: [P([0, 3, 30], [0, 0, 0], 40), P([0, 2, 26], [0, 0, 0], 40)],
  rest: [P([7, 3.0, 9], [-4, 0.8, -8], 42), P([5.5, 2.2, 7.5], [-5, 0.8, -10], 40)],
};

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function MarsStoryWorld({ clock }: { clock: FilmClock }) {
  const { camera, size, scene } = useThree();
  const bg = useMemo(() => ({ ground: new THREE.Color("#C9A27E"), space: new THREE.Color("#0c0b1c") }), []);
  useFrameOffset(0.1);
  useEffect(() => setWorldLook("mars"), []);
  const surface = useRef<THREE.Group>(null);
  const space = useRef<THREE.Group>(null);
  const rover = useRef<THREE.Group>(null);
  const percy = useRef<THREE.Group>(null);
  const rim = useRef<THREE.Mesh>(null);
  const berries = useRef<THREE.Group>(null);
  const sea = useRef<THREE.Mesh>(null);
  const ripples = useRef<THREE.Group>(null);
  const meter = useRef<THREE.Group>(null);
  const meterFill = useRef<THREE.Mesh>(null);
  const dustPanels = useRef<THREE.MeshBasicMaterial>(null);
  const gust = useRef<THREE.Group>(null);
  const dune = useRef<THREE.Mesh>(null);
  const ribbon = useRef<THREE.Group>(null);
  const endeavour = useRef<THREE.Mesh>(null);
  const swirl = useRef<THREE.Group>(null);
  const signals = useRef<THREE.Group>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const trail = useRef(0);
  const trailPts = useMemo(() => Array.from({ length: 14 }, (_, i) => new THREE.Vector3(-i * 0.9, 0.04, Math.sin(i * 0.5) * 0.6)), []);

  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uStorm: { value: 0 }, uDusk: { value: 0 } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform float uStorm; uniform float uDusk; varying vec3 vP;
          void main(){
            float k = smoothstep(-0.05, 0.6, vP.y);
            vec3 day = mix(vec3(0.89,0.77,0.63), vec3(0.78,0.63,0.49), k);
            vec3 storm = mix(vec3(0.62,0.53,0.45), vec3(0.42,0.36,0.32), k);
            // Mars dusk: a cool glow near the Sun (blue sunsets are a real Mars thing)
            vec3 dusk = mix(vec3(0.62,0.70,0.80), vec3(0.42,0.33,0.36), k);
            gl_FragColor = vec4(mix(mix(day, storm, uStorm), dusk, uDusk), 1.0);
          }`,
      }),
    [],
  );
  const ground = useMemo(() => rampMaterial("#ae7e5d", { speckle: 1 }), []);
  const rock = useMemo(() => rampMaterial("#9a7863", { flat: true }), []);
  const greyBerry = useMemo(() => rampMaterial("#7d7c7a", { character: true }), []);
  const sand = useMemo(() => rampMaterial("#c99a6c", { speckle: 1 }), []);
  const metal = useMemo(() => rampMaterial("#E6DCC8", { flat: true }), []);
  const outlined = useRef<THREE.Group>(null);
  useOutlines(outlined, "interactable");

  useFrame(() => {
    const t = clock.current.t;
    const a = at(CH2_STORY, t);
    const id = a.shot.id;
    const L = a.local;
    const [from, to] = CAMS[id];
    placeCamera(camera as THREE.PerspectiveCamera, from, to, L, a.len, size.width / size.height);
    const inSpace = id === "messages";
    if (surface.current) surface.current.visible = !inSpace;
    if (space.current) space.current.visible = inSpace;
    scene.background = inSpace ? bg.space : bg.ground;
    const r = rover.current;
    if (r) {
      r.position.set(0, 0, 0);
      r.rotation.set(0, 0, 0);
      if (id === "stuck") {
        const out = win(L, a.len * 0.55, a.len * 0.9);
        r.position.set(out * 2.2, -0.18 * (1 - out), 0);
        r.rotation.z = -0.08 * (1 - out) + (motion.reduced ? 0 : Math.sin(L * 9) * 0.01 * (1 - out) * (L > a.len * 0.45 ? 1 : 0));
      }
      if (id === "marathon") {
        const k = power2InOut(win(L, 0.4, a.len * 0.8));
        r.position.set(-k * 9, 0, Math.sin(k * 6) * 0.5);
        r.rotation.y = Math.PI;
      }
      if (id === "endeavour") (r.position.set(0, 0, -21), r.scale.setScalar(1));
      if (id === "rest") (r.position.set(0.5, 0, -1), r.rotation.set(0, 0.6, 0));
      // the mast "looks around" a little in the first shot
    }
    if (percy.current) {
      percy.current.visible = id === "rest";
      const k = win(L, a.shot.lines[1] ? a.shot.lines[1].start - a.shot.start : a.len * 0.5, a.len);
      percy.current.position.set(-16 + k * 7, 0, -20);
    }
    if (rim.current) rim.current.visible = id === "crater" || id === "blueberries" || id === "sea";
    if (berries.current) {
      berries.current.visible = id === "blueberries" || id === "sea";
      const roll = id === "blueberries" ? backOut(win(L, 1.2, 2.6)) : 1;
      const b0 = berries.current.children[0];
      if (b0) b0.position.set(1.6 - roll * 0.5, 0.06, 1.7);
    }
    // the ancient sea: ghost water rises, ripples spread, then fades
    const seaK = id === "sea" ? win(L, 0.8, 3.2) * (1 - win(L, a.len - 1.2, a.len)) : 0;
    if (sea.current) {
      sea.current.visible = seaK > 0.001;
      sea.current.position.y = -0.2 + seaK * 0.9;
      (sea.current.material as THREE.MeshBasicMaterial).opacity = 0.42 * seaK;
    }
    if (ripples.current)
      ripples.current.children.forEach((c, i) => {
        const ph = ((L * 0.35 + i / 3) % 1) * (motion.reduced ? 0 : 1);
        c.scale.setScalar(1 + ph * 3);
        c.position.y = -0.2 + seaK * 0.9 + 0.01;
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = seaK * (1 - ph) * 0.6;
      });
    // power: dust dims the panels, the meter falls; a gust clears them and the meter jumps back
    const dust = id === "power" ? win(L, 0.6, a.len * 0.45) * (1 - win(L, a.len * 0.55, a.len * 0.7)) : id === "storm" ? win(L, 0.5, a.len * 0.6) : id === "rest" ? 0.6 : 0;
    if (dustPanels.current) dustPanels.current.opacity = dust * 0.85;
    if (meter.current) meter.current.visible = id === "power" || id === "storm";
    if (meterFill.current) {
      const p = Math.max(0.06, 1 - dust * 0.9);
      meterFill.current.scale.y = p;
      meterFill.current.position.y = -0.6 + p * 0.6;
      (meterFill.current.material as THREE.MeshBasicMaterial).color.set(p > 0.5 ? "#9CC9A6" : p > 0.25 ? "#F2D68A" : "#F0A0A0");
    }
    if (gust.current) {
      const g = id === "power" ? win(L, a.len * 0.5, a.len * 0.75) : 0;
      gust.current.visible = g > 0 && g < 1 && !motion.reduced;
      gust.current.children.forEach((c, i) => c.position.set(-4 + g * 9 + (i % 4) * 0.4, 0.9 + (i % 5) * 0.12, -0.6 + (i % 3) * 0.6));
    }
    if (dune.current) dune.current.visible = id === "stuck";
    if (ribbon.current) ribbon.current.visible = id === "marathon";
    trail.current = id === "marathon" ? power2InOut(win(L, 0.4, a.len * 0.8)) : 0;
    if (endeavour.current) endeavour.current.visible = id === "endeavour";
    // the 2018 storm: the sky goes dim and dust swirls
    const storm = id === "storm" ? win(L, 0.3, 2.5) : 0;
    sky.uniforms.uStorm.value = storm;
    sky.uniforms.uDusk.value = id === "rest" ? win(L, 0, 3) * 0.8 : 0;
    if (key.current) key.current.intensity = 2.3 * (1 - storm * 0.6) * (id === "rest" ? 0.75 : 1);
    if (swirl.current) {
      swirl.current.visible = storm > 0 && !motion.reduced;
      swirl.current.children.forEach((c, i) => {
        const ang = L * (0.6 + hash(i) * 0.5) + i;
        const rad = 2 + hash(i + 3) * 6;
        c.position.set(Math.cos(ang) * rad, 0.4 + hash(i + 7) * 3, Math.sin(ang) * rad);
      });
    }
    // messages: dotted signal waves travel from Earth to Mars, over and over
    if (signals.current)
      signals.current.children.forEach((c, i) => {
        const k = ((L * 0.45 + i / signals.current!.children.length) % 1) * (motion.reduced ? 0.5 : 1);
        c.position.set(-9 + k * 18, Math.sin(k * Math.PI) * 2.2, 0);
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI);
      });
  });

  return (
    <>
      <hemisphereLight args={["#FFF1E2", "#6A4A5A", 0.95]} />
      <ambientLight intensity={0.3} color="#E7C9B8" />
      <directionalLight ref={key} position={[-10, 14, 9]} intensity={2.3} color="#FFE2C2" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
      <directionalLight position={[10, 5, -12]} intensity={0.6} color="#9FB4FF" />
      <group ref={surface}>
        <mesh material={sky} renderOrder={-1}>
          <sphereGeometry args={[500, 32, 16]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={ground} receiveShadow>
          <circleGeometry args={[180, 64]} />
        </mesh>
        {Array.from({ length: 40 }, (_, i) => (
          <mesh key={i} position={[Math.sin(i * 9.3) * (6 + i * 0.7), 0.06, Math.cos(i * 5.7) * (8 + i * 0.6)]} scale={[0.3 + (i % 3) * 0.25, 0.12 + (i % 4) * 0.06, 0.28 + (i % 5) * 0.1]} material={rock}>
            <dodecahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
        <mesh ref={rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={rampMaterial("#a8754f", { flat: true })} scale={[1, 1, 0.35]}>
          <torusGeometry args={[4.6, 0.55, 8, 48]} />
        </mesh>
        <group ref={outlined}>
          <group ref={rover}>
            <Rover />
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 1.17, 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
                <planeGeometry args={[1.05, 1.58]} />
                <meshBasicMaterial ref={s < 0 ? dustPanels : undefined} color="#B07A55" transparent opacity={0} depthWrite={false} />
              </mesh>
            ))}
          </group>
          <group ref={percy} scale={1.25} rotation={[0, Math.PI / 2, 0]}>
            <Rover newer />
          </group>
        </group>
        <group ref={berries}>
          {Array.from({ length: 26 }, (_, i) => (
            <mesh key={i} position={[1.2 + (hash(i) - 0.5) * 1.6, 0.05, 1.4 + (hash(i + 11) - 0.5) * 1.4]} material={greyBerry} scale={0.028 + hash(i + 5) * 0.018}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
          ))}
        </group>
        <mesh ref={sea} rotation={[-Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
          <circleGeometry args={[14, 48]} />
          <meshBasicMaterial color="#7FB8D6" transparent opacity={0} depthWrite={false} />
        </mesh>
        <group ref={ripples} userData={{ noOutline: true }}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[1, 0, 1]}>
              <ringGeometry args={[0.9, 1.0, 48]} />
              <meshBasicMaterial color="#E8F4FA" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
        {/* the power meter: a little 3D gauge beside the rover */}
        <group ref={meter} position={[2.6, 1.4, 0.4]}>
          <mesh material={metal}>
            <boxGeometry args={[0.36, 1.32, 0.2]} />
          </mesh>
          <mesh ref={meterFill} position={[0, 0, 0.11]} userData={{ noOutline: true }}>
            <planeGeometry args={[0.26, 1.2]} />
            <meshBasicMaterial color="#9CC9A6" />
          </mesh>
          <mesh position={[0, 0.82, 0]} userData={{ noOutline: true }}>
            <sphereGeometry args={[0.13, 14, 10]} />
            <meshBasicMaterial color={new THREE.Color("#FFE6A8").multiplyScalar(1.5)} toneMapped={false} />
          </mesh>
        </group>
        <group ref={gust} userData={{ noOutline: true }}>
          {Array.from({ length: 16 }, (_, i) => (
            <mesh key={i}>
              <planeGeometry args={[0.6, 0.03]} />
              <meshBasicMaterial color="#F4E3CF" transparent opacity={0.7} depthWrite={false} />
            </mesh>
          ))}
        </group>
        <mesh ref={dune} position={[0, -0.2, 0]} scale={[2.2, 0.55, 1.8]} material={sand}>
          <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <group ref={ribbon} position={[-9.6, 0, 0.2]}>
          {[-0.9, 0.9].map((z) => (
            <mesh key={z} position={[0, 0.6, z]} material={metal}>
              <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
            </mesh>
          ))}
          <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ noOutline: true }}>
            <planeGeometry args={[0.1, 1.8]} />
            <meshBasicMaterial color="#F2D68A" side={THREE.DoubleSide} />
          </mesh>
        </group>
        <DottedPath points={trailPts} reveal={trail} size={0.07} gap={0.3} color="#FFF2D6" />
        <mesh ref={endeavour} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -48]} scale={[1, 1, 0.08]} material={rampMaterial("#9b6a48", { flat: true })}>
          <torusGeometry args={[26, 3.2, 10, 64]} />
        </mesh>
        <group ref={swirl} userData={{ noOutline: true }}>
          {Array.from({ length: 60 }, (_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.05 + hash(i) * 0.08, 6, 4]} />
              <meshBasicMaterial color="#C99872" transparent opacity={0.6} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      <group ref={space} visible={false}>
        <StillStars count={600} />
        <Earth radius={2.2} position={[-10, 0, 0]} />
        <mesh position={[10, 0, 0]} material={rampMaterial("#b8714c", { character: true })}>
          <sphereGeometry args={[1.6, 40, 24]} />
        </mesh>
        <group ref={signals} userData={{ noOutline: true }}>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i}>
              <torusGeometry args={[0.35, 0.05, 6, 20, Math.PI]} />
              <meshBasicMaterial color={new THREE.Color("#BFE6FF").multiplyScalar(1.4)} toneMapped={false} transparent />
            </mesh>
          ))}
        </group>
      </group>
      <Veil clock={clock} getVeil={(t) => ({ ...at(CH2_STORY, t), center: [0.55, 0.45] })} />
      <OdysseyPost ink="#4A2C22" near={12} far={70} />
      <OutlineSync />
    </>
  );
}
