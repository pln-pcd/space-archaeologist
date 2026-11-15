import { useOutlines } from "../fx/outline";
// A kid explorer matching the 4 turnaround reference sheets, CUTE POLISH v2 (bible §22):
// - Child proportions: about 4.5 heads tall, full cheeks and a
//   soft blush, large round eyes set wide and a little low with white catch-lights, short chubby limbs,
//   chunky shoes. Not super-deformed.
// - Blinks; expressions happy / curious / surprised / determined / sleepy; hair, ponytail and hem sway
// - Matte two-tone sun-shaded materials, baked AO feel, blob shadow
// - Distinct hair, face, eyes, and outfits matching Image 1 to Image 4
// - Spacesuit transformation pieces (boots, gloves, suit, pack, helmet, name patch)
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rampMaterial } from "../fx/ramp";
import { PAL } from "../style/palette";
import { motion } from "../anim/kit";
import type { Driver } from "../ship/Chubby";
import { KIDS, type KidId, type KidLook } from "./kids";
import { isLegacyStyle } from "../style/styleMode";
import { MoodLitMaterial } from "../fx/MoodLitMaterial";

export type KidAct = "flex" | "nod" | "lookGloves" | "wave" | "cover" | "hop" | null;
export type KidExpr = "neutral" | "happy" | "curious" | "surprised" | "determined" | "sleepy";
export type KidDriver = Driver & { act?: KidAct; actT?: number; idleStyle?: boolean; expr?: KidExpr };
export type Reveal = { boots: number; gloves: number; suit: number; pack: number; helmet: number; visor: number; patch: number; clothes: number };
export const SUIT_ON: Reveal = { boots: 1, gloves: 1, suit: 1, pack: 1, helmet: 0, visor: 0, patch: 1, clothes: 0 };
export const CLOTHES: Reveal = { boots: 0, gloves: 0, suit: 0, pack: 0, helmet: 0, visor: 0, patch: 0, clothes: 1 };

function makeMat(color: string) {
  if (isLegacyStyle()) {
    return rampMaterial(color, { character: true, flat: false });
  }
  return new MoodLitMaterial({ color });
}

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

// Child proportions: kid ≈ 1.2 m, head ≈ 0.27 m.
const HIP = 0.44,
  THIGH = 0.2,
  SHIN = 0.2,
  UPPER = 0.15,
  FORE = 0.14,
  SH_Y = 0.71,
  SH_X = 0.175,
  HEAD_Y = 0.93;
/** the torso pieces were modelled for a longer body: squash them into the shorter, wider chibi torso */
const TORSO_S = 0.82,
  TORSO_W = 1.12,
  TORSO_Y = HIP - 0.52 * TORSO_S;
/** limbs are a little chubbier */
const CHUB = 1.18;

type Pose = {
  bob: number;
  lean: number;
  legL: number;
  legR: number;
  kneeL: number;
  kneeR: number;
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  elbL: number;
  elbR: number;
  headX: number;
  headY: number;
  headZ: number;
  lift: number;
  spin: number;
};
const ZERO: Pose = { bob: 0, lean: 0, legL: 0, legR: 0, kneeL: 0, kneeR: 0, armLx: 0, armLz: 0, armRx: 0, armRz: 0, elbL: 0, elbR: 0, headX: 0, headY: 0, headZ: 0, lift: 0, spin: 0 };
const add = (a: Pose, b: Partial<Pose>, w: number) => {
  for (const k in b) a[k as keyof Pose] += (b[k as keyof Pose] ?? 0) * w;
};

function Limb({ len, r0, r1, mat, shadow = true }: { len: number; r0: number; r1: number; mat: THREE.Material; shadow?: boolean }) {
  return (
    <mesh position={[0, -len / 2, 0]} material={mat} castShadow={shadow}>
      <cylinderGeometry args={[r0 * CHUB, r1 * CHUB, len, 10]} />
    </mesh>
  );
}

let blob: THREE.Texture | null = null;
function blobTexture() {
  if (blob) return blob;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0, "rgba(20, 18, 25, 0.40)");
  g.addColorStop(0.65, "rgba(20, 18, 25, 0.18)");
  g.addColorStop(1, "rgba(20, 18, 25, 0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  blob = new THREE.CanvasTexture(c);
  return blob;
}

function usePatchTexture(text: string, accent: string) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 112;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => {
    const draw = () => {
      const c = tex.image as HTMLCanvasElement;
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = "#EFE6D6";
      x.beginPath();
      x.roundRect(4, 4, c.width - 8, c.height - 8, 18);
      x.fill();
      x.strokeStyle = accent;
      x.lineWidth = 5;
      x.setLineDash([12, 8]);
      x.beginPath();
      x.roundRect(14, 14, c.width - 28, c.height - 28, 12);
      x.stroke();
      x.setLineDash([]);
      let size = 52;
      x.font = `500 ${size}px 'Roboto Mono', 'IBM Plex Mono', monospace`;
      while (x.measureText(text).width > c.width - 56 && size > 18) {
        size -= 2;
        x.font = `500 ${size}px 'Roboto Mono', 'IBM Plex Mono', monospace`;
      }
      x.fillStyle = "#3A3836";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(text, c.width / 2, c.height / 2 + 2);
      tex.needsUpdate = true;
    };
    draw();
    void document.fonts?.load("500 40px 'Roboto Mono'").then(draw);
  }, [text, accent, tex]);
  return tex;
}

