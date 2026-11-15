// Real solar-system bodies for the cover (v4.6 §1): stylized but recognizable, with accurate colours.
// Every texture is painted procedurally once (seeded, no downloads, no NASA imagery needed):
//   Moon    grey highlands + dark maria, craters with bright rims, a rayed crater; height → normal map
//   Mars    rusty red-orange, dark Syrtis-style markings, lighter ochre plains, white polar caps
//   Jupiter cream / tan / brown bands with wavy edges and the Great Red Spot in the south
//   Saturn  butterscotch with soft bands; pale rings (C, B, A) with the Cassini gap at the real ratios
//   Earth   blue oceans, green / tan continents, white cloud swirls on their own shell
//   Uranus  pale cyan, Neptune deep blue with a dark spot and bright streaks
// Toon ramp shading (after-p2), 2.25 px warm-dark outlines (interactable weight), a soft warm rim light.
// All motion is a pure function of the clock (HyperFrames-safe).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useOutlines } from "../../fx/outline";
import { motion } from "../../anim/kit";
import { toonUnique } from "../look";

export type BodyKind = "moon" | "mars" | "jupiter" | "saturn" | "earth" | "uranus" | "neptune";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const W = 1024;
const H = 512;
function canvas(w = W, h = H) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}
function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** a blob painted on the sphere map (wraps around the seam) */
function blob(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rot: number, fill: string | CanvasGradient) {
  x.fillStyle = fill;
  for (const off of [-W, 0, W]) {
    x.beginPath();
    x.ellipse(cx + off, cy, rx, ry, rot, 0, Math.PI * 2);
    x.fill();
  }
}

/** a lumpy organic patch built from overlapping blobs */
function patch(x: CanvasRenderingContext2D, r: () => number, cx: number, cy: number, size: number, n: number, fill: string) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * size * 0.6;
    blob(x, cx + Math.cos(a) * d * 1.6, cy + Math.sin(a) * d * 0.7, size * (0.35 + r() * 0.5), size * (0.22 + r() * 0.3), r() * 3, fill);
  }
}

/** lon/lat (degrees) → map pixels */
const ll = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
function poly(x: CanvasRenderingContext2D, pts: [number, number][], fill: string) {
  x.fillStyle = fill;
  x.beginPath();
  pts.forEach(([lo, la], i) => {
    const [px, py] = ll(lo, la);
    if (i) x.lineTo(px, py);
    else x.moveTo(px, py);
  });
  x.closePath();
  x.fill();
}

// ---------- the Moon: albedo + height (→ normal map) ----------
function moonMaps() {
  const [c, x] = canvas();
  const [hc, h] = canvas();
  const r = rng(1969);
  x.fillStyle = "#BEBBB6";
  x.fillRect(0, 0, W, H);
  h.fillStyle = "rgb(128,128,128)";
  h.fillRect(0, 0, W, H);
  // highland mottling
  for (let i = 0; i < 260; i++) {
    const v = 150 + Math.floor(r() * 60);
    blob(x, r() * W, r() * H, 8 + r() * 40, 6 + r() * 26, r() * 3, `rgba(${v},${v - 2},${v - 5},0.18)`);
  }
  // maria: big smooth dark seas (on the near side, roughly where Imbrium, Serenitatis,
  // Tranquillitatis, Crisium, Procellarum sit)
  const maria: [number, number, number][] = [
    [-15, 33, 70], [17, 27, 42], [30, 8, 46], [58, 16, 26], [-50, 15, 90], [-20, -20, 50], [35, -10, 30], [-5, 5, 26],
  ];
  for (const [lo, la, s] of maria) {
    const [px, py] = ll(lo, la);
    patch(x, r, px, py, s, 7, "rgba(118,116,116,0.42)");
    patch(h, r, px, py, s, 5, "rgba(100,100,100,0.35)");
  }
  // craters lit from the upper left: a bright outer rim on the lit side, a dark crescent inside the
  // upper-left wall, a lighter floor toward the lower right (height: bowl + raised rim)
  const crater = (cx: number, cy: number, rad: number, deep = 1) => {
    for (const off of [-W, 0, W]) {
      const X = cx + off;
      x.save();
      x.beginPath();
      x.arc(X, cy, rad, 0, Math.PI * 2);
      x.clip();
      x.fillStyle = `rgba(96,94,98,${0.5 * deep})`;
      x.fillRect(X - rad, cy - rad, rad * 2, rad * 2);
      x.fillStyle = `rgba(200,197,192,${0.75 * deep})`;
      x.beginPath();
      x.arc(X + rad * 0.24, cy + rad * 0.24, rad * 0.9, 0, Math.PI * 2);
      x.fill();
      x.restore();
      x.strokeStyle = `rgba(242,240,234,${0.55 * deep})`;
      x.lineWidth = Math.max(1, rad * 0.12);
      x.beginPath();
      x.arc(X, cy, rad * 1.02, Math.PI * 0.95, Math.PI * 1.6);
      x.stroke();
      const hg = h.createRadialGradient(X, cy, 0, X, cy, rad * 1.25);
      hg.addColorStop(0, `rgba(50,50,50,${0.6 * deep})`);
      hg.addColorStop(0.7, `rgba(90,90,90,${0.3 * deep})`);
      hg.addColorStop(0.82, `rgba(225,225,225,${0.7 * deep})`);
      hg.addColorStop(1, "rgba(128,128,128,0)");
      h.fillStyle = hg;
      h.beginPath();
      h.arc(X, cy, rad * 1.25, 0, Math.PI * 2);
      h.fill();
    }
  };
  for (let i = 0; i < 230; i++) crater(r() * W, 30 + r() * (H - 60), 2 + Math.pow(r(), 3.2) * 24, 0.5 + r() * 0.5);
  // a young rayed crater in the south (Tycho-like)
  const [tx, ty] = ll(-11, -43);
  x.strokeStyle = "rgba(245,243,238,0.13)";
  x.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    const len = 60 + r() * 140;
    x.lineWidth = 1.5 + r() * 2;
    x.beginPath();
    x.moveTo(tx, ty);
    x.lineTo(tx + Math.cos(a) * len * 1.4, ty + Math.sin(a) * len * 0.7);
    x.stroke();
  }
  crater(tx, ty, 9, 1);
  return { map: tex(c), normal: normalFromHeight(hc, 3.2) };
}

