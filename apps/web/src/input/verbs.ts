// Verb state machines (bible §5 step 6). Pure and Node-safe: tools/gestures_check.ts replays
// recordings through exactly this code.
//
// Every verb has: enter/exit hysteresis, a minimum hold, a cooldown, confidence that builds over a
// few frames, and (for grab and pinch) an intent lock that survives short tracking dropouts.
import type { HandFeatures } from "./features.ts";
import { DEFAULT_CALIBRATION, DEFAULT_TUNING, type Calibration, type IntentMap, type IntentName, type Tuning, type VerbId } from "./types.ts";

export type CoreOut = { name: IntentName; payload: IntentMap[IntentName] };
export type CoreOptions = { calibration: Calibration; tuning: Tuning; leftHanded: boolean; oneHand: boolean };
export type Cursor = { x: number; y: number; visible: boolean };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Confidence that rises/falls over frames instead of flipping on a single noisy frame. */
class Conf {
  v = 0;
  step(on: number | boolean, dt: number, riseS = 0.1, fallS = 0.15) {
    const target = typeof on === "boolean" ? (on ? 1 : 0) : clamp01(on);
    this.v = target > this.v ? Math.min(target, this.v + dt / riseS) : Math.max(target, this.v - dt / fallS);
    return this.v;
  }
}

/**
 * Interaction box: the central part of the camera frame maps to the whole screen (bible §4).
 * Its centre sits a little below the middle of the frame: kids rest their hand in front of the
 * chest, so reaching the top of the screen should not mean lifting the hand above the face.
 */
export const BOX_CY = 0.57;
export function toScreen(p: { x: number; y: number }, aspect: number, box: number): { x: number; y: number } {
  const nx = p.x / aspect; // back to 0..1
  const boxH = box * 0.95;
  return { x: clamp01((nx - 0.5) / box + 0.5), y: clamp01((p.y - BOX_CY) / boxH + 0.5) };
}

/**
 * v7.5: map a (mirrored) camera point straight onto a full-screen `object-fit: cover` video, so the
 * glove lands exactly on the kid's real hand in the picture. Also returns pixels per frame-height.
 */
export function coverScreen(p: { x: number; y: number }, aspect: number, w: number, h: number) {
  const nx = p.x / aspect;
  const s = Math.max(w / aspect, h);
  return { x: clamp01((w / 2 + (nx - 0.5) * aspect * s) / w), y: clamp01((h / 2 + (p.y - 0.5) * s) / h), s };
}

/** How far a point is outside the interaction box (0 inside), for the Hand Coach. */
export function outsideBox(p: { x: number; y: number }, aspect: number, box: number) {
  const nx = p.x / aspect;
  const dx = Math.max(0, Math.abs(nx - 0.5) - box / 2 - 0.08);
  const dy = Math.max(0, Math.abs(p.y - BOX_CY) - (box * 0.95) / 2 - 0.08);
  return Math.max(dx, dy);
}

type Tracked = { f: HandFeatures; vx: number; vy: number; speed: number; lastT: number; px: number; py: number };

/** finger counting: straight above, curled below; a count must hold this long (ms) */
export const COUNT_STRAIGHT = 0.62, COUNT_CURLED = 0.42, COUNT_MS = 800, COUNT_SETTLE = 160;

export class VerbCore {
  opts: CoreOptions;
  enabled = new Set<VerbId>();
  scores: Record<VerbId, number> = { pointer: 0, pinch: 0, grab: 0, palmHold: 0, wave: 0, swipe: 0, dial: 0, steer: 0, push: 0, pilot: 0, frame: 0, thumbsUp: 0, fistStamp: 0, count: 0 };
  /** latest thresholds, for the debug overlay */
  thresholds: Record<string, number> = {};

  private hands = new Map<string, Tracked>();
  private primaryKey: string | null = null;
  private lostAt = 0;
  private lastT = 0;
  private cursorHist: { t: number; x: number; y: number }[] = [];
  private suppressPalmUntil = 0;

