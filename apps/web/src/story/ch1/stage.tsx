// Shared 3D stage for Chapter 1 scenes: one Canvas with the ramp look, the right sun per place,
// the grade, adaptive DPR, a camera that follows authored rails, a gentle shake (off in reduced
// motion), plus a low engine rumble made in Tone.js.
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import * as Tone from "tone";
import { SunRig, FX_OFF, DioramaPost } from "../../style/StyleRig";
import { Grade } from "../../fx/grade";
import { isLegacyStyle } from "../../style/styleMode";
import { AdaptiveDpr } from "../../fx/AdaptiveDpr";
import { motion } from "../../anim/kit";
import { audio } from "../../audio/engine";
import { fx } from "../../fx/uniforms";

export type Shot = { pos: [number, number, number]; look: [number, number, number]; fov?: number };
export type CamCtl = { from: Shot; to: Shot; k: number; shake: number; follow?: () => THREE.Vector3 | null };
export const newCam = (s: Shot): CamCtl => ({ from: s, to: s, k: 1, shake: 0 });
export const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10)); // smootherstep

const v1 = new THREE.Vector3(),
  v2 = new THREE.Vector3(),
  l1 = new THREE.Vector3(),
  l2 = new THREE.Vector3();
function RailCamera({ cam }: { cam: MutableRefObject<CamCtl> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame((s) => {
    const c = cam.current;
    const k = ease(c.k);
    v1.set(...c.from.pos);
    v2.set(...c.to.pos);
    l1.set(...c.from.look);
    l2.set(...c.to.look);
    camera.position.lerpVectors(v1, v2, k);
    look.current.lerpVectors(l1, l2, k);
    const f = c.follow?.();
    if (f) look.current.copy(f);
    const p = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.lerp(c.from.fov ?? 45, c.to.fov ?? 45, k);
    if (Math.abs(p.fov - fov) > 0.01) {
      p.fov = fov;
      p.updateProjectionMatrix();
    }
    if (c.shake > 0 && !motion.reduced) {
      const t = s.clock.elapsedTime;
      camera.position.x += Math.sin(t * 37) * 0.04 * c.shake;
      camera.position.y += Math.sin(t * 43 + 1) * 0.04 * c.shake;
    }
    camera.lookAt(look.current);
  });
  return null;
}

export function Stage({ look, cam, sky, children, night = false }: { look: "base" | "moon" | "mars"; cam: MutableRefObject<CamCtl>; sky: string; children: ReactNode; night?: boolean }) {
  // the ship's near-camera line dither would cut holes in close-ups (boot print, plaque): off here
  useEffect(() => {
    const n = fx.uFadeNear.value,
      f = fx.uFadeFar.value;
    fx.uFadeNear.value = 0;
    fx.uFadeFar.value = 0;
    return () => {
      fx.uFadeNear.value = n;
      fx.uFadeFar.value = f;
    };
  }, []);
  return (
    <Canvas
      className="ch1-canvas"
      shadows
      dpr={isLegacyStyle() ? [1, 1.5] : Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)}
      camera={{ fov: isLegacyStyle() ? 45 : 35, near: 0.01, far: 2000, position: cam.current.from.pos }}
      gl={{
        antialias: true,
        toneMapping: isLegacyStyle() ? THREE.NoToneMapping : THREE.CineonToneMapping,
        toneMappingExposure: isLegacyStyle() ? 1.0 : 1.75,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl, scene }) => {
        if (!isLegacyStyle()) {
          gl.setClearColor(look === "moon" ? "#000000" : "#211d20");
          if (look !== "moon") {
            scene.fog = new THREE.Fog("#dfe9f3", 1.4, 86);
          }
        }
      }}
    >
      <color attach="background" args={[sky]} />
      <AdaptiveDpr />
      {night ? <><ambientLight intensity={.25} color="#94a7bf"/><directionalLight position={[-8,15,12]} intensity={.7} color="#c1ccd9"/></> : <SunRig look={look} quality="high" size={22} follow={() => ({ x: 0, z: 0 })} />}
      <RailCamera cam={cam} />
      <Suspense fallback={null}>{children}</Suspense>
      <DioramaPost look={look} world={look === "moon" ? "moon" : "earth"} />
    </Canvas>
  );
}

/** a big vertical-gradient sky sphere (Earth morning, or deep space) */
export function SkySphere({ top, bottom, radius = 600 }: { top: string; bottom: string; radius?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bottom) } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 a; uniform vec3 b; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.6, vP.y); gl_FragColor = vec4(mix(b, a, k), 1.0); }`,
      }),
    [top, bottom],
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}

/** a few still stars on a sphere */
export function StillStars({ count = 900, radius = 500 }: { count?: number; radius?: number }) {
  const geo = useMemo(() => {
    let s = 9;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1,
        a = r() * Math.PI * 2,
        q = Math.sqrt(1 - u * u);
      p.set([Math.cos(a) * q * radius, u * radius, Math.sin(a) * q * radius], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count, radius]);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ECE6DA" size={1.4} sizeAttenuation={false} transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}

/** low engine rumble (brown noise through a low-pass), level 0..1 */
export function makeRumble() {
  let noise: Tone.Noise | null = null;
  let gain: Tone.Gain | null = null;
  let filter: Tone.Filter | null = null;
  return {
    set(level: number) {
      if (!audio.ready) return;
      if (!noise) {
        gain = new Tone.Gain(0).connect(audio.bus("sfx"));
        filter = new Tone.Filter(160, "lowpass").connect(gain);
        noise = new Tone.Noise("brown").connect(filter).start();
      }
      gain!.gain.rampTo(level * 0.5, 0.4);
      filter!.frequency.rampTo(120 + level * 220, 0.4);
    },
    stop() {
      gain?.gain.rampTo(0, 0.6);
      const n = noise,
        g = gain,
        f = filter;
      setTimeout(() => {
        n?.stop().dispose();
        f?.dispose();
        g?.dispose();
      }, 900);
      noise = null;
      gain = null;
      filter = null;
    },
  };
}
