// The scene bundle the HyperFrames compositions load (built by `npm run cutscene:build` into
// hyperframes/_shared/dist/scenes.js and copied into each composition's assets/). Every scene here is
// the game's OWN code: the same Nova, planets, ship, Eagle, rover, outlines and post as the live game.
// The player's name never goes into a composition.
import { useRef } from "react";
import { useFrame, _roots } from "@react-three/fiber";
import { mountComposition, type HFScene, type HFVars } from "./hfRuntime";
import { CoverWorld } from "../../odyssey/screens/Cover";
import { OdysseyPost } from "../../odyssey/Post";
import { OutlineSync } from "../../fx/outline";
import { MoonStoryWorld } from "../../story/odyssey/MoonStory";
import { MarsStoryWorld } from "../../story/odyssey/MarsStory";
import { CH1_STORY, CH2_STORY } from "../../story/odyssey/storyline";

/** a film clock that follows the composition's time (runs before every other frame callback) */
function useFilmClock() {
  const clock = useRef({ t: 0 });
  useFrame((s) => void (clock.current.t = s.clock.elapsedTime), -1);
  return clock;
}

function CoverReveal() {
  return (
    <>
      <CoverWorld reveal />
      <OdysseyPost near={14} far={45} />
      <OutlineSync />
    </>
  );
}
function Ch1Story() {
  const clock = useFilmClock();
  return <MoonStoryWorld clock={clock} />;
}
function Ch2Story() {
  const clock = useFilmClock();
  return <MarsStoryWorld clock={clock} />;
}

export const SCENES: Record<string, { scene: HFScene; duration: number }> = {
  "cover-reveal": { scene: () => <CoverReveal />, duration: 5 },
  "ch1-story": { scene: () => <Ch1Story />, duration: CH1_STORY.duration },
  "ch2-story": { scene: () => <Ch2Story />, duration: CH2_STORY.duration },
};
void (0 as unknown as HFVars);

declare global {
  interface Window {
    __hfComposition?: boolean;
    OdysseyScenes?: { mount: (id: string, container: HTMLElement, vars: HFVars) => ReturnType<typeof mountComposition>; durations: Record<string, number> };
  }
}
window.__hfComposition = true;
(window as unknown as { __r3fRoots: unknown }).__r3fRoots = _roots;
window.OdysseyScenes = {
  mount: (id, container, vars) => {
    const s = SCENES[id];
    if (!s) throw new Error(`unknown scene ${id}`);
    return mountComposition(container, s.scene, vars);
  },
  durations: Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.duration])),
};
