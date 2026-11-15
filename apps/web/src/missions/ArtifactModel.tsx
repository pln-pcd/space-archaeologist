import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import {
  Eagle,
  newEagle,
  Reflector,
  Seismometer,
  Columbia,
} from "../story/ch1/props";
import { AdaptiveDpr } from "../fx/AdaptiveDpr";
import { useOutlines, OutlineSync } from "../fx/outline";
import { intents, useIntent, useIntentScope } from "../input/bus";
import { Button } from "../odyssey/ui/kit";
import { motion } from "../anim/kit";
import type { Artifact } from "./types";

function PlaqueModel() {
  const photo = useLoader(THREE.TextureLoader, "/media/artifacts/plaque.jpg");
  return (
    <group position={[0, 0.75, 0]}>
      {/* the ladder strut it is fixed to */}
      {[-1.35, 1.35].map((x) => (
        <mesh key={x} position={[x, -0.2, -0.12]}>
          <cylinderGeometry args={[0.06, 0.06, 2.6, 10]} />
          <meshToonMaterial color="#E2B04A" />
        </mesh>
      ))}
      {[-0.95, 0.95].map((y) => (
        <mesh key={y} position={[0, y, -0.12]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 2.7, 8]} />
          <meshToonMaterial color="#ECE6DA" />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[2.45, 1.45, 0.1]} />
        <meshStandardMaterial color="#B9C2CC" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.056]}>
        <planeGeometry args={[2.2, 1.24]} />
        <meshBasicMaterial map={photo} />
      </mesh>
      {[[-1.12, 0.62], [1.12, 0.62], [-1.12, -0.62], [1.12, -0.62]].map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 12]} />
          <meshStandardMaterial color="#8E96A3" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
export function ArtifactModel({
  modelRef,
  hologram = false,
  assembled = true,
  ascentY = 0,
}: {
  modelRef: string;
  hologram?: boolean;
  assembled?: boolean;
  ascentY?: number;
}) {
  const ctl = useRef(newEagle());
  const root = useRef<THREE.Group>(null);
  useOutlines(root, "interactable");
  useEffect(() => {
    ctl.current.ascentOn = modelRef !== "descent";
  }, [modelRef, assembled, ascentY]);
  useFrame((_, dt) => {
    const y = ascentY + (assembled ? 0 : 2.3);
    ctl.current.ascentY = motion.reduced
      ? y
      : THREE.MathUtils.damp(ctl.current.ascentY, y, 10, dt);
  });
  // Reuse the real model geometry with an x-ray material; restore/dispose on every toggle.
  useEffect(() => {
    if (!hologram || !root.current) return;
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    // v7.4: a soft glowing ghost (not a busy triangle wireframe): the mystery shape, not its details
    const xray = new THREE.MeshBasicMaterial({
      color: "#72FFE1",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    root.current.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline) {
        originals.set(o, o.material);
        o.material = xray;
      }
    });
    return () => {
      originals.forEach((material, mesh) => {
        mesh.material = material;
      });
      xray.dispose();
    };
  }, [hologram]);
  return (
    <group ref={root}>
      {(modelRef === "descent" ||
        modelRef === "eagle" ||
        modelRef === "ascent") && (
        <Eagle
          ctl={ctl}
          part={
            modelRef === "descent"
              ? "descent"
              : modelRef === "ascent"
                ? "ascent"
                : "all"
          }
        />
      )}
      {modelRef === "reflector" && (
        <group scale={2.4}>
          <Reflector />
        </group>
      )}
      {modelRef === "seismometer" && (
        <group scale={2.2}>
          <Seismometer />
        </group>
      )}
      {modelRef === "plaque" && <PlaqueModel />}
      {modelRef === "columbia" && <Columbia />}
    </group>
  );
}

