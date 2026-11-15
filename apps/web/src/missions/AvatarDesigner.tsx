// THE EXPLORER DESIGNER (v7): a dressing-room screen. Left: the chibi explorer on a glowing turntable
// (drag to spin). Right: icon tabs and tiles that show the REAL part (rendered helmets, hair, visors,
// suits, extras). No voice here: quiet clicks and sparkles only. Fits one desktop screen, no scrolling.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ArrowLeft, Check, Dices, Glasses, HardHat, Palette, Scissors, Shirt, Smile, Sparkles, Eye, EyeOff } from "lucide-react";
import { intents, useIntent, useIntentScope } from "../input/bus";
import { AdaptiveDpr } from "../fx/AdaptiveDpr";
import { OutlineSync } from "../fx/outline";
import { play } from "../audio/sfx";
import { cute } from "../audio/cute";
import { motion } from "../anim/kit";
import { useStore } from "../store";
import { ExplorerAvatar } from "./ExplorerAvatar";
import { burst } from "../odyssey/ui/kit";
import { blobTexture } from "../odyssey/look";
import { partThumb, type ThumbKind } from "../characters/chibiThumbs";
import { chibiAct, newChibiDriver, type ChibiDriver } from "../characters/Chibi";
import {
  DEFAULT_AVATAR,
  useAvatar,
  saveAvatar,
  SUIT_COLORS,
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
  ACCESSORIES,
  VISORS,
  HELMETS,
  randomAvatar,
  chibiLook,
  type AvatarConfig,
} from "./avatar";
import "./designer.css";
import { useWarpReady } from "../odyssey/fx/Warp";

type Control = "suitColor" | "helmet" | "visor" | "hair" | "hairColor" | "skin" | "accessory";
const TABS: { key: Control; name: string; icon: typeof Shirt; thumb: ThumbKind; helmet: boolean }[] = [
  { key: "suitColor", name: "Suit", icon: Shirt, thumb: "suit", helmet: true },
  { key: "helmet", name: "Helmet", icon: HardHat, thumb: "helmet", helmet: true },
  { key: "visor", name: "Visor", icon: Glasses, thumb: "visor", helmet: true },
  { key: "hair", name: "Hair", icon: Scissors, thumb: "hair", helmet: false },
  { key: "hairColor", name: "Colour", icon: Palette, thumb: "hairColor", helmet: false },
  { key: "skin", name: "Skin", icon: Smile, thumb: "skin", helmet: false },
  { key: "accessory", name: "Extras", icon: Sparkles, thumb: "accessory", helmet: false },
];
const HAIR_NAMES: Record<string, string> = { "messy-flick": "Spiky", "bob-messy": "Bob", "wavy-flick": "Wavy", ponytail: "Ponytail", curls: "Curls", crew: "Short", bun: "Bun" };
const NAMES: Partial<Record<Control, string[]>> = {
  suitColor: ["Teal", "Sky", "Tangerine", "Lilac", "Sunny", "Snow", "Rose", "Navy"],
  helmet: HELMETS,
  visor: ["Gold", "Ice", "Violet", "Mint", "Pink"],
  hair: HAIR_STYLES.map((h) => HAIR_NAMES[h] ?? h),
  hairColor: ["Cocoa", "Ink", "Chestnut", "Ginger", "Honey", "Lilac", "Blue"],
  skin: SKIN_TONES.map((_, i) => `Tone ${i + 1}`),
  accessory: ACCESSORIES,
};
const COUNT: Record<Control, number> = { suitColor: SUIT_COLORS.length, helmet: HELMETS.length, visor: VISORS.length, hair: HAIR_STYLES.length, hairColor: HAIR_COLORS.length, skin: SKIN_TONES.length, accessory: ACCESSORIES.length };
const valueFor = (c: Control, i: number): string | number =>
  c === "suitColor" ? SUIT_COLORS[i] : c === "visor" ? VISORS[i] : c === "hair" ? HAIR_STYLES[i] : c === "hairColor" ? HAIR_COLORS[i] : c === "skin" ? SKIN_TONES[i] : i;

/** drag to spin the explorer; it eases back toward the front when let go */
function Turntable({ children, spin }: { children: React.ReactNode; spin: React.MutableRefObject<{ v: number; a: number; drag: boolean }> }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const s = spin.current;
    if (!s.drag) {
      s.v *= Math.pow(0.04, dt);
      if (Math.abs(s.v) < 0.05) s.a += (Math.round(s.a / (Math.PI * 2)) * Math.PI * 2 - s.a) * Math.min(1, dt * 2.2);
    }
    s.a += s.v * dt;
    if (g.current) g.current.rotation.y = s.a + (motion.reduced ? 0 : Math.sin(performance.now() / 2400) * 0.12);
  });
  return <group ref={g}>{children}</group>;
}

