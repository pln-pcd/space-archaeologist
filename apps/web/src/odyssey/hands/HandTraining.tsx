// HAND TRAINING (v7.1): the one place hand gestures are explained and switched on. Five tiny steps,
// each with a drawn astronaut glove, a live check and what the gesture DOES in the game:
//   1 Show your hand   2 Point (move the glove: walk, aim)   3 Pinch (click, pick up, go there)
//   4 Open palm (hold: scanner, blow the Moon dust)   5 Thumbs up (yes! investigate)
// Then hands stay on everywhere (ship, designer, missions, mini-games) until switched off.
// Camera frames are only shown live; nothing is saved or sent. Mouse/keys/touch always work too.
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Hand, MousePointer2, X } from "lucide-react";
import { useInput, useHandsWanted } from "../../input/store";
import { gloves } from "../../input/engine";
import { commitCalibration, hasSamples, observe } from "../../input/calibration";
import { useIntent, useIntentScope } from "../../input/bus";
import { LiveCamera } from "../../story/ch1/CameraCheck";
import HandTracker from "../../ui/HandTracker";
import { GloveArt, type GlovePose } from "../../ui/GloveSprite";
import { cute } from "../../audio/cute";
import { useStore } from "../../store";
import "./hands.css";

type Step = "ask" | "starting" | "show" | "point" | "pinch" | "palm" | "thumbs" | "done" | "nocam";
const TRAIN: { id: Step; pose: GlovePose; title: string; what: string; how: string }[] = [
  { id: "show", pose: "open", title: "Show me your hand", what: "The glove follows your hand", how: "Hold one hand up, palm to the camera" },
  { id: "point", pose: "point", title: "Point to move", what: "Walk on the Moon, aim at things", how: "Point one finger and touch the 3 stars" },
  { id: "pinch", pose: "pinch", title: "Pinch to click", what: "Press buttons, pick up rocks, go there", how: "Touch your thumb and finger on the big star" },
  { id: "palm", pose: "open", title: "Open palm to scan", what: "Scanner pulse, blow away Moon dust", how: "Hold your open hand still until the ring fills" },
  { id: "thumbs", pose: "thumbs", title: "Thumbs up!", what: "Say yes, investigate what you found", how: "Give me a big thumbs up" },
];
const STARS: [number, number][] = [
  [0.22, 0.3],
  [0.5, 0.2],
  [0.78, 0.32],
];

