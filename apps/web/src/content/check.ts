// DEV-ONLY content checker (bible §16): warns about facts without verified sources, lines over 15
// words, quiz text over limits, and "Never say" phrases. It never blocks a build.
import sources from "./sources.json";
import glossary from "./glossary.json";
import ch1 from "./chapters/ch1-moon.json";
import ch2 from "./chapters/ch2-mars.json";
import q1 from "./questions/ch1-moon.json";
import q2 from "./questions/ch2-mars.json";
import teasers from "./teasers.json";
import curiosities from "./curiosities.json";
import nova from "./nova-lines.json";
import faq from "./nova-faq.json";

export type Warning = { where: string; text: string; problem: string };
type Line = { type: string; text: string; sourceIds?: string[]; speaker?: string };

const SRC = new Map(sources.sources.map((s) => [s.id, s]));
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function checkLine(where: string, l: Line, max = 15): Warning[] {
  const out: Warning[] = [];
  if (l.type !== "fact" && l.type !== "imagine") out.push({ where, text: l.text, problem: `type must be "fact" or "imagine"` });
  if (l.type === "fact") {
    if (!l.sourceIds?.length) out.push({ where, text: l.text, problem: "fact without sourceIds" });
    for (const id of l.sourceIds ?? []) {
      const s = SRC.get(id);
      if (!s) out.push({ where, text: l.text, problem: `unknown source ${id}` });
      else if (s.status !== "verified") out.push({ where, text: l.text, problem: `source ${id} is "${s.status}", not verified` });
    }
  }
  if (words(l.text) > max) out.push({ where, text: l.text, problem: `${words(l.text)} words (max ${max})` });
  const low = l.text.toLowerCase();
  // a negation ("there's no wind on the Moon") is the fact the Never-say list protects, not a breach
  for (const bad of glossary.neverSay) if (low.includes(bad) && !low.includes(`no ${bad}`)) out.push({ where, text: l.text, problem: `"Never say": ${bad}` });
  return out;
}

export function checkContent(): { warnings: Warning[]; facts: { where: string; text: string; sources: string[] }[] } {
  const warnings: Warning[] = [];
  const facts: { where: string; text: string; sources: string[] }[] = [];
  // Nova's scripted lines: conversational, so up to 25 words; facts must cite sources
  for (const l of nova.lines as (Line & { id: string; lead?: string })[]) {
    warnings.push(...checkLine(`nova/${l.id}`, { ...l, text: [l.lead, l.text].filter(Boolean).join(" ") }, 25));
    if (l.type === "fact") facts.push({ where: `nova/${l.id}`, text: l.text, sources: l.sourceIds ?? [] });
  }
  // Nova's local answers: every one is a sourced fact (≤ 60 words, prompt §7b)
  for (const f of faq.faq) {
    warnings.push(...checkLine(`nova-faq/${f.id}`, { type: "fact", text: f.a, sourceIds: f.sourceIds }, 60));
    facts.push({ where: `nova-faq/${f.id}`, text: f.a, sources: f.sourceIds });
  }
  for (const [tag, ch] of [["ch1", ch1], ["ch2", ch2]] as const)
  for (const b of ch.beats as typeof ch1.beats) {
    b.lines.forEach((l, i) => {
      const where = `${tag}/${b.id}#${i + 1}`;
      // verbatim quotes (the plaque) may run longer than 15 words
      warnings.push(...checkLine(where, l as Line, (l as { verbatim?: boolean }).verbatim ? 24 : 15));
      if (l.type === "fact") facts.push({ where, text: l.text, sources: (l as Line).sourceIds ?? [] });
    });
    const extra = b as { card?: Line; plaque?: { lines: string[]; type: string; sourceIds: string[] } };
    if (extra.card) {
      warnings.push(...checkLine(`${tag}/${b.id}/card`, extra.card));
      facts.push({ where: `${tag}/${b.id}/card`, text: extra.card.text, sources: extra.card.sourceIds ?? [] });
    }
    if (extra.plaque) {
      const text = extra.plaque.lines.join(" ");
      warnings.push(...checkLine(`${tag}/${b.id}/plaque`, { type: extra.plaque.type, text, sourceIds: extra.plaque.sourceIds }, 24)); // verbatim quote
      facts.push({ where: `${tag}/${b.id}/plaque`, text, sources: extra.plaque.sourceIds });
    }
  }
  for (const [tag, ch] of [["ch1", ch1], ["ch2", ch2]] as const) {
    const sec = (ch as unknown as { secret?: Line }).secret;
    if (sec) {
      warnings.push(...checkLine(`${tag}/secret`, sec));
      facts.push({ where: `${tag}/secret`, text: sec.text, sources: sec.sourceIds ?? [] });
    }
  }
  for (const [tag, bank] of [["ch1", q1], ["ch2", q2]] as const)
  for (const q of bank.questions) {
    const where = `quiz/${tag}/${q.id}`;
    warnings.push(...checkLine(where, { type: "fact", text: q.prompt, sourceIds: q.sourceIds }, 12));
    q.options.forEach((o) => {
      if (q.format !== "trueImagine" && words(o.label) > 3) warnings.push({ where, text: o.label, problem: `answer has ${words(o.label)} words (max 3)` });
    });
    if (!q.options.some((o) => (o as { correct?: boolean }).correct) && q.format !== "order") warnings.push({ where, text: q.prompt, problem: "no correct option" });
  }
  for (const t of teasers.teasers) t.lines.forEach((l, i) => warnings.push(...checkLine(`teaser/${t.chapter}#${i + 1}`, l as Line)));
  // curiosities: one short sourced sentence each (bible §12)
  for (const c of curiosities.curiosities) {
    warnings.push(...checkLine(`curiosity/${c.id}`, c as unknown as Line));
    facts.push({ where: `curiosity/${c.id}`, text: c.text, sources: c.sourceIds });
  }
  for (const [k, g] of Object.entries(glossary.terms)) if (words(g.kid) > 15) warnings.push({ where: `glossary/${k}`, text: g.kid, problem: "definition over 15 words" });
  return { warnings, facts };
}

if (import.meta.env.DEV) {
  const { warnings } = checkContent();
  if (warnings.length) {
    console.warn(`[facts] ${warnings.length} content warning(s) — open /dev/facts`);
    warnings.forEach((w) => console.warn(`[facts] ${w.where}: ${w.problem} — "${w.text}"`));
  }
}
