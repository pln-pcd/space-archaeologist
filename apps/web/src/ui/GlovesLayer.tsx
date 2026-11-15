// Mounts the Star Gloves experience: input picker → camera consent → Glove Academy on first
// launch, the glove avatar, Hand Coach, keyboard cursor ring and the F9 debug overlay.
import { useEffect, useRef, useState } from "react";
import { intents, useIntent } from "../input/bus";
import { gloves } from "../input/engine";
import { useShallow } from "zustand/react/shallow";
import { useInput } from "../input/store";
import CameraConsent from "./CameraConsent";
import DebugOverlay from "./DebugOverlay";
import GloveAcademy from "./GloveAcademy";
import GloveAvatar from "./GloveAvatar";
import HandCoach from "./HandCoach";
import InputPicker from "./InputPicker";
import "./gloves.css";

export function openAcademy() {
  useInput.getState().set({ overlay: "academy" });
}

function KeyboardCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useIntent("pointer", (e) => {
    if (e.source !== "keyboard") return;
    setOn(true);
    if (ref.current) ref.current.style.transform = `translate(${e.x}px, ${e.y}px)`;
  });
  useEffect(() => intents.subscribeScope(() => setOn(false)), []);
  if (!on) return <div ref={ref} hidden />;
  return <div ref={ref} className="kb-cursor" data-glove-ignore aria-hidden="true" />;
}

export default function GlovesLayer({ firstRun = true }: { firstRun?: boolean }) {
  // narrow selectors: the store also holds 4 Hz tracker stats, which must not re-render this layer
  const { mode, consented, academyDone, overlay, set, debug } = useInput(useShallow((s) => ({ mode: s.mode, consented: s.consented, academyDone: s.academyDone, overlay: s.overlay, set: s.set, debug: s.debug })));

  // first launch: pick an input (normally done in onboarding). No Glove Academy visit: hand
  // practice now lives in each mini-game's camera check (bible §5).
  // new flow: the game only needs clicks and taps outside the mini-games, so the device is detected
  // automatically (no picker on the cover); hands are offered in each mini-game's camera check
  useEffect(() => {
    if (!firstRun || overlay) return;
    if (mode === null) set({ mode: matchMedia("(pointer: coarse)").matches ? "touch" : "mouse" });
  }, [firstRun, mode, overlay, set]);
  void academyDone;

  // Star Gloves wake only in post-story mini-games (bible §5.2); everywhere else the camera is
  // off and the recognizer is disposed. A short grace period keeps it on between two mini-game
  // screens (camera check → game) so there is no flicker and no re-ask.
  const wanted = useInput((s) => s.handScenes > 0);
  useEffect(() => {
    if (mode !== "gloves") {
      gloves.stop(true);
      return;
    }
    if (!wanted) {
      const t = setTimeout(() => useInput.getState().handScenes === 0 && gloves.stop(true), 1500);
      return () => clearTimeout(t);
    }
    // the mini-game's own camera check asks for consent; never pop a consent screen here
    if (!consented) return;
    // ?inject: tests feed landmark frames directly, so leave the camera off
    if (new URLSearchParams(location.search).has("inject")) return;
    // The chapter's camera check owns denial/error fallback; a second consent overlay traps it.
    if (!gloves.isRunning) gloves.start().catch(() => set({ overlay: null }));
  }, [mode, consented, wanted]); // eslint-disable-line react-hooks/exhaustive-deps

  // F9 toggles the debug overlay
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        useInput.getState().set({ debug: !useInput.getState().debug });
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  return (
    <>
      {overlay === "picker" && <InputPicker onPicked={(m) => set({ overlay: m === "gloves" ? "consent" : academyDone ? null : "academy" })} />}
      {overlay === "consent" && <CameraConsent onDone={() => set({ overlay: academyDone ? null : "academy" })} />}
      {overlay === "academy" && <GloveAcademy onClose={() => set({ overlay: null })} />}
      <GloveAvatar />
      <HandCoach />
      <KeyboardCursor />
      {debug && <DebugOverlay />}
    </>
  );
}
