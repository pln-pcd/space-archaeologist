// Writes video/SCRIPT.md from the built timeline (video/build/timeline.json) and lines.json:
// a timecoded script with a fact ID for every claim, the rubric question each beat answers, and a
// rubric coverage table. Run after `node video/build.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
const tl = JSON.parse(readFileSync("video/build/timeline.json", "utf8"));
const L = Object.fromEntries(JSON.parse(readFileSync("video/narration/lines.json", "utf8")).lines.map((l) => [l.id, l]));
const S = Object.fromEntries(JSON.parse(readFileSync("apps/web/src/content/sources.json", "utf8")).sources.map((s) => [s.id, s]));
const tc = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
const PARTS = ["1 Intro", "2 Problem", "3 Solution", "4 Live demo", "5 Features", "6 Impact", "End card"];
const SHOW = {
  n01: "Cold open: real launch lever pull, Saturn V liftoff, Eagle landed, a glove boxing a Moon rock (labelled simulated hand input)",
  n02: "The game's real title screen; team label and Philippines chips",
  n03: "Challenge title card, copied from the challenge page",
  n04: "Real gameplay: Eagle on the Moon (arrival film), then Opportunity unfolding on Mars (chapter 2 roll-off film)",
  n05: "NASA photos: Aldrin carrying the experiments, Eagle on the Moon (credited); chips: still used, 45 km",
  n06: "Kinetic type; chip 'From the challenge brief'",
  n07: "Real dust-dig footage; 'What if kids could dig the stories up?'",
  n08: "Ship footage; 'A free browser game for kids 7 to 12. Real machines. True stories.'",
  n09: "Session flow built from real frames: Explorer, Ship, NASA film, Launch, Explore + dig, Games, Badge",
  n10: "Punch-in on Nova at the ship; bubble 'Nova, your AI space guide'",
  n11: "Title, START, intro tour (input badge: Mouse + keyboard)",
  n12: "Name card typing, explorer designer",
  n13: "A short warp, then the ship with the two mission portals",
  n14: "Real NASA film inside the game, credit line on screen",
  n15: "Lever pull, ignition, liftoff, staging, Moon ahead",
  n16: "Briefing film, then the exploration HUD; bubble 'The mission path'",
  n17: "Brushing the dust off a find (badge: Mouse)",
  n18: "A fist turns the find (simulated hand input, labelled); opening its glowing parts, each with its job and a sourced fact",
  n19: "Laser pings at the retroreflector; term card 'Retroreflector: a mirror that sends light straight back'; chip 'Light round trip: about 2.5 seconds' (F23)",
  n20: "The evidence quiz: camera panel with the hand tracker, four answers A to D picked by holding up fingers (simulated hand input, labelled)",
  n21: "Rock Box with the glove (badge: Hands; label: simulated hand input); bubble '21.5 kg: Apollo 11's real total'",
  n22: "Rebuild: snap the stages, give each its job, order the journey",
  n23: "Report quiz: a wrong answer becomes a hint; bubble 'No fail screens'",
  n24: "Warp home, badge 'Tranquility Storykeeper', archive 'Chapter complete!'",
  n25: "Opportunity driving on Mars, then Sol Keeper (badge: Mouse); term card 'Sol: one day on Mars, about 24 h 40 min' (F20)",
  n26: "Ask Nova by voice: a spoken question (adult TTS voice, labelled) heard by the game's speech-to-text; Nova answers in her real voice",
  n26b: "Over the wait while Nova thinks: the chat shows the question the game heard",
  n27: "Field report card 05 'Why it works'",
  n28: "Typed chat: Nova answers why the laser reflector was left on the Moon, then kindly redirects an off-topic question; chips Voice or text, Stays on space, Sourced facts",
  n29: "Glove in the Rock Box (labelled simulated hand input); chips Mouse, Keyboard, Touch",
  n30: "Story film with the narrator caption; chip 'Read aloud + captions'",
  n31: "The facts page (every fact with its source); stats 275 facts, 46 NASA sources",
  n32: "Live asteroid answer from NASA data ('one asteroid flying past Earth today... about 47 times farther away than the Moon'); chips Asteroids today, Space weather, Mars weather; label naming the NASA APIs",
  n33: "Settings drawer: AI helper switch; chips No accounts, Camera + voice stay on device, AI off switch",
  n34: "Settings: easy-read font and calm motion toggled; chips Captions on, Calm motion, Easy-read font, Offline fact sheet",
  n35: "Ship footage; chips Free, Any web browser, No downloads, No accounts, One link to share with a class",
  n36: "Explorer designer; 'Built for ages 7 to 12'",
  n37: "Three takeaway cards: What was left behind, Why it stayed, Science still uses it",
  n38: "Ship mission wall punch-in on the sealed missions; chips Viking 1, Pioneer 10, Voyager 1",
  n39: "The one-sentence takeaway on screen",
  n40: "End card: title, play link, repo link, team, Not endorsed by NASA, Made with AI tools",
};
const factCell = (ids) =>
  ids.map((id) => (S[id] ? `${id}` : id === "CH" ? "CH (challenge page)" : id === "DR" ? "DR (design reasoning)" : id === "BUILD" ? "BUILD (verified in the build)" : id)).join(", ");
