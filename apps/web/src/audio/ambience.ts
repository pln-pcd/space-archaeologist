// Ambience beds (bible §14), all synthesized:
// base = soft ship hum + Dusty's beeps; moon = silence outside, helmet breath and hum (no wind!);
// mars = filtered wind with gusts; catch = a light rhythmic loop that speeds up with streaks.
import * as Tone from "tone";
import { audio } from "./engine";
import { play } from "./sfx";

export type Bed = "base" | "moon" | "mars" | "catch" | null;

class Ambience {
  current: Bed = null;
  private nodes: Tone.ToneAudioNode[] = [];
  private timers: number[] = [];
  private catchLoop: Tone.Loop | null = null;

  /** base: cozy hum ↔ Launch Bay engine hum crossfade by where you stand (z) */
  private zone: { cozy: Tone.Volume; engine: Tone.Volume } | null = null;
  /** mars: wind louder near the crater rim */
  private windNear: Tone.Volume | null = null;
  setListener(x: number, z: number) {
    if (this.current === "base" && this.zone) {
      // a ~30-unit band from the hub (z ≈ 6) to the bay (z ≈ −24)
      const k = Math.max(0, Math.min(1, (6 - z) / 30));
      this.zone.cozy.volume.rampTo(-36 - k * 18, 0.3);
      this.zone.engine.volume.rampTo(-54 + k * 22, 0.3);
    } else if (this.current === "mars" && this.windNear) {
      const d = Math.hypot(x - 2.5, z + 2);
      const k = Math.max(0, Math.min(1, 1 - (d - 2) / 8));
      this.windNear.volume.rampTo(-40 + k * 14, 0.4);
    }
  }
  set(bed: Bed) {
    if (bed === this.current) return;
    this.current = bed;
    audio.onReady(() => this.build(bed));
  }

  private clear() {
    this.zone = null;
    this.windNear = null;
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    this.catchLoop?.dispose();
    this.catchLoop = null;
    const old = this.nodes;
    this.nodes = [];
    old.forEach((n) => {
      const g = n as unknown as { volume?: Tone.Param<"decibels">; stop?: () => void };
      if (g.volume) g.volume.rampTo(-60, 0.8);
    });
    setTimeout(() => old.forEach((n) => n.dispose()), 1000);
  }

  private build(bed: Bed) {
    this.clear();
    if (!bed) return;
    const out = audio.bus("music");
    if (bed === "base") {
      const hum = new Tone.Oscillator(55, "sine").start();
      const humVol = new Tone.Volume(-34);
      hum.chain(humVol, out);
      const air = new Tone.Noise("brown").start();
      const airF = new Tone.Filter(320, "lowpass");
      const airVol = new Tone.Volume(-38);
      air.chain(airF, airVol, out);
      // Launch Bay engine hum: a low pulsing drone that rises as you walk toward the bay
      const eng = new Tone.Oscillator(41, "sawtooth").start();
      const engF = new Tone.Filter(140, "lowpass");
      const engVol = new Tone.Volume(-54);
      const engLfo = new Tone.LFO(0.35, 90, 190).start();
      engLfo.connect(engF.frequency);
      eng.chain(engF, engVol, out);
      this.zone = { cozy: humVol, engine: engVol };
      this.nodes.push(hum, humVol, air, airF, airVol, eng, engF, engVol, engLfo);
      this.timers.push(window.setInterval(() => Math.random() < 0.35 && play("dustyBeep", 0.8 + Math.random() * 0.6, 0.5), 6000));
    } else if (bed === "moon") {
      // no sound travels outside on the Moon: only the inside of the helmet
      const breath = new Tone.Noise("pink").start();
      const bf = new Tone.Filter(700, "bandpass");
      const bVol = new Tone.Volume(-30);
      const lfo = new Tone.LFO(0.22, -46, -28).start();
      lfo.connect(bVol.volume);
      breath.chain(bf, bVol, out);
      const hum = new Tone.Oscillator(82, "triangle").start();
      const hVol = new Tone.Volume(-38);
      hum.chain(hVol, out);
      this.nodes.push(breath, bf, bVol, lfo, hum, hVol);
    } else if (bed === "mars") {
      const wind = new Tone.Noise("pink").start();
      const af = new Tone.AutoFilter({ frequency: 0.08, baseFrequency: 220, octaves: 2.6, type: "sine" }).start();
      const wVol = new Tone.Volume(-26);
      wind.chain(af, wVol, out);
      // a second, higher wind layer that grows near the crater rim
      const rim = new Tone.Noise("white").start();
      const rf = new Tone.Filter(900, "bandpass");
      const rVol = new Tone.Volume(-40);
      rim.chain(rf, rVol, out);
      this.windNear = rVol;
      this.nodes.push(wind, af, wVol, rim, rf, rVol);
      // gusts
      this.timers.push(
        window.setInterval(() => {
          if (Math.random() < 0.5) {
            wVol.volume.rampTo(-16, 1.2);
            setTimeout(() => wVol.volume.rampTo(-26, 2.5), 1400);
          }
        }, 5000),
      );
    } else if (bed === "catch") {
      const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 4, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } });
      kick.volume.value = -20;
      kick.connect(out);
      const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } });
      hat.volume.value = -32;
      hat.connect(out);
      this.nodes.push(kick, hat);
      let step = 0;
      this.catchLoop = new Tone.Loop((time) => {
        if (step % 4 === 0) kick.triggerAttackRelease("C2", "8n", time);
        if (step % 2 === 1) hat.triggerAttackRelease("32n", time);
        step++;
      }, "8n").start(0);
      if (Tone.getTransport().state !== "started") Tone.getTransport().start();
    }
  }

  /** Memory Catch: the loop speeds up a little with each streak (never more than +20%). */
  setStreak(streak: number) {
    Tone.getTransport().bpm.rampTo(88 * (1 + Math.min(0.2, streak * 0.05)), 0.5);
  }
}
export const ambience = new Ambience();
