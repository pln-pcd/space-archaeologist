// Memory Catch's preserved rules: first-try stars, helpful retries and Nova assistance.
// The old AR mirror is optional; all report actions share the current Intent Bus.
import { useRef, useState } from "react";
import HowTo, { howToSeen } from "./HowTo";
import { Canvas } from "@react-three/fiber";
import { Card, Button } from "../odyssey/ui/kit";
import { useIntent, useIntentScope, intents } from "../input/bus";
import { ArtifactModel } from "./ArtifactModel";
import { Action, FactText, SpokenLine } from "./ui";
import { command } from "./session";
import type { MissionDefinition, MissionState } from "./types";

export default function Challenge({
  mission,
  state,
}: {
  mission: MissionDefinition;
  state: MissionState;
}) {
  const [held, setHeld] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(() => !howToSeen("report"));
  const question = mission.challenge[state.questionIndex];
  useIntentScope(
    ["pointer", "pinch", "grab"],
    { walk: false },
    "mission-report",
  );
  const report = useRef<HTMLButtonElement>(null);
  const send = (id: string) => command(mission, { type: "answer", id });
  useIntent("grab", (e) => {
    const card = document
      .elementFromPoint(e.x, e.y)
      ?.closest<HTMLElement>("[data-report-option]");
    if (card?.dataset.reportOption) setHeld(card.dataset.reportOption);
  });
  useIntent("release", (e) => {
    const r = report.current?.getBoundingClientRect();
    if (
      held &&
      r &&
      e.x >= r.left &&
      e.x <= r.right &&
      e.y >= r.top &&
      e.y <= r.bottom
    ) {
      send(held);
      setHeld(null);
    }
  });
  useIntent("choose", (e) => {
    const option = question?.options[e.index];
    if (option) send(option.id);
  });
  if (state.challengeDone)
    return (
      <section className="m-page od-free">
        <header className="m-heading">
          <h1 data-mission-heading tabIndex={-1}>
            Report received!
          </h1>
        </header>
        <Card className="m-rewards">
          <p>
            Mission Control has your discoveries. Let's bring their stories
            aboard.
          </p>
          <Action mission={mission} action={{ type: "next" }} variant="primary">
            Return through warp
          </Action>
        </Card>
      </section>
    );
  const assisted =
    state.hintLevel >= 2 || (state.attempts[question.id] ?? 0) >= 2;
  return (
    <section className="m-page od-free" aria-label="Mission challenge">
      {showHow && (
        <HowTo
          id="report"
          kicker="Game · Mission report"
          title="Report to Mission Control!"
          goal="Answer a few questions about what you discovered. No rush, and Nova can help."
          voice="Report to Mission Control! Answer the questions about your discoveries."
          steps={[
            { icon: "📖", text: "Read the question" },
            { icon: "👆", text: "Pick the answer" },
            { icon: "💡", text: "Stuck? Ask for a hint" },
          ]}
          onStart={() => setShowHow(false)}
        />
      )}
      <header className="m-heading">
        <div>
          <small>
            Mission Challenge · {state.questionIndex + 1} /{" "}
            {mission.challenge.length}
          </small>
          <h1 data-mission-heading tabIndex={-1}>
            Mission Control needs your report!
          </h1>
        </div>
      </header>
      <Card>
        <SpokenLine line={question.prompt} />
        <p>
          {question.format === "order"
            ? "Choose the next card in the journey."
            : question.format === "match"
              ? "Match the job. Drag your answer onto the report, or select it."
              : question.format === "select"
                ? "Select the object. A click, tap, or Star Pointer works."
                : "Choose the answer that fits your evidence."}
        </p>
        <div className="m-report-options">
          {question.options.map((o) => (
            <Action
              key={o.id}
              mission={mission}
              action={{ type: "answer", id: o.id }}
              data-report-option={o.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", o.id);
                setHeld(o.id);
              }}
              aria-label={`Answer ${o.id}`}
              disabled={state.questionParts.includes(o.id)}
              className={
                assisted && o.id === question.answer[state.questionParts.length]
                  ? "m-highlight"
                  : ""
              }
            >
              {question.format === "select" && (
                <div className="m-object">
                  <Canvas
                    frameloop="demand"
                    dpr={1}
                    camera={{ position: [3, 2, 5], fov: 40 }}
                    onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
                  >
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[3, 5, 4]} intensity={2} />
                    <ArtifactModel
                      modelRef={
                        mission.artifacts.find((a) => a.id === o.id)
                          ?.modelRef ?? o.id
                      }
                    />
                  </Canvas>
                </div>
              )}
              <FactText line={o.label} compact />
            </Action>
          ))}
        </div>
        {question.format === "match" && (
          <Button
            ref={report}
            className="m-slot"
            aria-label="Drop answer on report"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              send(e.dataTransfer.getData("text/plain"));
            }}
            onClick={() => held && send(held)}
          >
            Pin the matched job here
          </Button>
        )}
        <div className="m-status" role="status">
          {state.feedback === question.explanation.text ? (
            <FactText line={question.explanation} />
          ) : (
            state.feedback ||
            "Every explorer completes the report. You can ask Nova for help."
          )}
        </div>
        <Action mission={mission} action={{ type: "hint" }}>
          Ask for a hint
        </Action>
      </Card>
    </section>
  );
}
