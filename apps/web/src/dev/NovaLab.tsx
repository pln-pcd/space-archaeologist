// /dev/nova: Nova in every expression (and a few gestures), for the review sheet.
import NovaStage from "../odyssey/nova/NovaStage";
import type { Expression, Gesture } from "../odyssey/nova/state";
import "../odyssey/odyssey.css";

const EXPR: Expression[] = ["neutral", "happy", "excited", "curious", "thinking", "listening", "sorry", "sleepy"];
const GEST: [Gesture, Expression][] = [["wave", "happy"], ["point", "excited"], ["thumbs", "happy"], ["cup", "listening"]];

export default function NovaLab() {
  const cell = (label: string, e: Expression, g: Gesture = "none", frame: "full" | "peek" = "full") => (
    <figure key={label} style={{ margin: 0, background: "#2A2358", borderRadius: 16, padding: 8, textAlign: "center" }}>
      <NovaStage frame={frame} expression={e} gesture={g} float={false} className="" />
      <figcaption style={{ color: "#FFF8EC", font: "600 20px Lexend, sans-serif" }}>{label}</figcaption>
    </figure>
  );
  return (
    <main style={{ background: "#14102E", minHeight: "100vh", padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      <style>{".od-nova-stage{height:300px}"}</style>
      {EXPR.map((e) => cell(e, e, "none", "peek"))}
      {GEST.map(([g, e]) => cell(`${g} (${e})`, e, g))}
    </main>
  );
}
