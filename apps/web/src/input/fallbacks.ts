// Mouse, touch and keyboard adapters (bible §4 fallback column). They emit EXACTLY the same
// intents as the gloves, so game code never knows which input the kid is using.
import { intents } from "./bus";
import { GLOVE_EVENT } from "./engine";
import type { Source } from "./types";

const isGlove = (e: Event) => !!(e as unknown as Record<string, boolean>)[GLOVE_EVENT];
const typing = (e: Event) => !!(e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable=true]");

let attached = false;
/** keyboard cursor (arrow keys in aiming scenes) */
const kc = { x: 0, y: 0 };

export function attachFallbacks() {
  if (attached) return () => {};
  attached = true;
  kc.x = innerWidth / 2;
  kc.y = innerHeight / 2;

  // ---------------- pointer (mouse + touch) ----------------
  let down: { x: number; y: number; t: number; id: number; src: Source; moved: boolean } | null = null;
  let hist: { t: number; x: number; y: number }[] = [];
  const touchPoints = new Map<number, {x:number;y:number}>();
  let pinchSpan = 0;
  let longTimer = 0;
  let longRaf = 0;
  let longDone = false;
  let lookDrag: {id:number;x:number;y:number} | null = null;
  const scrub = { dir: 0, start: 0, flips: [] as number[] };
  const src = (e: PointerEvent): Source => (e.pointerType === "touch" ? "touch" : "mouse");

  const cancelLong = (emitZero: boolean) => {
    clearTimeout(longTimer);
    cancelAnimationFrame(longRaf);
    if (emitZero && !longDone && down) intents.emit("palmHold", { progress: 0, done: false, x: down.x, y: down.y }, down.src);
  };
  const startLong = (e: PointerEvent) => {
    // long-press = Power Palm (bible §4): ring fills over 0.6 s after a 0.25 s pause
    longDone = false;
    longTimer = window.setTimeout(() => {
      const t0 = performance.now();
      const step = () => {
        if (!down || down.moved) return;
        const p = Math.min(1, (performance.now() - t0) / 600);
        if (p >= 1) {
          longDone = true;
          intents.emit("palmHold", { progress: 1, done: true, x: down.x, y: down.y }, down.src);
          return;
        }
        intents.emit("palmHold", { progress: p, done: false, x: down.x, y: down.y }, down.src);
        longRaf = requestAnimationFrame(step);
      };
      if (intents.enabled("palmHold") && !intents.enabled("pinch")) step();
      else if (intents.enabled("palmHold") && e.pointerType === "touch") step();
    }, 250);
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") { touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(touchPoints.size===2){const [a,b]=[...touchPoints.values()];pinchSpan=Math.hypot(a.x-b.x,a.y-b.y);} }
    if (!isGlove(e) && (e.button === 2 || e.pointerType === "touch") && (e.target as HTMLElement)?.tagName === "CANVAS" && intents.options().walk) lookDrag = {id:e.pointerId,x:e.clientX,y:e.clientY};
    if (isGlove(e) || e.button > 0) return;
    const s = src(e);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, src: s, moved: false };
    hist = [{ t: down.t, x: e.clientX, y: e.clientY }];
    intents.emit("pointer", { x: e.clientX, y: e.clientY, visible: true }, s);
    intents.emit("pinchStart", { x: e.clientX, y: e.clientY }, s);
    intents.emit("grab", { x: e.clientX, y: e.clientY }, s);
    intents.emit("fistStamp", { x: e.clientX, y: e.clientY }, s);
    startLong(e);
  };
  const onMove = (e: PointerEvent) => {
    if (isGlove(e)) return;
    if(e.pointerType === "touch" && touchPoints.has(e.pointerId)) { touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(touchPoints.size===2){const [a,b]=[...touchPoints.values()];const span=Math.hypot(a.x-b.x,a.y-b.y);if(pinchSpan&&intents.label().includes("investigation"))intents.emit("zoomView",{delta:(span-pinchSpan)/100},"touch");pinchSpan=span;return;} }
    if (lookDrag?.id === e.pointerId) {intents.emit("look",{dx:e.clientX-lookDrag.x,dy:e.clientY-lookDrag.y},src(e));lookDrag.x=e.clientX;lookDrag.y=e.clientY;}
    const s = src(e);
    intents.emit("pointer", { x: e.clientX, y: e.clientY, visible: true }, s);
    if (!down || e.pointerId !== down.id) return;
    const now = performance.now();
    hist.push({ t: now, x: e.clientX, y: e.clientY });
    while (hist.length > 2 && now - hist[0].t > 100) hist.shift();
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) {
      down.moved = true;
      cancelLong(true);
    }
    // scrubbing back and forth while pressed = Wave Wind (touch/mouse fallback)
    const dirX = Math.sign(e.clientX - (hist[hist.length - 2]?.x ?? e.clientX));
    if (dirX && dirX !== scrub.dir) {
      if (scrub.dir && Math.abs(e.clientX - scrub.start) > 35) scrub.flips.push(now);
      scrub.dir = dirX;
      scrub.start = e.clientX;
    }
    scrub.flips = scrub.flips.filter((t) => now - t < 1200);
    if (scrub.flips.length >= 3) {
      intents.emit("wave", { strength: 1 }, s);
      scrub.flips = [];
    }
    const prev = hist[hist.length - 2] ?? hist[0];
    intents.emit("pinchMove", { x: e.clientX, y: e.clientY, dx: e.clientX - prev.x, dy: e.clientY - prev.y }, s);
  };
  const onUp = (e: PointerEvent) => {
    touchPoints.delete(e.pointerId); if(touchPoints.size<2)pinchSpan=0;
    if (lookDrag?.id === e.pointerId) lookDrag = null;
    if (isGlove(e) || !down || e.pointerId !== down.id) return;
    const s = down.src;
    const now = performance.now();
    cancelLong(!longDone);
    const a = hist[0] ?? { t: down.t, x: down.x, y: down.y };
    const span = Math.max(0.016, (now - a.t) / 1000);
    const vx = (e.clientX - a.x) / span,
      vy = (e.clientY - a.y) / span;
    intents.emit("pinchEnd", { x: e.clientX, y: e.clientY, cancelled: e.type === "pointercancel" }, s);
    intents.emit("release", { x: e.clientX, y: e.clientY, vx, vy, speed: Math.hypot(vx, vy) }, s);
    // quick fling = Swoosh (touch swipe or a mouse flick)
    const dx = e.clientX - down.x,
      dy = e.clientY - down.y;
    if (now - down.t < 350 && Math.hypot(dx, dy) > 70) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      intents.emit("swipe", { dir }, s);
    }
    down = null;
  };
  const onWheel = (e: WheelEvent) => {
    if (isGlove(e)) return;
    intents.emit("dial", { delta: Math.sign(e.deltaY) * 0.12, angle: 0 }, "mouse");
  };

  // ---------------- keyboard ----------------
  const keys = new Set<string>();
  let palmT0 = 0;
  let palmRaf = 0;
  let waveKeys: number[] = [];
  let lastWaveKey = "";
  let pilot = { throttle: 0.5, steer: 0 };
  let pilotRaf = 0;
  let steerVal = 0;

  const emitMove = () => {
    if (!intents.options().walk) return;
    const x = (keys.has("d") || (keys.has("arrowright") && !intents.options().keyboardCursor) ? 1 : 0) - (keys.has("a") || (keys.has("arrowleft") && !intents.options().keyboardCursor) ? 1 : 0);
    const y = (keys.has("w") || (keys.has("arrowup") && !intents.options().keyboardCursor) ? 1 : 0) - (keys.has("s") || (keys.has("arrowdown") && !intents.options().keyboardCursor) ? 1 : 0);
    intents.emit("move", { x, y }, "keyboard");
  };
  const pilotLoop = () => {
    // W/S throttle, A/D steer, eased like a lever
    const up = keys.has("w") || keys.has("arrowup"),
      dn = keys.has("s") || keys.has("arrowdown");
    const l = keys.has("a") || keys.has("arrowleft"),
      r = keys.has("d") || keys.has("arrowright");
    pilot.throttle = Math.max(0, Math.min(1, pilot.throttle + (up ? 0.025 : 0) - (dn ? 0.025 : 0)));
    pilot.steer += ((r ? 1 : 0) - (l ? 1 : 0) - pilot.steer) * 0.2;
    if (intents.enabled("pilot")) intents.emit("pilot", { throttle: pilot.throttle, steer: pilot.steer, active: true }, "keyboard");
    if (intents.enabled("steer")) {
      steerVal += ((r ? 1 : 0) - (l ? 1 : 0) - steerVal) * 0.2;
      intents.emit("steer", { value: steerVal, active: l || r || Math.abs(steerVal) > 0.02 }, "keyboard");
    }
    if (keys.size && (intents.enabled("pilot") || intents.enabled("steer"))) pilotRaf = requestAnimationFrame(pilotLoop);
    else pilotRaf = 0;
  };
  const kbCursorLoop = () => {
    const sp = 9;
    kc.x = Math.max(0, Math.min(innerWidth, kc.x + ((keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0)) * sp));
    kc.y = Math.max(0, Math.min(innerHeight, kc.y + ((keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0)) * sp));
    intents.emit("pointer", { x: kc.x, y: kc.y, visible: true }, "keyboard");
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].some((k) => keys.has(k))) requestAnimationFrame(kbCursorLoop);
  };
  const palmStep = () => {
    // holding E (or Space where pinch is not used) fills the Power Palm ring quickly
    const p = Math.min(1, (performance.now() - palmT0) / 350);
    intents.emit("palmHold", { progress: p, done: p >= 1, x: kc.x, y: kc.y }, "keyboard");
    if (p < 1) palmRaf = requestAnimationFrame(palmStep);
    else palmT0 = 0;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const repeat = e.repeat;
    const opts = intents.options();
    const onButton = !!(e.target as HTMLElement)?.closest?.("button,[role=button],a,summary");
    keys.add(k);
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      if (opts.keyboardCursor && k.startsWith("arrow")) {
        if (!repeat) requestAnimationFrame(kbCursorLoop);
        e.preventDefault();
      } else if (intents.enabled("pilot") || intents.enabled("steer")) {
        if (!pilotRaf) pilotRaf = requestAnimationFrame(pilotLoop);
        e.preventDefault();
      } else if (opts.walk) {
        emitMove();
        e.preventDefault();
      } else if (!repeat && intents.enabled("swipe") && (k === "arrowleft" || k === "arrowright")) {
        intents.emit("swipe", { dir: k === "arrowleft" ? "left" : "right" }, "keyboard");
        e.preventDefault();
      }
      // A/D quickly back and forth = Wave Wind
      if ((k === "a" || k === "d") && !repeat && intents.enabled("wave")) {
        const now = performance.now();
        if (k !== lastWaveKey) waveKeys.push(now);
        lastWaveKey = k;
        waveKeys = waveKeys.filter((t) => now - t < 1200);
        if (waveKeys.length >= 3) {
          intents.emit("wave", { strength: 1 }, "keyboard");
          waveKeys = [];
        }
      }
      return;
    }
    if (repeat) return;
    if (k === "e") intents.emit("activate", {}, "keyboard");
    if (k === " " && opts.walk) intents.emit("jump", {}, "keyboard");
    if (k === "z" || k === "x") return void intents.emit("turnView", { delta: k === "z" ? Math.PI / 8 : -Math.PI / 8 }, "keyboard");
    if (k === "+" || k === "=") return void intents.emit("zoomView", { delta: 0.25 }, "keyboard");
    if (k === "-" || k === "_") return void intents.emit("zoomView", { delta: -0.25 }, "keyboard");
    if (k === "escape") return void intents.emit("back", {}, "keyboard");
    if (k === "p") return void intents.emit("frame", {}, "keyboard");
    if (k === "1" || k === "2" || k === "3" || k === "4") return void intents.emit("choose", { index: Number(k) - 1 }, "keyboard");
    if ((k === "q" || k === "e") && intents.enabled("dial")) return void intents.emit("dial", { delta: k === "q" ? -0.2 : 0.2, angle: 0 }, "keyboard");
    if (onButton && (k === " " || k === "enter")) return; // let the focused button do its job
    const spaceActs = intents.enabled("pinch") || intents.enabled("grab") || intents.enabled("fistStamp");
    if (k === "e" || (k === " " && !spaceActs)) {
      if (intents.enabled("palmHold")) {
        palmT0 = performance.now();
        palmRaf = requestAnimationFrame(palmStep);
        e.preventDefault();
      }
      return;
    }
    if (k === " ") {
      intents.emit("pinchStart", { x: kc.x, y: kc.y }, "keyboard");
      intents.emit("grab", { x: kc.x, y: kc.y }, "keyboard");
      intents.emit("fistStamp", { x: kc.x, y: kc.y }, "keyboard");
      e.preventDefault();
      return;
    }
    if (k === "enter") {
      intents.emit("push", { strength: 1 }, "keyboard");
      intents.emit("thumbsUp", {}, "keyboard");
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) emitMove();
    if (k === " " && (intents.enabled("pinch") || intents.enabled("grab"))) {
      intents.emit("pinchEnd", { x: kc.x, y: kc.y }, "keyboard");
      intents.emit("release", { x: kc.x, y: kc.y, vx: 0, vy: 0, speed: 0 }, "keyboard");
    }
    if ((k === "e" || k === " ") && palmT0) {
      // a quick tap still counts: kids shouldn't have to hold a key
      cancelAnimationFrame(palmRaf);
      palmT0 = 0;
      intents.emit("palmHold", { progress: 1, done: true, x: kc.x, y: kc.y }, "keyboard");
    }
    if ((intents.enabled("steer") || intents.enabled("pilot")) && !pilotRaf && keys.size === 0) pilotRaf = requestAnimationFrame(pilotLoop);
  };
  const onBlur = () => {
    keys.clear();
    emitMove();
  };

  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onUp, true);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return () => {
    attached = false;
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onUp, true);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}

/** Keyboard cursor position (for UIs that draw it). */
export const keyboardCursor = kc;
