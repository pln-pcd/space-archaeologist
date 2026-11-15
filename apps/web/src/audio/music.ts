// "Starship Lullaby" (bible §14): ~88 BPM with a light swing, F Lydian. A 16-bar song (A A' B A):
// warm pad, Rhodes, a composed music-box melody with echo, soft bass, and a heartbeat kick and shaker
// that join after the intro. Each woken
// machine adds its instrument as a vertical layer (Eagle: warm brass; Opportunity: marimba).
// Motifs: a short phrase per machine that can be played one note at a time (Memory Catch) or whole.
import * as Tone from "tone";
import { audio } from "./engine";

const BPM = 88;
// A section: Fmaj7 · G/F (the Lydian #4 shimmer) · Fmaj7 · Cmaj7/E
const CHORDS_A = [
  ["F3", "A3", "C4", "E4"],
  ["F3", "G3", "B3", "D4"],
  ["F3", "A3", "C4", "E4"],
  ["E3", "G3", "C4", "B3"],
];
// B section (bridge): Dm7 · Am7 · Em7 · G, all inside the same F Lydian scale
const CHORDS_B = [
  ["D3", "F3", "A3", "C4"],
  ["A3", "C4", "E4", "G4"],
  ["E3", "G3", "B3", "D4"],
  ["G3", "B3", "D4", "G4"],
];
const BASS = ["F2", "F2", "F2", "E2", "D2", "A1", "E2", "G2"];
type Bar = (string | null)[];
// a composed music-box melody (eighth-note grid, null = rest)
const MELODY_A: Bar[] = [
  ["C5", null, "E5", null, "A5", null, "G5", "E5"],
  ["D5", null, "G5", null, "B5", null, "A5", "G5"],
  ["A5", null, "G5", null, "E5", null, "C5", null],
  ["E5", null, "D5", "C5", "B4", null, "G4", null],
];
const MELODY_B: Bar[] = [
  ["F5", null, "E5", null, "D5", null, "C5", null],
  ["E5", null, "C5", null, "A4", null, "C5", "E5"],
  ["G5", null, "E5", null, "B4", null, "D5", null],
  ["D5", null, "B4", null, "G4", null, null, null],
];

type Layer = "brass" | "marimba";
class Music {
  private built = false;
  private rhodes!: Tone.PolySynth;
  private celesta!: Tone.PolySynth;
  private padSynth!: Tone.PolySynth;
  private bass!: Tone.MonoSynth;
  private kick!: Tone.MembraneSynth;
  private shaker!: Tone.NoiseSynth;
  brass!: Tone.PolySynth;
  marimba!: Tone.PolySynth;
  /** motif voices go straight to the music bus (audible even before their layer unlocks) */
  motifSynth!: Record<"eagle" | "opportunity", Tone.PolySynth>;
  private layerGain: Record<Layer, Tone.Gain> = {} as Record<Layer, Tone.Gain>;
  private parts: Tone.Loop[] = [];
  playing = false;
  layers = new Set<Layer>();

