// EVIDENCE QUIZ (v7.6): the evidence board as a finger-count quiz, the same for every find.
// Left: the camera with the hand tracker on the kid's hand. Right: the question card, the same size.
// Four answers, A to D: hold up 1 finger for A, 2 for B, 3 for C, 4 for D (held still to pick), or
// tap an answer, or press 1 to 4. Questions are built from the find's own sourced evidence cards and
// parts (moon-001.json), so every answer text is a TRUE STORY line with a NASA source. Each right
// answer pins the matching evidence to the record through the mission's own commands; a wrong
// answer is never a fail: it just says "not quite", and after two tries the right one glows.
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Lightbulb, Sparkles } from "lucide-react";
import { useIntent, useIntentScope } from "../input/bus";
import { useHandsWanted, useInput } from "../input/store";
import { LiveCamera } from "../story/ch1/CameraCheck";
import HandTracker from "../ui/HandTracker";
import { command } from "./session";
import { Action } from "./ui";
import HowTo, { howToSeen } from "./HowTo";
import { speak } from "../odyssey/nova/voice";
import { cute } from "../audio/cute";
import type { Artifact, MissionCommand, MissionDefinition, MissionState } from "./types";
import "./quiz.css";

type Choice = { id: string; text: string };
type Question = { id: string; prompt: string; choices: Choice[]; answer: string; done: (pinned: string[]) => boolean; reward: MissionCommand[] };
const LETTERS = ["A", "B", "C", "D"];

/** a stable order per find and question, so the right answer is not always A */
function arrange(correct: Choice, wrong: Choice[], seed: string): Choice[] {
  const pick = [...new Map([correct, ...wrong].map((c) => [c.text, c])).values()].slice(0, 4);
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rest = pick.filter((c) => c.id !== correct.id);
  const at = h % pick.length;
  rest.splice(at, 0, correct);
  return rest;
}

export function quizFor(mission: MissionDefinition, a: Artifact): Question[] {
  const others = mission.artifacts.filter((o) => o.id !== a.id);
  const card = (x: Artifact, slot: string) => x.evidence.find((c) => c.slot === slot);
  const match = (x: Artifact, slots: string[]) => slots.map((s) => card(x, s)).filter(Boolean).map((c) => ({ type: "match", card: c!.id, slot: c!.slot }) as MissionCommand);
  const qs: Question[] = [];
  const fn = card(a, "function");
  if (fn)
    qs.push({
      id: "job",
      prompt: `What was the ${a.name.text} for?`,
      answer: fn.id,
      choices: arrange({ id: fn.id, text: fn.fact.text }, others.map((o) => card(o, "function")).filter(Boolean).map((c) => ({ id: c!.id, text: c!.fact.text })), a.id + "job"),
      done: (p) => p.includes(fn.id),
      reward: match(a, ["function", "mission", "photo"]),
    });
  const why = card(a, "reason");
  if (why)
    qs.push({
      id: "why",
      prompt: "Why did it stay on the Moon?",
      answer: why.id,
      choices: arrange({ id: why.id, text: why.fact.text }, others.map((o) => card(o, "reason")).filter(Boolean).map((c) => ({ id: c!.id, text: c!.fact.text })), a.id + "why"),
      done: (p) => p.includes(why.id),
      reward: match(a, ["reason", "component"]),
    });
  const part = a.components[0];
  if (part) {
    const pool = [...a.components.slice(1), ...others.flatMap((o) => o.components)].map((c) => ({ id: `part:${c.id}`, text: c.name.text }));
    qs.push({
      id: "part",
      prompt: `Which part does this job: "${part.function.text}"`,
      answer: `part:${part.id}`,
      choices: arrange({ id: `part:${part.id}`, text: part.name.text }, pool, a.id + "part"),
      done: (p) => a.components.slice(0, 2).every((c) => p.includes(`pair:${c.id}`)),
      reward: a.components.slice(0, 2).map((c) => ({ type: "match", card: `part:${c.id}`, slot: `job:${c.id}` }) as MissionCommand),
    });
  }
  return qs;
}

/** n little raised fingers: the gesture for each answer */
function Fingers({ n }: { n: number }) {
  return (
    <span className="qz-fingers" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < n ? "up" : ""} />
      ))}
    </span>
  );
}

