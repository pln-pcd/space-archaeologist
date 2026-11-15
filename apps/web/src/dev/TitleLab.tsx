// /dev/title: the cover title in the candidate display fonts (v4.6 §1), side by side on the cover's
// night sky, at the real size, with the cream fill, warm-dark outline, soft drop shadow and letter bounce.
import "@fontsource/fredoka/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/lilita-one/400.css";
import "@fontsource/chewy/400.css";
import "../odyssey/ui/title.css";

const FONTS = [
  { id: "fredoka", label: "Fredoka 700", family: "'Fredoka', sans-serif", weight: 700, note: "current title face; round, friendly, a little plain at hero size" },
  { id: "baloo", label: "Baloo 2 ExtraBold", family: "'Baloo 2', sans-serif", weight: 800, note: "chunky and soft; reads well, close to Fredoka" },
  { id: "lilita", label: "Lilita One", family: "'Lilita One', sans-serif", weight: 400, note: "chunky storybook poster face; strongest silhouette, mid-century feel" },
  { id: "chewy", label: "Chewy", family: "'Chewy', sans-serif", weight: 400, note: "bouncy and playful, but wobbly letters are harder for new readers" },
];

export default function TitleLab() {
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at 30% 20%, #2B2758, #14102E 70%)", padding: 32, display: "grid", gap: 28, color: "#FFF8EC", fontFamily: "Lexend, sans-serif" }}>
      <h2 style={{ margin: 0, fontWeight: 500 }}>/dev/title: cover title candidates</h2>
      {FONTS.map((f) => (
        <section key={f.id} data-font={f.id} style={{ display: "grid", gap: 6 }}>
          <small style={{ opacity: 0.8, fontSize: 18 }}>
            {f.label}: {f.note}
          </small>
          <h1 className="od-hero-title od-free" style={{ fontFamily: f.family, fontWeight: f.weight }}>
            {"Starship Odyssey".split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${i * 45}ms` }}>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h1>
        </section>
      ))}
    </main>
  );
}