/** Sobel the height canvas into a tangent-space normal map */
function normalFromHeight(hc: HTMLCanvasElement, strength: number) {
  const w = hc.width;
  const hh = hc.height;
  const src = hc.getContext("2d")!.getImageData(0, 0, w, hh).data;
  const [nc, nx] = canvas(w, hh);
  const out = nx.createImageData(w, hh);
  const at = (i: number, j: number) => src[(((j + hh) % hh) * w + ((i + w) % w)) * 4] / 255;
  for (let j = 0; j < hh; j++)
    for (let i = 0; i < w; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) * strength;
      const dy = (at(i, j + 1) - at(i, j - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const k = (j * w + i) * 4;
      out.data[k] = ((-dx / l) * 0.5 + 0.5) * 255;
      out.data[k + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      out.data[k + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out.data[k + 3] = 255;
    }
  nx.putImageData(out, 0, 0);
  return tex(nc, false);
}

// ---------- Mars ----------
function marsMap() {
  const [c, x] = canvas();
  const r = rng(2004);
  x.fillStyle = "#C2643C";
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) blob(x, r() * W, 60 + r() * (H - 120), 8 + r() * 40, 5 + r() * 18, r() * 3, `rgba(${170 + r() * 50},${80 + r() * 40},${50 + r() * 30},0.14)`);
  // bright ochre plains (Arabia / Tharsis-like)
  for (const [lo, la, s] of [[20, 20, 70], [-110, 10, 80], [-60, -40, 60]] as [number, number, number][]) {
    const [px, py] = ll(lo, la);
    patch(x, r, px, py, s, 6, "rgba(222,146,98,0.2)");
  }
  // dark markings: Syrtis Major, Mare Acidalium, the long southern dark belt
  const dark = "rgba(88,40,26,0.62)";
  poly(x, [[60, 20], [75, 15], [78, 0], [70, -10], [62, -5], [58, 8]], dark);
  patch(x, r, ...ll(68, 8), 30, 6, dark);
  patch(x, r, ...ll(-30, 45), 34, 6, "rgba(96,46,30,0.45)");
  for (let lo = -170; lo < 180; lo += 30) patch(x, r, ...ll(lo + r() * 10, -18 - r() * 10), 40, 5, "rgba(110,52,34,0.2)");
  // Valles Marineris-ish scar
  x.strokeStyle = "rgba(90,40,26,0.5)";
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(...ll(-110, -8));
  x.bezierCurveTo(...ll(-90, -12), ...ll(-70, -6), ...ll(-45, -12));
  x.stroke();
  // polar caps (north bigger)
  const cap = (top: boolean, depth: number) => {
    const g = x.createLinearGradient(0, top ? 0 : H, 0, top ? depth : H - depth);
    g.addColorStop(0, "#FBF7F2");
    g.addColorStop(0.75, "#F2E8DE");
    g.addColorStop(1, "rgba(242,232,222,0)");
    x.fillStyle = g;
    x.fillRect(0, top ? 0 : H - depth, W, depth);
  };
  cap(true, 72);
  cap(false, 44);
  return tex(c);
}

// ---------- Jupiter ----------
function jupiterMap() {
  const [c, x] = canvas();
  const r = rng(1610);
  const bands = ["#E9DDC7", "#D7B993", "#EFE4D0", "#B98A62", "#E6D3B4", "#C49A70", "#F1E7D6", "#A87650", "#E2CDAC", "#CDA77E", "#EDE1CB", "#B88E66", "#E8DAC0"];
  const bh = H / bands.length;
  bands.forEach((col, i) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, i * bh);
    for (let px = 0; px <= W; px += 16) x.lineTo(px, i * bh + Math.sin(px / 60 + i * 1.7) * 3 + Math.sin(px / 23 + i) * 1.5);
    x.lineTo(W, (i + 1) * bh + 4);
    x.lineTo(0, (i + 1) * bh + 4);
    x.closePath();
    x.fill();
  });
  // swirls along belt edges
  for (let i = 0; i < 140; i++) {
    const y = Math.floor(r() * bands.length) * bh + (r() - 0.5) * 6;
    blob(x, r() * W, y, 8 + r() * 26, 2 + r() * 4, (r() - 0.5) * 0.3, `rgba(${r() > 0.5 ? "255,250,240" : "120,80,50"},0.25)`);
  }
  // the Great Red Spot (~22° S), with its pale collar
  const [gx, gy] = ll(40, -22);
  blob(x, gx, gy, 62, 30, 0, "#EADBC2");
  const g = x.createRadialGradient(gx, gy, 4, gx, gy, 52);
  g.addColorStop(0, "#C4553A");
  g.addColorStop(0.6, "#B8573D");
  g.addColorStop(1, "#C77856");
  blob(x, gx, gy, 52, 24, 0, g);
  x.strokeStyle = "rgba(140,60,40,0.45)";
  x.lineWidth = 2;
  x.beginPath();
  x.ellipse(gx, gy, 36, 15, 0, 0, Math.PI * 2);
  x.stroke();
  return tex(c);
}

