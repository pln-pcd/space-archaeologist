// Little rendered previews of each explorer part for the designer tiles (the real 3D part, not a
// colour swatch). One small offscreen WebGL renderer, images cached by key, made lazily.
import * as THREE from "three";
import { buildChibi, buildHair, buildHead, buildHelmet, buildSuit, type ChibiLook, type HairStyle } from "./chibiModel";

let renderer: THREE.WebGLRenderer | null = null;
const cache = new Map<string, string>();
const SIZE = 160;

function setup() {
  if (renderer) return renderer;
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function shoot(obj: THREE.Object3D, focus: [number, number, number], dist: number, yaw = 0.45): string {
  const r = setup();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#FFF6E8", "#8C84C8", 1.6));
  const key = new THREE.DirectionalLight("#FFFFFF", 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#B9D8FF", 1.2);
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  scene.add(obj);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  const [x, y, z] = focus;
  cam.position.set(x + Math.sin(yaw) * dist, y + dist * 0.16, z + Math.cos(yaw) * dist);
  cam.lookAt(x, y, z);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(scene, cam);
  return r.domElement.toDataURL("image/png");
}

export type ThumbKind = "suit" | "helmet" | "visor" | "hair" | "hairColor" | "skin" | "accessory";

/** one preview image; `look` is the explorer being designed (other parts follow it) */
export function partThumb(kind: ThumbKind, value: string | number, look: ChibiLook): string {
  const k = `${kind}:${value}:${kind === "hair" ? look.hairColor + look.skin : kind === "hairColor" ? look.hair + look.skin : kind === "helmet" || kind === "visor" ? look.suit + look.hair + look.hairColor + look.skin + (kind === "helmet" ? look.visor : look.helmet) : kind === "accessory" ? look.suit + look.skin + look.hair : ""}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let url = "";
  const head = () => {
    const g = new THREE.Group();
    g.add(buildHead(look.skin).head);
    return g;
  };
  if (kind === "suit") {
    const { body } = buildSuit(String(value));
    url = shoot(body, [0, 0.36, 0], 2.0, 0.5);
  } else if (kind === "skin") {
    const g = head();
    g.children[0] = buildHead(String(value)).head;
    g.add(buildHair(look.hair as HairStyle, look.hairColor));
    url = shoot(g, [0, 0.0, 0], 1.6, 0.3);
  } else if (kind === "hair" || kind === "hairColor") {
    const g = head();
    g.add(buildHair((kind === "hair" ? value : look.hair) as HairStyle, kind === "hairColor" ? String(value) : look.hairColor));
    url = shoot(g, [0, 0.02, 0], 1.75, kind === "hair" ? 0.75 : 0.45);
  } else if (kind === "helmet" || kind === "visor") {
    const g = head();
    g.add(buildHair(look.hair as HairStyle, look.hairColor));
    g.add(buildHelmet(kind === "helmet" ? Number(value) : look.helmet, kind === "visor" ? String(value) : look.visor, look.suit));
    url = shoot(g, [0, 0.0, 0], 2.25, 0.45);
  } else if (kind === "accessory") {
    const idx = Number(value);
    if (idx === 7) {
      url = "";
    } else {
      const rig = buildChibi({ ...look, accessory: idx, helmetOn: false });
      const focus: [number, number, number] = idx === 5 || idx === 6 ? [0, 0.88, 0] : idx === 3 ? [0.1, 0.32, 0] : idx === 4 ? [0.15, 0.32, 0] : [0, 0.48, 0];
      if (idx === 4) rig.armR.rotation.x = -0.6;
      url = shoot(rig.root, focus, idx === 5 || idx === 6 ? 1.6 : 1.25, idx === 3 ? 0.9 : 0.25);
      rig.dispose();
    }
  }
  cache.set(k, url);
  return url;
}

/** a portrait of the whole explorer (passport photo), cached by look */
export function explorerPortrait(look: ChibiLook): string {
  const k = `portrait:${JSON.stringify(look)}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const rig = buildChibi({ ...look, helmetOn: true });
  rig.armR.rotation.z = 2.4; // waving hello
  const url = shoot(rig.root, [0, 0.62, 0], 3.1, 0.35);
  rig.dispose();
  cache.set(k, url);
  return url;
}
