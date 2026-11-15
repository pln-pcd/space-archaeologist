import { Card } from "../odyssey/ui/kit";
import { Action, SpokenLine } from "./ui";
import { InspectionStage } from "./ArtifactModel";
import type { MissionDefinition, MissionState } from "./types";
export default function Discovery({
  mission,
  state,
}: {
  mission: MissionDefinition;
  state: MissionState;
}) {
  return (
    <section className="m-page od-free" aria-label="Scientific discovery">
      <header className="m-heading">
        <div>
          <small>
            Scientific discovery · {state.discoveryIndex + 1} /{" "}
            {mission.discovery.length}
          </small>
          <h1 data-mission-heading tabIndex={-1}>
            What the evidence tells us
          </h1>
        </div>
      </header>
      <div className="m-grid">
        <InspectionStage
          artifact={{
            modelRef:
              state.discoveryIndex >= mission.discovery.length - 2
                ? "reflector"
                : "eagle",
            components: [],
          }}
        />
        <Card>
          <SpokenLine
            line={mission.discovery[state.discoveryIndex]}
            speaker="Narrator"
          />
          <div className="m-actions">
            <Action
              mission={mission}
              action={{ type: "next" }}
              variant="primary"
            >
              {state.discoveryIndex === mission.discovery.length - 1
                ? "Report to Mission Control"
                : "Next discovery"}
            </Action>
          </div>
        </Card>
      </div>
    </section>
  );
}