  private build() {
    if (this.built || !audio.ready) return;
    this.built = true;
    const music = audio.bus("music");
    const wet = audio.reverb;
    // gentle glue on the whole band
    const glue = new Tone.Compressor({ threshold: -22, ratio: 2.5, attack: 0.02, release: 0.3 }).connect(music);
    const echo = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.28, wet: 0.22 }).connect(glue);
    echo.connect(wet);
    this.rhodes = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3, modulationIndex: 1.4, envelope: { attack: 0.01, decay: 1.1, sustain: 0.18, release: 1.4 }, modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.8 } });
    this.rhodes.volume.value = -21;
    // music-box lead: a soft triangle bell with a little echo
    this.celesta = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 4.01, modulationIndex: 2.2, oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.7, sustain: 0.05, release: 0.9 }, modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 } });
    this.celesta.volume.value = -19;
    this.padSynth = new Tone.PolySynth(Tone.AMSynth, { envelope: { attack: 1.6, decay: 1, sustain: 0.75, release: 3.2 } });
    this.padSynth.volume.value = -27;
    const padFilter = new Tone.Filter(1600, "lowpass").connect(glue);
    padFilter.connect(wet);
    this.padSynth.connect(padFilter);
    this.bass = new Tone.MonoSynth({ oscillator: { type: "triangle" }, filter: { Q: 1, type: "lowpass" }, envelope: { attack: 0.01, decay: 0.35, sustain: 0.35, release: 0.5 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4, baseFrequency: 180, octaves: 2.2 } });
    this.bass.volume.value = -17;
    this.bass.connect(glue);
    this.kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 } });
    this.kick.volume.value = -26;
    this.kick.connect(glue);
    const shakerHp = new Tone.Filter(7000, "highpass").connect(glue);
    this.shaker = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 } });
    this.shaker.volume.value = -34;
    this.shaker.connect(shakerHp);
    this.brass = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "fatsawtooth", count: 3, spread: 18 }, envelope: { attack: 0.35, decay: 0.6, sustain: 0.5, release: 1.2 } });
    this.brass.volume.value = -27;
    const brassFilter = new Tone.Filter(1100, "lowpass");
    this.brass.connect(brassFilter);
    this.marimba = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 } });
    this.marimba.volume.value = -19;
    (["brass", "marimba"] as Layer[]).forEach((l) => (this.layerGain[l] = new Tone.Gain(0).connect(glue)));
    brassFilter.connect(this.layerGain.brass);
    this.marimba.connect(this.layerGain.marimba);
    this.rhodes.connect(glue);
    this.rhodes.connect(wet);
    this.celesta.connect(echo);
    this.celesta.connect(glue);
    brassFilter.connect(wet);
    const T = Tone.getTransport();
    T.bpm.value = BPM;
    T.swing = 0.1;
    T.swingSubdivision = "8n";
    const at = (n: string, semis: number) => Tone.Frequency(n).transpose(semis).toNote();
    // one sequencer on the eighth-note grid; the song is 16 bars (A A' B A) and builds up slowly
    let barsPlayed = 0;
    let lastBar = -1;
    const seq = new Tone.Loop((time) => {
      const e = Math.floor(T.ticks / (T.PPQ / 2));
      const bar = Math.floor(e / 8);
      const slot = e % 8;
      if (bar !== lastBar) {
        lastBar = bar;
        barsPlayed++;
      }
      const sb = bar % 16;
      const inB = sb >= 8 && sb < 12;
      const chord = inB ? CHORDS_B[sb - 8] : CHORDS_A[sb % 4];
      const mel = inB ? MELODY_B[sb - 8] : MELODY_A[sb % 4];
      const full = barsPlayed > 4;
      try {
        if (slot === 0) {
          this.padSynth.triggerAttackRelease(chord.map((n) => at(n, -12)), "1m", time, 0.45);
          chord.forEach((n, i) => this.rhodes.triggerAttackRelease(n, "2n", time + i * 0.025, 0.7));
          this.brass.triggerAttackRelease([at(chord[0], 12), at(chord[2], 12)], "2n", time + 0.05, 0.5);
        }
        if (slot === 3) this.rhodes.triggerAttackRelease(chord.slice(1), "8n", time, 0.45);
        if (slot === 6) this.rhodes.triggerAttackRelease(chord.slice(1), "4n", time, 0.5);
        // bass: root on 1, a push on the "and" of 2, the fifth on 4
        if (full || sb % 2 === 0) {
          if (slot === 0) this.bass.triggerAttackRelease(BASS[inB ? 4 + (sb - 8) : sb % 4], "4n", time, 0.8);
          if (slot === 3) this.bass.triggerAttackRelease(BASS[inB ? 4 + (sb - 8) : sb % 4], "8n", time, 0.55);
          if (slot === 6) this.bass.triggerAttackRelease(at(BASS[inB ? 4 + (sb - 8) : sb % 4], 7), "8n", time, 0.5);
        }
        // melody enters after the intro; the second A plays it an octave up, softer
        const n = mel[slot];
        if (full && n) {
          const len = mel[slot + 1] === null ? "4n" : "8n";
          this.celesta.triggerAttackRelease(sb >= 4 && sb < 8 ? at(n, 12) : n, len, time, sb >= 4 && sb < 8 ? 0.5 : 0.75);
        }
        // a soft heartbeat and shaker once the song has warmed up
        if (barsPlayed > 8) {
          if (slot === 0 || (slot === 4 && inB)) this.kick.triggerAttackRelease("F1", "8n", time, 0.6);
          this.shaker.triggerAttackRelease("32n", time, slot % 2 ? 0.55 : 0.25);
        }
        // marimba layer (Opportunity woke): eighth-note arpeggio of the chord
        const n2 = at(chord[[0, 1, 2, 3, 2, 1, 2, 3][slot]], 12);
        this.marimba.triggerAttackRelease(n2, "16n", time, slot % 2 ? 0.45 : 0.7);
      } catch {
        /* a dropped note never breaks the game */
      }
    }, "8n").start(0);
    this.parts.push(seq);
    const mb = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "fatsawtooth", count: 3, spread: 14 }, envelope: { attack: 0.08, decay: 0.5, sustain: 0.4, release: 1 } });
    const mbf = new Tone.Filter(1400, "lowpass");
    mb.connect(mbf);
    mbf.connect(music);
    mbf.connect(wet);
    mb.volume.value = -14;
    const mm = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 } });
    mm.volume.value = -8;
    mm.connect(music);
    mm.connect(wet);
    this.motifSynth = { eagle: mb, opportunity: mm };
  }
  ensure() {
    this.build();
  }

  start() {
    audio.onReady(() => {
      this.build();
      if (this.playing) return;
      this.playing = true;
      Tone.getTransport().start("+0.1");
    });
  }
  stop() {
    if (!this.playing) return;
    this.playing = false;
    Tone.getTransport().pause();
  }
  /** Vertical layers: a woken machine adds its instrument. */
  setLayers(on: Partial<Record<Layer, boolean>>) {
    audio.onReady(() => {
      this.build();
      (Object.keys(on) as Layer[]).forEach((l) => {
        if (on[l]) this.layers.add(l);
        else this.layers.delete(l);
        this.layerGain[l].gain.rampTo(on[l] ? 1 : 0, 2);
      });
    });
  }
}
export const music = new Music();

