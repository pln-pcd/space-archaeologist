// Final colour grade (bible §12): one fullscreen pass with SMAA + a 3D LUT we generate ourselves
// (no LUT files). Slightly lifted warm-violet blacks, soft contrast, gentle warm highlights, mild
// saturation; one look per world: base warm cream, Moon neutral silver, Mars warm ochre.
import { useMemo } from "react";
import { EffectComposer, LUT, SMAA } from "@react-three/postprocessing";
import { LookupTexture } from "postprocessing";
import type { WorldLook } from "./uniforms";
import { isLegacyStyle } from "../style/styleMode";

type Grade = { lift: [number, number, number]; liftAmt: number; contrast: number; sat: number; tint: [number, number, number]; hi: [number, number, number] };
const GRADES: Record<WorldLook, Grade> = {
  // base: warm cream afternoon inside the dome
  // master: warm cream, blacks lifted toward a desaturated warm grey (no purple)
  base: { lift: [0.21, 0.2, 0.18], liftAmt: 0.08, contrast: 0.86, sat: 0.9, tint: [0.012, 0.007, -0.006], hi: [0.03, 0.022, 0.006] },
  // Moon: neutral silver, slightly cool, deep blacks kept (crisp vacuum shadows)
  moon: { lift: [0.14, 0.14, 0.2], liftAmt: 0.03, contrast: 0.9, sat: 0.9, tint: [-0.004, 0.0, 0.012], hi: [0.01, 0.01, 0.015] },
  // Mars: warm ochre
  mars: { lift: [0.22, 0.13, 0.16], liftAmt: 0.07, contrast: 0.84, sat: 1.0, tint: [0.03, 0.012, -0.03], hi: [0.04, 0.022, -0.012] },
};

const smooth = (x: number) => x * x * (3 - 2 * x);
function gradeColor(r: number, g: number, b: number, k: Grade): [number, number, number] {
  // soft contrast around the middle
  const amt = k.contrast - 0.6; // 0.22 = soft S-curve, 0.3 = a little crisper (Moon)
  const c = (v: number) => v + (smooth(v) - v) * amt;
  let o = [c(r), c(g), c(b)];
  // saturation
  const l = o[0] * 0.299 + o[1] * 0.587 + o[2] * 0.114;
  o = o.map((v) => l + (v - l) * k.sat);
  // lifted, tinted blacks
  o = o.map((v, i) => v * (1 - k.liftAmt) + k.lift[i] * k.liftAmt);
  // overall tint + warm highlights
  const hiW = Math.max(0, Math.min(1, (l - 0.55) / 0.45));
  o = o.map((v, i) => v + k.tint[i] + k.hi[i] * hiW);
  return o.map((v) => Math.max(0, Math.min(1, v))) as [number, number, number];
}

const cache = new Map<WorldLook, LookupTexture>();
export function lutFor(look: WorldLook) {
  let lut = cache.get(look);
  if (lut) return lut;
  lut = LookupTexture.createNeutral(32);
  const d = lut.image.data as Float32Array;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = gradeColor(d[i], d[i + 1], d[i + 2], GRADES[look]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  lut.needsUpdate = true;
  cache.set(look, lut);
  return lut;
}

/** The world's grade. In Mistwood style, post-processing is completely disabled (Cineon 1.75 on canvas). */
export function Grade({ look, off = false }: { look: WorldLook; off?: boolean }) {
  const lut = useMemo(() => lutFor(look), [look]);
  if (off || !isLegacyStyle()) return null;
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      <LUT lut={lut} tetrahedralInterpolation />
    </EffectComposer>
  );
}
