// A chunky cartoon glove drawn in SVG, posed per verb. Used for prompt glyphs, tutorial demos and
// the input picker. Animations are CSS (paused under reduced motion).
import type { VerbId } from "../input/types";
import { GloveArt, type GlovePose } from "./GloveSprite";

export type HandPose = "open" | "fist" | "pinch" | "point" | "thumbsUp" | "L";
const TO_ART: Record<HandPose, GlovePose> = { open: "open", fist: "fist", pinch: "pinch", point: "point", thumbsUp: "thumbs", L: "frame" };
/** Every small glove icon (prompts, demos, buttons) uses the same drawn Star Glove as the cursor. */
export function HandSvg({ pose: p = "open", size = 64, className = "" }: { pose?: HandPose; color?: string; glow?: string; size?: number; className?: string }) {
  // prompts and the Glove Academy show a plain line drawing of a real hand (bible §6B)
  return <GloveArt pose={TO_ART[p]} tone="idle" size={size} variant="line" className={`hand-svg ${className}`} />;
}

/** pose + animation class for each verb's tutorial demo */
export const VERB_DEMO: Record<VerbId, { pose: HandPose; anim: string; name: string; emoji: string }> = {
  pointer: { pose: "open", anim: "anim-float", name: "Star Pointer", emoji: "☝️" },
  pinch: { pose: "pinch", anim: "anim-pinch", name: "Star Pinch", emoji: "🤏" },
  grab: { pose: "fist", anim: "anim-grab", name: "Grab & Release", emoji: "✊" },
  palmHold: { pose: "open", anim: "anim-hold", name: "Power Palm", emoji: "✋" },
  wave: { pose: "open", anim: "anim-wave", name: "Wave Wind", emoji: "👋" },
  swipe: { pose: "open", anim: "anim-swoosh", name: "Swoosh", emoji: "👉" },
  dial: { pose: "pinch", anim: "anim-dial", name: "Dial Twist", emoji: "🔄" },
  steer: { pose: "fist", anim: "anim-dial", name: "Steer", emoji: "🔄" },
  push: { pose: "open", anim: "anim-push", name: "Rocket Push", emoji: "🫸" },
  pilot: { pose: "open", anim: "anim-pilot", name: "Pilot Hand", emoji: "🛩" },
  frame: { pose: "L", anim: "anim-float", name: "Photo Frame", emoji: "🖼" },
  thumbsUp: { pose: "thumbsUp", anim: "anim-bob", name: "Thumbs Up", emoji: "👍" },
  fistStamp: { pose: "fist", anim: "anim-stamp", name: "Fist Stamp", emoji: "✊" },
  count: { pose: "point", anim: "anim-hold", name: "Count fingers", emoji: "✌️" },
};

export function HandDemo({ verb, size = 96 }: { verb: VerbId; size?: number }) {
  const d = VERB_DEMO[verb];
  if (verb === "pinch" || verb === "grab") {
    // two poses that swap, so the motion reads clearly
    return (
      <span className={`hand-demo ${d.anim}`} style={{ width: size, height: size }}>
        <HandSvg pose="open" size={size} className="demo-a" />
        <HandSvg pose={d.pose} size={size} className="demo-b" />
      </span>
    );
  }
  return (
    <span className={`hand-demo ${d.anim}`} style={{ width: size, height: size }}>
      <HandSvg pose={d.pose} size={size} />
    </span>
  );
}
