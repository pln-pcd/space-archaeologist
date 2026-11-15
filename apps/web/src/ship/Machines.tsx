import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { life } from "../anim/kit";
import { dusty, toonUnique } from "../style/toon";

/*
 * Chunky, simplified but faithful models of each chapter's real machine. Silhouettes and key
 * parts follow the real hardware (no invented features):
 *  - Eagle (Apollo 11 lunar module): gold-foil octagonal descent stage, four legs with round
 *    footpads, a ladder on the front leg, and the ascent stage on top.
 *  - Opportunity (MER rover): six wheels, a flat solar-panel deck with fold-out wings, and a
 *    mast with the camera head.
 *  - Viking 1 lander: six-sided body, three legs, high-gain dish on a mast, RTG covers,
 *    sampler arm and two camera turrets.
 *  - Pioneer 10: big white dish, hexagonal bus, two RTG booms and a magnetometer boom.
 *  - Voyager 1: big white dish, ten-sided bus, RTG boom, long magnetometer boom, science boom
 *    and the golden record.
 * Dormant machines are dusty and desaturated; they wake with warm colour and glowing lights.
 */

type Paint = { mat: THREE.MeshLambertMaterial; color: string };
function usePaints(colors: Record<string, string>) {
  return useMemo(() => {
    const out: Record<string, Paint> = {};
    for (const [k, c] of Object.entries(colors)) out[k] = { mat: toonUnique(c, { flat: false }), color: c };
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
function useLights(color: string) {
  return useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
}

/** Shared wake logic: recolour from dusty to real, power lights, small "alive" twitches. */
function useWake(awake: MutableRefObject<number>, paints: Record<string, Paint>, light: THREE.MeshBasicMaterial, lightColor: string, extra?: (a: number, t: number) => void) {
  const last = useRef(-1);
  useFrame((s) => {
    const a = awake.current;
    const t = s.clock.elapsedTime;
    if (Math.abs(a - last.current) > 0.002) {
      for (const p of Object.values(paints)) p.mat.color.copy(dusty(p.color, 1 - a));
      last.current = a;
    }
    // status light: dim while asleep, steady once awake (no flicker, no pulse)
    light.color.set(lightColor).multiplyScalar(0.35 + a * 0.65);
    extra?.(a, t);
  });
}

export function MiniMachine({ id, awake }: { id: string; awake: MutableRefObject<number> }) {
  switch (id) {
    case "eagle":
      return <MiniLander awake={awake} />;
    case "opportunity":
      return <MiniRover awake={awake} />;
    case "viking":
      return <MiniViking awake={awake} />;
    case "pioneer":
      return <MiniProbe awake={awake} kind="pioneer" />;
    default:
      return <MiniProbe awake={awake} kind="voyager" />;
  }
}

function MiniLander({ awake }: { awake: MutableRefObject<number> }) {
  const p = usePaints({ gold: "#C99A3D", silver: "#B9B6B0", dark: "#3A3836", leg: "#A8936A" });
  const light = useLights("#6A8C70");
  const asc = useRef<THREE.Group>(null);
  useWake(awake, p, light, "#6A8C70", (a, t) => {
    if (asc.current) asc.current.position.y = 0.62; // the ascent stage sits still (realistic)
  });
  return (
    <group scale={0.62}>
      <mesh position={[0, 0.42, 0]} material={p.gold.mat} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.34, 8]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(a) * 0.38, 0.4, Math.sin(a) * 0.38]} rotation={[0, -a, 0]}>
            <mesh position={[0.14, -0.18, 0]} rotation={[0, 0, 0.6]} material={p.leg.mat}>
              <cylinderGeometry args={[0.03, 0.03, 0.46, 8]} />
            </mesh>
            <mesh position={[0.28, -0.37, 0]} material={p.leg.mat} castShadow>
              <cylinderGeometry args={[0.1, 0.11, 0.04, 14]} />
            </mesh>
          </group>
        );
      })}
      {/* ladder on the front leg */}
      <group position={[0, 0.18, 0.42]} rotation={[-0.32, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, i * 0.08, 0]} material={p.silver.mat}>
            <boxGeometry args={[0.14, 0.015, 0.02]} />
          </mesh>
        ))}
      </group>
      <group ref={asc} position={[0, 0.62, 0]}>
        <RoundedBox args={[0.56, 0.36, 0.48]} radius={0.12} material={p.silver.mat} castShadow />
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.04, 0.245]} material={p.dark.mat}>
            <circleGeometry args={[0.05, 3]} />
          </mesh>
        ))}
        <mesh position={[0.22, 0.24, -0.06]} rotation={[-0.8, 0, 0.4]} material={p.silver.mat}>
          <sphereGeometry args={[0.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
        </mesh>
      </group>
    </group>
  );
}

