// NOVA-GUIDED TUTORIAL (v4.6 §3): runs after the talk-mode choice; skippable; replayable from Settings.
// A coach-mark overlay dims everything except the highlighted element(s), a bouncy arrow points at it,
// and a caption card with Nova's bust shows (and Nova speaks) one short line per step.
// Controls: Next, Back, Skip tutorial; keys → / Enter (next), ← (back), Esc (skip).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Volume2 } from "lucide-react";
import { say, useTalk } from "../nova/talk";
import { line } from "../nova/brain";
import { stopSpeaking } from "../nova/voice";
import type { Expression, Gesture } from "../nova/state";
import NovaStage from "../nova/NovaStage";
import { KaraokeLine } from "../nova/NovaCard";
import { Button, Card, SpeakerBadge, Tag } from "../ui/kit";
import { StampEagle } from "../../ui/stamps";

type Step = { id: string; targets: string[]; feel: Expression; act?: Gesture; art?: ReactNode };

const LEVER = (
  <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true">
    <rect x="34" y="8" width="52" height="76" rx="10" fill="#2E2A36" stroke="#241D48" strokeWidth="3" />
    <rect x="57" y="18" width="6" height="56" rx="3" fill="#5B5560" />
    <rect x="44" y="52" width="32" height="18" rx="6" fill="#7FB08A" stroke="#241D48" strokeWidth="3" className="tut-lever-knob" />
    <path d="M96 30v30l-8-8M96 60l8-8" stroke="#D94336" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const STEPS: Step[] = [
  { id: "tut-1", targets: [".od-nova-hit"], feel: "excited", act: "wave" },
  { id: "tut-2", targets: [".od-wall-zone"], feel: "happy", act: "point" },
  { id: "tut-3", targets: ['button[aria-label^="Mission 1"]'], feel: "excited", art: LEVER },
  {
    id: "tut-4",
    targets: [],
    feel: "curious",
    art: (
      <span className="tut-tags">
        <Tag kind="true" />
        <Tag kind="imagine" />
      </span>
    ),
  },
  { id: "tut-5", targets: [".od-ask"], feel: "happy", act: "point", art: <StampEagle size={84} /> },
  { id: "tut-6", targets: [".od-gear", ".tut-replay"], feel: "excited", act: "thumbs" },
  { id: "tut-archive", targets: [".m-station-toggle"], feel: "excited", act: "point" },
  { id: "tut-records", targets: [".m-station-toggle"], feel: "curious", act: "point" },
  { id: "tut-wardrobe", targets: [".m-station-toggle"], feel: "happy", act: "thumbs" },
  { id: "tut-chart", targets: [".m-station-toggle"], feel: "excited", act: "point" },
];

type R = { x: number; y: number; w: number; h: number };
const PAD = 12;
function rects(sel: string[]): R[] {
  const out: R[] = [];
  for (const s of sel) {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    out.push({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
  }
  return out;
}
const same = (a: R[], b: R[]) => a.length === b.length && a.every((r, i) => Math.abs(r.x - b[i].x) < 1 && Math.abs(r.y - b[i].y) < 1 && Math.abs(r.w - b[i].w) < 1 && Math.abs(r.h - b[i].h) < 1);

export default function Tutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [holes, setHoles] = useState<R[]>([]);
  const [vw, setVw] = useState({ w: innerWidth, h: innerHeight });
  const card = useRef<HTMLDivElement>(null);
  const step = STEPS[i];
  const speaking = useTalk((t) => !!t.msg && t.msg.progress > 0 && t.msg.progress < 1);

  // speak each step
  useEffect(() => {
    void say(step.id, { feel: step.feel, act: step.act, pointAt: step.id === "tut-2" ? [-1, 0.3] : step.id === "tut-5" ? [1, -0.6] : undefined });
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // follow the targets (projected 3D anchors move with the parallax)
  useLayoutEffect(() => {
    let raf = 0;
    let last: R[] = [];
    const tick = () => {
      const r = rects(step.targets);
      if (!same(r, last)) {
        last = r;
        setHoles(r);
      }
      if (innerWidth !== vw.w || innerHeight !== vw.h) setVw({ w: innerWidth, h: innerHeight });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i, vw.w, vw.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    stopSpeaking();
    onDone();
  };
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish());
  const back = () => i > 0 && setI(i - 1);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON")) (e.preventDefault(), next());
      else if (e.key === "ArrowLeft") (e.preventDefault(), back());
      else if (e.key === "Escape") (e.preventDefault(), finish());
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  // the card goes to the top when the target sits low on the screen
  const main = holes[0];
  const low = main ? main.y + main.h / 2 > vw.h * 0.5 : false;
  const path = `M0 0H${vw.w}V${vw.h}H0Z ` + holes.map((r) => roundRect(r, 18)).join(" ");
  const arrowUp = main ? main.y > 150 : false; // arrow sits above the target, pointing down
  return (
    <div className="tut-root od-free" role="dialog" aria-modal="true" aria-label={`Tutorial step ${i + 1} of ${STEPS.length}`} data-glove-ignore>
      <svg className="tut-dim" width={vw.w} height={vw.h} aria-hidden="true">
        <path d={path} fillRule="evenodd" fill="rgba(18,14,40,0.66)" />
        {holes.map((r, k) => (
          <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} rx={18} className="tut-ring" />
        ))}
      </svg>
      {main && (
        <div className={`tut-arrow ${arrowUp ? "down" : "up"}`} style={{ left: main.x + main.w / 2, top: arrowUp ? main.y - 8 : main.y + main.h + 8 }} aria-hidden="true">
          <svg viewBox="0 0 48 60" width="48" height="60">
            <path d="M24 56L4 32h12V4h16v28h12z" fill="#FFD23F" stroke="#241D48" strokeWidth="3.5" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div ref={card} className={`tut-card-wrap ${low ? "top" : "bottom"}`}>
        <NovaStage frame="peek" className="tut-bust" float={false} />
        <Card stitched className="tut-card" key={i}>
          <div className="tut-head">
            <SpeakerBadge name="Nova" />
            <span className="tut-count k-small">
              {i + 1} / {STEPS.length}
            </span>
          </div>
          <div className="tut-body">
            <KaraokeLine />
            {step.art && <div className="tut-art">{step.art}</div>}
          </div>
          <div className="tut-controls">
            <Button size="sm" variant="ghost" className="tut-replay" icon={<Volume2 size={22} aria-hidden="true" />} onClick={() => void say(step.id, { feel: step.feel })} aria-label="Replay what Nova said" quiet>
              Replay
            </Button>
            <span className="tut-spacer" />
            <Button size="sm" variant="ghost" onClick={finish}>
              Skip tutorial
            </Button>
            <Button size="sm" variant="secondary" onClick={back} disabled={i === 0} icon={<ArrowLeft size={22} aria-hidden="true" />}>
              Back
            </Button>
            <Button size="sm" variant="primary" onClick={next} className={speaking ? "" : "tut-next-ready"} icon={i === STEPS.length - 1 ? undefined : <ArrowRight size={22} aria-hidden="true" />} autoFocus>
              {i === STEPS.length - 1 ? "Let's go!" : "Next"}
            </Button>
          </div>
        </Card>
      </div>
      <span className="sr-only">{line(step.id)?.text}</span>
    </div>
  );
}

function roundRect({ x, y, w, h }: R, r: number) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
