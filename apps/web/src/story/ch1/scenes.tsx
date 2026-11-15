// Chapter 1 DOM scenes: the book (open with click, E or tap), the NASA video (A), and the
// summary + ask (F). All paper cards; captions always on.
import { Button } from "../../odyssey/ui/kit";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { BookOpen, Footprints, Orbit, Package, Satellite, Rocket } from "lucide-react";
import { useInteractable } from "../../input/aim";
import { play } from "../../audio/sfx";
import { audio } from "../../audio/engine";
import { beat, line } from "./flow";
import { say, loadDurations } from "./voice";
import { Caption } from "./ui";

/** OPEN_BOOK: the Moon book on its paper page. One action: Open (click, E, Enter or tap). */
export function OpenBook({ onOpen }: { onOpen: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useInteractable(btn, { radius: 120 });
  useEffect(() => {
    void loadDurations();
    const k = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E" || e.key === "Enter") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const open = () => {
    play("pageFlip", 1, 0.6);
    onOpen();
  };
  return (
    <div className="ch1-scene book">
      <div className="ch1-book paper-card" role="dialog" aria-label="Chapter 1: The Moon">
        <div className="ch1-cover" aria-hidden="true">
          <small>Chapter 1</small>
          <strong>The Moon</strong>
          <svg viewBox="0 0 260 170" width="230" height="150">
            <g fill="none" stroke="#9A9C9F" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M70 70 L190 70 L200 90 L200 115 L60 115 L60 90 Z M100 70 L100 115 M160 70 L160 115" />
              <path d="M70 110 L30 160 M190 110 L230 160 M110 115 L60 160 M150 115 L200 160 M20 160 L40 160 M220 160 L240 160" />
              <path d="M95 70 L105 40 L155 40 L165 70" />
            </g>
          </svg>
          <span>Eagle · 1969</span>
        </div>
        <div className="ch1-book-copy">
          <h2>The part that stayed</h2>
          <p>Watch Apollo 11 launch, land and explore. Then play a Moon mini-game.</p>
          <button ref={btn} type="button" className="chunky primary" onClick={open}>
            Open the book
          </button>
          <small className="ch1-keys">
            <kbd>E</kbd> · Click · Tap
          </small>
        </div>
      </div>
    </div>
  );
}

/** A_VIDEO: the NASA film in a big paper card. Play / Pause, Captions, Skip. */
export function SceneVideo({ onDone, video, title = "Apollo 11 · July 1969", turn = "a-turn", speak = say, resolve = line, muted = false }: { onDone: () => void; video?: { src: string; poster: string; captions: string; credit: string }; title?: string; turn?: string; speak?: typeof say; resolve?: typeof line; muted?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const cc = true;
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const meta = video ?? beat("A").video!;
  useEffect(() => {
    // started by the click that opened the book, so the browser allows sound
    const el = v.current;
    if (!el) return;
    audio.setModal(true);
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    return () => audio.setModal(false);
  }, []);
  useEffect(() => {
    const el = v.current;
    if (!el?.textTracks[0]) return;
    el.textTracks[0].mode = cc ? "showing" : "hidden";
  }, [cc]);
  const finish = () => {
    if (ended) return;
    setEnded(true);
    v.current?.pause();
    // the film's own captions step aside so they never sit under Nova's dialogue box
    if (v.current?.textTracks[0]) v.current.textTracks[0].mode = "hidden";
    audio.setModal(false);
    void speak(turn).done.then(() => setTimeout(onDone, 300));
  };
  return (
    <div className={`ch1-scene video ${ended ? "turn" : ""}`}>
      <div className="ch1-video paper-card">
        <video ref={v} muted={muted} onError={() => setFailed(true)} src={meta.src} poster={meta.poster} playsInline preload="auto" crossOrigin="anonymous" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={finish} aria-label={`NASA film: ${title}`}>
          <track kind="captions" src={meta.captions} srcLang="en" label="English" default />
        </video>
        <div className="ch1-video-bar">
          <div>
            <strong>{title}</strong>
            <small>{meta.credit}</small>
          </div>
          <div className="ch1-video-btns">
            <Button size="sm" round onClick={() => (v.current?.paused ? void v.current.play() : v.current?.pause())} aria-label={playing ? "Pause" : "Play"} quiet>
              {playing ? <Pause size={24} strokeWidth={2.4} /> : <Play size={24} strokeWidth={2.4} />}
            </Button>
            <Button size="sm" round onClick={() => { if (v.current) { v.current.currentTime = 0; void v.current.play().catch(() => {}); } }} aria-label="Replay the video" quiet>
              <RotateCcw size={24} strokeWidth={2.4} />
            </Button>
            <Button size="sm" variant="sky" onClick={finish} aria-label="Skip the video" icon={<SkipForward size={20} strokeWidth={2.4} aria-hidden="true" />}>
              Skip
            </Button>
          </div>
        </div>
      </div>
      {failed && <p className="video-unavailable paper-card">The film is unavailable. Choose Skip to keep exploring.</p>}
      {ended && <Caption id={turn} resolve={resolve} />}
    </div>
  );
}

const ICON: Record<string, React.ReactNode> = {
  lander: <Rocket size={28} strokeWidth={1.5} />,
  boot: <Footprints size={28} strokeWidth={1.5} />,
  orbit: <Orbit size={28} strokeWidth={1.5} />,
  box: <Package size={28} strokeWidth={1.5} />,
  reflector: <Satellite size={28} strokeWidth={1.5} />,
};

/** F_SUMMARY_AND_ASK: five narrated lines, then "Ready for a mini-game?" */
export function SceneSummary({ onYes, onAgain, onShip, content = beat("F"), askId = "f-ask", speak = say, resolve = line }: { onYes: () => void; onAgain: () => void; onShip: () => void; content?: { title: string; lines: ReturnType<typeof line>[] }; askId?: string; speak?: typeof say; resolve?: typeof line }) {
  const lines = content.lines.filter((l) => l.id !== askId);
  const [shown, setShown] = useState(0);
  const [ask, setAsk] = useState(false);
  const [notYet, setNotYet] = useState(false);
  useEffect(() => {
    let alive = true;
    let voice: ReturnType<typeof say> | null = null;
    void (async () => {
      await loadDurations();
      for (let i = 0; i < lines.length && alive; i++) {
        setShown(i + 1);
        voice = speak(lines[i].id);
        await voice.done;
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!alive) return;
      setAsk(true);
      voice = speak(askId);
    })();
    return () => {
      alive = false;
      voice?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ch1-scene summary">
      <div className="ch1-summary paper-card">
        <h2>{content.title}</h2>
        <ul>
          {lines.map((l, i) => (
            <li key={l.id} className={i < shown ? "on" : ""}>
              <i aria-hidden="true">{ICON[l.icon ?? "lander"]}</i>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
        {!ask && (
          <button type="button" className="chunky quiet small" onClick={() => (setShown(lines.length), setAsk(true))}>
            Skip
          </button>
        )}
        {ask && !notYet && (
          <div className="ch1-ask">
            <p>{resolve(askId).text}</p>
            <div className="ch1-ask-btns">
              <button type="button" className="chunky primary" onClick={onYes}>
                Yes, let's play
              </button>
              <button type="button" className="chunky" onClick={() => setNotYet(true)}>
                Not yet
              </button>
            </div>
          </div>
        )}
        {notYet && (
          <div className="ch1-ask">
            <p>That's fine. What next?</p>
            <div className="ch1-ask-btns">
              <button type="button" className="chunky" onClick={onAgain}>
                <BookOpen size={22} strokeWidth={1.5} /> Watch the story again
              </button>
              <button type="button" className="chunky" onClick={onShip}>
                Back to the ship
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
