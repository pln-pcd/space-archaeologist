// WARP (v7.3): the hyperspace jump between big moments (START, entering a chapter, back to the ship).
// Drawn on ONE lightweight 2D canvas (no extra WebGL context fighting the 3D scene, which made the old
// version stutter): star streaks rush out from the centre in candy colours, a little rocket zooms
// through, and a title card pops. The next screen is swapped in underneath at the peak, and the warp
// only clears once that screen has drawn its first frames (warpReady), so there is no black gap and no
// "film starts, pauses, starts again". warpBusy() lets films hold their clock until it's gone.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { motion } from "../../anim/kit";
import { cute } from "../../audio/cute";

type Phase = "off" | "in" | "wait" | "out";
type Warp = { phase: Phase; label: string; sub: string; id: number };
const useWarp = create<Warp>(() => ({ phase: "off", label: "", sub: "", id: 0 }));
const SWAP_AT = 0.75;
const MIN_HOLD = 1.5;
let readyAt = 0;
let startedAt = 0;

/** true while the warp still covers the screen (films and fps checks wait for it) */
export const warpBusy = () => {
  const p = useWarp.getState().phase;
  return p === "in" || p === "wait";
};

/** the next screen calls this once it has drawn (a couple of frames after mounting) */
export function warpReady() {
  readyAt = performance.now();
}
/** React helper: mark ready two frames after mount */
export function useWarpReady(ready = true) {
  useEffect(() => {
    if (!ready) return;
    let a = 0,
      b = 0;
    a = requestAnimationFrame(() => (b = requestAnimationFrame(() => warpReady())));
    return () => (cancelAnimationFrame(a), cancelAnimationFrame(b));
  }, [ready]);
}

/** jump to hyperspace: `swap` runs at the peak (hidden under the streaks) */
export function warpTo(label: string, sub: string, swap: () => void) {
  const id = useWarp.getState().id + 1;
  readyAt = 0;
  startedAt = performance.now();
  useWarp.setState({ phase: "in", label, sub, id });
  cute.warp();
  const reduced = motion.reduced;
  setTimeout(swap, (reduced ? 0.25 : SWAP_AT) * 1000);
  setTimeout(() => useWarp.getState().id === id && useWarp.setState({ phase: "wait" }), (reduced ? 0.3 : SWAP_AT + 0.05) * 1000);
  // clear once the new screen is ready (and at least MIN_HOLD has passed); never longer than 4 s
  const check = () => {
    if (useWarp.getState().id !== id) return;
    const t = (performance.now() - startedAt) / 1000;
    const ok = (readyAt > 0 && t > (reduced ? 0.5 : MIN_HOLD)) || t > 4;
    if (ok) {
      useWarp.setState({ phase: "out" });
      setTimeout(() => useWarp.getState().id === id && useWarp.setState({ phase: "off" }), reduced ? 200 : 600);
    } else setTimeout(check, 80);
  };
  setTimeout(check, 400);
}

const N = 420;
type Dest = "moon" | "mars" | "home";
/** where the jump is going: the label names it */
const destOf = (label: string): Dest => (/moon/i.test(label) ? "moon" : /mars/i.test(label) ? "mars" : "home");
// spots on the destination world: [x, y, r] in planet radii
const SPOTS: Record<Dest, [number, number, number][]> = {
  moon: [[-0.35, -0.3, 0.2], [0.3, 0.1, 0.26], [-0.1, 0.45, 0.14], [0.5, -0.45, 0.11], [-0.6, 0.2, 0.12], [0.05, -0.05, 0.08]],
  mars: [[-0.3, -0.2, 0.32], [0.35, 0.3, 0.22], [0.1, -0.55, 0.15], [-0.55, 0.45, 0.14]],
  home: [[-0.3, -0.35, 0.16], [0.35, 0.2, 0.12], [-0.05, 0.4, 0.1]],
};
const LOOKS: Record<Dest, { lit: string; base: string; spot: string; glow: string }> = {
  moon: { lit: "#FBF8FF", base: "#B8B1CC", spot: "rgba(120, 110, 150, 0.35)", glow: "rgba(220, 210, 255, 0.7)" },
  mars: { lit: "#FFC79A", base: "#D2603F", spot: "rgba(140, 45, 30, 0.35)", glow: "rgba(255, 140, 90, 0.7)" },
  home: { lit: "#FFD3EC", base: "#B66BFF", spot: "rgba(255, 255, 255, 0.35)", glow: "rgba(255, 150, 220, 0.75)" },
};
const backOut = (k: number) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);

