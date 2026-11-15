# Decisions

A running log of decisions that are not obvious from the code. Newest first.

## 2026-11-15 · Submission kit and demo video

### Real paths (the docs disagree; these are the real ones)

| What | Real path | Notes |
|---|---|---|
| Verified facts (single source of truth) | `apps/web/src/content/sources.json` (46 sources, all `verified`) | Every fact line lives in `apps/web/src/content/*.json` and `apps/web/src/content/missions/moon-001.json` with `sourceIds` / `sourceId` pointing here. There is no `src/data/facts.json`. |
| Fact report | `docs/ACCURACY_REPORT.md` from `node tools/accuracy_report.mjs` | Regenerated 2026-11-15: **275 facts, 46 sources, 0 problems**. |
| Fact check | `npm run check:facts` (added: `tools/content_warn.mjs` + `tools/accuracy_report.mjs`) | The repo had no `check:facts` script; this is its equivalent. |
| Credits data file | `apps/web/public/media/artifacts/credits.json` (NASA photo credits) and `CREDITS.md` | |
| Game bible | `docs/GAME_DESIGN_BIBLE.md` | There is no `docs/GAME_BIBLE.md` and no `KICKOFF.md`. |
| Challenge | "Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars", https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/ | Copied from the live page on 2026-11-15 (opened without login in Chrome; `curl` and WebFetch fail on this machine's certificate chain). |

### Feature inventory (README features, checked 2026-11-15 on the dev build, 1920x1080)

How checked: **W** = walked in a real browser (Playwright, headless Chrome with GPU) with screenshots in this session; **C** = direct call to the code or API; **T** = automated test; **N** = not checked this session.

| README feature | Status | How checked |
|---|---|---|
| Cover, START, short intro tour, name card, explorer designer | Working | W: full walk; also the `onboarding` footage shot |
| Ship (mission room), Nova greeting, Exit button | Working | W |
| Mission 1 Moon: NASA film, launch lever, flight, arrival film | Working | W + `mission1` shot |
| Moon exploration path (finds, Rock Box, Rebuild, Report, Badge) | Working | W: full mission to "Chapter complete!" (archive 4/4) |
| Every find: dust dig, clue stars, activity, evidence board | Working | W: plaque by hand, all four through the game's own mission commands |
| Rock Box mini-game (mouse) | Working | W |
| Rock Box with hands (Star Gloves) | Working (pipeline) | C: synthetic landmark frames through the real gesture engine boxed 3 of 4 rocks. A real webcam was **not** available on this machine. |
| Mission 2 Mars: Sol Keeper mini-game | Working | W (`?chapter=2&scene=G`) |
| Mission 2 Mars: films, launch, Nova check-in | Not re-walked | N (unchanged since v7.2; not claimed in the video beyond Sol Keeper) |
| Missions 3 to 5 sealed "coming soon" | Working | W |
| Ask Nova by typing | Working | W: "Why is there no wind on the Moon?" answered from a sourced fact |
| Ask Nova by voice (on-device speech-to-text) | Working | W: `novavoice` shot with Chrome's fake microphone |
| Nova's brain: Gemini behind the guard | Working | C: key valid, `gemini-3.5-flash-lite` answers in 1.9 s; one transient timeout seen, the fact sheet answered instead |
| Offline fact sheet | Working | W on the Vercel build (no server there) |
| Nova's voice: Kokoro on this laptop | Working | C: `/api/nova/speak` |
| Optional ElevenLabs voice | Not configured | N (no key; not claimed) |
| Live NASA data: near-Earth asteroids (NeoWs) | Working | C: `server/nova/live.py` returned today's count |
| Live NASA data: space weather (DONKI) | Working | C |
| Live NASA data: Mars weather (Curiosity REMS) | Working | C |
| Live NASA data: Astronomy Picture of the Day | **Partial** | C: NASA's APOD API returned HTTP 500 / timed out on 2026-11-15. Code path exists; not claimed in the video. |
| Settings: sounds, music, Nova voice, mic, AI helper switch, easy font (OpenDyslexic), calm motion, text size, reset | Working | W |
| Captions on every spoken line | Working | W (films, Nova bubbles) |
| `/dev/facts` (every fact with its source) | Working | W |
| Mouse and keyboard everywhere | Working | W + T (Playwright keyboard-only and mouse-only runs) |
| Touch | Not checked | N (desktop scope) |
| `npm run dev:lan` (HTTPS for phones) | Not checked | N (desktop scope) |
| Desktop launcher (`Play Homeward.cmd`, port 8391) | Not checked | N |
| `?judge=1` jump strip | Not checked | N |
| Hosted build | Working | https://space-archaeologist.vercel.app returns 200; Nova runs offline there (no server) |

Bugs found and fixed while checking: a console error in the warp tunnel (negative arc radius), the intro's Back button covering "Skip intro", the "Next game" card stacking vertically, two stale unit tests and a stale e2e spec.

### Task 1: repository and Vercel

- Public repo **pln-pcd/space-archaeologist**, published with one fresh commit (the team asked for a
  clean start with no earlier history). The earlier repos were deleted at the team's request.
- Topics: nasa-space-apps, space-apps-challenge, educational-game, kids, threejs, react-three-fiber,
  webgl, moon, mars, apollo-11, hand-tracking, mediapipe, accessibility, browser-game.
- Vercel: the existing project `space-archaeologist` keeps the same URL
  (https://space-archaeologist.vercel.app); no new project was created. Deploys go out with
  `vercel deploy --prod` of a built `dist/`. The repo's `vercel.json` says framework vite,
  `npm run build`, output `dist`, so a Git-connected build works the same way.
- `vercel git connect` needs a GitHub Login Connection on the Vercel account (a dashboard login),
  so that step is in `docs/submission/private/MY_TASKS.md`.
- Cleanup before publishing: screenshots, QA logs, voice test clips, an old storybook-film project,
  unreachable source files and unused tools were removed; local QA output (`docs/audit/`) is
  git-ignored.

### Video: the creative idea

**A Space Archaeologist field report.** The film is presented as the explorer's own field log:
- each part is a numbered find tag in the game's record-card style ("FIELD REPORT 02 · The problem");
- the transitions are the game's own verbs: **dust brushed away** (the dig) and a **scanner pulse** ring (exploration);
- the progress indicator is the game's mission-path chip bar, relabelled Intro, Problem, Solution, Demo, Features, Impact.

Why this over a generic trailer: the transitions teach the two core mechanics before the demo shows them, the path bar mirrors the step-by-step design judges will see in the HUD, and nothing in the frame is a stock template. Everything visual comes from the game's art direction (bible §12 and `odyssey/ui/game.css`): white cards, indigo ink #241D48, chunky offset shadows, sunny yellow #FFD23F, Lilita One and Fredoka.

Rejected: a mock "news report" framing (reads as a template), and a pure gameplay montage with music (fails the Presentation and Validity questions, which need explanation).

### Video: footage

- Real gameplay only, recorded from the current dev build at 1920x1080 by `video/capture/` with the game in `?capture=1` **stepped mode**: each video frame advances the game by exactly 1/30 s of virtual time (timers, animation frames, CSS animations and media playheads included), so footage is smooth however slow the capture. Test-only and inert in normal play (`tests/capture.test.ts`, `tests/capture.spec.ts`).
- The game logs its own sounds and spoken lines by frame (`capLog` in `fx/capture.ts`), so sound effects in the edit land on the frame the game played them.
- Headless Chrome has no visible pointer, so the recorder logs the mouse path per frame and the edit draws a large cursor from it.
- **Hands are simulated** in the Rock Box, investigation and quiz shots: no webcam on this machine and no recordings in `tools/gesture-recordings/`. Synthetic landmark frames (`tools/gesture_synth.ts`) drive the game's real gesture engine; the frame is labelled "Simulated hand input" on screen. Rule followed: never fake a feature as live.
- The voice question is an adult text-to-speech voice (Space Apps forbids under-18 voices) played into Chrome's fake microphone; the game's real speech-to-text hears it. Labelled on screen.

### Video: sound

- Music and effects are the game's own Tone.js themes (`audio/themes.ts`) and cute effects (`audio/cute.ts`, `audio/sfx.ts`), recorded from the real engine in headless Chrome. This overrides the HyperFrames skill's "no synthesised tones" default because the brief requires JS-generated audio built on the game's code.
- Narration: Kokoro am_puck (Gemini TTS ran out of free daily quota during auditions). Auditions and the pick are below.

### Video: narration voice (auditions in `video/auditions/`, measured in `results.json`)

| Voice | Mean word error (game's own speech-to-text) | Words per minute | AI listening judge (1 to 10) |
|---|---|---|---|
| Kokoro am_puck | 0.025 | 156 | 7.53 |
| Kokoro bm_george | 0.025 | 151 | 7.53 |
| Kokoro bf_emma | 0.025 | 176 | 6.73 |
| Kokoro am_michael | 0.025 | 149 | 5.93 |
| Kokoro af_bella | 0.012 | 156 | 4.73 |
| Gemini TTS Achird (3 lines in one take) | not comparable (take longer than the STT window) | 122 | 8.6 |

- Gemini TTS was the first choice because the key is set, but the free tier allows **10 TTS requests
  per model per day**. The script has 40 lines plus retakes, and my first buggy audition run used up
  one model's quota (it now says retry in about 7 hours).
- Following the brief's fallback ("otherwise the best free voice that suits the game"), the narrator
  is **Kokoro am_puck** (Apache-2.0, already the game's voice engine).
  - It is warm, clear and natural; the judge noted it is "slightly clinical" next to Gemini.
  - An American male voice also contrasts with Nova's own voice (af_heart).
- Nobody could listen during the automated run, so each voice was **measured**: the game's
  speech-to-text checked intelligibility, and a Gemini listening judge scored warmth, clarity,
  confidence, playful energy and naturalness.
- The spoken question in the voice demo is a neutral **adult** text-to-speech voice. Space Apps rules
  forbid voices or likenesses of anyone under 18 in the demo; it is labelled on screen.

### Video: after the v7.6 game changes (investigation and quiz)

- Re-recorded only the shots whose screens changed:
  - `dig2`: the investigation and the evidence quiz;
  - `rockbox`: the glove changed;
  - `novavoice`: newly recorded.
- Every other shot is unchanged gameplay of the same build.
- Re-voiced only the two lines describing those screens: n18 (turn the find, open its parts) and n20
  (the finger-count quiz).
- In `dig2` and `rockbox` the hand is simulated (synthetic landmarks through the real gesture engine;
  there is no webcam on the capture machine), and the frame says so.
- In the voice shot, Chrome's fake microphone plays the question.
  - The game's own speech-to-text heard it, Gemini answered behind the guard, and Nova's real voice
    clips were captured from the game's server.
  - Nova's last sentence finished after the recording stopped, so it was fetched from the same voice
    endpoint with the same text.
- Nova's answer: "Ooh, great question! The Moon is about 385,000 kilometres away from us. Did you
  know it even drifts a little bit further away every single year?" (F10).

### Video: review rounds (comprehension test, strict judge)

- **Comprehension test** (a subagent that only read the transcript and the 2-second frame sheets):
  understood the problem, the solution, the three design reasons and the NASA data. It flagged the
  team placeholder, a cold open that did not match the narration, small labels, a blank frame at
  1:12, a rushed demo, the wait while Nova thinks, and an unreadable facts page. All fixed except the
  team name (only the team knows it).
- **Strict judge, cut 3** (scores 1 to 10): Impact 6, Creativity 7, Validity 6, Relevance 7,
  Presentation 6. Its ranked fixes and what was done:
  1. "Team [TEAM NAME]" placeholder: waiting on the team (MY_TASKS step 1).
  2. Glove shots in the cold open and "Why hands?" were not labelled: both now say "Simulated hand
     input (no webcam)".
  3. Facts page unreadable: zoomed to 2.1x on the fact list.
  4. Nova's thinking wait: covered by the line about on-device speech-to-text (n26b).
  5. Blank frames: removed.
  6. "This is the ship" played over the explorer designer: now a short warp, then the ship.
  7. No brushing shown: the dig beat now shows the brush, not the how-to card.
  8. Mars showed the game grid, not the rover: new shot of Opportunity unfolding and driving
     (chapter 2's roll-off film).
  9. The asteroid answer was used twice: "Why Nova?" now shows a new question, why the laser
     reflector was left on the Moon; the asteroid answer stays only in the live-data beat. The
     capture refuses a take where Gemini timed out and Nova fell back to the offline sheet, so the
     live-data claim is always true of the footage.
  10. Photo caption said "descent stage" over a photo of the whole lander: now "Eagle on the Moon,
     1969".
  - Also: quiz zoomed onto the question card; the NASA film framed so its credit clears the
    captions; slow pushes on static ship and settings shots; watermark 22 px; dims behind text now
    render (a bug dropped them).
- **Accuracy pass of my own**: the "Works offline" chip overclaimed (the service worker caches the
  app shell, not every film), so it now says "Offline fact sheet", which is exactly what the
  narration says. Added "One link to share with a class" (true: one public URL, no accounts).
- Not done: "show real playtest results". There are none, so the video claims none.

### Submission rules found on the official guide (2026-11-15)

- "Submit for Judging" closes Sunday, Nov 15, 11:59 p.m. local event time.
- Watermark on SI-generated images and video.
- Audio and code disclosed in text and metadata.
- No under-18 likeness.
- Space Apps 2026 calls AI "Super Intelligence (SI)". The video keeps the team's requested wording,
  "Made with AI tools"; the forms use the SI term.
