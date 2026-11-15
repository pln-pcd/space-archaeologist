// Kid-friendly camera permission (bible §15): Nova says two short lines, there's a "For grown-ups"
// privacy note, and any failure falls back smoothly to touch/mouse. No dead ends.
import { useState } from "react";
import { gloves } from "../input/engine";
import { useInput } from "../input/store";
import { play } from "../audio/sfx";
import NovaFace from "./NovaFace";

const FAIL: Record<string, { line: string; grown: string }> = {
  denied: { line: "That's fine. Let's play with touch and mouse.", grown: "The browser blocked the camera. To use Star Gloves later, allow the camera from the address bar, then pick Star Gloves in Settings." },
  busy: { line: "Another app is using the camera.", grown: "Close the other video app (for example a video call), then press Try again." },
  missing: { line: "I can't find a camera. Let's use touch and mouse.", grown: "No camera was found. Plug one in and press Try again, or keep playing with touch and mouse." },
  unsupported: { line: "This browser can't share the camera. Let's use touch and mouse.", grown: "Use a current Chrome or Edge to play with Star Gloves." },
  error: { line: "The gloves didn't wake up. Let's use touch and mouse.", grown: "The hand tracker could not start on this computer. Everything still works with touch, mouse and keys." },
};

export default function CameraConsent({ onDone, embedded = false }: { onDone: (ok: boolean) => void; embedded?: boolean }) {
  const { camera, tracker, set } = useInput();
  const [state, setState] = useState<"ask" | "starting" | "fail">("ask");
  const [fail, setFail] = useState("error");
  const [grown, setGrown] = useState(false);

  const start = async () => {
    play("pop");
    setState("starting");
    set({ consented: true });
    try {
      await gloves.start();
      play("sparkle");
      onDone(true);
    } catch (e) {
      const st = typeof e === "string" ? e : "error";
      setFail(st);
      setState("fail");
    }
  };
  const fallback = () => {
    set({ mode: matchMedia("(pointer: coarse)").matches ? "touch" : "mouse" });
    onDone(false);
  };
  const f = FAIL[fail] ?? FAIL.error;
  return (
    <div className={embedded ? "consent consent-embedded" : "odyssey-overlay consent"} role={embedded ? "group" : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="consent-title">
      <NovaFace size={120} mood={state === "fail" ? "surprised" : "happy"} />
      {state !== "fail" ? (
        <>
          <h2 id="consent-title">Hello, I'm Nova.</h2>
          <p className="consent-line">Your camera turns your hands into magic Star Gloves.</p>
          {state === "starting" && (
            <p className="consent-wait" role="status">
              {camera === "asking" ? "Look for the camera question at the top and press Allow." : tracker === "warming" || tracker === "loading" ? "Waking up your gloves…" : "Starting the camera…"}
            </p>
          )}
          <div className="overlay-actions">
            <button type="button" className="chunky gold" onClick={start} disabled={state === "starting"}>
              Turn on my camera
            </button>
            <button type="button" className="chunky quiet" onClick={fallback} disabled={state === "starting"}>
              Play without camera
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 id="consent-title">{f.line}</h2>
          <div className="overlay-actions">
            <button type="button" className="chunky gold" onClick={fallback}>
              Keep playing
            </button>
            {(fail === "busy" || fail === "missing" || fail === "error") && (
              <button type="button" className="chunky quiet" onClick={start}>
                Try again
              </button>
            )}
          </div>
          <p className="grown-note">{f.grown}</p>
        </>
      )}
      <details className="grown-ups" open={grown} onToggle={(e) => setGrown((e.target as HTMLDetailsElement).open)}>
        <summary>For grown-ups</summary>
        <p>
          The camera only runs on this computer. Video is never recorded, saved or sent anywhere. The game only reads hand shapes (21 points per hand) to control play. A light shows whenever the camera is on, and you can turn it off any time in Settings.
        </p>
      </details>
    </div>
  );
}