// ---------- Saturn ----------
function saturnMap() {
  const [c, x] = canvas();
  const bands = ["#EBD3A0", "#E3C58F", "#D9B57A", "#E9CF98", "#E3C58F", "#F0DCAE", "#DDBC82", "#E3C58F", "#D2AB70", "#E8CD96", "#CDA66B"];
  const bh = H / bands.length;
  bands.forEach((col, i) => {
    const g = x.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
    g.addColorStop(0, col);
    g.addColorStop(1, bands[(i + 1) % bands.length]);
    x.fillStyle = g;
    x.fillRect(0, i * bh, W, bh + 1);
  });
  // a soft pale hex-ish polar region
  x.fillStyle = "rgba(200,170,120,0.35)";
  x.fillRect(0, 0, W, 22);
  return tex(c);
}
/** the ring texture runs along the radius (u = inner → outer edge) */
function saturnRingMap() {
  const [c, x] = canvas(1024, 4);
  // radii in Saturn radii: C ring 1.24–1.53, B ring 1.53–1.95, Cassini gap 1.95–2.03, A ring 2.03–2.27
  const IN = 1.24;
  const OUT = 2.27;
  const u = (rr: number) => ((rr - IN) / (OUT - IN)) * 1024;
  const r = rng(1655);
  const seg = (a: number, b: number, col: string, alpha: number) => {
    for (let px = u(a); px < u(b); px++) {
      x.fillStyle = col.replace("A", String(Math.max(0, Math.min(1, alpha * (0.82 + r() * 0.28)))));
      x.fillRect(px, 0, 1, 4);
    }
  };
  seg(1.24, 1.53, "rgba(196,180,152,A)", 0.35);
  seg(1.53, 1.95, "rgba(238,226,198,A)", 0.95);
  seg(1.95, 2.03, "rgba(0,0,0,A)", 0); // Cassini Division
  seg(2.03, 2.27, "rgba(222,206,172,A)", 0.8);
  seg(2.21, 2.225, "rgba(0,0,0,A)", 0); // Encke gap
  const t = tex(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return { map: t, inner: IN, outer: OUT };
}

// ---------- Earth ----------
function earthMaps() {
  const [c, x] = canvas();
  const r = rng(1972);
  const sea = x.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, "#3A73B8");
  sea.addColorStop(0.5, "#2F68B0");
  sea.addColorStop(1, "#3A73B8");
  x.fillStyle = sea;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) blob(x, r() * W, r() * H, 20 + r() * 60, 10 + r() * 20, r() * 3, "rgba(70,140,205,0.18)");
  const green = "#5E9A55";
  const tan = "#C8B37E";
  // coarse continents (lon, lat)
  poly(x, [[-168, 66], [-140, 70], [-95, 72], [-80, 62], [-60, 52], [-66, 44], [-76, 35], [-81, 25], [-97, 26], [-105, 20], [-87, 15], [-78, 8], [-83, 10], [-105, 22], [-117, 32], [-124, 42], [-125, 50], [-140, 60], [-160, 58]], green);
  poly(x, [[-55, 82], [-30, 83], [-20, 75], [-40, 62], [-52, 66], [-60, 76]], "#E8EEF0");
  poly(x, [[-80, 10], [-62, 11], [-50, 0], [-35, -7], [-40, -22], [-52, -33], [-65, -47], [-72, -52], [-75, -40], [-71, -18], [-81, -5]], green);
  poly(x, [[-17, 15], [-10, 30], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [35, -25], [20, -35], [12, -17], [9, 4], [-8, 5], [-17, 13]], tan);
  poly(x, [[-10, 36], [-9, 44], [0, 50], [10, 55], [20, 60], [30, 70], [60, 70], [100, 77], [140, 72], [180, 68], [160, 60], [140, 52], [130, 42], [122, 30], [110, 20], [105, 10], [98, 16], [92, 22], [80, 10], [72, 20], [57, 25], [48, 30], [36, 36], [27, 40], [15, 40], [5, 43]], green);
  poly(x, [[45, 30], [60, 25], [72, 30], [80, 40], [62, 45], [50, 40]], tan);
  poly(x, [[114, -22], [122, -18], [136, -12], [145, -15], [153, -27], [146, -39], [135, -35], [116, -34]], tan);
  poly(x, [[-180, -70], [-90, -72], [0, -70], [90, -67], [180, -70], [180, -90], [-180, -90]], "#EEF3F5");
  // painted variation on land
  for (let i = 0; i < 80; i++) blob(x, r() * W, H * 0.2 + r() * H * 0.6, 6 + r() * 20, 4 + r() * 10, r() * 3, "rgba(70,120,60,0.18)");
  // clouds on their own transparent shell
  const [cc, cx] = canvas();
  cx.clearRect(0, 0, W, H);
  cx.strokeStyle = "rgba(255,255,255,0.85)";
  cx.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const y0 = 40 + r() * (H - 80);
    const x0 = r() * W;
    cx.lineWidth = 4 + r() * 9;
    cx.beginPath();
    const curl = (r() - 0.5) * 2;
    cx.moveTo(x0, y0);
    for (let k = 1; k < 6; k++) cx.lineTo(x0 + k * (14 + r() * 10), y0 + Math.sin(k * 0.9 + curl) * 10 * curl);
    cx.stroke();
  }
  // two swirling storms
  for (const [sx, sy] of [ll(-150, 25), ll(70, -40)]) {
    cx.lineWidth = 6;
    cx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) cx.lineTo(sx + Math.cos(a) * a * 4.5, sy + Math.sin(a) * a * 2.6);
    cx.stroke();
  }
  return { map: tex(c), clouds: tex(cc) };
}

