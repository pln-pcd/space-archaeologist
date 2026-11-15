// THE CHIBI EXPLORER (v7): the player's cute astronaut. Big round head, glossy eyes, blush, a chubby
// suit, chunky boots, a backpack and a glass bubble helmet. Built imperatively with plain three.js so
// the same builders render the live model (Chibi.tsx) AND the little part previews in the designer
// (chibiThumbs.ts). Origin at the feet, about 1.15 units tall, facing +z.
import * as THREE from "three";
import { toon } from "../odyssey/look";

export type HairStyle = "messy-flick" | "bob-messy" | "wavy-flick" | "ponytail" | "curls" | "crew" | "bun";
export type ChibiLook = {
  suit: string;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  helmet: number;
  visor: string;
  accessory: number;
  helmetOn: boolean;
};
export type ChibiRig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Object3D[];
  helmet: THREE.Group;
  dispose: () => void;
};

const HEAD_Y = 0.8;
const HEAD_R = 0.26;
const geoCache = new Map<string, THREE.BufferGeometry>();
function g<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let hit = geoCache.get(key) as T | undefined;
  if (!hit) geoCache.set(key, (hit = make()));
  return hit;
}
const sphere = (r: number, w = 28, h = 20) => g(`s${r}/${w}`, () => new THREE.SphereGeometry(r, w, h));
const capsule = (r: number, l: number) => g(`c${r}/${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 16));
const rbox = (w: number, h: number, d: number, r: number) =>
  g(`rb${w}/${h}/${d}/${r}`, () => {
    // a rounded box from a beveled extrusion (no drei needed in plain three.js)
    const s = new THREE.Shape();
    const x = -w / 2 + r,
      y = -h / 2 + r,
      ww = w - 2 * r,
      hh = h - 2 * r;
    s.moveTo(x, y - r + r);
    s.absarc(x, y, r, Math.PI, Math.PI * 1.5, false);
    s.absarc(x + ww, y, r, Math.PI * 1.5, Math.PI * 2, false);
    s.absarc(x + ww, y + hh, r, 0, Math.PI * 0.5, false);
    s.absarc(x, y + hh, r, Math.PI * 0.5, Math.PI, false);
    const bev = Math.min(r, d / 2 - 0.001);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 4, curveSegments: 8 });
    geo.translate(0, 0, -(d - bev * 2) / 2);
    geo.computeVertexNormals();
    return geo;
  });
const torus = (r: number, t: number, arc = Math.PI * 2) => g(`t${r}/${t}/${arc}`, () => new THREE.TorusGeometry(r, t, 12, 36, arc));
const cyl = (a: number, b: number, h: number, n = 20) => g(`cy${a}/${b}/${h}/${n}`, () => new THREE.CylinderGeometry(a, b, h, n));
const cone = (r: number, h: number) => g(`co${r}/${h}`, () => new THREE.ConeGeometry(r, h, 14));
const circle = (r: number) => g(`ci${r}`, () => new THREE.CircleGeometry(r, 24));
const star = () =>
  g("star", () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.022 : 0.05;
      const p = [Math.cos(a) * r, Math.sin(a) * r] as const;
      if (i === 0) s.moveTo(...p);
      else s.lineTo(...p);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    geo.computeVertexNormals();
    return geo;
  });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0], s?: [number, number, number] | number, r?: [number, number, number]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  if (s !== undefined) typeof s === "number" ? m.scale.setScalar(s) : m.scale.set(...s);
  if (r) m.rotation.set(...r);
  return m;
}
const basic = (c: string, opacity = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
const shade = (hex: string, k: number) => "#" + new THREE.Color(hex).multiplyScalar(k).getHexString();

// ---------------------------------------------------------------- parts
/** the head: skin, glossy eyes with highlights, a smile and blush. Returns the group and its eyes */
export function buildHead(skin: string) {
  const head = new THREE.Group();
  const s = toon(skin, { paint: 0.4, grain: 0.1 });
  head.add(mesh(sphere(HEAD_R, 36, 28), s, [0, 0, 0], [1.04, 0.96, 0.98]));
  // ears
  for (const x of [-1, 1]) head.add(mesh(sphere(0.05, 14, 10), s, [x * 0.262, -0.02, 0], [0.6, 1, 1]));
  const eyes: THREE.Object3D[] = [];
  const ink = basic("#221A33");
  const shine = basic("#FFFFFF");
  for (const x of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(x * 0.092, 0.005, 0.228);
    eye.rotation.y = x * 0.32;
    eye.add(mesh(sphere(0.042, 20, 16), ink, [0, 0, 0], [0.86, 1.18, 0.5]));
    eye.add(mesh(sphere(0.014, 10, 8), shine, [0.012, 0.02, 0.018]));
    eye.add(mesh(sphere(0.007, 8, 6), shine, [-0.012, -0.018, 0.019]));
    head.add(eye);
    eyes.push(eye);
    // blush
    const b = mesh(circle(0.036), basic("#FF8FA6", 0.55), [x * 0.158, -0.06, 0.205], [1.3, 0.8, 1], [0, x * 0.62, 0]);
    head.add(b);
  }
  // smile: a little arc
  head.add(mesh(torus(0.032, 0.0075, Math.PI), ink, [0, -0.07, 0.248], 1, [0, 0, Math.PI]));
  return { head, eyes };
}

/** hair on a head of radius HEAD_R (local to the head group) */
export function buildHair(style: HairStyle, color: string) {
  const hair = new THREE.Group();
  const m = toon(color, { paint: 0.8, grain: 0.2 });
  // a cap over the top and back, tilted back so the forehead shows
  const capGeo = g("hcap", () => new THREE.SphereGeometry(HEAD_R + 0.022, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5));
  const cap = mesh(capGeo, m, [0, 0.01, -0.01], [1.06, 1.05, 1.04], [-0.42, 0, 0]);
  hair.add(cap);
  // a soft fringe across the forehead
  const fringe = (n: number, spread: number, y = 0.15) => {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : i / (n - 1) - 0.5;
      hair.add(mesh(sphere(0.075, 14, 10), m, [k * spread, y - Math.abs(k) * 0.05, 0.19 - Math.abs(k) * 0.06], [1.1, 0.7, 0.7], [0.3, k * 0.6, k * -0.5]));
    }
  };
  switch (style) {
    case "messy-flick":
      fringe(3, 0.26);
      [[0, 0.27, 0.05, -0.4], [0.09, 0.25, -0.02, 0.5], [-0.1, 0.25, -0.03, -0.6], [0.02, 0.22, -0.14, 0]].forEach(([x, y, z, rz]) =>
        hair.add(mesh(cone(0.06, 0.16), m, [x, y, z], 1, [0.4, 0, rz])),
      );
      break;
    case "bob-messy":
      fringe(4, 0.32, 0.14);
      for (const x of [-1, 1]) hair.add(mesh(sphere(0.12, 16, 12), m, [x * 0.215, -0.07, -0.04], [0.7, 1.25, 1]));
      hair.add(mesh(sphere(0.2, 20, 14), m, [0, -0.02, -0.12], [1.3, 1.1, 0.8]));
      break;
    case "wavy-flick":
      fringe(3, 0.3, 0.16);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 0.62 + (i / 6) * Math.PI * 0.76;
        hair.add(mesh(sphere(0.08, 14, 10), m, [Math.cos(a) * 0.25, -0.1 - (i % 2) * 0.04, Math.sin(-a) * 0.2 - 0.08]));
      }
      break;
    case "ponytail":
      fringe(3, 0.28);
      hair.add(mesh(sphere(0.05, 12, 8), toon("#FF6F91"), [0, 0.12, -0.28]));
      hair.add(mesh(sphere(0.1, 16, 12), m, [0, 0.02, -0.36], [0.85, 1.3, 0.85], [0.5, 0, 0]));
      break;
    case "curls":
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const ring = i % 2;
        hair.add(mesh(sphere(0.075, 12, 10), m, [Math.cos(a) * (0.2 - ring * 0.08), 0.17 + ring * 0.07, Math.sin(a) * (0.18 - ring * 0.07) - 0.03]));
      }
      fringe(4, 0.3, 0.16);
      break;
    case "crew":
      cap.scale.set(1.0, 0.98, 1.0);
      hair.add(mesh(sphere(0.06, 12, 8), m, [0.05, 0.25, 0.12], [1.4, 0.5, 0.8], [0.3, 0, -0.3]));
      break;
    case "bun":
      fringe(3, 0.28);
      hair.add(mesh(sphere(0.1, 18, 14), m, [0, 0.29, -0.06]));
      break;
  }
  return hair;
}

/** the glass helmet: 0 bubble, 1 wide (ear pods), 2 tall (antenna); `visor` tints the front glass */
export function buildHelmet(style: number, visor: string, accent: string) {
  const h = new THREE.Group();
  const glassMat = new THREE.MeshPhongMaterial({ color: "#EAF6FF", transparent: true, opacity: 0.16, shininess: 120, specular: new THREE.Color("#FFFFFF"), depthWrite: false, side: THREE.FrontSide });
  const visorMat = new THREE.MeshPhongMaterial({ color: visor, transparent: true, opacity: 0.32, shininess: 140, specular: new THREE.Color("#FFFFFF"), depthWrite: false });
  const scale: [number, number, number] = style === 1 ? [1.12, 0.96, 1.04] : style === 2 ? [0.98, 1.12, 0.98] : [1, 1, 1];
  const shell = mesh(sphere(0.37, 40, 30), glassMat, [0, 0.03, 0], scale);
  shell.renderOrder = 5;
  h.add(shell);
  // front visor: a tinted dome slice
  const vGeo = g("visor", () => new THREE.SphereGeometry(0.375, 36, 22, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.2, Math.PI * 0.45));
  // the slice is centred on -x by default: rotate it to face +z
  const v = mesh(vGeo, visorMat, [0, 0.03, 0], scale, [0, Math.PI / 2, 0]);
  v.renderOrder = 6;
  h.add(v);
  // a white highlight streak
  const hl = mesh(g("hl", () => new THREE.SphereGeometry(0.378, 16, 8, Math.PI * 0.15, Math.PI * 0.12, Math.PI * 0.18, Math.PI * 0.22)), basic("#FFFFFF", 0.55), [0, 0.03, 0], scale, [0, Math.PI / 2, 0]);
  hl.renderOrder = 7;
  h.add(hl);
  // the neck ring
  const ringMat = toon("#F4F1FA", { paint: 0.3 });
  h.add(mesh(torus(0.2, 0.05), ringMat, [0, -0.28, 0], [1, 1, 0.9], [Math.PI / 2, 0, 0]));
  h.add(mesh(torus(0.2, 0.022), toon(accent), [0, -0.245, 0], [1.02, 1.02, 0.92], [Math.PI / 2, 0, 0]));
  if (style === 1)
    for (const x of [-1, 1]) {
      h.add(mesh(cyl(0.075, 0.075, 0.07, 20), toon(accent), [x * 0.41, 0.0, 0], 1, [0, 0, Math.PI / 2]));
      h.add(mesh(cyl(0.045, 0.045, 0.08, 16), toon("#F4F1FA"), [x * 0.44, 0.0, 0], 1, [0, 0, Math.PI / 2]));
    }
  if (style === 2) {
    h.add(mesh(cyl(0.012, 0.012, 0.14, 8), toon("#B9B2C4"), [0.12, 0.48, 0], 1, [0, 0, -0.25]));
    h.add(mesh(sphere(0.035, 14, 10), toon("#FFD23F", { emissive: "#FFB300", glow: 0.6 }), [0.14, 0.555, 0]));
  }
  return h;
}

/** the torso, arms and legs in the suit colour (returns pivots for animation) */
export function buildSuit(suit: string) {
  const main = toon(suit, { paint: 0.7, grain: 0.3, grainScale: 6 });
  const white = toon("#F6F3FB", { paint: 0.5, grain: 0.3, grainScale: 6 });
  const dark = toon(shade(suit, 0.72), { paint: 0.5 });
  const body = new THREE.Group();
  // chubby torso
  body.add(mesh(sphere(0.2, 32, 24), main, [0, 0.4, 0], [1.0, 1.1, 0.88]));
  // chest panel with three buttons
  body.add(mesh(rbox(0.15, 0.1, 0.04, 0.02), white, [0, 0.43, 0.16], 1, [-0.12, 0, 0]));
  ["#FF6B6B", "#FFD23F", "#5BB8FF"].forEach((c, i) => body.add(mesh(sphere(0.014, 10, 8), toon(c), [-0.04 + i * 0.04, 0.43, 0.185])));
  // belt
  body.add(mesh(torus(0.178, 0.024), dark, [0, 0.29, 0], [1, 1, 0.88], [Math.PI / 2, 0, 0]));
  body.add(mesh(rbox(0.07, 0.05, 0.03, 0.012), toon("#FFD23F"), [0, 0.29, 0.165]));
  // backpack + two little tanks
  body.add(mesh(rbox(0.26, 0.28, 0.12, 0.04), white, [0, 0.43, -0.19]));
  body.add(mesh(rbox(0.2, 0.05, 0.02, 0.01), main, [0, 0.47, -0.255]));
  for (const x of [-1, 1]) body.add(mesh(capsule(0.032, 0.06), toon("#B9B2C4"), [x * 0.07, 0.56, -0.24]));
  // arms (pivot at the shoulder)
  const arm = (x: number) => {
    const a = new THREE.Group();
    a.position.set(x * 0.19, 0.5, 0);
    a.add(mesh(capsule(0.056, 0.11), main, [x * 0.02, -0.09, 0], 1, [0, 0, x * 0.18]));
    a.add(mesh(torus(0.05, 0.016), dark, [x * 0.04, -0.16, 0], 1, [Math.PI / 2, 0, 0]));
    a.add(mesh(sphere(0.064, 18, 14), white, [x * 0.045, -0.21, 0.01]));
    a.rotation.z = x * 0.18;
    return a;
  };
  // legs (pivot at the hip)
  const leg = (x: number) => {
    const l = new THREE.Group();
    l.position.set(x * 0.085, 0.24, 0);
    l.add(mesh(capsule(0.066, 0.07), main, [0, -0.08, 0]));
    l.add(mesh(rbox(0.13, 0.1, 0.19, 0.04), white, [0, -0.19, 0.025]));
    l.add(mesh(rbox(0.135, 0.03, 0.195, 0.012), dark, [0, -0.235, 0.025]));
    return l;
  };
  const armL = arm(-1),
    armR = arm(1),
    legL = leg(-1),
    legR = leg(1);
  body.add(armL, armR, legL, legR);
  return { body, armL, armR, legL, legR };
}

/** accessory i (see ACCESSORIES in missions/avatar.ts); `where` = the body or the head group */
export function buildAccessory(i: number, accent: string) {
  const body = new THREE.Group();
  const head = new THREE.Group();
  const hand = new THREE.Group();
  switch (i) {
    case 0: // star patch
      body.add(mesh(star(), toon("#FFD23F", { emissive: "#FFB300", glow: 0.15 }), [-0.095, 0.48, 0.155], 1, [-0.1, -0.35, 0]));
      break;
    case 1: {
      // scarf
      const m = toon("#FF8A6B", { paint: 0.8, grain: 0.5, grainScale: 8 });
      body.add(mesh(torus(0.15, 0.045), m, [0, 0.555, 0.01], [1, 1, 0.9], [Math.PI / 2 - 0.15, 0, 0]));
      body.add(mesh(rbox(0.07, 0.17, 0.035, 0.015), m, [0.08, 0.47, 0.17], 1, [-0.2, 0, 0.18]));
      break;
    }
    case 2: // badge
      body.add(mesh(cyl(0.04, 0.04, 0.015, 24), toon("#FFC93C"), [0.09, 0.47, 0.165], 1, [Math.PI / 2 - 0.12, 0, 0]));
      body.add(mesh(star(), toon("#FFFFFF"), [0.09, 0.47, 0.175], 0.45, [-0.12, 0, 0]));
      break;
    case 3: // tool pouch
      body.add(mesh(rbox(0.09, 0.09, 0.07, 0.02), toon("#B57A4E", { paint: 1 }), [0.17, 0.27, 0.06], 1, [0, 0.6, 0]));
      body.add(mesh(rbox(0.095, 0.03, 0.075, 0.01), toon("#8F5C38"), [0.17, 0.31, 0.06], 1, [0, 0.6, 0]));
      break;
    case 4: // notebook in the right hand
      hand.add(mesh(rbox(0.1, 0.13, 0.025, 0.01), toon("#4FB39E", { paint: 0.8 }), [0.05, -0.24, 0.07], 1, [0.3, -0.4, 0]));
      hand.add(mesh(rbox(0.09, 0.115, 0.02, 0.006), toon("#FFFFFF"), [0.052, -0.24, 0.072], 1, [0.3, -0.4, 0]));
      break;
    case 5: // bow on the head
      for (const x of [-1, 1]) head.add(mesh(sphere(0.06, 14, 10), toon("#FF6F91"), [0.12 + x * 0.06, 0.24, 0.05], [1.1, 0.7, 0.5], [0, 0, x * 0.4]));
      head.add(mesh(sphere(0.03, 10, 8), toon("#FF4F7B"), [0.12, 0.24, 0.07]));
      break;
    case 6: // headphones
      head.add(mesh(torus(0.29, 0.022, Math.PI), toon(accent), [0, 0.0, -0.02], 1, [0, 0, 0]));
      for (const x of [-1, 1]) head.add(mesh(cyl(0.075, 0.075, 0.06, 20), toon(shade(accent, 0.8)), [x * 0.28, -0.02, 0], 1, [0, 0, Math.PI / 2]));
      break;
  }
  return { body, head, hand };
}

// ---------------------------------------------------------------- the whole explorer
export function buildChibi(look: ChibiLook): ChibiRig {
  const root = new THREE.Group();
  const { body, armL, armR, legL, legR } = buildSuit(look.suit);
  root.add(body);
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  const built = buildHead(look.skin);
  head.add(built.head);
  head.add(buildHair(look.hair, look.hairColor));
  const acc = buildAccessory(look.accessory, look.suit);
  body.add(acc.body);
  head.add(acc.head);
  armR.add(acc.hand);
  const helmet = buildHelmet(look.helmet, look.visor, look.suit);
  helmet.visible = look.helmetOn;
  head.add(helmet);
  body.add(head);
  const owned: THREE.Material[] = [];
  helmet.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && (m as THREE.MeshPhongMaterial).isMeshPhongMaterial) owned.push(m);
  });
  return { root, body, head, armL, armR, legL, legR, eyes: built.eyes, helmet, dispose: () => owned.forEach((m) => m.dispose()) };
}

export type ChibiPose = { walk: number; t: number; wave?: number; hop?: number; cheer?: number; blink?: number; lookX?: number };
/** pose the rig for this frame (pure: everything from the inputs) */
export function poseChibi(r: ChibiRig, p: ChibiPose) {
  const w = Math.min(1, p.walk);
  const ph = p.t * 9;
  const sw = Math.sin(ph) * w;
  r.legL.rotation.x = sw * 0.7;
  r.legR.rotation.x = -sw * 0.7;
  r.armL.rotation.x = -sw * 0.6;
  r.armR.rotation.x = sw * 0.6;
  const idle = Math.sin(p.t * 2.2);
  r.body.position.y = Math.abs(Math.sin(ph)) * 0.045 * w + idle * 0.006 * (1 - w) + (p.hop ?? 0) * 0.25;
  r.body.rotation.x = w * 0.1;
  r.body.rotation.z = Math.sin(ph) * 0.04 * w;
  r.head.rotation.z = idle * 0.035 * (1 - w) + Math.sin(ph) * 0.03 * w;
  r.head.rotation.y = (p.lookX ?? 0) * 0.4;
  r.head.rotation.x = -w * 0.08;
  // waving: the right arm goes up and swings
  const wave = p.wave ?? 0;
  const cheer = p.cheer ?? 0;
  r.armR.rotation.z = 0.18 + wave * (2.5 + Math.sin(p.t * 14) * 0.3) + cheer * 2.6;
  r.armL.rotation.z = -0.18 - cheer * 2.6;
  if (wave || cheer) r.armR.rotation.x *= 1 - Math.max(wave, cheer);
  // blink
  const b = p.blink ?? 1;
  r.eyes.forEach((e) => (e.scale.y = b));
}
