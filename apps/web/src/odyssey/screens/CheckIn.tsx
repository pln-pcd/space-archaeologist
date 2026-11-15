// NOVA CHECK-IN (new-flow prompt §8c): right after each story, Nova pops in from the side with a
// thruster puff. The story's last frame stays softly in the background (dimmed 20 %).
// 1 How was it?  2 Did you learn something? (+ one fun fact)  3 Any questions? (mission-scoped chat)
// 4 Ready for a mini-game? → mini-game, or back to the story.
import { useEffect, useState } from "react";
import NovaStage from "../nova/NovaStage";
import NovaCard from "../nova/NovaCard";
import { askNova, choose, ownChat, resetTalk, say, suggestions, useTalk } from "../nova/talk";
import { isDistress } from "../nova/brain";
import { prefetchClips, stopSpeaking } from "../nova/voice";
import { nova } from "../nova/state";

export default function CheckIn({ mission, backdrop, onPlay, onStory }: { mission: "eagle" | "opportunity"; backdrop: string; onPlay: () => void; onStory: () => void }) {
  const [from] = useState<"left" | "right">(mission === "eagle" ? "right" : "left");
  useEffect(() => {
    let alive = true;
    resetTalk();
    ownChat(true);
    prefetchClips(["check-awesome", "check-okay", "check-learn", "check-learn-yes", "check-learn-little", `fact-${mission}`, "check-questions", "check-ask", "check-more", "check-play", "check-story"]);
    const run = async () => {
      await new Promise((r) => setTimeout(r, 800));
      if (!alive) return;
      // 1. how was it?
      await say("check-how", { feel: "excited", act: "wave" });
      const a = await choose(
        [
          { label: "It was awesome!", value: "awesome" },
          { label: "It was okay", value: "okay" },
        ],
        { input: true },
      );
      if (!alive) return;
      useTalk.setState({ input: false });
      if (a.free && isDistress(a.value)) {
        await say("safety", { feel: "sorry" });
        await say("safety-2", { feel: "happy" });
      } else if (a.free) await say(/awesome|great|good|fun|cool|love|amazing|best/i.test(a.value) ? "check-awesome" : "check-other", { feel: "happy", act: "thumbs" });
      else await say(a.value === "awesome" ? "check-awesome" : "check-okay", { feel: a.value === "awesome" ? "excited" : "happy", act: a.value === "awesome" ? "spin" : "none" });
      // 2. did you learn something? + one fun fact
      await say("check-learn", { feel: "curious" });
      const b = await choose([
        { label: "Yes!", value: "yes" },
        { label: "A little", value: "little" },
      ]);
      if (!alive) return;
      await say(b.value === "yes" ? "check-learn-yes" : "check-learn-little", { feel: "excited", act: b.value === "yes" ? "jump" : "thumbs" });
      await say(`fact-${mission}`, { feel: "excited" });
      // 3. questions?
      await say("check-questions", { feel: "curious" });
      const c = await choose([
        { label: "Yes, I have a question", value: "yes" },
        { label: "No questions", value: "no" },
      ]);
      if (!alive) return;
      if (c.value === "yes") {
        useTalk.setState({ chatting: true, input: true, mission });
        await say("check-ask", { feel: "happy" });
        for (;;) {
          const q = await choose(suggestions(mission), { input: true });
          if (!alive) return;
          await askNova(q.value);
          if (!alive) return;
          await say("check-more", { feel: "curious" });
          const more = await choose([
            { label: "Ask another", value: "more" },
            { label: "I'm done", value: "done" },
          ]);
          if (!alive) return;
          if (more.value === "done") break;
        }
        useTalk.setState({ chatting: false, input: false });
      }
      // 4. ready for a mini-game?
      await say("check-play", { feel: "excited" });
      const d = await choose([
        { label: "Yes, let's play!", value: "play", primary: true },
        { label: "Back to the story", value: "story" },
      ]);
      if (!alive) return;
      stopSpeaking();
      if (d.value === "play") {
        nova.act("thumbs");
        onPlay();
      } else {
        await say("check-story", { feel: "happy" });
        onStory();
      }
    };
    void run();
    return () => {
      alive = false;
      stopSpeaking();
      resetTalk();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`od-checkin ${mission}`}>
      <div className="od-backdrop" style={{ backgroundImage: `url(${backdrop})` }} aria-hidden="true" />
      <NovaStage frame="full" className={`od-checkin-nova from-${from}`} enter={from} float />
      <NovaCard />
    </div>
  );
}
