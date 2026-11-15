// The on-screen Star Glove (bible §5 feedback), only while Star Gloves are on (chapters, Glove
// Academy). A drawn 2D cartoon glove (GloveSprite) shows the pose the tracker sees, turns with the
// wrist and glides at the screen's refresh rate; a glowing aim dot marks exactly where it points,
// a ring fills during a Power Palm, and a short sparkle trail follows the fingertip.
// Position and rotation are written straight to the DOM; React only re-renders on a pose change.
import { useEffect, useRef, useState } from "react";
import { gloves } from "../input/engine";
import { intents } from "../input/bus";
import { useInput } from "../input/store";
import { GLOVE_HOTSPOT, GloveArt, poseFor, type GlovePose, type GloveTone } from "./GloveSprite";
import { coverScreen } from "../input/verbs";

const TRAIL = 8;
const TONE_GLOW: Record<GloveTone, string> = { idle: "#FFE08A", pinch: "#9FFFF0", grab: "#FFC2C0", palm: "#FFE9A8", snap: "#9FFFF0" };

export default function GloveAvatar() {
  const mode = useInput((s) => s.mode);
  const svg = useRef<SVGSVGElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<{ pose: GlovePose; tone: GloveTone; left: boolean }>({ pose: "relaxed", tone: "idle", left: false });
  useEffect(() => {
    const root = svg.current;
    const el = sprite.current;
    if (!root || !el) return;
    const trail = [...root.querySelectorAll<SVGCircleElement>(".ga-trail")];
    const ring = root.querySelector<SVGCircleElement>(".ga-ring")!;
    const dot = root.querySelector<SVGCircleElement>(".ga-dot")!;
    const halo = root.querySelector<SVGCircleElement>(".ga-halo")!;
    let palmProgress = 0;
    let palmAt = 0;
    const tgt = { x: 0, y: 0, roll: 0, on: false, scale: 1 };
    const cur = { x: 0, y: 0, roll: 0, fade: 0, init: false, scale: 1 };
    const hist: { x: number; y: number }[] = [];
    let lastLook = "";
    let tone: GloveTone = "idle";
    let leftNow = false;
    const offProgress = intents.on("palmHold", (e) => {
      if (e.source !== "gesture") return;
      palmProgress = e.done ? 0 : e.progress;
      palmAt = performance.now();
    });
    const off = gloves.onFeed((f) => {
      const st = gloves.core.state();
      // the palm ring only counts while palm-hold events keep arriving
      if (performance.now() - palmAt > 200) palmProgress = 0;
      const lh = useInput.getState().leftHanded;
      const h = f.frame ? (f.frame.hands.find((x) => x.handedness === (lh ? "Left" : "Right")) ?? f.frame.hands[0]) : null;
      const feat = h ? f.features[f.frame!.hands.indexOf(h)] : null;
      if (!h || !feat || !f.cursor.visible) {
        tgt.on = false;
        return;
      }
      tone = st.grabbing ? "grab" : st.pinching ? "pinch" : palmProgress > 0.05 ? "palm" : f.snapped ? "snap" : "idle";
      // pinch and grab always show their own pose; a Power Palm shows the open hand
      const pose = !st.pinching && !st.grabbing && palmProgress > 0.05 ? "open" : poseFor(feat, st);
      const left = feat.handedness === "Left";
      leftNow = left;
      const key = `${pose}|${tone}|${left}`;
      if (key !== lastLook) {
        lastLook = key;
        setLook({ pose, tone, left });
        el.classList.remove("pop");
        void el.offsetWidth; // restart the little pose-change pop
        el.classList.add("pop");
      }
      tgt.x = f.cursor.x;
      tgt.y = f.cursor.y;
      tgt.roll = Math.max(-0.9, Math.min(0.9, feat.roll));
      tgt.on = true;
      // v7.5: on a full-screen camera the glove is as big as the hand in the picture
      if (useInput.getState().backdrop > 0 && f.frame) {
        const { s } = coverScreen(feat.anchor, f.frame.aspect, innerWidth, innerHeight);
        const handPx = feat.palmScale * s * 2.3;
        tgt.scale = Math.max(0.6, Math.min(3.2, handPx / (el.offsetWidth || 160)));
      } else tgt.scale = 1;
    });
    // display-rate glide (the tracker runs at 15–30 Hz, the screen at 60+)
    let raf = 0,
      last = performance.now();
    const C = 2 * Math.PI * 46;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (tgt.on && !cur.init) {
        cur.x = tgt.x;
        cur.y = tgt.y;
        cur.roll = tgt.roll;
        cur.init = true;
      }
      const a = 1 - Math.exp(-dt * 26);
      cur.x += (tgt.x - cur.x) * a;
      cur.y += (tgt.y - cur.y) * a;
      cur.roll += (tgt.roll - cur.roll) * (1 - Math.exp(-dt * 12));
      cur.scale += (tgt.scale - cur.scale) * (1 - Math.exp(-dt * 10));
      cur.fade = Math.max(0, Math.min(1, cur.fade + (tgt.on ? dt * 8 : -dt * 5)));
      if (!tgt.on && cur.fade === 0) cur.init = false;
      const size = el.offsetWidth || 160;
      const k = size / 200;
      const hx = leftNow ? 200 - GLOVE_HOTSPOT[0] : GLOVE_HOTSPOT[0];
      el.style.transformOrigin = `${hx * k}px ${GLOVE_HOTSPOT[1] * k}px`;
      el.style.transform = `translate(${(cur.x - hx * k).toFixed(1)}px, ${(cur.y - GLOVE_HOTSPOT[1] * k).toFixed(1)}px) rotate(${cur.roll.toFixed(3)}rad) scale(${cur.scale.toFixed(3)})`;
      el.style.opacity = cur.fade.toFixed(2);
      // aim dot + halo at the exact point the glove aims at
      const glow = TONE_GLOW[tone];
      dot.setAttribute("cx", cur.x.toFixed(1));
      dot.setAttribute("cy", cur.y.toFixed(1));
      dot.setAttribute("fill", glow);
      dot.style.opacity = String(cur.fade);
      halo.setAttribute("cx", cur.x.toFixed(1));
      halo.setAttribute("cy", cur.y.toFixed(1));
      halo.setAttribute("stroke", glow);
      halo.style.opacity = String(cur.fade * (tone === "snap" || tone === "pinch" ? 1 : 0.55));
      ring.setAttribute("cx", cur.x.toFixed(1));
      ring.setAttribute("cy", cur.y.toFixed(1));
      ring.setAttribute("stroke-dasharray", `${C}`);
      ring.setAttribute("stroke-dashoffset", `${C * (1 - palmProgress)}`);
      ring.style.opacity = palmProgress > 0.02 && tgt.on ? "1" : "0";
      // short sparkle trail
      if (tgt.on) hist.unshift({ x: cur.x, y: cur.y });
      else hist.length = 0;
      if (hist.length > TRAIL) hist.pop();
      trail.forEach((t, i) => {
        const p = hist[i * 1 + 1];
        if (!p) return void (t.style.opacity = "0");
        t.setAttribute("cx", p.x.toFixed(1));
        t.setAttribute("cy", p.y.toFixed(1));
        t.setAttribute("r", Math.max(1, 5 - i * 0.55).toFixed(1));
        t.setAttribute("fill", glow);
        t.style.opacity = String((1 - i / TRAIL) * 0.6 * cur.fade);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      off();
      offProgress();
    };
  }, [mode]); // re-wire when the kid switches to Star Gloves mid-game

  if (mode !== "gloves") return null;
  return (
    <>
      <div ref={sprite} className={`glove-sprite ${look.left ? "left" : ""}`} data-glove-ignore aria-hidden="true">
        <GloveArt pose={look.pose} tone={look.tone} />
      </div>
      <svg ref={svg} className="glove-avatar" data-glove-ignore aria-hidden="true">
        <defs>
          <filter id="ga-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: TRAIL }, (_, i) => (
          <circle key={i} className="ga-trail" r="4" style={{ display: "none" }} />
        ))}
        <circle className="ga-ring" r="46" />
        <circle className="ga-halo" r="15" fill="none" strokeWidth="3" style={{ display: "none" }} />
        <circle className="ga-dot" r="7" filter="url(#ga-glow)" style={{ display: "none" }} />
      </svg>
    </>
  );
}
