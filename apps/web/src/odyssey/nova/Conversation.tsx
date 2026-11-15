// CONVERSATION MODE (v4.6 §5): tap Nova, press Ask Nova, or press N. The room softly blurs and dims
// (the dashboard freezes and filters its canvas: no live backdrop-filter), a big Nova bust rises in at
// the lower left with lip sync and expressions, and:
//   voice mode: Nova's words with karaoke highlight + a big mic with pulsing rings and a live waveform
//               ("Tap to talk" → "Listening…" → "Thinking…")
//   chat mode:  Nova's messages on the left, the kid's on the right with their avatar and nickname,
//               a typing indicator, quick-reply chips, a text field and Send
// History is this session only (talk.ts `log`, memory only). Close with X or Esc.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Keyboard, Send, X } from "lucide-react";
import { useStore } from "../../store";
import { closeChat, openChat, pickChip, submitText, useTalk } from "./talk";
import { useEars } from "./ears";
import { stopSpeaking } from "./voice";
import { MAX_CHARS } from "./brain";
import NovaStage from "./NovaStage";
import { KaraokeLine, MicButton } from "./NovaCard";
import { Avatar, Button, Card, ChatBubble, DialogueBox, NovaAvatar } from "../ui/kit";
import { motion } from "../../anim/kit";

