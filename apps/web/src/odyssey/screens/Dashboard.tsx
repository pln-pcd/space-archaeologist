// THE DASHBOARD (v4.6 §2–§5): the ship room with the mission wall and Nova (1.6x, beside the wall).
// First visit: Nova's hello → how do you want to talk with me? (voice / type) → the guided tutorial →
// "Let's start with the Moon". Returning players get a short welcome back. Tap Nova, press Ask Nova or
// press N to open the conversation (the room freezes, blurs and dims behind it).
// Layout rule: the mission labels, Nova's dialogue box and the Ask Nova button never overlap. The DOM
// reports the dialogue box's top edge (roomLayout.safeBottom) and the camera lifts the wall above it.
import { AdaptiveDpr } from "../../fx/AdaptiveDpr";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MessageCircle, Mic, Lock, Shirt, Gem, BookOpen, Award, X, Rocket, ArrowLeft } from "lucide-react";
import Passport from "../../missions/Passport";
import { useWarpReady } from "../fx/Warp";
import { useIntentScope } from "../../input/bus";
import { useStore } from "../../store";
import { DashboardRoom, boxAnchors, labelAnchors, roomLayout, type MissionTile } from "../scene/Room";
import { OdysseyPost } from "../Post";
import { OutlineSync } from "../../fx/outline";
import NovaCard from "../nova/NovaCard";
import Conversation from "../nova/Conversation";
import TalkChoice from "../onboard/TalkChoice";
import Tutorial from "../onboard/Tutorial";
import { closeChat, resetTalk, say, useTalk } from "../nova/talk";
import { nova, useNova } from "../nova/state";
import { prefetchClips, stopSpeaking } from "../nova/voice";
import { play } from "../../audio/sfx";
import { Button, Card } from "../ui/kit";
import "../ui/talk.css";
import { useIntent } from "../../input/bus";
import { StationMenu, visitStation, type StationId } from "../../missions/HubStations";
import "../../missions/missions.css";
import { MOON } from "../../missions/registry";
import { useMission } from "../../missions/session";

const MISSIONS: Omit<MissionTile, "done" | "stars">[] = [
  { id: "eagle", label: "Mission 1", sub: "Moon", kind: "moon", sealed: false, machine: "Eagle lander" },
  { id: "opportunity", label: "Mission 2", sub: "Mars", kind: "mars", sealed: false, machine: "Opportunity rover" },
  { id: "viking", label: "Mission 3", sub: "Viking 1", kind: "viking", sealed: true },
  { id: "pioneer", label: "Mission 4", sub: "Pioneer 10", kind: "pioneer", sealed: true },
  { id: "voyager", label: "Mission 5", sub: "Voyager 1", kind: "voyager", sealed: true },
];

let greetedThisSession = false;

/** right after a frame is drawn, copy it to an image (the conversation shows it blurred while the 3D
 *  room stops rendering: no live canvas under a CSS filter, nothing to flash) */
