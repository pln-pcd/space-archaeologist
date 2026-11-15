import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Button, Card } from "../odyssey/ui/kit";
import { intents, useIntent } from "../input/bus";
import { useInspectionScope, FactText } from "./ui";
import { ArtifactModel, InspectionStage, InspectTools } from "./ArtifactModel";
import { command } from "./session";
import type { MissionDefinition, MissionState } from "./types";
export default function Archive({
  mission,
  state,
  embedded = false,
  onClose,
}: {
  mission: MissionDefinition;
  state: MissionState;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [note, setNote] = useState("");
  const artifact = mission.artifacts.find(
    (a) => a.id === selected && state.archive.includes(a.id),
  );
  useInspectionScope();
  useIntent("archiveSelect", (e) =>
    setSelected(state.archive.includes(e.id) ? e.id : null),
  );
  useEffect(
    () => setNote(artifact ? (state.notes[artifact.id] ?? "") : ""),
    [artifact?.id],
  );
  return (
    <section
      className={embedded ? "m-archive od-free" : "m-page m-archive od-free"}
      aria-label="Space Archive"
    >
      {!embedded && (
        <header className="m-heading">
          <div>
            <small>
              Your personal collection · {state.archive.length} / {mission.artifacts.length}
            </small>
            <h1 data-mission-heading tabIndex={-1}>
              Space Archive
            </h1>
          </div>
        </header>
      )}
      {!artifact ? (
        <>
          <div className="ac-top">
            <span className="ac-count">
              <b>{state.archive.length}</b> / {mission.artifacts.length} found
            </span>
            <p>{state.archive.length ? "Tap a case to revisit its story." : "Finish the Moon mission to fill these cases!"}</p>
          </div>
          <div className="ac-grid">
            {mission.artifacts.map((a) => {
              const got = state.archive.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`ac-case ${got ? "got" : ""}`}
                  disabled={!got}
                  aria-label={got ? `Open archive ${a.id}` : `${a.name.text}: still sealed`}
                  onClick={() => intents.emit("archiveSelect", { id: a.id }, intents.lastSource)}
                >
                  <span className="ac-glass">
                    <Canvas frameloop="demand" dpr={1} camera={{ position: [4, 3, 7], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
                      <ambientLight intensity={1.5} />
                      <directionalLight position={[3, 5, 4]} intensity={2} />
                      <Suspense fallback={null}>
                        <ArtifactModel modelRef={a.modelRef} hologram={!got} />
                      </Suspense>
                    </Canvas>
                    {!got && <span className="ac-lock" aria-hidden="true">?</span>}
                  </span>
                  <strong>{a.name.text}</strong>
                  <span className={`ac-pill ${got ? "got" : ""}`}>{got ? "Open record" : "Sealed"}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="m-grid">
            <div>
              <InspectionStage artifact={artifact} />
              <InspectTools />
              <figure className="m-photo">
                <img
                  src={artifact.photo.src}
                  alt={artifact.photo.caption.text}
                />
                <figcaption>
                  <FactText line={artifact.photo.caption} />
                  <FactText line={artifact.photo.credit} />
                </figcaption>
              </figure>
            </div>
            <Card>
              <h2>
                <FactText line={artifact.name} />
              </h2>
              <h3>Original mission</h3>
              <FactText line={artifact.originalMission} />
              <h3>Purpose</h3>
              <FactText line={artifact.purpose} />
              <h3>Why it stayed · {artifact.leftBehindReason.category}</h3>
              <FactText line={artifact.leftBehindReason.fact} />
              <h3>Scientific significance</h3>
              <FactText line={artifact.significance} />
              <label className="m-note">
                Your notes, just for you
                <textarea
                  aria-label="My archive note"
                  value={note}
                  maxLength={240}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What surprised you?"
                />
              </label>
              <Button
                onClick={() =>
                  command(mission, {
                    type: "note",
                    id: artifact.id,
                    text: note,
                  })
                }
              >
                Save my note
              </Button>
              <p className="m-status" role="status">
                {state.feedback || "Your notes stay on this device."}
              </p>
              <Button
                onClick={() =>
                  intents.emit("archiveSelect", { id: "" }, intents.lastSource)
                }
              >
                All archive cases
              </Button>
            </Card>
          </div>
        </>
      )}
      {onClose && !embedded && (
        <div className="m-actions">
          <Button variant="primary" onClick={onClose}>
            Back to the ship
          </Button>
        </div>
      )}
    </section>
  );
}
