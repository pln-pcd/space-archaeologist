// The live story film (new-flow prompt §8b). The SAME scene module renders the HyperFrames
// composition (scenes/shared/hfEntry.tsx); here it runs live in the game:
// - the narration clock is master: while a line plays, film time = line start + audio.currentTime
//   (re-synced whenever the drift passes 40 ms); between lines the film runs on the frame clock
// - captions are live HTML cards (never burned in); Pause / Replay line / Skip
// - phones, or a computer that drops under 30 fps, play the pre-rendered 720p film instead
//   (/media/stories/<id>-720.mp4) with the same live narration and captions, if it exists.
import { AdaptiveDpr } from "../../fx/AdaptiveDpr";
import { claimVoice } from "../../audio/voiceBus";
import { warpBusy } from "../../odyssey/fx/Warp";
import { Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Caption, Controls } from "../ch1/ui";
import { audio as mixer } from "../../audio/engine";
import { useStore } from "../../store";
import type { Storyline } from "./storyline";
import type { FilmClock } from "./stage";
import type { Line } from "../ch1/flow";
import moonDurations from "../../../public/audio/vo/ch1/durations.json";
import marsDurations from "../../../public/audio/vo/ch2/durations.json";

async function currentFilm(story: Storyline): Promise<string | null> {
  if(story.id !== "ch1-story" && story.id !== "ch2-story") return null;
  try {
    const meta = await fetch(`/media/stories/${story.id}-720.json`).then((r) => r.json());
    const narration = story.id === "ch1-story" ? moonDurations.lines : marsDurations.lines;
    return meta.narration === JSON.stringify(narration) ? `/media/stories/${story.id}-720.mp4` : null;
  } catch { return null; }
}

type Props = {
  story: Storyline;
  World: ComponentType<{ clock: FilmClock }>;
  voiceDir: string;
  resolve: (id: string) => Line | undefined;
  onDone: () => void;
  skipLabel?: string;
};

export default function StoryFilm({ story, World, voiceDir, resolve, onDone, skipLabel = "Skip the story" }: Props) {
  const clock = useRef({ t: 0 });
  const [paused, setPaused] = useState(false);
  const [lineId, setLineId] = useState<string | undefined>();
  const [video, setVideo] = useState<string | null>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const st = useRef({ audio: null as HTMLAudioElement | null, lineIdx: -1, last: 0, paused: false, done: false, frames: 0, t0: 0 });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const settings = useStore((s) => s.settings);

  // phones get the pre-rendered film when it exists
  useEffect(() => {
    const phone = document.documentElement.dataset.device === "phone";
    if (!phone) return;
    void currentFilm(story).then((src) => src && setVideo(src));
  }, [story.id]);

  const stopLine = () => {
    const a = st.current.audio;
    if (a) {
      a.pause();
      a.src = "";
    }
    st.current.audio = null;
    mixer.setDuck(false);
  };

  const startLine = useCallback(
    (i: number) => {
      stopLine();
      const slot = story.lines[i];
      st.current.lineIdx = i;
      setLineId(slot.id);
      if (settings.sound === false) return;
      const a = new Audio(resolve(slot.id)?.audio ?? `/audio/vo/${voiceDir}/${slot.id}.mp3`);
      a.volume = (settings.volumes?.voice ?? 0.9) * (settings.volumes?.master ?? 0.8);
      st.current.audio = a;
      claimVoice(() => (a.pause(), mixer.setDuck(false)));
      mixer.setDuck(true);
      a.onended = () => {
        if (st.current.audio === a) {
          st.current.audio = null;
          mixer.setDuck(false);
        }
      };
      void a.play().catch(() => (st.current.audio = null));
    },
    [story, voiceDir, settings.sound, settings.volumes],
  );

  useEffect(() => {
    let raf = 0;
    st.current.last = performance.now();
    st.current.t0 = performance.now();
    const tick = (now: number) => {
      const s = st.current;
      const dt = Math.min(0.1, (now - s.last) / 1000);
      s.last = now;
      // v7.3: hold the film (and its fps check) while the warp transition still covers the screen
      if (warpBusy()) {
        s.t0 = now;
        s.frames = 0;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!s.paused && !s.done) {
        const c = clock.current;
        const a = s.audio;
        const slot = story.lines[s.lineIdx];
        if (a && slot && !a.paused && a.currentTime > 0) {
          // the narration is master: follow it, correcting any drift over 40 ms
          const want = slot.start + a.currentTime;
          c.t = Math.abs(want - c.t) > 0.04 ? want : c.t + dt;
        } else c.t += dt;
        // the next line starts on its slot
        const next = story.lines[s.lineIdx + 1];
        if (next && c.t >= next.start) startLine(s.lineIdx + 1);
        if (c.t >= story.duration) {
          s.done = true;
          stopLine();
          doneRef.current();
        }
        // the pre-rendered film follows the same clock
        const v = vid.current;
        // seek only on a real drift: seeking every few frames flashed a black frame about once a second
        if (v && Math.abs(v.currentTime - c.t) > 0.4) v.currentTime = c.t;
      }
      // a computer that really can't keep up (under 20 fps for 5 s, after any transition) switches to
      // the 720p film; a short dip no longer swaps films mid-story
      s.frames++;
      if (!video && s.frames === 300) {
        const fps = 300 / ((now - s.t0) / 1000);
        if (fps < 20) {
          void currentFilm(story).then((src) => src && setVideo(src));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stopLine();
    };
  }, [story, startLine, video]);

  // dev / QA: seek the film and freeze it (contact sheets, Judge checks)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __story?: unknown }).__story = {
      id: story.id,
      shots: story.shots.map((x) => ({ id: x.id, start: x.start, end: x.end })),
      seek: (t: number) => {
        st.current.paused = true;
        stopLine();
        clock.current.t = t;
        const i = story.lines.findIndex((l) => t >= l.start && t < l.start + l.dur + 0.5);
        setLineId(i >= 0 ? story.lines[i].id : undefined);
      },
    };
  }, [story]);

  const toggle = useCallback(() => {
    const s = st.current;
    s.paused = !s.paused;
    setPaused(s.paused);
    if (s.audio) void (s.paused ? s.audio.pause() : s.audio.play());
    if (vid.current) void (s.paused ? vid.current.pause() : vid.current.play().catch(() => {}));
  }, []);
  const replay = useCallback(() => {
    const s = st.current;
    const i = Math.max(0, s.lineIdx);
    clock.current.t = story.lines[i].start;
    s.paused = false;
    setPaused(false);
    startLine(i);
  }, [story, startLine]);
  const skip = useCallback(() => {
    st.current.done = true;
    stopLine();
    doneRef.current();
  }, []);

  return (
    <div className={`ch1-scene od-story ${story.id}`} data-film={video ? "video" : "live"}>
      {video ? (
        <video ref={vid} className="od-story-video" src={video} muted playsInline autoPlay aria-hidden="true" />
      ) : (
        <Canvas className="od-story-canvas" shadows dpr={[1, 1.5]} camera={{ fov: 42, near: 0.1, far: 900 }} gl={{ antialias: true, toneMapping: THREE.NoToneMapping }} aria-hidden="true">
          <Suspense fallback={null}>
            <World clock={clock} />
            <AdaptiveDpr />
          </Suspense>
        </Canvas>
      )}
      <Caption id={lineId} resolve={resolve as never} />
      <Controls paused={paused} onToggle={toggle} onReplay={replay} onSkip={skip} skipLabel={skipLabel} />
    </div>
  );
}
