// G2 "Fill the Rock Box" (bible §9): on the moonwalk, catch Moon samples drifting in slow Moon
// gravity and drop them in the Rock Box, aiming for Apollo 11's real 21.5 kg. Full-screen mirrored
// camera (no effects on the video) with the objects on a transparent canvas above it; mouse and
// touch drag and drop the same way. Waves: samples only → Earth items join → faster, more core
// tubes. Adaptive: 3 missed grabs widen the aim assist and slow things down; a good streak speeds
// spawns a little. Then the Laser Ping finale. Calm feel: a soft clunk, the next note of a scale.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useIntent, useIntentScope } from "../../input/bus";
import { useCameraBackdrop, useInput } from "../../input/store";
import { play, noteGesture } from "../../audio/sfx";
import { LiveCamera } from "./CameraCheck";
import { line } from "./flow";
import { say } from "./voice";
import HowTo from "../../missions/HowTo";
import { speak, stopSpeaking } from "../../odyssey/nova/voice";

export const APOLLO_KG = 21.5; // F31: 21.55 kg of lunar rock and soil
const GAME_S = 90;
type Kind = "basalt" | "breccia" | "small" | "soil" | "core" | "leaf" | "rain" | "shell";
const KINDS: Record<Kind, { kg: number; label: string; earth?: boolean; size: number }> = {
  basalt: { kg: 1.5, label: "Big basalt · 1.5 kg", size: 62 },
  breccia: { kg: 1.0, label: "Breccia · 1.0 kg", size: 52 },
  small: { kg: 0.6, label: "Small rock · 0.6 kg", size: 40 },
  soil: { kg: 0.5, label: "Soil bag · 0.5 kg", size: 46 },
  core: { kg: 2.0, label: "Core tube · 2.0 kg", size: 70 },
  leaf: { kg: 0, label: "A leaf: from Earth", earth: true, size: 46 },
  rain: { kg: 0, label: "A raindrop: from Earth", earth: true, size: 40 },
  shell: { kg: 0, label: "A seashell: from Earth", earth: true, size: 46 },
};
type Obj = { id: number; kind: Kind; x: number; y: number; vx: number; vy: number; rot: number; spin: number; held: boolean; gone: boolean; pop: number };
type Game = { objs: Obj[]; t: number; left: number; bonus: number; kg: number; next: number; id: number; held: Obj | null; px: number; py: number; pv: boolean; grabbing: boolean; misses: number; streak: number; assist: number; speed: number; rate: number; note: number; over: boolean };

/* ---------------- 3D objects on a transparent orthographic canvas ---------------- */
const ramp3 = (() => {
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mat = (c: string) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp3 });
const MATS: Record<Kind, THREE.Material> = { basalt: mat("#6F6B66"), breccia: mat("#9A968E"), small: mat("#85817A"), soil: mat("#C9C2B4"), core: mat("#B9B6B0"), leaf: mat("#6A8C70"), rain: mat("#8FA3B5"), shell: mat("#E3D8C2") };
function geo(kind: Kind): THREE.BufferGeometry {
  switch (kind) {
    case "basalt":
      return new THREE.DodecahedronGeometry(0.5, 0);
    case "breccia":
      return new THREE.IcosahedronGeometry(0.5, 0);
    case "small":
      return new THREE.TetrahedronGeometry(0.55, 1);
    case "soil":
      return new THREE.BoxGeometry(0.8, 0.6, 0.5);
    case "core":
      return new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8);
    case "leaf": {
      const s = new THREE.Shape();
      s.moveTo(0, -0.5);
      s.quadraticCurveTo(0.45, 0, 0, 0.5);
      s.quadraticCurveTo(-0.45, 0, 0, -0.5);
      return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
    }
    case "rain":
      return new THREE.SphereGeometry(0.4, 10, 8).scale(1, 1.3, 1);
    case "shell":
      return new THREE.ConeGeometry(0.45, 0.7, 9);
  }
}
const GEOS = Object.fromEntries((Object.keys(KINDS) as Kind[]).map((k) => [k, geo(k)])) as Record<Kind, THREE.BufferGeometry>;
let shadowTex: THREE.CanvasTexture | null = null;
function contactShadow() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(40,38,36,0.45)");
  g.addColorStop(1, "rgba(40,38,36,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return (shadowTex = new THREE.CanvasTexture(c));
}

