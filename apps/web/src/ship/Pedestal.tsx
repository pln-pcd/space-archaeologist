import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { chapters } from "../chapters";
import { Spring, hump, life, popEase } from "../anim/kit";
import { PAL } from "../style/palette";
import { blobTexture, dusty, glowMaterial, toonMaterial, toonUnique } from "../style/toon";
import { BOOK_POS, where } from "./layout";
import { MiniMachine } from "./Machines";

/** The five looks of the one storybook prop. */
export type BookLook = "locked" | "next" | "unlocked" | "progress" | "done";

const T = toonMaterial;
const FONT = '"DM Sans", "Trebuchet MS", sans-serif';
/** Shared measurements: every pedestal and book in the row uses these. */
export const PED = { w: 1.3, stepH: 0.45, stepD: 0.5, towerH: 1.0, towerD: 0.6, bookW: 0.8, bookH: 1.0, bookT: 0.16, tilt: (20 * Math.PI) / 180 };

/** Which hover/focus spot is highlighted (shared with the station buttons for keyboard users). */
export const highlight = { id: null as string | null, hover: null as string | null, focus: null as string | null };

function canvas(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Embossed foil emblem of the chapter's machine type, drawn on the cover. */
function drawEmblem(x: CanvasRenderingContext2D, type: string, cx: number, cy: number, s: number) {
  x.save();
  x.translate(cx, cy);
  x.scale(s, s);
  x.lineWidth = 7;
  x.lineJoin = "round";
  x.lineCap = "round";
  x.strokeStyle = "#FFF4D6";
  x.fillStyle = "rgba(255,244,214,0.25)";
  if (type === "lander" || type === "viking") {
    x.beginPath();
    x.moveTo(-34, -6);
    x.lineTo(34, -6);
    x.lineTo(28, 22);
    x.lineTo(-28, 22);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.roundRect(-20, -34, 40, 28, 8);
    x.fill();
    x.stroke();
    for (const s2 of [-1, 1]) {
      x.beginPath();
      x.moveTo(s2 * 24, 22);
      x.lineTo(s2 * 44, 50);
      x.moveTo(s2 * 52, 50);
      x.lineTo(s2 * 36, 50);
      x.stroke();
    }
  } else if (type === "rover") {
    x.beginPath();
    x.roundRect(-40, -10, 80, 22, 6);
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(-46, -20);
    x.lineTo(46, -20);
    x.stroke();
    x.beginPath();
    x.moveTo(18, -20);
    x.lineTo(18, -44);
    x.stroke();
    x.beginPath();
    x.roundRect(8, -54, 22, 12, 4);
    x.stroke();
    for (const wx of [-30, 0, 30]) {
      x.beginPath();
      x.arc(wx, 26, 10, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }
  } else {
    x.beginPath();
    x.ellipse(0, -10, 40, 14, 0, Math.PI, 0);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(0, -10);
    x.lineTo(0, -38);
    x.stroke();
    x.beginPath();
    x.roundRect(-14, 4, 28, 18, 5);
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(12, 14);
    x.lineTo(54, 40);
    x.moveTo(-12, 14);
    x.lineTo(-40, 44);
    x.stroke();
  }
  x.restore();
}

/** One storybook prop: same shape for every chapter; only the look and the cover art change. */
function StoryBook({ index, look, progress, hovered }: { index: number; look: BookLook; progress: number; hovered: MutableRefObject<number> }) {
  const c = chapters[index];
  const group = useRef<THREE.Group>(null);
  const outline = useRef<THREE.Mesh>(null);
  const lockLight = useRef<THREE.Mesh>(null);
  const pageL = useRef<THREE.Group>(null);
  const pageR = useRef<THREE.Group>(null);
  const coverMat = useMemo(() => toonUnique(c.color, { emissive: c.color, glow: 0 }), [c.color]);
  const cover = useMemo(
    () =>
      canvas(256, 320, (x, w, h) => {
        const col = look === "locked" ? "#" + dusty(c.color, 0.85).getHexString() : c.color;
        x.fillStyle = col;
        x.fillRect(0, 0, w, h);
        // inset border like a cloth hardcover
        x.strokeStyle = "rgba(255,244,214,0.55)";
        x.lineWidth = 6;
        x.beginPath();
        x.roundRect(14, 14, w - 28, h - 28, 18);
        x.stroke();
        drawEmblem(x, c.type, w / 2, 140, 1.25);
        // chapter number in the corner
        x.fillStyle = "#FFF4D6";
        x.font = `800 34px ${FONT}`;
        x.textAlign = "left";
        x.fillText(String(index + 1).padStart(2, "0"), 26, 52);
        x.textAlign = "center";
        x.font = `800 26px ${FONT}`;
        x.fillText(c.machine.toUpperCase(), w / 2, 262);
        x.font = `600 18px ${FONT}`;
        x.fillStyle = "rgba(255,244,214,0.85)";
        x.fillText(c.location, w / 2, 290);
      }),
    [c, index, look],
  );
  const spine = useMemo(
    () =>
      canvas(320, 48, (x, w, h) => {
        x.fillStyle = look === "locked" ? "#" + dusty(PAL.ink, 0.5).getHexString() : PAL.ink;
        x.fillRect(0, 0, w, h);
        x.fillStyle = "#FFF4D6";
        x.font = `700 22px ${FONT}`;
        x.textAlign = "center";
        x.fillText(c.title, w / 2, 32);
      }),
    [c, look],
  );
  const pages = useMemo(
    () =>
      canvas(128, 160, (x, w, h) => {
        x.fillStyle = "#FFF8EC";
        x.fillRect(0, 0, w, h);
        x.strokeStyle = "rgba(122,100,140,0.35)";
        x.lineWidth = 4;
        for (let y = 26; y < h - 20; y += 16) {
          x.beginPath();
          x.moveTo(14, y);
          x.lineTo(w - 14 - ((y * 7) % 30), y);
          x.stroke();
        }
      }),
    [],
  );
  useEffect(() => {
    coverMat.map = cover;
    coverMat.color.set("#ffffff");
    coverMat.needsUpdate = true;
  }, [cover, coverMat]);
  useEffect(() => () => [cover, spine].forEach((t) => t.dispose()), [cover, spine]);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const L = life();
    const hv = hovered.current;
    if (group.current) {
      const bob = look === "next" ? Math.sin(t * 2.2) * 0.03 * L : 0;
      group.current.position.y = bob + hv * 0.06;
      group.current.rotation.x = -PED.tilt + hv * 0.08;
    }
    if (outline.current) {
      const m = outline.current.material as THREE.MeshBasicMaterial;
      m.opacity = look === "next" ? 0.35 + Math.sin(t * 3) * 0.25 * L + 0.2 : hv * 0.5;
      outline.current.visible = look === "next" || hv > 0.02;
    }
    if (lockLight.current) lockLight.current.scale.setScalar(0.8 + Math.sin(t * 1.6) * 0.2 * L);
    coverMat.emissiveIntensity = look === "unlocked" ? 0.08 + (Math.sin(t * 2 + index) * 0.5 + 0.5) * 0.12 * L : look === "next" ? 0.14 : 0;
    if (pageL.current && pageR.current) {
      const curl = Math.sin(t * 1.4) * 0.04 * L;
      pageL.current.rotation.y = 0.32 + curl;
      pageR.current.rotation.y = -0.32 - curl;
    }
  });

  const open = look === "progress";
  const W = PED.bookW,
    H = PED.bookH,
    TH = PED.bookT;
  return (
    <group ref={group}>
      {/* soft glowing edge for the next book (and the hover outline) */}
      <mesh ref={outline} position={[0, H / 2, 0]} visible={false}>
        <boxGeometry args={[(open ? W * 2 : W) + 0.12, H + 0.12, TH + 0.12]} />
        <meshBasicMaterial color={PAL.brass} transparent opacity={0.5} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {!open ? (
        <group position={[0, H / 2, 0]}>
          {/* back cover, page block (inset), front cover with art, spine */}
          <RoundedBox args={[W, H, 0.035]} radius={0.015} position={[0, 0, -TH / 2 + 0.018]} material={T(look === "locked" ? "#8F8AA0" : c.color)} castShadow />
          <RoundedBox args={[W - 0.06, H - 0.06, TH - 0.06]} radius={0.01} position={[0.02, 0, 0]} material={T("#FFF4E0")} />
          <RoundedBox args={[W, H, 0.035]} radius={0.015} position={[0, 0, TH / 2 - 0.018]} material={coverMat} castShadow />
          <mesh position={[-W / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[TH, H]} />
            <meshBasicMaterial color={look === "locked" ? "#6E6880" : PAL.ink} />
          </mesh>
          <mesh position={[-W / 2 - 0.002, 0, 0]} rotation={[0, -Math.PI / 2, Math.PI / 2]}>
            <planeGeometry args={[H * 0.9, TH * 0.8]} />
            <meshBasicMaterial map={spine} />
          </mesh>
          {look === "locked" && <Chain />}
          {look === "locked" && <Padlock lightRef={lockLight} />}
          {look === "done" && <StarSeal />}
        </group>
      ) : (
        <group position={[0, H / 2, 0]}>
          {/* open book: two covers and page blocks, a ribbon and a tiny progress bar */}
          {[-1, 1].map((sgn) => (
            <group key={sgn} ref={sgn < 0 ? pageL : pageR}>
              <group position={[sgn * (W / 2), 0, 0]}>
                <RoundedBox args={[W, H, 0.035]} radius={0.015} position={[0, 0, -0.04]} material={T(c.color)} castShadow />
                <RoundedBox args={[W - 0.05, H - 0.05, 0.05]} radius={0.01} position={[-sgn * 0.01, 0, 0]} material={T("#FFF4E0")} />
                <mesh position={[-sgn * 0.01, 0, 0.027]}>
                  <planeGeometry args={[W - 0.12, H - 0.12]} />
                  <meshBasicMaterial map={pages} />
                </mesh>
              </group>
            </group>
          ))}
          <mesh position={[0.06, -H / 2 + 0.05, 0.05]} rotation={[0.2, 0, 0]} material={T(PAL.coral, { side: THREE.DoubleSide })}>
            <planeGeometry args={[0.07, 0.42]} />
          </mesh>
          <mesh position={[W / 2, -H / 2 + 0.06, 0.04]}>
            <planeGeometry args={[W * 0.8, 0.035]} />
            <meshBasicMaterial color="#C9BFE0" />
          </mesh>
          <mesh position={[W / 2 - (W * 0.8 * (1 - progress)) / 2, -H / 2 + 0.06, 0.042]}>
            <planeGeometry args={[W * 0.8 * Math.max(0.05, progress), 0.035]} />
            <meshBasicMaterial color={PAL.teal} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Chain wrapped around the closed book: links follow its cross-section. */
function Chain() {
  const links = useMemo(() => {
    const out: { p: [number, number, number]; r: [number, number, number] }[] = [];
    const hw = PED.bookW / 2 + 0.03,
      ht = PED.bookT / 2 + 0.035;
    const perim = [
      [-hw, ht],
      [hw, ht],
      [hw, -ht],
      [-hw, -ht],
    ];
    for (let side = 0; side < 4; side++) {
      const [ax, az] = perim[side],
        [bx, bz] = perim[(side + 1) % 4];
      const n = side % 2 === 0 ? 8 : 2;
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const horiz = side % 2 === 0;
        out.push({ p: [ax + (bx - ax) * k, 0, az + (bz - az) * k], r: [0, horiz ? 0 : Math.PI / 2, (out.length % 2) * (Math.PI / 2)] });
      }
    }
    return out;
  }, []);
  return (
    <group position={[0, -0.05, 0]}>
      {links.map((l, i) => (
        <mesh key={i} position={l.p} rotation={l.r} material={T("#B9B3CC")} castShadow>
          <torusGeometry args={[0.045, 0.016, 6, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** A real padlock (body, shackle, keyhole) seated on the cover, its shackle through the chain. */
function Padlock({ lightRef }: { lightRef?: MutableRefObject<THREE.Mesh | null> }) {
  return (
    <group position={[0, -0.05, PED.bookT / 2 + 0.07]}>
      <RoundedBox args={[0.24, 0.2, 0.09]} radius={0.04} smoothness={3} material={T(PAL.brass)} castShadow />
      <mesh position={[0, 0.11, 0]} material={T("#C9C3DA")} castShadow>
        <torusGeometry args={[0.07, 0.022, 10, 18, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.0, 0.047]} material={T(PAL.ink)}>
        <circleGeometry args={[0.025, 14]} />
      </mesh>
      <mesh position={[0, -0.035, 0.047]} material={T(PAL.ink)}>
        <planeGeometry args={[0.018, 0.04]} />
      </mesh>
      <mesh ref={lightRef} position={[0.08, 0.06, 0.047]} material={glowMaterial(PAL.coral, 1.6)}>
        <circleGeometry args={[0.014, 10]} />
      </mesh>
    </group>
  );
}

/** Gold star seal with ribbon for a completed book. */
function StarSeal() {
  const star = useMemo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2,
        r = i % 2 ? 0.05 : 0.12;
      if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
  }, []);
  return (
    <group position={[0.22, 0.3, PED.bookT / 2 + 0.01]}>
      <mesh geometry={star} material={T(PAL.brass, { emissive: PAL.brass, glow: 0.25 })} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.04, -0.13, 0.005]} rotation={[0, 0, s * 0.25]} material={T(PAL.coral, { side: THREE.DoubleSide })}>
          <planeGeometry args={[0.05, 0.16]} />
        </mesh>
      ))}
    </group>
  );
}

/** Small 3D plaque on the pedestal front: number, title and status. */
function Plaque({ index, look }: { index: number; look: BookLook }) {
  const c = chapters[index];
  const tex = useMemo(
    () =>
      canvas(512, 128, (x, w, h) => {
        x.fillStyle = PAL.wall;
        x.beginPath();
        x.roundRect(0, 0, w, h, 26);
        x.fill();
        x.fillStyle = look === "locked" ? "#B9B3CC" : PAL.brass;
        x.font = `800 46px ${FONT}`;
        x.textAlign = "left";
        x.fillText(String(index + 1).padStart(2, "0"), 26, 78);
        x.fillStyle = "#FFFFFF";
        x.font = `700 36px ${FONT}`;
        x.fillText(c.machine, 110, 62);
        x.fillStyle = look === "locked" ? "#C7BDF5" : PAL.mint;
        x.font = `600 24px ${FONT}`;
        const status = { locked: "Locked", next: "Ready to read", unlocked: "Unlocked", progress: "In progress", done: "Completed" }[look];
        x.fillText(status, 110, 100);
      }),
    [c, index, look],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, PED.stepH * 0.5, PED.stepD + 0.051 - 0.02]}>
      <RoundedBox args={[0.92, 0.25, 0.04]} radius={0.03} material={T(PAL.brass)} />
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[0.86, 0.215]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * A two-tier pedestal: the front step carries the chapter's machine (dusty until unlocked), the
 * back tower carries the storybook on a cradle, angled toward the default view. Nothing floats.
 */
export function Pedestal({ index, look, progress, open }: { index: number; look: BookLook; progress: number; open: boolean }) {
  const [x, z] = BOOK_POS[index];
  const awake = useRef(open ? 1 : 0);
  const hovered = useRef(0);
  const book = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Group>(null);
  const ghost = useRef<THREE.Group>(null);
  const anim = useMemo(() => ({ unlockT: -1, prevOpen: open, wob: new Spring(0), near: false }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !anim.prevOpen) anim.unlockT = 0;
    if (!open) {
      anim.unlockT = -1;
      awake.current = 0;
    }
    anim.prevOpen = open;
  }, [open, anim]);

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const id = `book-${chapters[index].id}`;
    const target = highlight.id === id ? 1 : 0;
    hovered.current += (target - hovered.current) * Math.min(1, dt * 10);
    const d = Math.hypot(where.x - x, where.z - (z + 0.9));
    const near = d < 1.6;
    if (near && !anim.near) anim.wob.kick(4);
    anim.near = near;
    const w = anim.wob.step(0, dt, 150, 8);
    let u = 1;
    if (anim.unlockT >= 0) {
      anim.unlockT += dt;
      u = Math.min(1, anim.unlockT / 1.2);
      if (u >= 1) anim.unlockT = -1;
    }
    if (open) awake.current = Math.min(1, anim.unlockT >= 0 ? popEase(u) : awake.current + dt * 2);
    if (book.current) {
      book.current.rotation.z = w * 0.03;
      // turn toward the camera only on hover or focus
      book.current.rotation.y = hovered.current * Math.sin(s.clock.elapsedTime * 0.8) * 0.12;
    }
    // unlock: the old chain + padlock fly off as a ghost, sparkles burst, the cover lights up
    if (ghost.current) {
      const on = anim.unlockT >= 0;
      ghost.current.visible = on;
      if (on) {
        ghost.current.position.y = popEase(u) * 0.5;
        ghost.current.scale.setScalar(Math.max(0.001, 1 - u));
        ghost.current.rotation.z = u * 0.8;
      }
    }
    if (burst.current) {
      burst.current.visible = anim.unlockT >= 0;
      burst.current.children.forEach((sp, i) => {
        const a = (i / burst.current!.children.length) * Math.PI * 2;
        const r = popEase(u) * 0.9;
        sp.position.set(Math.cos(a) * r, 0.6 + Math.sin(a * 3) * 0.2 + r * 0.3, Math.sin(a) * r * 0.5);
        sp.scale.setScalar(Math.max(0.001, 1 - u) * (0.6 + hump(u)));
      });
    }
  });

  const bookY = PED.towerH + 0.12;
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.05]}>
        <planeGeometry args={[2.2, 2.0]} />
        <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} />
      </mesh>
      {/* back tower */}
      <RoundedBox args={[PED.w, PED.towerH, PED.towerD]} radius={0.16} smoothness={3} position={[0, PED.towerH / 2, -PED.towerD / 2 + 0.05]} material={T(PAL.cream)} castShadow receiveShadow />
      <RoundedBox args={[PED.w + 0.1, 0.1, PED.towerD + 0.1]} radius={0.04} position={[0, PED.towerH, -PED.towerD / 2 + 0.05]} material={T(PAL.brass)} castShadow />
      {/* front step with the machine */}
      <RoundedBox args={[PED.w, PED.stepH, PED.stepD]} radius={0.14} smoothness={3} position={[0, PED.stepH / 2, PED.stepD / 2 + 0.05]} material={T(PAL.creamDeep)} castShadow receiveShadow />
      <mesh position={[0, PED.stepH + 0.012, PED.stepD / 2 + 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.36]} />
        <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} />
      </mesh>
      <group position={[0, PED.stepH, PED.stepD / 2 + 0.05]} scale={1.05}>
        <MiniMachine id={chapters[index].id} awake={awake} />
      </group>
      <Plaque index={index} look={look} />
      {/* book cradle on the tower top */}
      <group position={[0, PED.towerH + 0.05, -PED.towerD / 2 + 0.05]}>
        <RoundedBox args={[0.92, 0.07, 0.3]} radius={0.03} material={T(PAL.wall2)} castShadow />
        <RoundedBox args={[0.92, 0.12, 0.05]} radius={0.02} position={[0, 0.08, 0.14]} material={T(PAL.wall2)} />
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 0.5]} />
          <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} />
        </mesh>
      </group>
      <group ref={book} position={[0, bookY, -PED.towerD / 2 + 0.12]}>
        <StoryBook index={index} look={look} progress={progress} hovered={hovered} />
        <group ref={ghost} visible={false} position={[0, 0, 0]}>
          <group position={[0, PED.bookH / 2, 0]} rotation={[-PED.tilt, 0, 0]}>
            <Chain />
            <Padlock />
          </group>
        </group>
        <group ref={burst} visible={false}>
          {Array.from({ length: 14 }, (_, i) => (
            <mesh key={i} material={glowMaterial([PAL.brass, PAL.pink, PAL.mint][i % 3], 2.2)}>
              <octahedronGeometry args={[0.05, 0]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Book look for a chapter, from the single source of truth (chapter state + saved page). */
export function bookLook(state: "here" | "done" | "ready" | "locked", pagesRead: number): BookLook {
  if (state === "done") return "done";
  if (state === "locked") return "locked";
  if (state === "ready") return "unlocked";
  return pagesRead > 0 ? "progress" : "next";
}
