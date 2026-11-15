import { useWarpReady } from "../fx/Warp";
// NAME CARD (first time only, new-flow prompt §4): "Hi, explorer! What's your name?" with Nova peeking
// over the card's top edge. Reuses the existing name rules (length, characters, profanity filter),
// Random name and local-only saving. Enter submits; game keys are off while typing.
import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { checkName, randomName, NAME_MAX } from "../../profile/name";
import { play } from "../../audio/sfx";
import NovaStage from "../nova/NovaStage";
import { nova } from "../nova/state";

export default function NameCard({ onDone }: { onDone: (name: string, patch: string) => void }) {
  useWarpReady();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nova.feel("curious");
    const t = setTimeout(() => box.current?.focus({ preventScroll: true }), 600);
    return () => clearTimeout(t);
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
  return (
    <div className="od-screen od-name">
      <div className="od-name-wrap">
        <NovaStage frame="peek" className="od-peek" enter="bottom" float={false} />
        <form
          className="od-card od-namecard"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>Hi, explorer! What's your name?</h2>
          <input
            ref={box}
            className="od-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={NAME_MAX + 6}
            placeholder="Your explorer name"
            aria-label="Your explorer name"
            aria-describedby="od-name-hint od-name-msg"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
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
          <div className="od-row">
            <button
              type="button"
              className="od-btn"
              onClick={() => {
                setValue(randomName(value));
                setMsg("");
                nova.act("spin");
                play("pageFlip");
                box.current?.focus();
              }}
            >
              <Dices size={28} strokeWidth={2} aria-hidden="true" /> Random name
            </button>
            <button type="submit" className="od-btn primary">
              Let's go!
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
