// The "painted ramp" material (bible §12): our own shader patch on MeshLambertMaterial.
// Colour comes from a palette ramp, not from lighting: rampX = (N·sun remapped 0..1) ×
// smoothstep(0.1, 0.9, sun shadow) picks one of three flat bands (shadow / mid / light). Then a
// per-world HSV atmosphere, drifting light, optional ground speckle, a near-camera line dither and
// optional "only sometimes" sway. Written for Starship Odyssey; technique studied from Summer
// Afternoon (see docs/research/summertime-style.md), no code reused.
import * as THREE from "three";
import { fx } from "./uniforms";
import { rampFor } from "./palette";

export type RampOpts = {
  /** faceted low-poly normals (terrain, rocks, props). Characters and curved parts: false */
  flat?: boolean;
  /** characters: never dither-fade near the camera */
  character?: boolean;
  /** posterised suit colour: hue 0..1 (saturation 0.4, three value steps) */
  suitHue?: number;
  /** sway amount (plants, cables, antenna); 0 = still */
  sway?: number;
  /** instanced ground details: part away from the player, more when moving fast */
  bend?: boolean;
  /** ground speckle strength 0..1 (regolith, dust, floor grit) */
  speckle?: number;
  /** colour animates at runtime (waking machines): ramp computed from the live colour */
  dynamic?: boolean;
  emissive?: string;
  glow?: number;
  vertexColors?: boolean;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture | null;
};

const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uRamp0;
uniform vec3 uRamp1;
uniform vec3 uRamp2;
uniform float uUseRow;
uniform float uFogOn;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogSat;
uniform float uFogVal;
uniform float uDriftOn;
uniform float uDriftMin;
uniform float uDriftScale;
uniform sampler2D tDrift;
uniform sampler2D tSpeckle;
uniform sampler2D tNoise;
uniform float uSpeckle;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uSuitHue;
uniform vec3 uTint;
uniform float uPaint;
varying vec3 vWPos;

vec3 r_hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1.0e-10)), d / (q.x + 1.0e-10), q.x);
}
vec3 r_rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 r_toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
vec3 r_toLin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
float r_toward(float h, float t, float a) { float d = t - h; d -= floor(d + 0.5); return fract(h + d * a); }
float r_band1(float x) { return smoothstep(0.455, 0.475, x); }
float r_band2(float x) { return smoothstep(0.655, 0.675, x); }
// the same banding as palette.ts makeRamp(), for colours that change at runtime
vec3 r_auto(vec3 baseLin, float x) {
  vec3 base = r_toSrgb(baseLin);
  vec3 h = r_hsv(base);
  float neutral = 1.0 - smoothstep(0.04, 0.12, h.y);
  vec3 sh = r_rgb(vec3(mix(r_toward(h.x, 0.64, 0.12), 0.7, neutral), max(h.y * 0.8, 0.12 * neutral), h.z * 0.52));
  vec3 li = r_rgb(vec3(r_toward(h.x, 0.09, 0.04), h.y * mix(0.94, 0.3, neutral), min(1.0, h.z * 1.08 + 0.02)));
  return r_toLin(mix(mix(sh, base, r_band1(x)), li, r_band2(x)));
}
vec3 r_row(float x) { return mix(mix(uRamp0, uRamp1, r_band1(x)), uRamp2, r_band2(x)); }
`;

const FRAG_FADE = /* glsl */ `
#include <clipping_planes_fragment>
#ifndef RAMP_CHARACTER
  // near-camera line dither: thin horizontal lines thin out instead of the mesh clipping
  float rCamD = length(vWPos - cameraPosition);
  if (rCamD < uFadeFar) {
    float rK = smoothstep(uFadeNear, uFadeFar, rCamD);
    if (mod(gl_FragCoord.y, 3.0) > 3.0 * rK) discard;
  }
