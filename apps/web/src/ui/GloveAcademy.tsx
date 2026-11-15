// GLOVE ACADEMY (Prompt 2 item 12): 60–90 s on the Cozy Corner training mat, led by Nova.
// wave hello → pinch a star into a jar → grab an orb and drop it in a ring → Power Palm lights a
// lamp → Swoosh flips a sign → Thumbs Up. Works with gloves, touch only, or mouse only.
// Calibration happens silently while the kid plays (bible §5 step 7).
import { useEffect, useRef, useState } from "react";
import { intents, useIntent, useIntentScope } from "../input/bus";
import { useInteractable } from "../input/aim";
import { commitCalibration, hasSamples, observe } from "../input/calibration";
import { gloves } from "../input/engine";
import { useInput, useHandsWanted } from "../input/store";
import type { VerbId } from "../input/types";
import { useStore } from "../store";
import { play } from "../audio/sfx";
import ActionPrompt from "./ActionPrompt";
import { HandDemo, VERB_DEMO } from "./HandDemo";
import { CameraPreview } from "./HandCoach";
import NovaFace from "./NovaFace";

type Step = { verb: VerbId; line: string; hint: string; done: string };
const STEPS: Step[] = [
  { verb: "wave", line: "Wave hello to me.", hint: "Wave side to side, nice and big.", done: "Hello to you too." },
  { verb: "pinch", line: "Pinch the star and pop it in the jar.", hint: "Touch your thumb and finger together on the star.", done: "Star saved" },
  { verb: "grab", line: "Grab the orb. Let go over the glowing ring.", hint: "Make a fist on the orb. Open your hand on the ring.", done: "Perfect drop" },
  { verb: "palmHold", line: "Hold up your open hand to light the lamp.", hint: "Keep your hand still and open. Watch the ring fill.", done: "Lights on" },
  { verb: "swipe", line: "Swoosh your hand to flip the sign.", hint: "One quick swoosh, like turning a page.", done: "Flip" },
  { verb: "thumbsUp", line: "Thumbs up when you are ready to fly.", hint: "Point your thumb up high.", done: "Ready for launch" },
];