function MiniRover({ awake }: { awake: MutableRefObject<number> }) {
  const p = usePaints({ body: "#E6DCCB", panel: "#34404F", wheel: "#57534F", mast: "#C9C2B4" });
  const light = useLights("#6A8C70");
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  useWake(awake, p, light, "#6A8C70", (a, t) => {
    // solar wings unfold a little as it wakes
    if (wingL.current) wingL.current.rotation.z = 0.9 * (1 - a);
    if (wingR.current) wingR.current.rotation.z = -0.9 * (1 - a);
    if (head.current) head.current.rotation.y = Math.sin(t * 0.7) * 0.5 * a * life();
    // wheels stay still while parked
  });
  return (
    <group scale={0.62} position={[0, 0.04, 0]}>
      <RoundedBox args={[0.7, 0.24, 0.5]} radius={0.08} position={[0, 0.34, 0]} material={p.body.mat} castShadow />
      <group position={[0, 0.5, 0]}>
        <RoundedBox args={[0.78, 0.04, 0.58]} radius={0.02} material={p.panel.mat} />
        <group ref={wingL} position={[-0.39, 0, 0]}>
          <RoundedBox args={[0.34, 0.04, 0.5]} radius={0.02} position={[-0.17, 0, 0]} material={p.panel.mat} />
        </group>
        <group ref={wingR} position={[0.39, 0, 0]}>
          <RoundedBox args={[0.34, 0.04, 0.5]} radius={0.02} position={[0.17, 0, 0]} material={p.panel.mat} />
        </group>
      </group>
      <group ref={wheels}>
        {[-0.24, 0, 0.24].flatMap((z) =>
          [-0.38, 0.38].map((x) => (
            <mesh key={`${x}${z}`} position={[x, 0.12, z]} rotation={[0, 0, Math.PI / 2]} material={p.wheel.mat} castShadow>
              <cylinderGeometry args={[0.11, 0.11, 0.09, 14]} />
            </mesh>
          )),
        )}
      </group>
      <mesh position={[0.18, 0.78, 0.18]} material={p.mast.mat}>
        <cylinderGeometry args={[0.03, 0.035, 0.56, 8]} />
      </mesh>
      <group ref={head} position={[0.18, 1.08, 0.18]}>
        <RoundedBox args={[0.26, 0.12, 0.14]} radius={0.04} material={p.mast.mat} castShadow />
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 0, 0.075]} material={light}>
            <circleGeometry args={[0.03, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function MiniViking({ awake }: { awake: MutableRefObject<number> }) {
  const p = usePaints({ body: "#C9C2B4", leg: "#A8936A", dish: "#ECE6DA", rtg: "#3A3836" });
  const light = useLights("#6A8C70");
  const dish = useRef<THREE.Group>(null);
  useWake(awake, p, light, "#6A8C70", (a, t) => {
    if (dish.current) dish.current.rotation.y = 0.4 + Math.sin(t * 0.6) * 0.3 * a * life();
  });
  return (
    <group scale={0.62}>
      <mesh position={[0, 0.42, 0]} material={p.body.mat} castShadow>
        <cylinderGeometry args={[0.4, 0.42, 0.2, 6]} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <group key={i} position={[Math.cos(a) * 0.34, 0.4, Math.sin(a) * 0.34]} rotation={[0, -a, 0]}>
            <mesh position={[0.12, -0.18, 0]} rotation={[0, 0, 0.6]} material={p.leg.mat}>
              <cylinderGeometry args={[0.03, 0.03, 0.42, 8]} />
            </mesh>
            <mesh position={[0.25, -0.36, 0]} material={p.leg.mat}>
              <cylinderGeometry args={[0.09, 0.1, 0.03, 12]} />
            </mesh>
          </group>
        );
      })}
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.12, 0.18, 0.12]} radius={0.03} position={[s * 0.26, 0.6, -0.2]} material={p.rtg.mat} />
      ))}
      <group ref={dish} position={[-0.12, 0.52, -0.06]}>
        <mesh position={[0, 0.2, 0]} material={p.leg.mat}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
        </mesh>
        <mesh position={[0, 0.42, 0.04]} rotation={[-1.1, 0, 0]} material={p.dish.mat}>
          <sphereGeometry args={[0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
        </mesh>
      </group>
      {[-0.08, 0.08].map((x) => (
        <group key={x} position={[0.16 + x, 0.62, 0.2]}>
          <mesh material={p.body.mat}>
            <cylinderGeometry args={[0.04, 0.04, 0.2, 10]} />
          </mesh>
          <mesh position={[0, 0.06, 0.042]} material={light}>
            <circleGeometry args={[0.022, 10]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.28, 0.46, 0.24]} rotation={[0.3, 0.6, 0]} material={p.leg.mat}>
        <boxGeometry args={[0.04, 0.04, 0.3]} />
      </mesh>
    </group>
  );
}

function MiniProbe({ awake, kind }: { awake: MutableRefObject<number>; kind: "pioneer" | "voyager" }) {
  const p = usePaints({ dish: "#ECE6DA", bus: "#B9B6B0", boom: "#C9C2B4", rtg: "#3A3836", record: "#A8936A" });
  const light = useLights("#6A8C70");
  const rig = useRef<THREE.Group>(null);
  const boom = useRef<THREE.Group>(null);
  useWake(awake, p, light, "#6A8C70", (a, t) => {
    if (rig.current) rig.current.rotation.y = Math.sin(t * 0.4) * 0.35 * a * life() - 0.3;
    if (boom.current) boom.current.rotation.z = 1.2 + Math.sin(t * 2.4) * 0.06 * a * life();
  });
  const big = kind === "voyager";
  return (
    <group ref={rig} scale={0.6} position={[0, 0.62, 0]} rotation={[0, -0.3, 0]}>
      <group rotation={[-0.55, 0, 0]}>
        {/* dish faces the explorer, tilted up */}
        <mesh position={[0, 0.0, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={p.dish.mat} castShadow>
          <sphereGeometry args={[big ? 0.62 : 0.52, 28, 10, 0, Math.PI * 2, 0, Math.PI / 4.2]} />
        </mesh>
        <mesh position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]} material={p.boom.mat}>
          <cylinderGeometry args={[0.015, 0.015, 0.42, 6]} />
        </mesh>
        <mesh position={[0, -0.02, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={p.bus.mat} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.18, big ? 10 : 6]} />
        </mesh>
        <mesh position={[0, -0.02, -0.03]} material={light}>
          <circleGeometry args={[0.05, 12]} />
        </mesh>
        {/* RTG boom(s) */}
        {(big ? [-2.2] : [-2.0, 2.0]).map((a) => (
          <group key={a} position={[0, 0, -0.2]} rotation={[0, 0, a]}>
            <mesh position={[0, 0.34, 0]} material={p.boom.mat}>
              <cylinderGeometry args={[0.014, 0.014, 0.68, 6]} />
            </mesh>
            {[0, 1].map((i) => (
              <mesh key={i} position={[0, 0.62 + i * 0.1, 0]} material={p.rtg.mat}>
                <cylinderGeometry args={[0.06, 0.06, 0.09, 10]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* magnetometer boom (long, thin) */}
        <group ref={boom} position={[0, 0, -0.2]} rotation={[0, 0, 1.2]}>
          <mesh position={[0, big ? 0.6 : 0.45, 0]} material={p.boom.mat}>
            <cylinderGeometry args={[0.008, 0.008, big ? 1.2 : 0.9, 5]} />
          </mesh>
        </group>
        {big && (
          <>
            {/* science boom with the instrument platform */}
            <group position={[0, 0, -0.2]} rotation={[0, 0, 0.5]}>
              <mesh position={[0, 0.3, 0]} material={p.boom.mat}>
                <cylinderGeometry args={[0.014, 0.014, 0.6, 6]} />
              </mesh>
              <RoundedBox args={[0.14, 0.1, 0.1]} radius={0.03} position={[0, 0.62, 0]} material={p.dish.mat} />
            </group>
            {/* the golden record */}
            <mesh position={[0.12, -0.02, -0.3]} rotation={[Math.PI / 2, 0, 0]} material={p.record.mat}>
              <cylinderGeometry args={[0.08, 0.08, 0.01, 20]} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

