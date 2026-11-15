// NOVA'S BRAIN, browser side (new-flow prompt §7b). The real guard lives on our server; this file
//  - strips the player's name and personal details BEFORE anything leaves the browser,
//  - catches worrying messages locally (the safety line, no network at all),
//  - answers from the game's own fact sheet when the server/API is unavailable,
//  - streams the server's answer (NDJSON) with a 6 s first-word timeout.
// No chat content is stored anywhere (not in localStorage, not in logs).
import faqData from "../../content/nova-faq.json";
import linesData from "../../content/nova-lines.json";
import { useStore } from "../../store";
import { MISSIONS, MOON } from "../../missions/registry";
import { sessionFor } from "../../missions/session";
import { lastHeard } from "./ears";
export type MissionContext = { missionId: string; step: number; artifactId: string | null };
let currentContext: MissionContext | null = null;
export function setMissionContext(context: MissionContext | null) { currentContext = context; }

export type MissionId = "eagle" | "opportunity" | null;
export type Turn = { role: "user" | "assistant"; text: string };
export type Line = { id: string; text: string; lead?: string; chip?: string; type: string; sourceIds?: string[] };
type Faq = { id: string; mission: MissionId; keys: string[]; a: string; sourceIds: string[] };

export const LINES: Record<string, Line> = Object.fromEntries((linesData.lines as Line[]).map((l) => [l.id, l]));
export const line = (id: string) => LINES[id];
export const FAQ = faqData.faq as Faq[];
export const CHIPS = faqData.chips as Record<"eagle" | "opportunity" | "home", string[]>;
export const REDIRECTS = ["redirect-1", "redirect-2", "redirect-3", "redirect-4", "redirect-5", "redirect-6"];

export const MAX_CHARS = 200;

