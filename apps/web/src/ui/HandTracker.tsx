// v7.6 HAND TRACKER: draws what the tracker sees right on the kid's hand in the camera picture
// (tracking brackets, the 21-point hand skeleton, glowing fingertips and a "Right hand" tag), so
// kids can see that the game has found their hand and exactly where it thinks each finger is.
// Visual feedback only: it reads the engine's feed like the glove avatar does; gameplay still
// listens to intents. Place it inside the same box as a <LiveCamera> (object-fit: cover, mirrored).
import { useEffect, useRef } from "react";
import { gloves } from "../input/engine";

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
const TIPS = [4, 8, 12, 16, 20];
const INK = "#241D48";

export default function HandTracker({ count = 0 }: { count?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const countRef = useRef(count);
  countRef.current = count;
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let frame: { hands: { landmarks: { x: number; y: number }[]; handedness: string }[] } | null = null;
    let at = 0;
    // smoothed points per hand, so the drawing glides between tracker frames
    const smooth = new Map<string, { x: number; y: number }[]>();
    const off = gloves.onFeed((f) => {
      frame = f.frame;
      at = performance.now();
    });
    let raf = 0;
    const draw = () => {
      const box = c.parentElement?.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (box && (c.width !== Math.round(box.width * dpr) || c.height !== Math.round(box.height * dpr))) {
        c.width = Math.round(box.width * dpr);
        c.height = Math.round(box.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const v = c.parentElement?.querySelector("video");
      const fresh = frame && performance.now() - at < 450;
      if (box && fresh && frame) {
        // the same mapping as the picture: object-fit cover; landmarks are already mirrored
        // (no picture yet: assume a 16:9 camera filling the box)
        const vw = v?.videoWidth || 1280, vh = v?.videoHeight || 720;
        const s = Math.max(box.width / vw, box.height / vh);
        const dw = vw * s, dh = vh * s;
        const ox = (box.width - dw) / 2, oy = (box.height - dh) / 2;
        for (const h of frame.hands) {
          const raw = h.landmarks.map((p) => ({ x: ox + p.x * dw, y: oy + p.y * dh }));
          const prev = smooth.get(h.handedness);
          const pts = prev && prev.length === raw.length ? raw.map((p, i) => ({ x: prev[i].x + (p.x - prev[i].x) * 0.55, y: prev[i].y + (p.y - prev[i].y) * 0.55 })) : raw;
          smooth.set(h.handedness, pts);
          const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
          const pad = 18;
          const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
          // tracking brackets
          const L = Math.min(34, (x1 - x0) / 3);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (const [w, col] of [[9, INK], [5, "#FFD23F"]] as const) {
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
            ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
            ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
            ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
            ctx.stroke();
          }
          // skeleton: an ink outline under a mint line
          for (const [w, col] of [[8, INK], [4, "#8EE6C4"]] as const) {
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            for (const [a, b] of BONES) {
              ctx.moveTo(pts[a].x, pts[a].y);
              ctx.lineTo(pts[b].x, pts[b].y);
            }
            ctx.stroke();
          }
          // joints and glowing fingertips
          pts.forEach((p, i) => {
            const tip = TIPS.includes(i);
            ctx.beginPath();
            ctx.arc(p.x, p.y, tip ? 9 : 5, 0, Math.PI * 2);
            ctx.fillStyle = tip ? "#FFD23F" : "#FFFFFF";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = INK;
            ctx.stroke();
          });
          // the tag: which hand, and the finger count when a quiz is listening
          const n = countRef.current;
          const tag = `${h.handedness === "Right" ? "Right" : "Left"} hand${n > 0 ? ` · ${n} finger${n > 1 ? "s" : ""}` : " found"}`;
          ctx.font = '600 16px "Fredoka", sans-serif';
          const tw = ctx.measureText(tag).width + 26;
          const tx = Math.max(6, Math.min(box.width - tw - 6, x0));
          const ty = Math.max(6, y0 - 38);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.roundRect(tx, ty, tw, 28, 14);
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(tag, tx + 13, ty + 19);
        }
      } else if (!fresh) smooth.clear();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, []);
  return <canvas ref={cv} className="hand-tracker" aria-hidden="true" />;
}
