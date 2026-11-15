// Capture mode (bible §9 visual QA): `?capture=1` makes the game deterministic for screenshots.
// - Math.random is seeded (mulberry32, seed 42).
// - performance.now / Date.now read a virtual clock that advances exactly 1/60 s per animation
//   frame, so R3F, GSAP and framer-motion all see the same time.
// - window.__capture lets a tool pause the clock, seek to a time and step frames, so every
//   still and every contact-sheet frame is reproducible.
// - Stepped mode (`__capture.stepMode(true)`, used by the video footage tool video/capture/):
//   nothing moves until the tool calls `__capture.step(ms)`. One step = one video frame: timers,
//   animation frames, CSS animations/transitions and <video>/<audio> playheads all advance by
//   exactly `ms` of virtual time, however slowly the frame is rendered and screenshotted. So a
//   slow, GPU-less capture still gives smooth, real-speed footage.
// - `__capture.events` logs sounds and spoken lines with their virtual time, so the edit can place
//   sound effects on the exact frame.
// Without `?capture` none of this runs: captureOn is false and every function below is a no-op.
// This module must be imported first (main.tsx) so GSAP and the rest read the patched clock.
export const captureOn = typeof location !== "undefined" && new URLSearchParams(location.search).has("capture");

type CapEvent = { t: number; kind: string; name: string; [k: string]: unknown };
let logEvent: (e: Omit<CapEvent, "t">) => void = () => {};

/** Log a game event (a sound, a spoken line) at the current virtual time. No-op outside capture. */
export function capLog(kind: string, name: string, extra?: Record<string, unknown>) {
  if (captureOn) logEvent({ kind, name, ...extra });
}

if (captureOn) {
  let seed = 42;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const DAY = Date.UTC(2026, 10, 13, 15, 0, 0); // a fixed afternoon
  let virt = 0;
  let paused = false;
  let stepped = false;
  performance.now = () => virt;
  Date.now = () => DAY + virt;
  const events: CapEvent[] = [];
  logEvent = (e) => void events.push({ t: Math.round(virt * 10) / 10, ...e } as CapEvent);

  // ---- animation frames ----
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  let realFrame = -1;
  let nextId = 1_000_000;
  const rafQueue: { id: number; cb: FrameRequestCallback }[] = [];
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    if (stepped) {
      const id = nextId++;
      rafQueue.push({ id, cb });
      return id;
    }
    return raf((stamp) => {
      // Every callback in one rendered frame shares one time, including R3F and GSAP.
      if (stamp !== realFrame) { realFrame = stamp; if (!paused) virt += 1000 / 60; }
      cb(virt);
    });
  };
  window.cancelAnimationFrame = (id: number) => {
    const i = rafQueue.findIndex((r) => r.id === id);
    if (i >= 0) rafQueue.splice(i, 1);
    else caf(id);
  };

  // ---- timers (virtual only while stepped) ----
  type Timer = { id: number; due: number; fn: (...a: unknown[]) => void; args: unknown[]; every?: number };
  const timers = new Map<number, Timer>();
  const nST = window.setTimeout.bind(window);
  const nCT = window.clearTimeout.bind(window);
  const nSI = window.setInterval.bind(window);
  const nCI = window.clearInterval.bind(window);
  const add = (fn: unknown, ms: unknown, args: unknown[], every: boolean) => {
    const id = nextId++;
    const d = Math.max(0, Number(ms) || 0);
    timers.set(id, { id, due: virt + d, fn: fn as Timer["fn"], args, every: every ? Math.max(1, d) : undefined });
    return id;
  };
  (window as unknown as { setTimeout: unknown }).setTimeout = (fn: unknown, ms?: number, ...args: unknown[]) =>
    stepped && typeof fn === "function" ? add(fn, ms, args, false) : nST(fn as TimerHandler, ms, ...args);
  (window as unknown as { setInterval: unknown }).setInterval = (fn: unknown, ms?: number, ...args: unknown[]) =>
    stepped && typeof fn === "function" ? add(fn, ms, args, true) : nSI(fn as TimerHandler, ms, ...args);
  const w = window as unknown as { clearTimeout: unknown; clearInterval: unknown };
  w.clearTimeout = (id?: number) => void (id !== undefined && timers.has(id) ? timers.delete(id) : nCT(id));
  w.clearInterval = (id?: number) => void (id !== undefined && timers.has(id) ? timers.delete(id) : nCI(id));

  // ---- media: playheads advance with the virtual clock ----
  const live = new Set<HTMLMediaElement>();
  const proto = HTMLMediaElement.prototype;
  const nPlay = proto.play;
  const nPause = proto.pause;
  proto.play = function (this: HTMLMediaElement) {
    if (!stepped) return nPlay.call(this);
    live.add(this);
    nPause.call(this);
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  };
  proto.pause = function (this: HTMLMediaElement) {
    live.delete(this);
    return nPause.call(this);
  };
  const stepMedia = (ms: number) => {
    for (const el of [...live]) {
      if (el.readyState < 1) continue;
      let t = el.currentTime + (ms / 1000) * (el.playbackRate || 1);
      if (el.duration && t >= el.duration) {
        if (el.loop) t %= el.duration;
        else {
          live.delete(el);
          el.currentTime = el.duration;
          el.dispatchEvent(new Event("timeupdate"));
          el.dispatchEvent(new Event("ended"));
          continue;
        }
      }
      el.currentTime = t;
      el.dispatchEvent(new Event("timeupdate"));
    }
  };

  // ---- CSS animations and transitions follow the virtual clock ----
  const born = new WeakMap<Animation, number>();
  const stepAnimations = () => {
    for (const a of document.getAnimations()) {
      if (!born.has(a)) born.set(a, virt);
      try {
        a.pause();
        a.currentTime = virt - born.get(a)!;
      } catch {
        /* an animation that was just removed */
      }
    }
  };

  const step = async (ms: number) => {
    const target = virt + ms;
    for (let n = 0; n < 4000; n++) {
      let next: Timer | undefined;
      for (const t of timers.values()) if (t.due <= target && (!next || t.due < next.due)) next = t;
      if (!next) break;
      virt = Math.max(virt, next.due);
      if (next.every) next.due += next.every;
      else timers.delete(next.id);
      try {
        next.fn(...next.args);
      } catch (e) {
        console.error(e);
      }
    }
    virt = target;
    stepMedia(ms);
    stepAnimations();
    for (const r of rafQueue.splice(0)) {
      try {
        r.cb(virt);
      } catch (e) {
        console.error(e);
      }
    }
    await new Promise((r) => nST(r, 0));
  };
  const settled = () =>
    new Promise<void>((resolve) => {
      let waited = 0;
      const check = () => {
        const busy = [...document.querySelectorAll("video")].some((v) => v.seeking);
        if (!busy || waited > 1500) resolve();
        else {
          waited += 10;
          nST(check, 10);
        }
      };
      check();
    });

  (window as unknown as { __capture: unknown }).__capture = {
    pause: () => void (paused = true),
    play: () => void (paused = false),
    seek: (ms: number) => void (virt = ms),
    advance: (ms: number) => void (virt += ms),
    time: () => virt,
    paused: () => paused,
    stepMode: (on: boolean) => {
      stepped = on;
      if (on) stepAnimations();
    },
    step,
    settled,
    events,
    drain: () => events.splice(0),
  };
  // framer-motion hands opacity/transform to the Web Animations API, which runs on the real
  // document timeline; without it, framer animates in its own rAF loop on the virtual clock
  delete (Element.prototype as { animate?: unknown }).animate;
  document.documentElement.classList.add("capture");
}
