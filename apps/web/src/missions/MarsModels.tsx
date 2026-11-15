// v8 MARS FINDS (the after-p2 toon look, flat ramp materials like the rest of Ch2). Machines have no
// faces. Local units: about 2 wide, the ground at y = 0.
//   MarsLander     the opened lander: a triangle base, three petals lying open, deflated airbags
//                  bunched along the petal edges and the bridle rope coiled on top
//   EntryHardware  the heat shield (a shallow dark bowl), the backshell with its little rockets, and
//                  the parachute lying spread on the ground
import { useMemo } from "react";
import * as THREE from "three";
import { rampMaterial } from "../fx/ramp";

const M = (c: string) => rampMaterial(c, { flat: true });

export function MarsLander() {
  const m = useMemo(() => ({ petal: M("#cfc6b4"), foil: M("#c5ac7d"), bag: M("#e9e2d2"), dark: M("#5b5470"), rope: M("#a49c8b") }), []);
  // a petal: an equilateral triangle hinged at the base edge
  const tri = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.62, 0);
    s.lineTo(0.62, 0);
    s.lineTo(0, 1.05);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
  }, []);
  const bags = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let p = 0; p < 3; p++) {
      const a = (p / 3) * Math.PI * 2;
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) * 0.24;
        const r = 1.05 + Math.sin(i * 2.1 + p) * 0.06;
        out.push([Math.cos(a) * r - Math.sin(a) * t, 0.13 + (i % 2) * 0.04, Math.sin(a) * r + Math.cos(a) * t, 0.17 + ((i + p) % 3) * 0.03]);
      }
    }
    return out;
  }, []);
  return (
    <group>
      {/* the base: a low triangular platform */}
      <mesh position={[0, 0.1, 0]} material={m.foil}>
        <cylinderGeometry args={[0.62, 0.66, 0.16, 3]} />
      </mesh>
      {/* three petals, opened flat around the base (one is the ramp the rover drove down) */}
      {[0, 1, 2].map((p) => {
        const a = (p / 3) * Math.PI * 2;
        return (
          <group key={p} rotation={[0, a, 0]}>
            <group position={[0, 0.06, -0.31]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh geometry={tri} material={m.petal} />
            </group>
          </group>
        );
      })}
      {/* deflated airbags bunched along the petal edges */}
      {bags.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.6, 1]} material={m.bag}>
          <sphereGeometry args={[r, 10, 8]} />
        </mesh>
      ))}
      {/* the bridle rope, coiled on the base */}
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.rope}>
        <torusGeometry args={[0.22, 0.03, 6, 20]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={m.rope}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 6]} />
      </mesh>
    </group>
  );
}

export function EntryHardware() {
  const m = useMemo(() => ({ shield: M("#6b4a3a"), shieldRim: M("#8a6650"), shell: M("#e8e4dc"), dark: M("#4f4a5c"), chute: M("#f1ece2"), stripe: M("#e0784f"), cord: M("#9a9282") }), []);
  return (
    <group>
      {/* heat shield: a shallow upturned bowl, front left */}
      <group position={[-0.7, 0.16, 0.35]} rotation={[0.25, 0, -0.2]}>
        <mesh material={m.shield}>
          <cylinderGeometry args={[0.62, 0.12, 0.26, 24, 1, true]} />
        </mesh>
        <mesh position={[0, -0.13, 0]} material={m.shieldRim}>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.shieldRim}>
          <torusGeometry args={[0.62, 0.04, 6, 24]} />
        </mesh>
      </group>
      {/* backshell with three small rockets, centre back */}
      <group position={[0.15, 0.36, -0.35]}>
        <mesh material={m.shell}>
          <cylinderGeometry args={[0.22, 0.5, 0.5, 20]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} material={m.dark}>
          <cylinderGeometry args={[0.16, 0.22, 0.12, 16]} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.38, -0.05, Math.sin(a) * 0.38]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]} material={m.dark}>
              <cylinderGeometry args={[0.05, 0.06, 0.22, 8]} />
            </mesh>
          );
        })}
      </group>
      {/* the parachute lying spread on the ground, right, with its cords */}
      <group position={[0.85, 0.03, 0.25]} rotation={[0, 0.5, 0]}>
        <mesh scale={[1, 0.12, 0.8]} material={m.chute}>
          <sphereGeometry args={[0.62, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.stripe}>
          <ringGeometry args={[0.32, 0.4, 24]} />
        </mesh>
        {[-0.2, 0, 0.2].map((z) => (
          <mesh key={z} position={[-0.75, 0.05, z * 0.6]} rotation={[0, 0, Math.PI / 2]} material={m.cord}>
            <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