function InspectionRig({
  artifact,
  scan,
  onHotspot,
  assembled,
  ascentY,
}: {
  artifact: Pick<Artifact, "modelRef" | "components">;
  scan: number;
  onHotspot?: (id: string) => void;
  assembled?: boolean;
  ascentY?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const angle = useRef(0.3);
  const zoom = useRef(1);
  const dragging = useRef(false);
  const { gl } = useThree();
  const inside = (x: number, y: number) => {
    const r = gl.domElement.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  // v7.6 hands: close your hand (a fist) anywhere and move it to twist and tilt the find
  const pitch = useRef(0);
  const fist = useRef<{ x: number; y: number } | null>(null);
  useIntent("grab", (e) => {
    dragging.current = inside(e.x, e.y);
    if (e.source === "gesture") fist.current = { x: e.x, y: e.y };
  });
  useIntent("release", () => {
    dragging.current = false;
    fist.current = null;
  });
  useIntent("pointer", (e) => {
    const f = fist.current;
    if (!f || e.source !== "gesture" || !e.visible) return;
    angle.current += (e.x - f.x) * 0.012;
    pitch.current = THREE.MathUtils.clamp(pitch.current + (e.y - f.y) * 0.007, -0.6, 0.6);
    f.x = e.x;
    f.y = e.y;
  });
  useIntent("pinchMove", (e) => {
    if (dragging.current) angle.current += e.dx * 0.012;
  });
  useIntent("turnView", (e) => {
    angle.current += e.delta;
  });
  useIntent("zoomView", (e) => {
    zoom.current = THREE.MathUtils.clamp(
      zoom.current + e.delta * 0.3,
      0.6,
      1.7,
    );
  });
  useIntent("dial", (e) => {
    zoom.current = THREE.MathUtils.clamp(
      zoom.current - e.delta * 0.2,
      0.6,
      1.7,
    );
  });
  useIntent("swipe", (e) => {
    if (e.source === "keyboard") angle.current += e.dir === "left" ? -0.2 : 0.2;
  });
  // v7.3: fit every model to the stage (the plaque was tiny, the lander huge), then spin/zoom
  const inner = useRef<THREE.Group>(null);
  const fit = useRef({ k: 0, y: 0, tries: 0 });
  const box = useMemo(() => new THREE.Box3(), []);
  const sz = useMemo(() => new THREE.Vector3(), []);
  const ctr = useMemo(() => new THREE.Vector3(), []);
  const shown = useRef(0);
  useFrame((_, dt) => {
    if (!root.current) return;
    const f = fit.current;
    if (!f.k && inner.current && f.tries++ < 120) {
      box.setFromObject(inner.current);
      if (!box.isEmpty()) {
        box.getSize(sz);
        box.getCenter(ctr);
        const m = Math.max(sz.x * 0.95, sz.y * 1.55, sz.z * 0.95);
        if (m > 0.01) {
          f.k = 3.3 / m;
          f.y = -ctr.y * f.k;
        }
      }
    }
    shown.current = Math.min(1, shown.current + dt * 3);
    const pop = motion.reduced ? 1 : 1 - Math.pow(1 - shown.current, 3);
    root.current.rotation.y = angle.current;
    root.current.rotation.x += (pitch.current - root.current.rotation.x) * Math.min(1, dt * 10);
    root.current.scale.setScalar((f.k || 1) * zoom.current * (0.6 + 0.4 * pop));
    root.current.position.y = 0.9 + (f.k ? f.y * zoom.current : -0.6);
  });
  // hands: open-palm sideways swipe spins it
  useIntent("swipe", (e) => {
    if (e.source === "gesture") angle.current += e.dir === "left" ? -0.6 : e.dir === "right" ? 0.6 : 0;
  });
  return (
    <group ref={root} position={[0, -0.6, 0]}>
      <group ref={inner}>
      <ArtifactModel
        modelRef={artifact.modelRef}
        hologram={scan > 0 && scan < 1}
        assembled={assembled}
        ascentY={ascentY}
      />
      </group>
      {onHotspot &&
        artifact.components.map((c, i) => (
          <ClueStar key={c.id} index={i} position={c.hotspotPosition} onPick={() => onHotspot(c.id)} />
        ))}
      {scan > 0 && scan < 1 && (
        <mesh position={[0, scan * 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.8, 2.85, 48]} />
          <meshBasicMaterial
            color="#72FFE1"
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  );
}
/** a glowing, gently pulsing star on the model: a clue to tap or pinch */
function ClueStar({ position, index, onPick }: { position: [number, number, number]; index: number; onPick: () => void }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime + index;
    g.current.scale.setScalar(motion.reduced ? 1 : 1 + Math.sin(t * 3) * 0.15);
    g.current.rotation.z = motion.reduced ? 0 : t * 0.8;
  });
  return (
    <group position={position}>
      <group ref={g}>
        <mesh renderOrder={10} onClick={(e) => (e.stopPropagation(), onPick())} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "auto")}>
          <octahedronGeometry args={[0.16, 0]} />
          <meshBasicMaterial color="#FFD23F" depthTest={false} transparent toneMapped={false} />
        </mesh>
        <mesh renderOrder={9}>
          <ringGeometry args={[0.22, 0.28, 24]} />
          <meshBasicMaterial color="#FFF4B0" depthTest={false} transparent opacity={0.8} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      <mesh visible={false} onClick={(e) => (e.stopPropagation(), onPick())}>
        <sphereGeometry args={[0.35, 8, 6]} />
      </mesh>
    </group>
  );
}

