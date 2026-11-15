import { audio } from "../../audio/engine";
import { useStore } from "../../store";
import type { Line } from "../ch1/flow";
import type { Speech } from "../ch1/voice";

export type SpokenLine = Line & { fallback?: string };
/** Captions and files share the exact same local-name fallback. Names never enter requests. */
export function contentVoice(folder: string, resolve: (id: string) => SpokenLine) {
  let durations: Record<string, number> = {};
  let loading: Promise<void> | undefined;
  const load = () => loading ??= fetch(`/audio/vo/${folder}/durations.json`).then(r => r.ok ? r.json() : {lines:{}}).then((j: {lines?:Record<string,number>}) => { durations = j.lines ?? {}; }).catch(() => {});
  const say = (id: string): Speech => {
    const l = resolve(id);
    const text = l?.fallback ?? l?.text ?? "";
    const p = useStore.getState().profile;
    const kid = p?.characterId ?? "maya";
    const ids = ["maya", "leo", "amara", "migo"];
    const at = ids.indexOf(kid);
    const character = l?.speaker === "player" ? kid : l?.speaker === "seeker" ? ids[(at + 1) % 4] : l?.speaker === "friend1" ? ids[(at + 2) % 4] : l?.speaker === "friend2" ? ids[(at + 3) % 4] : null;
    const key = character ? `ending/${character}/${id}` : id;
    let el: HTMLAudioElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false, paused = false, since = performance.now();
    let left = (durations[key] ?? Math.max(1.8, text.split(/\s+/).length * .43 + .65)) * 1000;
    let done!: () => void;
    const promise = new Promise<void>(r => { done = r; });
    const stop = () => { if (settled) return; settled = true; clearTimeout(timer); el?.pause(); audio.setDuck(false); done(); };
    const arm = () => { since = performance.now(); timer = setTimeout(stop, left + 250); };
    const settings = useStore.getState().settings;
    // Only request a file in the rendered manifest, keeping offline fallback silent and error-free.
    const openFile = () => { if (settled || !settings.sound || !durations[key] || !l.vo) return;
      el = new Audio(character ? `/audio/vo/ending/${character}/${id}.mp3` : `/audio/vo/${folder}/${id}.mp3`);
      el.volume = (settings.volumes?.voice ?? .9) * (settings.volumes?.master ?? .8);
      el.onended = stop; el.onerror = () => { el = undefined; };
      el.onloadedmetadata = () => { if (!settled && el && Number.isFinite(el.duration)) { left = el.duration * 1000; clearTimeout(timer); if (!paused) arm(); } };
      audio.setDuck(true); if(!paused) void el.play().catch(() => {});
    };
    void load().then(openFile);
    arm();
    return { done: promise, stop, pause: () => { if (settled || paused) return; paused = true; el?.pause(); clearTimeout(timer); left = Math.max(0, left - (performance.now() - since)); }, resume: () => { if (settled || !paused) return; paused = false; void el?.play().catch(() => {}); arm(); } };
  };
  return { load, say, caption: (id: string) => { const l = resolve(id); return l ? { ...l, text: l.fallback ?? l.text } : l; } };
}
