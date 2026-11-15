// /dev/facts (bible §16): every fact with its source, plus any content warnings. Dev tool.
import sources from "../content/sources.json";
import { checkContent } from "../content/check";
import "./playground.css";

export default function FactsPage() {
  const { warnings, facts } = checkContent();
  const src = new Map(sources.sources.map((s) => [s.id, s]));
  return (
    <main className="playground facts-page">
      <header>
        <h1>Facts check</h1>
        <p>
          {warnings.length === 0 ? "No warnings. Every fact has a verified NASA-checked source." : `${warnings.length} warning(s). Fix them before shipping (this never blocks a build).`}
        </p>
      </header>
      {warnings.length > 0 && (
        <section className="lab-group">
          <h2>Warnings</h2>
          <ol className="facts-list warn">
            {warnings.map((w, i) => (
              <li key={i}>
                <code>{w.where}</code> {w.problem}: “{w.text}”
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="lab-group">
        <h2>Facts in Chapters 1 and 2 ({facts.length}: {facts.filter((f) => f.where.startsWith("ch1")).length} Moon, {facts.filter((f) => f.where.startsWith("ch2")).length} Mars)</h2>
        <ol className="facts-list">
          {facts.map((f) => (
            <li key={f.where}>
              <code>{f.where}</code> “{f.text}”{" "}
              {f.sources.map((id) => (
                <a key={id} href={src.get(id)?.url ?? undefined} target="_blank" rel="noreferrer">
                  {id}
                </a>
              ))}
            </li>
          ))}
        </ol>
      </section>
      <section className="lab-group">
        <h2>Sources ({sources.sources.length})</h2>
        <ol className="facts-list">
          {sources.sources.map((s) => (
            <li key={s.id}>
              <code>{s.id}</code> [{s.status}] {s.title} — {s.publisher}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