export function Kid({
  id,
  driver,
  reveal,
  patch = "",
  seed = 0,
  helmetVisible,
  appearance,
}: {
  id: KidId;
  driver: MutableRefObject<KidDriver>;
  reveal?: MutableRefObject<Reveal>;
  patch?: string;
  seed?: number;
  helmetVisible?: boolean;
  appearance?: Partial<KidLook> & { suitColor?: string; visorTint?: string; helmetStyle?: number; accessory?: string };
}) {
  const look = useMemo(() => ({ ...KIDS[id], ...appearance }), [id, appearance]);
  // the kids wear the thickest line (3.25 px at 1080p); faces and tiny parts get none
  const root = useRef<THREE.Group>(null);
  useOutlines(root, "character", [id]);
  const R = useRef<Record<string, THREE.Object3D | null>>({});
  const ref = (k: string) => (o: THREE.Object3D | null) => void (R.current[k] = o);
  const st = useRef({ phase: seed * 1.7, walkW: 0, runW: 0, floatW: 0, sitW: 0, idleT: seed * 3, pose: { ...ZERO }, eyeY: 1, mouthO: 0, browUp: 0, smile: 0 });
  const full = useRef<Reveal>(helmetVisible ? { ...SUIT_ON, helmet: 1, visor: 1 } : SUIT_ON);
  const rv = reveal ?? full;

  const m = useMemo(
    () => ({
      skin: makeMat(look.skin),
      hair: makeMat(look.hair),
      torso: makeMat(look.torso),
      upper: makeMat(look.upper),
      fore: makeMat(look.fore),
      thigh: makeMat(look.thigh),
      shin: makeMat(look.shin),
      shoe: makeMat(look.shoe),
      eye: makeMat(look.eyeColor),
      white: makeMat("#ffffff"),
      dark: makeMat("#201a18"),
      suit: makeMat(appearance?.suitColor ?? PAL.bone),
      suitLight: makeMat(PAL.boneLight),
      acc: makeMat(look.accent),
      graphite: makeMat(PAL.graphite),
      visor: makeMat(appearance?.visorTint ?? PAL.brassTrim),
      glass: makeMat("#3A3836"),
      earring: makeMat("#2f8f6a"),
      undershirt: makeMat("#5a4033"),
      overallsShadow: makeMat("#4f9584"),
      pinaforeShadow: makeMat("#7fb46f"),
      bobble: makeMat("#b9cf3a"),
    }),
    [look],
  );

  const patchTex = usePatchTexture(patch || look.name.toUpperCase(), look.accent);

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = s.clock.elapsedTime;
    const d = driver.current;
    const k = st.current;

    if (d.emote && !d.act) {
      d.act = d.emote === "wave" ? "wave" : "nod";
      d.actT = 0;
      d.emote = null;
    }
    const moving = d.walk > 0.15;
    k.walkW = damp(k.walkW, moving ? 1 : 0, 8, dt);
    k.runW = damp(k.runW, moving && d.run ? 1 : 0, 8, dt);
    k.floatW = damp(k.floatW, d.float ? 1 : 0, 4, dt);
    const prev = k.phase;
    k.phase += dt * (d.run ? 10.5 : 7.6) * Math.max(0.35, d.walk);
    if (d.onStep && moving && Math.floor(k.phase / Math.PI) !== Math.floor(prev / Math.PI)) d.onStep(d.walk);
    const ph = k.phase,
      sw = Math.sin(ph),
      kn = (a: number) => Math.max(0, Math.sin(a + 0.6));
    const calm = motion.reduced ? 0.3 : 1;
    k.sitW = damp(k.sitW, d.sitting ? 1 : 0, 6, dt);
    const idleW = (1 - k.walkW) * (1 - k.floatW) * (1 - k.sitW);
    const p: Pose = { ...ZERO };

    add(p, { bob: Math.sin(t * 1.6 + seed) * 0.005, armLz: 0.08, armRz: -0.08, elbL: -0.12, elbR: -0.12, headX: Math.sin(t * 0.4 + seed) * 0.03 * calm }, idleW);
    add(p, { bob: Math.abs(Math.cos(ph)) * 0.02, lean: 0.05, legL: sw * 0.45, legR: -sw * 0.45, kneeL: kn(ph) * 0.55, kneeR: kn(ph + Math.PI) * 0.55, armLx: -sw * 0.45, armRx: sw * 0.45, armLz: 0.07, armRz: -0.07, elbL: -0.3, elbR: -0.3 }, k.walkW * (1 - k.runW));
    add(p, { bob: Math.abs(Math.cos(ph)) * 0.04, lean: 0.16, legL: sw * 0.75, legR: -sw * 0.75, kneeL: kn(ph) * 1.0, kneeR: kn(ph + Math.PI) * 1.0, armLx: -sw * 0.8, armRx: sw * 0.8, armLz: 0.08, armRz: -0.08, elbL: -1.1, elbR: -1.1, headX: -0.05 }, k.runW);
    add(p, { bob: Math.sin(t * 1.4 + seed) * 0.03 * calm, legL: 0.12, legR: 0.04, kneeL: 0.25, kneeR: 0.15, armLz: 0.22, armRz: -0.22, elbL: -0.3, elbR: -0.3 }, k.floatW);
    add(p, { bob: -0.28, legL: -1.4, legR: -1.35, kneeL: 1.4, kneeR: 1.35, armLx: -0.45, armRx: -0.45, elbL: -0.5, elbR: -0.5 }, k.sitW);

    // Each kid's idle
    if (d.idleStyle && idleW > 0.01) {
      const w = idleW;
      k.idleT += dt;
      const it = k.idleT;
      if (look.idle === "thoughtful") {
        add(p, { armLx: -0.15, armLz: 0.08, armRx: -0.15, armRz: -0.08, headX: 0.08, headY: Math.sin(it * 0.5) * 0.08 }, w);
      } else if (look.idle === "bounce") {
        add(p, { bob: Math.abs(Math.sin(it * 3.5)) * 0.03 * calm, armLz: 0.15, armRz: -0.15, headX: Math.sin(it * 1.8) * 0.05 }, w);
      } else if (look.idle === "curious") {
        add(p, { armLx: -0.5, elbL: -1.0, armRx: -0.5, elbR: -1.0, headZ: 0.1, headX: -0.08 }, w);
      } else if (look.idle === "confident") {
        add(p, { armLx: 0.2, armRx: 0.2, armLz: -0.05, armRz: 0.05, headX: -0.08, lean: -0.03 }, w);
      }
    }

    // Dynamic ponytail swing for Kid 4
    if (R.current.ponytail) {
      const ponySwing = Math.sin(ph + Math.PI / 2) * k.walkW * 0.35 + Math.sin(t * 2) * 0.08;
      R.current.ponytail.rotation.z = ponySwing;
      R.current.ponytail.rotation.x = -0.15 + (moving ? 0.25 : 0);
    }

    if (d.act) {
      d.actT = (d.actT ?? 0) + dt;
      const a = d.actT;
      const len = d.act === "flex" ? 2.2 : d.act === "lookGloves" ? 2.2 : d.act === "cover" ? 99 : d.act === "hop" ? 0.9 : 1.4;
      const ew = Math.min(1, a / 0.25, (len - a) / 0.25);
      if (d.act === "flex") add(p, { armLx: -1.2, armRx: -1.2, armLz: 0.15, armRz: -0.15, elbL: -1.2 + Math.sin(a * 6) * 0.25, elbR: -1.2 - Math.sin(a * 6) * 0.25, headX: 0.25 }, ew);
      else if (d.act === "lookGloves") add(p, { armLx: -1.0, armRx: -1.0, elbL: -1.5, elbR: -1.5, headX: 0.35 }, ew);
      else if (d.act === "nod") add(p, { headX: Math.sin(a * 7) * 0.18, headZ: 0.06 }, ew);
      else if (d.act === "wave") add(p, { armRz: -2.6, elbR: -0.3 + Math.sin(a * 9) * 0.35 }, ew);
      else if (d.act === "cover") add(p, { armLx: -2.3, armRx: -2.3, armLz: -0.25, armRz: 0.25, elbL: -1.6, elbR: -1.6, headX: 0.2, lean: 0.12 }, ew);
      else if (d.act === "hop") {
        // a small excited hop: a crouch (anticipation), the hop, a soft landing
        const h = Math.max(0, Math.sin(((a - 0.15) / 0.55) * Math.PI));
        add(p, { lift: a > 0.15 && a < 0.7 ? h * 0.12 : 0, bob: a < 0.15 ? -0.03 : 0, kneeL: a < 0.15 ? 0.4 : 0.2, kneeR: a < 0.15 ? 0.4 : 0.2, armLz: 0.5, armRz: -0.5 }, ew);
      }
      if (a >= len) d.act = null;
    }

    const q = k.pose;
    for (const key in q) q[key as keyof Pose] = damp(q[key as keyof Pose], p[key as keyof Pose], key === "spin" ? 60 : 14, dt);
    const o = R.current;
    if (o.body) {
      o.body.position.y = q.bob + q.lift;
      o.body.rotation.x = q.lean;
    }
    o.legL?.rotation.set(q.legL, 0, 0.02);
    o.legR?.rotation.set(q.legR, 0, -0.02);
    o.kneeL?.rotation.set(q.kneeL, 0, 0);
    o.kneeR?.rotation.set(q.kneeR, 0, 0);
    o.armL?.rotation.set(q.armLx, 0, q.armLz);
    o.armR?.rotation.set(q.armRx, 0, q.armRz);
    o.elbL?.rotation.set(q.elbL, 0, 0);
    o.elbR?.rotation.set(q.elbR, 0, 0);
    o.head?.rotation.set(q.headX, q.headY, q.headZ);

    // face: blink every ~3.5 s (seeded, a function of time), expressions, cheeks
    const ex = d.expr ?? "neutral";
    const bt = (t + seed * 1.37) % 3.6;
    const blink = bt < 0.12 ? Math.sin((bt / 0.12) * Math.PI) : 0;
    const eyeWant = ex === "happy" ? 0.28 : ex === "sleepy" ? 0.45 : ex === "surprised" ? 1.18 : ex === "determined" ? 0.8 : 1;
    k.eyeY = damp(k.eyeY, eyeWant, 12, dt);
    k.mouthO = damp(k.mouthO, ex === "surprised" ? 1 : 0, 10, dt);
    k.browUp = damp(k.browUp, ex === "curious" || ex === "surprised" ? 1 : ex === "determined" ? -0.7 : 0, 10, dt);
    k.smile = damp(k.smile, ex === "happy" ? 1 : ex === "sleepy" || ex === "determined" ? 0 : 0.45, 8, dt);
    const eyeScale = Math.max(0.08, k.eyeY * (1 - blink * 0.92));
    const arcs = k.eyeY < 0.4;
    for (const sd of ["L", "R"]) {
      o["eyeOpen" + sd]?.scale.set(1, arcs ? 1 : eyeScale, 1);
      if (o["eyeOpen" + sd]) o["eyeOpen" + sd]!.visible = !arcs;
      if (o["eyeArc" + sd]) o["eyeArc" + sd]!.visible = arcs;
      o["brow" + sd]?.position.setY(0.05 + k.browUp * 0.014);
    }
    if (o.mouth) o.mouth.scale.set(1 + k.smile * 0.6, 1, 1);
    if (o.mouthO) {
      o.mouthO.visible = k.mouthO > 0.1;
      o.mouthO.scale.setScalar(Math.max(0.01, k.mouthO));
    }
    if (ex === "curious" && o.head) o.head.rotation.z += 0.16;
    // secondary motion: hair bounce, dress hem sway (gentle; a function of the walk phase)
    if (o.hairMesh) o.hairMesh.position.y = Math.abs(Math.cos(ph)) * 0.008 * k.walkW;
    if (o.hem) o.hem.rotation.z = Math.sin(ph) * 0.05 * k.walkW + Math.sin(t * 1.3 + seed) * 0.01 * calm;

    // Transformation suit reveal
    const r = rv.current;
    const set = (key: string, sx: number, sy = sx, sz = sx) => {
      const g = o[key];
      if (!g) return;
      const v = Math.max(0.0001, sx);
      g.visible = Math.min(sx, sy, sz) > 0.002;
      g.scale.set(v, Math.max(0.0001, sy), Math.max(0.0001, sz));
    };
    const boots = ease(r.boots),
      gloves = ease(r.gloves),
      pack = ease(r.pack),
      helmet = ease(r.helmet),
      patchK = ease(r.patch);
    for (const sd of ["L", "R"]) {
      set("boot" + sd, 1, boots, 1);
      set("glove" + sd, gloves);
    }
    const part = (h: number) => ease((r.suit * 1.5 - h) / 0.5);
    for (const sd of ["L", "R"]) {
      set("sThigh" + sd, part(0.1));
      set("sShin" + sd, part(0));
      set("sUpper" + sd, part(0.85));
      set("sFore" + sd, part(0.95));
    }
    set("sTorso", 1, part(0.45), 1);
    set("pack", pack);
    set("helmet", helmet);
    set("patch", patchK, 1, 1);
    if (o.visor) o.visor.rotation.x = -1.25 * (1 - ease(r.visor));

    const clothes = r.clothes > 0.5;
    for (const key of ["props", "extra", "ears", "earrings", "freckles"]) if (o[key]) o[key]!.visible = clothes && r.gloves < 0.5;
    if (o.hairMesh) o.hairMesh.visible = r.helmet < 0.5;
    if (o.ponytail) o.ponytail.visible = r.helmet < 0.5;
  });

  const leg = (sd: "L" | "R", side: number) => (
    <group ref={ref("leg" + sd)} position={[side * 0.07, HIP, 0]}>
      <Limb len={THIGH} r0={0.06} r1={0.05} mat={look.extra === "overalls" ? m.thigh : m.skin} />
      <group ref={ref("sThigh" + sd)}>
        <Limb len={THIGH} r0={0.078} r1={0.065} mat={m.suit} />
      </group>
      <group ref={ref("knee" + sd)} position={[0, -THIGH, 0]}>
        <Limb len={SHIN} r0={0.048} r1={0.04} mat={look.extra === "overalls" ? m.thigh : m.skin} />
        <group ref={ref("sShin" + sd)}>
          <Limb len={SHIN} r0={0.065} r1={0.055} mat={m.suit} />
          <mesh position={[0, 0, 0.05]} material={m.acc}>
            <boxGeometry args={[0.075, 0.07, 0.02]} />
          </mesh>
        </group>
        {/* Footwear */}
        <mesh position={[0, -SHIN + 0.01, 0.03]} material={m.shoe} castShadow>
          <boxGeometry args={[0.105, look.extra === "tunic-dress" ? 0.13 : 0.08, 0.2]} />
        </mesh>
        {/* Space boot */}
        <group ref={ref("boot" + sd)} position={[0, -SHIN - 0.03, 0.03]}>
          <mesh position={[0, 0.06, 0]} material={m.graphite} castShadow>
            <boxGeometry args={[0.10, 0.12, 0.21]} />
          </mesh>
        </group>
      </group>
    </group>
  );

  const arm = (sd: "L" | "R", side: number) => (
    <group ref={ref("arm" + sd)} position={[side * SH_X, SH_Y, 0]}>
      <Limb len={UPPER} r0={0.042} r1={0.038} mat={look.extra === "camp-shirt" ? m.torso : look.extra === "overalls" ? m.white : m.upper} />
      <group ref={ref("sUpper" + sd)}>
        <Limb len={UPPER} r0={0.055} r1={0.048} mat={m.suit} />
        <mesh position={[side * 0.01, -0.035, 0]} material={m.acc}>
          <boxGeometry args={[0.085, 0.05, 0.08]} />
        </mesh>
      </group>
      <group ref={ref("elb" + sd)} position={[0, -UPPER, 0]}>
        <Limb len={FORE} r0={0.035} r1={0.03} mat={m.fore} />
        <group ref={ref("sFore" + sd)}>
          <Limb len={FORE} r0={0.048} r1={0.042} mat={m.suit} />
        </group>
        <mesh position={[0, -FORE - 0.035, 0.005]} material={m.skin} castShadow>
          <boxGeometry args={[0.045, 0.075, 0.025]} />
        </mesh>
        <group ref={ref("glove" + sd)} position={[0, -FORE - 0.035, 0.005]}>
          <mesh material={m.suitLight}>
            <boxGeometry args={[0.06, 0.09, 0.045]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} material={m.graphite}>
            <cylinderGeometry args={[0.045, 0.045, 0.025, 8]} />
          </mesh>
        </group>
      </group>
    </group>
  );

  // Big, expressive face & eyes
  const faceDetails = (
    <group position={[0, 0, 0.106]} userData={{ noOutline: true }}>
      {/* soft blush on the cheeks (low opacity) */}
      {[-1, 1].map((sdd) => (
        <mesh key={`b${sdd}`} position={[sdd * 0.078, -0.045, 0.004]} rotation={[0, sdd * 0.45, 0]}>
          <circleGeometry args={[0.024, 16]} />
          <meshBasicMaterial color="#F0A3A0" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
      {/* Eyes: large round eyes set wide and a little low */}
      {[-1, 1].map((sdd) => (
        <group key={sdd} ref={ref(sdd < 0 ? "eyeL" : "eyeR")} position={[sdd * 0.06, -0.006, 0.01]}>
          {/* Eyeball white */}
          <group ref={ref(sdd < 0 ? "eyeOpenL" : "eyeOpenR")}>
          <mesh scale={[0.036, 0.043, 0.02]} material={m.white}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
          {/* Iris */}
          <mesh position={[0, -0.002, 0.015]} scale={[0.025, 0.03, 0.01]} material={m.eye}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
          {/* Pupil */}
          <mesh position={[0, 0, 0.022]} scale={[0.015, 0.02, 0.008]} material={m.dark}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
          {/* White highlight catch-light */}
          <mesh position={[0.008, 0.01, 0.028]} scale={[0.008, 0.01, 0.005]} material={m.white}>
            <sphereGeometry args={[1, 6, 6]} />
          </mesh>
          <mesh position={[-0.009, -0.011, 0.027]} scale={[0.004, 0.004, 0.004]} material={m.white}>
            <sphereGeometry args={[1, 6, 6]} />
          </mesh>
          </group>
          {/* happy: the eye becomes a soft arc */}
          <mesh ref={ref(sdd < 0 ? "eyeArcL" : "eyeArcR")} position={[0, -0.008, 0.022]} visible={false}>
            <torusGeometry args={[0.022, 0.0045, 6, 14, Math.PI]} />
            <meshBasicMaterial color="#3B2A26" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((sdd) => (
        <group key={`br${sdd}`} ref={ref(sdd < 0 ? "browL" : "browR")} position={[sdd * 0.06, 0.05, 0.02]}>
          {/* Eyebrow */}
          <mesh position={[0, 0, 0]} rotation={[0, 0, sdd * -0.08]}>
            <boxGeometry args={[0.035, 0.007, 0.005]} />
            <meshBasicMaterial color={look.hair} />
          </mesh>
        </group>
      ))}

      {/* Nose */}
      <mesh position={[0, -0.03, 0.02]} scale={[0.012, 0.015, 0.012]} material={m.skin}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>

      {/* Mouth (small; widens into a smile) and an "o" for surprise */}
      <mesh ref={ref("mouth")} position={[0, -0.07, 0.015]}>
        <boxGeometry args={[0.026, 0.006, 0.005]} />
        <meshBasicMaterial color="#6a3028" />
      </mesh>
      <mesh ref={ref("mouthO")} position={[0, -0.072, 0.017]} visible={false}>
        <sphereGeometry args={[0.012, 10, 8]} />
        <meshBasicMaterial color="#5a2822" />
      </mesh>

      {/* Freckle dashes for Kid 4 */}
      {look.freckles && (
        <group ref={ref("freckles")}>
          {[-1, 1].map((sdd) => (
            <group key={sdd} position={[sdd * 0.05, -0.03, 0.018]}>
              <mesh position={[-0.006, 0, 0]}>
                <boxGeometry args={[0.007, 0.003, 0.002]} />
                <meshBasicMaterial color="#7a543e" />
              </mesh>
              <mesh position={[0.006, -0.004, 0]}>
                <boxGeometry args={[0.007, 0.003, 0.002]} />
                <meshBasicMaterial color="#7a543e" />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );

  // Ears & Earrings
  const ears = (
    <group ref={ref("ears")}>
      {[-1, 1].map((sdd) => (
        <group key={sdd} position={[sdd * 0.135, 0.01, -0.01]} rotation={[0, sdd * 0.25, 0]}>
          <mesh scale={[0.022, 0.04, 0.03]} material={m.skin}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
          {look.earrings && (
            <mesh position={[sdd * 0.015, -0.025, 0]} scale={[0.008, 0.008, 0.008]} material={m.earring}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );

  // Hair models per Kid
  const hair = (
    <group ref={ref("hairMesh")}>
      {/* Base skull cap */}
      <mesh position={[0, 0.05, -0.02]} scale={[0.138, 0.135, 0.145]} material={m.hair}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
      {look.hairStyle === "curls" && Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.4) * 0.11, 0.13 + (i % 2) * 0.025, Math.sin(i * 2.4) * 0.1]} material={m.hair}>
          <sphereGeometry args={[0.065, 8, 6]} />
        </mesh>
      ))}
      {look.hairStyle === "bun" && <mesh position={[0, 0.2, -0.045]} material={m.hair}><sphereGeometry args={[0.09, 10, 8]} /></mesh>}

      {/* Kid 1 (Image 1): Messy flick, side fringe, cowlick, spiky flick at back */}
      {look.hairStyle === "messy-flick" && (
        <group>
          {/* Side-swept fringe */}
          <mesh position={[0.03, 0.08, 0.1]} rotation={[0.2, 0.3, -0.2]} scale={[0.08, 0.05, 0.06]} material={m.hair}>
            <coneGeometry args={[1, 1.2, 6]} />
          </mesh>
          {/* Cowlick tuft on crown */}
          <mesh position={[-0.02, 0.17, 0.02]} rotation={[-0.3, 0.1, 0.3]} scale={[0.04, 0.08, 0.04]} material={m.hair}>
            <coneGeometry args={[1, 1.5, 5]} />
          </mesh>
          {/* Spiky flick at back */}
          <mesh position={[0.01, 0.11, -0.15]} rotation={[0.6, -0.2, 0]} scale={[0.05, 0.09, 0.04]} material={m.hair}>
            <coneGeometry args={[1, 1.4, 5]} />
          </mesh>
        </group>
      )}

      {/* Kid 2 (Image 2): Thick messy shoulder bob hiding ears */}
      {look.hairStyle === "bob-messy" && (
        <group>
          {/* Puffy side volumes */}
          {[-1, 1].map((sdd) => (
            <mesh key={sdd} position={[sdd * 0.11, -0.01, -0.02]} scale={[0.07, 0.12, 0.09]} material={m.hair}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ))}
          {/* Choppy uneven fringe */}
          <mesh position={[0, 0.088, 0.092]} rotation={[0.15, 0, 0]} scale={[0.12, 0.036, 0.045]} material={m.hair}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
      )}

      {/* Kid 3 (Image 3): Wavy auburn with upward crown flick, side-parted */}
      {look.hairStyle === "wavy-flick" && (
        <group>
          {/* Side part fringe */}
          <mesh position={[-0.04, 0.08, 0.09]} rotation={[0.15, -0.2, 0.2]} scale={[0.09, 0.045, 0.06]} material={m.hair}>
            <coneGeometry args={[1, 1.2, 6]} />
          </mesh>
          {/* Crown flick */}
          <mesh position={[0.03, 0.17, -0.02]} rotation={[-0.2, 0.2, -0.4]} scale={[0.045, 0.09, 0.04]} material={m.hair}>
            <coneGeometry args={[1, 1.5, 5]} />
          </mesh>
        </group>
      )}

      {/* Kid 4 (Image 4): High Ponytail + lime bobbles + blunt bangs */}
      {look.hairStyle === "ponytail" && (
        <group>
          {/* Straight blunt bangs */}
          <mesh position={[0, 0.088, 0.1]} scale={[0.115, 0.034, 0.03]} material={m.hair}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {/* Long side locks framing face */}
          {[-1, 1].map((sdd) => (
            <mesh key={sdd} position={[sdd * 0.122, -0.01, 0.035]} scale={[0.022, 0.08, 0.03]} material={m.hair}>
              <cylinderGeometry args={[1, 0.7, 1, 6]} />
            </mesh>
          ))}
          {/* High Ponytail anchor */}
          <group ref={ref("ponytail")} position={[0, 0.16, -0.1]}>
            {/* Lime bobbles */}
            <mesh position={[-0.022, 0.01, 0]} scale={[0.022, 0.022, 0.022]} material={m.bobble}>
              <sphereGeometry args={[1, 8, 8]} />
            </mesh>
            <mesh position={[0.022, 0.01, 0]} scale={[0.022, 0.022, 0.022]} material={m.bobble}>
              <sphereGeometry args={[1, 8, 8]} />
            </mesh>
            {/* Ponytail stream */}
            <mesh position={[0, -0.14, -0.06]} rotation={[0.3, 0, 0]} scale={[0.045, 0.20, 0.05]} material={m.hair}>
              <coneGeometry args={[1, 1.5, 8]} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );

  return (
    <group ref={root} name={`kid-${id}`}>
      {/* Ground Blob Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial map={blobTexture()} transparent opacity={0.4} depthWrite={false} />
      </mesh>

      <group ref={ref("body")}>
        {leg("L", -1)}
        {leg("R", 1)}

        <group position={[0, TORSO_Y, 0]} scale={[TORSO_W, TORSO_S, TORSO_W]}>
        {/* Torso & everyday clothing */}
        <mesh position={[0, 0.58, 0]} material={look.extra === "overalls" ? m.thigh : m.torso} castShadow>
          <boxGeometry args={[0.22, 0.12, 0.14]} />
        </mesh>
        <mesh position={[0, 0.69, 0]} material={m.torso} castShadow>
          <boxGeometry args={[0.21, 0.14, 0.135]} />
        </mesh>
        <mesh position={[0, 0.81, 0]} material={look.extra === "overalls" ? m.white : m.torso} castShadow>
          <boxGeometry args={[0.25, 0.16, 0.145]} />
        </mesh>

        {/* Specific outfit garments */}
        <group ref={ref("extra")}>
          {/* Kid 1: Camp collar & brown undershirt */}
          {look.extra === "camp-shirt" && (
            <>
              <mesh position={[0, 0.84, 0.075]} material={m.undershirt}>
                <boxGeometry args={[0.09, 0.06, 0.01]} />
              </mesh>
              {/* Boxy untucked shirt skirt */}
              <mesh position={[0, 0.53, 0]} material={m.torso}>
                <boxGeometry args={[0.24, 0.14, 0.16]} />
              </mesh>
            </>
          )}

          {/* Kid 2: Wide A-line trapeze tunic dress */}
          {look.extra === "tunic-dress" && (
            <group ref={ref("hem")} position={[0, 0.7, 0]}>
              <mesh position={[0, -0.15, 0]} material={m.torso}>
                <cylinderGeometry args={[0.13, 0.22, 0.30, 12]} />
              </mesh>
            </group>
          )}

          {/* Kid 3: Overalls bib & straps */}
          {look.extra === "overalls" && (
            <>
              {/* Bib */}
              <mesh position={[0, 0.78, 0.076]} material={m.thigh}>
                <boxGeometry args={[0.15, 0.12, 0.015]} />
              </mesh>
              {/* Front pocket */}
              <mesh position={[0, 0.77, 0.086]} material={m.overallsShadow}>
                <boxGeometry args={[0.08, 0.06, 0.008]} />
              </mesh>
              {/* Straps */}
              {[-1, 1].map((sdd) => (
                <mesh key={sdd} position={[sdd * 0.065, 0.86, 0]} material={m.thigh}>
                  <boxGeometry args={[0.025, 0.02, 0.15]} />
                </mesh>
              ))}
            </>
          )}

          {/* Kid 4: Pale leaf green pinafore dress with pocket & shoulder bows */}
          {look.extra === "pinafore" && (
            <>
              <group ref={ref("hem")} position={[0, 0.71, 0]}>
                <mesh position={[0, -0.13, 0]} material={m.torso}>
                  <cylinderGeometry args={[0.12, 0.19, 0.26, 12]} />
                </mesh>
              </group>
              {/* Rounded front patch pocket on lower right */}
              <mesh position={[0.06, 0.52, 0.115]} material={m.pinaforeShadow}>
                <boxGeometry args={[0.065, 0.06, 0.01]} />
              </mesh>
            </>
          )}
        </group>

        {/* Spacesuit body (grows during transformation) */}
        <group ref={ref("sTorso")} position={[0, 0.55, 0]}>
          <group position={[0, -0.55, 0]}>
            <mesh position={[0, 0.60, 0]} material={m.suit} castShadow>
              <boxGeometry args={[0.24, 0.14, 0.16]} />
            </mesh>
            <mesh position={[0, 0.68, 0]} material={m.graphite}>
              <boxGeometry args={[0.245, 0.03, 0.165]} />
            </mesh>
            <mesh position={[0, 0.74, 0]} material={m.suit} castShadow>
              <boxGeometry args={[0.23, 0.14, 0.155]} />
            </mesh>
            <mesh position={[0, 0.85, 0]} material={m.suit} castShadow>
              <boxGeometry args={[0.28, 0.18, 0.17]} />
            </mesh>
            <mesh position={[0, 0.93, 0]} material={m.acc}>
              <boxGeometry args={[0.285, 0.04, 0.175]} />
            </mesh>
          </group>
        </group>

        {/* Name patch on chest */}
        <group ref={ref("patch")} position={[-0.085, 0.8, 0.104]}>
          <mesh position={[0.085, 0, 0]} renderOrder={3}>
            <planeGeometry args={[0.17, 0.06]} />
            <meshBasicMaterial map={patchTex} transparent toneMapped={false} />
          </mesh>
        </group>

        {/* Life-support backpack */}
        <group ref={ref("pack")} position={[0, 0.82, -0.09]}>
          <mesh position={[0, 0, -0.06]} material={m.suit} castShadow>
            <boxGeometry args={[0.24, 0.32, 0.12]} />
          </mesh>
          <mesh position={[0, 0.16, -0.06]} material={m.graphite}>
            <boxGeometry args={[0.22, 0.03, 0.10]} />
          </mesh>
          <mesh position={[0, -0.04, -0.122]} material={m.acc}>
            <boxGeometry args={[0.14, 0.07, 0.01]} />
          </mesh>
        </group>

        <mesh position={[0, 0.94, 0]} material={m.skin}>
          <cylinderGeometry args={[0.032, 0.036, 0.05, 8]} />
        </mesh>
        </group>

        {arm("L", -1)}
        {arm("R", 1)}

        {/* Head (~0.28m, giving ~4.5 heads tall ratio) */}
        <group ref={ref("head")} position={[0, HEAD_Y, 0]}>
          <group scale={1}>
          {/* a big round head with full cheeks */}
          <mesh scale={[0.13, 0.132, 0.13]} material={m.skin} castShadow>
            <sphereGeometry args={[1, 18, 14]} />
          </mesh>
          {[-1, 1].map((sdd) => (
            <mesh key={`ch${sdd}`} position={[sdd * 0.06, -0.05, 0.07]} scale={[0.06, 0.055, 0.055]} material={m.skin}>
              <sphereGeometry args={[1, 12, 10]} />
            </mesh>
          ))}
          {ears}
          {faceDetails}
          {hair}

          {/* Helmet with gold visor */}
          <group ref={ref("helmet")} scale={appearance?.helmetStyle === 1 ? [1.12, 0.96, 1.05] : appearance?.helmetStyle === 2 ? [0.98, 1.13, 1.06] : 1}>
            <mesh material={m.suitLight} castShadow>
              <sphereGeometry args={[0.17, 18, 12, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0]} />
            </mesh>
            <mesh material={m.suitLight}>
              <sphereGeometry args={[0.17, 18, 6, 0, Math.PI * 2, 0, 0.95]} />
            </mesh>
            <mesh material={m.suitLight}>
              <sphereGeometry args={[0.17, 18, 6, 0, Math.PI * 2, 1.95, Math.PI - 1.95]} />
            </mesh>
            <mesh position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.graphite}>
              <torusGeometry args={[0.11, 0.02, 4, 12]} />
            </mesh>
            <group ref={ref("visor")}>
              <mesh position={[0, -0.005, 0.01]} material={m.visor}>
                <sphereGeometry args={[0.176, 16, 10, Math.PI / 2 - 1.0, 2.0, 0.95, 1.0]} />
              </mesh>
            </group>
          </group>
          </group>
        </group>
      </group>
    </group>
  );
}
