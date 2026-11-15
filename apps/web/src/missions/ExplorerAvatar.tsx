import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Chibi, newChibiDriver, chibiAct, type ChibiDriver } from "../characters/Chibi";
import { motion } from "../anim/kit";
import { chibiLook, type AvatarConfig } from "./avatar";

/** the player's explorer: the chibi astronaut wearing the saved avatar */
export function ExplorerAvatar({
  config,
  driver,
  turntable = false,
  bounce = 0,
  helmetOn = true,
}: {
  config: AvatarConfig;
  patch?: string;
  driver?: MutableRefObject<ChibiDriver>;
  turntable?: boolean;
  bounce?: number;
  helmetOn?: boolean;
}) {
  const own = useRef<ChibiDriver>(newChibiDriver());
  const d = driver ?? own;
  const root = useRef<THREE.Group>(null);
  const last = useRef(bounce);
  const look = useMemo(() => chibiLook(config, helmetOn), [config, helmetOn]);
  useFrame((_, dt) => {
    if (last.current !== bounce) {
      last.current = bounce;
      chibiAct(d.current, "hop");
    }
    if (root.current && turntable && !motion.reduced) root.current.rotation.y = Math.sin(performance.now() / 2600) * 0.55;
    void dt;
  });
  return (
    <group ref={root}>
      <Chibi look={look} driver={d} />
    </group>
  );
}
