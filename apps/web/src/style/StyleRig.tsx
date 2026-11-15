import { EdgeLines, type InkWorld } from "../fx/EdgeLines";
import { OutlineSync } from "../fx/outline";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { windTime } from "./toon";
import { where } from "../ship/layout";
import { activeLook, fx, setWorldLook, type WorldLook } from "../fx/uniforms";
import { Grade } from "../fx/grade";

export type Quality = "high" | "low" | "off";
/** dev flags to measure each effect's cost: ?nopost ?noshadow ?nobloom ?noao ?nosmaa ?notilt */
export const FX_OFF = new Set(typeof location !== "undefined" ? [...new URLSearchParams(location.search).keys()] : []);

/** Weak devices start on Low; the in-game performance monitor can drop further. */
export function autoQuality(): Quality {
  // start everyone on Low (a random laptop must hit the frame budget, bible §18);
  // the in-game PerformanceMonitor upgrades to High when there is clear headroom
  return "low";
}

/** Shadow and resolution budget per quality level. */
export const QUALITY = {
  high: { shadows: true, shadowMap: 2048, dpr: [1, 1.5] as [number, number], bloom: false, tilt: false, multisampling: 0, ao: false },
  low: { shadows: true, shadowMap: 2048, dpr: [1, 1.25] as [number, number], bloom: false, tilt: false, multisampling: 0, ao: false },
  off: { shadows: false, shadowMap: 1024, dpr: [1, 1] as [number, number], bloom: false, tilt: false, multisampling: 0, ao: false },
};

/**
 * "Quiet Afternoon" light (bible §12): a hemisphere for anything not on the ramp shader, and ONE
 * sun that follows the player with a tight shadow box, so shadows stay sharp where you are.
 * The ramp shader reads this sun's direction and shadow. Base: warm dome light, high.
 */
const SUN = {
  base: { polar: Math.PI * 0.3, azimuth: Math.PI * -1.75, color: "#FFE9CF" }, // warm, low afternoon sun: long soft shadows
  moon: { polar: Math.PI * 0.37, azimuth: Math.PI * -1.6, color: "#FFFFFF" }, // low and harsh (Apollo 11 landed in early lunar morning)
  mars: { polar: Math.PI * 0.27, azimuth: Math.PI * -1.8, color: "#FFE2BE" },
};
export function SunRig({
  look,
  quality,
  follow,
  size = 12,
}: {
  look: WorldLook;
  quality: Quality;
  /** where the shadow box centres (player); defaults to the base explorer */
  follow?: () => { x: number; z: number };
  size?: number;
}) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const q = QUALITY[quality];
  const off = useMemo(() => new THREE.Vector3().setFromSphericalCoords(40, SUN[look].polar, SUN[look].azimuth), [look]);
  useEffect(() => {
    setWorldLook(look);
  }, [look]);
  useFrame((_, dt) => {
    // the base and a chapter share the uniforms: whoever is rendering owns the look
    if (activeLook() !== look) setWorldLook(look);
    fx.uTime.value += dt;
    windTime.value += dt;
    const s = sun.current;
    if (!s) return;
    const p = follow ? follow() : where;
    // snap the box to shadow texels so edges don't shimmer while walking
    const step = (size * 2) / q.shadowMap;
    const x = Math.round(p.x / step) * step,
      z = Math.round(p.z / step) * step;
    s.position.set(x + off.x, off.y, z + off.z);
    s.target.position.set(x, 0, z);
    s.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={["#33434f", "#737575", 0.7]} />
      <directionalLight
        ref={sun}
        intensity={2.2}
        color={SUN[look].color}
        castShadow={q.shadows && !FX_OFF.has("noshadow")}
        shadow-mapSize={[q.shadowMap, q.shadowMap]}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.07}
        shadow-radius={look === "moon" ? 1.5 : 4}
      />
      {/* visors and glass still like something soft to reflect */}
      <Environment resolution={32} frames={1}>
        <Lightformer form="rect" intensity={2} color="#FFE9CF" position={[0, 6, 4]} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#C9B8FF" position={[-6, 3, -4]} scale={4} />
      </Environment>
    </>
  );
}

/** Kept for the old call sites: the base uses the warm dome light. */
export function LightingRig({ quality }: { quality: Quality; lamps?: [number, number, number][] }) {
  return <SunRig look="base" quality={quality} />;
}

/** The final pass: SMAA + the world's LUT grade (no bloom, no tilt-shift, no AO any more). */
export function DioramaPost({ look = "base", world }: { quality?: Quality; tiltShift?: boolean; look?: WorldLook; world?: InkWorld }) {
  return (
    <>
      <OutlineSync />
      <Grade look={look} off={FX_OFF.has("nopost")} />
      <EdgeLines world={world ?? (look === "moon" ? "moon" : look === "mars" ? "mars" : "ship")} />
    </>
  );
}
