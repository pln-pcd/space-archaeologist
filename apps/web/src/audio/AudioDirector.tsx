// Ties the audio to the game: the base theme with unlocked layers, ambience beds, and musical
// gesture feedback (bible §14). Mount once inside the game.
import { useEffect } from "react";
import { intents } from "../input/bus";
import { ambience, type Bed } from "./ambience";
import { useTheme, type ThemeName } from "./themes";
import { arpGesture, chordSwell, noteGesture, play } from "./sfx";
import { cute } from "./cute";

export default function AudioDirector({ scene, theme = null }: { scene: "base" | "film" | "chapter" | "overlay" | "mars" | "ending"; theme?: ThemeName | null }) {
  // background music: the screen's song (missions and mini-games can ask for their own)
  useTheme(scene === "film" || scene === "ending" ? null : theme);
  useEffect(() => {
    if (scene === "chapter") return;
    if (scene === "mars") return void ambience.set("mars");
    if (scene === "ending" || scene === "film") return void ambience.set(null);
    ambience.set("base");
  }, [scene]);
  useEffect(() => () => ambience.set(null), []);
  // a tiny "blip" when the pointer moves onto a button (throttled, quiet)
  useEffect(() => {
    let last: Element | null = null;
    let at = 0;
    const f = (e: Event) => {
      const b = (e.target as HTMLElement | null)?.closest?.("button:not(:disabled)");
      if (!b || b === last) return;
      last = b;
      const now = performance.now();
      if (now - at < 70) return;
      at = now;
      cute.hover();
    };
    const out = (e: Event) => {
      if (!(e as PointerEvent).relatedTarget || !(e.target as HTMLElement).closest?.("button")) last = null;
    };
    document.addEventListener("pointerover", f, true);
    document.addEventListener("pointerout", out, true);
    return () => (document.removeEventListener("pointerover", f, true), document.removeEventListener("pointerout", out, true));
  }, []);
  // a short soft click on every button press (0.25 volume)
  useEffect(() => {
    const f = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.("button:not(:disabled)")) cute.pop(0.9 + Math.random() * 0.25);
    };
    document.addEventListener("pointerdown", f, true);
    return () => document.removeEventListener("pointerdown", f, true);
  }, []);

  // musical gestures: every input gets a soft, in-key response
  useEffect(
    () =>
      intents.onAny((e) => {
        switch (e.name) {
          case "pinchStart":
            if (e.source === "gesture") noteGesture();
            break;
          case "wave":
            arpGesture();
            break;
          case "palmHold":
            if ((e as { done?: boolean }).done) chordSwell();
            break;
          case "swipe":
            play("whoosh", 1.1, 0.6);
            break;
          case "push":
            play("portalWhump", 1, 0.7);
            break;
          case "thumbsUp":
            play("sparkle");
            break;
          case "grab":
            if (e.source === "gesture") play("pop", 1, 0.6);
            break;
          case "fistStamp":
            play("stampSlam", 1, 0.5);
            break;
        }
      }),
    [],
  );
  return null;
}
