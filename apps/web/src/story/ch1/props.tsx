import { useOutlines } from "../../fx/outline";
// Chapter 1 set pieces (bible §8 rebuild), our own low-poly models in the "Quiet Afternoon"
// ramp style: Moon ground, Earth, the Moon from orbit, Eagle (descent + ascent stage, hatch,
// ladder, plaque), Columbia, the Saturn V and its tower, flames, vapour, dust sheets, boot prints,
// the science packages and the Apollo astronauts. Natural, muted colours; no glow.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { canvasTexture } from "../../ship/Set";
import { type Driver } from "../../ship/Chubby";
import { ApolloSuit } from "./ApolloSuit";
import { glowMaterial, toonMaterial as T } from "../../style/toon";
import { PAL } from "../../style/palette";
import { rampMaterial } from "../../fx/ramp";
import { toon as cuteToon } from "../../odyssey/look";
import { line } from "./flow";

const rnd = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

/* ---------------- Moon ground ---------------- */
function useRegolith() {
  return useMemo(
    () =>
      canvasTexture(1024, 1024, (x, w) => {
        x.fillStyle = "#9A989E";
        x.fillRect(0, 0, w, w);
        const r = rnd(3);
        for (let i = 0; i < 12000; i++) {
          const g = 118 + Math.floor(r() * 70);
          x.fillStyle = `rgba(${g},${g},${g + 4},0.3)`;
          x.fillRect(r() * w, r() * w, 1 + r() * 3, 1 + r() * 3);
        }
        for (let i = 0; i < 90; i++) {
          const cx = r() * w,
            cy = r() * w,
            rad = 5 + r() * 30;
          const gr = x.createRadialGradient(cx - rad * 0.2, cy - rad * 0.2, rad * 0.2, cx, cy, rad);
          gr.addColorStop(0, "rgba(70,70,76,0.4)");
          gr.addColorStop(0.8, "rgba(120,120,126,0.12)");
          gr.addColorStop(1, "rgba(215,215,220,0.3)");
          x.fillStyle = gr;
          x.beginPath();
          x.arc(cx, cy, rad, 0, Math.PI * 2);
          x.fill();
        }
      }),
    [],
  );
}
/** a wide regolith plain with craters and rocks that runs out to the horizon */
export function MoonGround({ radius = 80 }: { radius?: number }) {
  const tex = useRegolith();
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(radius / 9, radius / 9);
  }, [tex, radius]);
  const mat = useMemo(() => rampMaterial("#ffffff", { map: tex, speckle: 1 }), [tex]);
  const bits = useMemo(() => {
    const r = rnd(11);
    const craters = Array.from({ length: 26 }, () => ({ x: (r() - 0.5) * 70, z: (r() - 0.5) * 70, r: 0.6 + r() * 2.4 })).filter((c) => Math.hypot(c.x, c.z) > 6 && Math.hypot(c.x, c.z) + c.r < radius * 0.92);
    const rocks = Array.from({ length: 60 }, () => ({ x: (r() - 0.5) * 60, z: (r() - 0.5) * 60, s: 0.08 + r() * 0.35, ry: r() * 6 })).filter((k) => Math.hypot(k.x, k.z) > 4.5 && Math.hypot(k.x, k.z) < radius * 0.95);
    return { craters, rocks };
  }, [radius]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
        <circleGeometry args={[radius, 64]} />
      </mesh>
      {bits.craters.map((c, i) => (
        <mesh key={i} position={[c.x, 0.01, c.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.45]} material={T("#86848B")}>
          <torusGeometry args={[c.r, c.r * 0.08, 5, 28]} />
        </mesh>
      ))}
      {bits.rocks.map((k, i) => (
        <mesh key={i} position={[k.x, k.s * 0.4, k.z]} rotation={[k.ry, k.ry * 2, 0]} scale={k.s} material={T("#7C7A82")} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

let earthTex: THREE.Texture | null = null;
/** our painted Earth map: muted ocean, soft sage and sand continents, cream cloud bands */
function paintedEarth() {
  earthTex ??= canvasTexture(1024, 512, (x, w, h) => {
    const r = rnd(29);
    x.fillStyle = "#4E6A7C";
    x.fillRect(0, 0, w, h);
    x.filter = "blur(10px)";
    // continents: clusters of soft blobs
    const lands: [number, number, number][] = [[0.18, 0.32, 0.12], [0.24, 0.62, 0.09], [0.5, 0.3, 0.1], [0.53, 0.58, 0.1], [0.72, 0.36, 0.16], [0.86, 0.68, 0.07]];
    for (const [cx, cy, rad] of lands)
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2,
          d = r() * rad * w * 0.9;
        x.fillStyle = r() < 0.6 ? "rgba(122,138,98,0.55)" : "rgba(176,156,112,0.5)";
        const ex = cx * w + Math.cos(a) * d,
          ey = cy * h + Math.sin(a) * d * 0.6,
          rx = 14 + r() * 40,
          ry = 10 + r() * 26,
          rot = r() * 3;
        for (const off of [-w, 0, w]) {
          x.beginPath();
          x.ellipse(ex + off, ey, rx, ry, rot, 0, Math.PI * 2);
          x.fill();
        }
      }
    // clouds: long soft cream streaks, polar caps
    x.filter = "blur(6px)";
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(236,232,224,${0.25 + r() * 0.35})`;
      const ex = r() * w,
        ey = h * (0.12 + r() * 0.76),
        rx = 30 + r() * 90,
        ry = 4 + r() * 9,
        rot = (r() - 0.5) * 0.3;
      for (const off of [-w, 0, w]) {
        x.beginPath();
        x.ellipse(ex + off, ey, rx, ry, rot, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.fillStyle = "rgba(236,234,230,0.9)";
    x.fillRect(-40, -40, w + 80, h * 0.06 + 40);
    x.fillRect(-40, h * 0.94, w + 80, h * 0.06 + 40);
    x.filter = "none";
  });
  earthTex.colorSpace = THREE.SRGBColorSpace;
  return earthTex;
}
/** Earth, natural muted colours, smooth (no facets), still */
export function Earth({ radius = 1, position = [0, 0, 0] as [number, number, number], rotation = [0.35, 2.2, 0] as [number, number, number] }) {
  const map = useMemo(() => paintedEarth(), []);
  return (
    <mesh position={position} rotation={rotation}>
      <sphereGeometry args={[radius, 64, 40]} />
      <meshLambertMaterial map={map} />
    </mesh>
  );
}
/** the Moon seen from space (NASA LRO colour map), lit by the scene sun */
export function MoonSphere({ radius = 10, position = [0, 0, 0] as [number, number, number] }) {
  const tex = useLoader(THREE.TextureLoader, "/textures/moon_lroc_color_1k.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={position} rotation={[0.2, -1.2, 0]}>
      <sphereGeometry args={[radius, 64, 48]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  );
}

/* ---------------- struts ---------------- */
export function Strut({ from, to, r, color }: { from: [number, number, number]; to: [number, number, number]; r: number; color: string }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    return { pos: a.clone().add(b).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), len: d.length() };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat} material={T(color)} castShadow>
      <cylinderGeometry args={[r, r, len, 6]} />
    </mesh>
  );
}

/* ---------------- Eagle ---------------- */
const PAD_R = 3.0;
/** ladder geometry (front leg, +z), shared with the climbing astronauts */
export const LADDER = { top: new THREE.Vector3(0, 2.05, 1.55), bottom: new THREE.Vector3(0, 0.35, PAD_R + 0.25), porch: new THREE.Vector3(0, 2.55, 1.35), pad: new THREE.Vector3(0, 0.2, PAD_R + 0.15) };
/** the plaque sits between the 3rd and 4th rungs, just behind them, facing out like the ladder */
export const PLAQUE = LADDER.top.clone().lerp(LADDER.bottom, 3 / 7).add(new THREE.Vector3(0, -0.057, -0.057));
function plaqueTexture() {
  // the real plaque text (F29), engraved on a steel plate
  const l = line("e13")?.text ?? "";
  const words = l.split(" ");
  const rows: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).length > 26) {
      rows.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  rows.push(cur.trim());
  return canvasTexture(512, 300, (x, w, h) => {
    x.fillStyle = "#C9C6C2";
    x.fillRect(0, 0, w, h);
    x.strokeStyle = "#85817A";
    x.lineWidth = 6;
    x.strokeRect(5, 5, w - 10, h - 10);
    x.fillStyle = "#3A3836";
    x.textAlign = "center";
    x.font = "400 26px 'IBM Plex Mono', monospace";
    rows.forEach((r, i) => x.fillText(r.toUpperCase(), w / 2, 52 + i * 38));
  });
}
export type EagleCtl = { ascentY: number; ascentOn: boolean; flame: number; descentFlame: number; hatch: number };
export const newEagle = (): EagleCtl => ({ ascentY: 0, ascentOn: true, flame: 0, descentFlame: 0, hatch: 0 });
export function Eagle({ ctl, plaque = true, part = "all" }: { ctl: MutableRefObject<EagleCtl>; plaque?: boolean; part?: "all" | "descent" | "ascent" }) {
  const asc = useRef<THREE.Group>(null);
  const hatch = useRef<THREE.Group>(null);
  const fA = useRef<THREE.Mesh>(null);
  const fD = useRef<THREE.Mesh>(null);
  const plaqueTex = useMemo(() => (plaque ? plaqueTexture() : null), [plaque]);
  useFrame((s) => {
    const c = ctl.current;
    if (asc.current) {
      asc.current.position.y = 2.95 + c.ascentY;
      asc.current.visible = c.ascentOn && part !== "descent";
    }
    if (hatch.current) hatch.current.rotation.y = -c.hatch * 1.4;
    const flick = 0.92 + Math.sin(s.clock.elapsedTime * 30) * 0.08;
    if (fA.current) {
      fA.current.visible = c.flame > 0.01;
      fA.current.scale.set(1, c.flame * flick, 1);
    }
    if (fD.current) {
      fD.current.visible = c.descentFlame > 0.01;
      fD.current.scale.set(1, c.descentFlame * flick, 1);
    }
  });
  const legs = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  return (
    <group>
      {/* descent stage: octagon wrapped in gold foil (F28/F30), black panels */}
      <group visible={part !== "ascent"}>
      <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 8, 0]} material={T("#E2B04A")} castShadow receiveShadow>
        <cylinderGeometry args={[1.45, 1.45, 1.3, 8, 1]} />
      </mesh>
      {legs.map((a) => (
        <mesh key={`p${a}`} position={[Math.sin(a + Math.PI / 4) * 1.36, 1.75, Math.cos(a + Math.PI / 4) * 1.36]} rotation={[0, a + Math.PI / 4, 0]} material={T("#3D3656")}>
          <boxGeometry args={[1.05, 1.18, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, 2.44, 0]} rotation={[0, Math.PI / 8, 0]} material={T("#B9B6B0")}>
        <cylinderGeometry args={[1.5, 1.5, 0.1, 8]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} material={T("#4A4458")}>
        <cylinderGeometry args={[0.32, 0.6, 0.5, 14, 1, true]} />
      </mesh>
      <mesh ref={fD} position={[0, 0.25, 0]} rotation={[Math.PI, 0, 0]} material={glowMaterial("#F3E3C4", 1)} visible={false}>
        <coneGeometry args={[0.45, 1.6, 12]} />
      </mesh>
      {legs.map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <Strut from={[0, 1.95, 1.3]} to={[0, 0.3, PAD_R]} r={0.085} color="#C9A65A" />
          <Strut from={[0.55, 1.12, 1.15]} to={[0, 0.9, 2.25]} r={0.04} color="#B9B6B0" />
          <Strut from={[-0.55, 1.12, 1.15]} to={[0, 0.9, 2.25]} r={0.04} color="#B9B6B0" />
          <mesh position={[0, 0.1, PAD_R]} material={T("#C9A65A")} castShadow>
            <cylinderGeometry args={[0.38, 0.46, 0.14, 16]} />
          </mesh>
        </group>
      ))}
      {/* porch, ladder and plaque on the front leg (F29) */}
      <mesh position={[0, 2.5, 1.45]} material={T("#B9B6B0")}>
        <boxGeometry args={[0.8, 0.05, 0.5]} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const k = (i + 0.5) / 7;
        const p = LADDER.top.clone().lerp(LADDER.bottom, k);
        return (
          <mesh key={i} position={p} material={T("#ECE6DA")}>
            <boxGeometry args={[0.6, 0.04, 0.05]} />
          </mesh>
        );
      })}
      {[-0.3, 0.3].map((x) => (
        <Strut key={x} from={[x, LADDER.top.y, LADDER.top.z]} to={[x, LADDER.bottom.y, LADDER.bottom.z]} r={0.025} color="#ECE6DA" />
      ))}
      {plaqueTex && (
        <mesh position={PLAQUE.toArray()} rotation={[-Math.PI / 4, 0, 0]}>
          <planeGeometry args={[0.52, 0.3]} />
          <meshBasicMaterial map={plaqueTex} toneMapped={false} />
        </mesh>
      )}
      {/* ascent stage with the forward hatch */}
      </group>
      <group ref={asc} position={[0, 2.95, 0]}>
        <mesh material={T("#B9B6B0")} castShadow>
          <cylinderGeometry args={[1.05, 1.15, 1.1, 7]} />
        </mesh>
        <mesh position={[0.35, 0.25, 0.92]} rotation={[0, 0.35, 0]} material={T("#3D3656")}>
          <boxGeometry args={[0.32, 0.26, 0.08]} />
        </mesh>
        <mesh position={[-0.35, 0.25, 0.92]} rotation={[0, -0.35, 0]} material={T("#3D3656")}>
          <boxGeometry args={[0.32, 0.26, 0.08]} />
        </mesh>
        <group position={[-0.32, -0.3, 1.06]}>
          {/* dark opening behind the hatch */}
          <mesh position={[0.32, 0, -0.02]} material={T("#1F1E1D")}>
            <boxGeometry args={[0.62, 0.62, 0.02]} />
          </mesh>
          <group ref={hatch}>
            <mesh position={[0.32, 0, 0.02]} material={T("#9A9690")}>
              <boxGeometry args={[0.62, 0.62, 0.05]} />
            </mesh>
          </group>
        </group>
        <mesh position={[0.5, 0.85, -0.3]} rotation={[0.5, 0, 0.3]} material={T("#D8D2C6")}>
          <coneGeometry args={[0.3, 0.16, 12, 1, true]} />
        </mesh>
        <mesh ref={fA} position={[0, -0.85, 0]} rotation={[Math.PI, 0, 0]} material={glowMaterial("#F3E3C4", 1)} visible={false}>
          <coneGeometry args={[0.3, 1.3, 12]} />
        </mesh>
      </group>
    </group>
  );
}

/** Columbia: command and service module (silver service module, cone-shaped command module) */
export function Columbia() {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh material={T("#C9C6C2")} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 1.9, 18]} />
      </mesh>
      <mesh position={[0, 1.3, 0]} material={T("#B9B6B0")}>
        <coneGeometry args={[0.6, 0.75, 18]} />
      </mesh>
      <mesh position={[0, -1.15, 0]} material={T("#3A3836")}>
        <cylinderGeometry args={[0.18, 0.4, 0.5, 14, 1, true]} />
      </mesh>
      <mesh position={[0.62, 0.2, 0]} material={T("#57534F")}>
        <boxGeometry args={[0.05, 0.6, 0.3]} />
      </mesh>
    </group>
  );
}

/* ---------------- Saturn V and Launch Complex 39A ---------------- */
/** roll-pattern texture: white with black blocks (the S-IC and S-IVB markings) */
function rollTex() {
  return canvasTexture(256, 256, (x, w, h) => {
    x.fillStyle = "#ECE9E2";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#2B2A28";
    for (let i = 0; i < 4; i++) x.fillRect((i * w) / 4, i % 2 ? 0 : h / 2, w / 8, h / 2);
  });
}
/** a smooth body of revolution from (radius, height) points: every stage shares the exact radius
 *  where it meets the next one, so the stack reads as ONE rocket (no gaps, no steps) */
function lathe(pts: [number, number][], seg = 40) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}
const SATURN = {
  // the first stage: engine skirt to the S-II joint
  sic: lathe([[0, 0.7], [0.98, 0.7], [1.0, 0.78], [1.0, 6.0], [0, 6.0]]),
  // the second stage and the tapering interstage
  sii: lathe([[0, 6.0], [1.0, 6.0], [1.0, 8.8], [0.96, 8.95], [0.68, 9.5], [0.66, 9.6], [0, 9.6]]),
  // the third stage up to the spacecraft adapter
  sivb: lathe([[0, 9.6], [0.66, 9.6], [0.66, 11.35], [0.6, 11.55], [0.42, 12.15], [0.4, 12.2], [0, 12.2]]),
  // the service module (silver) and the command module (a rounded cone)
  sm: lathe([[0, 12.2], [0.4, 12.2], [0.4, 12.75], [0, 12.75]]),
  cm: lathe([[0, 12.75], [0.41, 12.75], [0.38, 12.85], [0.2, 13.15], [0.08, 13.27], [0, 13.29]]),
};
export function SaturnV({ stage = 0, only }: { stage?: number; only?: "sic" | "upper" }) {
  // v7.4: one connected stack built from lathe profiles: white with the black roll pattern, black
  // stage bands, four red fins on engine fairings, five engine bells, the silver spacecraft and the
  // red launch escape tower. Separations happen exactly at the stage joints.
  // v7.5: the game's own cute look (painted toon ramp, candy colours, ink outlines from the scene)
  const roll = useMemo(() => cuteToon("#FFFFFF", { map: rollTex(), paint: 0.4 }), []);
  const white = cuteToon("#FFFFFF", { paint: 0.5 });
  const black = cuteToon("#3A3360");
  const red = cuteToon("#FF6B6B", { paint: 0.5 });
  const silver = cuteToon("#DCE3F2", { paint: 0.5 });
  const dark = cuteToon("#4A4270");
  const band = (y: number, r: number, h = 0.16) => (
    <mesh key={`b${y}`} position={[0, y, 0]} material={black}>
      <cylinderGeometry args={[r + 0.012, r + 0.012, h, 40, 1, true]} />
    </mesh>
  );
  return (
    <group>
      {stage < 1 && only !== "upper" && (
        <group>
          <mesh geometry={SATURN.sic} material={white} castShadow />
          {/* the black-and-white roll pattern as a band low on the first stage */}
          <mesh position={[0, 2.2, 0]} material={roll}>
            <cylinderGeometry args={[1.008, 1.008, 1.6, 40, 1, true]} />
          </mesh>
          {band(0.95, 1.0, 0.2)}
          {band(5.86, 1.0, 0.26)}
          {/* four engine fairings with red fins */}
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            return (
              <group key={i} rotation={[0, -a, 0]}>
                <mesh position={[0.96, 1.0, 0]} material={white}>
                  <cylinderGeometry args={[0.16, 0.26, 0.9, 16]} />
                </mesh>
                <mesh position={[1.32, 0.95, 0]} material={red}>
                  <boxGeometry args={[0.56, 1.0, 0.1]} />
                </mesh>
              </group>
            );
          })}
          {/* five F-1 engine bells */}
          {[[0, 0], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map(([x, z], i) => (
            <group key={`e${i}`} position={[x, 0.36, z]}>
              <mesh material={dark}>
                <cylinderGeometry args={[0.17, 0.3, 0.66, 18, 1, true]} />
              </mesh>
              <mesh position={[0, 0.36, 0]} material={silver}>
                <cylinderGeometry args={[0.13, 0.17, 0.1, 14]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {stage < 2 && only !== "sic" && (
        <group>
          <mesh geometry={SATURN.sii} material={white} castShadow />
          {band(6.08, 1.0, 0.16)}
          {band(8.72, 1.0, 0.14)}
        </group>
      )}
      {only !== "sic" && (
        <group>
          <mesh geometry={SATURN.sivb} material={white} castShadow />
          {/* the roll pattern band on the third stage */}
          <mesh position={[0, 10.2, 0]} material={roll}>
            <cylinderGeometry args={[0.668, 0.668, 0.9, 40, 1, true]} />
          </mesh>
          {band(11.3, 0.66, 0.12)}
          <mesh geometry={SATURN.sm} material={silver} />
          <mesh geometry={SATURN.cm} material={cuteToon("#F2F5FF", { paint: 0.5 })} />
          {/* a little round window on the capsule (cute, and the real one had windows) */}
          <mesh position={[0, 12.98, 0.3]} rotation={[-0.55, 0, 0]} material={cuteToon("#7FD1FF", { emissive: "#2A6FB0" })}>
            <circleGeometry args={[0.07, 20]} />
          </mesh>
          {/* the launch escape tower: a little lattice, the red motor and its nose */}
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2;
            return (
              <mesh key={`t${i}`} position={[Math.cos(a) * 0.07, 13.62, Math.sin(a) * 0.07]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} material={red}>
                <cylinderGeometry args={[0.018, 0.018, 0.72, 6]} />
              </mesh>
            );
          })}
          <mesh position={[0, 14.25, 0]} material={red}>
            <cylinderGeometry args={[0.1, 0.11, 0.62, 16]} />
          </mesh>
          <mesh position={[0, 14.7, 0]} material={red}>
            <coneGeometry args={[0.1, 0.3, 16]} />
          </mesh>
          <mesh position={[0, 14.88, 0]} material={T("#FFD23F", { emissive: "#FFB300", glow: 0.3 })}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
/** the launch umbilical tower: a bright red lattice with swing arms and a hammerhead crane */
export function LaunchTower() {
  const m = cuteToon("#FF7A6B", { paint: 0.5 });
  const light = cuteToon("#FFB3A1", { paint: 0.5 });
  return (
    <group position={[2.4, 0, 0]}>
      {[[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].map(([x, z], i) => (
        <mesh key={i} position={[x, 7.8, z]} material={m}>
          <boxGeometry args={[0.16, 15.6, 0.16]} />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={`r${i}`} position={[0, 0.9 + i, 0]} material={i % 2 ? light : m}>
          <boxGeometry args={[1.2, 0.1, 1.2]} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`x${i}`} position={[0, 1.4 + i * 2, 0.6]} rotation={[0, 0, i % 2 ? 0.75 : -0.75]} material={m}>
          <boxGeometry args={[0.07, 1.55, 0.07]} />
        </mesh>
      ))}
      {([[4.5, 1.0], [8, 1.0], [10.6, 0.66], [12.5, 0.4]] as const).map(([y, r]) => {
        const w = 2.4 - 0.55 - r;
        return (
          <mesh key={y} position={[-0.55 - w / 2, y, 0]} material={m}>
            <boxGeometry args={[w, 0.16, 0.34]} />
          </mesh>
        );
      })}
      {/* hammerhead crane on top */}
      <mesh position={[0.4, 16.1, 0]} material={m}>
        <boxGeometry args={[2.6, 0.22, 0.3]} />
      </mesh>
      <mesh position={[0, 16.6, 0]} material={T("#FFD23F", { emissive: "#FFB300", glow: 0.4 })}>
        <sphereGeometry args={[0.12, 12, 10]} />
      </mesh>
      <mesh position={[-1.5, -0.2, 0]} material={T("#D8D2C4")} receiveShadow>
        <boxGeometry args={[7, 0.6, 5]} />
      </mesh>
    </group>
  );
}

/** soft billowing clouds (vapour or exhaust): round soft sprites, cream, low opacity */
let puffTex: THREE.CanvasTexture | null = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return (puffTex = new THREE.CanvasTexture(c));
}
export function Puffs({ count = 10, spread = 2, rise = 0, color = "#F3EEE4", opacity = 0.55, size = 2.4, amount }: { count?: number; spread?: number; rise?: number; color?: string; opacity?: number; size?: number; amount: MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, opacity, depthWrite: false }), [color, opacity]);
  const seeds = useMemo(() => {
    const r = rnd(7 + count);
    return Array.from({ length: count }, () => ({ a: r() * Math.PI * 2, d: r(), s: 0.6 + r() * 0.8, ph: r() * 6 }));
  }, [count]);
  useFrame((st) => {
    const k = amount.current;
    if (!g.current) return;
    g.current.visible = k > 0.01;
    g.current.children.forEach((c, i) => {
      const s = seeds[i];
      const t = st.clock.elapsedTime * 0.15 + s.ph;
      const r = spread * (0.25 + s.d * k);
      c.position.set(Math.cos(s.a) * r, 0.5 + s.d * rise * k + Math.sin(t) * 0.12, Math.sin(s.a) * r);
      c.scale.setScalar(size * s.s * (0.5 + k));
    });
    mat.opacity = opacity * Math.min(1, k * 1.5);
  });
  return (
    <group ref={g}>
      {seeds.map((_, i) => (
        <sprite key={i} material={mat} />
      ))}
    </group>
  );
}

/** engine flame: flat cream-to-amber cone (no glow) */
export function Flame({ amount, length = 3, radius = 0.9 }: { amount: MutableRefObject<number>; length?: number; radius?: number }) {
  const m = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!m.current) return;
    const k = amount.current;
    m.current.visible = k > 0.01;
    m.current.scale.set(1, k * (0.94 + Math.sin(s.clock.elapsedTime * 28) * 0.06), 1);
  });
  return (
    <group ref={m} visible={false}>
      <mesh position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]} material={glowMaterial("#E9B27A", 1)}>
        <coneGeometry args={[radius, length, 14]} />
      </mesh>
      <mesh position={[0, -length * 0.3, 0]} rotation={[Math.PI, 0, 0]} material={glowMaterial("#F6E8CF", 1)}>
        <coneGeometry args={[radius * 0.55, length * 0.6, 12]} />
      </mesh>
    </group>
  );
}

/** dust blown out in flat, fast sheets (no air, so it never billows) */
export function DustSheet({ amount }: { amount: MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#B9B6B0", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), []);
  useFrame(() => {
    const k = amount.current;
    if (!g.current) return;
    g.current.visible = k > 0.01;
    g.current.children.forEach((c, i) => {
      const r = 0.6 + k * (3 + i * 2.2);
      c.scale.set(r, r, 1);
    });
    mat.opacity = 0.45 * (1 - Math.min(1, k * 0.7));
  });
  return (
    <group ref={g} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={mat}>
          <ringGeometry args={[0.7, 1, 40]} />
        </mesh>
      ))}
    </group>
  );
}

/** boot print decal (ridged Apollo sole) */
let printTex: THREE.CanvasTexture | null = null;
export function bootPrintTexture() {
  printTex ??= canvasTexture(128, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    // one sole: wide toe, slight waist, rounded heel, with the ridged tread across it
    const sole = new Path2D();
    sole.moveTo(w * 0.5, h * 0.04);
    sole.bezierCurveTo(w * 0.95, h * 0.04, w * 0.92, h * 0.42, w * 0.8, h * 0.56);
    sole.bezierCurveTo(w * 0.74, h * 0.66, w * 0.86, h * 0.96, w * 0.5, h * 0.96);
    sole.bezierCurveTo(w * 0.14, h * 0.96, w * 0.26, h * 0.66, w * 0.2, h * 0.56);
    sole.bezierCurveTo(w * 0.08, h * 0.42, w * 0.05, h * 0.04, w * 0.5, h * 0.04);
    x.fillStyle = "rgba(62,60,66,0.6)";
    x.fill(sole);
    x.save();
    x.clip(sole);
    x.strokeStyle = "rgba(170,168,174,0.75)";
    x.lineWidth = 6;
    for (let y = h * 0.08; y < h * 0.95; y += 17) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(w, y);
      x.stroke();
    }
    x.restore();
  });
  return printTex;
}
export function BootPrint({ position, rotation = 0, depth }: { position: [number, number, number]; rotation?: number; depth?: MutableRefObject<number> }) {
  const texture = bootPrintTexture();
  const m = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (m.current && depth) m.current.opacity = Math.min(1, depth.current);
  });
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[0.16, 0.32]} />
      <meshBasicMaterial ref={m} map={texture} transparent depthWrite={false} opacity={depth ? 0 : 1} />
    </mesh>
  );
}

/** an Apollo astronaut: adult proportions (never chibi), all-white suit, gold visor down, no face shown */
export function Apollonaut({ driver, seed = 0 }: { driver: MutableRefObject<Driver>; seed?: number }) {
  // real astronauts: adult proportions, visors down, no faces; the 2.5 px outline so they belong in the picture
  const g = useRef<THREE.Group>(null);
  useOutlines(g, "interactable");
  return (
    <group ref={g}>
      <ApolloSuit driver={driver} seed={seed} />
    </group>
  );
}
/** machines and big props wear the 2.5 px line */
export function Outlined({ children, kind = "interactable" }: { children: React.ReactNode; kind?: "interactable" | "env" | "character" }) {
  const g = useRef<THREE.Group>(null);
  useOutlines(g, kind);
  return <group ref={g}>{children}</group>;
}

/* ---------------- science and flag ---------------- */
export function Seismometer() {
  // v7.1: the Passive Seismic Experiment: a gold-foil drum on a base plate, a silver thermal skirt,
  // two blue solar-cell wings with a cell grid, and a small antenna
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) out.push([-0.34 + i * 0.136, -0.18 + j * 0.12]);
    return out;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.03, 0]} material={T("#C9C6CF")} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.7]} />
      </mesh>
      <mesh position={[0, 0.27, 0]} material={T("#D9A441")} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.44, 12]} />
      </mesh>
      {[0.12, 0.22, 0.32, 0.42].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={T("#F2C66A")}>
          <torusGeometry args={[0.3 - y * 0.05, 0.012, 6, 24]} />
        </mesh>
      ))}
      <mesh position={[0, 0.53, 0]} material={T("#E6E3EC")}>
        <coneGeometry args={[0.33, 0.14, 12, 1, true]} />
      </mesh>
      <mesh position={[0.12, 0.7, 0.05]} material={T("#B9B6B0")}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
      </mesh>
      <mesh position={[0.12, 0.86, 0.05]} rotation={[0.5, 0, 0.3]} material={T("#E6E3EC")}>
        <cylinderGeometry args={[0.07, 0.01, 0.04, 14]} />
      </mesh>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.78, 0.32, 0]} rotation={[0, 0, sd * -0.08]}>
          <mesh material={T("#2E3D66")}>
            <boxGeometry args={[0.9, 0.035, 0.52]} />
          </mesh>
          {cells.map(([x, z], i) => (
            <mesh key={i} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} material={T(i % 3 ? "#4F6BC2" : "#5E7FD6")}>
              <planeGeometry args={[0.12, 0.105]} />
            </mesh>
          ))}
          <mesh position={[-sd * 0.47, -0.02, 0]} material={T("#B9B6B0")}>
            <boxGeometry args={[0.06, 0.03, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export function Reflector() {
  // v7.1: the Laser Ranging Retroreflector: a silver frame holding 100 glass corner cubes (shown
  // as a 10 x 10 grid of glinting cells), tilted toward Earth on two legs
  const cubes = useMemo(() => Array.from({ length: 100 }, (_, i) => [((i % 10) - 4.5) * 0.064, (Math.floor(i / 10) - 4.5) * 0.064] as [number, number]), []);
  return (
    <group>
      <group position={[0, 0.36, 0]} rotation={[-0.55, 0, 0]}>
        <mesh material={T("#C9C6CF")} castShadow>
          <boxGeometry args={[0.76, 0.07, 0.76]} />
        </mesh>
        <mesh position={[0, 0.036, 0]} material={T("#4E5A73")}>
          <boxGeometry args={[0.68, 0.01, 0.68]} />
        </mesh>
        {cubes.map(([x, z], i) => (
          <mesh key={i} position={[x, 0.044, z]} rotation={[-Math.PI / 2, 0, (i % 2) * 0.5]} material={T(i % 7 === 0 ? "#D7F0FF" : i % 3 ? "#8FB4CC" : "#A9CBE0")}>
            <circleGeometry args={[0.028, 6]} />
          </mesh>
        ))}
      </group>
      {[-0.27, 0.27].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.16, 0.14]} material={T("#9C9AA3")}>
            <cylinderGeometry args={[0.022, 0.022, 0.32, 8]} />
          </mesh>
          <mesh position={[x, 0.01, 0.14]} material={T("#9C9AA3")}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.08, -0.12]} rotation={[0.3, 0, 0]} material={T("#9C9AA3")}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
      </mesh>
    </group>
  );
}
/** solar wind experiment: a sheet on a pole facing the Sun (shown, not named, in the story) */
export function SolarWindSheet() {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} material={T("#85817A")}>
        <cylinderGeometry args={[0.025, 0.025, 1.6, 6]} />
      </mesh>
      <mesh position={[0, 1.15, 0.03]} material={T("#D8D6D0", { side: THREE.DoubleSide })}>
        <planeGeometry args={[0.32, 1.0]} />
      </mesh>
    </group>
  );
}
/** the flag, in muted colours (bible §6: no saturated surfaces) */
export function Flag() {
  const tex = useMemo(
    () =>
      canvasTexture(190, 100, (x, w, h) => {
        for (let i = 0; i < 13; i++) {
          x.fillStyle = i % 2 ? "#E6E2DA" : "#9A5A50";
          x.fillRect(0, (i * h) / 13, w, h / 13 + 1);
        }
        x.fillStyle = "#3B4A66";
        x.fillRect(0, 0, w * 0.4, (h * 7) / 13);
      }),
    [],
  );
  return (
    <group>
      <mesh position={[0, 1.0, 0]} material={T("#B9B6B0")}>
        <cylinderGeometry args={[0.02, 0.02, 2.0, 6]} />
      </mesh>
      <mesh position={[0.45, 1.75, 0]} rotation={[0, 0, Math.PI / 2]} material={T("#B9B6B0")}>
        <cylinderGeometry args={[0.012, 0.012, 0.9, 5]} />
      </mesh>
      <mesh position={[0.45, 1.5, 0]}>
        <planeGeometry args={[0.9, 0.48]} />
        <meshLambertMaterial map={tex} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
/** a rock box (sample return container) */
export function RockBoxModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={T("#B9B6B0")} castShadow>
        <boxGeometry args={[0.5, 0.34, 0.32]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={T("#85817A")}>
        <boxGeometry args={[0.52, 0.04, 0.34]} />
      </mesh>
    </group>
  );
}
export { PAL };
