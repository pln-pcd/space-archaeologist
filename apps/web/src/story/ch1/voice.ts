// Chapter 1 voice (bible §8): pre-rendered narration (Kokoro-82M, scripts/voices.py --story) in
// /audio/vo/ch1/<lineId>.mp3, real NASA clips for the two historic lines, and the browser's
// speech synthesis only if a file is missing. Music ducks under the voice; NASA clips play at
// full clarity with the music held down. Every line can pause, resume and stop.
import { audio } from "../../audio/engine";
import { claimVoice } from "../../audio/voiceBus";
import { useStore } from "../../store";
import { line } from "./flow";

let DUR: Record<string, number> = {};
let loading: Promise<void> | null = null;
export function loadDurations() {
  loading ??= fetch("/audio/vo/ch1/durations.json")
    .then((r) => (r.ok ? r.json() : { lines: {} }))
    .then((j) => void (DUR = j.lines ?? {}))
    .catch(() => {});
  return loading;
}
/** seconds the line takes (file length when known, else a calm reading estimate) */
export function lineSeconds(id: string) {
  const l = line(id);
  if (DUR[id]) return DUR[id];
  return Math.max(2.4, (l?.text.split(/\s+/).length ?? 6) * 0.42 + 0.6);
}

export type Speech = { done: Promise<void>; pause: () => void; resume: () => void; stop: () => void };
const settings = () => useStore.getState().settings;

/** Play a line by id (narration file, NASA clip or speech synthesis). Resolves when it ends. */
export function say(id: string): Speech {
  const l = line(id);
  const nasa = l?.speaker === "nasa";
  const src = nasa ? l.audio : `/audio/vo/ch1/${id}.mp3`;
  const sound = settings().sound !== false;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let left = (nasa ? DUR[id] ?? 6 : lineSeconds(id)) * 1000;
  let startedAt = performance.now();
  let release = () => {};
  const end = () => {
    if (finished) return;
    finished = true;
    release();
    if (timer) clearTimeout(timer);
    audio.setDuck(false);
    if (nasa) audio.setModal(false);
    resolve();
  };
  // a timer always backs the audio up, so the story never stalls (sound off, autoplay blocked)
  const arm = (ms: number) => {
    startedAt = performance.now();
    timer = setTimeout(end, ms + 400);
  };
  let el: HTMLAudioElement | null = null;
  release = claimVoice(() => {
    el?.pause();
    end();
  });
  if (sound && src && (l?.vo || nasa)) {
    el = new Audio(src);
    el.volume = (settings().volumes?.voice ?? 0.9) * (settings().volumes?.master ?? 0.8);
    audio.setDuck(true);
    if (nasa) audio.setModal(true);
    el.onloadedmetadata = () => {
      if (el && isFinite(el.duration)) {
        left = el.duration * 1000;
        if (timer) clearTimeout(timer);
        arm(left);
      }
    };
    el.onended = end;
    el.onerror = () => {
      // missing file: read it with the browser's voice instead
      el = null;
      if (typeof speechSynthesis !== "undefined" && l) {
        const u = new SpeechSynthesisUtterance(l.text.replace(/\[a\]/, "a"));
        u.rate = 0.92;
        speechSynthesis.speak(u);
      }
    };
    void el.play().catch(() => {});
  }
  arm(left);
  return {
    done,
    pause: () => {
      if (finished) return;
      el?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.pause();
      if (timer) clearTimeout(timer);
      left = Math.max(0, left - (performance.now() - startedAt));
    },
    resume: () => {
      if (finished) return;
      void el?.play().catch(() => {});
      if (typeof speechSynthesis !== "undefined") speechSynthesis.resume();
      arm(left);
    },
    stop: () => {
      el?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      end();
    },
  };
}