function Snapshot({ want, onShot }: { want: boolean; onShot: (url: string) => void }) {
  const taken = useRef(false);
  useFrame(({ gl }) => {
    if (!want) return void (taken.current = false);
    if (taken.current) return;
    taken.current = true;
    try {
      onShot(gl.domElement.toDataURL("image/jpeg", 0.82));
    } catch {
      onShot("");
    }
  }, 5);
  return null;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Phase = "intro" | "choice" | "tutorial" | "free";

export default function Dashboard({ onPlay, finished, onWardrobe, onExit }: { onPlay: (id: string) => void; finished: string | null; onWardrobe?: () => void; onExit?: () => void }) {
  const profile = useStore((s) => s.profile);
  const progress = useStore((s) => s.progress);
  const archaeology=useMission(MOON);
  const settings = useStore((s) => s.settings);
  const configure = useStore((s) => s.configure);
  const updateProfile = useStore((s) => s.updateProfile);
  const [hot, setHot] = useState<string | null>(null);
  const [station, setStation] = useState<StationId | "menu" | null>(null);
  useIntent("hubStation", ({id}) => {
    if (id === "wardrobe") { setStation(null); setPassport(true); }
    else if (id === "nova") { setStation(null); openConvo(); }
    else if (id === "board") { setStation(null); setHighlight("wall"); }
    else if (id === "chart") { setStation(null); setPassport(true); }
    else setStation(id === "archive" || id === "records" ? id : "menu");
  });
  const [highlight, setHighlight] = useState<"wall" | "moon" | null>(null);
  const [confirm, setConfirm] = useState<MissionTile | null>(null);
  const [passport, setPassport] = useState(false);
  useWarpReady();
  // v8: the ship is mouse, keys and touch only (hands live in the investigation, quiz and games)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && confirm && (setConfirm(null), stopSpeaking());
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [confirm]);
  const [phase, setPhase] = useState<Phase>(() => (!settings.talkMode || !settings.tutorialDone ? "intro" : "free"));
  const [convo, setConvo] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [tapHint, setTapHint] = useState(false);
  const [portrait, setPortrait] = useState(() => innerWidth / innerHeight < 0.8);
  const talkRef = useRef<HTMLDivElement>(null);
  const tiles: MissionTile[] = MISSIONS.map((m) => ({ ...m, done: m.id==="eagle"&&archaeology.rewarded || progress.completed.includes(m.id), stars: m.id==="eagle"&&archaeology.rewarded?archaeology.stars:progress.scores[m.id] ?? 0 }));
  const busy = phase !== "free";

  useEffect(() => {
    const f = () => setPortrait(innerWidth / innerHeight < 0.8);
    addEventListener("resize", f);
    return () => removeEventListener("resize", f);
  }, []);

  // ---- arrival: Nova's lines, the talk-mode choice and the tutorial on a first visit ----
  useEffect(() => {
    let alive = true;
    resetTalk();
    roomLayout.lift = 0;
    const run = async () => {
      await wait(800);
      if (!alive) return;
      if (finished) {
        const done = progress.completed;
        const all = done.includes("eagle") && done.includes("opportunity");
        await say(all ? "done-all" : finished === "eagle" ? "done-moon" : "done-mars", { feel: "excited", act: "jump" });
        return;
      }
      const s = useStore.getState().settings;
      if (s.talkMode && s.tutorialDone) {
        // first visit after the intro tour: a hello (not "welcome back")
        if (!useStore.getState().profile?.greeted) {
          updateProfile({ greeted: true });
          greetedThisSession = true;
          await say("greet-hi", { feel: "excited", act: "wave" });
          return;
        }
        if (!greetedThisSession) await say("back-hi", { feel: "happy", act: "wave" });
        greetedThisSession = true;
        return;
      }
      prefetchClips(["talk-ask", "talk-voice-perm", "talk-chat", "talk-fallback", "talk-voice-ok", "tut-1", "tut-2", "tut-3", "tut-4", "tut-5", "tut-6", "tut-done"]);
      if (!profile?.greeted) await say("greet-hi", { feel: "excited", act: "wave" });
      if (!alive) return;
      setPhase(s.talkMode ? "tutorial" : "choice");
    };
    void run();
    return () => {
      alive = false;
      stopSpeaking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Settings → "Replay the tutorial" (or a talk-mode reset) restarts onboarding here
  useEffect(() => {
    if (phase !== "free") return;
    if (!settings.talkMode) setPhase("choice");
    else if (!settings.tutorialDone) setPhase("tutorial");
  }, [settings.talkMode, settings.tutorialDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterChoice = async (mode: "voice" | "chat") => {
    setPhase("intro");
    if (mode === "voice") {
      setTapHint(true);
      await say("talk-voice-ok", { feel: "excited", act: "wave" });
      await wait(600);
      setTapHint(false);
    } else await wait(1800);
    if (useStore.getState().settings.tutorialDone) return finishOnboarding(false);
    setPhase("tutorial");
  };
  const finishOnboarding = async (fromTutorial = true) => {
    configure({ tutorialDone: true });
    updateProfile({ greeted: true });
    greetedThisSession = true;
    setPhase("free");
    if (fromTutorial) {
      setHighlight("moon");
      if (useStore.getState().settings.talkMode === "voice") setTapHint(true);
      await say("tut-done", { feel: "excited", act: "point", pointAt: [1, 0.2] });
    }
  };

  // ---- sleepy after 45 s with nothing happening ----
  useEffect(() => {
    let last = Date.now();
    const poke = () => {
      last = Date.now();
      if (useNova.getState().expression === "sleepy") (nova.feel("happy"), nova.act("pop"));
    };
    const iv = setInterval(() => {
      const t = useTalk.getState();
      const speaking = t.msg && t.msg.progress < 1;
      if (!speaking && !t.thinking && Date.now() - last > 45000) nova.feel("sleepy");
    }, 2000);
    addEventListener("pointermove", poke);
    addEventListener("keydown", poke);
    return () => (clearInterval(iv), removeEventListener("pointermove", poke), removeEventListener("keydown", poke));
  }, []);

  // ---- open the conversation: tap Nova, Ask Nova, or N ----
  const openConvo = () => {
    if (busy || confirm || convo) return;
    play("pop", 1.2, 0.5);
    stopSpeaking();
    setTapHint(false);
    setHighlight(null);
    setConvo(true);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "n" || e.key === "N") openConvo();
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  // ---- keep the wall above the dialogue box (and the Ask Nova button on phones) ----
  useLayoutEffect(() => {
    let raf = 0;
    const tick = () => {
      const card = talkRef.current?.querySelector(".od-nova-card, .k-chat") as HTMLElement | null;
      const box = card ? talkRef.current!.getBoundingClientRect() : null;
      const top = portrait ? (box ? box.top : innerHeight) : innerHeight - 12;
      // v7.4: the speech bubble rides above Nova's head
      const hit = document.querySelector(".od-nova-hit") as HTMLElement | null;
      if (hit && !portrait) {
        const r = hit.getBoundingClientRect();
        const d = talkRef.current?.parentElement ?? document.querySelector(".od-dash");
        if (d instanceof HTMLElement) {
          d.style.setProperty("--nova-x", `${Math.round(r.left + r.width / 2)}px`);
          d.style.setProperty("--nova-top", `${Math.round(r.top)}px`);
        }
      }
      // phones: Ask Nova rides just above the dialogue box (its height goes to a CSS variable)
      const h = box ? Math.round(box.height) : 0;
      const dash = talkRef.current?.parentElement;
      if (dash && dash.style.getPropertyValue("--talk-h") !== `${h}px`) dash.style.setProperty("--talk-h", `${h}px`);
      const ask = document.querySelector(".od-ask") as HTMLElement | null;
      const askTop = portrait && ask ? ask.getBoundingClientRect().top : innerHeight;
      roomLayout.safeBottom = Math.min(top, askTop) - 18;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [portrait]);

  const pick = (t: MissionTile) => {
    if (busy || convo) return;
    play("tick");
    if (t.sealed) {
      void say("mission-sealed", { feel: "sorry", act: "shrug" });
      return;
    }
    setHighlight(null);
    setTapHint(false);
    closeChat();
    setConfirm(t);
    void say(t.id === "eagle" ? "mission-confirm-eagle" : "mission-confirm-opportunity", { feel: "excited", act: "point", pointAt: [1, 0.2] });
  };

  const mode = settings.talkMode ?? "chat";
  return (
    <div className={`od-dash ${portrait ? "portrait" : ""}`} data-phase={phase}>
      <Canvas
        className="od-canvas"
        frameloop={convo && shot !== null ? "never" : "always"}
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 0.1, far: 60, position: [0.3, 1.5, 7.4] }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        aria-hidden="true"
      >
        <Suspense fallback={null}>
          <DashboardRoom tiles={tiles} hot={hot} setHot={setHot} highlight={highlight} onPick={pick} onNova={openConvo} novaGlow={tapHint} portrait={portrait} />
          <OdysseyPost near={6} far={22} />
          <AdaptiveDpr />
          <OutlineSync />
          <Snapshot want={convo} onShot={setShot} />
        </Suspense>
      </Canvas>
      {convo && shot && <img className="od-freeze" src={shot} alt="" aria-hidden="true" />}

      {/* projected DOM: the wall's spotlight zone and Nova's tap target */}
      <div className="od-wall-zone" aria-hidden="true" ref={(el) => void (boxAnchors.get("wall") ? (boxAnchors.get("wall")!.el = el) : el && boxAnchors.set("wall", { min: new THREE.Vector3(), max: new THREE.Vector3(), el }))} />
      <button
        type="button"
        className="od-nova-hit"
        aria-label="Talk with Nova"
        disabled={busy}
        onClick={openConvo}
        ref={(el) => void (boxAnchors.get("nova") ? (boxAnchors.get("nova")!.el = el) : el && boxAnchors.set("nova", { min: new THREE.Vector3(), max: new THREE.Vector3(), el }))}
      >
        {tapHint && !convo && (
          <span className="od-tap-hint od-free" aria-hidden="true">
            <span className="od-tap-bubble">Tap Nova to start talking!</span>
            <svg className="od-tap-hand" viewBox="0 0 64 64" width="64" height="64">
              <path d="M26 30V10a5 5 0 0110 0v16l12 3a6 6 0 014 7l-3 14a8 8 0 01-8 6H30a8 8 0 01-6-3l-9-12a5 5 0 017-7l4 4z" fill="#FFFFFF" stroke="#241D48" strokeWidth="3.5" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </button>

      <div className="od-labels" aria-label="Missions" hidden={convo}>
        {tiles.filter((t) => !t.sealed).map((tile) => (
          <button
            key={tile.id}
            ref={(el) => {
              const a = labelAnchors.get(tile.id);
              if (a) a.el = el;
              else if (el) labelAnchors.set(tile.id, { pos: new THREE.Vector3(), el, y: 0 });
            }}
            type="button"
            className={`od-icon-label od-free ${tile.sealed ? "sealed" : ""} ${hot === tile.id ? "hot" : ""} ${highlight === "moon" && tile.kind === "moon" ? "glow" : ""}`}
            onClick={() => pick(tile)}
            onFocus={() => setHot(tile.id)}
            onBlur={() => setHot(null)}
            onPointerEnter={() => setHot(tile.id)}
            onPointerLeave={() => setHot(null)}
            aria-label={`${tile.label}: ${tile.sub}${tile.sealed ? ", coming soon" : tile.done ? `, done, ${tile.stars} stars` : ""}`}
          >
            <small>{tile.label}</small>
            <strong>{tile.sealed ? <><Lock size={16} strokeWidth={3} aria-hidden="true" /> Soon</> : tile.sub}</strong>
            {tile.machine && <em>{tile.machine}</em>}
            {tile.done && (
              <span className="od-done" aria-hidden="true">
                ★ {tile.stars}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="od-icon-label od-free sealed od-soon"
          ref={(el) => {
            const a = labelAnchors.get("sealed");
            if (a) a.el = el;
            else if (el) labelAnchors.set("sealed", { pos: new THREE.Vector3(), el, y: 0 });
          }}
          onClick={() => pick(tiles.find((t) => t.sealed)!)}
          aria-label="Missions 3 to 5: coming soon"
        >
          <Lock size={15} strokeWidth={3} aria-hidden="true" /> 3 more missions coming soon
        </button>
      </div>

      {!convo && phase !== "tutorial" && phase !== "choice" && (
        <div ref={talkRef} className={`od-dash-talk od-free ${portrait ? "" : "bubble"}`}>
          <NovaCard />
        </div>
      )}
      {!convo && (
        <button type="button" className={`od-ask od-free ${tapHint ? "pulse" : ""}`} aria-label="Ask Nova a question" aria-disabled={busy} data-wait={busy ? "1" : "0"} onClick={openConvo}>
          {mode === "voice" ? <Mic size={36} strokeWidth={2.4} /> : <MessageCircle size={36} strokeWidth={2.4} />}
          <span>Ask Nova</span>
        </button>
      )}

      {!convo && onExit && (
        <button type="button" className="g-icon-btn dash-exit" aria-label="Go back" disabled={busy} onClick={() => (play("pop", 1.1, 0.5), stopSpeaking(), onExit())}>
          <ArrowLeft size={26} strokeWidth={2.6} aria-hidden="true" />
          <span>Exit</span>
        </button>
      )}
      {!convo && (
        <nav className="dash-dock od-free" aria-label="Ship stations">
          {([
            ["wardrobe", "Explorer", Shirt, "sun"],
            ["archive", "Collection", Gem, "mint"],
            ["records", "Logbook", BookOpen, "sky"],
            ["chart", "Badges", Award, "pink"],
          ] as const).map(([id, name, Icon, tone]) => (
            <button key={id} type="button" className={`dash-dock-btn ${tone}`} disabled={busy} onClick={() => (play("pop", 1.1, 0.5), visitStation(id))}>
              <span className="dash-dock-ico" aria-hidden="true">
                <Icon size={28} strokeWidth={2.4} />
              </span>
              <span>{name}</span>
            </button>
          ))}
        </nav>
      )}
      {station && <StationMenu station={station} onClose={()=>setStation(null)}/>}

      {convo && <Conversation mode={mode} onClose={() => (setConvo(false), setShot(null))} />}
      {phase === "choice" && <TalkChoice onDone={(m) => void afterChoice(m)} />}
      {phase === "tutorial" && <Tutorial onDone={() => void finishOnboarding()} />}

      {confirm && (
        <div className="g-scrim" role="dialog" aria-modal="true" aria-label={`Start ${confirm.sub}?`} onPointerDown={(e) => e.target === e.currentTarget && (setConfirm(null), stopSpeaking())}>
          <div className={`g-panel mc ${confirm.kind}`}>
            <div className="mc-art" aria-hidden="true">
              <span className="mc-planet" />
              <span className="mc-ring" />
              <i className="mc-star s1" />
              <i className="mc-star s2" />
              <i className="mc-star s3" />
            </div>
            <div className="mc-body">
              <span className="mc-tag">{confirm.label}</span>
              <h2>{confirm.kind === "moon" ? "The Moon" : "Mars"}</h2>
              <p>{confirm.kind === "moon" ? "Watch the story of Apollo 11, then explore what the astronauts left behind." : "Fly to Mars with Opportunity, then explore what the brave rover left behind."}</p>
              <ul className="mc-steps">
                <li>Real NASA video</li>
                <li>Launch and story</li>
                <li>Explore, dig and quiz</li>
                <li>Hand game</li>
              </ul>
              <div className="mc-row">
                <button type="button" className="g-btn" onClick={() => (setConfirm(null), stopSpeaking(), nova.feel("happy"))}>
                  Not yet
                </button>
                <button
                  type="button"
                  className="g-btn coral big"
                  autoFocus
                  onClick={() => {
                    const id = confirm.id;
                    setConfirm(null);
                    nova.act("thumbs");
                    stopSpeaking();
                    onPlay(id);
                  }}
                >
                  Let's go! <Rocket size={24} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </div>
            </div>
            <button type="button" className="g-icon-btn mc-x" aria-label="Close" onClick={() => (setConfirm(null), stopSpeaking(), nova.feel("happy"))}>
              <X size={24} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}
      {passport && <Passport onClose={() => setPassport(false)} onWardrobe={() => onWardrobe?.()} />}
    </div>
  );
}
