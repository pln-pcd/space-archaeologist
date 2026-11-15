import { useEffect, useRef, type ReactNode, type ComponentProps } from "react";
import { Button, Tag, DialogueBox } from "../odyssey/ui/kit";
import { speak, stopSpeaking } from "../odyssey/nova/voice";
import { useIntent, useIntentScope } from "../input/bus";
import { useInteractable } from "../input/aim";
import { command } from "./session";
import type { Line, MissionCommand, MissionDefinition } from "./types";

export const judgeMode = () =>
  new URLSearchParams(location.search).get("judge") === "1";
export function FactText({
  line,
  compact = false,
}: {
  line: Line;
  compact?: boolean;
}) {
  return (
    <span
      className={`m-fact ${compact ? "compact" : ""}`}
      data-source-id={line.kind === "fact" ? line.sourceId : undefined}
    >
      <Tag kind={line.kind === "fact" ? "true" : "imagine"} />
      <span>{line.text}</span>
      {judgeMode() && line.kind === "fact" && (
        <code className="m-source">{line.sourceId}</code>
      )}
    </span>
  );
}
/** The DOM click/touch/keyboard adapter emits; it never changes mission state itself. */
export function Action({
  mission,
  action,
  children,
  ...props
}: {
  mission: MissionDefinition;
  action: MissionCommand;
  children: ReactNode;
} & ComponentProps<typeof Button>) {
  const ref = useRef<HTMLButtonElement>(null);
  useInteractable(ref, { radius: 80 });
  return (
    <Button
      {...props}
      ref={ref}
      data-action={action.type}
      onClick={() => command(mission, action)}
    >
      {children}
    </Button>
  );
}
export function SpokenLine({
  line,
  speaker = "Nova",
}: {
  line: Line;
  speaker?: string;
}) {
  const voiceOptions =
    speaker === "Narrator" ? { voice: "af_heart" as const } : {};
  useEffect(() => {
    const voice = speak(line.text, voiceOptions);
    return voice.stop;
  }, [line.text, speaker]);
  return (
    <DialogueBox
      speaker={speaker}
      speakerKind={speaker === "Nova" ? "nova" : "narrator"}
      tag={line.kind === "fact" ? "true" : "imagine"}
    >
      <p
        className="m-caption"
        data-source-id={line.kind === "fact" ? line.sourceId : undefined}
      >
        {line.text}
      </p>
      {judgeMode() && line.kind === "fact" && <code>{line.sourceId}</code>}
      <Button
        size="sm"
        aria-label="Replay this caption"
        onClick={() => speak(line.text, voiceOptions)}
      >
        Hear again
      </Button>
    </DialogueBox>
  );
}
export function useStepFocus(key: string | number) {
  useEffect(() => {
    document
      .querySelector<HTMLElement>("[data-mission-heading]")
      ?.focus({ preventScroll: true });
  }, [key]);
}
/** Inspection arrows are translated in the adapter, alongside the established +/- and wheel intents. */
export function useInspectionScope(active = true) {
  useIntentScope(
    active ? ["pointer", "pinch", "grab", "dial", "swipe"] : null,
    { walk: false },
    "artifact-inspection",
  );
}
