// FIRST VISIT: HOW DO YOU WANT TO TALK WITH ME? (v4.6 §2). A cute pop-up card from Nova with two big
// choices. Voice → a friendly pre-permission card, then getUserMedia from THAT click. Allowed → voice
// mode (the dashboard then shows "Tap Nova to start talking!" with a pointing hand and a glow ring).
// Denied / no mic → chat mode with a gentle "No problem! Let's type instead." (no error tone).
// The choice is saved in the local settings (localStorage) and can be changed in Settings.
import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic } from "lucide-react";
import { useStore } from "../../store";
import { requestMic, warmEars } from "../nova/ears";
import { say } from "../nova/talk";
import { nova } from "../nova/state";
import { stopSpeaking } from "../nova/voice";
import { Button, Card, SpeakerBadge } from "../ui/kit";
import { play } from "../../audio/sfx";

type Step = "choose" | "permission" | "asking" | "denied";

export default function TalkChoice({ onDone }: { onDone: (mode: "voice" | "chat") => void }) {
  const configure = useStore((s) => s.configure);
  const [step, setStep] = useState<Step>("choose");
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nova.feel("curious");
    void say("talk-ask", { feel: "curious", act: "wave" });
    setTimeout(() => first.current?.focus({ preventScroll: true }), 300);
    return () => stopSpeaking();
  }, []);

  const chat = (spoken = true) => {
    configure({ talkMode: "chat" });
    if (spoken) void say("talk-chat", { feel: "happy", act: "thumbs" });
    onDone("chat");
  };
  const askMic = async () => {
    setStep("asking");
    stopSpeaking();
    const ok = await requestMic();
    if (ok) {
      configure({ talkMode: "voice", mic: true });
      warmEars();
      play("chime", 1.2, 0.5);
      onDone("voice");
    } else {
      setStep("denied");
      nova.feel("happy");
      await say("talk-fallback", { feel: "happy", act: "thumbs" });
    }
  };

  return (
    <div className="k-scrim od-onboard od-free" role="dialog" aria-modal="true" aria-label="How do you want to talk with Nova?">
      {step === "choose" && (
        <Card starred stitched className="ob-card">
          <SpeakerBadge name="Nova" />
          <h2>How do you want to talk with me?</h2>
          <div className="ob-choices k-stagger">
            <button ref={first} type="button" className="ob-choice od-free" onClick={() => (play("pop", 1.1, 0.6), setStep("permission"), void say("talk-voice-perm", { feel: "happy" }))}>
              <span className="ob-icon sky">
                <Mic size={46} strokeWidth={2.4} />
              </span>
              <strong>Talk with my voice</strong>
              <small>Use the microphone</small>
            </button>
            <button type="button" className="ob-choice od-free" onClick={() => (play("pop", 1.1, 0.6), chat())}>
              <span className="ob-icon sage">
                <Keyboard size={46} strokeWidth={2.4} />
              </span>
              <strong>Type to chat</strong>
              <small>Use the keyboard</small>
            </button>
          </div>
        </Card>
      )}
      {(step === "permission" || step === "asking") && (
        <Card stitched className="ob-card">
          <SpeakerBadge name="Nova" />
          <div className="ob-mic-art" aria-hidden="true">
            <Mic size={58} strokeWidth={2.2} />
          </div>
          <h2>Can I hear you?</h2>
          <p>I need to hear you through the microphone. A grown-up can help you say yes!</p>
          <p className="k-small">Your voice turns into words right here on this computer. It is never recorded or sent anywhere.</p>
          <div className="k-row ob-actions">
            <Button variant="primary" size="lg" onClick={() => void askMic()} disabled={step === "asking"} icon={<Mic size={28} aria-hidden="true" />} autoFocus>
              {step === "asking" ? "Waiting…" : "Yes, use the mic"}
            </Button>
            <Button variant="secondary" onClick={() => chat()}>
              Type instead
            </Button>
          </div>
        </Card>
      )}
      {step === "denied" && (
        <Card stitched className="ob-card">
          <SpeakerBadge name="Nova" />
          <div className="ob-mic-art sage" aria-hidden="true">
            <Keyboard size={58} strokeWidth={2.2} />
          </div>
          <h2>No problem!</h2>
          <p>Let's type instead. You can turn on the mic later in Settings.</p>
          <div className="k-row ob-actions">
            <Button variant="primary" size="lg" onClick={() => chat(false)} autoFocus>
              Okay!
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
