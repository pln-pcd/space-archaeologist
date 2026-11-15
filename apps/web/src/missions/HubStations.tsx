// SHIP STATIONS (v7): the room no longer has floor props. A dock on the dashboard opens game panels:
// Collection (the earned Space Archive), Logbook (saved investigations) and Badges (stars, points and
// mission badges). Every panel has a close button and Esc.
import { useEffect, useState, type ReactNode } from "react";
import { X, BookOpen, Award, Gem, Lock, Star } from "lucide-react";
import { intents } from "../input/bus";
import { play } from "../audio/sfx";
import { useMission } from "./session";
import { MOON } from "./registry";
import { PLAYER_ROLE } from "./constants";
import { FactText } from "./ui";
import Archive from "./Archive";
import EvidenceBoard from "./EvidenceBoard";
import "./passport.css";
import { useStore } from "../store";

export const STATIONS = [
  ["board", "Mission Board"],
  ["archive", "Collection"],
  ["records", "Logbook"],
  ["wardrobe", "Explorer"],
  ["chart", "Badges"],
  ["nova", "Talk with Nova"],
] as const;
export type StationId = (typeof STATIONS)[number][0];
export const visitStation = (id: string) => intents.emit("hubStation", { id }, intents.lastSource);

/** the shared game panel frame: icon + title header, close button, body that scrolls only if needed */
export function GamePanel({ title, icon, onClose: closeNow, children, wide = false, label }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; label?: string }) {
  // slide out, then close (no zoom)
  const [closing, setClosing] = useState(false);
  const onClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(closeNow, document.documentElement.classList.contains("reduced-motion") ? 0 : 220);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  return (
    <div className={`g-scrim od-free ${closing ? "closing" : ""}`} role="dialog" aria-modal="true" aria-label={label ?? title} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`g-panel gp ringed ${wide ? "wide" : ""}`}>
        <div className="pp-rings" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <header className="gp-head">
          {icon && <span className="gp-icon">{icon}</span>}
          <h2>{title}</h2>
          <button type="button" className="g-icon-btn coral" aria-label="Close" onClick={() => (play("soft", 1, 0.5), onClose())} autoFocus>
            <X size={26} strokeWidth={3} />
          </button>
        </header>
        <div className="gp-body">{children}</div>
      </section>
    </div>
  );
}

const BADGES = [
  { id: "first-steps", name: "First Steps", hint: "Start your first mission" },
  { id: "moon", name: "Moon Archaeologist", hint: "Finish the Moon mission" },
  { id: "mars", name: "Mars Friend", hint: "Finish the Mars mission" },
  { id: "collector", name: "Collector", hint: "Save 4 Moon records" },
  { id: "curious", name: "Curious Mind", hint: "Ask Nova 5 questions" },
  { id: "stars", name: "Star Hunter", hint: "Earn 3 stars on a mission" },
];

function Badges() {
  const s = useMission(MOON);
  const progress = useStore((st) => st.progress);
  const asked = useStore((st) => st.settings.novaAsked ?? 0);
  const earned: Record<string, boolean> = {
    "first-steps": s.step > 4 || s.rewarded || progress.completed.length > 0,
    moon: s.rewarded || progress.completed.includes("eagle"),
    mars: progress.completed.includes("opportunity"),
    collector: s.records.length >= MOON.artifacts.length,
    curious: asked >= 5,
    stars: s.stars >= 3 || Object.values(progress.scores).some((v) => v >= 3),
  };
  return (
    <>
      <div className="gp-stats">
        <div className="gp-stat sun">
          <Star size={30} fill="#FFD23F" strokeWidth={2.4} />
          <b>{s.stars + Object.values(progress.scores).reduce((a, b) => a + b, 0)}</b>
          <small>stars</small>
        </div>
        <div className="gp-stat sky">
          <Gem size={30} strokeWidth={2.4} />
          <b>{s.points}</b>
          <small>discovery points</small>
        </div>
        <div className="gp-stat mint">
          <Award size={30} strokeWidth={2.4} />
          <b>{Object.values(earned).filter(Boolean).length}</b>
          <small>badges</small>
        </div>
      </div>
      <p className="gp-rank">{PLAYER_ROLE}</p>
      <ul className="gp-badges">
        {BADGES.map((b) => (
          <li key={b.id} className={earned[b.id] ? "on" : ""}>
            <span className="gp-medal" aria-hidden="true">
              {earned[b.id] ? <Award size={34} strokeWidth={2.2} /> : <Lock size={26} strokeWidth={2.4} />}
            </span>
            <strong>{b.name}</strong>
            <small>{earned[b.id] ? "Earned!" : b.hint}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

export function StationMenu({ station, onClose }: { station: StationId | "menu"; onClose: () => void }) {
  const state = useMission(MOON);
  const [review, setReview] = useState<string | null>(null);
  const record = MOON.artifacts.find((a) => a.id === review && state.records.includes(a.id));
  if (station === "records" && record)
    return (
      <GamePanel title="Evidence board" icon={<BookOpen size={26} />} onClose={() => setReview(null)} wide label="Saved evidence board">
        <EvidenceBoard mission={MOON} artifact={record} state={state} review />
      </GamePanel>
    );
  if (station === "archive")
    return (
      <GamePanel title="Collection" icon={<Gem size={26} />} onClose={onClose} wide label="Ship archive">
        <Archive mission={MOON} state={state} embedded onClose={onClose} />
      </GamePanel>
    );
  if (station === "records")
    return (
      <GamePanel title="Logbook" icon={<BookOpen size={26} />} onClose={onClose}>
        {state.records.length ? (
          <ul className="gp-log">
            {state.records.map((id) => {
              const a = MOON.artifacts.find((x) => x.id === id)!;
              const pinned = (state.evidence[id] ?? []).filter((e) => !e.startsWith("pair:")).length;
              return (
                <li key={id}>
                  <div>
                    <strong>
                      <FactText line={a.name} compact />
                    </strong>
                    <small>{pinned} evidence cards pinned</small>
                  </div>
                  <button type="button" className="g-btn sky" aria-label={`Review evidence ${a.id}`} onClick={() => setReview(a.id)}>
                    Open
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="gp-empty">Your finished investigations will appear here. Go explore the Moon!</p>
        )}
      </GamePanel>
    );
  return (
    <GamePanel title="Badges" icon={<Award size={26} />} onClose={onClose}>
      <Badges />
    </GamePanel>
  );
}
