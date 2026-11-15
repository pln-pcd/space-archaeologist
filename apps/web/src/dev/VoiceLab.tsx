// /dev/voices: side-by-side A/B audition of Nova and narrator voices (v4.6 §7). Clips are rendered by
// `python -I scripts/voices.py --audition` into public/audio/voicelab/ with measured pitch, range
// (liveliness), pace and pauses. Click two cards to compare; the chosen voices are marked.
import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button, Card, Tag } from "../odyssey/ui/kit";

type Row = { group: "nova" | "narrator"; engine: string; voice: string; file: string; text: string; seconds: number; wpm: number; pitch_hz: number; pitch_range_hz: number; pause_share: number };

export default function VoiceLab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    fetch("/audio/voicelab/voicelab.json")
      .then((r) => r.json())
      .then((d) => setRows(d.rows))
      .catch(() => setRows([]));
  }, []);
  const play = (f: string) => {
    audio.current?.pause();
    if (playing === f) return setPlaying(null);
    const a = new Audio(`/audio/voicelab/${f}`);
    a.onended = () => setPlaying(null);
    audio.current = a;
    void a.play();
    setPlaying(f);
  };
  const group = (g: Row["group"], title: string) => (
    <section style={{ display: "grid", gap: 16 }}>
      <h2 style={{ font: "600 30px Fredoka, sans-serif", color: "#fff", margin: "8px 0 0" }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {rows
          .filter((r) => r.group === g)
          .map((r) => (
            <Card key={r.file} starred={r.voice.includes("chosen")} style={{ display: "grid", gap: 8 }}>
              <strong style={{ font: "600 22px Fredoka, sans-serif" }}>{r.voice}</strong>
              <span style={{ fontSize: 17, color: "#5a5378" }}>
                {r.engine} · {r.seconds}s · {r.wpm} wpm · pitch {r.pitch_hz} Hz · range {r.pitch_range_hz} Hz · pauses {Math.round(r.pause_share * 100)}%
              </span>
              <p style={{ fontSize: 18, margin: 0 }}>“{r.text}”</p>
              <Button size="sm" variant={playing === r.file ? "danger" : "sky"} icon={playing === r.file ? <Square size={20} /> : <Play size={20} />} onClick={() => play(r.file)} quiet>
                {playing === r.file ? "Stop" : "Play"}
              </Button>
            </Card>
          ))}
      </div>
    </section>
  );
  return (
    <main style={{ minHeight: "100vh", background: "#1d1842", padding: "32px 40px", display: "grid", gap: 24, fontFamily: "Fredoka, sans-serif" }}>
      <h1 style={{ font: "400 52px 'Lilita One', sans-serif", color: "#FFD23F", margin: 0 }}>Voice lab</h1>
      <p style={{ color: "#fff", fontSize: 19, margin: 0, maxWidth: "70ch" }}>
        Nova should sound like a jolly, lively kid explorer; the narrator like a warm bedtime storyteller. Higher “range” = livelier. Gemini TTS voices appear here after
        <code> python -I scripts/voices.py --audition</code> runs with a key that has TTS quota (the free tier allows 10 a day). <Tag kind="imagine" />
      </p>
      {rows.length === 0 && <p style={{ color: "#fff" }}>No clips yet: run the audition script.</p>}
      {group("nova", "Nova")}
      {group("narrator", "Story narrator")}
    </main>
  );
}