export default function EvidenceQuiz({ mission, artifact, state }: { mission: MissionDefinition; artifact: Artifact; state: MissionState }) {
  const pinned = state.evidence[artifact.id] ?? [];
  const qs = useMemo(() => quizFor(mission, artifact), [mission, artifact]);
  const firstOpen = qs.findIndex((q) => !q.done(pinned));
  const [qi, setQi] = useState(firstOpen < 0 ? qs.length : firstOpen);
  const q = qs[qi];
  const finished = qi >= qs.length;
  const gloves = useInput((s) => s.mode === "gloves");
  const camera = useInput((s) => s.camera);
  useHandsWanted(gloves && !finished);
  useIntentScope(["count", "pointer", "pinch"], { walk: false }, "evidence-quiz");
  const [wrong, setWrong] = useState<string[]>([]);
  const [right, setRight] = useState<string | null>(null);
  const [fingers, setFingers] = useState({ count: 0, progress: 0 });
  const [how, setHow] = useState(() => !howToSeen("quiz"));
  const lock = useRef(false);

  // read each question aloud once
  useEffect(() => {
    if (!q || how) return;
    setWrong([]);
    setRight(null);
    lock.current = false;
    const v = speak(q.prompt);
    return v.stop;
  }, [qi, how]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    if (!q || lock.current || how) return;
    const c = q.choices[i];
    if (!c || wrong.includes(c.id)) return;
    if (c.id === q.answer) {
      lock.current = true;
      setRight(c.id);
      cute.fanfare();
      for (const r of q.reward) command(mission, r);
      setTimeout(() => setQi((n) => n + 1), 1300);
    } else {
      cute.oops();
      setWrong((w) => [...w, c.id]);
    }
  };
  useIntent("fingers", (e) => {
    setFingers({ count: e.count, progress: e.progress });
    if (e.done) pick(e.count - 1);
  });
  useIntent("choose", (e) => pick(e.index));
  useEffect(() => {
    if (fingers.count === 0) return;
    const t = setTimeout(() => setFingers({ count: 0, progress: 0 }), 500);
    return () => clearTimeout(t);
  }, [fingers]);

  const hint = wrong.length >= 2;
  return (
    <section className="qz od-free" aria-label="Evidence quiz">
      {how && (
        <HowTo
          id="quiz"
          kicker="Game · Evidence quiz"
          title="Show me with your fingers!"
          goal={`Answer ${qs.length} questions about the ${artifact.name.text} to save its record.`}
          voice="Quiz time! Hold up one finger for A, two for B, three for C, or four for D. You can tap an answer too."
          steps={[
            { icon: "📷", text: "Open the camera" },
            { icon: "✌️", text: "Hold up 1, 2, 3 or 4 fingers" },
            { icon: "⭐", text: "Keep it still to answer" },
          ]}
          cta="Start the quiz"
          onStart={() => setHow(false)}
        />
      )}
      <header className="qz-head">
        <div>
          <small>Evidence quiz</small>
          <h1 data-mission-heading tabIndex={-1}>
            {artifact.name.text}
          </h1>
        </div>
        <ol className="qz-dots" aria-label={`Question ${Math.min(qi + 1, qs.length)} of ${qs.length}`}>
          {qs.map((x, i) => (
            <li key={x.id} className={i < qi ? "done" : i === qi ? "now" : ""}>
              {i < qi ? <Check size={14} strokeWidth={4} /> : i + 1}
            </li>
          ))}
        </ol>
      </header>
      <div className="qz-grid">
        <div className={`qz-cam ${gloves ? "on" : "off"}`}>
          {gloves ? (
            <>
              <LiveCamera />
              <HandTracker count={fingers.count} />
              <span className="qz-live">
                <i /> {camera === "on" ? "Camera on" : "Hands on"}
              </span>
              {fingers.count > 0 && !finished && (
                <div className="qz-count" style={{ ["--p" as string]: fingers.progress }}>
                  <b>{LETTERS[fingers.count - 1]}</b>
                  <span>
                    {fingers.count} finger{fingers.count > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="qz-cam-off">
              <Camera size={64} strokeWidth={2.2} aria-hidden="true" />
              <h2>Answer with your fingers!</h2>
              <p>Open the camera, then hold up 1, 2, 3 or 4 fingers.</p>
              <button type="button" className="g-btn primary big" onClick={() => dispatchEvent(new Event("od-open-hands"))}>
                <Camera size={22} strokeWidth={2.6} aria-hidden="true" /> Open the camera
              </button>
              <small>No camera? Tap an answer, or press 1 to 4.</small>
            </div>
          )}
          <div className="qz-legend" aria-hidden="true">
            {LETTERS.map((l, i) => (
              <span key={l}>
                <Fingers n={i + 1} /> {l}
              </span>
            ))}
          </div>
        </div>
        <div className="qz-card g-panel">
          {!finished && q ? (
            <>
              <small className="qz-kicker">
                Question {qi + 1} of {qs.length}
              </small>
              <h2 className="qz-q">{q.prompt}</h2>
              <ol className="qz-choices">
                {q.choices.map((c, i) => {
                  const isWrong = wrong.includes(c.id);
                  const isRight = right === c.id || (hint && c.id === q.answer && !right);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`qz-choice ${isWrong ? "wrong" : ""} ${right === c.id ? "right" : ""} ${isRight && !right ? "hint" : ""} ${fingers.count === i + 1 ? "aim" : ""}`}
                        aria-label={`Answer ${LETTERS[i]}: ${c.text}`}
                        disabled={isWrong || !!right}
                        onClick={() => pick(i)}
                        style={fingers.count === i + 1 ? { ["--p" as string]: fingers.progress } : undefined}
                      >
                        <b>{LETTERS[i]}</b>
                        <span>{c.text}</span>
                        <Fingers n={i + 1} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className={`qz-say ${wrong.length ? "oops" : ""} ${right ? "yay" : ""}`} role="status">
                {right ? (
                  <>
                    <Sparkles size={18} /> Yes! Pinned to your record.
                  </>
                ) : hint ? (
                  <>
                    <Lightbulb size={18} /> The glowing answer is right. Try it!
                  </>
                ) : wrong.length ? (
                  "Not quite. Try another one!"
                ) : (
                  "Hold up fingers, tap, or press 1 to 4."
                )}
              </p>
            </>
          ) : (
            <div className="qz-done">
              <Sparkles size={56} aria-hidden="true" />
              <h2>Evidence complete!</h2>
              <p>Every clue about the {artifact.name.text} is pinned to your record.</p>
              <Action mission={mission} action={{ type: "next" }} variant="primary" aria-label="Save it!">
                Save it!
              </Action>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
