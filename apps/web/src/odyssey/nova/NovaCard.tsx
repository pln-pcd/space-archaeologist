// Nova's speech box for scripted moments (dashboard greeting, tutorial hand-off, check-ins), built from
// the design kit (v4.6 §9): a cream DialogueBox with the sky-blue Nova badge, karaoke word highlight
// while he speaks, ≤ 3 lines a page (paginates, never shrinks), Replay, quick-reply chips, and (when a
// script asks) a text field + Send + the mic. The kid's last answer shows in their own bubble with
// their avatar. The free Ask Nova chat lives in Conversation.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send, Volume2 } from "lucide-react";
import { useStore } from "../../store";
import { pickChip, replay, say, submitText, useTalk } from "./talk";
import { listen, stopListening, useEars } from "./ears";
import { useVoiceMode } from "./voice";
import { nova } from "./state";
import { MAX_CHARS } from "./brain";
import { Avatar, Button, ChatBubble, DialogueBox } from "../ui/kit";
import "../ui/talk.css";

const LINE = 44;
const PER_PAGE = 3;

/** wrap into ≤ 44-character lines, 3 lines per page */
export function paginate(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  words.forEach((w, i) => {
    if (cur.length && len + 1 + w.length > LINE) {
      lines.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += (cur.length > 1 ? 1 : 0) + w.length;
  });
  if (cur.length) lines.push(cur);
  const pages: number[][] = [];
  for (let i = 0; i < lines.length; i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE).flat());
  return { words, pages: pages.length ? pages : [[]] };
}

/** Nova's current words with the spoken one highlighted (shared by the card and the conversation) */
export function KaraokeLine({ className = "k-line" }: { className?: string }) {
  const msg = useTalk((t) => t.msg);
  const { words, pages } = useMemo(() => paginate(msg?.text ?? ""), [msg?.text]);
  const at = msg ? Math.min(words.length - 1, Math.floor(msg.progress * words.length)) : -1;
  const speaking = !!msg && msg.progress > 0 && msg.progress < 1;
  const page = Math.max(0, pages.findIndex((p) => p.includes(at)));
  const shown = pages[page] ?? [];
  return (
    <p className={`${className} k-karaoke`}>
      {shown.map((i) => (
        <span key={i} className={speaking && i === at ? "now" : i < at || !speaking ? "said" : ""}>
          {words[i]}{" "}
        </span>
      ))}
      {pages.length > 1 && (
        <span className="k-page" aria-hidden="true">
          {page + 1}/{pages.length}
        </span>
      )}
    </p>
  );
}

export function MicButton({ onText, big = false }: { onText: (t: string) => void; big?: boolean }) {
  const ears = useEars();
  const held = useRef(0);
  useEffect(() => {
    if (ears.state === "listening") (nova.act("cup"), nova.feel("listening"));
    else if (ears.state !== "loading") nova.act("none");
  }, [ears.state]);
  const go = async () => {
    if (ears.state === "listening") return stopListening();
    if (ears.state === "loading" || ears.state === "working") return;
    const text = await listen();
    if (text) onText(text);
    else if (useEars.getState().state === "idle") void say("chat-heard-nothing", { feel: "curious" });
  };
  return (
    <button
      type="button"
      className={`k-mic od-free ${big ? "big" : ""} ${ears.state}`}
      style={{ ["--lvl" as string]: ears.level.toFixed(2) }}
      aria-pressed={ears.state === "listening"}
      aria-label={ears.state === "listening" ? "Stop listening" : "Talk to Nova"}
      onClick={() => {
        if (Date.now() - held.current < 500) return;
        void go();
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        held.current = Date.now();
        void go();
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "touch" && Date.now() - held.current > 500) stopListening();
      }}
    >
      <span className="k-mic-rings" aria-hidden="true">
        <i />
        <i />
      </span>
      <Mic size={big ? 48 : 30} strokeWidth={2.3} />
    </button>
  );
}

export default function NovaCard({ compact = false }: { compact?: boolean; askButton?: boolean }) {
  const { msg, user, chips, input, thinking, chatting } = useTalk();
  const settings = useStore((s) => s.settings);
  const profile = useStore((s) => s.profile);
  const ears = useEars();
  const simple = useVoiceMode((v) => v.simple);
  const [draft, setDraft] = useState("");
  const voice = settings.talkMode === "voice" && settings.mic !== false;
  const send = (t = draft) => {
    if (!t.trim()) return;
    submitText(t.slice(0, MAX_CHARS));
    setDraft("");
  };
  if (!msg && !chips.length) return null;
  return (
    <div className={`od-talk ${compact ? "compact" : ""}`} data-glove-ignore>
      {user && !chatting && (
        <ChatBubble side="kid" name={profile?.playerName} avatar={<Avatar id={profile?.characterId ?? "star"} size={48} />}>
          {user}
        </ChatBubble>
      )}
      <DialogueBox
        speaker="Nova"
        className="od-nova-card"
        aria-live="polite"
        aria-label="Nova says"
        tools={
          msg && !thinking ? (
            <Button size="sm" className="k-replay" onClick={replay} aria-label="Replay what Nova said" icon={<Volume2 size={22} aria-hidden="true" />} quiet>
              Replay
            </Button>
          ) : null
        }
      >
        {thinking ? (
          <p className="k-line k-dots" aria-label="Nova is thinking">
            <i />
            <i />
            <i />
          </p>
        ) : (
          <KaraokeLine />
        )}
        {chips.length > 0 && (
          <div className="k-tools">
            {chips.length > 0 && (
              <div className="k-chips k-stagger" role="group" aria-label="Answers">
                {chips.map((c) => (
                  <Button key={c.label} size="sm" variant={c.primary ? "primary" : "secondary"} onClick={() => pickChip(c)}>
                    {c.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        {input && (
          <form
            className="k-ask-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input className="k-input od-free" type="text" value={draft} maxLength={MAX_CHARS} placeholder="Type your answer…" aria-label="Type your answer to Nova" onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()} icon={<Send size={22} aria-hidden="true" />}>
              Send
            </Button>
            {voice && <MicButton onText={(t) => send(t)} />}
          </form>
        )}
        {ears.state === "loading" && <p className="k-small">Getting Nova's ears ready… {Math.round(ears.progress)}%</p>}
        {ears.state === "denied" && <p className="k-small">The microphone is off. You can type instead!</p>}
        {ears.state === "unavailable" && <p className="k-small">Talking isn't ready on this computer. Let's type!</p>}
        {simple && <p className="k-small">Nova's voice is in simple mode.</p>}
      </DialogueBox>
    </div>
  );
}
