// INVESTIGATE (v7.1): a real little archaeology dig.
//   1 DUST OFF   the find is buried in Moon dust: brush it away (drag the mouse/finger, or move your
//                pointing hand over it), or hold Space / E / an open palm to blow it off.
//   2 CLUES      glowing stars sit on the model: tap or pinch them; each one flips a clue card.
//   3 RECORD     enough clues unlock the record card and its mini activity, then the evidence board.
// A stepper shows where you are; everything fits one screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, Camera, Check, Play, Search, Sparkles, Volume2, Wind } from "lucide-react";
import { LiveCamera } from "../story/ch1/CameraCheck";
import HandTracker from "../ui/HandTracker";
import { GloveArt, type GlovePose } from "../ui/GloveSprite";
import { useInput } from "../input/store";
import { useIntent, useIntentScope } from "../input/bus";
import { InspectionStage, InspectTools } from "./ArtifactModel";
import { Action } from "./ui";
import { command } from "./session";
import Activity from "./Activities";
import { speak } from "../odyssey/nova/voice";
import { cute } from "../audio/cute";
import { burst } from "../odyssey/ui/kit";
import type { Artifact, MissionDefinition, MissionState } from "./types";
import "./investigate.css";
import HowTo, { howToSeen } from "./HowTo";

/** the dust layer: a painted regolith sheet over the stage that brushing erases */
function Dust({ onClean, blow }: { onClean: (k: number) => void; blow: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);
  const swish = useRef(0);
  // paint the dust once
  useEffect(() => {
    const c = cv.current!;
    const r = c.getBoundingClientRect();
    c.width = Math.max(200, Math.round(r.width));
    c.height = Math.max(150, Math.round(r.height));
    const x = c.getContext("2d")!;
    x.globalAlpha = 0.94;
    const g = x.createRadialGradient(c.width / 2, c.height / 2, 20, c.width / 2, c.height / 2, c.width * 0.7);
    g.addColorStop(0, "#BDB7C9");
    g.addColorStop(1, "#8F88A3");
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    let s = 3;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    x.globalAlpha = 1;
    for (let i = 0; i < 900; i++) {
      x.fillStyle = rnd() < 0.5 ? "rgba(70,62,92,0.18)" : "rgba(255,255,255,0.16)";
      x.beginPath();
      x.arc(rnd() * c.width, rnd() * c.height, 1 + rnd() * 3.5, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 14; i++) {
      x.strokeStyle = "rgba(60,52,84,0.18)";
      x.lineWidth = 2;
      x.beginPath();
      x.arc(rnd() * c.width, rnd() * c.height, 10 + rnd() * 30, 0, Math.PI * 2);
      x.stroke();
    }
  }, []);
  const measure = useCallback(() => {
    const c = cv.current;
    if (!c || done.current) return;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let clear = 0,
      n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) {
      n++;
      if (d[i] < 40) clear++;
    }
    const k = clear / Math.max(1, n);
    onClean(k);
    if (k > 0.55) done.current = true;
  }, [onClean]);
  const brushAt = (cx: number, cy: number, r0 = 38) => {
    const c = cv.current;
    if (!c || done.current) return;
    // v7.6: the brush grows with the (now bigger) stage, so a dig takes the same few strokes
    const r = Math.max(r0, c.width * 0.045);
    const b = c.getBoundingClientRect();
    const x = ((cx - b.left) / b.width) * c.width;
    const y = ((cy - b.top) / b.height) * c.height;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    const p = last.current ?? { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - p.x, y - p.y) / 10));
    for (let i = 1; i <= steps; i++) {
      const ix = p.x + ((x - p.x) * i) / steps,
        iy = p.y + ((y - p.y) * i) / steps;
      const g = ctx.createRadialGradient(ix, iy, 0, ix, iy, r);
      g.addColorStop(0, "rgba(0,0,0,0.9)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ix, iy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    last.current = { x, y };
    if (performance.now() - swish.current > 160) {
      swish.current = performance.now();
      cute.brush();
    }
  };
  // a hold (Space, E, long press, open palm) blows dust away from the middle outward
  useEffect(() => {
    const c = cv.current;
    if (!c || blow <= 0 || done.current) return;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    // v7.6: puffs scale with the (bigger) stage and spread across its whole width
    const pr = Math.max(34, c.width * 0.04);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * Math.min(c.width, c.height) * (0.15 + blow * 0.6);
      const x = c.width / 2 + Math.cos(a) * rr * (c.width / Math.max(1, c.height)),
        y = c.height / 2 + Math.sin(a) * rr;
      const g = ctx.createRadialGradient(x, y, 0, x, y, pr);
      g.addColorStop(0, "rgba(0,0,0,0.6)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    measure();
  }, [blow, measure]);
  // hands: a pointing glove brushes wherever it goes over the dust
  useIntent("pointer", (e) => {
    if (e.source !== "gesture" || !e.visible) return;
    const b = cv.current?.getBoundingClientRect();
    if (!b || e.x < b.left || e.x > b.right || e.y < b.top || e.y > b.bottom) return void (last.current = null);
    brushAt(e.x, e.y, 46);
  });
  useEffect(() => {
    const iv = setInterval(measure, 250);
    return () => clearInterval(iv);
  }, [measure]);
  return (
    <canvas
      ref={cv}
      className="iv-dust"
      aria-label="Moon dust covering the find. Drag to brush it away."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        down.current = true;
        last.current = null;
        brushAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => down.current && brushAt(e.clientX, e.clientY)}
      onPointerUp={() => ((down.current = false), (last.current = null))}
      onPointerCancel={() => ((down.current = false), (last.current = null))}
    />
  );
}

