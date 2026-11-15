# Credits

Starship Odyssey (formerly Homeward) is an independent NASA Space Apps Challenge 2026 entry. It is **not endorsed by NASA**. It uses **no NASA insignia ("meatball"), logotype ("worm") or mission patches**.

Rule: every package, repo, model, texture, font, sound and fact source is listed here, in the same commit that adds it.

## 1. Original work

All 3D models, characters, props, layouts and animations are currently original and built procedurally in code (three.js primitives, canvas-painted textures, vertex colours). No third-party models, textures, animation packs or game assets are used yet.

- Ship set, props, storybook pedestals: `apps/web/src/ship/Set.tsx`, `ship/Pedestal.tsx`
- NASA machine models (Eagle, Opportunity, Viking 1, Pioneer 10, Voyager 1): `apps/web/src/ship/Machines.tsx`, simplified from public descriptions and photographs of the real hardware
- Explorer, crew suits, Nova: `apps/web/src/ship/Chubby.tsx`
- Star Glove cursor and glove icons (drawn 2D poses): `apps/web/src/ui/GloveSprite.tsx`
- Base theme "Starship Lullaby" (16-bar arrangement) and in-key UI sounds: `apps/web/src/audio/music.ts`, `audio/sfx.ts`
- Procedural animation: `apps/web/src/anim/kit.ts`
- Stamps, passport, logbook, cards and HUD: original code and SVG (`apps/web/src/story/`, `apps/web/src/ui/`).

Inspiration only (no assets, names, characters or layouts copied): see bible §20.

Visual style inspired by Mistwood Cottage by Amira Deuraseh (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/).
Code adapted under CC BY 4.0:
- `apps/web/src/fx/Steam.tsx`: Procedural noise-scrolling quad plane with Y-axis twist and wind for hot beverage mugs and thermal vents.
- `apps/web/src/fx/MoodLitMaterial.ts`: Sun-direction shading with ~20% mood tint, baked AO support, and dynamic time-of-day uniforms.

(Previous Summer Afternoon visual style superseded and retained under `?style=legacy`).

## 2. Runtime packages (bundled into the game)

| Package | Version | Licence | Use |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | UI |
| three | 0.179.1 | MIT | 3D |
| @react-three/fiber | 9.8.2 | MIT | React renderer for three |
| @react-three/drei | 10.7.9 | MIT | helpers (Html, PerformanceMonitor, …) |
| @react-three/postprocessing | 3.2.2 | MIT | post FX |
| postprocessing | 6.39.6 | Zlib | post FX core |
| gsap | 3.15.0 | GSAP Standard "no charge" licence (gsap.com/standard-license); not OSI | tweens |
| zustand | 5.1.0 | MIT | state |
| lucide-react | 0.468.0 | ISC | icons |
| @mediapipe/tasks-vision | 0.10.35 (pinned; 1.x avoided, see docs/research/gestures.md) | Apache-2.0 | on-device hand tracking (Star Gloves); WASM self-hosted in `apps/web/public/mediapipe/wasm/` by `tools/fetch_mediapipe.mjs` |
| 1eurofilter | 1.3.0 | BSD-3-Clause, © 2019 Inria (Géry Casiez, Alix Giguey) | gesture cursor smoothing (in use since Prompt 2) |
| tone | 15.1.22 | MIT | music, mixing, ambience, voices (in use since Prompt 3: `apps/web/src/audio/`) |
| zzfx | 1.4.0 | MIT | procedural SFX (in use since Prompt 2: `apps/web/src/audio/sfx.ts`) |
| @fontsource/lexend | 5.3.0 | OFL-1.1 | body font |
| @fontsource/fredoka | 5.3.0 | OFL-1.1 | heading font (title face in the new flow) |
| @fontsource/opendyslexic | 5.3.0 | OFL-1.1 | dyslexia-friendly font toggle |
| @fontsource/bigelow-rules | 5.3.0 | OFL-1.1 | Bigelow Rules display font for headings and titles (Mistwood style) |
| @fontsource/roboto-mono | 5.3.0 | OFL-1.1 | Roboto Mono monospace font for UI, body, labels, and technical readouts (Mistwood style) |
| @fontsource/lilita-one | 5.3.0 | OFL-1.1 | cover title and START label; picked on /dev/title |
| @fontsource/baloo-2 | 5.3.0 | OFL-1.1 | title candidate on /dev/title only (v4.6) |
| @fontsource/chewy | 5.3.0 | OFL-1.1 | title candidate on /dev/title only (v4.6) |

