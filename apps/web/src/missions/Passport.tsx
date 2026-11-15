// EXPLORER PASSPORT (v7.2): who you are and everything you've collected, in one game panel.
// Containers (inspired by cozy profile apps, drawn in our own game style):
//   1 PROFILE CARD   a rendered portrait of your explorer, name, rank, explorer ID, and three tabs
//                    (About · Stats · Look) that swap the card's lower half
//   2 STREAK CARD    days you have explored (kept on this device), with a sun medal
//   3 BINDERS        ring-binder cards with a clip strip on top: Moon finds (real NASA photos once
//                    found), Badges, and Missions; each slot shows what it is or a "?" until earned
import { useMemo, useState } from "react";
import { Award, Check, ChevronRight, Copy, Gem, Lock, Rocket, Shirt, Star, X } from "lucide-react";
import { useStore } from "../store";
import { useAvatar, DEFAULT_AVATAR, chibiLook } from "./avatar";
import { explorerPortrait } from "../characters/chibiThumbs";
import { useMission } from "./session";
import { MOON } from "./registry";
import { PLAYER_ROLE } from "./constants";
import { cute } from "../audio/cute";
import "./passport.css";

const BADGES = [
  { id: "first-steps", name: "First Steps" },
  { id: "moon", name: "Moon Archaeologist" },
  { id: "mars", name: "Mars Friend" },
  { id: "collector", name: "Collector" },
  { id: "curious", name: "Curious Mind" },
  { id: "stars", name: "Star Hunter" },
];

function Binder({ title, icon, children, tone = "lilac", note }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: string; note?: string }) {
  return (
    <section className={`pp-binder ${tone}`}>
      <div className="pp-rings" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <header>
        <span className="pp-binder-ico" aria-hidden="true">
          {icon}
        </span>
        <h3>{title}</h3>
        {note && <small>{note}</small>}
      </header>
      <div className="pp-slots">{children}</div>
    </section>
  );
}

