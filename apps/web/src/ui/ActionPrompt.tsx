// Action prompt (bible §6B MASTER): a paper tag tilted −1°. A line drawing of the hand move, then
// "Hold · E · Tap" (22 px, the key as an outlined square), a thin rule, and the action (26 px).
// The way the player is using right now is darker; a thin ring fills while a hold is confirming.
// Tapping the tag acts too.
import { useRef } from "react";
import { useLastSource } from "../input/bus";
import { useInput } from "../input/store";
import type { VerbId } from "../input/types";
import { HandSvg, VERB_DEMO } from "./HandDemo";

export const GLYPHS: Record<VerbId, { hand: string; key: string; touch: string }> = {
  pointer: { hand: "Point", key: "Arrows", touch: "Tap" },
  pinch: { hand: "Pinch", key: "Space", touch: "Tap" },
  grab: { hand: "Grab", key: "Space", touch: "Drag" },
  palmHold: { hand: "Hold", key: "E", touch: "Tap" },
  wave: { hand: "Wave", key: "A D", touch: "Scrub" },
  swipe: { hand: "Swoosh", key: "← →", touch: "Swipe" },
  dial: { hand: "Twist", key: "Q E", touch: "Scroll" },
  steer: { hand: "Steer", key: "A D", touch: "Wheel" },
  push: { hand: "Push", key: "Enter", touch: "Tap" },
  pilot: { hand: "Fly", key: "W S A D", touch: "Slide" },
  frame: { hand: "Frame", key: "P", touch: "Tap" },
  thumbsUp: { hand: "Thumbs up", key: "Enter", touch: "Tap" },
  fistStamp: { hand: "Stamp", key: "Space", touch: "Tap" },
  count: { hand: "Hold up 1 to 4 fingers", key: "1 to 4", touch: "Tap" },
};

export default function ActionPrompt({ verb, label, progress = 0, onActivate, className = "" }: { verb: VerbId; label: string; progress?: number; onActivate?: () => void; className?: string }) {
  const src = useLastSource();
  const hands = useInput((s) => s.handScenes > 0 && s.mode === "gloves");
  const gloves = hands;
  const g = hands ? GLYPHS[verb] : { hand: "", key: GLYPHS[verb].key === "Arrows" || GLYPHS[verb].key === "W S A D" ? GLYPHS[verb].key : GLYPHS[verb].key, touch: "Tap" };
  const demo = VERB_DEMO[verb];
  const R = 27,
    C = 2 * Math.PI * R;
  // touch acts on lift (some tablets never turn a tap on a re-rendering prompt into a click);
  // the click that may follow is ignored
  const lastTouch = useRef(0);
  return (
    <button
      type="button"
      className={`action-prompt ${className}`}
      onPointerUp={(e) => {
        if (e.pointerType !== "touch" || !onActivate) return;
        lastTouch.current = performance.now();
        onActivate();
      }}
      onClick={() => {
        if (performance.now() - lastTouch.current < 700) return;
        onActivate?.();
      }}
      aria-label={hands ? `${label}. ${g.hand} with your hand, press ${g.key}, or ${g.touch.toLowerCase()}.` : `${label}. Press ${g.key}, click or tap.`}>
      {hands && <span className={`ap-hand ${src === "gesture" ? "on" : ""}`}>
        <svg className="ap-ring" viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r={R} className="ap-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, progress)))} />
        </svg>
        <span className={`ap-demo ${gloves && !demo.anim.includes("pinch") ? demo.anim : ""}`}>
          <HandSvg pose={demo.pose} size={40} />
        </span>
      </span>}
      <span className="ap-text">
        <span className="ap-glyphs" aria-hidden="true">
          {hands && (
            <>
              <span className={src === "gesture" ? "on" : ""}>{g.hand}</span>
              <i>·</i>
            </>
          )}
          <kbd className={src === "keyboard" ? "on" : ""}>{g.key}</kbd>
          <i>·</i>
          {!hands && (
            <>
              <span className={src === "mouse" ? "on" : ""}>Click</span>
              <i>·</i>
            </>
          )}
          <span className={src === "touch" || (hands && src === "mouse") ? "on" : ""}>{g.touch}</span>
        </span>
        <strong className="ap-label">{label}</strong>
      </span>
    </button>
  );
}