// ---------- privacy: scrub before sending ----------
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|io|ph|uk|us|ca|au|edu|gov)(?:\/\S*)?/gi;
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/g;
const ADDRESS = /\b\d{1,5}\s+(?:[A-Za-z]+\s){0,3}(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|purok|barangay|brgy)\b\.?/gi;
const SCHOOL = /\b(?:[Ii]\s+(?:go|study)\s+(?:to|at)|[Mm]y\s+school\s+is|[Ii]'?m\s+(?:in|at))\s+[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,4}\s*(?:school|academy|elementary|primary|high|college)?/g;
const AGE_NAME = /\b(?:[Mm]y\s+name\s+is|[Ii]\s+am|[Ii]'m|[Cc]all\s+me)\s+[A-Z][a-z]+/g;
const AGE = /\b(?:i\s+am|i'm)\s+\d{1,2}\s*(?:years?\s*old|yo)?\b/gi;

/** remove personal details; the player's saved name becomes "the explorer" */
export function scrub(raw: string): string {
  let t = raw.slice(0, MAX_CHARS);
  const p = useStore.getState().profile;
  for (const n of [p?.playerName, p?.nickname, p?.playerPatch].filter((x): x is string => !!x && x.length >= 2)) {
    t = t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "the explorer");
  }
  return t
    .replace(EMAIL, "[email]")
    .replace(URL_RE, "[link]")
    .replace(ADDRESS, "[address]")
    .replace(PHONE, "[number]")
    .replace(SCHOOL, "[school]")
    .replace(AGE_NAME, "[name]")
    .replace(AGE, "[age]")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- safety: worrying messages never go to the network ----------
const DISTRESS = [
  /\b(hurt|hurts|hurting|bleeding|abuse|abused|hit me|hits me|beat me|beats me|kick me|touch(?:ed|es)? me)\b/i,
  /\b(scared|afraid|frightened|terrified)\b.*\b(home|dad|mom|mum|father|mother|uncle|aunt|teacher|someone|man|person|people|him|her|them)\b/i,
  /\b(unsafe|not safe|in danger|being bullied|bully me|bullies me|kill myself|hurt myself|want to die|suicide|run away)\b/i,
  /\b(someone|a stranger|a man|a person)\b.*\b(follow|following|followed|touch|touches|secret|hurt|hurts)\b/i,
  /\b(sad all the time|nobody loves me|no one loves me|i hate myself)\b/i,
];
export const isDistress = (t: string) => DISTRESS.some((r) => r.test(t));

// ---------- greetings and small talk: a friendly canned line that steers back to space (works offline) ----------
const GREETING = /^\W*(?:(?:hi|hello|hey|hiya|howdy|yo|good (?:morning|afternoon|evening)|nice to meet you|thanks?|thank you|bye|goodbye|see you)\b|(?:how are you|how's it going|what(?:'s| is) your name|who are you)\b)/i;
const SPACEISH = /\b(nasa|space|moon|mars|planet|star|sun|rocket|astronaut|rover|orbit|apollo|opportunity|jupiter|saturn|earth|galaxy|comet|asteroid|alien)/i;
export function greetingLine(t: string): { lineId: string; chip: string } | null {
  if (!GREETING.test(t) || t.split(/\s+/).length > 9 || SPACEISH.test(t)) return null;
  const s = t.toLowerCase();
  if (/how are you|how's it going/.test(s)) return { lineId: "chat-howareyou", chip: "Tell me about the Moon" };
  if (/name|who are you/.test(s)) return { lineId: "chat-name", chip: "What did Opportunity find?" };
  if (/thank/.test(s)) return { lineId: "chat-thanks", chip: "What are Martian blueberries?" };
  if (/bye|see you/.test(s)) return { lineId: "chat-bye", chip: "Who walked on the Moon?" };
  return { lineId: "chat-hi", chip: "Tell me about Mars" };
}

// ---------- local fact-sheet answers ----------
const STOP = new Set("a an the is are was were do does did how why what when where who which of on in to for and or it its it's i you me my your can could would will about tell please".split(" "));
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
const stem = (w: string) => w.replace(/(ies|es|s|ing|ed)$/, "");

export function localAnswer(q: string, mission: MissionId): Faq | null {
  const qw = new Set(words(q).map(stem));
  if (!qw.size) return null;
  let best: Faq | null = null;
  let bestScore = 0;
  for (const f of FAQ) {
    let s = 0;
    for (const k of f.keys) {
      const kw = words(k).map(stem);
      if (!kw.length) continue;
      const hit = kw.filter((w) => qw.has(w)).length / kw.length;
      s = Math.max(s, hit === 1 ? 1 + kw.length * 0.1 : hit * 0.7);
    }
    if (mission && f.mission === mission) s += 0.15;
    if (s > bestScore) (bestScore = s), (best = f);
  }
  return bestScore >= 0.7 ? best : null;
}

// ---------- in-game memory (v7): progress and favourite topics, never names or chat text ----------
const TOPIC_WORDS: [RegExp, string][] = [
  [/\bmoon|lunar|apollo|eagle|armstrong|aldrin\b/i, "the Moon"],
  [/\bmars|martian|opportunity|curiosity|perseverance|rover/i, "Mars and rovers"],
  [/\bjupiter\b/i, "Jupiter"],
  [/\bsaturn\b/i, "Saturn"],
  [/\bsun\b|solar|flare/i, "the Sun"],
  [/\bstar(s)?\b|galax|nebula|black hole/i, "stars and galaxies"],
  [/\basteroid|comet|meteor/i, "asteroids and comets"],
  [/\bastronaut|space ?suit|iss|space station/i, "astronauts"],
  [/\brocket|launch|saturn v/i, "rockets"],
  [/\bvoyager|pioneer|viking|probe/i, "space probes"],
  [/\bweather|climate|storm/i, "weather"],
];
function learnTopics(q: string) {
  const st = useStore.getState();
  const have = st.settings.novaTopics ?? [];
  const found = TOPIC_WORDS.filter(([r]) => r.test(q)).map(([, t]) => t);
  const next = [...found, ...have.filter((t) => !found.includes(t))].slice(0, 6);
  st.configure({ novaTopics: next, novaAsked: (st.settings.novaAsked ?? 0) + 1 });
}
const SCREENS: Record<number, string> = { 5: "Moon exploration", 6: "artifact scanner", 7: "evidence board", 8: "lander rebuild", 9: "discovery cards", 10: "mission challenge", 11: "rewards", 12: "space archive" };
export function explorerMemory() {
  const st = useStore.getState();
  const moon = sessionFor(MOON).snapshot();
  const done = [...new Set([...(st.progress.completed ?? []), ...(moon.rewarded ? ["eagle"] : [])])].filter((m) => m === "eagle" || m === "opportunity");
  const found = moon.records.map((id) => MOON.artifacts.find((a) => a.id === id)?.name.text ?? id).slice(0, 8);
  return { missionsDone: done, found, topics: (st.settings.novaTopics ?? []).slice(0, 6), screen: currentContext ? SCREENS[currentContext.step] ?? null : "starship" };
}

// ---------- the server call ----------
export type AnswerKind = "answer" | "greeting" | "redirect" | "safety" | "unsure" | "fallback" | "local" | "limit";
export type Answer = { kind: AnswerKind; text: string; lineId?: string; chip?: string };

let lastAsk = 0;
let asked = 0;
const SESSION = (() => {
  try {
    let s = sessionStorage.getItem("odyssey-nova-session");
    if (!s) sessionStorage.setItem("odyssey-nova-session", (s = Math.random().toString(36).slice(2)));
    return s;
  } catch {
    return Math.random().toString(36).slice(2);
  }
})();

/**
 * Ask Nova. `onText` receives streamed text (for live captions and the speech queue).
 * Always resolves (never throws): server → local FAQ → canned line.
 */
export async function ask(raw: string, mission: MissionId, history: Turn[], onText: (t: string) => void, signal?: AbortSignal, onHeard?: (t: string) => void): Promise<Answer> {
  const spoken = !!lastHeard.text && raw.trim() === lastHeard.text.trim() && Date.now() - lastHeard.at < 20000;
  if (isDistress(raw)) return { kind: "safety", text: line("safety").text, lineId: "safety" };
  const now = Date.now();
  if (now - lastAsk < 3000) return { kind: "limit", text: line("chat-wait").text, lineId: "chat-wait" };
  if (asked >= 40) return { kind: "limit", text: line("chat-rest").text, lineId: "chat-rest" };
  lastAsk = now;
  asked++;
  const hi = greetingLine(raw);
  if (hi) return { kind: "greeting", text: line(hi.lineId).text, lineId: hi.lineId, chip: hi.chip };
  const message = scrub(raw);
  learnTopics(message);
  const local = () => {
    const currentMission=currentContext?MISSIONS.get(currentContext.missionId):null;
    if(currentMission&&currentContext?.step===8&&/^(?:what(?:'s| is) (?:this|that)|how does (?:it|this) work)[?.! ]*$/i.test(message))return {kind:"local",text:currentMission.reconstruction.summary.text} as Answer;
    const artifact = currentContext ? MISSIONS.get(currentContext.missionId)?.artifacts.find((a) => a.id === currentContext?.artifactId) : null;
    if (artifact && /^(?:what(?:'s| is) (?:this|that)(?: (?:thing|artifact|object))?|what does (?:it|this) do|how does (?:it|this) work|why (?:is|was) (?:it|this) (?:left|here|left behind)|why did (?:it|this) stay)[?.! ]*$/i.test(message)) {
      const fact = /why|stay|left/i.test(message) ? artifact.leftBehindReason.fact : /do|work|purpose/i.test(message) ? artifact.purpose : artifact.summary;
      return { kind: "local", text: fact.text } as Answer;
    }
    const f = localAnswer(message, mission);
    return f ? ({ kind: "local", text: f.a } as Answer) : ({ kind: "fallback", text: line("chat-offline").text, lineId: "chat-offline" } as Answer);
  };
  if (useStore.getState().settings.askNova === false) return local();
  const ac = new AbortController();
  signal?.addEventListener("abort", () => ac.abort());
  let first = false;
  const timer = setTimeout(() => !first && ac.abort(), 12000);
  try {
    const r = await fetch("/api/nova/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nova-session": SESSION },
      body: JSON.stringify({ message, missionId: mission, context: currentContext, memory: explorerMemory(), spoken, history: history.slice(-6).map((h) => ({ role: h.role, text: scrub(h.text) })) }),
      signal: ac.signal,
    });
    if (!r.ok || !r.body) throw new Error(String(r.status));
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let meta: Answer = { kind: "answer", text: "" };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!raw) continue;
        const ev = JSON.parse(raw) as { type: string; kind?: AnswerKind; lineId?: string; chip?: string; t?: string };
        if (ev.type === "heard" && ev.t) onHeard?.(ev.t);
        if (ev.type === "meta") meta = { kind: ev.kind ?? "answer", text: "", lineId: ev.lineId, chip: ev.chip };
        if (ev.type === "text" && ev.t) {
          first = true;
          meta.text += ev.t;
          onText(ev.t);
        }
      }
    }
    clearTimeout(timer);
    if (!meta.text.trim()) return meta.kind === "answer" || meta.kind === "fallback" ? local() : { ...meta, text: line(meta.lineId ?? "chat-unsure")?.text ?? "" };
    return meta;
  } catch {
    clearTimeout(timer);
    if (signal?.aborted) return { kind: "fallback", text: "" };
    const l = local();
    if (l.kind === "fallback" && !first) return { kind: "fallback", text: line("chat-slow").text, lineId: "chat-slow" };
    return l;
  }
}

/** quick small-talk replies (no network): the kid's answer to "How are you today?" */
export function moodReply(t: string): string {
  const s = t.toLowerCase();
  if (isDistress(t)) return "safety";
  if (/\b(great|good|awesome|amazing|happy|fine|excited|super|cool|well)\b/.test(s)) return "mood-great";
  if (/\b(tired|sleepy|sad|bad|bored|sick|not good|meh|upset)\b/.test(s)) return "mood-tired";
  if (/\b(ok|okay|alright|so-so|so so|not bad)\b/.test(s)) return "mood-okay";
  return "mood-other";
}
