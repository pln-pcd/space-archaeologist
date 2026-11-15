// HAND TRAINING (v8): the one place hand gestures are explained, switched on and TUNED to the
// player's own hand. Five short steps that match exactly what the hand parts of the game use
// (investigating a find, the finger quiz and the mini-games):
//   1 Show one hand   (one person, good light; samples the open hand, finger by finger)
//   2 Point           (touch 3 stars IN the camera picture with your fingertip)
//   3 Pinch           (pinch on the big star; samples the pinch)
//   4 Fist            (hold a fist; samples the curled hand → turning a find)
//   5 Count 1-4       (show 1, 2, 3, 4 fingers; 5 never counts)
// The targets live inside the camera picture and are hit with the real fingertip (the same mapping
// as the drawn hand skeleton), so what the kid sees is exactly what is checked.
// Camera frames are only shown live; nothing is saved or sent. Mouse/keys/touch always work too.
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Hand, Lightbulb, MousePointer2, User, X, Ruler } from "lucide-react";
import { useInput, useHandsWanted } from "../../input/store";
import { gloves } from "../../input/engine";
import { frameBrightness } from "../../input/camera";
import { commitCalibration, hasSamples, observe } from "../../input/calibration";
import { useIntent, useIntentScope } from "../../input/bus";
import { LiveCamera } from "../../story/ch1/CameraCheck";
import HandTracker from "../../ui/HandTracker";
import { GloveArt, type GlovePose } from "../../ui/GloveSprite";
import { cute } from "../../audio/cute";
import { useStore } from "../../store";
import "./hands.css";

type Step = "ask" | "starting" | "show" | "point" | "pinch" | "fist" | "count" | "done" | "nocam";
const TRAIN: { id: Step; pose: GlovePose; title: string; what: string; how: string }[] = [
  { id: "show", pose: "open", title: "Show me one hand", what: "The glove follows your hand", how: "Hold one open hand up, palm to the camera" },
  { id: "point", pose: "point", title: "Point to aim", what: "Aim at stars and parts", how: "Point one finger and touch the 3 stars in the picture" },
  { id: "pinch", pose: "pinch", title: "Pinch to open", what: "Press buttons, open glowing parts", how: "Put your fingertip on the big star, then pinch" },
  { id: "fist", pose: "fist", title: "Make a fist", what: "Grab and turn the things you find", how: "Close your hand into a fist and hold it" },
  { id: "count", pose: "relaxed", title: "Count 1 to 4", what: "Answer quiz questions", how: "Show 1, then 2, then 3, then 4 fingers" },
];
/** star targets inside the camera picture (0..1 of the picture box) */
const STARS: [number, number][] = [
  [0.24, 0.3],
  [0.52, 0.2],
  [0.78, 0.34],
];
const BIG: [number, number] = [0.5, 0.42];

/** map a mirrored, normalised camera point onto the picture box (object-fit: cover) */
function toBox(p: { x: number; y: number }, box: DOMRect, video: HTMLVideoElement | null) {
  const vw = video?.videoWidth || 1280,
    vh = video?.videoHeight || 720;
  const s = Math.max(box.width / vw, box.height / vh);
  const dw = vw * s,
    dh = vh * s;
  return { x: (box.width - dw) / 2 + p.x * dw, y: (box.height - dh) / 2 + p.y * dh };
}

