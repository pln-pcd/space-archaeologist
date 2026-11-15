// Star Gloves engine: camera → tracker → features → 1€ filter → aim assist → verb state machines →
// intent bus. Also: the Hand Coach, the rest reminder, the debug feed and the "glove click bridge"
// that lets a pinch press any button or 3D object under the glove cursor.
import { OneEuroFilter } from "1eurofilter";
import { acquireCamera, frameBrightness, releaseCamera } from "./camera";
import { currentCalibration } from "./calibration";
import { nearestTarget } from "./aim";
import { intents } from "./bus";
import { computeFeatures, type HandFeatures } from "./features";
import { pushFrame } from "./recorder";
import { useInput, type CoachTip } from "./store";
import { HandSmoother } from "./smoothing";
import { Tracker } from "./tracker";
import type { TrackFrame } from "./types";
import { VerbCore, coverScreen, outsideBox, toScreen } from "./verbs";

export type DebugFeed = { frame: TrackFrame | null; features: HandFeatures[]; cursor: { x: number; y: number; visible: boolean }; snapped: string | null };

/** marks events the glove bridge dispatches so the mouse/touch adapter ignores them */
export const GLOVE_EVENT = "__glove";

class GloveEngine {
  tracker: Tracker | null = null;
  core = new VerbCore();
  private smoother = new HandSmoother();
  private fx = new OneEuroFilter(30, 1, 0.02);
  private fy = new OneEuroFilter(30, 1, 0.02);
  private unsub: (() => void) | null = null;
  private running = false;
  private lifecycle = 0;
  cursor = { x: innerWidth / 2, y: innerHeight / 2, visible: false };
  snapped: string | null = null;
  feed: DebugFeed = { frame: null, features: [], cursor: this.cursor, snapped: null };
  private feedListeners = new Set<(f: DebugFeed) => void>();
  private lastStore = 0;
  private lastLight = 0;
  private dark = false;
  private activeSince = 0;
  private lastSeen = 0;
  private restShownAt = 0;
  private hoverEl: Element | null = null;
  private lastHover = 0;
  private pinchDownTarget: Element | null = null;
  /** last ~250 ms of cursor positions (and whether aim assist held them on a target) */
  private hist: { t: number; x: number; y: number; snapped: boolean }[] = [];
  /** a fresh pinch stays on the spot it started on for a moment (a "click" never slips off) */
  private lock: { x: number; y: number; rawX: number; rawY: number; until: number } | null = null;
  /** when the kid last used mouse, touch or keys (no "show me your hand" nagging then) */
  private otherInputAt = 0;
  private showTipSince = 0;
  private showTipScope = "";
  constructor() {
    intents.onAny((e) => {
      if (e.source !== "gesture" && e.name !== "pointer") this.otherInputAt = performance.now();
    });
  }

  get isRunning() {
    return this.running;
  }

  onFeed(f: (d: DebugFeed) => void) {
    this.feedListeners.add(f);
    return () => void this.feedListeners.delete(f);
  }

  /** Start camera + tracker. Rejects with a CamStatus string or Error; callers fall back gracefully. */
  private starting: Promise<void> | null = null;
  /** idempotent: concurrent callers share one start */
  start() {
    if (this.running) return Promise.resolve();
    if (!this.starting) this.starting = this.doStart().finally(() => (this.starting = null));
    return this.starting;
  }
  private async doStart() {
    const ticket = this.lifecycle;
    const video = await acquireCamera();
    if(ticket !== this.lifecycle || useInput.getState().mode !== "gloves" || useInput.getState().handScenes === 0){releaseCamera(true);return;}
    try {
      if (!this.tracker) this.tracker = new Tracker();
      await this.tracker.init();
    } catch (e) {
      releaseCamera();
      throw e;
    }
    if(ticket !== this.lifecycle || useInput.getState().mode !== "gloves" || useInput.getState().handScenes === 0){this.tracker?.dispose();this.tracker=null;releaseCamera(true);return;}
    this.tracker.start(video);
    this.unsub = this.tracker.onFrame((f) => this.onFrame(f));
    this.running = true;
  }

