// STARSHIP ODYSSEY, the new flow (new-flow prompt §3):
//   COVER → (first time) NAME CARD → DASHBOARD (Nova greeting + how-to) → MISSION → STORY →
//   NOVA CHECK-IN → MINI-GAME → RESULTS + STAMP → DASHBOARD
// Deep links: ?screen=cover|name|dashboard, ?chapter=1|2&scene=A…G (add &checkin=1 for the check-in),
// ?judge=1 (Judge Mode strip). ?nocover=1 skips the cover in automated runs.
import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, Settings as Gear } from "lucide-react";
import { useStore, type Profile } from "../store";
import { motion as motionPrefs } from "../anim/kit";
import { CHAPTER_PLAYERS } from "../chapters/registry";
import AudioDirector from "../audio/AudioDirector";
import GlovesLayer from "../ui/GlovesLayer";
import GameLoading from "./ui/Loading";
import { useJudge } from "../judge/judge";
import Cover from "./screens/Cover";
import NameCard from "./screens/NameCard";
import { CreditsPanel, SettingsPanel } from "./screens/Panels";
import { resetTalk } from "./nova/talk";
import { stopSpeaking } from "./nova/voice";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
// the missions' own screens (video, launch, story, mini-games, results) keep their card styles
import "../game.css";
import "../style/motion.css";
import "../ui/cards.css";
import "../style/perf.css";
import "../ui/paper.css";
import "../ui/master.css";
import "../ui/cute.css";
import "./odyssey.css";
import "./ui/kit.css";
import "./ui/missions.css";
import "./fx/juice.css";
import "./ui/game.css";
import "./hands/hands.css";
import "./ui/settings.css";
import { installJuice } from "./fx/juice";
import WarpLayer, { warpTo } from "./fx/Warp";
import { HandsOn } from "../story/ch1/CameraCheck";
import { useInput } from "../input/store";
import { AVATAR_SAVE_KEY, GAME_TITLE } from "../missions/constants";
import { useAvatar } from "../missions/avatar";
import { resetMissions } from "../missions/session";
import { MISSIONS } from "../missions/registry";

const Dashboard = lazy(() => import("./screens/Dashboard"));
const AvatarDesigner = lazy(() => import("../missions/AvatarDesigner"));
const Intro = lazy(() => import("./screens/Intro"));
const MissionApp = lazy(() => import("../missions/MissionApp"));

type Screen = "cover" | "name" | "avatar" | "intro" | "dashboard" | "mission" | "archaeologist";

function initial(): { screen: Screen; mission: string | null } {
  const q = new URLSearchParams(location.search);
  const artifact=q.get("artifact");
  const artifactMission=artifact?[...MISSIONS.values()].find(m=>m.artifacts.some(a=>a.id===artifact)):undefined;
  if(artifactMission){q.set("mission",artifactMission.meta.id);history.replaceState(null,"",`${location.pathname}?${q}`);return {screen:"archaeologist",mission:null};}
  if (MISSIONS.has(q.get("mission")??"") && ![1,2,3].includes(Number(q.get("step")))) return { screen: "archaeologist", mission: null };
  if (MISSIONS.has(q.get("mission")??"") && Number(q.get("step")) === 2) return { screen: "avatar", mission: null };
  if (MISSIONS.has(q.get("mission")??"") && Number(q.get("step")) === 3) return { screen: "dashboard", mission: null };
  const c = q.get("chapter");
  const mission = c === "1" ? "eagle" : c === "2" ? "opportunity" : null;
  if (mission) return { screen: "mission", mission };
  const s = q.get("screen") as Screen | null;
  if (s === "name" || s === "dashboard" || s === "cover") return { screen: s, mission: null };
  if (q.has("nocover")) return { screen: useStore.getState().profile ? "dashboard" : "name", mission: null };
  return { screen: "cover", mission: null };
}

/** device layout: auto from the pointer and window, or forced in Settings */
function deviceClass(setting: string | undefined) {
  if (setting && setting !== "auto") return setting;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const w = Math.min(innerWidth, innerHeight);
  return coarse ? (w < 600 ? "phone" : "tablet") : "computer";
}