function Streaks({ phase, dest }: { phase: Phase; dest: Dest }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const ph = useRef(phase);
  ph.current = phase;
  useEffect(() => {
    const c = cv.current!;
    const x = c.getContext("2d")!;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const resize = () => {
      c.width = Math.round(innerWidth * dpr);
      c.height = Math.round(innerHeight * dpr);
    };
    resize();
    addEventListener("resize", resize);
    let s = 9;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const cols = ["#FFFFFF", "#FFE27A", "#FF9AD5", "#9FD8FF", "#C9B3FF", "#8FF2D0"];
    const stars = Array.from({ length: N }, () => ({ a: r() * Math.PI * 2, d: r(), c: cols[Math.floor(r() * cols.length)], w: 0.6 + r() * 1.8 }));
    let speed = 0.15;
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const want = ph.current === "out" ? 0.05 : ph.current === "in" ? 2.4 : 1.6;
      speed += (want - speed) * Math.min(1, dt * 3);
      const W = c.width,
        H = c.height,
        cx = W / 2,
        cy = H / 2,
        R = Math.hypot(cx, cy);
      // a purple tunnel glow
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, "#5B2CA8");
      g.addColorStop(0.35, "#341872");
      g.addColorStop(1, "#140838");
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      // pulsing rings rushing outward
      // the rAF stamp can be a hair earlier than t0: never let time (or a radius) go negative
      const tt = Math.max(0, (now - t0) / 1000);
      for (let i = 0; i < 5; i++) {
        const k = (tt * speed * 0.5 + i / 5) % 1;
        x.strokeStyle = `rgba(255, 140, 220, ${0.18 * (1 - k)})`;
        x.lineWidth = (2 + k * 18) * dpr;
        x.beginPath();
        x.arc(cx, cy, Math.max(0, k * R), 0, Math.PI * 2);
        x.stroke();
      }
      x.lineCap = "round";
      for (const st of stars) {
        st.d += dt * speed * (0.3 + st.d * 1.4);
        if (st.d > 1.05) st.d = 0.02 + Math.random() * 0.1;
        const d0 = st.d * R,
          len = Math.max(2, speed * 40 * st.d) * dpr;
        const ca = Math.cos(st.a),
          sa = Math.sin(st.a);
        x.strokeStyle = st.c;
        x.globalAlpha = Math.min(1, st.d * 2.2);
        x.lineWidth = st.w * dpr * (0.6 + st.d);
        x.beginPath();
        x.moveTo(cx + ca * d0, cy + sa * d0);
        x.lineTo(cx + ca * (d0 + len), cy + sa * (d0 + len));
        x.stroke();
      }
      x.globalAlpha = 1;
      // a soft white core
      const core = x.createRadialGradient(cx, cy, 0, cx, cy, 160 * dpr);
      core.addColorStop(0, "rgba(255,255,255,0.55)");
      core.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = core;
      x.fillRect(cx - 160 * dpr, cy - 160 * dpr, 320 * dpr, 320 * dpr);
      // v7.4: the destination world swells out of the tunnel (instead of a title card)
      const kp = Math.min(1, Math.max(0, (tt - 0.3) / 1.1));
      if (kp > 0) {
        const L = LOOKS[dest];
        const pr = Math.max(0.5, Math.min(W, H) * 0.19 * backOut(kp)) * (ph.current === "out" ? 1 + (now - t0) / 9000 : 1);
        const py = cy - H * 0.07;
        x.save();
        x.shadowColor = L.glow;
        x.shadowBlur = 70 * dpr;
        const pg = x.createRadialGradient(cx - pr * 0.35, py - pr * 0.4, pr * 0.1, cx, py, pr);
        pg.addColorStop(0, L.lit);
        pg.addColorStop(1, L.base);
        x.fillStyle = pg;
        x.beginPath();
        x.arc(cx, py, pr, 0, Math.PI * 2);
        x.fill();
        x.restore();
        x.save();
        x.beginPath();
        x.arc(cx, py, pr, 0, Math.PI * 2);
        x.clip();
        const drift = (tt * 0.06) % 2;
        for (const [sx, sy, sr] of SPOTS[dest]) {
          let ox = sx + drift;
          if (ox > 1.2) ox -= 2.4;
          x.fillStyle = L.spot;
          x.beginPath();
          x.arc(cx + ox * pr, py + sy * pr, sr * pr, 0, Math.PI * 2);
          x.fill();
        }
        // a soft night side
        const sh = x.createRadialGradient(cx - pr * 0.5, py - pr * 0.5, pr * 0.9, cx - pr * 0.3, py - pr * 0.3, pr * 1.9);
        sh.addColorStop(0, "rgba(36, 16, 80, 0)");
        sh.addColorStop(1, "rgba(36, 16, 80, 0.55)");
        x.fillStyle = sh;
        x.fillRect(cx - pr, py - pr, pr * 2, pr * 2);
        x.restore();
        x.lineWidth = 5 * dpr;
        x.strokeStyle = "#241D48";
        x.beginPath();
        x.arc(cx, py, pr, 0, Math.PI * 2);
        x.stroke();
        if (dest === "home") {
          // a candy ring around the home world
          x.lineWidth = 9 * dpr;
          x.strokeStyle = "#FFE27A";
          x.beginPath();
          x.ellipse(cx, py, pr * 1.55, pr * 0.32, -0.25, Math.PI * 0.05, Math.PI * 0.95);
          x.stroke();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => (cancelAnimationFrame(raf), removeEventListener("resize", resize));
  }, []);
  return <canvas ref={cv} className="warp-canvas" />;
}

export default function WarpLayer() {
  const { phase, label, sub, id } = useWarp();
  if (phase === "off") return null;
  return (
    <div key={id} className={`warp ${phase} ${motion.reduced ? "calm" : ""}`} aria-hidden="true">
      {!motion.reduced && <Streaks phase={phase} dest={destOf(label)} />}
      {!motion.reduced && (
        <svg className="warp-rocket" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 4c10 7 14 18 14 30l-7 10H25l-7-10C18 22 22 11 32 4z" fill="#fff" stroke="#241D48" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="32" cy="26" r="7" fill="#5BB8FF" stroke="#241D48" strokeWidth="3" />
          <path d="M18 34l-8 11 9 2M46 34l8 11-9 2" fill="#FF6FA8" stroke="#241D48" strokeWidth="3" strokeLinejoin="round" />
          <path d="M26 46c0 8 6 14 6 14s6-6 6-14" fill="#FFD23F" stroke="#241D48" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      )}
      {label && (
        <div className="warp-card">
          <small>{sub}</small>
          <strong>{label}</strong>
        </div>
      )}
    </div>
  );
}
