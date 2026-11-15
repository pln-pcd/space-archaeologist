// CUTE THEMES (v7): background music made in code with Tone.js. Four little songs, each a loop of
// 8 bars with its own instruments, all in a happy major key:
//   title   "Hello, Stars!"   104 BPM  C major   glockenspiel tune, plucky bass, sparkles, soft beat
//   ship    "Cozy Cabin"       90 BPM  F major   marimba arpeggios, music-box tune, warm pad
//   explore "Moon Stroll"      84 BPM  D major   floaty music box with echo, soft pad, pizzicato bass
//   game    "Rock Hop"        124 BPM  G major   bouncy chiptune-ish lead, bass and claps
// A stack picks the song: the screen asks for one, a mission step can ask for another, the last
// asker wins. Music goes through the engine's music bus (ducks under voices, obeys the volume).
import * as Tone from "tone";
import { useEffect } from "react";
import { audio } from "./engine";
import { useStore } from "../store";

export type ThemeName = "title" | "ship" | "explore" | "game";
type Song = {
  bpm: number;
  swing?: number;
  chords: string[][];
  bass: string[];
  /** 8 eighth notes per bar ("." = rest), as many bars as chords (loops) */
  tune: string[];
  lead: "glock" | "marimba" | "box" | "chip";
  arp?: boolean;
  beat?: "soft" | "bouncy" | "none";
  pad?: boolean;
  /** a ukulele-style strum on beats 2 and 4 (Karplus-Strong plucks) */
  strum?: boolean;
  /** twinkly bell runs at the end of every other bar */
  sparkle?: boolean;
};