function iceMap(base: string, band: string, seed: number, spot = false) {
  const [c, x] = canvas(512, 256);
  const r = rng(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 9; i++) {
    x.fillStyle = band;
    x.globalAlpha = 0.25 + r() * 0.25;
    x.fillRect(0, 20 + i * 26 + r() * 8, 512, 6 + r() * 8);
  }
  x.globalAlpha = 1;
  if (spot) {
    x.fillStyle = "rgba(28,40,110,0.75)";
    x.beginPath();
    x.ellipse(180, 150, 30, 15, 0, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "rgba(240,248,255,0.9)";
    x.lineCap = "round";
    for (const [a, b, w] of [[150, 120, 60], [300, 100, 80], [330, 180, 40]]) {
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(a, b);
      x.lineTo(a + w, b - 3);
      x.stroke();
    }
  }
  return tex(c);
}

// ---------- materials (made once per kind) ----------
type Mats = { body: THREE.Material; clouds?: THREE.Material; ring?: { mat: THREE.Material; inner: number; outer: number } };
const matCache = new Map<BodyKind, Mats>();
function materials(kind: BodyKind): Mats {
  const hit = matCache.get(kind);
  if (hit) return hit;
  let m: Mats;
  if (kind === "moon") {
    const { map, normal } = moonMaps();
    const body = toonUnique("#FFFFFF", { map, paint: 0.35, grain: 0.7, grainScale: 3 });
    body.normalMap = normal;
    body.normalScale = new THREE.Vector2(1.1, 1.1);
    m = { body };
  } else if (kind === "mars") m = { body: toonUnique("#FFFFFF", { map: marsMap(), paint: 0.4, grain: 0.5, grainScale: 2.5 }) };
  else if (kind === "jupiter") m = { body: toonUnique("#FFFFFF", { map: jupiterMap(), paint: 0.25, grain: 0.15 }) };
  else if (kind === "saturn") {
    const ring = saturnRingMap();
    m = {
      body: toonUnique("#FFFFFF", { map: saturnMap(), paint: 0.25, grain: 0.15 }),
      ring: { mat: new THREE.MeshBasicMaterial({ map: ring.map, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: "#FFF4DE" }), inner: ring.inner, outer: ring.outer },
    };
  } else if (kind === "earth") {
    const e = earthMaps();
    m = { body: toonUnique("#FFFFFF", { map: e.map, paint: 0.2, grain: 0.1 }), clouds: new THREE.MeshLambertMaterial({ map: e.clouds, transparent: true, depthWrite: false }) };
  } else if (kind === "uranus") m = { body: toonUnique("#FFFFFF", { map: iceMap("#A9DDE2", "#C6ECEF", 1781), paint: 0.2, grain: 0.1 }) };
  else m = { body: toonUnique("#FFFFFF", { map: iceMap("#3F64C8", "#5C83DC", 1846, true), paint: 0.2, grain: 0.1 }) };
  matCache.set(kind, m);
  return m;
}

/** soft warm rim light around a body (Fresnel shell, additive, no outline) */
const rimMat = (color: string, power: number, strength: number) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPower; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower); gl_FragColor = vec4(uColor * f * uStrength, 1.0); }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