function Objects({ game }: { game: React.MutableRefObject<Game> }) {
  const { size } = useThree();
  const pool = useRef<THREE.Group>(null);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }), []);
  useFrame(() => {
    const g = pool.current;
    if (!g) return;
    const objs = game.current.objs;
    g.children.forEach((child, i) => {
      const o = objs[i];
      child.visible = !!o && !o.gone;
      if (!o || o.gone) return;
      const k = KINDS[o.kind];
      const s = k.size * 1.35 * (o.pop < 1 ? 0.2 + 0.8 * (1 - Math.pow(1 - o.pop, 3)) : 1);
      child.position.set(o.x - size.width / 2, size.height / 2 - o.y, 0);
      const mesh = child.children[1] as THREE.Mesh;
      mesh.geometry = GEOS[o.kind];
      mesh.material = MATS[o.kind];
      mesh.scale.setScalar(s);
      mesh.rotation.set(o.rot * 0.7, o.rot, o.rot * 0.3);
      const sh = child.children[0] as THREE.Mesh;
      sh.scale.set(s * 1.4, s * 0.5, 1);
      sh.position.set(0, -s * 0.55, -40);
    });
  });
  return (
    <group ref={pool}>
      {Array.from({ length: 24 }, (_, i) => (
        <group key={i} visible={false}>
          <mesh material={shadowMat}>
            <planeGeometry args={[1, 1]} />
          </mesh>
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function OrthoRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const c = camera as THREE.OrthographicCamera;
    c.left = -size.width / 2;
    c.right = size.width / 2;
    c.top = size.height / 2;
    c.bottom = -size.height / 2;
    c.near = -500;
    c.far = 500;
    c.position.set(0, 0, 100);
    c.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/* ---------------- the game ---------------- */
export default function RockBox({ camera, onDone }: { camera: boolean; onDone: (kg: number, stars: number) => void }) {
  // v7.5: the camera fills the screen, so the glove sits right on the real hand (no Glove Cam)
  useCameraBackdrop(camera);
  const left = useInput((s) => s.leftHanded);
  const inference = useInput((s) => s.inferenceMs);
  const trackerFps = useInput((s) => s.trackerFps);
  useIntentScope(["pointer", "pinch", "grab"], {}, "rockbox");
  const game = useRef<Game>({ objs: [], t: 0, left: GAME_S, bonus: 0, kg: 0, next: 1.2, id: 0, held: null, px: -999, py: -999, pv: false, grabbing: false, misses: 0, streak: 0, assist: 80, speed: 1, rate: 1, note: 0, over: false });
  const [hud, setHud] = useState({ kg: 0, left: GAME_S, msg: undefined as string | undefined, tag: "" as string, earthBox: false });
  const [finale, setFinale] = useState<null | "aim" | "fire" | "back" | "done">(null);
  const [hold, setHold] = useState(0);
  const [puff, setPuff] = useState(0);
  const cursor = useRef<HTMLDivElement>(null);
  const W = () => window.innerWidth,
    H = () => window.innerHeight;
  // Rock Box bottom-left (bottom-right for left-handed players); Earth bin on the other side
  const boxRect = () => {
    const w = Math.max(220, W() * 0.22),
      h = Math.max(150, H() * 0.24);
    return left ? { x: W() - w - W() * 0.03, y: H() - h - H() * 0.04, w, h } : { x: W() * 0.03, y: H() - h - H() * 0.04, w, h };
  };
  const binRect = () => {
    const w = Math.max(150, W() * 0.13),
      h = Math.max(110, H() * 0.17);
    return left ? { x: W() * 0.03, y: H() - h - H() * 0.04, w, h } : { x: W() - w - W() * 0.03, y: H() - h - H() * 0.04, w, h };
  };
  const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

  // v7.5: ONE how-to-play card (what, why, how) before the clock starts
  const [brief, setBrief] = useState(0);
  const briefRef = useRef(0);
  briefRef.current = brief;
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const popId = useRef(0);

  // pointer: hand (index knuckle + palm, smoothed by the engine) or mouse / touch
  useIntent("pointer", (e) => {
    const g = game.current;
    g.px = e.x;
    g.py = e.y;
    g.pv = e.visible !== false;
  });
  const grab = (x: number, y: number) => {
    const g = game.current;
    if (g.held || g.over) return;
    let best: Obj | null = null,
      bd = g.assist;
    for (const o of g.objs) {
      if (o.gone) continue;
      const d = Math.hypot(o.x - x, o.y - y) - KINDS[o.kind].size * 0.55;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    g.grabbing = true;
    if (!best) {
      g.misses += 1;
      g.streak = 0;
      // adaptive help: three misses in a row widen the aim assist and slow things down
      if (g.misses >= 3) {
        g.assist = 120;
        g.speed = 0.8;
      }
      return;
    }
    g.misses = 0;
    best.held = true;
    g.held = best;
    play("pop", 1, 0.4);
    setHud((h) => ({ ...h, tag: KINDS[best!.kind].label }));
  };
  const release = (x: number, y: number, touch = false) => {
    const g = game.current;
    g.grabbing = false;
    const o = g.held;
    if (!o) return;
    o.held = false;
    g.held = null;
    setHud((h) => ({ ...h, tag: "" }));
    const k = KINDS[o.kind];
    if (inside(boxRect(), x, y, touch ? 80 : 60)) {
      if (k.earth) {
        // from Earth: it pops back out (no penalty, the streak breaks)
        o.vy = -260;
        o.vx = left ? -120 : 120;
        g.streak = 0;
        play("tryAgain", 1, 0.5);
        say("g-earth");
        setHud((h) => ({ ...h, msg: "g-earth", earthBox: true }));
        return;
      }
      o.gone = true;
      g.kg = Math.round((g.kg + k.kg) * 10) / 10;
      const pid = ++popId.current;
      setPops((p) => [...p.slice(-5), { id: pid, x, y, text: `+${k.kg} kg` }]);
      setTimeout(() => setPops((p) => p.filter((q) => q.id !== pid)), 1100);
      g.streak += 1;
      if (g.streak >= 4) g.rate = Math.min(1.35, g.rate + 0.08);
      play("landThud", 1.5, 0.35);
      noteGesture(g.note++ % 7);
      setPuff((p) => p + 1);
      setHud((h) => ({ ...h, kg: g.kg }));
    } else if (k.earth && inside(binRect(), x, y, touch ? 80 : 60)) {
      o.gone = true;
      // +2 s per Earth item sent home, at most +20 s per game so the round stays about 90 s
      if (g.bonus < 20) {
        g.left += 2;
        g.bonus += 2;
      }
      play("soft", 1.2, 0.5);
      setHud((h) => ({ ...h, left: g.left, msg: undefined }));
    } else {
      o.vy = 20;
    }
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;
  useIntent("pinchStart", (e) => grab(e.x, e.y));
  useIntent("grab", (e) => grab(e.x, e.y));
  useIntent("pinchEnd", (e) => release(e.x, e.y));
  useIntent("release", (e) => release(e.x, e.y));

  // main loop: spawns, floaty arcs (Moon gravity ~1/6 of Earth's, F19), the held object's spring
  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      hudAt = 0;
    const G = 150; // px/s², slow and floaty
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = game.current;
      if (!g.over && briefRef.current < 0) {
        g.t += dt;
        g.left -= dt;
        g.next -= dt * g.rate;
        if (g.next <= 0) {
          const phase = g.t < 30 ? 0 : g.t < 75 ? 1 : 2;
          g.next = (phase === 0 ? 1.7 : phase === 1 ? 1.3 : 0.95) / g.speed;
          const r = Math.random();
          let kind: Kind;
          if (phase >= 1 && r < 0.28) kind = (["leaf", "rain", "shell"] as Kind[])[Math.floor(Math.random() * 3)];
          else {
            const q = Math.random();
            const core = phase === 2 ? 0.22 : 0.08;
            kind = q < core ? "core" : q < core + 0.25 ? "basalt" : q < core + 0.5 ? "breccia" : q < core + 0.75 ? "small" : "soil";
          }
          const free = g.objs.find((o) => o.gone);
          const h = H() * (0.5 + Math.random() * 0.3);
          const o: Obj = { id: g.id++, kind, x: W() * (0.3 + Math.random() * 0.4), y: H() + 40, vx: (Math.random() - 0.5) * 60, vy: -Math.sqrt(2 * G * h) * (kind === "core" ? 0.92 : 1), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 1.2, held: false, gone: false, pop: 0 };
          if (free) Object.assign(free, o);
          else if (g.objs.length < 24) g.objs.push(o);
        }
        for (const o of g.objs) {
          if (o.gone) continue;
          o.pop = Math.min(1, o.pop + dt / 0.35);
          o.rot += o.spin * dt * g.speed;
          if (o.held) {
            // a soft spring toward the hand
            o.x += (g.px - o.x) * Math.min(1, dt * 14);
            o.y += (g.py - o.y) * Math.min(1, dt * 14);
            // v7.5: touching the box (or the bin, for Earth things) counts: no need to let go
            const r = KINDS[o.kind].size * 0.5;
            if (inside(boxRect(), o.x, o.y, 40 + r) || (KINDS[o.kind].earth && inside(binRect(), o.x, o.y, 40 + r))) releaseRef.current(o.x, o.y, true);
            continue;
          }
          o.vy += G * dt * g.speed * (o.kind === "core" ? 0.8 : 1);
          o.x += o.vx * dt * g.speed;
          o.y += o.vy * dt * g.speed;
          if (o.y > H() + 120 && o.vy > 0) o.gone = true; // floats away, no penalty
          if (o.x < -100 || o.x > W() + 100) o.gone = true;
        }
        if (g.left <= 0) {
          g.over = true;
          g.objs.forEach((o) => (o.gone = true));
          setFinale("aim");
          say("g-laser");
        }
      }
      // the cursor follows every frame (no React re-render)
      if (cursor.current) {
        cursor.current.style.transform = `translate(${g.px}px, ${g.py}px)`;
        cursor.current.style.opacity = g.pv && g.px > -500 ? "1" : "0";
        cursor.current.classList.toggle("grab", g.grabbing);
      }
      if (now - hudAt > 120) {
        hudAt = now;
        setHud((h) => (h.left !== Math.max(0, Math.ceil(g.left)) ? { ...h, left: Math.max(0, Math.ceil(g.left)) } : h));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    (window as unknown as { __rockbox: unknown }).__rockbox = { game: () => game.current, box: boxRect, bin: binRect };
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Laser Ping: hold the pointer on the reflector for 1 s
  useEffect(() => {
    if (finale !== "aim") return;
    let raf = 0,
      held = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const g = game.current;
      const on = Math.hypot(g.px - W() / 2, g.py - H() * 0.55) < 110;
      held = on ? held + dt : Math.max(0, held - dt * 2);
      setHold(Math.min(1, held));
      if (held >= 1) {
        play("laserPew", 1, 0.5);
        setFinale("fire");
        setTimeout(() => setFinale("back"), 1250);
        setTimeout(() => {
          play("returnPing", 1, 0.5);
          setFinale("done");
        }, 2500);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (finale !== "done") return;
    const kg = game.current.kg;
    const stars = kg >= APOLLO_KG ? 3 : kg >= 16 ? 2 : kg >= 10 ? 1 : 0;
    const t = setTimeout(() => onDone(kg, stars), 5200);
    return () => clearTimeout(t);
  }, [finale, onDone]);

  const g = game.current;
  const b = boxRect(),
    bin = binRect();
  const pct = Math.min(1, hud.kg / APOLLO_KG);
  const mm = Math.floor(hud.left / 60),
    ss = String(hud.left % 60).padStart(2, "0");
  return (
    <div className={`rockbox ${camera ? "with-camera" : "no-camera"}`} data-glove-ignore>
      {camera ? (
        <LiveCamera className="rb-video" />
      ) : (
        <div className="rb-backdrop" aria-hidden="true">
          <i className="rb-earthling" />
          <i className="rb-ridge" />
        </div>
      )}
      <Canvas className="rb-canvas" orthographic gl={{ alpha: true, antialias: true }} dpr={[1, 1.5]}>
        <OrthoRig />
        <ambientLight intensity={0.6} />
        <directionalLight position={[-200, 300, 300]} intensity={1.6} color="#FFE9CF" />
        {!finale && <Objects game={game} />}
      </Canvas>
      {!finale && (
        <>
          <div className="rb-box" style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
            <span className="rb-lid" aria-hidden="true" />
            <span>Rock Box</span>
            {puff > 0 && <i key={puff} className="rb-puff" aria-hidden="true" />}
          </div>
          {g.t >= 28 && (
            <div className="rb-bin" style={{ left: bin.x, top: bin.y, width: bin.w, height: bin.h }}>
              <span>Back to Earth</span>
              <small>+2 seconds</small>
            </div>
          )}
          <div className="rb-tag rb-kg">
            <span>
              {hud.kg.toFixed(1)} kg / {APOLLO_KG} kg
            </span>
            <i>
              <b style={{ width: `${pct * 100}%` }} />
            </i>
            <small>Apollo 11's real total</small>
          </div>
          <div className="rb-tag rb-clock" aria-label={`${hud.left} seconds of moonwalk left`}>
            <small>Moonwalk</small>
            <span>
              {mm}:{ss}
            </span>
          </div>
          {hud.tag && <div className="rb-tag rb-held">{hud.tag}</div>}
          {hud.msg && <div className="paper-card rb-msg">{line(hud.msg).text}</div>}
        </>
      )}
      {camera && useInput.getState().debug && (
        <span className="rb-debug mono">
          {inference.toFixed(1)} ms · {trackerFps.toFixed(0)} fps
        </span>
      )}
      {pops.map((p) => (
        <span key={p.id} className="rb-pop" style={{ left: p.x, top: p.y }} aria-hidden="true">
          {p.text}
        </span>
      ))}
      {brief >= 0 && (
        <HowTo
          id="rockbox"
          kicker="Game · Fill the Rock Box"
          title="Catch Moon rocks!"
          goal="Apollo 11 brought home about 21.5 kg of Moon rocks. Can you fill the box too?"
          voice="Catch Moon rocks! Touch a rock to the Rock Box. Things from Earth go in the blue bin."
          steps={[
            { icon: camera ? "✊" : "🖱️", text: camera ? "Close your hand on a rock" : "Grab a rock" },
            { icon: "📦", text: "Touch it to the Rock Box" },
            { icon: "🌍", text: "Earth things go in the blue bin" },
          ]}
          onStart={() => setBrief(-1)}
        />
      )}
      {/* the hand cursor: a thin cream ring that fills sage while grabbing */}
      <div ref={cursor} className="rb-cursor" aria-hidden="true" />
      {finale && (
        <div className="rb-finale">
          <div className="rb-earth" aria-hidden="true" />
          <div className="rb-reflector" style={{ ["--hold" as string]: hold }} aria-label="The laser reflector">
            <i />
          </div>
          {(finale === "fire" || finale === "back") && (
            <svg className="rb-laser" width="100%" height="100%" aria-hidden="true">
              <line x1="88%" y1="12%" x2="50%" y2="55%" className={finale} />
              {finale === "back" && <circle r="6" className="rb-dot" />}
            </svg>
          )}
          {finale === "aim" && <div className="paper-card rb-msg">{line("g-laser").text}</div>}
          {finale === "done" && (
            <div className="paper-card rb-laser-card">
              <p>{line("g-laser-time").text}</p>
              <p>{line("g-laser-dist").text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