const SONGS: Record<ThemeName, Song> = {
  title: {
    bpm: 104,
    chords: [["C4", "E4", "G4"], ["G3", "B3", "D4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]],
    bass: ["C2", "G2", "A2", "F2", "C2", "G2", "F2", "G2"],
    tune: ["E5 . G5 . C6 . G5 .", "D5 . G5 . B5 A5 G5 .", "C5 . E5 . A5 . G5 E5", "F5 . E5 . D5 . C5 .", "E5 . G5 . C6 . D6 .", "B5 . A5 . G5 . D5 .", "A5 . G5 . F5 E5 D5 .", "G5 . . . . . . ."],
    lead: "glock",
    beat: "soft",
    pad: true,
    strum: true,
    sparkle: true,
  },
  ship: {
    bpm: 90,
    swing: 0.12,
    chords: [["F3", "A3", "C4", "E4"], ["A3", "C4", "E4", "G4"], ["D3", "F3", "A3", "C4"], ["Bb3", "D4", "F4", "A4"], ["F3", "A3", "C4", "E4"], ["G3", "Bb3", "D4", "F4"], ["Bb3", "D4", "F4", "A4"], ["C4", "E4", "G4", "Bb4"]],
    bass: ["F2", "A2", "D2", "Bb1", "F2", "G2", "Bb1", "C2"],
    tune: ["C6 . A5 . . . G5 A5", "E5 . . . C5 . . .", "F5 . A5 . C6 . A5 .", "D5 . . . . . . .", "C6 . A5 . G5 . F5 .", "D5 . F5 . G5 . . .", "A5 . F5 . D5 . F5 .", "G5 . . . E5 . . ."],
    lead: "box",
    arp: true,
    beat: "none",
    pad: true,
    strum: true,
  },
  explore: {
    bpm: 84,
    chords: [["D4", "F#4", "A4", "C#5"], ["G3", "B3", "D4", "F#4"], ["E3", "G3", "B3", "D4"], ["A3", "C#4", "E4", "G4"], ["D4", "F#4", "A4", "C#5"], ["B3", "D4", "F#4", "A4"], ["G3", "B3", "D4", "F#4"], ["A3", "C#4", "E4", "A4"]],
    bass: ["D2", "G2", "E2", "A2", "D2", "B1", "G2", "A2"],
    tune: ["A5 . . F#5 . . E5 .", "D5 . . . B4 . . .", "E5 . G5 . B5 . . .", "A5 . . . . . . .", "F#5 . A5 . D6 . C#6 .", "B5 . . A5 . F#5 . .", "G5 . F#5 . E5 . D5 .", "E5 . . . . . . ."],
    lead: "box",
    beat: "soft",
    pad: true,
    sparkle: true,
  },
  game: {
    bpm: 124,
    chords: [["G3", "B3", "D4"], ["E3", "G3", "B3"], ["C4", "E4", "G4"], ["D4", "F#4", "A4"], ["G3", "B3", "D4"], ["E3", "G3", "B3"], ["C4", "E4", "G4"], ["D4", "F#4", "A4"]],
    bass: ["G2", "E2", "C2", "D2", "G2", "E2", "C2", "D2"],
    tune: ["D5 G5 B5 G5 D5 G5 B5 D6", "B5 . G5 . E5 . G5 .", "E5 G5 C6 G5 E5 . C5 .", "D5 F#5 A5 . F#5 . D5 .", "G5 . B5 . D6 . B5 .", "E5 . G5 B5 . G5 E5 .", "C6 . B5 . A5 . G5 .", "A5 . F#5 . D5 . . ."],
    lead: "chip",
    beat: "bouncy",
  },
};

class Themes {
  private stack: { id: number; name: ThemeName | null }[] = [];
  private seq = 0;
  private playing: ThemeName | null = null;
  private loop: Tone.Loop | null = null;
  private nodes: Tone.ToneAudioNode[] = [];
  private out: Tone.Gain | null = null;

  push(name: ThemeName | null) {
    const id = ++this.seq;
    this.stack.push({ id, name });
    this.apply();
    return () => {
      this.stack = this.stack.filter((s) => s.id !== id);
      this.apply();
    };
  }
  apply() {
    const want = useStore.getState().settings.music === false || useStore.getState().settings.sound === false ? null : (this.stack.at(-1)?.name ?? null);
    if (want === this.playing) return;
    if (!audio.ready) {
      audio.onReady(() => this.apply());
      return;
    }
    this.stop();
    if (want) this.start(want);
  }
  private stop() {
    const loop = this.loop,
      nodes = this.nodes,
      out = this.out;
    this.loop = null;
    this.nodes = [];
    this.out = null;
    this.playing = null;
    if (out) out.gain.rampTo(0, 0.6);
    setTimeout(() => {
      loop?.dispose();
      nodes.forEach((n) => n.dispose());
      out?.dispose();
    }, 900);
  }
  private start(name: ThemeName) {
    const song = SONGS[name];
    this.playing = name;
    const out = new Tone.Gain(0).connect(audio.bus("music"));
    out.gain.rampTo(1, 1.4);
    const echo = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.28, wet: 0.22 }).connect(out);
    const reverbSend = new Tone.Gain(0.35).connect(audio.reverb);
    const nodes: Tone.ToneAudioNode[] = [out, echo, reverbSend];
    const lead = this.makeLead(song.lead);
    lead.connect(echo);
    lead.connect(reverbSend);
    nodes.push(lead);
    const bass = new Tone.MonoSynth({ oscillator: { type: song.lead === "chip" ? "square" : "triangle" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.2 }, filterEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.2, baseFrequency: 180, octaves: 2.2 } }).connect(out);
    bass.volume.value = song.lead === "chip" ? -24 : -17;
    nodes.push(bass);
    let pad: Tone.PolySynth | null = null;
    if (song.pad) {
      pad = new Tone.PolySynth(Tone.AMSynth, { harmonicity: 1.5, envelope: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 2.2 }, oscillator: { type: "sine" }, modulation: { type: "sine" } }).connect(out);
      pad.connect(reverbSend);
      pad.volume.value = -23;
      nodes.push(pad);
    }
    let arp: Tone.PolySynth | null = null;
    if (song.arp) {
      arp = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 } }).connect(out);
      arp.connect(reverbSend);
      arp.volume.value = -16;
      nodes.push(arp);
    }
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 4, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 } }).connect(out);
    kick.volume.value = song.beat === "bouncy" ? -18 : -24;
    const hp = new Tone.Filter(5200, "highpass").connect(out);
    const shaker = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hp);
    shaker.volume.value = song.beat === "bouncy" ? -28 : -34;
    const clapF = new Tone.Filter(1400, "bandpass").connect(out);
    const clap = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0 } }).connect(clapF);
    clap.volume.value = -16;
    nodes.push(kick, hp, shaker, clapF, clap);
    // ukulele: three plucked strings strummed a few ms apart
    const strings = song.strum ? [0, 1, 2].map(() => new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.92 }).connect(out)) : [];
    strings.forEach((p) => ((p.volume.value = -7), nodes.push(p)));
    // sparkles: a high bell run
    const bells = song.sparkle ? new Tone.PolySynth(Tone.FMSynth, { harmonicity: 8, modulationIndex: 1.2, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 }, modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 } }) : null;
    if (bells) (bells.volume.value = -20), bells.connect(echo), bells.connect(reverbSend), nodes.push(bells);
    this.nodes = nodes;
    this.out = out;

    const tune = song.tune.map((b) => b.split(/\s+/));
    const T = Tone.getTransport();
    T.bpm.value = song.bpm;
    T.swing = song.swing ?? 0;
    T.swingSubdivision = "8n";
    let step = 0;
    this.loop = new Tone.Loop((time) => {
      const bar = Math.floor(step / 8) % song.chords.length;
      const e = step % 8;
      const chord = song.chords[bar];
      const n = tune[bar % tune.length][e];
      if (n && n !== ".") lead.triggerAttackRelease(n, song.lead === "chip" ? "16n" : "8n", time, 0.6 + Math.random() * 0.15);
      if (e === 0) {
        bass.triggerAttackRelease(song.bass[bar], "4n", time, 0.8);
        pad?.triggerAttackRelease(chord, "1m", time, 0.35);
      }
      if (e === 4 && song.lead !== "box") bass.triggerAttackRelease(song.bass[bar], "8n", time, 0.6);
      if (strings.length && (e === 2 || e === 6))
        chord.slice(0, 3).forEach((n, i) => strings[i].triggerAttack(n, time + i * 0.018));
      if (bells && bar % 2 === 1 && e >= 5)
        bells.triggerAttackRelease(chord[(e - 5) % chord.length].replace(/\d/, (d) => String(+d + 2)), "16n", time + (e % 2) * 0.06, 0.35);
      if (arp) arp.triggerAttackRelease(chord[e % chord.length].replace(/\d/, (d) => String(+d + 1)), "8n", time, 0.35);
      if (song.beat && song.beat !== "none") {
        if (e === 0 || (song.beat === "bouncy" && e === 4)) kick.triggerAttackRelease("C2", "8n", time, 0.7);
        if (song.beat === "bouncy" && (e === 2 || e === 6)) clap.triggerAttackRelease("16n", time, 0.6);
        if (e % 2 === 1) shaker.triggerAttackRelease("32n", time, 0.4);
      }
      step++;
    }, "8n");
    this.loop.start(0);
    if (T.state !== "started") T.start("+0.05");
  }
  private makeLead(kind: Song["lead"]) {
    if (kind === "glock") {
      const s = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 5.07, modulationIndex: 2.2, oscillator: { type: "sine" }, modulation: { type: "sine" }, envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.9 }, modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 } });
      s.volume.value = -13;
      return s;
    }
    if (kind === "marimba") {
      const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.3 } });
      s.volume.value = -11;
      return s;
    }
    if (kind === "chip") {
      const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "pulse", width: 0.3 } as Tone.OmniOscillatorOptions, envelope: { attack: 0.003, decay: 0.12, sustain: 0.25, release: 0.08 } });
      s.volume.value = -21;
      return s;
    }
    // music box: a bright FM pluck
    const s = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 7.01, modulationIndex: 1.4, oscillator: { type: "sine" }, modulation: { type: "triangle" }, envelope: { attack: 0.001, decay: 1.3, sustain: 0, release: 1.3 }, modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 } });
    s.volume.value = -12;
    return s;
  }
}

export const themes = new Themes();
useStore.subscribe((s, prev) => {
  if (s.settings.music !== prev.settings.music || s.settings.sound !== prev.settings.sound) themes.apply();
});

/** ask for a song while this component is mounted (null = silence); the newest asker wins */
export function useTheme(name: ThemeName | null) {
  useEffect(() => themes.push(name), [name]);
}