function Stage({ config, bounce, helmetOn, driver }: { config: AvatarConfig; bounce: number; helmetOn: boolean; driver: React.MutableRefObject<ChibiDriver> }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ring.current && !motion.reduced) ring.current.rotation.z = s.clock.elapsedTime * 0.3;
  });
  return (
    <>
      <hemisphereLight args={["#FFF6E8", "#9C8FE0", 1.5]} />
      <directionalLight position={[2.5, 4, 4]} intensity={2.4} />
      <directionalLight position={[-3, 2, -2]} intensity={1.1} color="#BFE0FF" />
      {/* platform */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.72, 0.78, 0.12, 48]} />
        <meshToonMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.66, 48]} />
        <meshBasicMaterial color="#C9BBFF" />
      </mesh>
      <mesh ref={ring} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.56, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} opacity={0.45} />
      </mesh>
      <ExplorerAvatar config={config} bounce={bounce} helmetOn={helmetOn} driver={driver} />
    </>
  );
}

export default function AvatarDesigner({ onDone, playground = false }: { onDone: () => void; playground?: boolean }) {
  const stored = useAvatar((s) => s.config);
  const profile = useStore((s) => s.profile);
  const [draft, setDraft] = useState<AvatarConfig>(stored ?? DEFAULT_AVATAR);
  const [tab, setTab] = useState<Control>("suitColor");
  const [helmetOn, setHelmet] = useState(true);
  const [bounce, setBounce] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const driver = useRef<ChibiDriver>(newChibiDriver());
  const spin = useRef({ v: 0, a: 0, drag: false });
  const drag = useRef<{ x: number; t: number } | null>(null);
  useIntentScope([], { walk: false }, "avatar-designer");
  useWarpReady();

  const meta = TABS.find((t) => t.key === tab)!;
  const look = useMemo(() => chibiLook(draft, helmetOn), [draft, helmetOn]);

  // make the tile previews for this tab a moment after the tab opens (never blocks the click)
  useEffect(() => {
    let alive = true;
    setThumbs([]);
    const out: string[] = [];
    const n = COUNT[tab];
    let i = 0;
    const step = () => {
      if (!alive) return;
      const t0 = performance.now();
      while (i < n && performance.now() - t0 < 24) out[i] = partThumb(meta.thumb, valueFor(tab, i), { ...look, helmetOn: true }), i++;
      setThumbs([...out]);
      if (i < n) setTimeout(step, 0);
    };
    const t = setTimeout(step, 30);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // previews depend on the other parts only, not on the picked value of this tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, look.suit, look.skin, look.hair, look.hairColor, look.helmet, look.visor]);

  useIntent("avatarAction", (e) => {
    if (celebrate) return;
    if (e.action === "tab" && TABS.some((t) => t.key === e.value)) {
      const t = TABS.find((x) => x.key === e.value)!;
      setTab(t.key);
      setHelmet(t.helmet);
      play("tick", 1.2, 0.4);
    }
    if (e.action === "pick") {
      setDraft((a) => ({ ...a, [tab]: Number(e.value) }));
      setBounce((n) => n + 1);
      cute.pop(1 + Number(e.value) * 0.06);
    }
    if (e.action === "random") {
      setDraft(randomAvatar());
      setBounce((n) => n + 1);
      cute.magic();
      spin.current.v = 9;
    }
    if (e.action === "helmet") setHelmet((h) => !h);
    if (e.action === "confirm") {
      setCelebrate(true);
      setHelmet(true);
      chibiAct(driver.current, "cheer");
      cute.fanfare();
      const r = document.querySelector(".dz-stage")?.getBoundingClientRect();
      if (r) for (let k = 0; k < 4; k++) setTimeout(() => burst(r.left + r.width * (0.3 + Math.random() * 0.4), r.top + r.height * (0.25 + Math.random() * 0.3), 10), k * 140);
      saveAvatar(draft);
      useStore.getState().updateProfile({ characterId: draft.base });
      setTimeout(() => (playground ? setCelebrate(false) : onDone()), motion.reduced ? 600 : 1700);
    }
  });
  const emit = (action: string, value = "") => intents.emit("avatarAction", { action, value }, intents.lastSource);
  // keyboard: arrows pick, Tab switches, Enter confirms (handled by focused buttons)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const n = COUNT[tab];
        const cur = Number(draft[tab] ?? 0);
        emit("pick", String((cur + (e.key === "ArrowRight" ? 1 : -1) + n) % n));
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  const names = NAMES[tab] ?? [];
  return (
    <section className="dz od-free" aria-label="Design your explorer" data-celebrate={celebrate ? "1" : "0"}>
      <div className="dz-sky" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, animationDelay: `${(i % 6) * 0.7}s` }} />
        ))}
      </div>
      <header className="dz-top">
        {stored && !playground ? (
          <button type="button" className="g-icon-btn" aria-label="Back to the ship without changes" onClick={() => (play("soft", 1, 0.5), onDone())}>
            <ArrowLeft size={26} strokeWidth={2.6} />
          </button>
        ) : (
          <span />
        )}
        <h1 className="g-title">Design your explorer</h1>
      </header>

      <div className="dz-stage">
        <div
          className="dz-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, t: performance.now() };
            spin.current.drag = true;
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x;
            const dtm = Math.max(1, performance.now() - drag.current.t);
            spin.current.a += dx * 0.012;
            spin.current.v = (dx * 0.012 * 1000) / dtm;
            drag.current = { x: e.clientX, t: performance.now() };
          }}
          onPointerUp={() => ((drag.current = null), (spin.current.drag = false))}
          onPointerCancel={() => ((drag.current = null), (spin.current.drag = false))}
        >
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.82, 3.25], fov: 30 }} gl={{ toneMapping: THREE.NoToneMapping, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.52, 0)} aria-label="Your explorer. Drag to spin.">
            <Turntable spin={spin}>
              <Stage config={draft} bounce={bounce} helmetOn={helmetOn} driver={driver} />
            </Turntable>
            <AdaptiveDpr />
            <OutlineSync />
          </Canvas>
        </div>
        <div className="dz-plate">
          <span className="dz-name">{profile?.playerName ?? profile?.playerPatch ?? "Explorer"}</span>
          <small>Space Archaeologist</small>
        </div>
        <button type="button" className="g-icon-btn dz-helmet" aria-pressed={helmetOn} aria-label={helmetOn ? "Take the helmet off" : "Put the helmet on"} onClick={() => (emit("helmet"), play("pop", 0.9, 0.4))}>
          {helmetOn ? <EyeOff size={24} strokeWidth={2.6} /> : <Eye size={24} strokeWidth={2.6} />}
          <span>{helmetOn ? "Helmet off" : "Helmet on"}</span>
        </button>
        <p className="dz-hint" aria-hidden="true">
          Drag to spin
        </p>
      </div>

      <div className="dz-panel g-panel">
        <nav className="dz-tabs" aria-label="Parts">
          {TABS.map((t) => (
            <button key={t.key} type="button" className="dz-tab" aria-pressed={tab === t.key} onClick={() => emit("tab", t.key)} disabled={celebrate}>
              <t.icon size={26} strokeWidth={2.4} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          ))}
        </nav>
        <div className="dz-grid" role="radiogroup" aria-label={meta.name} data-count={COUNT[tab]}>
          {Array.from({ length: COUNT[tab] }, (_, i) => {
            const v = valueFor(tab, i);
            const on = Number(draft[tab] ?? 0) === i;
            const src = thumbs[i];
            return (
              <button
                key={`${tab}${i}`}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${meta.name}: ${names[i] ?? i + 1}`}
                className="dz-tile"
                disabled={celebrate}
                onClick={(e) => {
                  emit("pick", String(i));
                  burst(e.clientX || e.currentTarget.getBoundingClientRect().left + 40, e.clientY || e.currentTarget.getBoundingClientRect().top + 40, 5);
                }}
                style={{ ["--tile" as string]: typeof v === "string" && v.startsWith("#") ? v : undefined }}
              >
                <span className="dz-thumb">
                  {src ? <img src={src} alt="" draggable={false} /> : tab === "accessory" && i === ACCESSORIES.length - 1 ? <b className="dz-none">✕</b> : <i className="dz-spin" />}
                </span>
                <span className="dz-label">{names[i] ?? i + 1}</span>
                {on && (
                  <span className="dz-check" aria-hidden="true">
                    <Check size={16} strokeWidth={3.4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="dz-actions">
          <button type="button" className="g-btn" onClick={() => emit("random")} disabled={celebrate}>
            <Dices size={24} strokeWidth={2.4} aria-hidden="true" />
            Surprise me
          </button>
          <button type="button" className="g-btn primary big" onClick={() => emit("confirm")} disabled={celebrate}>
            <Check size={26} strokeWidth={3} aria-hidden="true" />
            {stored ? "Save look" : "I'm ready!"}
          </button>
        </div>
      </div>
      {celebrate && (
        <div className="dz-yay" role="status">
          Looking great!
        </div>
      )}
    </section>
  );
}
