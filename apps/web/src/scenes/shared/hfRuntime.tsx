// HyperFrames bridge (bible §22 H, docs/design/ANIMATION_PIPELINE.md). Mounts one of the GAME'S OWN
// R3F scenes into a composition and renders it as a pure function of timeline time:
// - frameloop "never"; frames advance in fixed 1/60 s steps with R3F's advance(time), so stateful
//   animation code (damped poses, particles, springs) gives the same pixels for the same t.
// - seeking backwards builds a FRESH canvas + root in the same container and replays from t = 0
//   (an in-place React re-mount left the post-processing composer silent), so any seek order works.
// - no timers, no requestAnimationFrame, no Math.random without a seed (the scenes already seed theirs).
// The player's NAME is never passed in (privacy): compositions only get characterId, accentColor,
// reducedMotion and device.
import { useLayoutEffect, type ReactNode } from "react";
import * as THREE from "three";
import { _roots, advance, createRoot, extend, flushSync, type ReconcilerRoot } from "@react-three/fiber";
import { motion } from "../../anim/kit";
import { fx } from "../../fx/uniforms";
import { windTime } from "../../style/toon";

// a bare createRoot (no <Canvas>) needs the three.js catalogue registered
extend(THREE as unknown as Parameters<typeof extend>[0]);

export type HFVars = { characterId?: string; accentColor?: string; reducedMotion?: boolean; device?: "computer" | "tablet" | "phone" };
export type HFScene = (vars: HFVars) => ReactNode;

const STEP = 1 / 60;

/** resolves once React has actually committed the tree it sits in */
function OnCommit({ done }: { done: () => void }) {
  useLayoutEffect(() => done(), [done]);
  return null;
}

export function mountComposition(container: HTMLElement, scene: HFScene, vars: HFVars, size = { width: 1920, height: 1080 }) {
  motion.reduced = !!vars.reducedMotion;
  let canvas: HTMLCanvasElement | null = null;
  let root: ReconcilerRoot<HTMLCanvasElement> | null = null;
  let simT = 0;
  const state = () => _roots.get(canvas!)!.store.getState();

  /** a fresh canvas and root, the scene mounted at t = 0 */
  const build = async () => {
    const old = { canvas, root };
    const c = document.createElement("canvas");
    c.style.cssText = `position:absolute;left:0;top:0;width:${size.width}px;height:${size.height}px`;
    const r = createRoot(c);
    await r.configure({
      frameloop: "never",
      size: { ...size, top: 0, left: 0 },
      dpr: 1,
      shadows: true,
      camera: { fov: 45, near: 0.1, far: 800, position: [0, 1, 5] },
      gl: { antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: THREE.CineonToneMapping, toneMappingExposure: 1.75 },
    });
    await new Promise<void>((resolve) =>
      r.render(
        <>
          {scene(vars)}
          <OnCommit done={resolve} />
        </>,
      ),
    );
    flushSync(() => {});
    canvas = c;
    root = r;
    simT = 0;
    // shared shader clocks (painted drift, sway) also restart, so a rebuilt t matches a fresh one
    fx.uTime.value = 0;
    windTime.value = 0;
    const st = state();
    st.clock.elapsedTime = 0;
    advance(0, true, st);
    // swap in the new canvas, then free the old GL context
    container.appendChild(c);
    if (old.canvas) {
      old.root?.unmount();
      old.canvas.remove();
    }
  };
  const step = (t: number) => {
    const st = state();
    // land exactly on the 1/60 s grid at or below t
    const target = Math.floor(t / STEP + 1e-6) * STEP;
    while (simT + STEP <= target + 1e-9) {
      simT += STEP;
      advance(simT, true, st);
    }
  };
  const api = {
    /** resolves once the GL context exists and the scene has mounted (window.__hf.buildReady) */
    ready: Promise.resolve(),
    isReady: false,
    /** draw the frame for t seconds; a backward seek rebuilds and returns a promise (pass it to waitUntil) */
    renderAt(t: number): Promise<void> | void {
      if (t < simT - 1e-6) return build().then(() => step(t));
      step(t);
    },
    dispose() {
      root?.unmount();
      canvas?.remove();
    },
  };
  api.ready = build().then(() => void (api.isReady = true));
  return api;
}