  // per-verb state
  private pinch = { conf: new Conf(), on: false, since: 0, offSince: 0, x: 0, y: 0, roll: 0, rollStart: 0 };
  private grab = { conf: new Conf(), on: false, since: 0, offSince: 0, openAt: -1e9 };
  private palm = { progress: 0, cooldownUntil: 0, needReset: false, last: -1 };
  private wave = { dir: 0, segStart: 0, flips: [] as number[], cooldownUntil: 0 };
  private swipe = { cooldownUntil: 0, pending: null as null | { dir: IntentMap["swipe"]["dir"]; at: number; vx: number; vy: number } };
  private steer = { active: false };
  private push = { hist: [] as { t: number; s: number; x: number; y: number }[], cooldownUntil: 0 };
  private pilot = { active: false };
  private frame = { conf: new Conf(), since: 0, cooldownUntil: 0 };
  private thumbs = { conf: new Conf(), since: 0, cooldownUntil: 0 };
  private stamp = { cooldownUntil: 0 };
  private count = { n: 0, since: 0, fired: 0, lostAt: 0, cand: 0, candAt: 0, up: [false, false, false, false], thumb: false, tooManyAt: 0 as number | undefined };

  constructor(opts?: Partial<CoreOptions>) {
    this.opts = { calibration: DEFAULT_CALIBRATION, tuning: DEFAULT_TUNING, leftHanded: false, oneHand: false, ...opts };
  }

  setEnabled(verbs: Iterable<VerbId>) {
    this.enabled = new Set(verbs);
  }

  private th() {
    const c = this.opts.calibration;
    const s = this.opts.tuning.sensitivity;
    const pr = Math.max(0.2, c.pinchOpen - c.pinchClosed);
    const er = Math.max(0.2, c.openExt - c.fistExt);
    const t = {
      pinchOn: c.pinchClosed + pr * (0.32 + 0.06 * (s - 1)),
      pinchOff: c.pinchClosed + pr * (0.48 + 0.06 * (s - 1)),
      fistOn: c.fistExt + er * (0.4 + 0.08 * (s - 1)),
      fistOff: c.fistExt + er * 0.6,
      openOn: c.fistExt + er * 0.72,
      waveAmp: 0.6 / s,
      swipeSpeed: 4.2 / s,
      pushGrow: 1 + 0.18 / s,
      stampSpeed: 3.2 / s,
      holdMs: this.opts.tuning.palmHoldMs,
    };
    this.thresholds = t;
    return t;
  }

  /** the hand used for one-hand verbs: the dominant one if present */
  primary(): Tracked | null {
    const want = this.opts.leftHanded ? "Left" : "Right";
    if (this.primaryKey && this.hands.has(this.primaryKey)) return this.hands.get(this.primaryKey)!;
    const pick = this.hands.get(want) ?? [...this.hands.values()][0] ?? null;
    this.primaryKey = pick ? pick.f.handedness : null;
    return pick;
  }

