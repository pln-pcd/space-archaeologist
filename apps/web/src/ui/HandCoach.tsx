// Glove Cam (bible §5, §15): a big, friendly mirror of the kid's camera in the bottom-right corner.
// It shows what the game sees: the comfy "hand zone" and the tracked hand drawn as glowing dots,
// plus one short status line ("I see your hand!"). It doubles as the always-visible "camera on"
// light. The kid can shrink it to a small pill at any time. Frames are never saved or sent.
import { useEffect, useRef, useState } from "react";
import { Minimize2, Video } from "lucide-react";
import { getStream } from "../input/camera";
import { gloves } from "../input/engine";
import { useInput, type CoachTip } from "../input/store";

const TIPS: Record<Exclude<CoachTip, null>, string> = {
  show: "Show me your hand.",
  closer: "Come a little closer.",
  back: "Move back a little.",
  box: "Bring your hand into the zone.",
  light: "It's dark. Face a light.",
  rest: "Good work. Shake out your arms and rest.",
};
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/** The tracked hand, drawn over the mirrored video so kids see the game "sees" them. */
function HandDots({ mirror }: { mirror: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    return gloves.onFeed((f) => {
      const w = c.clientWidth,
        h = c.clientHeight;
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      if (!f.frame) return;
      const st = gloves.core.state();
      const col = st.grabbing ? "#ccc6bd" : st.pinching ? "#cad1d4" : "#ccc6bd";
      for (const hand of f.frame.hands) {
        // landmarks are already mirrored to match a mirrored preview
        const P = hand.landmarks.map((p) => ({ x: (mirror ? p.x : 1 - p.x) * w, y: p.y * h }));
        ctx.lineCap = "round";
        ctx.strokeStyle = "#343029";
        ctx.lineWidth = 7;
        ctx.beginPath();
        BONES.forEach(([a, b]) => (ctx.moveTo(P[a].x, P[a].y), ctx.lineTo(P[b].x, P[b].y)));
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 3.5;
        ctx.stroke();
        for (const i of [4, 8, 12, 16, 20]) {
          ctx.fillStyle = "#343029";
          ctx.beginPath();
          ctx.arc(P[i].x, P[i].y, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(P[i].x, P[i].y, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }, [mirror]);
  return <canvas ref={ref} className="gc-dots" aria-hidden="true" />;
}

export function CameraPreview({ embedded = false }: { embedded?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  const camera = useInput((s) => s.camera);
  const open = useInput((s) => s.cameraPreview);
  const mirror = useInput((s) => s.mirror);
  const hands = useInput((s) => s.hands);
  const coach = useInput((s) => s.coach);
  const tracker = useInput((s) => s.tracker);
  const set = useInput((s) => s.set);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (hands > 0) setSeen(true);
  }, [hands]);
  useEffect(() => {
    if (camera !== "on" || !v.current) return;
    v.current.srcObject = getStream();
    void v.current.play().catch(() => {});
  }, [camera, open]);
  if (camera !== "on") return null;
  const status: { text: string; tone: string } =
    tracker !== "ready"
      ? { text: "Waking up the gloves…", tone: "wait" }
      : coach && coach !== "show"
        ? { text: TIPS[coach], tone: coach === "rest" ? "ok" : "tip" }
        : hands > 0
          ? { text: hands > 1 ? "I see both hands." : "I see your hand.", tone: "ok" }
          : { text: seen ? "Hand resting. The mouse works too." : "Hold up a hand to play", tone: "idle" };
  // v7.5: shrunk = gone (the green Hands button in the HUD already shows the camera is on)
  if (!open) return null;
  return (
    <div className={`glove-cam v2 ${embedded ? "embedded" : ""} tone-${status.tone}`} data-glove-ignore aria-label="Glove Cam: the camera is on">
      <div className="gc-screen">
        <video ref={v} muted playsInline style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
        <HandDots mirror={mirror} />
        <header>
          <i className="gc-live" aria-hidden="true" />
          <strong>Glove Cam</strong>
          {!embedded && (
            <button type="button" onClick={() => set({ cameraPreview: false })} aria-label="Shrink the Glove Cam">
              <Minimize2 size={16} />
            </button>
          )}
        </header>
        <footer className="gc-status" role="status">
          <span className="gc-dot" aria-hidden="true" />
          {status.text}
        </footer>
      </div>
    </div>
  );
}

export default function HandCoach() {
  const coach = useInput((s) => s.coach);
  const mode = useInput((s) => s.mode);
  const camera = useInput((s) => s.camera);
  const gameCam = useInput((s) => s.gameCam > 0 && s.backdrop === 0);
  if (mode !== "gloves" || camera !== "on" || !gameCam) return null;
  // v7.5: tips live only in the Glove Cam's status line (no random pop-up bubbles)
  const bubble = null as typeof coach;
  void open;
  return (
    <>
      <CameraPreview />
      <>
        {bubble && (
          <div key={bubble} className={`hand-coach k-pop tip-${bubble}`} role="status" data-glove-ignore>
            <span className="coach-face" aria-hidden="true">
              <i />
              <i />
            </span>
            {TIPS[bubble]}
          </div>
        )}
      </>
    </>
  );
}
