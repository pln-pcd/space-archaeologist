// The loading screen (v7.4): a tiny three.js space scene instead of a card. A chubby toon planet with
// a ring spins in the middle, a little rocket loops around it leaving a sparkle trail, a baby moon
// orbits the other way, and the stars twinkle. A candy progress bar and a rotating space tip sit
// underneath. One light WebGL canvas (no post, DPR 1) that only lives while something is loading.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { motion } from "../../anim/kit";
import { toonRamp } from "../look";

const TIPS = [
  "The Moon has no wind, so footprints can stay for a very long time.",
  "Click the ground to walk there when you explore.",
  "Press N anytime on the ship to talk with Nova.",
  "Hold Space to send a scanner pulse when you explore.",
  "Opportunity was built for 90 days on Mars.",
  "Scientists still bounce lasers off a reflector left on the Moon.",
];

const mat = (color: string, emissive = "#000000") => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), emissive });

function Rocket() {
  const flame = useRef<THREE.Mesh>(null);
  const body = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, -0.42],
          [0.17, -0.4],
          [0.22, -0.2],
          [0.23, 0.05],
          [0.19, 0.28],
          [0.1, 0.44],
          [0, 0.5],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        24,
      ),
    [],
  );
  useFrame((s) => {
    if (!flame.current) return;
    const k = motion.reduced ? 1 : 0.85 + Math.sin(s.clock.elapsedTime * 40) * 0.15;
    flame.current.scale.set(k, 0.8 + k * 0.4, k);
  });
  return (
    <group>
      <mesh geometry={body} material={mat("#FFFFFF")} />
      <mesh position={[0, 0.4, 0]} material={mat("#FF6FA8")}>
        <coneGeometry args={[0.13, 0.22, 20]} />
      </mesh>
      <mesh position={[0, 0.1, 0.2]} material={mat("#5BB8FF", "#1E5A9C")}>
        <sphereGeometry args={[0.08, 16, 12]} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.22, -0.3, Math.sin(a) * 0.22]} rotation={[0, -a, 0]} material={mat("#FF6FA8")}>
            <boxGeometry args={[0.18, 0.2, 0.04]} />
          </mesh>
        );
      })}
      <mesh ref={flame} position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.32, 14]} />
        <meshBasicMaterial color="#FFD23F" toneMapped={false} />
      </mesh>
    </group>
  );
}

const TRAIL = 22;
function Scene() {
  const planet = useRef<THREE.Group>(null);
  const rocket = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const hist = useRef<THREE.Vector3[]>(Array.from({ length: TRAIL }, () => new THREE.Vector3(0, 0, -50)));
  const stars = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(500 * 3);
    let s = 7;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 500; i++) p.set([(r() - 0.5) * 40, (r() - 0.5) * 24, -6 - r() * 14], i * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const starMat = useRef<THREE.PointsMaterial>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame((s, dt) => {
    const t = motion.reduced ? 1.2 : s.clock.elapsedTime;
    if (planet.current) {
      planet.current.rotation.y = t * 0.35;
      planet.current.position.y = Math.sin(t * 1.3) * 0.06;
    }
    // the rocket loops a tilted ellipse, nose along its path
    const a = t * 1.6;
    const pos = new THREE.Vector3(Math.cos(a) * 2.25, Math.sin(a) * 0.55 + Math.sin(a * 2) * 0.12, Math.sin(a) * 1.3);
    const ahead = new THREE.Vector3(Math.cos(a + 0.05) * 2.25, Math.sin(a + 0.05) * 0.55 + Math.sin((a + 0.05) * 2) * 0.12, Math.sin(a + 0.05) * 1.3);
    if (rocket.current) {
      rocket.current.position.copy(pos);
      rocket.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ahead.sub(pos).normalize());
    }
    // sparkle trail behind it
    if (!motion.reduced) {
      hist.current.pop();
      hist.current.unshift(pos.clone());
    }
    if (trail.current) {
      hist.current.forEach((p, i) => {
        tmp.position.copy(p);
        tmp.scale.setScalar(Math.max(0.001, 0.07 * (1 - i / TRAIL)));
        tmp.rotation.set(t * 2 + i, t + i, 0);
        tmp.updateMatrix();
        trail.current!.setMatrixAt(i, tmp.matrix);
      });
      trail.current.instanceMatrix.needsUpdate = true;
    }
    if (moon.current) moon.current.position.set(Math.cos(-t * 0.7 + 2) * 2.9, 0.9 + Math.sin(-t * 0.7) * 0.25, Math.sin(-t * 0.7 + 2) * 1.2 - 0.6);
    if (starMat.current) starMat.current.opacity = 0.65 + Math.sin(t * 2.2) * 0.25;
    void dt;
  });
  return (
    <>
      <ambientLight intensity={1.2} color="#E7DDFF" />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#FFF4E0" />
      <directionalLight position={[-4, -1, -2]} intensity={0.8} color="#FF8FD0" />
      <points geometry={stars}>
        <pointsMaterial ref={starMat} color="#FFF3C4" size={0.08} transparent opacity={0.8} depthWrite={false} />
      </points>
      <group ref={planet} rotation={[0.25, 0, -0.18]}>
        <mesh material={mat("#C98BFF")}>
          <sphereGeometry args={[1.05, 48, 32]} />
        </mesh>
        {/* soft candy stripes */}
        {[-0.45, 0.1, 0.55].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(i === 1 ? "#FFB3D9" : "#A87BFF")}>
            <torusGeometry args={[Math.sqrt(1.05 * 1.05 - y * y) - 0.012, 0.032, 8, 64]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2 - 0.25, 0, 0]} material={mat("#FFE27A", "#5A3A00")}>
          <torusGeometry args={[1.6, 0.07, 10, 80]} />
        </mesh>
      </group>
      <mesh ref={moon} material={mat("#E8E4F2")}>
        <sphereGeometry args={[0.26, 24, 16]} />
      </mesh>
      <group ref={rocket} scale={0.7}>
        <Rocket />
      </group>
      <instancedMesh ref={trail} args={[undefined, undefined, TRAIL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#FFE27A" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

export default function GameLoading({ label = "Getting ready…" }: { label?: string }) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const iv = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3800);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="g-loading gl-3d od-free" role="status" aria-live="polite">
      <Canvas className="gl-canvas" dpr={1} camera={{ position: [0, 0.6, 6.2], fov: 42 }} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} aria-hidden="true">
        <Scene />
      </Canvas>
      <div className="gl-foot">
        <span className="gl-label">{label}</span>
        <div className="g-bar" aria-hidden="true">
          <b />
        </div>
        <small key={tip}>{TIPS[tip]}</small>
      </div>
    </div>
  );
}
