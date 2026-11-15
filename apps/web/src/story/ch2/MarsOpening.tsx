// v8 MARS OPENING inside the mission engine (the same order and film style as the Moon):
//   0 NASA's 2003 plan animation (real footage)  1 the night launch (your lever)
//   2 the cruise to Mars + the airbag landing     3 opening like a flower, first wheel tracks
//   4 the story of Opportunity (narrated film)    → then exploring Meridiani Planum
// Each stage calls onNext when it ends (or is skipped). Mars ambience + the Ch2 voice clips.
import { lazy, useEffect } from "react";
import { beat, line, voice } from "../ch2-mars";
import { SceneVideo } from "../ch1/scenes";
import { ambience } from "../../audio/ambience";
import { MarsLaunchWorld } from "./models";
import { CH2_STORY } from "../odyssey/storyline";
import "../ch1/ch1.css";
import "./mars-ending.css";

const SceneLaunch = lazy(() => import("../ch1/SceneLaunch"));
const Film = lazy(() => import("./Scenes").then((m) => ({ default: m.MarsSequence })));
const StoryFilm = lazy(() => import("../odyssey/StoryFilm"));
const MarsStoryWorld = lazy(() => import("../odyssey/MarsStory").then((m) => ({ default: m.MarsStoryWorld })));

export default function MarsOpening({ stage, onNext }: { stage: number; onNext: () => void }) {
  useEffect(() => {
    void voice.load();
    ambience.set("mars");
    return () => ambience.set(null);
  }, []);
  return (
    <div className="chapter ch1-player ch2-player mars-ending" data-scene={`mars-${stage}`}>
      {stage === 0 && <SceneVideo video={beat("A").video!} title="NASA's plan · June 2003" turn="m-turn" speak={voice.say} resolve={voice.caption} muted onDone={onNext} />}
      {stage === 1 && <SceneLaunch onDone={onNext} mars={{ World: MarsLaunchWorld, resolve: line, speak: voice.say }} />}
      {stage === 2 && <Film part="C" onDone={onNext} />}
      {stage === 3 && <Film part="D" onDone={onNext} />}
      {stage === 4 && <StoryFilm story={CH2_STORY} World={MarsStoryWorld} voiceDir="ch2" resolve={line} onDone={onNext} />}
    </div>
  );
}
