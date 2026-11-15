import { useWarpReady } from "../fx/Warp";
// NAME CARD (v8): "Hi, explorer! What's your name?" Nova (big, head and hands) rests on the card's top
// edge, never over its text. A live Explorer ID badge shows the name as it is typed. Calm starry
// backdrop (slow twinkle only). Reuses the name rules (length, characters, kind words), Random name
// and local-only saving. Enter submits; game keys are off while typing.
import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Rocket, Star } from "lucide-react";
import { checkName, randomName, NAME_MAX } from "../../profile/name";
import { play } from "../../audio/sfx";
import NovaStage from "../nova/NovaStage";
import { nova } from "../nova/state";
import { speak, stopSpeaking } from "../nova/voice";
import "./namecard.css";

const ASK = "Hi, explorer! What's your name?";

/** a calm sky: fixed stars (a few twinkle slowly), two soft planets on the horizon */
function Sky() {
  const stars = useMemo(() => {
    let s = 7;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    return Array.from({ length: 70 }, (_, i) => ({ x: r() * 100, y: r() * 78, s: 1 + r() * 2.6, tw: i % 5 === 0, d: r() * 4 }));
  }, []);
  return (
    <div className="nc-sky" aria-hidden="true">
      {stars.map((st, i) => (
        <i key={i} className={st.tw ? "tw" : ""} style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />
      ))}
      <span className="nc-planet a" />
      <span className="nc-planet b" />
      <span className="nc-hill" />
    </div>
  );
}

export default function NameCard({ onDone }: { onDone: (name: string, patch: string) => void }) {
  useWarpReady();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const [bump, setBump] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nova.feel("curious");
    const t = setTimeout(() => box.current?.focus({ preventScroll: true }), 600);
    // Nova asks out loud (live voice on this computer; reading time without sound)
    const v = setTimeout(() => {
      nova.act("wave");
      speak(ASK);
    }, 700);
    return () => (clearTimeout(t), clearTimeout(v), stopSpeaking());
  }, []);
  const submit = () => {
    const r = checkName(value);
    if (!r.ok) {
      setMsg(r.message);
      nova.feel("sorry");
      play("soft", 0.8, 0.5);
      box.current?.focus();
      return;
    }
    nova.feel("excited");
    nova.act("thumbs");
    play("chime");
    setTimeout(() => onDone(r.name, r.patch), 450);
  };
  const shown = value.trim().slice(0, NAME_MAX) || "Your name";
  return (
    <div className="od-screen od-name nc">
      <Sky />
      <div className="od-name-wrap nc-wrap">
        <NovaStage frame="peek" className="od-peek nc-peek" enter="bottom" float={false} />
        <form
          className="od-card od-namecard nc-card"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span className="nc-who">
            <Star size={14} strokeWidth={3} aria-hidden="true" /> Nova
          </span>
          <h2>{ASK}</h2>
          <div className="nc-row">
            <div className="nc-field">
              <input
                ref={box}
                className="od-input nc-input"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                maxLength={NAME_MAX + 6}
                placeholder="Type your explorer name"
                aria-label="Your explorer name"
                aria-describedby="od-name-hint od-name-msg"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setBump((b) => b + 1);
                  if (msg) setMsg(checkName(e.target.value).ok ? "" : msg);
                  nova.feel("happy");
                }}
              />
              <p id="od-name-hint" className="od-hint">
                A nickname is perfect. It stays on this computer.
              </p>
              <p id="od-name-msg" className="od-msg" role="status" aria-live="polite">
                {msg}
              </p>
            </div>
            <div className="nc-id" aria-hidden="true">
              <small>Explorer ID</small>
              <span className="nc-id-photo">
                <Rocket size={30} strokeWidth={2.4} />
              </span>
              <strong key={bump} className={value.trim() ? "set" : ""}>
                {shown}
              </strong>
              <em>Space Archaeologist</em>
            </div>
          </div>
          <div className="od-row nc-buttons">
            <button
              type="button"
              className="od-btn"
              onClick={() => {
                setValue(randomName(value));
                setBump((b) => b + 1);
                setMsg("");
                nova.act("spin");
                play("pageFlip");
                box.current?.focus();
              }}
            >
              <Dices size={26} strokeWidth={2.2} aria-hidden="true" /> Random name
            </button>
            <button type="submit" className="od-btn primary">
              <Rocket size={24} strokeWidth={2.4} aria-hidden="true" /> Let's go!
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
