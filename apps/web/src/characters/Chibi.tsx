// React wrapper for the chibi explorer (characters/chibi.ts): rebuilds when the look changes, poses
// every frame from a driver (walk 0..1 plus one-shot acts), blinks, and gets character outlines.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { withOutlines } from "../fx/outline";
import { motion } from "../anim/kit";
import { buildChibi, poseChibi, type ChibiLook } from "./chibiModel";

export type ChibiDriver = { walk: number; act?: "wave" | "hop" | "cheer" | null; actT?: number; lookX?: number };
export const newChibiDriver = (): ChibiDriver => ({ walk: 0, act: null, actT: 0, lookX: 0 });
const ACT_LEN = { wave: 1.6, hop: 0.6, cheer: 1.2 } as const;
export function chibiAct(d: ChibiDriver, act: "wave" | "hop" | "cheer") {
  d.act = act;
  d.actT = 0;
}

export function Chibi({ look, driver, outline = true }: { look: ChibiLook; driver?: MutableRefObject<ChibiDriver>; outline?: boolean }) {
  const own = useRef<ChibiDriver>(newChibiDriver());
  const d = driver ?? own;
  const key = JSON.stringify(look);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rig = useMemo(() => buildChibi(look), [key]);
  useEffect(() => {
    if (outline) withOutlines(rig.root, { kind: "character" });
    return () => rig.dispose();
  }, [rig, outline]);
  const st = useRef({ t: Math.random() * 10, blinkAt: 2, blink: 0, walk: 0 });
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const s = st.current;
    const dv = d.current;
    s.t += motion.reduced ? 0 : dt;
    s.walk += (dv.walk - s.walk) * Math.min(1, dt * 10);
    // blink every few seconds
    s.blinkAt -= dt;
    if (s.blinkAt <= 0) (s.blink = 0.14), (s.blinkAt = 2.5 + Math.random() * 3);
    s.blink = Math.max(0, s.blink - dt);
    let wave = 0,
      hop = 0,
      cheer = 0;
    if (dv.act) {
      dv.actT = (dv.actT ?? 0) + dt;
      const len = ACT_LEN[dv.act];
      const k = dv.actT / len;
      const env = Math.sin(Math.min(1, k) * Math.PI);
      if (dv.act === "wave") wave = Math.min(1, env * 1.6);
      if (dv.act === "hop") hop = Math.sin(Math.min(1, k) * Math.PI);
      if (dv.act === "cheer") (cheer = Math.min(1, env * 1.5)), (hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.5);
      if (k >= 1) dv.act = null;
    }
    poseChibi(rig, { walk: s.walk, t: s.t, wave, hop, cheer, blink: s.blink > 0 ? 0.12 : 1, lookX: dv.lookX ?? 0 });
  });
  return <primitive object={rig.root} />;
}