function Waveform() {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const x = c.getContext("2d")!;
    const hist = new Array(40).fill(0);
    let raf = 0;
    const draw = () => {
      const { level, state } = useEars.getState();
      hist.push(state === "listening" ? level : 0);
      hist.shift();
      x.clearRect(0, 0, c.width, c.height);
      const w = c.width / hist.length;
      hist.forEach((v, i) => {
        const h = Math.max(4, v * c.height * 0.95);
        x.fillStyle = i > hist.length - 4 ? "#241D48" : "#6D8295";
        x.beginPath();
        x.roundRect(i * w + w * 0.2, (c.height - h) / 2, w * 0.6, h, w * 0.3);
        x.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cv} className="cv-wave" width={320} height={64} aria-hidden="true" />;
}

export default function Conversation({ mode, onClose, mission = null }: { mode: "voice" | "chat"; onClose: () => void; mission?: "eagle" | "opportunity" | null }) {
  const { log, chips, thinking, msg } = useTalk();
  const profile = useStore((s) => s.profile);
  const notice = useStore((s) => !s.settings.aiNotice);
  const configure = useStore((s) => s.configure);
  const ears = useEars((e) => e.state);
  const [m, setMode] = useState(mode);
  const [draft, setDraft] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void openChat(mission);
    const el = root.current;
    if (el && !motion.reduced) {
      gsap.fromTo(el.querySelector(".cv-bust"), { y: 220, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.5)" });
      gsap.fromTo(el.querySelector(".cv-panel"), { y: 40, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.6)", delay: 0.12 });
    }
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: motion.reduced ? "auto" : "smooth" });
  }, [log.length, thinking]);

  const close = () => {
    stopSpeaking();
    const el = root.current;
    const done = () => (closeChat(), onClose());
    if (!el || motion.reduced) return done();
    gsap.to(el.querySelector(".cv-bust"), { y: 240, opacity: 0, duration: 0.35, ease: "power2.in" });
    gsap.to(el.querySelector(".cv-panel"), { y: 30, opacity: 0, duration: 0.3, ease: "power2.in", onComplete: done });
  };
  const send = (t = draft) => {
    if (!t.trim()) return;
    submitText(t.slice(0, MAX_CHARS));
    setDraft("");
  };
  const status = ears === "listening" ? "Listening…" : ears === "working" || thinking ? "Thinking…" : ears === "loading" ? "Getting ready…" : msg && msg.progress > 0 && msg.progress < 1 ? "Nova is talking" : "Tap to talk";
  const lastKid = [...log].reverse().find((l) => l.side === "kid");

  return (
    <div ref={root} className="cv-root od-free" data-mode={m} role="dialog" aria-modal="true" aria-label="Talk with Nova" data-glove-ignore>
      <NovaStage frame="peek" className="cv-bust" float={false} />
      <Button round size="sm" className="cv-close" onClick={close} aria-label="Close the conversation" quiet>
        <X size={30} strokeWidth={2.6} />
      </Button>
      {m === "voice" ? (
        <div className="cv-panel cv-voice">
          {lastKid && (
            <ChatBubble side="kid" name={profile?.playerName} avatar={<Avatar id={profile?.characterId ?? "star"} size={48} />}>
              {lastKid.text}
            </ChatBubble>
          )}
          <DialogueBox speaker="Nova" aria-live="polite" aria-label="Nova says">
            {thinking ? (
              <p className="k-line k-dots" aria-label="Nova is thinking">
                <i />
                <i />
                <i />
              </p>
            ) : (
              <KaraokeLine />
            )}
          </DialogueBox>
          <div className="cv-micbar">
            <MicButton big onText={(t) => send(t)} />
            <div className="cv-status">
              <strong>{status}</strong>
              <Waveform />
            </div>
          </div>
          {chips.length > 0 && (
            <div className="k-chips k-stagger" role="group" aria-label="Ideas to ask">
              {chips.map((c) => (
                <Button key={c.label} size="sm" variant="secondary" onClick={() => pickChip(c)}>
                  {c.label}
                </Button>
              ))}
            </div>
          )}
          <Button size="sm" variant="ghost" className="cv-switch" icon={<Keyboard size={22} aria-hidden="true" />} onClick={() => (setMode("chat"), setTimeout(() => field.current?.focus(), 50))} quiet>
            Type instead
          </Button>
        </div>
      ) : (
        <Card className="cv-panel cv-chat" pop={false}>
          <div className="cv-head">
            <NovaAvatar size={56} />
            <div>
              <strong className="cv-title">Chat with Nova</strong>
              <span className="cv-sub">Ask me about space missions!</span>
            </div>
          </div>
          <div ref={list} className="cv-list od-scroll" aria-live="polite">
            {log.map((l) =>
              l.side === "nova" ? (
                <ChatBubble key={l.id} side="nova" avatar={<NovaAvatar size={40} />}>
                  {l.text}
                </ChatBubble>
              ) : (
                <ChatBubble key={l.id} side="kid" name={profile?.playerName} avatar={<Avatar id={profile?.characterId ?? "star"} size={44} />}>
                  {l.text}
                </ChatBubble>
              ),
            )}
            {thinking && (
              <ChatBubble side="nova" avatar={<NovaAvatar size={40} />}>
                <span className="k-dots" aria-label="Nova is typing">
                  <i />
                  <i />
                  <i />
                </span>
              </ChatBubble>
            )}
          </div>
          {chips.length > 0 && (
            <div className="k-chips cv-chips" role="group" aria-label="Ideas to ask">
              {chips.map((c) => (
                <Button key={c.label} size="sm" variant="lilac" className="cv-chip" onClick={() => pickChip(c)}>
                  {c.label}
                </Button>
              ))}
            </div>
          )}
          <form
            className="k-ask-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input ref={field} className="k-input od-free" type="text" value={draft} maxLength={MAX_CHARS} placeholder="Type, or tap the mic and ask…" aria-label="Type your question for Nova" onChange={(e) => setDraft(e.target.value)} autoFocus={!matchMedia("(pointer: coarse)").matches} />
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()} icon={<Send size={22} aria-hidden="true" />}>
              Send
            </Button>
            {/* v8: the mic is always here: speak your question any time (speech-to-text on this computer) */}
            {useStore.getState().settings.mic !== false && <MicButton onText={(t) => send(t)} />}
          </form>
          <p className="k-small cv-note">Nova is an AI helper and can make mistakes.</p>
        </Card>
      )}
      {notice && (
        <div className="k-scrim cv-notice">
          <Card stitched className="od-notice" role="alertdialog" aria-label="A note for grown-ups">
            <h2>For grown-ups</h2>
            <p>When online, Nova uses Google's Gemini AI to answer space questions. Names and personal details are removed first, and nothing is saved.</p>
            <p>Offline, Nova answers from the game's own NASA fact sheet. Nova can make mistakes: check nasa.gov together.</p>
            <div className="k-row">
              <Button variant="primary" onClick={() => configure({ aiNotice: true })} autoFocus>
                OK
              </Button>
              <Button variant="secondary" onClick={() => configure({ aiNotice: true, askNova: false })}>
                Fact sheet only
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