| `@fontsource/stylish` 5.3.1 | OFL-1.1 | "Stylish" font (AsiaSoft) for UI and story text (legacy style, retained under `?style=legacy`) |
| `@fontsource/ibm-plex-mono` 5.3.0 | OFL-1.1 | IBM Plex Mono 400/500 for technical text (legacy style, retained under `?style=legacy`) |

## 2.1 Cursors and Icons
- Cursors (`apps/web/public/icons/hand_*.svg`): Kenney Cursor Pack (CC0 1.0 Universal, https://kenney.nl/assets/cursor-pack). Hand open, hand closed/grabbing, and hand pointing SVG vectors.

## 3. Dev tools (not shipped)

| Tool | Version | Licence | Use |
|---|---|---|---|
| vite | 6.4.6 | MIT | dev server and build |
| @rollup/wasm-node (as `rollup` override) | 4.68.2 | MIT | bundler core; WASM build because Windows Application Control blocks the native binary |
| esbuild | 0.25.12 | MIT | transforms |
| @vitejs/plugin-react | 4.7.0 | MIT | React plugin |
| typescript | 5.8.3 | Apache-2.0 | types |
| vitest | 5.1.0 | MIT | small unit tests |
| @playwright/test | 1.65.0 | Apache-2.0 | local screenshots and end-to-end tests (`tests/`) |
| prettier | 3.9.10 | MIT | formatting |
| @types/* | — | MIT | type definitions |
| @gltf-transform/cli | 4.5.1 | MIT | model optimisation |
| HyperFrames | — | Apache-2.0 | film rendering, build-time only |
| FFmpeg 9.0.2 (gyan.dev full build, installed with winget) | — | GPL, external tool, not bundled | film encoding (`npm run videos`), Chapter 1 video and audio cuts |
| @huggingface/transformers | 3.8.1 | Apache-2.0 | on-device speech-to-text (Whisper in a Web Worker); also used once, locally, to find the NASA landing call in the film clip |
| FastAPI, uvicorn, SQLAlchemy, pydantic, PyYAML, numpy, Pillow, pytest, httpx | see requirements.txt | MIT / BSD / HPND / Apache-2.0 | optional v3 backend and tooling |

## 4. Claude Code skills (repo tooling, not shipped)

From github.com/anthropics/skills, Apache-2.0, installed with `npx skills add anthropics/skills` for local development (not part of this repository):
frontend-design, webapp-testing, canvas-design (bundles OFL fonts in `canvas-fonts/`), algorithmic-art.

## 5. Machine-learning models (self-hosted in `apps/web/public/models/`)

**Kokoro-82M** (hexgrad, Apache-2.0), ONNX export `onnx-community/Kokoro-82M-v1.0-ONNX` (q8) from Hugging Face, used at build time only for the Chapter 1 narrator (voice `af_heart`, speed 0.95) and Nova (voice `bf_emma`). Output: `apps/web/public/audio/vo/ch1/*.mp3` (our own text).
**Whisper base.en** (OpenAI, MIT), ONNX export `onnx-community/whisper-base.en`, used once locally to locate and check the landing call in the NASA film clip; not shipped.

Google MediaPipe models, Apache-2.0 (see each model card on ai.google.dev/edge/mediapipe). Downloaded from storage.googleapis.com/mediapipe-models/ (float16, latest).

| File | SHA-256 |
|---|---|
| gesture_recognizer.task | 97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482 |
| selfie_segmenter.tflite | 191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b |
| blaze_face_short_range.tflite | b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f |

## 6. 3D models and textures

| File | What | Source | Licence | Changes |
|---|---|---|---|---|
| `apps/web/public/textures/moon_lroc_color_1k.jpg` | Moon colour map (LRO LROC), 1024×512 | NASA Scientific Visualization Studio, CGI Moon Kit: svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg | NASA, public domain | none |
| `apps/web/public/textures/mars_viking_mdim21_1280.jpg` | Mars Viking MDIM 2.1 colorized global mosaic, 1280×640 | NASA / JPL / USGS (via Wikimedia Commons file "Mars_Viking_MDIM21_ClrMosaic_1km.jpg"; original at astrogeology.usgs.gov) | Public domain | downscaled thumbnail |

Not used in this build: NASA 3D Resources models, Quaternius or Kenney kits. If added later, record name, author, source URL, licence, date, file path and changes here.

## 7. Images

_None yet._ The Glove Academy, input picker, Nova portrait, glove avatar, licence badge and hand demos are original SVG drawn in code (`apps/web/src/ui/`). NASA images are generally public domain; check each item for third-party credit lines.

## 8. Fonts

| Font | Licence | Source |
|---|---|---|
| Lexend, Fredoka, OpenDyslexic | OFL-1.1 | @fontsource packages (self-hosted) |
| Stylish 400 and IBM Plex Mono 400/500 `.woff` copies for 3D text (`apps/web/public/fonts/`) | OFL-1.1 | from @fontsource/stylish and @fontsource/ibm-plex-mono (troika can't read woff2); the Fredoka copy was removed |
| DM Sans, DM Mono, Playfair Display (v3 UI), Nunito (films) | OFL-1.1 | Google Fonts (to be replaced per bible §12) |

## 9. Audio and video

Music and SFX are generated in code (Tone.js, ZzFX, Web Audio). Chapter 1 (v4.3) adds real NASA footage and audio, all U.S. government works in the public domain, credited on screen as "NASA". We checked each piece: no third-party music, no other credits in the parts we use. **Nothing comes from YouTube.** No NASA logos or patches are shown.

| File | What | Source | Licence | Changes |
|---|---|---|---|---|
| `apps/web/public/media/ch1/apollo11-intro.mp4` (+ `-poster.jpg`) | 76.5 s cut of "Apollo 11 Activities" (launch-day ambience: breakfast, suit-up, van, Pad 39A, white room, firing room, countdown clock; no narration, no music) | NASA Kennedy Space Center, NASA Image and Video Library: images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-Apollo_11_Breakfast_C7Exit_Convoy_WhiteRmHatchClosing_Launch-HM_0083 (file `~medium.mp4`) | NASA, public domain | nine segments, cropped 1040×584, scaled 1280×720, H.264 CRF 23, AAC 128k, faststart, loudness-normalised; 16 frames held (0.8 s, 24.4 s, 41.5 s, 74.9 s) to remove a film whiteout, black blips and a flicker (no flashing for kids) |
| `apps/web/public/media/ch1/apollo11-intro.en.vtt` | descriptive captions (the film has no speech) | our own text | ours | — |
| `apps/web/public/media/ch1/one-small-step.mp3` | Neil Armstrong: "That's one small step for [a] man, one giant leap for mankind." | NASA audio file `590331main_ringtone_smallStep.mp3` (nasa.gov/mp3/, retrieved through the Internet Archive's 2012 copy because the old nasa.gov path now 404s) | NASA, public domain | trimmed to the quote (from 3.9 s; "I'm going to step off the LM now" left out so the caption matches), mono, loudness-normalised (I −18) |
| `apps/web/public/media/ch1/eagle-has-landed.mp3` | Neil Armstrong: "Houston, Tranquility Base here. The Eagle has landed." (4.0 s) | NASA film clip "APOLLO 11: Landing the Eagle, The Final Approach" (NASA Langley, NASA Image eXchange LV-1998-00035, from the NASA documentary "Apollo 11: The Eagle Has Landed"), archive.org/details/NIX-LV-1998-00035, seconds 50.3–54.3 | NASA, public domain | radio call only (spectrogram checked: no music in the cut), band-pass 180–4200 Hz, 0.1 s fades, mono, loudness-normalised (I −18) |
| `apps/web/public/audio/vo/ch1/*.mp3` + `durations.json` | Chapter 1 narration and Nova lines | generated with Kokoro-82M (see §5) from our own script in `apps/web/src/content/chapters/ch1-moon.json` | ours; model Apache-2.0 | loudness-normalised (I −18), mono 24 kHz |

## 10. Reference repos studied (cloned to /tmp/refs/)

| Repo | Licence | What we learned |
|---|---|---|
| google-ai-edge/mediapipe-samples (sparse: gesture_recognizer, hand_landmarker JS) | Apache-2.0 | VIDEO mode, timestamps, GPU delegate |
| damiansire/web-ar-hand-tracking | MIT | worker inference, drop frames, GPU warm-up before "ready" |
| andypotato/fingerpose | MIT | finger extension from joint angles |
| npm `@map-gesture-controls/core`, `hand-tracker-interaction` (docs/metadata only, not installed) | MIT | dwell timers and grace periods |
| One Euro filter paper and site (gery.casiez.net/1euro) | — | tuning procedure |
| google-ai-edge/mediapipe (sparse: `calculators/util/landmarks_smoothing_calculator*`, `tasks/web/vision/hand_landmarker`) | Apache-2.0 | landmark smoothing by relative velocity, object scale = landmark bounding box |
| tensorflow/tfjs-models (sparse: `hand-pose-detection`, `shared/filters`) | Apache-2.0 | `RelativeVelocityFilter` / `KeypointsVelocityFilter`. **Adapted** (re-written in our own code, same algorithm) in `apps/web/src/input/smoothing.ts`, with this notice: Copyright 2021 Google LLC, Licensed under the Apache License, Version 2.0 |
| open-mmlab/mmpose (sparse: RTMPose hand docs) | Apache-2.0 | RTMPose hand models are more accurate on benchmarks but need ONNX Runtime + a separate hand detector and give 2D only; too heavy for a random laptop next to the game, so not used |
| victordibia/handtrack.js | MIT | box-only hand detection (no finger joints); less precise than MediaPipe landmarks, so not used |

## 11. Dev data

`tools/gesture_synth.ts` generates synthetic hand landmarks (original code). Real landmark recordings saved by the F9 recorder go to `tools/gesture-recordings/` (JSON only, never video).

## 12. Fact sources

Every fact source is listed with its URL and retrieval date in `apps/web/src/content/sources.json` (bible §16 fact sheet, F1–F29; Chapter 1 rebuild adds F30–F36: NASA Apollo 11 mission overview, NSSDCA Apollo 11 pages, the ALSJ landing transcript, the JSC lunar sample curation page, the KSC film and the NARA film; full fact → source table in `docs/ACCURACY_REPORT.md`: NASA Science, NASA History Office / ALSJ, NASA JPL Photojournal and Solar System Dynamics, NASA Goddard NSSDCA fact sheets and StarChild, NASA APPEL, plus Physics World for F11). v3 sources: `shared/content.json`. Plaque text on the Apollo 11 descent stage is U.S. government text in the public domain.

## 13. Statement on NASA marks

Starship Odyssey uses **no NASA insignia ("meatball"), no NASA logotype ("worm"), no mission patches and no agency seals**. NASA imagery, video and audio used (the LRO Moon map, the Viking Mars mosaic, the KSC Apollo 11 film cut, the Apollo 11 radio and moonwalk audio) are public domain. Insignia that appear incidentally on suits or hardware in the 1969 footage are part of the historical record; we never use them as our own branding or in our UI. The game is independent and not endorsed by NASA.

## 14. Opening sequence (original work)

The summer street, the four kids (Maya, Leo, Amara, Migo), the ring of light, the chalk arrows, the transformation tunnel and the street ambience (wind, birds, neighbourhood bed, portal hum, made with Tone.js) are made in code by the team. No third-party character base models were used (Quaternius and the Universal Animation Library were considered but not needed). Script: `docs/design/INTRO_CONCEPT.md`.

## 15. Mars chapter and homecoming

- **Rover Mission Animation**, JPL, 6 June 2003: https://www.jpl.nasa.gov/videos/rover-mission-animation/ . Direct JPL-linked download: https://d2pn8kiwq2w21t.cloudfront.net/media/videosmarsVideo-New-MER-Animation-030606.m4v . No YouTube download.
- Attribution: **Courtesy NASA/JPL-Caltech. Animation: Dan Maas; technical consultant: Steve Squyres. Copyright 2002 Cornell University.** The embedded Cornell copyright means this animation is **not represented as public domain**. Educational reuse for this local game follows the third-party-material special case in https://www.jpl.nasa.gov/jpl-image-use-policy/ . That policy restricts commercial reuse; this credit does not grant broader rights.
- The game contains a 90.000-second educational montage, H.264 1280×720, CRF 23, faststart. The original archival picture is 320×240 and retains its 4:3 composition. The **entire original audio stream was removed** because third-party music clearance is unknown. English descriptive captions are original team writing. Original game music uses the existing Tone.js score. Source intervals, file hashes, full decode checks, and opened contact sheets: `docs/audit/mars-ending/SOURCES.md`.
- Scientific references added to `apps/web/src/content/sources.json`: NASA/JPL MER launch and landing press kits; JPL's Opportunity launch report; NASA's grey hematite image description; NASA APPEL's hole-in-one history; and NASA Artemis II countdown procedures. The fictional ship checklist borrows real checks without claiming to reproduce a real launch timeline. NASA/JPL launch kit: https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf . Artemis II: https://www.nasa.gov/artemis-ii-press-kit/ . Additional evidence and Boeing's contemporary report: `docs/audit/mars-ending/SOURCES.md`.
- Mars/Delta II/EDL/lander/rover geometry, Sol Keeper artwork and simulation, departure controls, ending staging, and game sound design are original code by the team. No new third-party runtime packages were added. The newer rover has no solar-panel wings.
- Narrator `af_heart` and Nova `bf_emma`: existing Kokoro-82M pipeline (Apache-2.0), rendered locally at build time. No voice is pitch shifted. Names remain local; pre-rendered name lines say “explorer,” and their captions match exactly.

## 9. New flow and Nova

### Services
| Service | Use | Notes |
|---|---|---|
| Google Gemini API (`gemini-3.5-flash-lite`, fallbacks `gemini-3.1-flash-lite`, `gemini-3.5-flash`) | Nova's free-form answers about NASA (optional online layer, v4.6) | called only by our local server (`server/`), key in `server/.env`; personal details and the player's name are removed before sending; no chat stored; see README "AI use" |
| ElevenLabs (optional, off by default) | a premium voice for free-form answers | only if `ELEVENLABS_API_KEY` is set; never for lines with the player's name |

### Runtime packages (game)
| Package | Version | Licence | Use |
|---|---|---|---|
| @huggingface/transformers | 3.8.1 | Apache-2.0 | on-device speech-to-text for Ask Nova (worker); its ONNX Runtime Web files (MIT) are bundled with the game as assets |
| Whisper tiny.en / base.en (onnx-community conversions) | — | MIT (OpenAI Whisper weights) | the speech model, downloaded from the Hugging Face hub on first mic use |
| @fontsource/fredoka | 5.3.0 | OFL-1.1 | titles again (the after-p2 title face) |

### Local server (not shipped in the game; `pip install -r server/requirements.txt`)
| Package | Version | Licence | Use |
|---|---|---|---|
| google-genai | 2.34.0 | Apache-2.0 | official Gemini API SDK (2.34.0, released 2026-10-29: newest release at least two weeks old) |
| fastapi / uvicorn | 0.162.2 / 0.54.0 | MIT / BSD-3-Clause | the server |
| python-dotenv | 1.1.1 | BSD-3-Clause | reads `.env` |
| kokoro-onnx | 0.6.1 | MIT | Kokoro-82M voice on CPU |
| Kokoro-82M v1.0 int8 ONNX + voices (thewh1teagle/kokoro-onnx release `model-files-v1.0`) | — | Apache-2.0 weights | Nova's voice; SHA-256 `6e742170…406cb` (onnx), `bca610b8…f1fbf7d` (voices); git-ignored in `server/models/` |
| phonemizer + espeakng-loader (eSpeak NG) | 3.6.0 / 0.2.4 | GPL-3.0 | kokoro-onnx's text-to-phonemes, installed by pip on this computer for the local server only; never bundled into the game build |
| Kokoro-82M v1.0 full-precision ONNX (thewh1teagle/kokoro-onnx release `model-files-v1.0`) | — | Apache-2.0 weights | v7.2: Nova's smoother voice (the int8 model stays as a fallback); SHA-256 `7d5df8ec…`; git-ignored in `server/models/` |
| onnx-asr (+ huggingface-hub) | 0.12.0 | MIT (Apache-2.0) | v7: Nova's ears on this laptop (speech-to-text on onnxruntime) |
| NVIDIA Parakeet TDT 0.6B v2 (ONNX int8 via onnx-asr) | — | CC-BY-4.0 | v7: the speech-to-text model, downloaded from the Hugging Face hub on first server start; audio processed in memory only |
| Whisper base (ONNX, onnx-asr fallback) | — | MIT | v7: fallback speech model if Parakeet can't load |
| NASA Open APIs: APOD, NeoWs, DONKI (api.nasa.gov) and the Curiosity REMS weather feed (mars.nasa.gov) | — | NASA public data | v7: live space facts for Nova (picture of the day, asteroids today, space weather, Mars weather); only fixed queries, nothing about the player |

### Original work (new flow)
Nova (the astronaut model, face rig and expressions), the Starship Odyssey on the cover, the mission
room, the mission icons (our own designs, no patches), the story films (MoonStory, MarsStory), the
painted planet and nebula textures, and every line Nova says were made by our team in code.

## Removed in v4.6
Unused or replaced packages were uninstalled to make the game lighter: framer-motion (two pop-ins now use the
kit's CSS spring), kokoro-js (the in-browser voice fallback and its GPL eSpeak NG phonemizer; voices are
pre-rendered with kokoro-onnx on the local server instead), @react-three/rapier, react-router-dom,
canvas-confetti and maath (never imported). ffmpeg's rubberband filter (GPL, a separate program run at
build time and by the local server, never linked or shipped) shifted Nova's Kokoro voice up in pitch
until v7; v7.2 uses af_heart with a gentle formant-preserving lift (x1.12) through the same rubberband
filter, and Gemini TTS was removed (Kokoro only).

## v7: the Space Archaeologist pass
The chibi explorer (characters/chibiModel.ts), its part previews, the four background songs
(audio/themes.ts, Tone.js) and the new HUD art were made by our team in code. faster-whisper was tried
for speech-to-text and removed: this machine's Application Control blocks its native library.

## Demo video and submission kit (2026-11-15)

Tools used to make the demo video (`video/`); none of them ship in the game.

| Tool or asset | Licence | Use |
|---|---|---|
| HyperFrames CLI 0.8.222 (already a dev dependency) | Apache-2.0 | Renders the video's picture from HTML (`video/hf/`) |
| FFmpeg 9.0.2 full build (gyan.dev, installed with winget) | GPL (a separate command-line tool; no FFmpeg code is in the repo) | Encodes the footage, mixes the sound (loudness to -14 LUFS) and muxes the MP4 |
| Playwright with Chrome (already a dev dependency) | Apache-2.0 | Records real gameplay frame by frame (`video/capture/`) and runs the e2e tests |
| Kokoro-82M voice am_puck (already used by the game's server) | Apache-2.0 | The narration; af_bella speaks the player's question in the voice demo |
| Gemini TTS (Google, two audition clips only) | Google API terms | One of the voices auditioned (`video/auditions/`); not used in the final video |
| Gemini 3.5 Flash (Google) | Google API terms | Listening judge for the voice auditions |
| Lilita One, Fredoka (copied from the game's `@fontsource` packages) | SIL OFL 1.1 | Video titles and captions (`video/hf/assets/fonts/`) |
| GSAP (copied from the game's existing HyperFrames projects) | GreenSock standard licence (free) | Animation timelines in the video |
| NASA photos (descent stage, laser reflector experiments, plaque, seismometer), already in `apps/web/public/media/artifacts/` | NASA, public domain (`credits.json`) | Shown in the video with "Photo: NASA" |
| Apollo 11 activities film (NASA Kennedy Space Center), already in the game | NASA, public domain (F35) | Seen inside the game in the demo, credited on screen |
| Music and sound effects | Original, made in code (Tone.js, ZzFX) | Recorded from the game's own audio engine (`video/audio/record.mjs`) |
| Claude Code (Anthropic) | n/a | Helped write code, tests, docs and the video kit (see `AI_USE.md`) |