export default function Passport({ onClose, onWardrobe }: { onClose: () => void; onWardrobe: () => void }) {
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const progress = useStore((s) => s.progress);
  const avatar = useAvatar((s) => s.config) ?? DEFAULT_AVATAR;
  const moon = useMission(MOON);
  const [tab, setTab] = useState<"about" | "stats" | "look">("about");
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const portrait = useMemo(() => explorerPortrait(chibiLook(avatar, true)), [avatar]);
  const days = settings.playDays?.length ?? 1;
  const id = (profile?.code ?? "explorer").replace(/^device-/, "").toUpperCase().slice(-8);
  const stars = moon.stars + Object.values(progress.scores).reduce((a, b) => a + b, 0);
  const earned: Record<string, boolean> = {
    "first-steps": moon.step > 4 || moon.rewarded || progress.completed.length > 0,
    moon: moon.rewarded || progress.completed.includes("eagle"),
    mars: progress.completed.includes("opportunity"),
    collector: moon.records.length >= MOON.artifacts.length,
    curious: (settings.novaAsked ?? 0) >= 5,
    stars: moon.stars >= 3 || Object.values(progress.scores).some((v) => v >= 3),
  };
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, document.documentElement.classList.contains("reduced-motion") ? 0 : 220);
  };
  const missions = [
    { id: "eagle", name: "Moon", done: earned.moon },
    { id: "opportunity", name: "Mars", done: earned.mars },
    { id: "viking", name: "Viking 1", soon: true },
  ];
  return (
    <div className={`g-scrim od-free ${closing ? "closing" : ""}`} role="dialog" aria-modal="true" aria-label="Explorer passport" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className="pp gp wide">
        <button type="button" className="st-x pp-x" aria-label="Close" onClick={close}>
          <X size={24} strokeWidth={3.2} />
        </button>
        <div className="pp-left">
          {/* 1 profile card */}
          <article className="pp-card pp-profile">
            <i className="pp-clip" aria-hidden="true" />
            <div className="pp-top">
              <div className="pp-photo">
                <img src={portrait} alt="Your explorer" draggable={false} />
              </div>
              <div className="pp-who">
                <h2>{profile?.playerName ?? "Explorer"}</h2>
                <p>
                  {PLAYER_ROLE} · {stars} <Star size={14} fill="#FFD23F" strokeWidth={2} />
                </p>
                <small>EXPLORER ID</small>
                <button
                  type="button"
                  className="pp-id"
                  onClick={() => {
                    void navigator.clipboard?.writeText(id).catch(() => {});
                    setCopied(true);
                    cute.coin();
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {id} {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <nav className="pp-tabs" role="tablist">
              {(["about", "stats", "look"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => (setTab(t), cute.pop(1.2))}>
                  {t === "about" ? "About" : t === "stats" ? "Stats" : "My look"}
                </button>
              ))}
            </nav>
            <div className="pp-tab">
              {tab === "about" && (
                <ul className="pp-facts">
                  <li>
                    <b>Favourite topics</b>
                    <span>{settings.novaTopics?.length ? settings.novaTopics.slice(0, 3).join(" · ") : "Ask Nova anything!"}</span>
                  </li>
                  <li>
                    <b>Missions done</b>
                    <span>{progress.completed.length + (moon.rewarded && !progress.completed.includes("eagle") ? 1 : 0)} of 2</span>
                  </li>
                  <li>
                    <b>Explorer since</b>
                    <span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "today"}</span>
                  </li>
                </ul>
              )}
              {tab === "stats" && (
                <div className="pp-stats">
                  <div>
                    <Star size={22} fill="#FFD23F" />
                    <b>{stars}</b>
                    <small>stars</small>
                  </div>
                  <div>
                    <Gem size={22} />
                    <b>{moon.points}</b>
                    <small>points</small>
                  </div>
                  <div>
                    <Rocket size={22} />
                    <b>{moon.records.length}</b>
                    <small>finds</small>
                  </div>
                  <div>
                    <Award size={22} />
                    <b>{settings.novaAsked ?? 0}</b>
                    <small>questions</small>
                  </div>
                </div>
              )}
              {tab === "look" && (
                <div className="pp-look">
                  <p>Change your suit, helmet, hair and extras.</p>
                  <button type="button" className="g-btn primary" onClick={() => (close(), setTimeout(onWardrobe, 240))}>
                    <Shirt size={20} /> Change my look
                  </button>
                </div>
              )}
            </div>
          </article>
          {/* 2 streak card */}
          <article className="pp-card pp-streak">
            <span className="pp-sun" aria-hidden="true">
              <Check size={26} strokeWidth={3.5} />
            </span>
            <div>
              <h3>
                <b>{days}</b> {days === 1 ? "day" : "days"} of exploring
              </h3>
              <p>{days >= 3 ? "Your streak is shining. Keep going!" : "Come back tomorrow to grow your streak!"}</p>
            </div>
            <ChevronRight size={24} aria-hidden="true" />
          </article>
        </div>
        {/* 3 binders */}
        <div className="pp-right">
          <Binder title="Moon finds" icon={<Gem size={20} />} tone="sky" note={`${moon.records.length} / ${MOON.artifacts.length}`}>
            {MOON.artifacts.map((a) => {
              const got = moon.records.includes(a.id);
              return (
                <div key={a.id} className={`pp-slot ${got ? "got" : ""}`} title={a.name.text}>
                  {got ? <img src={a.photo.src} alt={a.name.text} /> : <span className="pp-q">?</span>}
                  <small>{got ? a.name.text : "Not found yet"}</small>
                </div>
              );
            })}
          </Binder>
          <Binder title="Badges" icon={<Award size={20} />} tone="sun" note={`${Object.values(earned).filter(Boolean).length} / ${BADGES.length}`}>
            {BADGES.map((b) => (
              <div key={b.id} className={`pp-slot badge ${earned[b.id] ? "got" : ""}`}>
                <span className="pp-medal">{earned[b.id] ? <Award size={26} /> : <Lock size={20} />}</span>
                <small>{b.name}</small>
              </div>
            ))}
          </Binder>
          <Binder title="Missions" icon={<Rocket size={20} />} tone="pink">
            {missions.map((m) => (
              <div key={m.id} className={`pp-slot mission ${m.done ? "got" : ""} ${m.soon ? "soon" : ""}`}>
                <span className={`pp-planet ${m.id}`} aria-hidden="true" />
                <small>{m.soon ? "Coming soon" : m.done ? `${m.name} ✓` : m.name}</small>
              </div>
            ))}
          </Binder>
        </div>
      </section>
    </div>
  );
}