#endif
`;

const FRAG_RAMP = /* glsl */ `
float rShadow = 1.0;
float rX = 0.8;
#if NUM_DIR_LIGHTS > 0
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow rDls = directionalLightShadows[ 0 ];
    rShadow = receiveShadow ? getShadow( directionalShadowMap[ 0 ], rDls.shadowMapSize, rDls.shadowIntensity, rDls.shadowBias, rDls.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
  #endif
  rX = ( dot( normal, directionalLights[ 0 ].direction ) * 0.5 + 0.5 ) * smoothstep( 0.1, 0.9, rShadow );
#endif
vec3 rCol = uUseRow > 0.5 ? r_row( rX ) : r_auto( diffuseColor.rgb, rX );
#ifdef RAMP_SUIT
  // posterised suit colour: player hue, saturation 0.4, value in three steps
  // accent panels: HSL(h, 0.4, 0.3) as the mid band (≈ HSV s 0.57, v 0.42), muted steps either side
  rCol = r_toLin( r_rgb( vec3( uSuitHue, 0.45, 0.3 + floor( rX * 2.99 ) * 0.1 ) ) );
#endif
#ifdef RAMP_SPECKLE
  float rSp = texture2D( tSpeckle, vWPos.xz * 0.45 ).r * smoothstep( 0.35, 0.75, texture2D( tNoise, vWPos.xz * 0.04 ).r );
  rCol *= 1.0 - rSp * uSpeckle * 0.35;
#endif
// CUTE POLISH v2 (bible §22 C1): every surface is painted. A soft, world-anchored variation (±10 %,
// triplanar on the real surface normal) plus a fine grain, and a drawn hatch only in the shadows
// (screen-aligned, 8-12 % at most, so it never crawls as the camera moves). Legacy look: uPaint = 0.
if ( uPaint > 0.5 ) {
  vec3 rWN = normalize( cross( dFdx( vWPos ), dFdy( vWPos ) ) );
  vec3 rTw = pow( abs( rWN ), vec3( 4.0 ) );
  rTw /= ( rTw.x + rTw.y + rTw.z + 1e-4 );
  float rPaint = texture2D( tNoise, vWPos.zy * 0.35 ).r * rTw.x + texture2D( tNoise, vWPos.xz * 0.35 ).r * rTw.y + texture2D( tNoise, vWPos.xy * 0.35 ).r * rTw.z;
  float rFine = texture2D( tSpeckle, vWPos.zy * 1.6 ).r * rTw.x + texture2D( tSpeckle, vWPos.xz * 1.6 ).r * rTw.y + texture2D( tSpeckle, vWPos.xy * 1.6 ).r * rTw.z;
  rCol *= 0.9 + 0.2 * rPaint - 0.05 * rFine;
  float rShade = 1.0 - smoothstep( 0.22, 0.55, rX );
  float rHatch = smoothstep( 0.55, 0.85, fract( ( gl_FragCoord.x + gl_FragCoord.y ) / 7.0 ) );
  rCol *= 1.0 - rShade * rHatch * 0.11;
}
if ( uDriftOn > 0.5 ) {
  // drifting light: two slowly scrolling noise layers, multiplied
  float rD1 = texture2D( tDrift, vWPos.xz * uDriftScale + vec2( uTime * 0.0061 + 13.2, uTime * 0.0042 - 2.3 ) ).r;
  float rD2 = texture2D( tDrift, vWPos.xz * uDriftScale * 1.37 - 6.1 + vec2( uTime * -0.0049, uTime * 0.0068 ) ).r;
  rCol *= mix( uDriftMin, 1.0, smoothstep( 0.12, 0.6, rD1 * rD2 * 1.4 ) );
}
rCol *= uTint;
vec3 outgoingLight = rCol + totalEmissiveRadiance;
if ( uFogOn > 0.5 ) {
  // HSV atmosphere: far things lose saturation and settle to one value
  float rFd = clamp( ( length( vWPos - cameraPosition ) - uFogNear ) / ( uFogFar - uFogNear ), 0.0, 1.0 );
  vec3 rH = r_hsv( r_toSrgb( outgoingLight ) );
  rH.y = mix( rH.y, uFogSat, rFd );
  rH.z = mix( rH.z, uFogVal, rFd );
  outgoingLight = r_toLin( r_rgb( rH ) );
}
`;

const VERT_SWAY = /* glsl */ `
#ifdef RAMP_SWAY
  // "only sometimes" sway: grows with height, seeded per object
  float sSeed = fract( sin( dot( modelMatrix[ 3 ].xyz, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
  float sDisp = smoothstep( 0.0, 2.0, transformed.y );
  float sT = ( sin( uTime * ( 0.4 + 0.2 * sSeed ) + sSeed * 120.2 ) + 1.0 ) * 0.5;
  float sAmp = ( 0.5 + 0.5 * sSeed ) * sDisp * sT * uSway * uSwayOn;
  transformed.x += sin( sSeed * 21.23 + uTime + transformed.y * 0.3 ) * sAmp;
  transformed.z += sin( sSeed * 3.23 + uTime * 1.5 + transformed.y * 0.3 ) * sAmp;
#endif
#ifdef RAMP_BEND
  // bend away from the explorer in world space, scaled by their speed
  vec4 rW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    rW = instanceMatrix * rW;
  #endif
  rW = modelMatrix * rW;
  #ifdef USE_INSTANCING
    vec3 bRoot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  #else
    vec3 bRoot = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  #endif
  vec2 bDir = bRoot.xz - uPlayerPos.xz;
  float bD = length( bDir );
  float bSpeed = clamp( uPlayerSpeed * 0.35, 0.0, 1.0 );
  float bK = ( 1.0 - smoothstep( 0.15, mix( 0.5, 1.3, bSpeed ), bD ) ) * ( 0.25 + 0.75 * bSpeed );
  rW.xz += normalize( bDir + 1e-4 ) * bK * smoothstep( 0.0, 0.2, transformed.y + 0.02 ) * 0.22;
  vec4 mvPosition = viewMatrix * rW;
  gl_Position = projectionMatrix * mvPosition;
  vWPos = rW.xyz;
#else
  #include <project_vertex>
  vec4 rW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    rW = instanceMatrix * rW;
  #endif
  vWPos = ( modelMatrix * rW ).xyz;
#endif
`;

const cache = new Map<string, THREE.MeshLambertMaterial>();
const col = new THREE.Color();

/** A painted-ramp material for one base colour (shared per colour + options). */
export function rampMaterial(color: string, o: RampOpts = {}): THREE.MeshLambertMaterial {
  const key = color + JSON.stringify({ ...o, map: o.map ? o.map.uuid : undefined });
  if (!o.dynamic) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const m = new THREE.MeshLambertMaterial({
    color,
    emissive: o.emissive ?? "#000000",
    emissiveIntensity: o.glow ?? 1,
    vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    flatShading: o.flat ?? !o.character,
    map: o.map ?? null,
    fog: false,
  });
  const row = rampFor(color);
  const useRow = !o.dynamic && !o.vertexColors && !o.map;
  const own = {
    uRamp0: { value: new THREE.Color(row[0]) },
    uRamp1: { value: new THREE.Color(row[1]) },
    uRamp2: { value: new THREE.Color(row[2]) },
    uUseRow: { value: useRow ? 1 : 0 },
    uSpeckle: { value: o.speckle ?? 0 },
    uSuitHue: { value: o.suitHue ?? 0 },
    uSway: { value: o.sway ?? 0 },
  };
  m.userData.ramp = own;
  const defines: string[] = [];
  if (o.character) defines.push("RAMP_CHARACTER");
  if (o.suitHue !== undefined) defines.push("RAMP_SUIT");
  if (o.sway) defines.push("RAMP_SWAY");
  if (o.speckle) defines.push("RAMP_SPECKLE");
  if (o.bend) defines.push("RAMP_BEND");
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fx, own);
    const head = defines.map((d) => `#define ${d}`).join("\n") + "\n" + GLSL_COMMON;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${head}\nuniform float uSway;\nuniform float uSwayOn;\nuniform vec3 uPlayerPos;\nuniform float uPlayerSpeed;`)
      .replace("#include <project_vertex>", VERT_SWAY);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${head}`)
      .replace("#include <clipping_planes_fragment>", FRAG_FADE)
      .replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;", FRAG_RAMP);
  };
  m.customProgramCacheKey = () => "ramp:" + defines.join(",");
  if (!o.dynamic) cache.set(key, m);
  void col;
  return m;
}

/** Update a dynamic ramp material's colour (it re-derives its bands in the shader). */
export function setRampColor(m: THREE.MeshLambertMaterial, c: THREE.Color) {
  m.color.copy(c);
}