export default function OdysseyApp() {
  const profile = useStore((s) => s.profile);
  const avatar = useAvatar((s) => s.config);
  const settings = useStore((s) => s.settings);
  const [{ screen, mission }, setState] = useState(initial);
  const [finished, setFinished] = useState<string | null>(null);
  const [panel, setPanel] = useState<"settings" | "credits" | null>(null);
  const [fade, setFade] = useState(false);
  const [device, setDevice] = useState(() => deviceClass(settings.device));
  const judge = useJudge((j) => j.on);
  const handsOn = useInput((s) => s.mode === "gloves" && s.consented);
  useEffect(()=>{document.title=GAME_TITLE;},[]);

  // a profile is needed beyond the cover; deep links get a test explorer
  useEffect(() => {
    if (!profile && ["dashboard", "mission", "avatar", "archaeologist"].includes(screen) && new URLSearchParams(location.search).size) createProfile("Explorer", "EXPLORER", true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = document.documentElement;
    const reduced = !!settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).get("reduceMotion") === "1";
    h.classList.toggle("reduced-motion", reduced);
    h.classList.toggle("reading-font", !!settings.dyslexia);
    h.classList.toggle("easy-read", !!settings.easyRead);
    h.dataset.textSize = settings.textSize ?? "normal";
    motionPrefs.reduced = reduced;
    const f = () => setDevice(deviceClass(settings.device));
    f();
    addEventListener("resize", f);
    return () => removeEventListener("resize", f);
  }, [settings.reducedMotion, settings.dyslexia, settings.easyRead, settings.textSize, settings.device]);
  useEffect(() => {
    document.documentElement.dataset.device = device;
  }, [device]);
  useEffect(() => installJuice(), []);
  // remember today for the passport streak (dates only, on this device)
  useEffect(() => {
    const d = new Date().toISOString().slice(0, 10);
    const days = useStore.getState().settings.playDays ?? [];
    if (!days.includes(d)) useStore.getState().configure({ playDays: [...days, d].slice(-120) });
  }, []);
  useEffect(() => {
    document.body.classList.add("game-mode", "od-game");
    return () => document.body.classList.remove("game-mode", "od-game");
  }, []);

  /** an iris / warp wipe between screens: a starry circle closes, the screen changes, it opens again
   *  (a plain fade in reduced motion) */
  const go = (next: Screen, m: string | null = null, warp?: [string, string]) => {
    stopSpeaking();
    if (warp) {
      warpTo(warp[0], warp[1], () => {
        resetTalk();
        setState({ screen: next, mission: m });
        if (next !== "archaeologist" && location.search.includes("mission=")) history.replaceState(null, "", location.pathname);
      });
      return;
    }
    setFade(true);
    setTimeout(
      () => {
        resetTalk();
        setState({ screen: next, mission: m });
        if (next !== "archaeologist" && location.search.includes("mission=")) { const q = new URLSearchParams(location.search); q.delete("mission"); q.delete("step"); q.delete("artifact"); history.replaceState(null, "", location.pathname + (q.size ? `?${q}` : "")); }
        if (next !== "mission" && location.search.includes("chapter=")) history.replaceState(null, "", location.pathname);
        setTimeout(() => setFade(false), 60);
      },
      motionPrefs.reduced ? 120 : 420,
    );
  };

  const createProfile = (name: string, patch: string, test = false) => {
    const p: Profile = { nickname: name, suit: "Commander", code: `device-${Date.now().toString(36)}`, mode: "device", playerName: name, playerPatch: patch, introDone: true, createdAt: new Date().toISOString(), greeted: test };
    useStore.getState().enter(p, useStore.getState().progress);
  };

  const forget = () => {
    setPanel(null);
    useStore.getState().deleteSave();
    resetMissions();
    localStorage.removeItem(AVATAR_SAVE_KEY);
    useAvatar.setState({ config: null });
    go("cover");
  };

  const Player = mission ? CHAPTER_PLAYERS[mission] : null;
  return (
    <main className="od-app" aria-label={GAME_TITLE}>
      {screen === "cover" && <Cover onStart={() => go(!useStore.getState().settings.introSeen ? "intro" : profile ? avatar ? "dashboard" : "avatar" : "name", null, ["Blast off!", profile ? "Welcome back, explorer" : "A new explorer joins the crew"])} onSettings={() => setPanel("settings")} onCredits={() => setPanel("credits")} />}
      {(screen === "name" || screen === "intro") && (
        <button type="button" className="g-icon-btn dash-exit" aria-label="Back to the title screen" onClick={() => go("cover")}>
          <ArrowLeft size={26} strokeWidth={2.6} aria-hidden="true" />
          <span>Back</span>
        </button>
      )}
      {screen === "name" && (
        <NameCard
          onDone={(name, patch) => {
            createProfile(name, patch);
            go("avatar");
          }}
        />
      )}
      {screen === "avatar" && <Suspense fallback={<GameLoading />}><AvatarDesigner onDone={() => go("dashboard", null, ["Your ship", "Mission control"])} /></Suspense>}
      {screen === "intro" && (
        <Suspense fallback={<GameLoading />}>
          <Intro
            onDone={() => {
              const st = useStore.getState();
              st.configure({ introSeen: true, talkMode: st.settings.talkMode ?? "chat", tutorialDone: true });
              go(!st.profile ? "name" : !useAvatar.getState().config ? "avatar" : "dashboard");
            }}
          />
        </Suspense>
      )}
      {screen === "archaeologist" && (
        <Suspense fallback={<GameLoading />}>
          <MissionApp onClose={(done) => (setFinished(done ? "eagle" : null), go("dashboard", null, done ? ["Your ship", "Chapter 1 complete!"] : undefined))} />
        </Suspense>
      )}
      {screen === "dashboard" && (
        <Suspense fallback={<GameLoading />}>
          <Dashboard
            key={finished ?? "home"}
            finished={finished}
            onWardrobe={() => go("avatar")}
            onExit={() => go("cover")}
            onPlay={(id) => {
              setFinished(null);
              go(id === "eagle" ? "archaeologist" : "mission", id === "eagle" ? null : id, id === "eagle" ? ["The Moon", "Chapter 1 · Apollo 11 · 1969"] : ["Mars", "Chapter 2 · Opportunity · 2004"]);
            }}
          />
        </Suspense>
      )}
      {screen === "mission" && Player && (
        <Suspense fallback={<GameLoading />}>
          <Player
            key={mission}
            onClose={(done?: boolean) => {
              setFinished(done ? mission : null);
              go("dashboard");
            }}
          />
        </Suspense>
      )}
      {screen !== "cover" && (
        <button type="button" className="od-gear" aria-label="Settings" onClick={() => setPanel("settings")}>
          <Gear size={30} strokeWidth={2} />
        </button>
      )}
      {panel === "settings" && <SettingsPanel onClose={() => setPanel(null)} onForget={forget} onIntro={() => (setPanel(null), go("intro"))} />}
      {panel === "credits" && <CreditsPanel onClose={() => setPanel(null)} />}
      {judge && screen !== "archaeologist" && (
        <nav className="od-judge od-card" aria-label="Judge Mode">
          <strong>Judge Mode</strong>
          <button type="button" onClick={() => go("cover")}>Cover</button>
          <button type="button" onClick={() => go("name")}>Name</button>
          <button type="button" onClick={() => go("dashboard")}>Dashboard</button>
          <button type="button" onClick={() => go("mission", "eagle")}>Moon</button>
          <button type="button" onClick={() => go("mission", "opportunity")}>Mars</button>
        </nav>
      )}
      <div className={`od-iris ${fade ? "on" : ""}`} aria-hidden="true" />
      <WarpLayer />
      {handsOn && screen !== "cover" && <HandsOn />}
      <AudioDirector scene={screen === "mission" ? (mission === "opportunity" ? "mars" : "chapter") : "base"} theme={screen === "cover" || screen === "intro" ? "title" : screen === "archaeologist" ? "explore" : screen === "mission" ? (mission === "opportunity" ? "explore" : null) : "ship"} />
      <GlovesLayer />
    </main>
  );
}