let out = `# Demo video script (timecoded)

Generated by \`node video/script_md.mjs\` from \`video/build/timeline.json\` (the built edit) and
\`video/narration/lines.json\`. Total length **${tc(tl.total)}** (${tl.total.toFixed(1)} s).

Fact IDs refer to \`apps/web/src/content/sources.json\` (the verified facts file; titles below).
CH = the official challenge page; DR = design reasoning (a team choice, never a statistic);
BUILD = a feature verified in the current build (\`docs/DECISIONS.md\` inventory).
Captions show every spoken line; numbers are spelled for the voice and shown as digits.

| Time | Part | Narration | On screen | Facts | Rubric |
|---|---|---|---|---|---|
`;
for (const v of tl.voice) {
  const l = L[v.id];
  const b = tl.beats.find((b) => b.lines.includes(v.id)) ?? { part: 3 };
  out += `| ${tc(v.start)} | ${PARTS[b.part]} | ${l.caption} | ${SHOW[v.id] ?? ""} | ${factCell(l.facts)} | ${l.rubric.join(", ")} |\n`;
}
if (tl.voiceShot) out += `| ${tc(tl.voiceShot.abs + tl.voiceShot.kidAt)} | 4 Live demo | (Player, adult TTS voice, labelled) "Nova, how far away is the Moon?" Nova, live: "${tl.voiceShot.nova.map((c) => c.text).join(" ")}" | Real-time recording: the game's speech-to-text hears the question, Gemini answers behind the guard, Nova speaks in her real voice | F10 (about 385,000 km; the Moon drifts away a little each year) | Validity, Creativity |\n`;
out += `
## Rubric coverage

Every judging question, the moment that answers it, and the evidence on screen.

| Criterion | Question | Where (time) | Evidence on screen |
|---|---|---|---|
`;
const at = (id) => tc(tl.voice.find((v) => v.id === id).start);
const rows = [
  ["Impact", "Potential for significant impact, quality and quantity", `${at("n35")} to ${at("n37")}`, "Free, browser-based, no accounts, offline; built for ages 7 to 12; three takeaways"],
  ["Impact", "Major or minor problem?", `${at("n04")} to ${at("n06")}`, "Machines left since the 1960s; kids hear only about today's missions; dense websites (challenge brief)"],
  ["Impact", "Does it inspire or help others?", `${at("n37")}, ${at("n38")}`, "What kids walk away with; three more missions planned"],
  ["Creativity", "Original and innovative?", `${at("n07")}, ${at("n17")} to ${at("n21")}`, "Kids act as archaeologists: dig, clue stars, laser ping, evidence board, hands"],
  ["Creativity", "Meaningfully improves existing ideas?", `${at("n06")} to ${at("n08")}`, "From reading text to doing: real NASA footage plus play"],
  ["Creativity", "Fresh perspective or inventive execution?", `${at("n09")}, ${at("n21")}, ${at("n26")}`, "Field-report framing, gesture gloves, a voice guide"],
  ["Validity", "Grounded in scientific principles?", `${at("n19")}, ${at("n25")}, ${at("n31")}`, "Laser ranging (2.5 s round trip), Martian wind cleaning panels, 275 sourced facts"],
  ["Validity", "Technically feasible?", `${at("n11")} to ${at("n26")}`, "Real gameplay of the current build, end to end"],
  ["Validity", "How well would it achieve its purpose in real use?", `${at("n23")}, ${at("n28")}`, "No fail screens; Nova answers and redirects off-topic questions"],
  ["Validity", "Usability, practicality, accessibility", `${at("n29")}, ${at("n33")}, ${at("n34")}`, "Mouse/keyboard/touch, no accounts, on-device camera and voice, AI switch, captions, calm motion, easy-read font, offline"],
  ["Relevance", "Fully and directly addresses the challenge?", `${at("n03")}, ${at("n08")}`, "Challenge title on screen; game about hardware left on the Moon and Mars"],
  ["Relevance", "Uses NASA data meaningfully, as a core part?", `${at("n14")}, ${at("n31")}, ${at("n32")}`, "NASA film in the game, every fact linked to a NASA source, live NASA feeds"],
  ["Relevance", "Depth of data engagement adds credibility?", `${at("n31")}`, "The facts page and the fact-check numbers"],
  ["Presentation", "Conveys challenge, method and significance clearly", "whole film", "Six numbered field reports with a progress path; one idea per scene"],
  ["Presentation", "Engaging, well-structured storytelling", `${at("n01")}`, "Cold open from real gameplay; dig and scanner transitions"],
  ["Presentation", "Compelling and accessible delivery", "whole film", "Captions on every line, large type, a one-sentence takeaway at " + at("n39")],
];
for (const r of rows) out += `| ${r.join(" | ")} |\n`;
out += `\n## Fact sources used\n\n`;
const used = new Set(Object.values(L).flatMap((l) => l.facts).filter((f) => S[f]));
used.add("F19").add("F20").add("F23");
for (const id of [...used].sort((a, b) => +a.slice(1) - +b.slice(1))) out += `- **${id}**: ${S[id].title}. ${S[id].publisher}. ${S[id].url}\n`;
writeFileSync("video/SCRIPT.md", out);
console.log("video/SCRIPT.md written");