const center = (el: Element | null) => {
  if (!el) return { x: -999, y: -999 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export default function GloveAcademy({ onClose }: { onClose: () => void }) {
  useHandsWanted();
  const [i, setI] = useState(0);
  const [cheer, setCheer] = useState("");
  const [hint, setHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const step = STEPS[Math.min(i, STEPS.length - 1)];
  const profile = useStore((s) => s.profile);
  const reduced = useStore((s) => s.settings.reducedMotion);
  useIntentScope(finished ? ["pinch", "palmHold", "thumbsUp"] : [step.verb], { keyboardCursor: step.verb === "pinch" || step.verb === "grab" }, `academy:${step.verb}`);

  // hint after 8 s on a step
  useEffect(() => {
    setHint(false);
    const t = setTimeout(() => setHint(true), 8000);
    return () => clearTimeout(t);
  }, [i]);

  // silent calibration while playing
  useEffect(
    () =>
      gloves.onFeed((f) => {
        const h = f.features[0];
        if (!h) return;
        const st = gloves.core.state();
        if ((step.verb === "wave" || step.verb === "palmHold") && h.ext4 > 0.5 && h.facing > 0) observe("open", h);
        if (step.verb === "grab" && st.grabbing) observe("fist", h);
        if (step.verb === "pinch" && st.pinching) observe("pinch", h);
      }),
    [step.verb],
  );

  const success = () => {
    play("sparkle");
    setCheer(step.done);
    setTimeout(() => {
      setCheer("");
      if (i + 1 >= STEPS.length) {
        if (hasSamples()) commitCalibration();
        useStore.getState().updateProfile({ gloveLicence: true });
        useInput.getState().set({ academyDone: true });
        play("chime");
        setFinished(true);
      } else {
        play("tick");
        setI(i + 1);
      }
    }, reduced ? 500 : 1100);
  };

  const gloveCam = useInput((st) => st.mode === "gloves" && st.camera === "on");
  return (
    <div className="odyssey-overlay academy" role="dialog" aria-modal="true" aria-labelledby="academy-title">
      <header className="academy-top">
        <h2 id="academy-title">Glove Academy</h2>
        <ol className="academy-dots" aria-label={`Step ${Math.min(i + 1, 6)} of 6`}>
          {STEPS.map((s, k) => (
            <li key={s.verb} className={k < i || finished ? "done" : k === i ? "now" : ""} />
          ))}
        </ol>
        <button type="button" className="chunky quiet small" onClick={onClose}>
          {finished ? "Close" : "Skip"}
        </button>
      </header>
      {finished ? (
        <Licence name={profile?.nickname ?? "Explorer"} onClose={onClose} />
      ) : (
        <div className="academy-body">
          <aside className="academy-nova">
            <NovaFace size={110} spin={step.verb === "wave" && !!cheer} />
            <p className="bubble" aria-live="polite">
              {cheer || step.line}
              {hint && !cheer && <small>{step.hint}</small>}
            </p>
            {/* see yourself while you practise: the Glove Cam sits right here */}
            {gloveCam && <CameraPreview embedded />}
          </aside>
          <section className="academy-stage" key={i}>
            <Stage verb={step.verb} onSuccess={success} />
          </section>
          <aside className="academy-demo">
            {/* step card (bible §6B): "Step 2 of 6", the move's name, a line drawing of a real hand */}
            <div className="academy-step paper-card">
              <small>
                Step {i + 1} of {STEPS.length}
              </small>
              <strong>{VERB_DEMO[step.verb].name}</strong>
              <HandDemo verb={step.verb} size={120} />
            </div>
            <ActionPrompt verb={step.verb} label={step.verb === "palmHold" ? "Light the lamp" : "Try it"} className="academy-prompt" onActivate={() => tapFallback(step.verb)} />
          </aside>
        </div>
      )}
    </div>
  );
}

/** "Tap" on the prompt = the verb, for touch and mouse players (bible §4 fallback column). */
function tapFallback(verb: VerbId) {
  const src = intents.lastSource === "touch" ? "touch" : "mouse";
  if (verb === "palmHold") intents.emit("palmHold", { progress: 1, done: true, x: 0, y: 0 }, src);
  else if (verb === "wave") intents.emit("wave", { strength: 1 }, src);
  else if (verb === "swipe") intents.emit("swipe", { dir: "right" }, src);
  else if (verb === "thumbsUp") intents.emit("thumbsUp", {}, src);
}

function Stage({ verb, onSuccess }: { verb: VerbId; onSuccess: () => void }) {
  if (verb === "wave") return <WaveStage onSuccess={onSuccess} />;
  if (verb === "pinch") return <CarryStage kind="pinch" onSuccess={onSuccess} />;
  if (verb === "grab") return <CarryStage kind="grab" onSuccess={onSuccess} />;
  if (verb === "palmHold") return <LampStage onSuccess={onSuccess} />;
  if (verb === "swipe") return <SignStage onSuccess={onSuccess} />;
  return <ThumbsStage onSuccess={onSuccess} />;
}

function WaveStage({ onSuccess }: { onSuccess: () => void }) {
  const [spin, setSpin] = useState(false);
  useIntent("wave", () => {
    if (spin) return;
    play("spin");
    setSpin(true);
    onSuccess();
  });
  return (
    <div className="stage-wave">
      <NovaFace size={200} spin={spin} />
    </div>
  );
}

function CarryStage({ kind, onSuccess }: { kind: "pinch" | "grab"; onSuccess: () => void }) {
  const item = useRef<HTMLDivElement>(null);
  const goal = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [done, setDone] = useState(false);
  useInteractable(item, { radius: 110, active: !held && !done });
  useInteractable(goal, { radius: 120, active: held });
  const start = kind === "pinch" ? "pinchStart" : "grab";
  const end = kind === "pinch" ? "pinchEnd" : "release";
  const pick = (x: number, y: number) => {
    if (done) return;
    if (dist({ x, y }, center(item.current)) < 130) {
      setHeld(true);
      setPos({ x, y });
      play("pop");
    }
  };
  const drop = (x: number, y: number) => {
    if (!held) return;
    setHeld(false);
    if (dist({ x, y }, center(goal.current)) < 150) {
      setDone(true);
      play("gulp");
      onSuccess();
    } else {
      setPos(null); // floats gently back
      play("soft");
    }
  };
  useIntent(start, (e) => pick(e.x, e.y));
  useIntent(end, (e) => drop(e.x, e.y));
  useIntent("pointer", (e) => {
    if (held) setPos({ x: e.x, y: e.y });
  });
  useIntent("pinchMove", (e) => {
    if (held) setPos({ x: e.x, y: e.y });
  });
  const style = pos && held ? { position: "fixed" as const, left: pos.x, top: pos.y, transform: "translate(-50%,-50%) scale(1.15)" } : undefined;
  return (
    <div className={`stage-carry ${kind}`}>
      <div className="carry-slot">
      <div ref={item} className={`carry-item ${kind === "pinch" ? "star" : "orb"} ${held ? "held" : ""} ${done ? "gone" : ""}`} style={style} data-glove-ignore={held ? "" : undefined}>
        {kind === "pinch" ? (
          <svg viewBox="0 0 100 100" width="110" height="110" aria-hidden="true">
            <path d="M50 6 L62 38 L96 40 L69 60 L79 94 L50 74 L21 94 L31 60 L4 40 L38 38Z" fill="#aba395" stroke="#343029" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="40" cy="48" r="4" fill="#343029" />
            <circle cx="60" cy="48" r="4" fill="#343029" />
          </svg>
        ) : (
          <span className="orb-ball" aria-hidden="true" />
        )}
      </div>
      </div>
      <div ref={goal} className={`carry-goal ${kind === "pinch" ? "jar" : "ring"} ${done ? "filled" : ""}`} aria-hidden="true">
        {kind === "pinch" ? (
          <svg viewBox="0 0 120 150" width="130" height="160">
            <rect x="34" y="6" width="52" height="18" rx="6" fill="#b3bcc1" stroke="#343029" strokeWidth="5" />
            <path d="M24 30 h72 a10 10 0 0 1 10 10 v86 a18 18 0 0 1 -18 18 h-56 a18 18 0 0 1 -18 -18 v-86 a10 10 0 0 1 10 -10z" fill="#dbdfe1" fillOpacity=".55" stroke="#343029" strokeWidth="5" />
            {done && <path d="M60 70 L67 88 L86 89 L71 100 L76 118 L60 108 L44 118 L49 100 L34 89 L53 88Z" fill="#aba395" stroke="#343029" strokeWidth="4" />}
          </svg>
        ) : (
          <span className="ring-glow" />
        )}
      </div>
    </div>
  );
}

function LampStage({ onSuccess }: { onSuccess: () => void }) {
  const [p, setP] = useState(0);
  const [on, setOn] = useState(false);
  useIntent("palmHold", (e) => {
    if (on) return;
    if (e.done) {
      setOn(true);
      setP(1);
      play("lamp");
      onSuccess();
    } else setP(e.progress);
  });
  const C = 2 * Math.PI * 92;
  return (
    <div className={`stage-lamp ${on ? "on" : ""}`}>
      <svg viewBox="0 0 220 260" width="220" height="260" aria-hidden="true">
        <circle cx="110" cy="100" r="92" fill="none" stroke="#ffffff22" strokeWidth="12" />
        <circle cx="110" cy="100" r="92" fill="none" stroke="#aba395" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 110 100)" />
        <circle cx="110" cy="100" r="62" className="lamp-glow" />
        <path d="M80 70 h60 l14 50 h-88z" fill={on ? "#d9d5ce" : "#d5dadd"} stroke="#343029" strokeWidth="6" strokeLinejoin="round" />
        <rect x="104" y="120" width="12" height="96" fill="#a59c8d" stroke="#343029" strokeWidth="5" />
        <rect x="76" y="212" width="68" height="16" rx="8" fill="#a59c8d" stroke="#343029" strokeWidth="5" />
      </svg>
    </div>
  );
}

function SignStage({ onSuccess }: { onSuccess: () => void }) {
  const [flipped, setFlipped] = useState(false);
  useIntent("swipe", () => {
    if (flipped) return;
    play("whoosh");
    setFlipped(true);
    onSuccess();
  });
  return (
    <div className={`stage-sign ${flipped ? "flipped" : ""}`}>
      <div className="sign-card">
        <span className="sign-front">CLOSED</span>
        <span className="sign-back">Open</span>
      </div>
    </div>
  );
}

function ThumbsStage({ onSuccess }: { onSuccess: () => void }) {
  const [ok, setOk] = useState(false);
  useIntent("thumbsUp", () => {
    if (ok) return;
    setOk(true);
    onSuccess();
  });
  return (
    <div className={`stage-thumbs ${ok ? "ok" : ""}`}>
      <HandDemo verb="thumbsUp" size={170} />
    </div>
  );
}

function Licence({ name, onClose }: { name: string; onClose: () => void }) {
  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="licence-wrap">
      <svg className="licence" viewBox="0 0 520 320" role="img" aria-label={`Glove Licence for ${name}`}>
        <defs>
          <linearGradient id="lic-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#485359" />
            <stop offset="1" stopColor="#374044" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="508" height="308" rx="34" fill="url(#lic-bg)" stroke="#aba395" strokeWidth="8" />
        <rect x="26" y="26" width="468" height="268" rx="22" fill="none" stroke="#aba395" strokeOpacity=".35" strokeWidth="3" strokeDasharray="10 8" />
        <text x="260" y="78" textAnchor="middle" fontFamily="Stylish, sans-serif" fontWeight="400" fontSize="40" fill="#f1f0ee">
          Glove Licence
        </text>
        <text x="260" y="112" textAnchor="middle" fontFamily="Lexend, sans-serif" fontSize="18" fill="#d5dadd">
          Starship Odyssey · Star Gloves pilot
        </text>
        <circle cx="120" cy="205" r="62" fill="#b6aea1" stroke="#343029" strokeWidth="6" />
        <g transform="translate(78 150) scale(.7)">
          <rect x="26" y="50" width="70" height="66" rx="26" fill="#fbfbfb" stroke="#343029" strokeWidth="6" />
          {[42, 58, 74, 88].map((x, k) => (
            <line key={x} x1={x} y1={56} x2={x + k * 2 - 3} y2={18 + k * 3} stroke="#343029" strokeWidth="20" strokeLinecap="round" />
          ))}
          {[42, 58, 74, 88].map((x, k) => (
            <line key={`f${x}`} x1={x} y1={56} x2={x + k * 2 - 3} y2={18 + k * 3} stroke="#fbfbfb" strokeWidth="12" strokeLinecap="round" />
          ))}
          <line x1="30" y1="84" x2="10" y2="64" stroke="#343029" strokeWidth="20" strokeLinecap="round" />
          <line x1="30" y1="84" x2="10" y2="64" stroke="#fbfbfb" strokeWidth="12" strokeLinecap="round" />
        </g>
        <text x="210" y="190" fontFamily="Stylish, sans-serif" fontWeight="400" fontSize="34" fill="#aba395">
          {name}
        </text>
        <text x="210" y="226" fontFamily="Lexend, sans-serif" fontSize="17" fill="#f1f0ee">
          Wave · Pinch · Grab · Palm · Swoosh · Thumbs up
        </text>
        <text x="210" y="258" fontFamily="Lexend, sans-serif" fontSize="15" fill="#d5dadd">
          {today}
        </text>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <path key={k} transform={`translate(${222 + k * 36} 270) scale(.28)`} d="M50 6 L62 38 L96 40 L69 60 L79 94 L50 74 L21 94 L31 60 L4 40 L38 38Z" fill="#aba395" />
        ))}
      </svg>
      <button type="button" className="chunky gold" onClick={onClose}>
        Back to the ship
      </button>
    </div>
  );
}