  /** stop the camera; `dispose` also closes the recognizer (bible §5.2: when a mini-game ends) */
  stop(dispose = false) {
    this.lifecycle++;
    if (!this.running) {
      releaseCamera(true);
      if (dispose && this.tracker) {
        this.tracker.dispose();
        this.tracker = null;
      }
      return;
    }
    this.running = false;
    this.unsub?.();
    this.unsub = null;
    if (dispose) {
      this.tracker?.dispose();
      this.tracker = null;
      useInput.getState().set({ inferenceMs: 0, trackerFps: 0 });
    } else this.tracker?.stop();
    releaseCamera();
    this.cursor.visible = false;
    intents.emit("pointer", { x: this.cursor.x, y: this.cursor.y, visible: false }, "gesture");
    useInput.getState().set({ hands: 0, coach: null });
  }

  setFilter(minCutoff: number, beta: number) {
    this.fx.setMinCutoff(minCutoff);
    this.fx.setBeta(beta);
    this.fy.setMinCutoff(minCutoff);
    this.fy.setBeta(beta);
  }

  private onFrame(frame: TrackFrame) {
    const inp = useInput.getState();
    const t = frame.t;
    pushFrame(frame);
    // velocity-adaptive landmark smoothing (MediaPipe's relative velocity filter): steady when
    // still, no lag when fast; the recorder above keeps the raw frames
    frame = { ...frame, hands: this.smoother.apply(frame.hands, t) };
    const feats = frame.hands.map((h) => computeFeatures(h, frame.aspect));
    // Sol Keeper can clean with both open hands. Gameplay receives only screen-space intents.
    if (intents.label() === "sol-keeper") for (const f of feats) {
      const point = f.gesture === "Pointing_Up";
      const pos = inp.backdrop > 0 ? coverScreen(point ? f.indexTip : f.anchor, frame.aspect, innerWidth, innerHeight) : toScreen(point ? f.indexTip : f.anchor, frame.aspect, inp.tuning.boxSize);
      intents.emit("handMotion", { hand: f.handedness, x: pos.x * innerWidth, y: pos.y * innerHeight, open: f.ext4 > .6 && f.pinch > .4, pointing: point }, "gesture");
    }
    this.core.opts = { calibration: currentCalibration(), tuning: inp.tuning, leftHanded: inp.leftHanded, oneHand: inp.oneHand };
    this.core.setEnabled(intents.activeVerbs());
    this.setFilter(inp.tuning.cursorMinCutoff, inp.tuning.cursorBeta);

    // ---- cursor: interaction box → screen px → 1€ filter → aim assist ----
    // v8: the dominant hand, unless the other hand is much nearer the camera (a second person's
    // hand far behind the player never steals the glove)
    const dom = feats.find((f) => f.handedness === (inp.leftHanded ? "Left" : "Right"));
    const near = feats.reduce<HandFeatures | null>((b, f) => (!b || f.palmScale > b.palmScale ? f : b), null);
    const primary = dom && near && near !== dom && near.palmScale > dom.palmScale * 1.6 ? near : (dom ?? near);
    if (primary) {
      const s = inp.backdrop > 0 ? coverScreen(primary.anchor, frame.aspect, innerWidth, innerHeight) : toScreen(primary.anchor, frame.aspect, inp.tuning.boxSize);
      const ts = t / 1000;
      let x = this.fx.filter(s.x * innerWidth, ts);
      let y = this.fy.filter(s.y * innerHeight, ts);
      const snap = inp.backdrop > 0 || this.core.state().pinching || this.core.state().grabbing ? null : nearestTarget(x, y);
      this.snapped = snap?.id ?? null;
      if (snap) {
        const k = 0.55 * (1 - snap.d / 120);
        x += (snap.x - x) * Math.max(0, k);
        y += (snap.y - y) * Math.max(0, k);
      }
      // sticky pinch: stay on the pinched spot unless the hand clearly moves away (a drag)
      if (this.lock && this.core.state().pinching) {
        const moved = Math.hypot(x - this.lock.rawX, y - this.lock.rawY);
        if (t < this.lock.until && moved < 70) {
          x = this.lock.x;
          y = this.lock.y;
        } else this.lock = null;
      } else if (!this.core.state().pinching) this.lock = null;
      this.hist.push({ t, x, y, snapped: !!snap });
      while (this.hist.length && t - this.hist[0].t > 250) this.hist.shift();
      this.cursor = { x, y, visible: true };
      this.lastSeen = t;
      if (!this.activeSince) this.activeSince = t;
    } else if (this.cursor.visible && t - this.lastSeen > 300) {
      this.cursor = { ...this.cursor, visible: false };
      this.fx.reset();
      this.fy.reset();
    }
    if (!primary && t - this.lastSeen > 5000) this.activeSince = 0;
    intents.emit("pointer", { x: this.cursor.x, y: this.cursor.y, visible: this.cursor.visible, snapped: this.snapped }, "gesture");

    // ---- verbs ----
    const outs = this.core.step(t, feats, this.cursor);
    for (const o of outs) {
      if (o.name === "pinchStart") this.pinchAim(t, o.payload as { x: number; y: number });
      const accepted = intents.emit(o.name, o.payload as never, "gesture");
      if (accepted) this.bridge(o.name);
    }
    if (this.cursor.visible && !this.core.state().pinching) this.hover();

    // ---- Hand Coach ----
    let tip: CoachTip = null;
    if (t - this.lastLight > 1000) {
      this.lastLight = t;
      this.dark = frameBrightness() < 45;
    }
    // "Show me your hand!" only when this moment really needs a hand move (not in the base, not
    // while the kid is using the mouse or keys), and only once for a few seconds per scene
    const scope = intents.label();
    const handMove = [...intents.activeVerbs()].some((v) => v !== "pointer" && v !== "pinch");
    const needHand = !scope.startsWith("base") && handMove && t - this.otherInputAt > 10000;
    if (primary) {
      this.showTipSince = 0;
      this.showTipScope = "";
    } else if (needHand && t - this.lastSeen > 6000 && this.showTipScope !== scope) {
      if (!this.showTipSince) this.showTipSince = t;
      if (t - this.showTipSince < 6000) tip = this.dark ? "light" : "show";
      else {
        this.showTipScope = scope;
        this.showTipSince = 0;
      }
    } else this.showTipSince = 0;
    if (primary) {
      if (primary.palmScale < 0.07) tip = "closer";
      else if (primary.palmScale > 0.42) tip = "back";
      else if (outsideBox(primary.palm, frame.aspect, inp.tuning.boxSize) > 0.04) tip = "box";
    }
    // rest reminder after ~60 s of continuous gesturing (bible §4)
    if (this.activeSince && t - this.activeSince > 60000 && t - this.restShownAt > 60000) {
      this.restShownAt = t;
      this.activeSince = t;
    }
    if (t - this.restShownAt < 4000 && this.restShownAt) tip = "rest";

    // ---- publish ----
    this.feed = { frame, features: feats, cursor: this.cursor, snapped: this.snapped };
    this.feedListeners.forEach((l) => l(this.feed));
    if (t - this.lastStore > 250) {
      this.lastStore = t;
      const st = this.tracker?.stats() ?? { inferenceMs: 0, fps: 0 };
      inp.set({ inferenceMs: Math.round(st.inferenceMs * 10) / 10, trackerFps: st.fps, hands: feats.length, coach: tip });
    }
  }

