// Shared uniforms for every "Quiet Afternoon" shader (bible §12). One object, referenced by all
// ramp materials, so the world look (atmosphere, drifting light, sway) switches in one place.
import * as THREE from "three";

/** Tileable value-noise texture made on a canvas (no image files). */
function noiseTexture(size: number, octaves: number, seed: number, contrast = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const img = x.createImageData(size, size);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grids = Array.from({ length: octaves }, (_, o) => {
    const n = 4 << o;
    return { n, v: Array.from({ length: n * n }, rnd) };
  });
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let v = 0,
        amp = 0.5,
        tot = 0;
      for (const g of grids) {
        const fx = (px / size) * g.n,
          fy = (py / size) * g.n;
        const x0 = Math.floor(fx),
          y0 = Math.floor(fy);
        const tx = smooth(fx - x0),
          ty = smooth(fy - y0);
        const at = (ix: number, iy: number) => g.v[((iy + g.n) % g.n) * g.n + ((ix + g.n) % g.n)];
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (a + (b - a) * ty) * amp;
        tot += amp;
        amp *= 0.5;
      }
      v = Math.max(0, Math.min(1, (v / tot - 0.5) * contrast + 0.5));
      const i = (py * size + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Tiny dark flecks for ground detail (regolith, dust, floor grit). */
function speckleTexture(size: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * 6; i++) {
    const r = 0.6 + rnd() * 1.8;
    x.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
    x.beginPath();
    x.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const isDom = typeof document !== "undefined";
export const fx = {
  uTime: { value: 0 },
  // HSV atmosphere
  uFogOn: { value: 1 },
  uFogNear: { value: 15 },
  uFogFar: { value: 60 },
  uFogSat: { value: 0.35 },
  uFogVal: { value: 0.75 },
  // drifting light (two scrolled noise layers multiplied)
  uDriftOn: { value: 1 },
  uDriftMin: { value: 0.85 },
  uDriftScale: { value: 0.035 },
  tDrift: { value: isDom ? noiseTexture(128, 4, 7, 1.6) : null },
  // ground detail
  tSpeckle: { value: isDom ? speckleTexture(256, 11) : null },
  tNoise: { value: isDom ? noiseTexture(128, 3, 23, 1.3) : null },
  // sway ("only sometimes")
  uSwayOn: { value: 1 },
  // near-camera line dither
  uFadeNear: { value: 1.5 },
  uFadeFar: { value: 2.0 },
  // CUTE POLISH v2: painted texture + shadow hatch on every ramp surface (off in ?style=legacy)
  uPaint: { value: typeof location !== "undefined" && new URLSearchParams(location.search).get("style") === "legacy" ? 0 : 1 },
  // world tint: multiplies the painted colour (Mars storm, blue sunset)
  uTint: { value: new THREE.Color(1, 1, 1) },
  // player-reactive details
  uPlayerPos: { value: new THREE.Vector3() },
  uPlayerSpeed: { value: 0 },
};

export type WorldLook = "base" | "moon" | "mars";
/** Per-world atmosphere and light drift (bible §12). The Moon has no air: no haze, no drift, no sway. */
let active: WorldLook | null = null;
/** the look currently loaded into the shared uniforms */
export const activeLook = () => active;
export function setWorldLook(look: WorldLook) {
  active = look;
  fx.uTint.value.setRGB(1, 1, 1);
  if (look === "moon") {
    fx.uFogOn.value = 0; // vacuum: no aerial perspective at all
    fx.uDriftOn.value = 0; // no clouds or dust overhead to cast moving shade
    fx.uSwayOn.value = 0; // no wind
  } else if (look === "mars") {
    fx.uFogOn.value = 1;
    fx.uFogNear.value = 25;
    fx.uFogFar.value = 150;
    fx.uFogSat.value = 0.25;
    fx.uFogVal.value = 0.72;
    fx.uDriftOn.value = 1;
    fx.uDriftMin.value = 0.72;
    fx.uDriftScale.value = 0.02;
    fx.uSwayOn.value = 1;
  } else {
    fx.uFogOn.value = 1;
    fx.uFogNear.value = 15;
    fx.uFogFar.value = 60;
    fx.uFogSat.value = 0.35;
    fx.uFogVal.value = 0.75;
    fx.uDriftOn.value = 1;
    fx.uDriftMin.value = 0.86;
    fx.uDriftScale.value = 0.035;
    fx.uSwayOn.value = 1;
  }
}
