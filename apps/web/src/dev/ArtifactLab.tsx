import { useState } from "react";
import { MOON } from "../missions/registry";
import { InspectionStage, InspectTools } from "../missions/ArtifactModel";
import { useInspectionScope, FactText } from "../missions/ui";
import { Button, Card } from "../odyssey/ui/kit";
import "../missions/missions.css";
export default function ArtifactLab() {
  const [index, setIndex] = useState(0),
    [hotspot, setHotspot] = useState<string | null>(null);
  useInspectionScope();
  const a = MOON.artifacts[index];
  return (
    <main className="m-page od-free">
      <header className="m-heading">
        <h1>Model + hotspot inspector</h1>
      </header>
      <nav className="m-actions">
        {MOON.artifacts.map((a, i) => (
          <Button
            key={a.id}
            onClick={() => {
              setIndex(i);
              setHotspot(null);
            }}
          >
            {a.name.text}
          </Button>
        ))}
      </nav>
      <InspectionStage artifact={a} onHotspot={setHotspot} />
      <InspectTools />
      <Card>
        <FactText line={a.name} />
        {a.components.map((c) => (
          <p
            key={c.id}
            style={{ background: hotspot === c.id ? "#FFD23F" : undefined }}
          >
            {c.id}: [{c.hotspotPosition.join(", ")}] · {c.clue.sourceId}
          </p>
        ))}
      </Card>
    </main>
  );
}