  /**
   * One step. `hands` are this frame's features (any order). `cursor` is the engine's filtered,
   * aim-assisted cursor in px, used for payload positions and release velocity.
   */
  step(t: number, hands: HandFeatures[], cursor: Cursor): CoreOut[] {
    const out: CoreOut[] = [];
    const emit = <K extends IntentName>(name: K, payload: IntentMap[K]) => out.push({ name, payload });
    const dt = this.lastT ? clamp((t - this.lastT) / 1000, 0.001, 0.2) : 1 / 30;
    this.lastT = t;
    const th = this.th();

    // ---- track hands, velocities in palm-widths per second ----
    const seen = new Set<string>();
    for (const f of hands) {
      const key = f.handedness;
      if (seen.has(key)) continue; // two hands labelled the same: keep the first
      seen.add(key);
      const prev = this.hands.get(key);
      let vx = 0,
        vy = 0;
      if (prev && t - prev.lastT < 250 && t - prev.lastT < 4) {
        // same timestamp (batched frames): keep the previous velocity, don't divide by ~0
        vx = prev.vx;
        vy = prev.vy;
      } else if (prev && t - prev.lastT < 250) {
        const pdt = (t - prev.lastT) / 1000;
        const ivx = (f.palm.x - prev.px) / pdt / f.palmScale;
        const ivy = (f.palm.y - prev.py) / pdt / f.palmScale;
        vx = prev.vx * 0.35 + ivx * 0.65;
        vy = prev.vy * 0.35 + ivy * 0.65;
      }
      this.hands.set(key, { f, vx, vy, speed: Math.hypot(vx, vy), lastT: t, px: f.palm.x, py: f.palm.y });
    }
    for (const k of [...this.hands.keys()]) if (!seen.has(k) && t - this.hands.get(k)!.lastT > 300) this.hands.delete(k);
    const visible = hands.length > 0;
    if (!visible && !this.lostAt) this.lostAt = t;
    if (visible) this.lostAt = 0;
    const lostFor = this.lostAt ? t - this.lostAt : 0;
    const P = visible ? this.primary() : null;
    const pf = P && seen.has(P.f.handedness) ? P : null;

    this.cursorHist.push({ t, x: cursor.x, y: cursor.y });
    while (this.cursorHist.length && t - this.cursorHist[0].t > 120) this.cursorHist.shift();
    const en = (v: VerbId) => this.enabled.has(v);
    this.scores.pointer = visible ? 1 : 0;

    // ---- fist confidence (shared by grab, steer, stamp) ----
    // v8: a fist needs the INDEX curled too: a pointing hand (index out, three curled) averages a
    // low ext4 and used to read as a fist (the glove turned into a fist while the kid pointed)
    const indexCurled = pf ? clamp01((0.5 - pf.f.ext[1]) / 0.2) : 0;
    const fistRaw = pf && pf.f.pointing < 0.5 ? Math.max(clamp01((th.fistOn - pf.f.ext4) / 0.12 + 0.5) * indexCurled, pf.f.gesture === "Closed_Fist" ? pf.f.gestureScore * indexCurled : 0) : 0;

    // ---- PINCH (+ DIAL while pinching) ----
    if (en("pinch") || en("dial")) {
      const g = this.pinch;
      const ratio = pf ? pf.f.pinch : 99;
      const notFist = pf ? pf.f.ext[1] > 0.25 || pf.f.ext4 > th.fistOn : false;
      const raw = pf && notFist ? clamp01((th.pinchOff - ratio) / Math.max(0.05, th.pinchOff - th.pinchOn)) : 0;
      const c = g.conf.step(raw, dt, 0.06, 0.12);
      this.scores.pinch = c;
      if (!g.on) {
        if (pf && ratio < th.pinchOn && c > 0.6) {
          if (!g.since) g.since = t;
          if (t - g.since >= 50) {
            g.on = true;
            g.offSince = 0;
            g.x = cursor.x;
            g.y = cursor.y;
            g.roll = g.rollStart = pf.f.roll;
            if (en("pinch")) emit("pinchStart", { x: cursor.x, y: cursor.y });
          }
        } else g.since = 0;
      } else {
        const releasing = pf ? ratio > th.pinchOff : lostFor > 250;
        if (releasing) {
          if (!g.offSince) g.offSince = t;
          if (t - g.offSince >= (pf ? 90 : 0)) {
            g.on = false;
            g.since = 0;
            if (en("pinch")) emit("pinchEnd", { x: cursor.x, y: cursor.y, cancelled: !pf });
          }
        } else {
          g.offSince = 0;
          if (pf) {
            if (en("pinch") && (cursor.x !== g.x || cursor.y !== g.y)) emit("pinchMove", { x: cursor.x, y: cursor.y, dx: cursor.x - g.x, dy: cursor.y - g.y });
            g.x = cursor.x;
            g.y = cursor.y;
            if (en("dial")) {
              const d = wrap(pf.f.roll - g.roll);
              g.roll = pf.f.roll;
              if (Math.abs(d) > 0.004) emit("dial", { delta: d, angle: wrap(pf.f.roll - g.rollStart) });
              this.scores.dial = clamp01(Math.abs(d) * 20);
            }
          }
        }
      }
    }

    // ---- GRAB & RELEASE (intent lock) ----
    if (en("grab")) {
      const g = this.grab;
      // a grab is an action: the hand was open shortly before it closed (rejects resting loose fists)
      if (pf && (pf.f.ext4 > th.fistOff + 0.08 || (pf.f.gesture === "Open_Palm" && pf.f.gestureScore > 0.6))) g.openAt = t;
      const recentlyOpen = t - g.openAt < 1800;
      const c = g.conf.step(recentlyOpen ? fistRaw : 0, dt, 0.08, 0.15);
      this.scores.grab = c;
      if (!g.on) {
        if (pf && c > 0.7 && pf.f.ext4 < th.fistOn + 0.05 && pf.f.ext[1] < 0.45 && pf.f.pointing < 0.4) {
          if (!g.since) g.since = t;
          if (t - g.since >= 70) {
            g.on = true;
            g.offSince = 0;
            emit("grab", { x: cursor.x, y: cursor.y });
          }
        } else g.since = 0;
      } else {
        const open = pf ? pf.f.ext4 > th.fistOff || pf.f.pointing > 0.6 || (pf.f.gesture === "Open_Palm" && pf.f.gestureScore > 0.6) : lostFor > 300;
        if (open) {
          if (!g.offSince) g.offSince = t;
          if (t - g.offSince >= (pf ? 90 : 0)) {
            g.on = false;
            g.since = 0;
            const h = this.cursorHist;
            const a = h[0],
              b = h[h.length - 1];
            const span = Math.max(0.016, (b.t - a.t) / 1000);
            const vx = (b.x - a.x) / span,
              vy = (b.y - a.y) / span;
            emit("release", { x: cursor.x, y: cursor.y, vx, vy, speed: Math.hypot(vx, vy) });
          }
        } else g.offSince = 0;
      }
    }

    // ---- POWER PALM (dwell ring) ----
    if (en("palmHold")) {
      const g = this.palm;
      const f = pf?.f;
      const label = f && f.gesture === "Open_Palm" ? f.gestureScore : 0;
      const openRule = f ? clamp01((f.ext4 - th.openOn) / 0.1 + 0.5) * clamp01((f.ext[0] - 0.35) / 0.25) : 0;
      const open = Math.max(openRule, label * 0.9);
      const still = pf ? clamp01((1.1 - pf.speed) / 0.5) : 0;
      const facing = f ? clamp01((f.facing + 0.1) / 0.4) : 0;
      const ok = open * still * facing;
      this.scores.palmHold = ok;
      if (t < g.cooldownUntil || t < this.suppressPalmUntil) g.progress = 0;
      else if (g.needReset) {
        if (ok < 0.3) g.needReset = false;
      } else if (ok > 0.55) {
        g.progress = Math.min(1, g.progress + (dt * 1000) / th.holdMs);
      } else g.progress = Math.max(0, g.progress - (dt * 1000 * 2.5) / th.holdMs);
      if (g.progress >= 1) {
        emit("palmHold", { progress: 1, done: true, x: cursor.x, y: cursor.y });
        g.progress = 0;
        g.cooldownUntil = t + 900;
        g.needReset = true;
        g.last = 0;
      } else if (g.progress !== g.last && (g.progress > 0 || g.last > 0)) {
        emit("palmHold", { progress: g.progress, done: false, x: cursor.x, y: cursor.y });
        g.last = g.progress;
      }
    }

    // ---- WAVE WIND ----
    if (en("wave") && pf) {
      const g = this.wave;
      const openish = pf.f.ext4 > 0.5;
      const dir = Math.abs(pf.vx) > 0.8 ? Math.sign(pf.vx) : 0;
      if (openish && dir && dir !== g.dir) {
        // segment ended: count it as a flip if it travelled far enough
        const travelled = Math.abs(pf.f.palm.x - g.segStart) / pf.f.palmScale;
        if (g.dir !== 0 && travelled > th.waveAmp) g.flips.push(t);
        g.dir = dir;
        g.segStart = pf.f.palm.x;
      }
      g.flips = g.flips.filter((ft) => t - ft < 1200);
      this.scores.wave = clamp01(g.flips.length / 3);
      if (g.flips.length >= 3 && t > g.cooldownUntil) {
        emit("wave", { strength: clamp01(g.flips.length / 4) });
        g.flips = [];
        g.cooldownUntil = t + 900;
        this.swipe.pending = null; // a wave is not a swoosh
        this.swipe.cooldownUntil = t + 600;
      }
    } else if (!pf) this.wave.dir = 0;

    // ---- SWOOSH ----
    if (en("swipe")) {
      const g = this.swipe;
      const fast = pf ? pf.speed / th.swipeSpeed : 0;
      this.scores.swipe = clamp01(fast);
      if (g.pending) {
        // with Wave enabled, wait briefly: a quick reverse stroke means it was a wave
        const reversed = pf && Math.sign(pf.vx) === -Math.sign(g.pending.vx) && Math.abs(pf.vx) > th.swipeSpeed * 0.5;
        if (reversed) g.pending = null;
        else if (t - g.pending.at > 200) {
          emit("swipe", { dir: g.pending.dir });
          g.pending = null;
          g.cooldownUntil = t + 450;
        }
      } else if (pf && t > g.cooldownUntil && pf.speed > th.swipeSpeed && !this.grab.on && !this.pinch.on) {
        const horizontal = Math.abs(pf.vx) > 1.6 * Math.abs(pf.vy);
        const vertical = Math.abs(pf.vy) > 1.6 * Math.abs(pf.vx);
        if (horizontal || vertical) {
          const dir: IntentMap["swipe"]["dir"] = horizontal ? (pf.vx > 0 ? "right" : "left") : pf.vy > 0 ? "down" : "up";
          if (en("wave") && horizontal) g.pending = { dir, at: t, vx: pf.vx, vy: pf.vy };
          else {
            emit("swipe", { dir });
            g.cooldownUntil = t + 450;
          }
        }
      }
    }

    // ---- STEER (two fists = wheel; one fist roll in one-hand mode or with one hand) ----
    if (en("steer")) {
      const fists = [...this.hands.values()].filter((h) => seen.has(h.f.handedness) && (h.f.ext4 < th.fistOn + 0.08 || (h.f.gesture === "Closed_Fist" && h.f.gestureScore > 0.5)));
      let value = 0,
        active = false;
      if (fists.length >= 2 && !this.opts.oneHand) {
        const [a, b] = fists[0].f.palm.x < fists[1].f.palm.x ? [fists[0], fists[1]] : [fists[1], fists[0]];
        value = clamp(Math.atan2(b.f.palm.y - a.f.palm.y, b.f.palm.x - a.f.palm.x) / 0.7, -1, 1);
        active = true;
      } else if (fists.length === 1 || (pf && this.opts.oneHand)) {
        const h = fists[0] ?? pf!;
        value = clamp(h.f.roll / 0.6, -1, 1);
        active = true;
      }
      this.scores.steer = active ? 0.4 + Math.abs(value) * 0.6 : 0;
      if (active || this.steer.active) emit("steer", { value: active ? value : 0, active });
      this.steer.active = active;
    }

    // ---- ROCKET PUSH (palm grows fast toward the screen) ----
    if (en("push")) {
      const g = this.push;
      if (pf) g.hist.push({ t, s: pf.f.palmScale, x: pf.f.palm.x, y: pf.f.palm.y });
      else g.hist = [];
      while (g.hist.length && t - g.hist[0].t > 400) g.hist.shift();
      let score = 0;
      if (pf && g.hist.length > 3 && pf.f.ext4 > th.openOn - 0.1 && pf.f.facing > -0.1) {
        let min = g.hist[0];
        for (const h of g.hist) if (h.s < min.s) min = h;
        const grow = pf.f.palmScale / min.s;
        const lateral = Math.hypot(pf.f.palm.x - min.x, pf.f.palm.y - min.y) / pf.f.palmScale;
        score = clamp01((grow - 1) / (th.pushGrow - 1)) * (lateral < 0.9 ? 1 : 0);
        if (grow > th.pushGrow && lateral < 0.9 && t > g.cooldownUntil && t - min.t > 80) {
          emit("push", { strength: clamp01((grow - 1) / 0.4) });
          g.cooldownUntil = t + 1200;
          g.hist = [];
          this.suppressPalmUntil = t + 700;
          this.palm.progress = 0;
        }
      }
      this.scores.push = score;
    }

    // ---- PILOT HAND (height = throttle, tilt = steer) ----
    if (en("pilot")) {
      if (pf) {
        const throttle = clamp01(1 - (pf.f.palm.y - 0.2) / 0.6);
        emit("pilot", { throttle, steer: clamp(pf.f.roll / 0.6, -1, 1), active: true });
        this.scores.pilot = 1;
        this.pilot.active = true;
      } else if (this.pilot.active && lostFor > 200) {
        emit("pilot", { throttle: 0.5, steer: 0, active: false });
        this.pilot.active = false;
        this.scores.pilot = 0;
      }
    }

    // ---- PHOTO FRAME (one or two L hands) ----
    if (en("frame")) {
      const g = this.frame;
      const ls = [...this.hands.values()].filter((h) => seen.has(h.f.handedness)).map((h) => h.f.lShape);
      const two = ls.length >= 2 && ls[0] > 0.5 && ls[1] > 0.5;
      const c = g.conf.step(two ? 1 : Math.max(0, ...ls, 0), dt, 0.1, 0.2);
      this.scores.frame = c;
      if (c > 0.75 && t > g.cooldownUntil) {
        if (!g.since) g.since = t;
        if (t - g.since >= (two ? 200 : 380)) {
          emit("frame", {});
          g.cooldownUntil = t + 1500;
          g.since = 0;
        }
      } else if (c < 0.4) g.since = 0;
    }

    // ---- THUMBS UP (canned label AND rule) ----
    // v7.6 finger counting: how many of index, middle, ring and pinky are straight (thumb ignored,
    // so "3" works whether or not the thumb is out). Held for COUNT_MS with the same count = a pick.
    if (en("count")) {
      // v8 STRICT finger counting: the number of straight digits INCLUDING a thumb that is clearly
      // held out. Only 1-4 is an answer: an open hand (5) or a fist (0) never picks anything.
      // Each finger has hysteresis, the count must settle, then be held still for COUNT_MS.
      const g = this.count;
      const f = pf?.f;
      if (!f) {
        if (!g.lostAt) g.lostAt = t;
        if (t - g.lostAt > 300) (g.n = 0), (g.cand = 0), (g.since = 0), (g.fired = 0), (g.thumb = false);
      } else {
        g.lostAt = 0;
        const cal = this.opts.calibration;
        g.up = f.ext.slice(1).map((e, i) => {
          // per-player thresholds from Hand Training when we have them (open vs curled per finger)
          const o = cal.fingerOpen?.[i + 1], c = cal.fingerCurled?.[i + 1];
          const on = o !== undefined && c !== undefined && o - c > 0.25 ? c + (o - c) * 0.62 : COUNT_STRAIGHT;
          const off = o !== undefined && c !== undefined && o - c > 0.25 ? c + (o - c) * 0.42 : COUNT_CURLED;
          return g.up[i] ? e > off : e > on;
        });
        const fingers = g.up.filter(Boolean).length;
        g.thumb = g.thumb ? f.thumbOut > 0.3 : f.thumbOut > 0.55;
        // five: four fingers up and the thumb not tucked (lenient), or MediaPipe's open palm label
        const five = fingers === 4 && (g.thumb || f.thumbAway > 0.4 || (f.gesture === "Open_Palm" && f.gestureScore > 0.55));
        // pointing fingers move a lot: a count is only read from a fairly still hand
        const still = (pf?.speed ?? 0) < 2.2;
        const n = five ? 5 : fingers + (g.thumb && fingers > 0 ? 1 : 0);
        if (n !== g.cand) (g.cand = n), (g.candAt = t);
        if (g.cand !== g.n && t - g.candAt >= COUNT_SETTLE) {
          g.n = g.cand;
          g.since = t;
          if (g.n !== g.fired) g.fired = 0;
        }
        if (!still) g.since = Math.max(g.since, t - COUNT_MS * 0.5);
        const valid = g.n >= 1 && g.n <= 4;
        this.scores.count = valid ? Math.min(1, (t - g.since) / COUNT_MS) : 0;
        if (valid) {
          const progress = Math.min(1, (t - g.since) / COUNT_MS);
          const done = progress >= 1 && g.fired !== g.n;
          if (done) g.fired = g.n;
          if (!g.fired || done) emit("fingers", { count: g.n, progress, done });
        } else if (g.n === 5 && t - (g.tooManyAt ?? 0) > 400) {
          // tell the screen "too many" (never an answer)
          g.tooManyAt = t;
          emit("fingers", { count: 5, progress: 0, done: false });
        }
      }
    }
    if (en("thumbsUp")) {
      const g = this.thumbs;
      const f = pf?.f;
      const label = f && f.gesture === "Thumb_Up" ? f.gestureScore : 0;
      const rule = f ? f.thumbUp : 0;
      const fused = rule > 0.3 && label > 0.5 ? (rule + label) / 2 : rule > 0.8 ? rule * 0.85 : 0;
      const c = g.conf.step(fused, dt, 0.1, 0.15);
      this.scores.thumbsUp = c;
      if (c > 0.65 && t > g.cooldownUntil) {
        if (!g.since) g.since = t;
        if (t - g.since >= 280) {
          emit("thumbsUp", {});
          g.cooldownUntil = t + 1200;
          g.since = 0;
        }
      } else if (c < 0.4) g.since = 0;
    }

    // ---- FIST STAMP (fist, then a fast move down) ----
    if (en("fistStamp")) {
      const g = this.stamp;
      const down = pf ? pf.vy / th.stampSpeed : 0;
      this.scores.fistStamp = clamp01(fistRaw) * clamp01(down);
      if (pf && fistRaw > 0.6 && pf.vy > th.stampSpeed && Math.abs(pf.vy) > 1.5 * Math.abs(pf.vx) && t > g.cooldownUntil) {
        emit("fistStamp", { x: cursor.x, y: cursor.y });
        g.cooldownUntil = t + 700;
      }
    }

    return out;
  }

  /** for the debug overlay and coach */
  state() {
    const p = this.primary();
    return { pinching: this.pinch.on, grabbing: this.grab.on, palmProgress: this.palm.progress, primary: p?.f ?? null, speed: p?.speed ?? 0 };
  }
}
