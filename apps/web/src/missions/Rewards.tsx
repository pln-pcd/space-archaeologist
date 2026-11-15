import { useEffect, useState } from "react";
import { Button, Card, burst } from "../odyssey/ui/kit";
import { StampEagle } from "../ui/stamps";
import { stampThunk } from "../odyssey/fx/juice";
import { nova } from "../odyssey/nova/state";
import { play } from "../audio/sfx";
import { motion } from "../anim/kit";
import { command } from "./session";
import { SpokenLine } from "./ui";
import type { MissionDefinition, MissionState } from "./types";
export default function Rewards({
  mission,
  state,
}: {
  mission: MissionDefinition;
  state: MissionState;
}) {
  const [points, setPoints] = useState(0),
    [warp, setWarp] = useState(true);
  // v7.7: the report quiz is gone, so stars come from how much help the explorer needed
  const stars = state.hints === 0 ? 3 : state.hints <= 4 ? 2 : 1;
  useEffect(() => {
    play("chime");
    nova.act("jump");
    const t = setTimeout(() => setWarp(false), 1400);
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const k = motion.reduced
        ? 1
        : Math.min(1, (performance.now() - start) / 1100);
      setPoints(Math.round(mission.rewards.points * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, []);
  const stamp = () => {
    play("stampSlam", 1, 0.6);
    stampThunk();
    nova.act("jump");
    burst(innerWidth * 0.5, innerHeight * 0.45, 24);
    command(mission, { type: "stamp" });
  };
  return (
    <section className="m-page od-free" aria-label="Mission completion">
      {warp && <div className="m-warp" aria-hidden="true" />}
      <header className="m-heading">
        <h1 data-mission-heading tabIndex={-1}>
          Welcome home, Storykeeper!
        </h1>
      </header>
      <Card className="results-card ch1-results m-rewards" stitched>
        <SpokenLine
          line={{
            kind: "imagine",
            text: "You found the stories machines left behind. Let's preserve them together!",
          }}
        />
        <p className="m-stars" aria-label={`${stars} of 3 stars`}>
          {"★".repeat(stars)}
          {"☆".repeat(3 - stars)}
        </p>
        <h2>{mission.rewards.badge}</h2>
        <p aria-live="off">{points} discovery points</p>
        <p>
          {state.records.length} investigations · {state.hints} hints
        </p>
        <p>Your artifact miniatures are ready for the Space Archive shelf.</p>
        <Button
          aria-label="Stamp my archaeology passport"
          variant="primary"
          onClick={stamp}
        >
          <StampEagle size={96} />
          Stamp my passport
        </Button>
      </Card>
    </section>
  );
}
