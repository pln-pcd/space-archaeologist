import { lazy, Suspense, useEffect, useState } from "react";
import { Card, Button } from "../odyssey/ui/kit";
import { Home, ArrowLeft, MessageCircle, Hand } from "lucide-react";
import GameLoading from "../odyssey/ui/Loading";
import { useTheme } from "../audio/themes";
import { useWarpReady } from "../odyssey/fx/Warp";
import { play } from "../audio/sfx";
import { useIntentScope } from "../input/bus";
import { useInput, useHandsWanted } from "../input/store";
import { gloves } from "../input/engine";
import { LOOP } from "./MissionRunner";
import { MOON, MISSIONS } from "./registry";
import { sessionFor, useMission, command } from "./session";
import { Action, SpokenLine, useStepFocus, judgeMode } from "./ui";
import Exploration from "./Exploration";
import { SceneVideo } from "../story/ch1/scenes";
import "./missions.css";
import "../story/ch1/ch1.css";
import { setMissionContext } from "../odyssey/nova/brain";
import { useStore } from "../store";
import Conversation from "../odyssey/nova/Conversation";
import HandTraining from "../odyssey/hands/HandTraining";
import Safe from "../ui/Safe";
import ArtifactInvestigation from "./ArtifactInvestigation";
import EvidenceBoard from "./EvidenceBoard";
import Reconstruction from "./Reconstruction";
import Discovery from "./Discovery";
import Challenge from "./Challenge";
import Rewards from "./Rewards";
import Archive from "./Archive";
import MissionFilm from "./MissionFilm";
const SceneLaunch = lazy(() => import("../story/ch1/SceneLaunch"));
const RockBox = lazy(() => import("../story/ch1/RockBox"));
// v8: Mars runs on the same engine: its opening films, then explore → investigate → quiz → Sol Keeper
const MarsOpening = lazy(() => import("../story/ch2/MarsOpening"));
const SolKeeper = lazy(() => import("../story/ch2/SolKeeper"));
/** an old save sitting on a removed story stage: move on */
function StoryAdvance({ onNext }: { onNext: () => void }) {
  useEffect(() => onNext(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
export default function MissionApp({ onClose, missionId }: { onClose: (done?: boolean) => void; missionId?: string }) {
  const [mission] = useState(
    () =>
      MISSIONS.get(missionId ?? "") ??
      MISSIONS.get(new URLSearchParams(location.search).get("mission") ?? "") ??
      MOON,
  );
  const mars = mission.meta.id.startsWith("mars");
  const [ready, setReady] = useState(false);
  // read the deep link once (React dev mode runs effects twice and the URL is tidied after the first)
  const [entry] = useState(() => {
    const q = new URLSearchParams(location.search);
    const linked = q.get("mission") === mission.meta.id;
    return { step: linked && q.has("step") ? Number(q.get("step")) || undefined : undefined, artifact: linked ? q.get("artifact") : null };
  });
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    // opening a chapter from the ship always starts with its story film (finds stay saved);
    // deep links (?step=, ?artifact=) still jump straight to a step
    const { step: linkStep, artifact: linkArtifact } = entry;
    sessionFor(mission).enter(linkStep || linkArtifact ? linkStep : 4, linkArtifact);
    q.delete("step");
    q.delete("artifact");
    q.set("mission", mission.meta.id);
    history.replaceState(null, "", `${location.pathname}?${q}`);
    setReady(true);
  }, []);
  const state = useMission(mission);
  const [field, setField] = useState(false);
  const [conversation, setConversation] = useState(false),
    [cameraChoice, setCameraChoice] = useState(false);
  const gesture = useInput((s) => s.mode === "gloves");
  const talkMode = useStore((s) => s.settings.talkMode ?? "chat");
  const next = () => command(mission, { type: "next" });
  const allowed = [5, 6, 7, 8, 10].includes(state.step);
  // v8: hands (camera + glove) ONLY in the parts made for them: investigating a find, its quiz and
  // the mini-game. Exploring, films and the ship use mouse, keys and touch.
  const handsPart = state.step === 6 || state.step === 7 || (state.step === 5 && field);
  useHandsWanted(gesture && handsPart);
  // the first time a hands part opens, the hand card pops up by itself (once per device)
  // (after the game's how-to card, so two cards never stack)
  useEffect(() => {
    if (!handsPart || useStore.getState().settings.handsAsked) return;
    const iv = setInterval(() => {
      if (document.querySelector(".howto-scrim, .g-scrim")) return;
      clearInterval(iv);
      if (!useStore.getState().settings.handsAsked) setCameraChoice(true);
    }, 400);
    return () => clearInterval(iv);
  }, [handsPart]);
  const [leaving, setLeaving] = useState(false);
  useWarpReady(ready);
  // films and the NASA video bring their own sound; the Rock Box gets the bouncy game song
  useTheme(state.step === 4 ? null : state.step === 5 && field ? "game" : state.step >= 9 ? "ship" : "explore");
  const artifact =
    mission.artifacts.find((a) => a.id === state.artifactId) ??
    mission.artifacts[0];
  useIntentScope(
    state.step === 4 ? [] : null,
    { walk: false },
    "mission-story",
  );
  useStepFocus(`${ready}-${state.step}-${state.artifactId}`);

  useEffect(() => {
    setMissionContext({
      missionId: mission.meta.id,
      step: state.step,
      artifactId: [6, 7].includes(state.step) ? state.artifactId : null,
    });
    return () => setMissionContext(null);
  }, [state.step, state.artifactId]);
  if (!ready) return <GameLoading label="Preparing your discovery…" />;
  return (
    <div
      className="m-runner chapter"
      data-mission={mission.meta.id}
      data-step={String(state.step).padStart(2, "0")}
    >
      <div className="g-hud-tl">
        <button type="button" className="g-icon-btn" aria-label="Back to the ship" onClick={() => (play("soft", 1, 0.5), setLeaving(true))}>
          <Home size={26} strokeWidth={2.6} />
          <span>Ship</span>
        </button>
        {(state.step >= 5 || (state.step === 4 && state.storyStage > 0)) && (
          <button
            type="button"
            className="g-icon-btn"
            aria-label={state.step === 5 && field ? "Back to exploring" : "Go back"}
            onClick={() => {
              play("soft", 1, 0.5);
              if (state.step === 5 && field) setField(false);
              else command(mission, { type: "back" });
            }}
          >
            <ArrowLeft size={26} strokeWidth={2.8} />
            <span>Back</span>
          </button>
        )}
      </div>
      {leaving && (
        <div className="g-scrim" role="dialog" aria-modal="true" aria-label="Leave the mission?" onPointerDown={(e) => e.target === e.currentTarget && setLeaving(false)}>
          <div className="g-panel g-dialog">
            <h2>Back to the ship?</h2>
            <p>Your discoveries are saved. You can come back anytime.</p>
            <div className="g-row">
              <button type="button" className="g-btn primary big" autoFocus onClick={() => setLeaving(false)}>
                Keep exploring
              </button>
              <button type="button" className="g-btn" onClick={() => (setLeaving(false), onClose())}>
                <Home size={20} strokeWidth={2.6} aria-hidden="true" /> Go to ship
              </button>
            </div>
          </div>
        </div>
      )}
      {judgeMode() && (
        <ol className="m-loop m-judge-loop" aria-label="Mission loop">
          {LOOP.map((label, i) => (
            <li
              key={label}
              aria-current={state.step === i + 1 ? "step" : undefined}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}
      <Suspense fallback={<GameLoading label="Preparing your discovery…" />}>
        {/* v7.5: Neil Armstrong's NASA footage → the launch lever and the trip → the Moon arrival film */}
        {mars && state.step === 4 && <MarsOpening key={state.storyStage} stage={state.storyStage} onNext={next} />}
        {!mars && state.step === 4 && state.storyStage === 0 && <SceneVideo onDone={next} />}
        {!mars && state.step === 4 && state.storyStage === 1 && (
          <SceneLaunch onDone={next} />
        )}
        {!mars && state.step === 4 && state.storyStage === 2 && (
          <MissionFilm mission={mission} onDone={next} />
        )}
        {!mars && state.step === 4 && state.storyStage > 2 && <StoryAdvance onNext={next} />}
        {state.step === 5 && !field && (
          <Exploration
            mission={mission}
            state={state}
            onFieldActivity={() => setField(true)}
          />
        )}
        {state.step === 5 && field && !mars && (
          <>
            <RockBox camera={gesture} onDone={() => (command(mission, { type: "fieldDone" }), setField(false))} />
          </>
        )}
        {state.step === 5 && field && mars && <SolKeeper camera={gesture} onDone={() => (command(mission, { type: "fieldDone" }), setField(false))} />}
        {state.step === 6 && (
          <ArtifactInvestigation
            key={artifact.id}
            mission={mission}
            artifact={artifact}
            state={state}
          />
        )}
        {state.step === 7 && (
          <EvidenceBoard
            key={artifact.id}
            mission={mission}
            artifact={artifact}
            state={state}
          />
        )}
        {state.step === 8 && <Reconstruction mission={mission} state={state} />}
        {state.step === 9 && <Discovery mission={mission} state={state} />}
        {state.step === 10 && <Challenge mission={mission} state={state} />}
        {state.step === 11 && <Rewards mission={mission} state={state} />}
        {state.step === 12 && (
          <>
            <div className="m-chapter-done" role="status">
              <span aria-hidden="true">🏅</span>
              <div>
                <small>{mars ? "Chapter 2 · Mars" : "Chapter 1 · The Moon"}</small>
                <strong>Chapter complete!</strong>
              </div>
            </div>
            <Archive
              mission={mission}
              state={state}
              onClose={() => {
                // the ship's mission wall reads Mars from the saved progress
                if (mars) {
                  const st = useStore.getState();
                  st.complete("opportunity", "stamp");
                  st.score("opportunity", Math.max(1, state.stars));
                }
                onClose(true);
              }}
            />
          </>
        )}
        {(allowed || state.step >= 5) && (
          <div className="g-hud-tr">
            <button type="button" className="g-icon-btn sky" aria-label="Ask Nova" onClick={() => (play("pop", 1.2, 0.5), setConversation(true))}>
              <MessageCircle size={26} strokeWidth={2.6} />
              <span>Ask Nova</span>
            </button>
            {handsPart && <button
              type="button"
              className={`g-icon-btn ${gesture ? "mint" : ""}`}
              aria-pressed={gesture}
              aria-label={gesture ? "Turn hand gestures off" : "Play with hand gestures"}
              onClick={() => setCameraChoice(true)}
            >
              <Hand size={26} strokeWidth={2.6} />
              <span>{gesture ? "Hands on" : "Hands"}</span>
            </button>}
          </div>
        )}
        {cameraChoice && (
          <Safe onError={() => setCameraChoice(false)}>
            <HandTraining onClose={() => setCameraChoice(false)} />
          </Safe>
        )}
        <OpenHands onOpen={() => setCameraChoice(true)} />
        {conversation && (
          <Conversation
            mode={talkMode}
            mission={mission.meta.id === "mars-001" ? "opportunity" : "eagle"}
            onClose={() => setConversation(false)}
          />
        )}
      </Suspense>
      {state.storageWarning && (
        <div className="m-storage" role="status">
          Saving is unavailable. Keep this tab open to continue.
        </div>
      )}
    </div>
  );
}

/** v7.6: any screen can ask for the camera ("Open the camera to investigate") with
 *  window.dispatchEvent(new Event("od-open-hands")); this opens the same consent + training card. */
function OpenHands({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    const f = () => onOpen();
    addEventListener("od-open-hands", f);
    return () => removeEventListener("od-open-hands", f);
  }, [onOpen]);
  return null;
}