/* ---------------- machine motifs ---------------- */

export type MotifId = "eagle" | "opportunity";
/** Five notes each: Memory Catch plays one per correct answer; the fifth blooms into the phrase. */
export const MOTIFS: Record<MotifId, { notes: string[]; harmony: string[] }> = {
  eagle: { notes: ["F4", "C5", "A4", "E5", "F5"], harmony: ["F3", "C4", "A4"] },
  opportunity: { notes: ["C5", "D5", "E5", "G5", "B5"], harmony: ["E3", "B3", "G4"] },
};
function voice(id: MotifId) {
  music.ensure();
  return music.motifSynth[id];
}
export function motifNote(id: MotifId, i: number) {
  audio.onReady(() => {
    const n = MOTIFS[id].notes[Math.max(0, Math.min(4, i))];
    try {
      voice(id).triggerAttackRelease(n, "4n", Tone.now() + 0.01, 0.9);
    } catch {
      /* overlapping notes: skip rather than break the game */
    }
  });
}
export function motifFull(id: MotifId) {
  audio.onReady(() => {
    const v = voice(id);
    const now = Tone.now() + 0.02;
    try {
      MOTIFS[id].notes.forEach((n, i) => v.triggerAttackRelease(n, "8n", now + i * 0.34, 0.9));
      v.triggerAttackRelease(MOTIFS[id].harmony, "1m", now + 5 * 0.34, 0.6);
    } catch {
      /* overlapping phrase: skip */
    }
  });
}
