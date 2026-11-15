# Demo video kit

Everything that makes the Space Archaeologist demo video, and the same kit for the 30-second
global video. The picture is rendered with **HyperFrames** from HTML; the sound is mixed with
**ffmpeg**. All gameplay is real footage of the current build.

```
video/
  narration/lines.json   the script: what is said (say), what is shown (caption), fact IDs, rubric
  narration/tts.py       voice auditions and narration render (Kokoro am_puck; Gemini TTS optional)
  auditions/             4+ voices on the same 3 lines, with measured results (results.json)
  capture/lib.mjs        frame-exact gameplay recorder (game in ?capture=1 stepped mode)
  capture/shots.mjs      shot: onboarding
  capture/shots2.mjs     shots: mission1, moon (briefing, explore, dig), rockbox, finale (rebuild,
                         report), mars, novachat, settings, facts, novavoice (real time)
  audio/record.mjs       records the game's own Tone.js songs and sound effects
  kit.mjs                the look: tokens, CSS components, icons
  build.mjs              EDL (one beat per idea) -> hf/ (HyperFrames project), build/timeline.json,
                         build/captions.srt
  script_md.mjs          writes SCRIPT.md (timecoded script, facts, rubric coverage)
  mix.mjs                narration + ducked music + frame-synced effects -> -14 LUFS, mux
  team.json              the team label and names (swap the team name here)
```

## Make the video

Needs `npm run dev` running (the game on 5173 and Nova's server on 8000), Chrome, and a modern
ffmpeg (set `FFMPEG` to its path, and put its folder first on `PATH` for HyperFrames).

```bash
node video/capture/shots.mjs onboarding           # footage (about 2 min per 30 s of footage)
node video/capture/shots2.mjs all
KID_WAV=video/narration/out/k01_mic.wav node video/capture/shots2.mjs novavoice
node video/audio/record.mjs                       # music and effects from the game's engine
python -I video/narration/tts.py render am_puck   # narration (the voice is the clock)
python -I video/narration/tts.py kid Leda         # the child's question (labelled as TTS)
node video/build.mjs                              # HyperFrames project + timeline + .srt
node video/script_md.mjs                          # SCRIPT.md
cd video/hf && npx hyperframes check && npx hyperframes render -o ../build/picture.mp4 --quality delivery
cd ../.. && node video/mix.mjs video/build/picture.mp4 docs/submission/local/Space_Archaeologist_Demo.mp4
```

## The kit (reuse it exactly)

- **Look**: `kit.mjs` holds the tokens (ink #241D48, sun #FFD23F, mint, lilac, sky, coral, night)
  and the components: field-report card (`card`), framed gameplay screen (`SCREEN`, 1600x900 at
  160,104), kinetic lines (`line`), speech-bubble callouts (`bubble`), chips (`chips`), input
  badges (`badge`: Mouse, Hands, Voice, Keyboard), term cards (`term`: a word and its one-line
  meaning), photo polaroids with credit (`photo`), stat cards (`stat`), labels, credit lines,
  the progress path (Intro, Problem, Solution, Demo, Features, Impact) and the watermark.
- **Type**: Lilita One for titles, Fredoka 500 to 700 for everything else (the game's fonts,
  SIL OFL, copied from `@fontsource`). On-screen lines stay at 8 words or fewer.
- **Captions**: white card, indigo border and shadow, Fredoka 600 40 px, 4 to 7 words per group,
  118 px above the bottom edge. Every spoken line is captioned; `build/captions.srt` matches.
- **Transitions**: dust brushed off a field-report card (the dig), a scanner ring as it leaves
  (exploration), punch-ins on the gameplay screen, hard cuts inside a scene.
- **Watermark**: "Made with AI tools" on every frame, bottom right. NASA credit lines bottom left.
- **Sound**: the game's own songs (`theme-title`, `ship`, `explore`, `game`) and cute effects, music
  ducked under the voice by a sidechain, effects 3 to 6 dB over the bed, -14 LUFS, -1 dBTP or lower.

## The 30-second global cut

Same kit, same footage, fewer beats. In `build.mjs`, replace `BEATS` with this list (or copy
the file to `build30.mjs`) and keep everything else:

1. `n01` cold open (launch lever, liftoff, glove and rock), about 7 s.
2. Title beat with no line (the game's title screen and team chip), 2 s.
3. `n08` over a 4-shot montage (dig, laser ping, Rock Box glove, Sol Keeper), with the
   `badge` chips for Mouse, Hands and Voice, about 10 s.
4. `n31` stat cards only (275 facts, 46 NASA sources), about 5 s, no footage.
5. `n39` takeaway card, about 7 s.
6. End card (`n40`), held 3 s.

The progress path is optional at 30 s; keep the watermark and captions. Render and mix exactly as
above; `mix.mjs` follows whatever beats the timeline holds.

## Honesty rules this kit follows

- Real gameplay only. The Rock Box hand input is simulated (synthetic hand landmarks through the
  game's real gesture engine, no webcam on the capture machine) and says so on screen.
- The child's spoken question is text-to-speech, labelled on screen; the game's own
  speech-to-text hears it and Nova answers live.
- Every number on screen comes from `apps/web/src/content/sources.json` (see `SCRIPT.md`).
- No NASA insignia, logotype, seal, flags or mission patches. "Not endorsed by NASA" on the end card.
