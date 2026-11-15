// Adaptive resolution (bible §18 / §12): base = min(devicePixelRatio, 1.5) × a multiplier that steps
// 0.7–1.0 by 0.1 to hold 30–60 fps. Also compiles every shader once before the first reveal
// (warm-up), so the intro never hitches.
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { PerformanceMonitor, Preload } from "@react-three/drei";

export function AdaptiveDpr({ max = 1.5, off = false }: { max?: number; off?: boolean }) {
  const setDpr = useThree((s) => s.setDpr);
  const [mult, setMult] = useState(1);
  useEffect(() => {
    const base = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, max);
    setDpr(Math.max(0.5, base * mult));
  }, [mult, max, setDpr]);
  if (off) return null;
  return (
    // v7.2: decline only, and only after a long slow stretch. Every resolution change resizes the
    // canvas and its post-processing targets, which flashes a black frame; bouncing up and down made
    // the game flicker on laptops whose frame rate hovers near the bounds.
    <PerformanceMonitor
      ms={400}
      iterations={12}
      bounds={() => [24, 1000]}
      flipflops={2}
      onDecline={() => setMult((m) => Math.max(0.75, +(m - 0.25).toFixed(2)))}
    />
  );
}

/** Compile all materials and upload textures before the first visible frame. */
export function WarmUp() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    try {
      gl.compile(scene, camera);
    } catch {
      /* compile is a nicety */
    }
  }, [gl, scene, camera]);
  return <Preload all />;
}
