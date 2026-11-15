// Settings (gear icon, top-right everywhere) and Credits (new-flow prompt §3, §10).
import { useEffect, useState } from "react";
import { Check, Keyboard, MessageCircle, Mic, Music, RotateCcw, Settings as GearIcon, Snail, Sparkles, Trash2, Type, Volume1, Volume2, X } from "lucide-react";
import { useStore, type Settings } from "../../store";

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="od-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, set }: { label: string; value: T; options: [T, string][]; set: (v: T) => void }) {
  return (
    <div className="od-seg" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => set(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** one big icon toggle tile (game-style), pressed = on */
function Tile({ icon: Icon, label, on, set, tone = "mint" }: { icon: typeof Volume2; label: string; on: boolean; set: (v: boolean) => void; tone?: string }) {
  return (
    <button type="button" className={`st-tile ${tone} ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set(!on)}>
      <span className="st-tile-ico" aria-hidden="true">
        <Icon size={24} strokeWidth={2.5} />
      </span>
      <span className="st-tile-label">{label}</span>
      <span className="st-tile-state" aria-hidden="true">{on ? "ON" : "OFF"}</span>
    </button>
  );
}

/** slide-out close: plays the exit animation, then closes */
export function useSlideClose(onClose: () => void, ms = 240) {
  const [out, setOut] = useState(false);
  const close = () => {
    if (out) return;
    setOut(true);
    setTimeout(onClose, motionReduced() ? 0 : ms);
  };
  return { out, close };
}
const motionReduced = () => document.documentElement.classList.contains("reduced-motion");

export function SettingsPanel({ onClose, onForget, onIntro }: { onClose: () => void; onForget: () => void; onIntro?: () => void }) {
  const s = useStore((st) => st.settings);
  const configure = useStore((st) => st.configure);
  const [ask, setAsk] = useState(false);
  const [grownUp, setGrownUp] = useState("");
  const c = (p: Partial<Settings>) => configure(p);
  const { out, close } = useSlideClose(onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  const sizes: NonNullable<Settings["textSize"]>[] = ["normal", "large", "larger"];
  const size = s.textSize ?? "normal";
  return (
    <div className={`st-scrim ${out ? "out" : ""}`} role="dialog" aria-modal="true" aria-label="Settings" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className="st">
        <header className="st-head">
          <span className="st-badge" aria-hidden="true">
            <GearIcon size={26} strokeWidth={2.4} />
          </span>
          <h2>Settings</h2>
          <button type="button" className="st-x" onClick={close} aria-label="Close settings">
            <X size={24} strokeWidth={3.2} />
          </button>
        </header>
        {!ask ? (
          <div className="st-body">
            <h3>Sound</h3>
            <div className="st-tiles">
              <Tile icon={Volume2} label="Sounds" on={s.sound !== false} set={(v) => c({ sound: v })} tone="sky" />
              <Tile icon={Music} label="Music" on={s.music !== false} set={(v) => c({ music: v })} tone="pink" />
              <Tile icon={MessageCircle} label="Nova talks" on={s.novaVoice !== false} set={(v) => c({ novaVoice: v })} tone="sun" />
            </div>
            <label className="st-slider">
              <Volume1 size={20} aria-hidden="true" />
              <input type="range" min={0} max={1} step={0.05} value={s.novaVolume ?? 0.9} onChange={(e) => c({ novaVolume: +e.target.value })} aria-label="Nova's volume" style={{ ["--v" as string]: `${(s.novaVolume ?? 0.9) * 100}%` }} />
              <Volume2 size={20} aria-hidden="true" />
            </label>
            <h3>Talk with Nova</h3>
            <div className="st-seg" role="radiogroup" aria-label="Talk with Nova">
              <button type="button" role="radio" aria-checked={(s.talkMode ?? "chat") === "voice"} onClick={() => c({ talkMode: "voice", mic: true })}>
                <Mic size={20} /> My voice
              </button>
              <button type="button" role="radio" aria-checked={(s.talkMode ?? "chat") === "chat"} onClick={() => c({ talkMode: "chat" })}>
                <Keyboard size={20} /> Typing
              </button>
            </div>
            <div className="st-tiles two">
              <Tile icon={Mic} label="Microphone" on={s.mic !== false} set={(v) => c({ mic: v })} tone="sky" />
              <Tile icon={Sparkles} label="AI helper" on={s.askNova !== false} set={(v) => c({ askNova: v })} tone="lilac" />
            </div>
            <h3>Comfort</h3>
            <div className="st-tiles">
              <Tile icon={Type} label="Easy font" on={!!s.dyslexia} set={(v) => c({ dyslexia: v })} tone="sun" />
              <Tile icon={Snail} label="Calm motion" on={!!s.reducedMotion} set={(v) => c({ reducedMotion: v })} tone="mint" />
              <button type="button" className="st-tile on lilac" onClick={() => { const n = sizes[(sizes.indexOf(size) + 1) % 3]; c({ textSize: n, largeText: n !== "normal" }); }} aria-label={`Text size: ${size}. Press to change`}>
                <span className="st-tile-ico" aria-hidden="true">
                  <b className="st-aa">{size === "normal" ? "A" : size === "large" ? "A+" : "A++"}</b>
                </span>
                <span className="st-tile-label">Text size</span>
                <span className="st-tile-state" aria-hidden="true">TAP</span>
              </button>
            </div>
            <div className="st-foot">
              <button type="button" className="g-btn" onClick={() => (c({ tutorialDone: false }), close())}>
                <RotateCcw size={18} /> Tutorial
              </button>
              {onIntro && (
                <button type="button" className="g-btn" onClick={onIntro}>
                  <Sparkles size={18} /> Intro
                </button>
              )}
              <button type="button" className="g-btn st-reset" onClick={() => setAsk(true)}>
                <Trash2 size={18} /> Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="st-body st-forget">
            <h3>For grown-ups</h3>
            <p>Forget the name, stars and stamps on this computer? This can't be undone.</p>
            <label>
              What is 8 + 5?
              <input className="st-input" aria-label="Grown-up answer" inputMode="numeric" value={grownUp} onChange={(e) => setGrownUp(e.target.value)} autoFocus />
            </label>
            <div className="st-foot">
              <button type="button" className="g-btn" onClick={() => setAsk(false)}>
                Keep it
              </button>
              <button type="button" className="g-btn coral" disabled={grownUp.trim() !== "13"} onClick={onForget}>
                Forget everything
              </button>
            </div>
          </div>
        )}
        <button type="button" className="g-btn primary big st-done" onClick={close}>
          <Check size={22} strokeWidth={3} /> Done
        </button>
      </section>
    </div>
  );
}

export function CreditsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="od-modal" role="dialog" aria-label="Credits">
      <div className="od-card od-panel od-credits">
        <button type="button" className="od-icon-btn od-x" onClick={onClose} aria-label="Close credits">
          <X size={30} />
        </button>
        <h2>Credits</h2>
        <div className="od-panel-body">
          <p>Made for NASA Space Apps 2026. Not endorsed by NASA.</p>
          <ul>
            <li>Mission films, photos and audio: NASA (public domain).</li>
            <li>Nova's answers: Google Gemini, with local space facts and safety rules. Chats are never saved.</li>
            <li>Nova's voice: Kokoro-82M text-to-speech (Apache-2.0), run on this computer.</li>
            <li>Nova's ears: Whisper speech models (MIT) through faster-whisper (MIT) on this computer, or transformers.js (Apache-2.0) in the browser.</li>
            <li>Story animation: HyperFrames (Apache-2.0).</li>
            <li>Fonts: Bigelow Rules, Lexend, OpenDyslexic (SIL Open Font License).</li>
            <li>Hand tracking: Google MediaPipe (Apache-2.0). 3D: three.js, React Three Fiber, drei (MIT).</li>
            <li>Nova, the explorer, the ship, the rooms, the music (Tone.js, MIT) and the sound effects (ZzFX, MIT): made in code.</li>
          </ul>
          <p className="od-small">The full list is in CREDITS.md.</p>
        </div>
        <button type="button" className="od-btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
