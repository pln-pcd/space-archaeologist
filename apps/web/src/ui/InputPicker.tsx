// First launch: three big cards (bible Prompt 2 item 10). Switch any time in Settings.
import { useRef } from "react";
import { useInteractable } from "../input/aim";
import { useInput, type InputMode } from "../input/store";
import { play } from "../audio/sfx";
import { HandSvg } from "./HandDemo";

const CARDS: { id: InputMode; title: string; line: string }[] = [
  { id: "touch", title: "Touch", line: "Tap and swipe the screen." },
  { id: "mouse", title: "Mouse & Keys", line: "Click, and use the keyboard." },
];

function Card({ c, onPick }: { c: (typeof CARDS)[number]; onPick: (m: InputMode) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useInteractable(ref, { radius: 90 });
  return (
    <button ref={ref} type="button" className={`pick-card pick-${c.id}`} onClick={() => onPick(c.id)}>
      <span className="pick-art" aria-hidden="true">
        {c.id === "gloves" && <HandSvg pose="open" size={92} />}
        {c.id === "touch" && <HandSvg pose="point" size={92} />}
        {c.id === "mouse" && (
          <svg viewBox="0 0 120 140" width="92" height="107">
            <rect x="30" y="20" width="60" height="96" rx="30" fill="#FBF7FF" stroke="#2B1E3F" strokeWidth="6" />
            <line x1="60" y1="22" x2="60" y2="56" stroke="#2B1E3F" strokeWidth="5" />
            <rect x="55" y="34" width="10" height="16" rx="5" fill="#9B8CE8" />
          </svg>
        )}
      </span>
      <strong>{c.title}</strong>
      <span>{c.line}</span>
    </button>
  );
}

export default function InputPicker({ onPicked }: { onPicked: (m: InputMode) => void }) {
  const set = useInput((s) => s.set);
  const pick = (m: InputMode) => {
    play("pop");
    set({ mode: m });
    onPicked(m);
  };
  return (
    <div className="odyssey-overlay picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <h2 id="picker-title">How do you want to play?</h2>
      <div className="pick-row">
        {CARDS.map((c) => (
          <Card key={c.id} c={c} onPick={pick} />
        ))}
      </div>
      <p className="overlay-foot">You can change this any time in Settings.</p>
    </div>
  );
}
