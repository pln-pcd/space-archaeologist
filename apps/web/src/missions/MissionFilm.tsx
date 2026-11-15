// The same ten-shot film engine and camera rigs, scheduled by mission JSON and local narration.
import { useMemo } from "react";
import StoryFilm from "../story/odyssey/StoryFilm";
import { MoonStoryWorld } from "../story/odyssey/MoonStory";
import { build, type ShotDef } from "../story/odyssey/storyline";
import type { FilmClock } from "../story/odyssey/stage";
import type { Line as CaptionLine } from "../story/ch1/flow";
import type { MissionDefinition } from "./types";

const manifests = import.meta.glob(
  "../../public/audio/vo/missions/*/manifest.json",
  { eager: true, import: "default" },
) as Record<string, Record<string, { text: string; duration: number }>>;
export default function MissionFilm({
  mission,
  onDone,
}: {
  mission: MissionDefinition;
  onDone: () => void;
}) {
  const film = useMemo(() => {
    const manifest =
      Object.entries(manifests).find(([path]) =>
        path.includes(`/${mission.meta.id}/`),
      )?.[1] ?? {};
    const captions: Record<string, CaptionLine> = {},
      durations: Record<string, number> = {};
    const shots: ShotDef[] = mission.storyShots.map((shot, i) => ({
      id: shot.cameraRef,
      // v7.1: one soft dream dissolve between every shot (no sliding wipes)
      seam: i === 0 ? "cut" : "wipe",
      lines: shot.lines.map((line, n) => {
        const id = `${shot.id}-${n}`,
          recording = manifest[id];
        if (!recording || recording.text !== line.text)
          throw new Error(`Prepare local narration: ${mission.meta.id}/${id}`);
        captions[id] = {
          id,
          text: line.text,
          type: line.kind,
          speaker: "narrator",
          sourceIds: line.kind === "fact" ? [line.sourceId] : undefined,
          audio: `/audio/vo/missions/${mission.meta.id}/${id}.wav`,
        };
        durations[id] = recording.duration;
        return id;
      }),
    }));
    const story = build(`mission-${mission.meta.id}`, shots, durations);
    const World = ({ clock }: { clock: FilmClock }) => (
      <MoonStoryWorld clock={clock} story={story} />
    );
    return { story, World, resolve: (id: string) => captions[id] };
  }, [mission]);
  return (
    <StoryFilm
      {...film}
      voiceDir={`missions/${mission.meta.id}`}
      onDone={onDone}
    />
  );
}