/** the live checks for each step; renders its targets inside the camera picture */
function Stage({ step, onNext, cam, onFive }: { step: Step; onNext: () => void; cam: React.RefObject<HTMLDivElement | null>; onFive: (v: boolean) => void }) {
  const [got, setGot] = useState<boolean[]>([false, false, false]);
  const [ring, setRing] = useState(0);
  const [counted, setCounted] = useState(0);
  const tip = useRef<{ x: number; y: number } | null>(null);
  const hold = useRef(0);
  const doneRef = useRef(false);
  useHandsWanted(true);
  useIntentScope(["pointer", "pinch", "count"], {}, "hand-training");
  useEffect(() => {
    doneRef.current = false;
    hold.current = 0;
    setRing(0);
  }, [step]);
  const next = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onNext();
  };
  // every tracker frame: where the fingertip is in the picture, and the step's own pose check
  useEffect(() => {
    return gloves.onFeed((f) => {
      const box = cam.current?.getBoundingClientRect();
      const video = cam.current?.querySelector("video") ?? null;
      const hand = f.frame?.hands[0];
      const h = f.features[0];
      if (!box || !hand || !h) {
        tip.current = null;
        hold.current = Math.max(0, hold.current - 2);
        return;
      }
      tip.current = toBox(hand.landmarks[8], box, video);
      const one = f.features.length === 1;
      if (step === "show") {
        if (one && h.ext4 > 0.62) {
          observe("open", h);
          hold.current += 1;
        } else hold.current = Math.max(0, hold.current - 1);
        setRing(Math.min(1, hold.current / 20));
        if (hold.current >= 20) next();
      }
      if (step === "point" && h.pointing > 0.45) {
        const r = Math.max(34, box.width * 0.07);
        setGot((g) => {
          const n = g.map((v, i) => v || Math.hypot(tip.current!.x - STARS[i][0] * box.width, tip.current!.y - STARS[i][1] * box.height) < r);
          if (n.some((v, i) => v && !g[i])) cute.coin();
          if (n.every(Boolean) && !g.every(Boolean)) setTimeout(next, 450);
          return n;
        });
      }
      if (step === "pinch" && gloves.core.state().pinching) observe("pinch", h);
      if (step === "fist") {
        const fist = h.ext4 < 0.34 && h.ext[1] < 0.42 && h.pointing < 0.3;
        if (fist) {
          observe("fist", h);
          hold.current += 1;
        } else hold.current = Math.max(0, hold.current - 1);
        setRing(Math.min(1, hold.current / 24));
        if (hold.current >= 24) {
          cute.jingle();
          next();
        }
      }
    });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // pinch on the big star (checked with the real fingertip in the picture)
  useIntent("pinchStart", (e) => {
    if (step !== "pinch" || e.source !== "gesture") return;
    const box = cam.current?.getBoundingClientRect();
    const t = tip.current;
    const near = box && t && Math.hypot(t.x - BIG[0] * box.width, t.y - BIG[1] * box.height) < Math.max(80, box.width * 0.16);
    if (near) {
      cute.jingle();
      next();
    } else cute.pop(1.4);
  });
  // count 1 → 4 (five is never an answer)
  useIntent("fingers", (e) => {
    if (step !== "count" || e.source !== "gesture") return;
    onFive(e.count === 5);
    if (!e.done) return;
    setCounted((c) => {
      if (e.count !== c + 1) return c;
      cute.coin();
      if (e.count === 4) setTimeout(next, 500);
      return e.count;
    });
  });
  return (
    <div className="ht-targets" aria-hidden="true">
      {step === "point" && STARS.map(([x, y], i) => <i key={i} className={`ht-star in ${got[i] ? "got" : ""}`} style={{ left: `${x * 100}%`, top: `${y * 100}%` }} />)}
      {step === "pinch" && (
        <div className="ht-bigstar in" style={{ left: `${BIG[0] * 100}%`, top: `${BIG[1] * 100}%` }}>
          <span>Pinch me!</span>
        </div>
      )}
      {(step === "show" || step === "fist") && (
        <div className="ht-ring" style={{ ["--p" as string]: ring }}>
          <b>{Math.round(ring * 100)}%</b>
        </div>
      )}
      {step === "count" && (
        <ol className="ht-count">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className={n <= counted ? "got" : n === counted + 1 ? "now" : ""}>
              {n <= counted ? <Check size={18} strokeWidth={4} /> : n}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** what helps the camera: shown before and during training */
function Tips({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`ht-tips ${compact ? "compact" : ""}`} aria-label="Tips for the best hand tracking">
      <li>
        <Lightbulb size={18} strokeWidth={2.6} aria-hidden="true" /> Good light on your hand
      </li>
      <li>
        <User size={18} strokeWidth={2.6} aria-hidden="true" /> Only one person in the camera
      </li>
      <li>
        <Ruler size={18} strokeWidth={2.6} aria-hidden="true" /> Hand about an arm's length away
      </li>
    </ul>
  );
}

/** live warnings: too dark, two people / two hands */
function Warnings({ five }: { five: boolean }) {
  const hands = useInput((s) => s.hands);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setDark(frameBrightness() < 55), 1000);
    return () => clearInterval(iv);
  }, []);
  const msg = five ? "That's 5! Tuck your thumb in: only 1 to 4 count." : dark ? "It's a bit dark. Turn on a light so I can see your fingers." : hands > 1 ? "I see two hands. Use one hand, and only one person please." : hands === 0 ? "Hold your hand up to the camera" : "I can see your hand!";
  return (
    <div className="ht-seen" data-on={hands === 1 && !dark && !five ? "1" : "0"} role="status">
      <i /> {msg}
    </div>
  );
}

export default function HandTraining({ onClose }: { onClose: () => void }) {
  const camera = useInput((s) => s.camera);
  const mode = useInput((s) => s.mode);
  const trained = useStore((s) => !!s.settings.handsTrained);
  const [step, setStep] = useState<Step>("ask");
  const [five, setFive] = useState(false);
  const cam = useRef<HTMLDivElement>(null);
  const idx = TRAIN.findIndex((t) => t.id === step);
  const on = mode === "gloves";
  useEffect(() => useStore.getState().configure({ handsAsked: true }), []);

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
    if (hasSamples()) commitCalibration();
    useStore.getState().configure({ handsTrained: true });
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [step, onClose]);
  const next = () => {
    setFive(false);
    setStep((s) => {
      const i = TRAIN.findIndex((t) => t.id === s);
      return i >= 0 && i < TRAIN.length - 1 ? TRAIN[i + 1].id : "done";
    });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);

  const cur = TRAIN[idx];
  return (
    <div className="ht g-scrim od-free" role="dialog" aria-modal="true" aria-label="Hand gestures">
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
              <p>Your camera sees your hand and a space glove copies it. Let's teach it YOUR hand first.</p>
              <ul className="ht-list">
                {TRAIN.slice(1).map((t) => (
                  <li key={t.id}>
                    <GloveArt pose={t.pose} tone="idle" size={44} />
                    <span>
                      <b>{t.title}</b> {t.what.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              <Tips />
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
            <Tips compact />
          </div>
        )}
        {cur && (
          <div className="ht-step">
            <div className="ht-cam" ref={cam}>
              <LiveCamera />
              <HandTracker />
              <Stage step={step} onNext={next} cam={cam} onFive={setFive} />
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
                <GloveArt pose={cur.pose} tone="idle" size={110} />
              </div>
              <h2>{cur.title}</h2>
              <p className="ht-how">{cur.how}</p>
              <p className="ht-what">
                <b>In the game:</b> {cur.what}
              </p>
              <Tips compact />
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
            <p>Your glove knows your hand now. Turn it off anytime with the hand button.</p>
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
      {cur && <Warnings five={five} />}
    </div>
  );
}
