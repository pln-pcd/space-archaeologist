// Audio engine (bible §14): everything generated in code. Tone.js buses (master/music/sfx/voice)
// into a limiter, music ducks under voices, audio pauses when the tab is hidden, and nothing makes
// a sound until the player's first gesture.
import * as Tone from "tone";
import { useStore } from "../store";

type Bus = "music" | "sfx" | "voice";
const dB = (v: number) => (v <= 0.001 ? -Infinity : 20 * Math.log10(v));

class AudioEngine {
  ready = false;
  private starting: Promise<void> | null = null;
  master!: Tone.Volume;
  buses!: Record<Bus, Tone.Volume>;
  limiter!: Tone.Limiter;
  reverb!: Tone.Reverb;
  private duck = 0;
  /** 0..1: an open modal ducks music and ambience to 40 % */
  private modal = 0;
  private wasSound = true;
  fade!: Tone.Gain;
  private listeners = new Set<() => void>();

  /** Call from a user gesture. Safe to call often. */
  unlock() {
    if (this.ready) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = (async () => {
      await Tone.start();
      this.limiter = new Tone.Limiter(-1.5).toDestination();
      // a gain stage that fades: start silent, rise with a ~1 s time constant (bible §14)
      this.fade = new Tone.Gain(0).connect(this.limiter);
      this.master = new Tone.Volume(0).connect(this.fade);
      this.reverb = new Tone.Reverb({ decay: 4.5, wet: 1 });
      void this.reverb.generate(); // don't hold the first sound back for the impulse response
      this.reverb.connect(this.master);
      this.buses = {
        music: new Tone.Volume(-6).connect(this.master),
        sfx: new Tone.Volume(-3).connect(this.master),
        voice: new Tone.Volume(-2).connect(this.master),
      };
      this.ready = true;
      if (import.meta.env.DEV) {
        // dev-only meter so tools/audio_check.mjs can prove each sound makes signal
        const meter = new Tone.Meter({ normalRange: true, smoothing: 0 });
        this.limiter.connect(meter);
        let peak = 0;
        setInterval(() => (peak = Math.max(peak, meter.getValue() as number)), 15);
        (window as unknown as { __audioPeak: () => number }).__audioPeak = () => {
          const p = peak;
          peak = 0;
          return p;
        };
      }
      this.applyVolumes();
      this.fade.gain.setTargetAtTime(1, Tone.now(), 1);
      useStore.subscribe(() => this.applyVolumes());
      // a hidden tab fades out (0.5 s), coming back fades in gently (2 s)
      document.addEventListener("visibilitychange", () => {
        const ctx = Tone.getContext().rawContext as AudioContext;
        if (document.hidden) {
          this.fade.gain.setTargetAtTime(0, Tone.now(), 0.5 / 3);
          setTimeout(() => document.hidden && void ctx.suspend?.(), 700);
        } else {
          void ctx.resume?.();
          this.fade.gain.setTargetAtTime(1, Tone.now(), 2 / 3);
        }
      });
      this.listeners.forEach((f) => f());
    })();
    return this.starting;
  }
  onReady(f: () => void) {
    if (this.ready) f();
    else this.listeners.add(f);
  }

  applyVolumes() {
    if (!this.ready) return;
    const s = useStore.getState().settings;
    const v = s.volumes ?? { master: 0.8, music: 0.7, sfx: 0.8, voice: 0.9 };
    // mute fades 0.25 s, unmute 0.5 s
    const muteT = s.sound === this.wasSound ? 0.1 : s.sound ? 0.5 : 0.25;
    this.wasSound = s.sound;
    this.master.volume.rampTo(s.sound ? dB(v.master) : -Infinity, muteT);
    // music sits at about half under the ambience; a modal ducks both to 40 % (≈ −8 dB) over 1.35 s
    // v7.5: +12 dB (it measured ~-26 dBFS: inaudible on laptop speakers); a gentler duck under voices
    this.buses.music.volume.rampTo(dB(v.music) + 12 - this.duck * 5 + this.modal * dB(0.75), this.modal ? 1.35 : 1.0);
    this.buses.sfx.volume.rampTo(dB(v.sfx) - 3, 0.1);
    this.buses.voice.volume.rampTo(dB(v.voice) - 2, 0.1);
  }
  /** Music ducks while anyone speaks (bible §14). */
  setDuck(on: boolean) {
    this.duck = on ? 1 : 0;
    this.applyVolumes();
  }
  /** a modal (panel, card, results) is open: music and ambience duck to 40 % */
  setModal(on: boolean) {
    const m = on ? 1 : 0;
    if (m === this.modal) return;
    this.modal = m;
    this.applyVolumes();
  }
  bus(b: Bus) {
    return this.buses[b];
  }
}

export const audio = new AudioEngine();

// unlock on the first gesture of any kind (pointer, key, or a glove pinch via the click bridge)
if (typeof window !== "undefined") {
  const f = () => {
    void audio.unlock();
    window.removeEventListener("pointerdown", f, true);
    window.removeEventListener("keydown", f, true);
  };
  window.addEventListener("pointerdown", f, true);
  window.addEventListener("keydown", f, true);
}

/** The key everything is pitched to (bible §14: Lydian). F Lydian: F G A B C D E. */
export const KEY = ["F", "G", "A", "B", "C", "D", "E"];
export function scaleNote(degree: number, octave = 4) {
  const idx = ((degree % 7) + 7) % 7;
  const o = octave + Math.floor(degree / 7) + (idx >= 4 ? 1 : 0); // C, D, E sit above F
  return `${KEY[idx]}${o}`;
}