export function InspectionStage({
  artifact,
  scan = 0,
  onHotspot,
  assembled,
  ascentY,
}: {
  artifact: Pick<Artifact, "modelRef" | "components">;
  scan?: number;
  onHotspot?: (id: string) => void;
  assembled?: boolean;
  ascentY?: number;
}) {
  return (
    <div
      className="m-model"
      data-inspection-surface
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).tagName !== "CANVAS") return;
        (e.currentTarget as HTMLElement).dataset.drag = String(e.clientX);
      }}
      onPointerMove={(e) => {
        const el = e.currentTarget as HTMLElement;
        if (!el.dataset.drag || !(e.buttons & 1)) return;
        const dx = e.clientX - Number(el.dataset.drag);
        el.dataset.drag = String(e.clientX);
        if (Math.abs(dx) > 0) intents.emit("turnView", { delta: dx * 0.012 }, "mouse");
      }}
      onPointerUp={(e) => delete (e.currentTarget as HTMLElement).dataset.drag}
      onPointerLeave={(e) => delete (e.currentTarget as HTMLElement).dataset.drag}
      onWheel={(e) => intents.emit("zoomView", { delta: e.deltaY < 0 ? 0.25 : -0.25 }, "mouse")}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [3.2, 2.4, 6.2], fov: 40 }}
        gl={{ toneMapping: THREE.NoToneMapping }}
        onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
        aria-label="Rotatable artifact model. Drag to spin, scroll to zoom."
      >
        <hemisphereLight args={["#FFF6E8", "#8C84C8", 1.3]} />
        <directionalLight position={[4, 7, 5]} intensity={2.2} />
        <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#BFD8FF" />
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[2.2, 2.4, 0.18, 48]} />
          <meshToonMaterial color="#ECE6FF" />
        </mesh>
        <Suspense fallback={null}>
          <InspectionRig
            artifact={artifact}
            scan={scan}
            onHotspot={onHotspot}
            assembled={assembled}
            ascentY={ascentY}
          />
        </Suspense>
        <AdaptiveDpr />
        <OutlineSync />
      </Canvas>
    </div>
  );
}
export function InspectTools() {
  return (
    <div className="m-model-tools" aria-label="Inspect model">
      <Button
        onClick={() =>
          intents.emit("turnView", { delta: -0.35 }, intents.lastSource)
        }
        aria-label="Rotate model left"
      >
        ↶ Rotate
      </Button>
      <Button
        onClick={() =>
          intents.emit("turnView", { delta: 0.35 }, intents.lastSource)
        }
        aria-label="Rotate model right"
      >
        Rotate ↷
      </Button>
      <Button
        onClick={() =>
          intents.emit("zoomView", { delta: 0.3 }, intents.lastSource)
        }
        aria-label="Zoom model in"
      >
        + Zoom
      </Button>
      <Button
        onClick={() =>
          intents.emit("zoomView", { delta: -0.3 }, intents.lastSource)
        }
        aria-label="Zoom model out"
      >
        − Zoom
      </Button>
    </div>
  );
}