function Stage({ step, onNext }: { step: Step; onNext: () => void }) {
  const hands = useInput((s) => s.hands);
  const [got, setGot] = useState<boolean[]>([false, false, false]);
  const [palm, setPalm] = useState(0);
  const seen = useRef(0);
  const big = useRef<HTMLDivElement>(null);
  useHandsWanted(true);
  useIntentScope(["pointer", "pinch", "palmHold", "thumbsUp"], {}, "hand-training");
  // 1: a steady hand (and calibration samples of the open hand)
  useEffect(() => {
    if (step !== "show" && step !== "pinch") return;
    seen.current = 0;
    return gloves.onFeed((f) => {
      const h = f.features[0];
      if (!h) return;
      if (step === "show" && h.ext4 > 0.5) {
        observe("open", h);
        if (++seen.current > 18) onNext();
      }
      if (step === "pinch" && gloves.core.state().pinching) observe("pinch", h);
    });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // 2: touch three stars with the glove
  useIntent("pointer", (e) => {
    if (step !== "point" || e.source !== "gesture" || !e.visible) return;
    setGot((g) => {
      const n = g.map((v, i) => v || Math.hypot(e.x - STARS[i][0] * innerWidth, e.y - STARS[i][1] * innerHeight) < 70);
      if (n.some((v, i) => v && !g[i])) cute.coin();
      if (n.every(Boolean) && !g.every(Boolean)) setTimeout(onNext, 500);
      return n;
    });
  });
  // 3: pinch on the big star
  useIntent("pinchStart", (e) => {
    if (step !== "pinch" || e.source !== "gesture") return;
    const r = big.current?.getBoundingClientRect();
    if (r && e.x > r.left - 40 && e.x < r.right + 40 && e.y > r.top - 40 && e.y < r.bottom + 40) {
      if (hasSamples()) commitCalibration();
      cute.jingle();
      onNext();
    } else cute.pop(1.4);
  });
  // 4: open palm hold
  useIntent("palmHold", (e) => {
    if (step !== "palm" || e.source !== "gesture") return;
    setPalm(e.progress);
    if (e.done) (cute.scan(), onNext());
  });
  // 5: thumbs up
  useIntent("thumbsUp", (e) => {
    if (step !== "thumbs" || e.source !== "gesture") return;
    cute.fanfare();
    onNext();
  });
  return (
    <>
      {step === "point" &&
        STARS.map(([x, y], i) => (
          <i key={i} className={`ht-star ${got[i] ? "got" : ""}`} style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden="true" />
        ))}
      {step === "pinch" && (
        <div ref={big} className="ht-bigstar" aria-hidden="true">
          <span>Pinch me!</span>
        </div>
      )}
      {step === "palm" && (
        <div className="ht-palm" style={{ ["--p" as string]: palm }} aria-hidden="true">
          <b>{Math.round(palm * 100)}%</b>
        </div>
      )}
      <div className="ht-seen" data-on={hands > 0 ? "1" : "0"}>
        <i /> {hands > 0 ? "I can see your hand!" : "Hold your hand up to the camera"}
      </div>
    </>
  );
}

export default function HandTraining({ onClose }: { onClose: () => void }) {
  const camera = useInput((s) => s.camera);
  const mode = useInput((s) => s.mode);
  const trained = useStore((s) => !!s.settings.handsTrained);
  const [step, setStep] = useState<Step>("ask");
  const idx = TRAIN.findIndex((t) => t.id === step);
  const on = mode === "gloves";

  const start = (train: boolean) => {
    cute.pop();
    useInput.getState().set({ mode: "gloves", consented: true });
    setStep(train ? "starting" : "done");
  };
  const off = () => {
    gloves.stop(true);
    useInput.getState().set({ mode: matchMedia("(pointer: coarse)").matches ? "touch" : "mouse" });
    onClose();
  };
  useEffect(() => {
    if (step === "starting" && (camera === "on" || new URLSearchParams(location.search).has("inject"))) setStep("show");
    if (step !== "ask" && step !== "done" && ["denied", "missing", "unsupported", "error", "busy"].includes(camera)) setStep("nocam");
  }, [camera, step]);
  useEffect(() => {
    if (step !== "done") return;
    useStore.getState().configure({ handsTrained: true });
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [step, onClose]);
  const next = () => setStep((s) => {
    const i = TRAIN.findIndex((t) => t.id === s);
    return i >= 0 && i < TRAIN.length - 1 ? TRAIN[i + 1].id : "done";
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);

  const cur = TRAIN[idx];
  return (
    <div className="ht g-scrim od-free" role="dialog" aria-modal="true" aria-label="Hand gestures">
      {idx >= 0 && <Stage step={step} onNext={next} />}
      <section className="g-panel ht-card">
        <button type="button" className="g-icon-btn ht-x" aria-label="Close" onClick={onClose}>
          <X size={24} strokeWidth={3} />
        </button>
        {step === "ask" && (
          <div className="ht-ask">
            <div className="ht-hero" aria-hidden="true">
              <GloveArt pose="open" tone="idle" size={150} />
            </div>
            <div>
              <h2>Play with your hands!</h2>
              <p>Your camera sees your hand and a space glove copies it. Walk, scan and pick things up with gestures.</p>
              <ul className="ht-list">
                {TRAIN.slice(1).map((t) => (
                  <li key={t.id}>
                    <GloveArt pose={t.pose} tone="idle" size={44} />
                    <span>
                      <b>{t.title.replace(/!$/, "")}</b> {t.what.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="ht-row">
                {on ? (
                  <button type="button" className="g-btn" onClick={off}>
                    <MousePointer2 size={20} /> Turn hands off
                  </button>
                ) : (
                  <button type="button" className="g-btn" onClick={onClose}>
                    <MousePointer2 size={20} /> Not now
                  </button>
                )}
                {trained && !on && (
                  <button type="button" className="g-btn mint" onClick={() => start(false)}>
                    <Hand size={20} /> Hands on
                  </button>
                )}
                <button type="button" className="g-btn coral big" onClick={() => start(true)} autoFocus>
                  <Camera size={22} /> {trained ? "Practice again" : "Start training"}
                </button>
              </div>
              <p className="ht-note">For grown-ups: video stays on this computer. It is never recorded, saved or sent.</p>
            </div>
          </div>
        )}
        {step === "starting" && (
          <div className="ht-center">
            <h2>Starting the camera…</h2>
            <p>If your browser asks, choose Allow.</p>
          </div>
        )}
        {cur && (
          <div className="ht-step">
            <div className="ht-cam">
              <LiveCamera />
              <HandTracker />
              <span className="ht-live">
                <i /> Camera on
              </span>
            </div>
            <div className="ht-info">
              <ol className="ht-dots" aria-label={`Step ${idx + 1} of ${TRAIN.length}`}>
                {TRAIN.map((t, i) => (
                  <li key={t.id} className={i < idx ? "done" : i === idx ? "now" : ""}>
                    {i < idx ? <Check size={14} strokeWidth={4} /> : i + 1}
                  </li>
                ))}
              </ol>
              <div className="ht-pose" key={cur.id}>
                <GloveArt pose={cur.pose} tone="idle" size={120} />
              </div>
              <h2>{cur.title}</h2>
              <p className="ht-how">{cur.how}</p>
              <p className="ht-what">
                <b>In the game:</b> {cur.what}
              </p>
              <button type="button" className="g-btn ht-skip" onClick={next}>
                Skip this one
              </button>
            </div>
          </div>
        )}
        {step === "done" && (
          <div className="ht-center">
            <div className="ht-hero" aria-hidden="true">
              <GloveArt pose="thumbs" tone="idle" size={140} />
            </div>
            <h2>Glove pilot ready!</h2>
            <p>Hands are on. Turn them off anytime with the hand button.</p>
          </div>
        )}
        {step === "nocam" && (
          <div className="ht-center">
            <h2>No camera today</h2>
            <p>That's fine! Everything works with a mouse, keys or touch.</p>
            <button type="button" className="g-btn primary" onClick={off}>
              OK
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
