// /dev/audio: play every sound, music layer, motif, ambience and voice (bible Prompt 3 DONE WHEN).
import { useEffect, useState } from "react";
import { ambience, type Bed } from "../audio/ambience";
import { audio } from "../audio/engine";
import { MOTIFS, motifFull, motifNote, music, type MotifId } from "../audio/music";
import { SFX_NAMES, arpGesture, chordSwell, noteGesture, play, warpRiser } from "../audio/sfx";
import { say, type Speaker } from "../audio/voice";
import { useStore } from "../store";
import "../ui/gloves.css";
import "./playground.css";

export default function AudioLab() {
  const [ready, setReady] = useState(audio.ready);
  const [log, setLog] = useState<string[]>([]);
  const [layers, setLayers] = useState({ brass: false, marimba: false });
  const [bed, setBed] = useState<Bed>(null);
  const { settings, setting, setVolume } = useStore();
  const vol = settings.volumes ?? { master: 0.8, music: 0.7, sfx: 0.8, voice: 0.9 };
  useEffect(() => audio.onReady(() => setReady(true)), []);
  const note = (s: string) => setLog((l) => [s, ...l].slice(0, 10));
  const btn = (label: string, fn: () => void, id?: string) => (
    <button key={label} type="button" className="chunky quiet small" data-sound={id ?? label} onClick={() => (void audio.unlock().then(fn), note(label))}>
      {label}
    </button>
  );
  return (
    <main className="playground audio-lab">
      <header>
        <h1>Audio lab</h1>
        <p>Everything is generated in code (Tone.js, ZzFX, Web Audio). {ready ? "Audio is on." : "Press any button to start audio."}</p>
      </header>
      <section className="lab-group">
        <h2>Starship Lullaby</h2>
        {btn(music.playing ? "Theme playing" : "Play theme", () => music.start(), "theme")}
        {btn("Pause theme", () => music.stop(), "theme-stop")}
        {(["brass", "marimba"] as const).map((l) =>
          btn(`${layers[l] ? "Remove" : "Add"} ${l} layer`, () => {
            const next = { ...layers, [l]: !layers[l] };
            setLayers(next);
            music.setLayers(next);
          }, `layer-${l}`),
        )}
      </section>
      <section className="lab-group">
        <h2>Machine motifs</h2>
        {(Object.keys(MOTIFS) as MotifId[]).map((id) => (
          <div key={id} className="lab-row">
            <strong>{id}</strong>
            {[0, 1, 2, 3, 4].map((i) => btn(`${id} note ${i + 1}`, () => motifNote(id, i), `motif-${id}-${i}`))}
            {btn(`${id} full phrase`, () => motifFull(id), `motif-${id}-full`)}
          </div>
        ))}
      </section>
      <section className="lab-group">
        <h2>Ambience</h2>
        {(["base", "moon", "mars", "catch", null] as Bed[]).map((b) =>
          btn(b ? `Ambience: ${b}` : "Ambience off", () => {
            ambience.set(b);
            setBed(b);
            if (b === "catch") music.start();
          }, `bed-${b}`),
        )}
        {bed === "catch" && [0, 1, 2, 3, 4].map((k) => btn(`Streak ${k}`, () => ambience.setStreak(k), `streak-${k}`))}
      </section>
      <section className="lab-group">
        <h2>Musical gestures</h2>
        {btn("Pinch note", () => noteGesture(), "g-pinch")}
        {btn("Wave arpeggio", () => arpGesture(), "g-wave")}
        {btn("Wake chord swell", () => chordSwell(), "g-wake")}
        {btn("Warp riser", () => warpRiser(3), "g-warp")}
      </section>
      <section className="lab-group">
        <h2>Sound effects</h2>
        <div className="lab-grid">{SFX_NAMES.map((n) => btn(n, () => play(n), `sfx-${n}`))}</div>
      </section>
      <section className="lab-group">
        <h2>Voices</h2>
        {(["nova", "eagle", "opportunity", "ranger"] as Speaker[]).map((w) => btn(`Line tick: ${w}`, () => say("A quiet line of story.", w), `voice-${w}`))}
        {btn("Read to me (speech)", () => {
          setting("readAloud", true);
          say("Hello! I am Nova. Captions stay on, and I can read them to you.", "nova");
        }, "voice-read")}
      </section>
      <section className="lab-group">
        <h2>Mixer</h2>
        {(["master", "music", "sfx", "voice"] as const).map((k) => (
          <label key={k} className="od-slider">
            <strong>{k}</strong>
            <input type="range" min={0} max={1} step={0.05} value={vol[k]} onChange={(e) => setVolume(k, Number(e.target.value))} />
          </label>
        ))}
      </section>
      <ol className="pg-log">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </main>
  );
}
