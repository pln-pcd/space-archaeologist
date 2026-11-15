// /dev/gestures: every verb lights up, with the source that fired it (gesture / mouse / touch /
// keyboard). Proves the fallbacks emit exactly the same intents. Dev tool.
import { useEffect, useState } from "react";
import { intents, useIntentScope, ALL_VERBS } from "../input/bus";
import { gloves } from "../input/engine";
import { useInput } from "../input/store";
import { INTENT_VERB, type IntentEvent, type Source, type VerbId } from "../input/types";
import { GLYPHS } from "../ui/ActionPrompt";
import GlovesLayer from "../ui/GlovesLayer";
import { HandDemo, VERB_DEMO } from "../ui/HandDemo";
import "../ui/gloves.css";
import "./playground.css";

type Hit = { t: number; source: Source; n: Partial<Record<Source, number>>; detail: string };

const TAP_VERBS: VerbId[] = ["palmHold", "push", "thumbsUp", "frame", "steer", "pilot"];
function tap(v: VerbId) {
  const src = intents.lastSource === "touch" ? "touch" : "mouse";
  if (v === "palmHold") intents.emit("palmHold", { progress: 1, done: true, x: 0, y: 0 }, src);
  if (v === "push") intents.emit("push", { strength: 1 }, src);
  if (v === "thumbsUp") intents.emit("thumbsUp", {}, src);
  if (v === "frame") intents.emit("frame", {}, src);
  if (v === "steer") intents.emit("steer", { value: 0.6, active: true }, src);
  if (v === "pilot") intents.emit("pilot", { throttle: 0.8, steer: 0, active: true }, src);
}

export default function GesturePlayground() {
  const [solo, setSolo] = useState<VerbId | null>(null);
  useEffect(() => {
    (window as unknown as { __pg: unknown }).__pg = { solo: setSolo, tap };
  }, []);
  useIntentScope(ALL_VERBS.filter((v) => v !== "pilot" && v !== "steer"), { keyboardCursor: false }, "playground");
  useIntentScope(solo ? [solo] : null, {}, `playground:${solo}`);
  const [hits, setHits] = useState<Partial<Record<VerbId, Hit>>>({});
  const [log, setLog] = useState<string[]>([]);
  const [steerMode, setSteerMode] = useState(false);
  const inp = useInput();
  useEffect(() => {
    document.body.dataset.gloveBridge = "off";
    useInput.getState().set({ debug: true });
    return intents.onAny((e: IntentEvent) => {
      const verb: VerbId | null = e.name === "pointer" ? "pointer" : INTENT_VERB[e.name];
      if (!verb) return;
      if (e.name === "pointer" && !(e as IntentEvent<"pointer">).visible) return;
      if (e.name === "palmHold" && !(e as IntentEvent<"palmHold">).done) return;
      if ((e.name === "steer" || e.name === "pilot") && !(e as IntentEvent<"steer">).active) return;
      if (e.name === "pinchMove") return;
      const detail =
        e.name === "swipe" ? (e as IntentEvent<"swipe">).dir : e.name === "dial" ? (e as IntentEvent<"dial">).delta.toFixed(2) : e.name === "steer" ? (e as IntentEvent<"steer">).value.toFixed(2) : e.name === "pilot" ? `thr ${(e as IntentEvent<"pilot">).throttle.toFixed(2)}` : e.name === "release" ? `${Math.round((e as IntentEvent<"release">).speed)} px/s` : e.name;
      setHits((h) => {
        const prev = h[verb];
        const n = { ...(prev?.n ?? {}) };
        n[e.source] = (n[e.source] ?? 0) + 1;
        return { ...h, [verb]: { t: performance.now(), source: e.source, n, detail } };
      });
      if (e.name !== "pointer" && e.name !== "steer" && e.name !== "pilot") setLog((l) => [`${new Date().toLocaleTimeString()}  ${e.source.padEnd(8)} ${e.name} ${detail}`, ...l].slice(0, 14));
    });
  }, []);
  useIntentScope(steerMode ? ["steer", "pilot"] : null, {}, "playground:steer");

  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(iv);
  }, []);

  const startGloves = async () => {
    inp.set({ mode: "gloves", consented: true });
    try {
      await gloves.start();
    } catch (e) {
      setLog((l) => [`camera/tracker failed: ${String(e)}`, ...l]);
    }
  };

  return (
    <main className="playground">
      <header>
        <h1>Star Gloves playground</h1>
        <p>Every verb lights up when its intent fires. The badge shows who fired it. Mouse, touch and keys send the same intents as hands.</p>
        <div className="pg-actions">
          <button type="button" className="chunky gold small" onClick={startGloves} disabled={gloves.isRunning}>
            {inp.camera === "on" ? `Gloves on · ${inp.delegate ?? ""} · ${inp.inferenceMs} ms` : "Start Star Gloves (camera)"}
          </button>
          <button type="button" className="chunky quiet small" onClick={() => setSteerMode((s) => !s)}>
            {steerMode ? "Back to all verbs" : "Steer + Pilot mode (WASD)"}
          </button>
          <span className="pg-status">
            camera {inp.camera} · tracker {inp.tracker} · hands {inp.hands} · {inp.trackerFps} Hz
          </span>
        </div>
      </header>
      <section className="pg-grid">
        {ALL_VERBS.map((v) => {
          const h = hits[v];
          const lit = h && now - h.t < 700;
          return (
            <article key={v} className={`pg-tile ${lit ? "lit" : ""} ${solo === v ? "solo" : ""}`} data-verb={v} onDoubleClick={() => setSolo(solo === v ? null : v)}>
              <HandDemo verb={v} size={64} />
              <h2>{VERB_DEMO[v].name}</h2>
              <p className="pg-fallback">
                ✋ {GLYPHS[v].hand} · ⌨ {GLYPHS[v].key} · 👆 {GLYPHS[v].touch}
              </p>
              <p className="pg-counts">
                {(["gesture", "mouse", "touch", "keyboard"] as Source[]).map((s) => (
                  <span key={s} className={h?.n[s] ? "has" : ""} data-source={s}>
                    {s} {h?.n[s] ?? 0}
                  </span>
                ))}
              </p>
              {h && <small>{h.detail}</small>}
              <span className="pg-tile-actions">
                <button type="button" onClick={() => setSolo(solo === v ? null : v)}>
                  {solo === v ? "All verbs" : "Solo"}
                </button>
                {TAP_VERBS.includes(v) && (
                  <button type="button" onClick={() => tap(v)}>
                    Tap
                  </button>
                )}
              </span>
            </article>
          );
        })}
      </section>
      <ol className="pg-log">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
      <GlovesLayer firstRun={false} />
    </main>
  );
}
