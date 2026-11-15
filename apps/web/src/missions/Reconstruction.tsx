import { useEffect, useRef, useState } from "react";
import HowTo, { howToSeen } from "./HowTo";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Button, Card, Tag } from "../odyssey/ui/kit";
import { useIntent, useIntentScope, intents } from "../input/bus";
import { Stage, newCam, type CamCtl } from "../story/ch1/stage";
import {
  Eagle,
  newEagle,
  MoonGround,
  Earth,
  Columbia,
  Apollonaut,
} from "../story/ch1/props";
import { newDriver } from "../ship/Chubby";
import { motion } from "../anim/kit";
import { play } from "../audio/sfx";
import { InspectionStage, InspectTools } from "./ArtifactModel";
import { Action, FactText } from "./ui";
import { command } from "./session";
import type { MissionDefinition, MissionState } from "./types";

function ReplayWorld({
  cam,
  phase,
}: {
  cam: React.MutableRefObject<CamCtl>;
  phase: number;
}) {
  const ctl = useRef(newEagle()),
    g = useRef<THREE.Group>(null),
    astro = useRef(newDriver()),
    time = useRef(0),
    last = useRef(phase);
  useFrame((_, dt) => {
    if (last.current !== phase) {
      time.current = 0;
      last.current = phase;
    }
    time.current += dt;
    const k = motion.reduced ? 1 : Math.min(1, time.current / 2);
    ctl.current.ascentOn = true;
    ctl.current.ascentY = phase === 4 ? k * 6 : 0;
    ctl.current.flame = phase === 4 ? 1 : 0;
    if (g.current) {
      g.current.position.set(
        phase === 0 ? k * 2 : phase === 5 ? 2 - k * 2 : 0,
        phase === 0 || phase === 5 ? 4 : phase === 1 ? (1 - k) * 6 : 0,
        0,
      );
    }
    astro.current.walk = phase === 3 ? 0.4 : 0;
    cam.current.from = {
      pos: phase === 0 || phase === 5 ? [10, 6, 13] : [9, 5, 14],
      look: [0, phase === 0 || phase === 5 ? 4 : 2, 0],
    };
    cam.current.to = {
      pos: phase === 0 || phase === 5 ? [8, 6, 11] : [7, 4, 12],
      look: [0, phase === 4 ? 5 : phase === 0 || phase === 5 ? 4 : 2, 0],
    };
    cam.current.k = k;
  });
  return (
    <>
      <ambientLight intensity={1} />
      <directionalLight position={[6, 8, 5]} intensity={2} />
      <group visible={phase > 0 && phase < 5}>
        <MoonGround radius={30} />
        <Earth radius={1} position={[-9, 9, -20]} />
      </group>
      <group ref={g}>
        <Eagle ctl={ctl} part={phase === 5 ? "ascent" : "all"} />
      </group>
      {(phase === 0 || phase === 5) && (
        <group position={[-1, 6, 0]} scale={0.8}>
          <Columbia />
        </group>
      )}
      {phase === 3 && (
        <group position={[2, 0, 3]}>
          <Apollonaut driver={astro} />
        </group>
      )}
    </>
  );
}
export function ReconstructionReplay({
  mission,
}: {
  mission: MissionDefinition;
}) {
  const [phase, setPhase] = useState(0),
    [paused, setPaused] = useState(false);
  const cam = useRef(newCam({ pos: [10, 6, 13], look: [0, 3, 0] }));
  useEffect(() => {
    if (
      motion.reduced ||
      paused ||
      phase >= mission.reconstruction.timeline.length - 1
    )
      return;
    const t = setTimeout(() => setPhase((n) => n + 1), 2400);
    return () => clearTimeout(t);
  }, [phase, paused]);
  return (
    <Card>
      <h2>Your reconstructed journey</h2>
      <Tag kind="imagine" />
      <div className="m-replay">
        <Stage look="moon" cam={cam} sky="#070B18">
          <ReplayWorld cam={cam} phase={phase} />
        </Stage>
      </div>
      <FactText line={mission.reconstruction.timeline[phase].fact} />
      <div className="m-actions">
        <Button onClick={() => setPaused(!paused)}>
          {paused ? "Play replay" : "Pause replay"}
        </Button>
        <Button
          onClick={() =>
            setPhase((phase + 1) % mission.reconstruction.timeline.length)
          }
        >
          Next replay card
        </Button>
      </div>
    </Card>
  );
}
export default function Reconstruction({
  mission,
  state,
}: {
  mission: MissionDefinition;
  state: MissionState;
}) {
  const [holding, setHolding] = useState(false);
  const assembly = useRef<HTMLButtonElement>(null);
  const stage = mission.reconstruction.stages.find(
    (stage) => !state.labels.includes(stage.id),
  );
  useIntentScope(
    ["pointer", "grab", "pinch", "dial", "swipe"],
    { walk: false },
    "reconstruction",
  );
  useIntent("reconstructionPick", () => setHolding(true));
  useIntent("grab", (e) => {
    if (document.elementFromPoint(e.x, e.y)?.closest("[data-ascent-piece]"))
      setHolding(true);
  });
  useIntent("release", (e) => {
    const r = assembly.current?.getBoundingClientRect();
    if (
      holding &&
      r &&
      e.x >= r.left &&
      e.x <= r.right &&
      e.y >= r.top &&
      e.y <= r.bottom
    ) {
      command(mission, { type: "assemble" });
      setHolding(false);
      play("correct");
    }
  });
  useEffect(() => {
    if (state.assembled) play("chime");
  }, [state.assembled]);
  const [showHow, setShowHow] = useState(() => !howToSeen("rebuild"));
  const nextCard = mission.reconstruction.timeline[state.timeline.length];
  return (
    <section className="m-page od-free" aria-label="Reconstruction">
      {showHow && (
        <HowTo
          id="rebuild"
          kicker="Game · Rebuild the journey"
          title="Put Eagle back together!"
          goal="Rebuild the lander, name its parts, then put its trip in the right order."
          voice="Let's rebuild Eagle! Stack the lander, name its parts, then put the trip in order."
          steps={[
            { icon: "🧩", text: "Stack the top on the bottom" },
            { icon: "🏷️", text: "Name each part" },
            { icon: "🗓️", text: "Put the trip in order" },
          ]}
          onStart={() => setShowHow(false)}
        />
      )}
      <header className="m-heading">
        <h1 data-mission-heading tabIndex={-1}>
          {mission.reconstruction.prompt}
        </h1>
      </header>
      <div className="m-grid">
        <div>
          <InspectionStage
            artifact={{
              modelRef: mission.reconstruction.modelRef,
              components: [],
            }}
            assembled={state.assembled}
          />
          <InspectTools />
          <Tag kind="imagine" />
        </div>
        <Card>
          {!state.assembled ? (
            <>
              <h2>Bring both stages together</h2>
              <p>Grab the upper stage, then place it on the lower stage.</p>
              <div className="m-actions">
                <Button
                  data-ascent-piece
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", "ascent");
                    intents.emit("reconstructionPick", {}, intents.lastSource);
                  }}
                  aria-label="Grab ascent stage"
                  aria-pressed={holding}
                  onClick={() =>
                    intents.emit("reconstructionPick", {}, intents.lastSource)
                  }
                >
                  <FactText
                    line={
                      mission.reconstruction.stages.find(
                        (s) => s.id === "ascent",
                      )!.name
                    }
                    compact
                  />
                </Button>
                <Button
                  ref={assembly}
                  aria-label="Snap onto descent stage"
                  disabled={!holding}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.getData("text/plain") === "ascent")
                      command(mission, { type: "assemble" });
                  }}
                  onClick={() =>
                    holding && command(mission, { type: "assemble" })
                  }
                >
                  <FactText
                    line={
                      mission.reconstruction.stages.find(
                        (s) => s.id === "descent",
                      )!.name
                    }
                    compact
                  />
                </Button>
              </div>
            </>
          ) : stage ? (
            <>
              <h2>Give each stage its job</h2>
              <FactText line={stage.name} />
              <div className="m-clues">
                {[...mission.reconstruction.stages].reverse().map((answer) => (
                  <Action
                    key={answer.id}
                    mission={mission}
                    action={{
                      type: "label",
                      stage: stage.id,
                      answer: answer.id,
                    }}
                    aria-label={`Assign ${answer.id} function`}
                    className={
                      state.hintLevel >= 2 && stage.id === answer.id
                        ? "m-highlight"
                        : ""
                    }
                  >
                    <FactText line={answer.function} compact />
                  </Action>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>Restore the journey's order</h2>
              <p>
                {state.timeline.length} /{" "}
                {mission.reconstruction.timeline.length} timeline cards placed
              </p>
              {state.timeline.map((id, i) => (
                <p key={id}>
                  {i + 1}.{" "}
                  <FactText
                    line={
                      mission.reconstruction.timeline.find((t) => t.id === id)!
                        .fact
                    }
                  />
                </p>
              ))}
            </>
          )}
          <div className="m-status" role="status">
            {state.feedback ||
              "Each stage has a different job. Take your time."}
          </div>
          {!state.reconstructionDone && (
            <>
              <Action mission={mission} action={{ type: "hint" }}>
                Ask for a hint
              </Action>
              {state.hintLevel > 0 && (
                <div className="m-hint">
                  <FactText
                    line={
                      mission.reconstruction.hints[
                        Math.min(2, state.hintLevel - 1)
                      ]
                    }
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      {state.assembled &&
        state.labels.length === mission.reconstruction.stages.length &&
        !state.reconstructionDone && (
          <div className="m-timeline">
            {[...mission.reconstruction.timeline].reverse().map((t) => (
              <Action
                key={t.id}
                mission={mission}
                action={{ type: "timeline", id: t.id }}
                aria-label={`Timeline ${t.id}`}
                disabled={state.timeline.includes(t.id)}
                className={
                  state.hintLevel >= 2 && t.id === nextCard?.id
                    ? "m-highlight"
                    : ""
                }
              >
                <FactText line={t.fact} compact />
              </Action>
            ))}
          </div>
        )}
      {state.reconstructionDone && (
        <>
          <ReconstructionReplay mission={mission} />
          <div className="m-actions">
            <Action
              mission={mission}
              action={{ type: "next" }}
              variant="primary"
            >
              Continue to discovery
            </Action>
          </div>
        </>
      )}
    </section>
  );
}
