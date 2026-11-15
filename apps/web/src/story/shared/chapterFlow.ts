import { create } from "zustand";
import { useStore } from "../../store";

/** Both missions share ordering, URL selection, resumable saves and camera/result state. */
export function chapterFlow<S extends string, R>(id: string, scenes: readonly S[], letters: Record<string, S>, initial: S) {
  const results = scenes.indexOf("RESULTS" as S);
  const useFlow = create<{ scene: S; camera: boolean; result: R | null; go: (s: S) => void; set: (p: { camera?: boolean; result?: R | null }) => void }>((set) => ({
    scene: initial, camera: false, result: null,
    go: (scene) => {
      set({ scene });
      const save = scene === "G_MINIGAME" ? scenes.indexOf("G_CAMERA_CHECK" as S) : scenes.indexOf(scene);
      if (save >= 0 && scene !== "BACK_TO_SHIP") useStore.getState().page(id, save);
    },
    set: (p) => {set(p);if(p.result!==undefined)useStore.getState().saveSceneResult(id,p.result);},
  }));
  return {
    useFlow,
    startScene: (saved = 0): S => {
      const q = new URLSearchParams(location.search).get("scene")?.toUpperCase();
      const result=useStore.getState().progress.sceneResults?.[id] as R | undefined;
      useFlow.setState({result:result??null,camera:false});
      return q && letters[q] ? letters[q] : scenes[saved] && scenes[saved] !== "BACK_TO_SHIP" ? saved>=results&&!result ? letters.G : scenes[saved] : initial;
    },
    next: (from: S) => scenes[Math.min(scenes.length - 1, scenes.indexOf(from) + 1)],
  };
}
