// Chapter 1 player (bible §8 rebuild): the state machine from flow.ts, cream swirl dissolves
// between states (a crossfade in reduced motion), the chapter HUD, Judge Mode jumps, and the
// Results and Stamp screens. Hand tracking exists only inside G_CAMERA_CHECK → G_MINIGAME.
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { swirlCover, swirlReveal } from "../../fx/Swirl";
import { motion } from "../../anim/kit";
import { play } from "../../audio/sfx";
import { explorerName, useStore } from "../../store";
import { useInput } from "../../input/store";
import { useJudge } from "../../judge/judge";
import { StampEagle } from "../../ui/stamps";
import { HandsOn } from "./CameraCheck";
import { SCENES, beat, line, next, startScene, useCh1, type SceneId } from "./flow";
import { SceneVideo } from "./scenes";
import CheckIn from "../../odyssey/screens/CheckIn";
import { APOLLO_KG } from "./RockBox";
import "./ch1.css";
import { stampThunk } from "../../odyssey/fx/juice";
import { nova } from "../../odyssey/nova/state";

const SceneLaunch = lazy(() => import("./SceneLaunch"));
const SceneLanding = lazy(() => import("./SceneLanding"));
const SceneSteps = lazy(() => import("./SceneMoon").then((m) => ({ default: m.SceneSteps })));
const StoryFilm = lazy(() => import("../odyssey/StoryFilm"));
const MoonStoryWorld = lazy(() => import("../odyssey/MoonStory").then((m) => ({ default: m.MoonStoryWorld })));
import { CH1_STORY } from "../odyssey/storyline";
const CameraCheck = lazy(() => import("./CameraCheck"));
const RockBox = lazy(() => import("./RockBox"));

const TITLE: Partial<Record<SceneId, string>> = {
  A_VIDEO: beat("A").title,
  B_LAUNCH: beat("B").title,
  C_TRIP_AND_LANDING: beat("C").title,
  D_FIRST_STEPS: beat("D").title,
  E_STORY: beat("E").title,
  F_CHECKIN: "Talk with Nova",
  G_CAMERA_CHECK: beat("G").title,
  G_MINIGAME: beat("G").title,
  RESULTS: "Results",
  STAMP: "Your passport",
};

/** back to mouse or touch once the mini-game is over (hand mode lives only inside it) */
function leaveHandMode() {
  const s = useInput.getState();
  if (s.mode === "gloves") s.set({ mode: matchMedia("(pointer: coarse)").matches ? "touch" : "mouse" });
}

function Results({ kg, stars, onAgain, onStamp }: { kg: number; stars: number; onAgain: () => void; onStamp: () => void }) {
  useEffect(() => void play("chime", 1, 0.5), []);
  return (
    <div className="ch1-scene results-wrap">
      <div className="results-card ch1-results paper-card">
        <small>Well done, {explorerName(useStore.getState().profile)}</small>
        <h2>{kg >= APOLLO_KG ? "You matched Apollo 11." : `${kg.toFixed(1)} kg of Moon samples`}</h2>
        <div className="rc-stars" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? "on" : ""}>
              <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
                <path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill={i < stars ? "#CDB98E" : "none"} stroke="#A8936A" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
          ))}
        </div>
        <p className="ch1-results-line">
          You collected {kg.toFixed(1)} kg. Apollo 11 brought home about {APOLLO_KG} kg.
        </p>
        <div className="ch1-fact-inline">
          <span className="od-badge true">True story</span> {line("g-study").text}
        </div>
        <div className="ch1-ask-btns">
          <button type="button" className="chunky" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="chunky primary" onClick={onStamp}>
            Stamp my passport
          </button>
        </div>
      </div>
    </div>
  );
}

function Stamp({ onDone }: { onDone: () => void }) {
  const [stamped, setStamped] = useState(false);
  const stamp = () => {
    if (stamped) return;
    setStamped(true);
    play("stampSlam", 1, 0.6);
    stampThunk();
    nova.act("jump");
    setTimeout(onDone, 1800);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.key === " " || e.key === "Enter" || e.key === "e") && stamp();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className="ch1-scene stamp-wrap">
      <div className="ch1-stamp paper-card">
        <h2>Stamp your passport</h2>
        <button type="button" className={`ch1-stamp-pad ${stamped ? "stamped" : ""}`} onClick={stamp} aria-label="Stamp the passport">
          <span className="ch1-stamp-ink">{stamped && <StampEagle size={180} />}</span>
          {!stamped && <span className="ch1-stamp-hint">Click, tap or press Space</span>}
        </button>
      </div>
    </div>
  );
}

