// Adapted from before-new-flow:chapters/ch1-moon-eagle/LaserBounce.tsx.
// Keep the real 2.5-second echo, three rounds, wider aim after misses and no failure state.
import { useEffect, useRef, useState } from "react";
import { Button, Tag } from "../odyssey/ui/kit";
import { intents, useIntent } from "../input/bus";
import { play } from "../audio/sfx";
import { command } from "./session";
import { FactText } from "./ui";
import type { Artifact, MissionDefinition } from "./types";

export default function Activity({
  mission,
  artifact,
  complete,
}: {
  mission: MissionDefinition;
  artifact: Artifact;
  complete: boolean;
}) {
  const [round, setRound] = useState(0),
    [misses, setMisses] = useState(0),
    [echo, setEcho] = useState(0),
    [live, setLive] = useState(false),
    [wiggle, setWiggle] = useState(0);
  const pending = useRef(false),
    raf = useRef(0),
    target = useRef<HTMLButtonElement>(null);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const done = () => command(mission, { type: "activity", id: artifact.id });
  const fire = (hit = true) => {
    if (pending.current || complete) return;
    if (!hit) {
      setMisses((n) => n + 1);
      play("soft", 0.9, 0.4);
      return;
    }
    pending.current = true;
    setLive(true);
    const t0 = performance.now();
    play("whoosh", 1.6, 0.4);
    const tick = () => {
      const seconds = Math.min(2.5, (performance.now() - t0) / 1000);
      setEcho(seconds);
      if (seconds < 2.5) raf.current = requestAnimationFrame(tick);
      else {
        pending.current = false;
        setLive(false);
        play("returnPing");
        setRound((n) => n + 1);
        if (round >= 2) done();
      }
    };
    raf.current = requestAnimationFrame(tick);
  };
  useIntent("activityControl", (e) => {
    if (e.artifactId !== artifact.id) return;
    if (e.action === "fire") fire();
    if (e.action === "tap") {
      // v8 Mars activities take three taps; the Moon ones finish on the first
      const mars = artifact.activity === "solar" || artifact.activity === "airbag" || artifact.activity === "chute";
      setWiggle((n) => {
        if (!mars || n + 1 >= 3) done();
        return n + 1;
      });
      play(artifact.activity === "airbag" ? "landThud" : artifact.activity === "solar" ? "whoosh" : "soft", artifact.activity === "airbag" ? 1.1 : 0.9, 0.35);
    }
  });
  useIntent("pinchStart", (e) => {
    if (e.source !== "gesture" || artifact.activity !== "laser") return;
    const r = target.current?.getBoundingClientRect();
    if (r)
      fire(
        Math.hypot(e.x - r.left - r.width / 2, e.y - r.top - r.height / 2) <
          r.width / 2 + misses * 25,
      );
  });
  const emit = (action: string) =>
    intents.emit(
      "activityControl",
      { artifactId: artifact.id, action },
      intents.lastSource,
    );
  if (artifact.activity === "laser")
    return (
      <div className="m-activity">
        <h3>Laser Ping</h3>
        <FactText line={artifact.activityFact!} />
        <div className="m-beam-stage">
          <svg viewBox="0 0 500 160" aria-hidden="true">
            <circle cx="420" cy="45" r="28" fill="#B8C0CD" />
            <path d="M50 140l35-60 24 10-30 50" fill="#5BB8FF" />
            {(live || echo === 2.5) && (
              <line
                x1={echo > 1.25 ? 420 : 80}
                y1={echo > 1.25 ? 45 : 95}
                x2={echo > 1.25 ? 80 : 420}
                y2={echo > 1.25 ? 95 : 45}
                stroke="#9FFFF0"
              />
            )}
          </svg>
        </div>
        <div className="m-progress">
          <i style={{ width: `${(echo / 2.5) * 100}%` }} />
        </div>
        <p role="timer">
          {echo.toFixed(1)} s · {Math.min(3, round)} / 3 pings
        </p>
        <Button
          ref={target}
          disabled={live || complete}
          variant="sky"
          onClick={() => emit("fire")}
          aria-label="Send laser ping"
        >
          {complete ? "Echo recorded" : "Send laser ping"}
        </Button>
        {misses > 0 && (
          <p>Almost. Aim for the reflector. Your target grows with each try.</p>
        )}
      </div>
    );
  // v8 MARS: three tiny "do it yourself" moments, each with its sourced fact
  if (artifact.activity === "solar" || artifact.activity === "airbag" || artifact.activity === "chute") {
    const n = Math.min(3, wiggle);
    const k = n / 3;
    const T = { solar: ["Wipe the dust", "Be the wind: blow the dust off the panel.", "Blow the wind"], airbag: ["Bounce the airbags", "Help the lander bounce safely onto Mars.", "Bounce!"], chute: ["Open the parachute", "Slow the lander down before it lands.", n ? "Slow down more" : "Open the parachute"] }[artifact.activity];
    return (
      <div className="m-activity m-mars-act">
        <h3>{T[0]}</h3>
        {artifact.activityFact && <FactText line={artifact.activityFact} />}
        <p>{T[1]}</p>
        <svg className="m-mars-svg" viewBox="0 0 300 110" aria-hidden="true">
          <rect x="0" y="86" width="300" height="24" fill="#C9875E" />
          {artifact.activity === "solar" && (
            <g>
              <rect x="60" y="30" width="180" height="50" rx="6" fill="#2E4BA8" stroke="#241D48" strokeWidth="3" />
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1={60 + i * 36} y1="30" x2={60 + i * 36} y2="80" stroke="#7FA0FF" strokeWidth="1.5" />
              ))}
              <rect x="60" y="30" width="180" height="50" rx="6" fill="#B07C55" opacity={0.85 * (1 - k)} style={{ transition: "opacity .5s" }} />
              {n > 0 && n < 3 && <path key={n} className="m-gust" d="M20 40 q40 -14 80 0 t80 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />}
            </g>
          )}
          {artifact.activity === "airbag" && (
            <g key={n} className={n ? "m-bounce" : ""}>
              <circle cx={60 + k * 170} cy="62" r="22" fill="#EFE7D8" stroke="#241D48" strokeWidth="3" />
              <circle cx={50 + k * 170} cy="56" r="7" fill="#fff" opacity="0.7" />
            </g>
          )}
          {artifact.activity === "chute" && (
            <g style={{ transform: `translateY(${k * 34}px)`, transition: "transform .6s" }}>
              {n > 0 && <path d={`M${150 - 22 - n * 8} 26 Q150 ${-6 - n * 4} ${150 + 22 + n * 8} 26 Z`} fill="#F4F0FF" stroke="#241D48" strokeWidth="3" />}
              {n > 0 && <path d="M130 26 L150 44 L170 26" fill="none" stroke="#241D48" strokeWidth="1.5" />}
              <ellipse cx="150" cy="50" rx="16" ry="9" fill="#5B4A7A" stroke="#241D48" strokeWidth="3" />
            </g>
          )}
        </svg>
        <div className="m-progress">
          <i style={{ width: `${k * 100}%` }} />
        </div>
        <Button onClick={() => emit("tap")} variant="secondary" disabled={complete}>
          {complete ? "Discovery recorded!" : `${T[2]} (${n}/3)`}
        </Button>
      </div>
    );
  }
  if (artifact.activity === "seismic")
    return (
      <div className="m-activity">
        <h3>Feel the ground</h3>
        <Tag kind="imagine" />
        <p>Tap our pretend ground. Watch a seismograph demonstration.</p>
        <svg
          className="m-seismograph"
          viewBox="0 0 600 100"
          aria-label="Demonstration seismograph"
        >
          <polyline
            key={wiggle}
            className={wiggle ? "m-wave" : ""}
            points={Array.from(
              { length: 80 },
              (_, i) =>
                `${i * 8},${50 + (wiggle ? Math.sin(i * 2) * Math.exp(-Math.abs(i - 30) / 13) * 38 : 0)}`,
            ).join(" ")}
            fill="none"
            stroke="#8EE6C4"
            strokeWidth="2"
          />
        </svg>
        <Button onClick={() => emit("tap")}>Tap the ground</Button>
      </div>
    );
  return (
    <div className="m-activity">
      <h3>
        {artifact.activity === "message"
          ? "Read the message"
          : "Test the landing legs"}
      </h3>
      <Tag kind="imagine" />
      <p>
        {artifact.activity === "message"
          ? "Imagine sharing a peaceful message with tomorrow's explorers."
          : "Try a gentle touchdown with our model lander."}
      </p>
      <Button onClick={() => emit("tap")} variant="secondary">
        {artifact.activity === "message"
          ? "Preserve the message"
          : "Try a soft touchdown"}
      </Button>
      {complete && <p>Discovery recorded!</p>}
    </div>
  );
}
