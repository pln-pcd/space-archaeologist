// The conversation controller: one Nova card for the whole game. Scripts call say() / choose();
// the Ask Nova chat calls askNova(). Every Nova line is shown AND spoken (voice.ts), Nova's
// expression and gestures follow what he's doing (state.ts).
import { create } from "zustand";
import { explorerName, useStore } from "../../store";
import { ask, CHIPS, line, REDIRECTS, type MissionId, type Turn } from "./brain";
import { prefetchClips, speak, speechStream, stopSpeaking } from "./voice";
import { nova, type Expression, type Gesture } from "./state";

export type Chip = { label: string; value: string; primary?: boolean };
export type NovaMsg = { key: number; text: string; lineId?: string; lead?: string; progress: number; kind?: string };

type Talk = {
  msg: NovaMsg | null;
  user: string | null;
  chips: Chip[];
  /** the text box + mic are available */
  input: boolean;
  thinking: boolean;
  listening: boolean;
  mission: MissionId;
  /** the chat is open (Ask Nova) */
  chatting: boolean;
  history: Turn[];
  /** this session's conversation, shown as bubbles (memory only: never saved, never sent) */
  log: { id: number; side: "nova" | "kid"; text: string }[];
};
export const useTalk = create<Talk>(() => ({ msg: null, user: null, chips: [], input: false, thinking: false, listening: false, mission: null, chatting: false, history: [], log: [] }));
let logId = 0;
const logLine = (side: "nova" | "kid", text: string) => {
  if (!useTalk.getState().chatting || !text.trim()) return;
  useTalk.setState((s) => ({ log: [...s.log, { id: ++logId, side, text }].slice(-30) }));
};

if (import.meta.env.DEV) (window as unknown as { __talk: typeof useTalk }).__talk = useTalk;
let seq = 0;
/** the message number right after the kid's last answer (Nova's reply keeps the bubble) */
let replyTo = -1;
let pick: ((v: { value: string; free: boolean }) => void) | null = null;
/** a script (the check-in) owns the chat: input that arrives while Nova is still talking is kept for it */
let scriptOwned = false;
let queued: { value: string; free: boolean } | null = null;
export function ownChat(on: boolean) {
  scriptOwned = on;
  queued = null;
}

const name = () => explorerName(useStore.getState().profile);
const fill = (s: string) => s.replace(/\{name\}/g, name());

export type SayOpts = { feel?: Expression; act?: Gesture; pointAt?: [number, number]; text?: string; keepUser?: boolean };

/** show + speak a scripted line by id (lead part with the name voiced live and locally) */
export async function say(id: string, o: SayOpts = {}) {
  const l = line(id);
  const body = o.text ?? l?.text ?? "";
  const lead = l?.lead ? fill(l.lead) : "";
  const shown = [lead, body].filter(Boolean).join(" ");
  if (o.feel) nova.feel(o.feel);
  if (o.act) nova.act(o.act, o.pointAt);
  const key = ++seq;
  // the kid's last answer stays above Nova's reply, then clears when Nova moves on
  const user = o.keepUser || replyTo === seq ? useTalk.getState().user : null;
  useTalk.setState({ msg: { key, text: shown, lineId: id, lead, progress: 0 }, user });
  logLine("nova", shown);
  const total = shown.length || 1;
  const prog = (offset: number, len: number) => (k: number) => {
    const m = useTalk.getState().msg;
    if (m?.key === key) useTalk.setState({ msg: { ...m, progress: (offset + k * len) / total } });
  };
  if (lead) await speak(lead, { privateLine: true, onProgress: prog(0, lead.length) }).done;
  if (useTalk.getState().msg?.key !== key) return;
  if (body) await speak(body, { clip: o.text ? undefined : id, onProgress: prog(lead.length + 1, body.length) }).done;
}

/** show free text (an answer) and speak it */
export async function sayText(text: string, kind?: string) {
  const key = ++seq;
  useTalk.setState({ msg: { key, text, progress: 0, kind } });
  logLine("nova", text);
  await speak(text, {
    onProgress: (k) => {
      const m = useTalk.getState().msg;
      if (m?.key === key) useTalk.setState({ msg: { ...m, progress: k } });
    },
  }).done;
}

/** offer chips (and optionally the text box / mic); resolves with the kid's answer */
export function choose(chips: Chip[], o: { input?: boolean } = {}): Promise<{ value: string; free: boolean }> {
  useTalk.setState({ chips, input: !!o.input || useTalk.getState().chatting });
  if (queued) {
    const q = queued;
    queued = null;
    useTalk.setState({ chips: [], input: useTalk.getState().chatting });
    return Promise.resolve(q);
  }
  return new Promise((resolve) => {
    pick = (v) => {
      pick = null;
      useTalk.setState({ chips: [], input: useTalk.getState().chatting });
      resolve(v);
    };
  });
}

