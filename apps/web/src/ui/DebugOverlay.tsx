// Gesture debug overlay (bible §5): F9 or ?debug=gestures. Dev tool, kid-invisible by default.
import { useEffect, useRef, useState } from "react";
import { intents } from "../input/bus";
import { gloves } from "../input/engine";
import { getVideo } from "../input/camera";
import { isRecording, startRecording, stopRecording } from "../input/recorder";
import { useInput } from "../input/store";
import { VERBS, type VerbId } from "../input/types";
import { BOX_CY } from "../input/verbs";

const BONES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

export default function DebugOverlay() {
  const inp = useInput();
  const cv = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [label, setLabel] = useState<VerbId | "idle">("idle");
  const [saved, setSaved] = useState("");
  const fps = useRef({ n: 0, t: performance.now(), v: 0 });

  // render-loop fps (what the kid sees), independent of tracker rate
  useEffect(() => {
    if (!inp.debug) return;
    let raf = 0;
    const loop = () => {
      const f = fps.current;
      f.n++;
      const now = performance.now();
      if (now - f.t > 1000) {
        f.v = Math.round((f.n * 1000) / (now - f.t));
        f.n = 0;
        f.t = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => force((x) => x + 1), 150);
    const off = intents.onAny((e) => {
      if (e.name === "pointer" || e.name === "pinchMove" || e.name === "pilot" || e.name === "steer" || (e.name === "palmHold" && !(e as { done?: boolean }).done)) return;
      setLog((l) => [`${e.source.padEnd(8)} ${e.name}${e.name === "swipe" ? " " + (e as { dir?: string }).dir : ""}`, ...l].slice(0, 8));
    });
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      off();
    };
  }, [inp.debug]);

  // landmarks over the mirrored video
  useEffect(() => {
    if (!inp.debug) return;
    return gloves.onFeed((f) => {
      const c = cv.current;
      const v = getVideo();
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.save();
      ctx.clearRect(0, 0, c.width, c.height);
      if (v) {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
      }
      const box = useInput.getState().tuning.boxSize;
      ctx.strokeStyle = "#aba395";
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(((1 - box) / 2) * c.width, (BOX_CY - (box * 0.95) / 2) * c.height, box * c.width, box * 0.95 * c.height);
      ctx.setLineDash([]);
      f.frame?.hands.forEach((h) => {
        ctx.strokeStyle = h.handedness === "Right" ? "#b6aea1" : "#ccc6bd";
        ctx.lineWidth = 2;
        for (const [a, b] of BONES) {
          ctx.beginPath();
          ctx.moveTo(h.landmarks[a].x * c.width, h.landmarks[a].y * c.height);
          ctx.lineTo(h.landmarks[b].x * c.width, h.landmarks[b].y * c.height);
          ctx.stroke();
        }
        ctx.fillStyle = "#fff";
        h.landmarks.forEach((p) => ctx.fillRect(p.x * c.width - 2, p.y * c.height - 2, 4, 4));
        ctx.fillText(`${h.handedness} ${h.gesture} ${(h.gestureScore * 100) | 0}%`, h.landmarks[0].x * c.width + 6, h.landmarks[0].y * c.height + 14);
      });
      ctx.restore();
    });
  }, [inp.debug]);

  if (!inp.debug) return null;
  const sc = gloves.core.scores;
  const th = gloves.core.thresholds;
  const active = intents.activeVerbs();
  const feat = gloves.feed.features[0];
  const rec = isRecording();
  return (
    <aside className="gesture-debug" data-glove-ignore aria-label="Gesture debug">
      <header>
        <strong>Star Gloves debug</strong>
        <button type="button" onClick={() => inp.set({ debug: false })}>
          ✕
        </button>
      </header>
      <canvas ref={cv} width={320} height={180} />
      <dl className="gd-stats">
        <dt>render</dt>
        <dd>{fps.current.v} fps</dd>
        <dt>tracker</dt>
        <dd>
          {inp.trackerFps} Hz · {inp.inferenceMs} ms
        </dd>
        <dt>backend</dt>
        <dd>
          {inp.backend}/{inp.delegate ?? "—"} · {inp.resolution || "no cam"}
        </dd>
        <dt>status</dt>
        <dd>
          cam {inp.camera} · {inp.tracker} · hands {inp.hands}
        </dd>
        <dt>scope</dt>
        <dd>{intents.label()}</dd>
      </dl>
      {feat && (
        <p className="gd-feat">
          ext4 {feat.ext4.toFixed(2)} · pinch {feat.pinch.toFixed(2)} · face {feat.facing.toFixed(2)} · roll {feat.roll.toFixed(2)} · scale {feat.palmScale.toFixed(3)}
        </p>
      )}
      <ul className="gd-verbs">
        {VERBS.map((v) => (
          <li key={v} className={active.has(v) ? "on" : "off"}>
            <span>{v}</span>
            <i style={{ width: `${Math.round((sc[v] ?? 0) * 100)}%` }} />
          </li>
        ))}
      </ul>
      <p className="gd-th">
        {Object.entries(th)
          .map(([k, v]) => `${k} ${v.toFixed(2)}`)
          .join(" · ")}
      </p>
      <div className="gd-sliders">
        {(
          [
            ["cursorMinCutoff", 0.05, 5, 0.05],
            ["cursorBeta", 0, 0.2, 0.002],
            ["boxSize", 0.35, 0.9, 0.01],
            ["snapRadius", 0, 160, 5],
            ["sensitivity", 0.5, 1.5, 0.05],
            ["palmHoldMs", 600, 2000, 50],
          ] as const
        ).map(([k, lo, hi, st]) => (
          <label key={k}>
            {k} <b>{inp.tuning[k]}</b>
            <input type="range" min={lo} max={hi} step={st} value={inp.tuning[k]} onChange={(e) => inp.setTuning({ [k]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
      <div className="gd-rec">
        <select value={label} onChange={(e) => setLabel(e.target.value as VerbId | "idle")}>
          <option value="idle">idle</option>
          {VERBS.filter((v) => v !== "pointer").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        {!rec ? (
          <button type="button" onClick={() => (startRecording(label), setSaved(""))}>
            ● Record
          </button>
        ) : (
          <button type="button" onClick={async () => setSaved((await stopRecording()) ?? "nothing recorded")}>
            ■ Stop ({rec.frames.length})
          </button>
        )}
        {saved && <small>{saved}</small>}
      </div>
      <ol className="gd-log">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </aside>
  );
}
