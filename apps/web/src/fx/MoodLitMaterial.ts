/**
 * Adapted from Mistwood Cottage © 2025 Amira Deuraseh
 * (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/).
 * Changes: Converted to TypeScript, supports albedo maps, vertex colours, baked AO textures,
 * dynamic uniforms hooked into useMoodStore, and Three.js fog.
 */
import * as THREE from "three";
import { useMoodStore } from "./moodStore";

const vertexShader = /* glsl */ `
  varying vec3 vNormalWorld;
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunPosition;
  uniform vec3 uMoodTint;
  uniform vec3 uShadeTint;
  uniform vec3 uBaseColor;
  uniform sampler2D uMap;
  uniform bool uHasMap;
  uniform sampler2D uAoMap;
  uniform bool uHasAoMap;
  uniform float uAoIntensity;

  varying vec3 vNormalWorld;
  varying vec2 vUv;

  #include <fog_pars_fragment>

  void main() {
    vec4 texColor = uHasMap ? texture2D(uMap, vUv) : vec4(uBaseColor, 1.0);
    vec3 albedo = texColor.rgb;

    // ~20% mood tint on albedo
    vec3 litColor = mix(albedo, uMoodTint, 0.20);

    // Sun shade term: dot with sun direction
    vec3 sunDir = normalize(-uSunPosition);
    float sunDot = dot(normalize(vNormalWorld), sunDir);
    float sunShade = clamp(0.5 - 0.5 * sunDot, 0.0, 1.0);

    // Mix lit and shaded colours
    vec3 shadeColor = mix(albedo * 0.7, uShadeTint, 0.45);
    vec3 finalColor = mix(litColor, shadeColor, sunShade);

    // Apply baked AO if provided
    if (uHasAoMap) {
      float ao = texture2D(uAoMap, vUv).r;
      finalColor *= mix(1.0, ao, uAoIntensity);
    }

    gl_FragColor = vec4(finalColor, texColor.a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface MoodLitOptions {
  color?: string | number;
  map?: THREE.Texture | null;
  aoMap?: THREE.Texture | null;
  aoIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export class MoodLitMaterial extends THREE.ShaderMaterial {
  constructor(opts: MoodLitOptions = {}) {
    const moodCfg = useMoodStore.getState().config;
    const baseColor = new THREE.Color(opts.color ?? "#ffffff");
    const sunPos = new THREE.Vector3(...moodCfg.sunPosition);
    const moodTint = new THREE.Color(moodCfg.playerTint);
    const shadeTint = new THREE.Color(moodCfg.shadeTint);

    super({
      vertexShader,
      fragmentShader,
      side: opts.side ?? THREE.FrontSide,
      transparent: opts.transparent ?? false,
      fog: true,
      uniforms: {
        ...THREE.UniformsLib.fog,
        uSunPosition: { value: sunPos },
        uMoodTint: { value: moodTint },
        uShadeTint: { value: shadeTint },
        uBaseColor: { value: baseColor },
        uMap: { value: opts.map ?? null },
        uHasMap: { value: !!opts.map },
        uAoMap: { value: opts.aoMap ?? null },
        uHasAoMap: { value: !!opts.aoMap },
        uAoIntensity: { value: opts.aoIntensity ?? 0.8 },
      },
    });
  }

  updateMood() {
    const cfg = useMoodStore.getState().config;
    this.uniforms.uSunPosition.value.set(...cfg.sunPosition);
    this.uniforms.uMoodTint.value.set(cfg.playerTint);
    this.uniforms.uShadeTint.value.set(cfg.shadeTint);
  }
}

