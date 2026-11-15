// A small transparent stage that shows Nova over DOM screens (the name card, the check-in over the
// story's last frame). The same Nova3D model as everywhere else, framed close.
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Nova3D, { type NovaProps } from "./Nova3D";
import { Lights } from "../scene/props";
import { OutlineSync } from "../../fx/outline";

const FRAMES = {
  /** head, shoulders and hands: peeking over a card edge */
  peek: { pos: [0, 0.86, 1.75] as [number, number, number], look: [0, 0.76, 0] as [number, number, number], fov: 30 },
  /** the whole astronaut */
  full: { pos: [0, 0.6, 2.9] as [number, number, number], look: [0, 0.54, 0] as [number, number, number], fov: 30 },
};

export default function NovaStage({ frame = "full", className = "", ...nova }: NovaProps & { frame?: keyof typeof FRAMES; className?: string }) {
  const f = FRAMES[frame];
  return (
    <div className={`od-nova-stage ${className}`} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ fov: f.fov, position: f.pos, near: 0.05, far: 20 }}
        onCreated={({ camera }) => camera.lookAt(...f.look)}
      >
        <Suspense fallback={null}>
          <Lights />
          <Nova3D shadow={false} {...nova} />
          <OutlineSync />
        </Suspense>
      </Canvas>
    </div>
  );
}
