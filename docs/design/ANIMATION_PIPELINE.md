# Animation pipeline: HyperFrames compositions

Everything the player controls stays in the game engine (R3F). Non-interactive animation (the cover
reveal, the two story films) is written ONCE as a deterministic scene module and used twice:

- **live in the game** (computer and tablet): the module runs in a normal `<Canvas>`, driven by the
  game's clock; captions are live HTML cards; the narration is the master clock;
- **as a HyperFrames composition** (`hyperframes/<id>/`): the same module mounted by
  `scenes/shared/hfRuntime.tsx`, rendered to MP4 for phones and for computers that drop under 30 fps.

So the live film and the rendered film are the same pixels from the same code, and the game never has to
"hand off" between them mid-shot.

- HyperFrames 0.8.222 (HeyGen, Apache-2.0): `hyperframes` (CLI), `@hyperframes/core`,
  `@hyperframes/player`, `@hyperframes/shader-transitions`, pinned, installed with `--ignore-scripts`.
  The HyperFrames skills (`hyperframes`, `hyperframes-cli`, local development aids). Telemetry stays **off**
  (`DO_NOT_TRACK=1`); the skills' usage beacon and `usage --json` are not run (account-linked telemetry,
  kids' project).

## Layout

```
hyperframes/
  _shared/vite.config.mjs        builds apps/web/src/scenes/shared/hfEntry.tsx → _shared/dist/scenes.js
  cover-reveal/index.html        5 s: planets drift in, the Starship Odyssey arrives, Nova pops up
  ch1-story/index.html           111.72 s: ten Moon shots (e01–e21)
  ch2-story/index.html           102.32 s: ten Mars shots (m-story-01…18)
apps/web/src/
  scenes/shared/hfRuntime.tsx    mounts an R3F scene in a composition, fixed 1/60 s stepping
  scenes/shared/hfEntry.tsx      the scene registry (id → the game's own module)
  story/odyssey/storyline.ts     the shot schedule, a pure function of the narration durations
  story/odyssey/stage.tsx        camera rig (power2.inOut, then hold), seam veils, dotted 3D diagrams
  story/odyssey/MoonStory.tsx    Chapter 1 story world
  story/odyssey/MarsStory.tsx    Chapter 2 story world
  story/odyssey/StoryFilm.tsx    the live player (audio master clock, captions, pause/replay/skip, MP4 fallback)
apps/web/public/media/stories/<id>-720.mp4   rendered films (muted, H.264, 720p)
```

## The story films (new-flow prompt §8b)

- Ten shots each, the same narration lines, facts and durations as before. `storyline.ts` builds the
  schedule from `public/audio/vo/<ch>/durations.json`: a 1 s lead-in, each line plus a 0.75 s gap, every
  shot at least 5.2 s so it can hold ≥ 2.5 s after its move settles, a 1.6 s tail.
- Camera: one `power2.inOut` move during the first ≤ 45 % of the shot (≤ 2.6 s), then a hold; no cut in
  the middle of a move. The frame is offset upward so the bottom 30 % stays free for the caption card.
- Seams (0.9 s, centred on each cut), drawn in the same WebGL pass as a full-screen veil: a soft painted
  wipe, an iris (closing on the subject, opening on the next shot), a Mars dust swirl, and match cuts
  (no veil). Reduced motion: cuts and final framings only.
  *Why not `@hyperframes/shader-transitions`:* it composites DOM scenes it captures with html2canvas or
  `drawElementImage`; our shots are one continuous WebGL canvas, so the same transition shapes are drawn
  inside the WebGL pass instead (deterministic, and identical live and rendered).
- 3D diagrams inside the shots: the dotted Earth→Moon path, Collins's orbit ring with Columbia, the
  1/6-gravity hop arc, the laser beam to the reflector and back, the ghost water of Mars's ancient sea,
  the power meter and the gust that cleans the panels, the marathon ribbon, the signals from Earth.
- Respect and accuracy: real astronauts stay adult (white suits, gold visors down, no faces); machines
  have no faces; no haze, wind or sound on the Moon (`setWorldLook("moon")` turns the atmosphere off);
  the Moon stays grey under a black sky.
- Live audio clock: while a narration line plays, film time = line start + `audio.currentTime`, re-synced
  whenever the drift passes 40 ms; between lines it runs on the frame clock. Captions are live HTML.
- Phones (or a computer under 30 fps after 3 s) play `/media/stories/<id>-720.mp4` with the same live
  narration and captions; the video is re-seeked to the clock when it drifts more than 40 ms.

## How determinism works

HyperFrames renders frames out of order. `hfRuntime.tsx` creates an R3F root with `frameloop: "never"`,
advances it in fixed 1/60 s steps, and on a backward seek rebuilds a fresh canvas and replays from 0. The
scene modules read time only from the R3F clock (a `useFrame` at priority −1 copies it into the film
clock), use seeded hashes instead of `Math.random`, and no timers.

## Commands

| Command | What it does |
|---|---|
| `npm run cutscene:build` | builds the scene bundle, syncs it and GSAP into every composition |
| `npm run cutscene:lint -- <id>` | `hyperframes lint` + `check --json` |
| `npm run cutscene:snapshot -- <id> [t,…]` | PNG frames + contact sheet → `docs/audit/hyperframes/<id>/` |
| `npm run cutscene:preview -- <id>` | the HyperFrames studio preview |
| `npm run cutscene:render -- <id> [--rm] [--res=720]` | renders, re-encodes muted H.264 +faststart → `public/media/stories/<id>[-rm][-720].mp4` |
| `node tools/story_sheet.mjs <1\|2> [w] [h] [--reduced]` | one still per shot from the LIVE film + contact sheet |
| `node tools/story_last.mjs` | the story's last frame → the Nova check-in backdrop (`public/media/ch<N>/story-last.jpg`) |

## Status

| Composition | Status |
|---|---|
| `cover-reveal` | built, lint 0 errors, snapshot checked; the live cover runs the same module |
| `ch1-story` | built, lint 0 errors, snapshot checked, rendered 720p (111.7 s, 9.6 MB) |
| `ch2-story` | built, lint 0 errors, rendered 720p (102.3 s, 7.8 MB) |
| mission-open transition, trip/landing, Mars roll-off | not compositions yet: the existing engine scenes play them live (open issue) |
| 1080p / reduced-motion renders | not rendered yet (`--rm`, default 1080p); the live film covers both |
