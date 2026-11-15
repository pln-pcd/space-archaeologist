import { useState } from "react";
import { intents, useIntent, useIntentScope } from "../input/bus";
import { command } from "./session";
import { Action } from "./ui";
import HowTo, { howToSeen } from "./HowTo";
import "./evidence.css";
import EvidenceQuiz from "./EvidenceQuiz";
import type { Artifact, MissionDefinition, MissionState } from "./types";

/** v7.6: playing = the finger-count quiz (EvidenceQuiz); review = the saved board below */
export default function EvidenceBoard(props: { mission: MissionDefinition; artifact: Artifact; state: MissionState; review?: boolean }) {
  return props.review ? <EvidenceReview {...props} /> : <EvidenceQuiz mission={props.mission} artifact={props.artifact} state={props.state} />;
}

function EvidenceReview({
  mission,
  artifact,
  state,
  review = false,
}: {
  mission: MissionDefinition;
  artifact: Artifact;
  state: MissionState;
  review?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const pinned = state.evidence[artifact.id] ?? [];
  useIntentScope(
    ["pointer", "grab", "pinch"],
    { walk: false },
    "evidence-board",
  );
  useIntent("evidencePick", (e) => setSelected(e.id));
  useIntent("grab", (e) => {
    const card = document
      .elementFromPoint(e.x, e.y)
      ?.closest<HTMLElement>("[data-evidence-card]");
    if (card?.dataset.evidenceCard) setSelected(card.dataset.evidenceCard);
  });
  const place = (card: string, slot: string) => {
    command(mission, { type: "match", card, slot });
    setSelected(null);
  };
  useIntent("release", (e) => {
    const slot = document
      .elementFromPoint(e.x, e.y)
      ?.closest<HTMLElement>("[data-evidence-slot]");
    if (selected && slot?.dataset.evidenceSlot)
      place(selected, slot.dataset.evidenceSlot);
  });
  const choose = (id: string) =>
    intents.emit("evidencePick", { id }, intents.lastSource);
  const pairs = artifact.components.slice(0, 2);
  const complete =
    artifact.evidence.every((c) => pinned.includes(c.id)) &&
    pairs.every((c) => pinned.includes(`pair:${c.id}`));
  const allPinned = artifact.evidence.every((c) => pinned.includes(c.id));
  const [how, setHow] = useState(() => !review && !howToSeen("evidence"));
  // v7.5: one screen (no page scroll): clue cards on the left, the corkboard on the right, the
  // historical photo pinned as a polaroid; the part-to-job round replaces the clue pile when ready
  return (
    <section className={`eb ${review ? "review" : ""} od-free`} aria-label="Evidence board">
      {how && (
        <HowTo
          id="evidence"
          kicker="Game · Evidence board"
          title="Pin the story together"
          goal={`Every clue about the ${artifact.name.text} has a place on the board.`}
          voice="Pin the story together! Pick a clue, then pick its place on the board."
          steps={[
            { icon: "🃏", text: "Pick a clue card" },
            { icon: "📌", text: "Pick its place on the board" },
            { icon: "🔗", text: "Then match each part to its job" },
          ]}
          onStart={() => setHow(false)}
        />
      )}
      <header className="eb-head">
        <small>{review ? "Saved investigation" : "Evidence board"}</small>
        <h1 data-mission-heading tabIndex={-1}>
          {artifact.name.text}
        </h1>
      </header>
      <div className="eb-grid">
        <div className="eb-pile g-panel">
          <h2>{allPinned ? "Match each part to its job" : "Clue cards"}</h2>
          {!allPinned &&
            artifact.evidence.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`eb-card ${selected === c.id ? "on" : ""} ${pinned.includes(c.id) ? "used" : ""}`}
                data-evidence-card={c.id}
                aria-label={`Choose evidence ${c.slot}`}
                aria-pressed={selected === c.id}
                disabled={pinned.includes(c.id) || review}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", c.id);
                  choose(c.id);
                }}
                onClick={() => choose(c.id)}
              >
                {c.fact.kind === "fact" && <i className="eb-true" title="True story" aria-label="True story" />}
                <span>{c.fact.text}</span>
              </button>
            ))}
          {allPinned && (
            <div className="eb-pairs">
              <div>
                {pairs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`eb-card part ${selected === `part:${c.id}` ? "on" : ""} ${pinned.includes(`pair:${c.id}`) ? "used" : ""}`}
                    data-evidence-card={`part:${c.id}`}
                    aria-label={`Choose component ${c.id}`}
                    aria-pressed={selected === `part:${c.id}`}
                    disabled={pinned.includes(`pair:${c.id}`) || review}
                    onClick={() => choose(`part:${c.id}`)}
                  >
                    <span>{c.name.text}</span>
                  </button>
                ))}
              </div>
              <div>
                {[...pairs].reverse().map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`eb-slot job ${pinned.includes(`pair:${c.id}`) ? "pinned" : ""}`}
                    data-evidence-slot={`job:${c.id}`}
                    aria-label={`Match function ${c.id}`}
                    disabled={review}
                    onClick={() => selected && place(selected, `job:${c.id}`)}
                  >
                    <span>{c.function.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="eb-board">
          {mission.evidenceSlots.map((slot) => {
            const card = artifact.evidence.find((c) => c.slot === slot.id)!;
            const filled = pinned.includes(card.id);
            return (
              <button
                key={slot.id}
                type="button"
                className={`eb-slot ${filled ? "pinned" : ""} ${selected && !filled ? "ready" : ""} ${state.hintLevel >= 2 && selected === card.id ? "m-highlight" : ""}`}
                data-evidence-slot={slot.id}
                aria-label={`Place evidence ${slot.id}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  place(e.dataTransfer.getData("text/plain"), slot.id);
                }}
                disabled={review || filled}
                onClick={() => selected && place(selected, slot.id)}
              >
                <i className="eb-pin" aria-hidden="true" />
                <small>{slot.label}</small>
                {filled ? <span>{card.fact.text}</span> : <em>?</em>}
              </button>
            );
          })}
          <figure className="eb-photo">
            <img src={artifact.photo.src} alt={artifact.photo.caption.text} />
            <figcaption>
              {artifact.photo.caption.text} · {artifact.photo.credit.text}
            </figcaption>
          </figure>
        </div>
      </div>
      {!review && (
        <footer className="eb-foot">
          <div className={`eb-status ${state.feedback.startsWith("Almost") ? "m-wobble" : ""}`} role="status">
            {state.feedback || (allPinned ? "Now match each part to its job." : selected ? "Now pick its place on the board." : "Pick a clue card.")}
          </div>
          <Action mission={mission} action={{ type: "hint" }} className="eb-hint">
            Hint
          </Action>
          <Action mission={mission} action={{ type: "next" }} variant="primary" disabled={!complete}>
            Save it!
          </Action>
        </footer>
      )}
    </section>
  );
}
