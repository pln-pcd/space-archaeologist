// HOW TO PLAY (v7.5): every game opens with ONE short card before it starts: what the game is,
// three picture steps, and a big "Let's play!". Nova reads one line. Shown once per game per visit
// (Replay from the card's "?" later). Enter / Space start it.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Play } from "lucide-react";
import { speak } from "../odyssey/nova/voice";
import { cute } from "../audio/cute";
import "./howto.css";

const seen = new Set<string>();
export const howToSeen = (id: string) => seen.has(id);

export type HowToStep = { icon: string; text: string };

export default function HowTo({
  id,
  kicker,
  title,
  goal,
  steps,
  voice,
  cta = "Let's play!",
  onStart,
}: {
  id: string;
  kicker: string;
  title: string;
  goal: string;
  steps: HowToStep[];
  voice?: string;
  cta?: string;
  onStart: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const v = speak(voice ?? `${title}! ${goal}`);
    return v.stop;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = () => {
    seen.add(id);
    cute.jingle();
    onStart();
  };
  return createPortal(
    <div className="howto-scrim od-free" role="dialog" aria-modal="true" aria-label={`How to play: ${title}`}>
      <div className="howto g-panel od-free">
        <small className="howto-kicker">{kicker}</small>
        <h2>{title}</h2>
        <p className="howto-goal">{goal}</p>
        <ol className="howto-steps">
          {steps.map((s, i) => (
            <li key={i} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              <span className="howto-n">{i + 1}</span>
              <span className="howto-ico" aria-hidden="true">
                {s.icon}
              </span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <button ref={btn} type="button" className="g-btn primary big howto-go" onClick={start}>
          <Play size={22} strokeWidth={3} aria-hidden="true" /> {cta}
        </button>
      </div>
    </div>,
    document.querySelector(".od-app") ?? document.body,
  );
}