/** v8: the camera card on the left. Hands on: the live picture with the tracked hand drawn on it
 *  and the gestures for this step. Hands off: an invitation to turn the camera on (mouse works too). */
function CameraCard({ on, phase, name }: { on: boolean; phase: number; name: string }) {
  const tips: [GlovePose, string][] =
    phase === 0
      ? [
          ["point", "Point and sweep over the dust to brush it"],
          ["open", "Hold an open palm still to blow"],
        ]
      : [
          ["fist", `Make a fist and move it to turn the ${name}`],
          ["point", "Point at a glowing star"],
          ["pinch", "Pinch to open that part"],
        ];
  return (
    <aside className={`iv3-camcard g-panel ${on ? "on" : "off"}`} aria-label="Hand camera">
      {on ? (
        <>
          <div className="iv3-campic">
            <LiveCamera />
            <HandTracker />
            <span className="ht-live">
              <i /> Camera on
            </span>
          </div>
          <ul className="iv3-camtips">
            {tips.map(([pose, text]) => (
              <li key={text}>
                <GloveArt pose={pose} tone="idle" size={40} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="iv3-camoff">
          <GloveArt pose="open" tone="idle" size={92} />
          <h3>Use your hands!</h3>
          <p>Turn on the camera to brush, turn and open parts with gestures.</p>
          <button type="button" className="g-btn mint" onClick={() => dispatchEvent(new Event("od-open-hands"))}>
            <Camera size={20} strokeWidth={2.6} aria-hidden="true" /> Turn on camera
          </button>
          <small>Mouse and keys work too.</small>
        </div>
      )}
    </aside>
  );
}

export default function ArtifactInvestigation({ mission, artifact, state }: { mission: MissionDefinition; artifact: Artifact; state: MissionState }) {
  const scanned = state.scanned.includes(artifact.id),
    clues = state.clues[artifact.id] ?? [];
  const [clean, setClean] = useState(0);
  const [blow, setBlow] = useState(0);
  const [reveal, setReveal] = useState(false);
  useIntentScope(scanned ? ["pointer", "pinch", "grab", "dial", "swipe", "palmHold"] : ["pointer", "palmHold"], { walk: false }, "artifact-investigation");
  const finishDig = useCallback(() => {
    if (scanned) return;
    setReveal(true);
    cute.fanfare();
    const r = document.querySelector(".iv-stage")?.getBoundingClientRect();
    if (r) for (let i = 0; i < 4; i++) setTimeout(() => burst(r.left + r.width * (0.25 + Math.random() * 0.5), r.top + r.height * (0.3 + Math.random() * 0.4), 10), i * 120);
    setTimeout(() => command(mission, { type: "scan", id: artifact.id }), 650);
  }, [scanned, mission, artifact.id]);
  useIntent("palmHold", (e) => {
    if (scanned) return;
    setBlow(e.progress);
    if (e.progress > 0.02 && e.progress < 0.06) cute.scan();
  });
  useEffect(() => {
    if (!scanned && clean > 0.55) finishDig();
  }, [clean, scanned, finishDig]);
  const unlocked = clues.length >= artifact.cluesRequired;
  const latest = artifact.components.find((c) => c.id === clues.at(-1));
  useEffect(() => {
    if (latest) cute.coin();
  }, [latest?.id]);
  // the record reads itself once, in Nova's voice
  useEffect(() => {
    if (!unlocked) return;
    cute.jingle();
    const v = speak(artifact.summary.text);
    return v.stop;
  }, [unlocked, artifact.summary.text]);
  const phase = !scanned ? 0 : !unlocked ? 1 : 2;
  const [how, setHow] = useState(() => !scanned && !howToSeen("dig"));
  const steps = ["Dust it off", "Find the parts", "Unlock record"];
  const gloves = useInput((s) => s.mode === "gloves");
  // v7.6: the part card shows the part the kid last opened (a star, a chip or a pinch)
  const [sel, setSel] = useState<string | null>(null);
  const openPart = (id: string) => {
    setSel(id);
    if (!clues.includes(id)) command(mission, { type: "clue", id });
    else cute.pop();
  };
  const part = artifact.components.find((c) => c.id === (sel ?? clues.at(-1)));
  const partIndex = part ? artifact.components.indexOf(part) : -1;
  const activityDone = state.activities.includes(artifact.id);
  return (
    <section className="m-page od-free iv iv3" aria-label="Artifact investigation">
      {how && (
        <HowTo
          id="dig"
          kicker="Game · Dig it up"
          title="Something is buried!"
          goal="Archaeologists brush dust away very gently. Uncover what was left behind, then explore its parts."
          voice={`Something is buried here! Brush the ${mission.meta.id.startsWith("mars") ? "Mars" : "Moon"} dust away, then open its glowing parts to learn what they do.`}
          steps={[
            { icon: "🖌️", text: "Drag to brush the dust" },
            { icon: "✊", text: "Make a fist to turn it around" },
            { icon: "⭐", text: "Open the glowing parts" },
          ]}
          cta="Start digging!"
          onStart={() => setHow(false)}
        />
      )}
      <header className="iv-head">
        <h1 className="g-title" data-mission-heading tabIndex={-1}>
          {artifact.name.text}
        </h1>
        <ol className="iv-steps" aria-label="Investigation steps">
          {steps.map((s, i) => (
            <li key={s} className={i < phase ? "done" : i === phase ? "now" : ""}>
              <span>{i < phase ? <Check size={14} strokeWidth={4} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </header>
      <div className={`iv3-main phase-${phase}`}>
        <CameraCard on={gloves} phase={phase} name={artifact.name.text} />
        <div className="iv3-stage">
          <InspectionStage artifact={artifact} scan={scanned ? 1 : 0} onHotspot={scanned ? openPart : undefined} />
          {!scanned && !reveal && <Dust onClean={setClean} blow={blow} />}
          {!scanned && (
            <div className={`iv-dig-hud ${reveal ? "yay" : ""}`}>
              {reveal ? (
                <strong>
                  <Sparkles size={20} /> You found it!
                </strong>
              ) : (
                <>
                  <span className="iv-meter" style={{ ["--k" as string]: Math.min(1, clean / 0.55) }}>
                    <b />
                  </span>
                  <small>
                    <Brush size={16} /> Drag to brush · <Wind size={16} /> hold Space to blow
                  </small>
                </>
              )}
            </div>
          )}
          {scanned && part && phase < 2 && (
            <aside className="iv3-part" aria-live="polite" aria-label={`Part: ${part.name.text}`}>
              <small>
                Part {partIndex + 1} of {artifact.components.length}
              </small>
              <h2>{part.name.text}</h2>
              <p className="iv3-job">
                <b>Its job:</b> {part.function.text}
              </p>
              <p className="iv3-fact">
                <span className="od-badge true">True story</span> {part.clue.text}
              </p>
            </aside>
          )}
          {scanned && <InspectTools />}
        </div>
        {phase === 2 && (
          <aside className="iv3-record g-panel" aria-label="Record unlocked">
            <div className="iv3-record-text">
              <div className="iv-record-head">
                <span>Record unlocked</span>
                <button type="button" className="g-icon-btn sky" aria-label="Hear it again" onClick={() => speak(artifact.summary.text)} style={{ ["--g-icon" as string]: "40px" }}>
                  <Volume2 size={18} />
                </button>
              </div>
              <p className="iv-record-text">{artifact.summary.text}</p>
              <p className="iv-record-why">
                <b>Why it stayed:</b> {artifact.leftBehindReason.fact.text}
              </p>
            </div>
            <Activity mission={mission} artifact={artifact} complete={activityDone} />
          </aside>
        )}
      </div>
      <div className={`iv3-tray g-panel phase-${phase}`}>
        <Action mission={mission} action={{ type: "explore" }} className="iv3-back">
          Back to exploring
        </Action>
        {phase === 0 && (
          <div className="iv3-msg">
            <div className="iv-meter-big" style={{ ["--k" as string]: Math.min(1, clean / 0.55) }} aria-label={`${Math.round(Math.min(1, clean / 0.55) * 100)} percent clean`}>
              <b />
              <span>{Math.round(Math.min(1, clean / 0.55) * 100)}%</span>
            </div>
            <p>
              <span aria-hidden="true">💡</span> {mission.meta.id.startsWith("mars") ? "Dust slowly covered Opportunity's solar panels." : "No wind here, so footprints can stay for a very long time."}
            </p>
          </div>
        )}
        {phase >= 1 && (
          <div className="iv3-parts" role="group" aria-label="Parts to explore">
            <strong>{phase === 1 ? "Open the glowing parts:" : "Parts explored:"}</strong>
            {artifact.components.map((c, i) => {
              const got = clues.includes(c.id);
              return (
                <button key={c.id} type="button" aria-label={`Inspect clue ${i + 1}`} aria-pressed={got} className={`iv3-chip ${got ? "got" : ""} ${part?.id === c.id ? "on" : ""}`} onClick={() => openPart(c.id)}>
                  <span>{got ? <Check size={16} strokeWidth={3.5} /> : <Search size={16} strokeWidth={3} />}</span>
                  {got ? c.name.text : `Part ${i + 1}`}
                </button>
              );
            })}
          </div>
        )}
        {state.feedback && phase > 0 && phase < 2 && (
          <div className="iv-status" role="status">
            {state.feedback}
          </div>
        )}
        {phase === 2 && (
          <Action mission={mission} action={{ type: "next" }} variant="primary" disabled={!activityDone} className="iv3-next" aria-label="Evidence board">
            Quiz time <Play size={18} strokeWidth={3} aria-hidden="true" />
          </Action>
        )}
      </div>
    </section>
  );
}