  /** a pinch aims where the glove pointed just before the fingers closed (closing drags the hand) */
  private pinchAim(t: number, p: { x: number; y: number }) {
    const raw = { x: this.cursor.x, y: this.cursor.y };
    let best: { x: number; y: number } | null = null;
    // prefer a moment where aim assist held the cursor on a target, else ~90 ms ago
    for (let i = this.hist.length - 1; i >= 0; i--) {
      const h = this.hist[i];
      if (t - h.t > 220) break;
      if (h.snapped) {
        best = h;
        break;
      }
      if (!best && t - h.t >= 90) best = h;
    }
    if (best && Math.hypot(best.x - raw.x, best.y - raw.y) < 90) {
      p.x = best.x;
      p.y = best.y;
      this.cursor = { ...this.cursor, x: best.x, y: best.y };
    }
    this.lock = { x: this.cursor.x, y: this.cursor.y, rawX: raw.x, rawY: raw.y, until: t + 450 };
  }

  // ---- glove click bridge: pinch = press whatever is under the glove ----
  private dispatch(type: string, el: Element) {
    const init = { bubbles: true, cancelable: true, composed: true, clientX: this.cursor.x, clientY: this.cursor.y, pointerId: 77, pointerType: "pen", isPrimary: true, button: 0, buttons: type === "pointerdown" ? 1 : 0 };
    const ev = type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init);
    (ev as unknown as Record<string, boolean>)[GLOVE_EVENT] = true;
    el.dispatchEvent(ev);
  }
  private targetAt(): Element | null {
    const overlay = document.querySelectorAll<HTMLElement>("[data-glove-ignore]");
    overlay.forEach((o) => (o.style.pointerEvents = "none"));
    const el = document.elementFromPoint(this.cursor.x, this.cursor.y);
    overlay.forEach((o) => (o.style.pointerEvents = ""));
    return el;
  }
  private bridge(name: string) {
    if (name !== "pinchStart" && name !== "pinchEnd") return;
    if (document.body.dataset.gloveBridge === "off") return;
    const el = this.targetAt();
    if (!el) return;
    if (name === "pinchStart") {
      this.pinchDownTarget = el;
      this.dispatch("pointerdown", el);
      return;
    }
    this.dispatch("pointerup", el);
    if (this.pinchDownTarget && (el === this.pinchDownTarget || this.pinchDownTarget.contains(el) || el.contains(this.pinchDownTarget))) {
      this.dispatch("click", el);
      if (el instanceof HTMLElement && el.matches("input,select,textarea")) el.focus();
    }
    this.pinchDownTarget = null;
  }
  private hover() {
    const now = performance.now();
    if (now - this.lastHover < 90) return;
    this.lastHover = now;
    const el = this.targetAt();
    if (!el) return;
    if (el !== this.hoverEl) {
      if (this.hoverEl) this.dispatch("pointerout", this.hoverEl);
      this.hoverEl = el;
      this.dispatch("pointerover", el);
    }
    // 3D canvases need moves to update raycast hover
    if (el.tagName === "CANVAS") this.dispatch("pointermove", el);
  }
}

export const gloves = new GloveEngine();

// Dev/test hook: inject landmark frames (e.g. from tools/gesture_synth.ts) through the full
// pipeline (filters, aim assist, verbs, bridge, avatar) without a real camera.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __gloves: unknown }).__gloves = {
    engine: gloves,
    intents,
    openAcademy: () => useInput.getState().set({ overlay: "academy" }),
    feed: (f: TrackFrame) => (gloves as unknown as { onFrame: (f: TrackFrame) => void }).onFrame({ ...f, t: performance.now() }),
    play: (frames: TrackFrame[]) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const t0 = performance.now(),
          f0 = frames[0]?.t ?? 0;
        const step = () => {
          const now = performance.now();
          while (i < frames.length && frames[i].t - f0 <= now - t0) {
            (gloves as unknown as { onFrame: (f: TrackFrame) => void }).onFrame({ ...frames[i], t: t0 + frames[i].t - f0 });
            i++;
          }
          if (i < frames.length) setTimeout(step, 16);
          else resolve();
        };
        step();
      }),
  };
}
