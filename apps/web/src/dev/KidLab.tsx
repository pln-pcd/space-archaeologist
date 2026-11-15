// /dev/kids: the four kids side by side for turnaround checks (bible §22).
// ?view=front|three|side|back  ?expr=neutral|happy|curious|surprised|determined|sleepy  ?suit=1  ?kid=maya
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Kid, type KidDriver, type KidExpr, CLOTHES, SUIT_ON } from "../characters/Kid";
import { KID_ORDER, type KidId } from "../characters/kids";
import { newDriver } from "../ship/Chubby";
import { withOutlines, OutlineSync } from "../fx/outline";

const q = new URLSearchParams(location.search);
const VIEW: Record<string, number> = { front: 0, three: Math.PI / 4, side: Math.PI / 2, back: Math.PI };

function One({ id, x }: { id: KidId; x: number }) {
  const d = useRef<KidDriver>({ ...newDriver(), expr: (q.get("expr") as KidExpr) || "neutral" });
  const rv = useRef(q.get("suit") ? { ...SUIT_ON, helmet: q.get("helmet") ? 1 : 0 } : { ...CLOTHES });
  return (
    <group position={[x, 0, 0]} rotation={[0, VIEW[q.get("view") || "front"] ?? 0, 0]} ref={(g) => g && withOutlines(g, { kind: "character" })}>
      <Kid id={id} driver={d} reveal={rv} patch="ZUZU" seed={KID_ORDER.indexOf(id)} />
    </group>
  );
}

export default function KidLab() {
  const only = q.get("kid") as KidId | null;
  const kids = only ? [only] : KID_ORDER;
  const close = q.get("close");
  return (
    <div style={{ position: "fixed", inset: 0, background: "#EDE6DA" }}>
      <Canvas camera={{ position: close ? [0, 0.92, 1.35] : [0, 0.75, 3.6], fov: 35 }} gl={{ antialias: true, toneMapping: THREE.NoToneMapping }} onCreated={({ camera }) => camera.lookAt(0, close ? 0.9 : 0.55, 0)}>
        <OutlineSync />
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, 4, 3]} intensity={1.6} />
        {kids.map((id, i) => (
          <One key={id} id={id} x={(i - (kids.length - 1) / 2) * 0.85} />
        ))}
      </Canvas>
    </div>
  );
}
