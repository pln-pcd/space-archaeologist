/**
 * Adapted from Mistwood Cottage © 2025 Amira Deuraseh (CC BY 4.0).
 * Changes: Converted to TypeScript / React Three Fiber, procedural noise texture generation,
 * configurable dimensions for cups, vents, and rocket LOX venting.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

let noiseTextureCache: THREE.CanvasTexture | null = null;
function getPerlinNoiseTexture(): THREE.CanvasTexture {
  if (noiseTextureCache) return noiseTextureCache;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const val = Math.floor(Math.random() * 255);
    imgData.data[i * 4 + 0] = val;
    imgData.data[i * 4 + 1] = val;
    imgData.data[i * 4 + 2] = val;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  noiseTextureCache = new THREE.CanvasTexture(canvas);
  noiseTextureCache.wrapS = THREE.RepeatWrapping;
  noiseTextureCache.wrapT = THREE.RepeatWrapping;
  return noiseTextureCache;
}

const steamVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Twist around Y growing with height
    float twistAngle = sin(uTime * 0.4 + pos.y * 1.5) * 0.25 * uv.y;
    float cosA = cos(twistAngle);
    float sinA = sin(twistAngle);
    float newX = pos.x * cosA - pos.z * sinA;
    float newZ = pos.x * sinA + pos.z * cosA;
    pos.x = newX + sin(uTime * 0.3 + pos.y * 2.0) * 0.08 * uv.y;
    pos.z = newZ;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const steamFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform sampler2D uNoiseMap;
  varying vec2 vUv;

  void main() {
    // Scrolling noise rising up
    vec2 scrollUv = vec2(vUv.x, vUv.y - uTime * 0.25);
    float noise = texture2D(uNoiseMap, scrollUv).r;

    // Soft fade at edges and top
    float edgeFade = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    float heightFade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
    float alpha = smoothstep(0.35, 0.85, noise) * edgeFade * heightFade * 0.45;

    gl_FragColor = vec4(uColor, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Steam({
  width = 0.12,
  height = 0.55,
  color = "#ffe7dd",
  position = [0, 0, 0],
}: {
  width?: number;
  height?: number;
  color?: string;
  position?: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const noiseTex = useMemo(() => getPerlinNoiseTexture(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uNoiseMap: { value: noiseTex },
    }),
    [color, noiseTex]
  );

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[width, height, 16, 32]} />
      <shaderMaterial
        vertexShader={steamVertexShader}
        fragmentShader={steamFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

