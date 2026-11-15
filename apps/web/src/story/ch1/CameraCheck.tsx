// Camera check (bible §8/§9, replaces the Glove Academy): the ONLY place the camera is offered.
// "This game uses your camera to see your hand. Nothing is saved or sent." → permission →
// "Show me one hand" → "Pinch your fingers together to start" (this also calibrates the
// player's pinch) → 3-2-1. Denied or no camera → the same game with mouse or touch.
import { useEffect, useRef, useState } from "react";
import { useInput, useHandsWanted } from "../../input/store";
import { gloves } from "../../input/engine";
import { getStream } from "../../input/camera";
import { commitCalibration, hasSamples, observe } from "../../input/calibration";
import { useIntent, useIntentScope } from "../../input/bus";
import { HandDemo } from "../../ui/HandDemo";
import { play } from "../../audio/sfx";
import { say } from "./voice";
import { line } from "./flow";

/** keeps Star Gloves wanted while mounted (mini-game context only) */
export function HandsOn() {
  useHandsWanted(true);
  return null;
}

/** the live camera, mirrored, filling its box (frames are only shown, never saved or sent) */
export function LiveCamera({ className = "" }: { className?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const cam = useInput((s) => s.camera);
  useEffect(() => {
    // v7.6: the camera can restart between screens (a new stream): keep the picture on the
    // current one, so the hand tracker and the picture always match
    const attach = () => {
      const s = getStream();
      if (v.current && s && v.current.srcObject !== s) {
        v.current.srcObject = s;
        void v.current.play().catch(() => {});
      }
    };
    attach();
    const iv = setInterval(attach, 400);
    return () => clearInterval(iv);
  }, [cam]);
  return <video ref={v} className={`live-camera ${className}`} muted playsInline autoPlay aria-hidden="true" />;
}

type Step = "ask" | "starting" | "show" | "pinch" | "count" | "nocam";
export default function CameraCheck({ onCamera, onMouse, title = "Fill the Rock Box" }: { onCamera: () => void; onMouse: () => void; title?: string }) {
  const [step, setStep] = useState<Step>("ask");
  const [n, setN] = useState(3);
  const camera = useInput((s) => s.camera);
  const hands = useInput((s) => s.hands);
  const seen = useRef(0);
  const wantHands = step !== "ask" && step !== "nocam";
  useIntentScope(wantHands ? ["pointer", "pinch"] : null, {}, "camera-check");

  useEffect(() => void say("g-cam"), []);
  const useCamera = () => {
    play("soft");
    // the mini-game asked and the player said yes: only now may the camera start
    useInput.getState().set({ mode: "gloves", consented: true });
    setStep("starting");
  };
  useEffect(() => {
    if (step === "starting" && camera === "on") {
      setStep("show");
      say("g-show");
    }
    if ((step === "starting" || step === "show" || step === "pinch") && (camera === "denied" || camera === "missing" || camera === "unsupported" || camera === "error" || camera === "busy")) setStep("nocam");
  }, [camera, step]);
  // test hook (?inject): no real camera; landmark frames drive the engine directly
  useEffect(() => {
    if (step === "starting" && new URLSearchParams(location.search).has("inject")) {
      setStep("show");
      say("g-show");
    }
  }, [step]);
  // "show one hand": wait for a steady hand, sampling the open hand for calibration
  useEffect(() => {
    if (step !== "show" && step !== "pinch") return;
    return gloves.onFeed((f) => {
      const h = f.features[0];
      if (!h) return;
      if (step === "show" && h.ext4 > 0.5) {
        observe("open", h);
        seen.current += 1;
        if (seen.current > 12) {
          setStep("pinch");
          say("g-pinch");
        }
      }
      if (step === "pinch" && gloves.core.state().pinching) observe("pinch", h);
    });
  }, [step]);
  useIntent("pinchStart", (e) => {
    if (step !== "pinch") return;
    if (e.source !== "gesture" && !new URLSearchParams(location.search).has("inject")) return;
    if (hasSamples()) commitCalibration();
    play("chime");
    setStep("count");
  });
  useEffect(() => {
    if (step !== "count") return;
    setN(3);
    let i = 3;
    const iv = setInterval(() => {
      i -= 1;
      if (i <= 0) {
        clearInterval(iv);
        onCamera();
      } else {
        setN(i);
        play("tick", 1.2, 0.5);
      }
    }, 900);
    return () => clearInterval(iv);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ch1-scene camcheck">
      {wantHands && <HandsOn />}
      <div className="ch1-camcheck paper-card">
        {step === "ask" && (
          <>
            <h2>{title}</h2>
            <p>{line("g-cam").text}</p>
            <div className="ch1-ask-btns">
              <button type="button" className="chunky primary" onClick={useCamera}>
                Use my camera
              </button>
              <button type="button" className="chunky" onClick={onMouse}>
                Play with mouse or touch
              </button>
            </div>
            <p className="grownups-note">For grown-ups: the camera is used only while this mini-game is open. Video stays on this computer; it is never recorded, saved or sent. The camera turns off when the game ends.</p>
          </>
        )}
        {step === "starting" && (
          <>
            <h2>Starting the camera</h2>
            <p>If your browser asks, choose Allow.</p>
          </>
        )}
        {(step === "show" || step === "pinch" || step === "count") && (
          <div className="camcheck-live">
            <div className="camcheck-video">
              <LiveCamera />
              <span className="cam-on mono caps">Camera on</span>
            </div>
            <div className="camcheck-step">
              <small>Step {step === "show" ? 1 : 2} of 2</small>
              <h2>{step === "count" ? `Ready… ${n}` : step === "show" ? line("g-show").text : line("g-pinch").text}</h2>
              <HandDemo verb={step === "show" ? "palmHold" : "pinch"} size={120} />
              <small>{hands > 0 ? "I can see your hand." : "Hold your hand up in front of the camera."}</small>
            </div>
          </div>
        )}
        {step === "nocam" && (
          <>
            <h2>No camera today</h2>
            <p>That's fine. The same game works with a mouse or a finger.</p>
            <button type="button" className="chunky primary" onClick={onMouse}>
              Play with mouse or touch
            </button>
          </>
        )}
      </div>
    </div>
  );
}