/** a ring geometry whose u runs from the inner to the outer edge */
function radialRing(inner: number, outer: number) {
  const g = new THREE.RingGeometry(inner, outer, 128, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  return g;
}

const RIM: Record<BodyKind, [string, number]> = {
  moon: ["#FFE9C8", 0.55],
  mars: ["#FFC9A0", 0.45],
  jupiter: ["#FFF0D8", 0.4],
  saturn: ["#FFEBC8", 0.4],
  earth: ["#A9D4FF", 0.75],
  uranus: ["#D8FBFF", 0.45],
  neptune: ["#9DB8FF", 0.5],
};

/** the map longitude that faces the camera at t = 0 (Moon near side, Syrtis Major, the Great Red Spot, Atlantic) */
const FACE: Record<BodyKind, number> = { moon: 0, mars: 55, jupiter: 30, saturn: 0, earth: -35, uranus: 0, neptune: -40 };
const faceAngle = (lon: number) => Math.PI / 2 - ((lon + 180) / 360) * Math.PI * 2;

export function Body({ kind, radius, spin = 0.04, tilt = 0.2, ringTilt = 1.15, segments = 64 }: { kind: BodyKind; radius: number; spin?: number; tilt?: number; ringTilt?: number; segments?: number }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const m = materials(kind);
  const rim = useMemo(() => rimMat(RIM[kind][0], 2.6, RIM[kind][1]), [kind]);
  const ringGeo = useMemo(() => (m.ring ? radialRing(radius * m.ring.inner, radius * m.ring.outer) : null), [m.ring, radius]);
  useOutlines(g, "interactable", [kind]);
  useFrame((s) => {
    const t = motion.reduced ? 0 : s.clock.elapsedTime;
    const f = faceAngle(FACE[kind]);
    if (body.current) body.current.rotation.y = t * spin + f;
    if (clouds.current) clouds.current.rotation.y = t * spin * 1.35 + f;
  });
  return (
    <group ref={g} rotation={[0, 0, tilt]}>
      <mesh ref={body} material={m.body}>
        <sphereGeometry args={[radius, segments, Math.round(segments * 0.66)]} />
      </mesh>
      {m.clouds && (
        <mesh ref={clouds} material={m.clouds} userData={{ noOutline: true }}>
          <sphereGeometry args={[radius * 1.02, 48, 32]} />
        </mesh>
      )}
      <mesh material={rim} userData={{ noOutline: true }} scale={1.012}>
        <sphereGeometry args={[radius, 40, 26]} />
      </mesh>
      {m.ring && ringGeo && (
        <mesh geometry={ringGeo} material={m.ring.mat} rotation={[ringTilt, 0, 0]} userData={{ noOutline: true }} />
      )}
    </group>
  );
}
