// Shared Chapter 1 UI (bible §6B "stacked paper"): the step sequencer that drives voice, captions
// and the 3D timelines, the bottom caption card, Pause / Replay / Skip, and small fact cards.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import glossary from "../../content/glossary.json";
import { Button, Card, DialogueBox, Tag } from "../../odyssey/ui/kit";
import { line } from "./flow";
import { loadDurations, say, type Speech } from "./voice";

export type Step = { id: string; line?: string; card?: string; min?: number };
export type Clock = { i: number; t: number; paused: boolean; total: number };

/**
 * Plays steps in order. A step lasts at least `min` seconds and, if it has a line, until the line
 * has been spoken plus 0.8 s. The clock (step index + step-local time) is a ref so 3D scenes read
 * it every frame without re-rendering.
 */
export function useSequence(steps: Step[], onDone: () => void, start = true, speak = say) {
  const clock = useRef<Clock>({ i: 0, t: 0, paused: false, total: 0 });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const speech = useRef<Speech | null>(null);
  const spoken = useRef(true);
  /** step-local time when the line finished (the next step waits 0.8 s after it) */
  const spokenAt = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);

  const begin = useCallback(
    (i: number) => {
      speech.current?.stop();
      clock.current.i = i;
      clock.current.t = 0;
      setIndex(i);
      const s = steps[i];
      spoken.current = !s?.line;
      spokenAt.current = 0;
      if (s?.line) {
        const sp = speak(s.line);
        speech.current = sp;
        void sp.done.then(() => {
          if (speech.current !== sp) return;
          spoken.current = true;
          spokenAt.current = clock.current.t;
        });
      }
    },
    [steps],
  );

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    let last = performance.now();
    void loadDurations().then(() => begin(0));
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = clock.current;
      if (!c.paused && !finished.current) {
        c.t += dt;
        c.total += dt;
        const s = steps[c.i];
        const min = s?.min ?? 0;
        const voiceOk = spoken.current && (!s?.line || c.t >= spokenAt.current + 0.8);
        if (s && c.t >= min && voiceOk) {
          if (c.i + 1 < steps.length) begin(c.i + 1);
          else {
            finished.current = true;
            doneRef.current();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      speech.current?.stop();
    };
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => {
    clock.current.paused = true;
    speech.current?.pause();
    setPaused(true);
  };
  const resume = () => {
    clock.current.paused = false;
    speech.current?.resume();
    setPaused(false);
  };
  return {
    clock,
    index,
    step: steps[index],
    paused,
    seek: (i: number, t = 0) => { finished.current = false; begin(Math.max(0, Math.min(steps.length - 1, i))); clock.current.t = t; },
    toggle: () => (clock.current.paused ? resume() : pause()),
    replay: () => {
      resume();
      begin(clock.current.i);
    },
    skip: () => {
      speech.current?.stop();
      finished.current = true;
      doneRef.current();
    },
  };
}

const NAMES: Record<string, string> = { nova: "Nova", narrator: "Narrator", card: "", player: "You", seeker: "Seeker", friend1: "Friend", friend2: "Friend" };

/** Bottom dialogue box (v4.6 design kit): speaker badge and True story / Imagine sticker in the header,
 *  the line below, glossary words with tips. It sits in its own safe zone; nothing floats over a video. */
export function Caption({ id, compact = false, resolve = line }: { id?: string; compact?: boolean; resolve?: typeof line }) {
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => setTip(null), [id]);
  const l = id ? resolve(id) : undefined;
  if (!l) return null;
  const who = l.speaker === "nasa" ? `${l.who ?? "Apollo 11"} · real NASA audio` : NAMES[l.speaker] ?? "";
  const terms = (l.glossary ?? []).filter((t) => (glossary.terms as Record<string, unknown>)[t]);
  let body: (string | React.ReactElement)[] = [l.text];
  for (const t of terms) {
    body = body.flatMap((part) => {
      if (typeof part !== "string") return [part];
      const i = part.toLowerCase().indexOf(t.toLowerCase());
      if (i < 0) return [part];
      return [
        part.slice(0, i),
        <button key={t} type="button" className="gloss-word od-free" onClick={() => setTip(tip === t ? null : t)}>
          {part.slice(i, i + t.length)}
        </button>,
        part.slice(i + t.length),
      ];
    });
  }
  const g = tip ? (glossary.terms as Record<string, { word: string; kid: string }>)[tip] : null;
  const kind = l.speaker === "nova" ? "nova" : l.speaker === "narrator" ? "narrator" : "other";
  return (
    <div className={`od-caption od-free ${compact ? "compact" : ""}`} data-speaker={l.speaker} role="status" aria-live="polite" key={l.id}>
      <DialogueBox speaker={who || undefined} speakerKind={kind} tag={l.type === "fact" ? "true" : "imagine"}>
        <p className={`k-line ${l.verbatim ? "verbatim" : ""}`} data-source-id={l.sourceIds?.join(",")}>{body}</p>
        {new URLSearchParams(location.search).get("judge")==="1"&&l.sourceIds&&<code>{l.sourceIds.join(" · ")}</code>}
        {g && (
          <p className="k-small od-gloss" role="note">
            <strong>{g.word}:</strong> {g.kid}
          </p>
        )}
      </DialogueBox>
    </div>
  );
}

/** Pause / Replay line / Skip: tactile pills in one even row. */
export function Controls({ paused, onToggle, onReplay, onSkip, skipLabel = "Skip" }: { paused: boolean; onToggle: () => void; onReplay?: () => void; onSkip: () => void; skipLabel?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") onToggle();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onToggle]);
  return (
    <div className="ch1-controls od-free od-toolrow">
      <Button size="sm" round onClick={onToggle} aria-label={paused ? "Play" : "Pause"} title={paused ? "Play (P)" : "Pause (P)"} quiet>
        {paused ? <Play size={24} strokeWidth={2.4} /> : <Pause size={24} strokeWidth={2.4} />}
      </Button>
      {onReplay && (
        <Button size="sm" round onClick={onReplay} aria-label="Replay this line" title="Replay this line" quiet>
          <RotateCcw size={24} strokeWidth={2.4} />
        </Button>
      )}
      <Button size="sm" variant="sky" onClick={onSkip} aria-label={skipLabel} icon={<SkipForward size={20} strokeWidth={2.4} aria-hidden="true" />}>
        {skipLabel}
      </Button>
    </div>
  );
}

/** A small fact card near the top of the screen (sticker + text). */
export function FactCard({ id, resolve = line }: { id?: string; resolve?: typeof line }) {
  const l = id ? resolve(id) : undefined;
  if (!l) return null;
  return (
    <Card className="ch1-fact od-fact" key={l.id} role="note" stitched>
      <Tag kind={l.type === "fact" ? "true" : "imagine"} />
      <p data-source-id={l.sourceIds?.join(",")}>{l.text}</p>
      {new URLSearchParams(location.search).get("judge")==="1"&&l.sourceIds&&<code>{l.sourceIds.join(" · ")}</code>}
    </Card>
  );
}

/** Pause the whole scene clock from outside (Judge, menu). */
export type SeqClock = MutableRefObject<Clock>;