/** a chip was pressed */
export function pickChip(c: Chip) {
  stopSpeaking();
  replyTo = seq;
  useTalk.setState({ user: c.label });
  logLine("kid", c.label);
  if (pick) pick({ value: c.value, free: false });
  else if (scriptOwned) queued = { value: c.value, free: false };
  else if (useTalk.getState().chatting) void askNova(c.value);
}

/** typed or spoken text was sent */
export function submitText(text: string) {
  const t = text.trim();
  if (!t) return;
  stopSpeaking();
  replyTo = seq;
  useTalk.setState({ user: t });
  logLine("kid", t);
  if (pick) pick({ value: t, free: true });
  else if (scriptOwned) queued = { value: t, free: true };
  else void askNova(t);
}

/** replay Nova's current message */
export function replay() {
  const m = useTalk.getState().msg;
  if (!m) return;
  if (m.lineId) void say(m.lineId, { text: line(m.lineId)?.lead ? undefined : m.text });
  else void sayText(m.text, m.kind);
}

let chipTurn = 0;
export function suggestions(mission: MissionId): Chip[] {
  // two ideas at a time, rotating so the kid sees new ones
  const all = CHIPS[mission ?? "home"];
  const k = (chipTurn++ * 2) % all.length;
  return [all[k], all[(k + 1) % all.length]].filter((q, i, a) => a.indexOf(q) === i).map((q) => ({ label: q, value: q }));
}

/** open the chat (Ask Nova button, or "Yes, I have a question" in a check-in) */
export async function openChat(mission: MissionId, intro = "chat-open") {
  if (useTalk.getState().chatting) return; // already open (React dev mode mounts effects twice)
  useTalk.setState({ chatting: true, input: true, mission, user: null });
  prefetchClips(["chat-unsure", "chat-offline", "chat-slow", ...REDIRECTS]);
  await say(intro, { feel: "happy", act: "wave" });
  if (useTalk.getState().chatting && !pick) useTalk.setState({ chips: suggestions(mission) });
}
export function closeChat() {
  stopSpeaking();
  useTalk.setState({ chatting: false, input: false, chips: [], thinking: false });
}

let busy = false;
/** one question → Nova's answer (streamed: spoken while it is written) */
export async function askNova(q: string) {
  if (busy) return;
  busy = true;
  const st = useTalk.getState();
  useTalk.setState({ chips: [], thinking: true, user: q });
  nova.feel("thinking");
  const key = ++seq;
  useTalk.setState({ msg: { key, text: "", progress: 0 } });
  const stream = speechStream();
  let shown = "";
  let started = false;
  const ans = await ask(q, st.mission, st.history, (t) => {
    if (!started) {
      started = true;
      useTalk.setState({ thinking: false });
      nova.feel("happy");
    }
    shown += t;
    useTalk.setState({ msg: { key, text: shown, progress: 1 } });
    stream.push(t);
  }, undefined, (heard) => {
    // Nova understood a slightly different question than the microphone wrote down: show it
    useTalk.setState((s) => {
      const log = [...s.log];
      for (let i = log.length - 1; i >= 0; i--) if (log[i].side === "kid") {
        log[i] = { ...log[i], text: heard };
        break;
      }
      return { user: heard, log };
    });
  });
  useTalk.setState({ thinking: false });
  if (!started) {
    stream.stop();
    // canned lines (redirects, safety, fallbacks) use their pre-rendered clips
    if (ans.kind === "safety") {
      await say("safety", { feel: "sorry", keepUser: true });
      await say("safety-2", { feel: "happy", keepUser: true });
    } else if (ans.lineId) {
      await say(ans.lineId, { keepUser: true, feel: ans.kind === "redirect" ? "sorry" : ans.kind === "greeting" ? "excited" : ans.kind === "limit" ? "neutral" : "curious", act: ans.kind === "redirect" ? "shrug" : ans.kind === "greeting" ? "wave" : undefined });
    } else await sayText(ans.text, ans.kind);
  } else {
    logLine("nova", shown);
    stream.end();
    await stream.done;
  }
  const h = [...useTalk.getState().history, { role: "user" as const, text: q }, { role: "assistant" as const, text: ans.text }].slice(-6);
  useTalk.setState({ history: h });
  if (ans.kind === "answer" || ans.kind === "local") nova.act("thumbs");
  nova.feel("happy");
  busy = false;
  const redirectChip = ans.chip ?? (ans.lineId ? line(ans.lineId)?.chip : undefined);
  if (useTalk.getState().chatting && !pick) useTalk.setState({ chips: redirectChip ? [{ label: redirectChip, value: redirectChip }, ...suggestions(st.mission).slice(0, 1)] : suggestions(st.mission) });
}

export function resetTalk() {
  stopSpeaking();
  pick = null;
  scriptOwned = false;
  queued = null;
  busy = false;
  useTalk.setState({ msg: null, user: null, chips: [], input: false, thinking: false, listening: false, chatting: false, history: [], log: [] });
}