export default function Ch1Player({ startIndex = 0, onClose }: { startIndex?: number; onClose: (done?: boolean) => void }) {
  const scene = useCh1((s) => s.scene);
  const camera = useCh1((s) => s.camera);
  const result = useCh1((s) => s.result);
  const judge = useJudge((j) => j.on);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    useCh1.getState().go(startScene(startIndex));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** move to another state through the cream swirl (≈1.2 s), or a crossfade in reduced motion */
  const goTo = useCallback(async (s: SceneId, done = false) => {
    if (s === "BACK_TO_SHIP") return onClose(done);
    if (motion.reduced) {
      setFade(true);
      await new Promise((r) => setTimeout(r, 500));
      useCh1.getState().go(s);
      setFade(false);
      return;
    }
    await swirlCover(0.6);
    useCh1.getState().go(s);
    setTimeout(() => void swirlReveal(1.2), 120);
  }, [onClose]);
  const advance = useCallback(() => goTo(next(useCh1.getState().scene)), [goTo]);

  const finishStamp = () => {
    const st = useStore.getState();
    st.complete("eagle", "stamp");
    st.score("eagle", result?.stars ?? 0);
    st.page("eagle", 0);
    goTo("BACK_TO_SHIP", true);
  };

  const handsScene = camera && (scene === "G_MINIGAME");
  // outside the mini-game the input mode returns to mouse or touch (bible §5.2)
  useEffect(() => {
    if (scene !== "G_CAMERA_CHECK" && scene !== "G_MINIGAME") leaveHandMode();
  }, [scene]);
  useEffect(() => () => leaveHandMode(), []);
  // the camera check and the mini-game show their own camera view and "Camera on" light
  useEffect(() => {
    const own = scene === "G_CAMERA_CHECK" || scene === "G_MINIGAME";
    document.body.classList.toggle("ch1-own-camera", own);
    return () => document.body.classList.remove("ch1-own-camera");
  }, [scene]);
  return (
    <div className={`chapter ch1-player ${fade ? "fading" : ""}`} data-scene={scene}>
      {handsScene && <HandsOn />}
      <header className="ch1-hud">
        <button type="button" className="tilt-btn wide ch1-home" onClick={() => goTo("BACK_TO_SHIP")} aria-label="Back to the mission wall">
          <span>← Missions</span>
        </button>
        <div key={scene} className={`ch-title ch1-title ${["B_LAUNCH", "C_TRIP_AND_LANDING", "D_FIRST_STEPS", "E_STORY", "G_MINIGAME"].includes(scene) ? "auto-hide" : ""}`}>
          <small>Chapter 1 · Eagle</small>
          <strong>{TITLE[scene] ?? ""}</strong>
        </div>
        {judge && (
          <div className="ch1-judge" aria-label="Judge Mode: jump to a scene">
            {(["A_VIDEO", "B_LAUNCH", "C_TRIP_AND_LANDING", "D_FIRST_STEPS", "E_STORY", "F_CHECKIN"] as SceneId[]).map((s, i) => (
              <button key={s} type="button" className="chunky small quiet" onClick={() => goTo(s)}>
                {"ABCDEF"[i]}
              </button>
            ))}
            <button type="button" className="chunky small primary" onClick={() => goTo("G_CAMERA_CHECK")}>
              Skip to mini-game
            </button>
          </div>
        )}
      </header>
      <Suspense fallback={<div className="ch1-loading">Loading…</div>}>
        {scene === "A_VIDEO" && <SceneVideo onDone={advance} />}
        {scene === "B_LAUNCH" && <SceneLaunch onDone={advance} />}
        {scene === "C_TRIP_AND_LANDING" && <SceneLanding onDone={advance} />}
        {scene === "D_FIRST_STEPS" && <SceneSteps onDone={advance} />}
        {scene === "E_STORY" && <StoryFilm story={CH1_STORY} World={MoonStoryWorld} voiceDir="ch1" resolve={line} onDone={advance} />}
        {scene === "F_CHECKIN" && <CheckIn mission="eagle" backdrop="/media/ch1/story-last.jpg" onPlay={advance} onStory={() => goTo("E_STORY")} />}
        {scene === "G_CAMERA_CHECK" && (
          <CameraCheck
            onCamera={() => {
              useCh1.getState().set({ camera: true });
              void goTo("G_MINIGAME");
            }}
            onMouse={() => {
              useCh1.getState().set({ camera: false });
              void goTo("G_MINIGAME");
            }}
          />
        )}
        {scene === "G_MINIGAME" && (
          <RockBox
            camera={camera}
            onDone={(kg, stars) => {
              useCh1.getState().set({ result: { kg, stars, mode: camera ? "camera" : "mouse" }, camera: false });
              void goTo("RESULTS");
            }}
          />
        )}
        {scene === "RESULTS" && <Results kg={result?.kg ?? 0} stars={result?.stars ?? 0} onAgain={() => goTo("G_CAMERA_CHECK")} onStamp={() => goTo("STAMP")} />}
        {scene === "STAMP" && <Stamp onDone={finishStamp} />}
      </Suspense>
    </div>
  );
}
export { SCENES };
