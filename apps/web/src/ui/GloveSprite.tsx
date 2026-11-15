// The Star Glove, 2D (bible §5 feedback). A chunky cartoon glove drawn in SVG with a thick ink
// outline, toon shading and a cuff that changes colour with the verb. Instead of bending a
// skeleton (which looked like a wire hand), the glove switches between clean drawn poses that
// match what the tracker sees: open, point, pinch, fist, thumbs up, L-frame, relaxed. It turns
// with the wrist and is mirrored for a left hand.
import { memo } from "react";

export type GlovePose = "open" | "point" | "pinch" | "fist" | "thumbs" | "frame" | "relaxed";
export type GloveTone = "idle" | "pinch" | "grab" | "palm" | "snap";
type Pt = [number, number];
type Shape = { fingers: Pt[][]; thumb: Pt[]; knuckles?: Pt[][] };

/** local space: 200 × 200, fingers up, wrist at the bottom centre, palm facing the kid */
/** the aim point: the index fingertip of the pointing pose (classic pointer-glove feel) */
export const GLOVE_HOTSPOT: Pt = [70, 30];
const W = 27; // finger thickness
const PALM = "M58 92 C58 78 74 72 100 72 C128 72 146 80 146 98 L146 128 C146 150 128 160 102 160 C76 160 58 150 58 130 Z";
const SHAPES: Record<GlovePose, Shape> = {
  open: {
    fingers: [
      [[70, 88], [62, 52], [58, 28]],
      [[94, 82], [94, 44], [95, 18]],
      [[117, 84], [124, 50], [129, 28]],
      [[137, 96], [150, 70], [158, 52]],
    ],
    thumb: [[66, 128], [44, 110], [30, 88]],
  },
  relaxed: {
    fingers: [
      [[70, 88], [64, 56], [64, 36]],
      [[94, 82], [96, 50], [98, 30]],
      [[117, 84], [122, 56], [126, 40]],
      [[137, 96], [146, 76], [150, 62]],
    ],
    thumb: [[66, 128], [48, 114], [38, 96]],
  },
  point: {
    fingers: [[[72, 90], [70, 50], [70, 20]]],
    knuckles: [
      [[96, 84], [100, 100]],
      [[118, 88], [120, 104]],
      [[137, 98], [136, 112]],
    ],
    thumb: [[64, 132], [84, 122], [98, 112]],
  },
  pinch: {
    fingers: [
      [[72, 90], [58, 62], [44, 70]],
      [[96, 82], [98, 46], [100, 22]],
      [[118, 84], [126, 52], [132, 32]],
      [[137, 96], [150, 72], [158, 56]],
    ],
    thumb: [[66, 128], [42, 108], [42, 78]],
  },
  fist: {
    fingers: [],
    knuckles: [
      [[72, 84], [74, 102]],
      [[95, 78], [96, 98]],
      [[117, 80], [118, 100]],
      [[137, 90], [136, 108]],
    ],
    thumb: [[62, 130], [80, 120], [98, 116]],
  },
  thumbs: {
    fingers: [],
    knuckles: [
      [[96, 88], [128, 92]],
      [[96, 108], [130, 110]],
      [[96, 128], [128, 128]],
    ],
    thumb: [[80, 100], [74, 62], [78, 30]],
  },
  frame: {
    fingers: [[[72, 90], [70, 50], [70, 20]]],
    knuckles: [
      [[96, 84], [100, 100]],
      [[118, 88], [120, 104]],
      [[137, 98], [136, 112]],
    ],
    thumb: [[64, 128], [36, 118], [10, 112]],
  },
};
/** thin cuff light: sage normally, terracotta while a hold-to-confirm is filling (bible §3) */
const CUFF_LIGHT: Record<GloveTone, string> = { idle: "#6A8C70", pinch: "#6A8C70", grab: "#6A8C70", palm: "#B5674A", snap: "#82AD8C" };
const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * One drawn glove pose (bible §3 MASTER): a matte bone glove with a graphite outline and a graphite
 * cuff carrying one thin light line. No shine, no star, no glow.
 * `variant="line"`: the same hand as a plain line drawing (stroke #716C66, about 2 px at `size`)
 * on the paper colour, for action prompts and the Glove Academy step cards.
 */
export const GloveArt = memo(function GloveArt({ pose, tone, size, className = "", variant = "glove", paper = "#F9F2E4" }: { pose: GlovePose; tone: GloveTone; size?: number; className?: string; variant?: "glove" | "line"; paper?: string }) {
  const s = SHAPES[pose];
  const lines = [...s.fingers, ...(s.knuckles ?? []), s.thumb];
  if (variant === "line") {
    // outline of the union: thick ink strokes, then the same shapes in the paper colour on top
    const px = 200 / (size ?? 96);
    const ink = 2 * px * 2;
    const fw = 21; // a slimmer, more natural finger for the drawing
    const widths = [...s.fingers.map(() => fw), ...(s.knuckles ?? []).map(() => fw + 2), fw + 3];
    return (
      <svg className={`glove-art line ${className}`} viewBox="0 0 200 200" width={size ?? 200} height={size ?? 200} aria-hidden="true">
        <g stroke="#716C66" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={PALM} fill="#716C66" strokeWidth={ink} />
          {lines.map((l, i) => (
            <polyline key={i} points={pts(l)} strokeWidth={widths[i] + ink} />
          ))}
          <path d="M66 152 L70 184 M138 152 L134 184" strokeWidth={ink / 2} />
        </g>
        <g stroke={paper} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={PALM} fill={paper} strokeWidth={0} />
          {lines.map((l, i) => (
            <polyline key={i} points={pts(l)} strokeWidth={widths[i]} />
          ))}
        </g>
        {/* a few creases so it reads as a real hand */}
        <g stroke="#716C66" strokeLinecap="round" fill="none" strokeWidth={ink / 2.4} opacity={0.8}>
          <path d="M76 132 C90 124 112 122 128 128" />
          {pose !== "thumbs" && <path d="M70 116 C78 108 84 104 92 102" />}
        </g>
      </svg>
    );
  }
  const W2 = W;
  const widths = [...s.fingers.map(() => W2), ...(s.knuckles ?? []).map(() => W2 + 2), W2 + 3];
  const INK = "#241D48";
  const cuffLight = { idle: "#7FF0C8", pinch: "#FFE27A", grab: "#FF9AC4", palm: "#9FD8FF", snap: "#7FF0C8" }[tone];
  return (
    <svg className={`glove-art astro ${className}`} viewBox="0 0 200 200" width={size ?? 200} height={size ?? 200} aria-hidden="true">
      {/* v7.1 astronaut glove: puffy white, indigo outline, lilac shade, sky cuff with a metal ring */}
      <g stroke={INK} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={PALM} fill={INK} strokeWidth={11} />
        {lines.map((l, i) => (
          <polyline key={i} points={pts(l)} strokeWidth={widths[i] + 10} />
        ))}
      </g>
      <g stroke="#DCD6F5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={PALM} fill="#DCD6F5" strokeWidth={0} />
        {lines.map((l, i) => (
          <polyline key={i} points={pts(l)} strokeWidth={widths[i]} />
        ))}
      </g>
      <g stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={PALM} fill="#FFFFFF" strokeWidth={0} transform="translate(-3 -4) scale(0.985)" />
        {lines.map((l, i) => (
          <polyline key={i} points={pts(l.map(([x, y]) => [x - 2.5, y - 3] as Pt))} strokeWidth={widths[i] - 8} />
        ))}
      </g>
      {/* finger-tip pads */}
      <g fill="#B9B0EE">
        {s.fingers.map((l, i) => {
          const [x, y] = l[l.length - 1];
          return <circle key={i} cx={x} cy={y} r={7} />;
        })}
      </g>
      {/* a little star on the back of the glove */}
      {pose !== "thumbs" && pose !== "fist" && <path d="M100 104 l5 10 11 1.5 -8 7.5 2 11 -10 -5.5 -10 5.5 2 -11 -8 -7.5 11 -1.5z" fill="#FFD23F" stroke={INK} strokeWidth={3} strokeLinejoin="round" />}
      {/* the cuff */}
      <rect x="54" y="146" width="96" height="42" rx="14" fill="#5BB8FF" stroke={INK} strokeWidth={5} />
      <rect x="54" y="146" width="96" height="12" rx="6" fill="#B9C2D6" stroke={INK} strokeWidth={4} />
      <rect x="66" y="168" width="44" height="8" rx="4" fill={cuffLight} stroke={INK} strokeWidth={2.5} />
      <circle cx="130" cy="172" r="6" fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
    </svg>
  );
});

/** Which drawn pose best matches the tracked hand (features from input/features.ts). */
export function poseFor(f: { ext: number[]; ext4: number; thumbUp: number; lShape: number; pointing?: number }, st: { pinching: boolean; grabbing: boolean }): GlovePose {
  if (st.grabbing) return "fist";
  if (st.pinching) return "pinch";
  // v8: pointing wins over a low average extension (it used to draw a fist while the kid pointed)
  if ((f.pointing ?? 0) > 0.5) return "point";
  if (f.thumbUp > 0.6) return "thumbs";
  if (f.lShape > 0.6) return "frame";
  const rest = (f.ext[2] + f.ext[3] + f.ext[4]) / 3;
  if (f.ext[1] > 0.6 && rest < 0.42) return "point";
  if (f.ext4 < 0.3) return "fist";
  if (f.ext4 > 0.72) return "open";
  return "relaxed";
}
