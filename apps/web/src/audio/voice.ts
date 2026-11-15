// Voices (bible §14 MASTER): no babble. Each caption line arrives with one soft tick, and
// "Read to me" reads it aloud with the browser's speech synthesis. Music ducks under speech.
import { useStore } from "../store";
import { audio } from "./engine";
import { play } from "./sfx";

export type Speaker = "nova" | "eagle" | "opportunity" | "ranger";

/** Say a caption: one soft tick; plus real speech when "Read to me" is on. Captions stay on screen. */
export function say(text: string, who: Speaker = "nova") {
  play("tick", 0.9, 0.35);
  const st = useStore.getState().settings;
  if (!st.readAloud || typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = who === "nova" ? 1.1 : who === "eagle" ? 0.9 : 1.0;
  u.volume = st.volumes?.voice ?? 0.9;
  audio.setDuck(true);
  u.onend = () => audio.setDuck(false);
  speechSynthesis.speak(u);
}

export function resetVoices() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
