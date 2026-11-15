# Nova, the talking astronaut host

Nova is the game's host on the cover, the name card, the dashboard and every mission check-in. He is
a small, cute astronaut ("he"), and he talks only about NASA and space missions.

## Look (`apps/web/src/odyssey/nova/Nova3D.tsx`, `face.ts`)

- About 2.5 heads tall, big round white helmet, a clear visor that always shows his face (the visor
  glass is 16 % opaque with one thin shine streak; the face is unlit so it is never darkened).
- Face: big round eyes with two white highlights, small brows, a small smile, rosy cheeks.
- Suit: soft white with one accent (sky blue `#7FB8E6`) on the chest panel, cuffs, neck ring and boots;
  a butter-yellow five-point star badge of our own design (no agency insignia); a tiny backpack with two
  thrusters that puff soft particles while he floats; chunky gloves with a thumb and chunky boots.
- Texture: fabric grain on the suit, scuffed boots (`look.ts` painted texture), 3 px warm-dark outline.
- Expressions (swapped face texture, one 256 px canvas redrawn only on change): neutral, happy (arc
  eyes), excited (sparkle eyes, open smile), curious (head tilt, one brow up), thinking (eyes up, hand to
  chin), listening (leans in, cups his ear), sorry (worried brows, small shrug), sleepy (half-closed
  eyes; the dashboard easter egg after 45 s of nothing happening). Sheet: `/dev/nova`,
  the `/dev/nova` page.
- Motion: idle float and bob, a blink every 2–5 s, pop-in from a side with a thruster puff, wave, point,
  thumbs-up, a happy spin, shrug, cup-the-ear. Everything is a pure function of the clock, so the same
  model renders identically inside HyperFrames compositions.
- Lip sync: the mouth opens in 5 steps from the voice's live amplitude (an `AnalyserNode` RMS), rounder
  for "o". He never talks without moving his mouth and never moves it in silence (with the browser's
  speech synthesis, which gives no samples, the mouth follows word boundaries while it is audible).

## Voice (`odyssey/nova/voice.ts`, `server/nova/tts.py`)

- Kokoro-82M (Apache-2.0 weights) through kokoro-onnx (MIT) on the local server, int8 model in
  `server/models/` (git-ignored; README says how to get it). Voice **`am_puck` at speed 1.0**, one config
  value: `apps/web/src/content/nova-voice.json` (read by the game, the server and the clip renderer).
- Casting (`npm run nova:cast`, samples written locally to `docs/audio/nova-voice-tests/`, not committed, measures in
  `comparison.json`): am_puck, am_michael, am_liam, am_eric, am_echo at 1.0 and 1.1 on 5 test lines.
  am_liam has the widest pitch range (12.7 semitones, the most lively) but Kokoro's own voice grades rate
  it lower; am_puck is lively (9.8 semitones), graded higher, 175 words a minute at 1.0. Listen and
  change the JSON if another voice suits you better, then run `npm run nova:voices`.
- All 50 scripted lines (with text) are pre-rendered (`npm run nova:voices` → `public/audio/nova/<id>.mp3`) and
  play instantly. Only free-form answers and the `{name}` lead-ins are voiced live.
- Lines with the player's name ("Hi, {name}!") are voiced only by our LOCAL server (`private: true`),
  never by a cloud voice; if the server is down they fall back to an on-device browser voice, or stay
  text-only.
- Live answers stream sentence by sentence (the first chunk split at an early comma), so Nova starts
  talking while the rest is still being written.
- Fallbacks: local server → (opt-in) kokoro-js in a Web Worker → pre-rendered clips → browser
  `speechSynthesis` ("Nova's voice is in simple mode"). **The kokoro-js fallback is OFF by default**
  (`VITE_BROWSER_KOKORO=1` turns it on): its phonemizer embeds eSpeak NG (GPL-3.0) as WebAssembly, and
  the standing orders keep GPL code out of the game build. See CREDITS.md.
- Optional premium voice: ElevenLabs, only if `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set in
  `.env`, only for free-form answers, never for a line with the name. Off by default.

## Ears (`odyssey/nova/ears.ts`, `stt.worker.ts`)

- Press the mic to talk, press again to stop (hold-to-talk on touch). Never always-on. The microphone
  permission is asked only when the mic is first pressed (separate from the camera).
- While listening: a pulsing ring sized by the level, a level meter, Nova's listening pose. Auto-stop
  after 1.5 s of silence or 12 s.
- Speech-to-text runs ON THE DEVICE: transformers.js (Apache-2.0) in a worker, WebGPU if available,
  else WebAssembly; the model (`content/nova-stt.json`) loads only when the mic is first used, with a
  progress line. The ONNX Runtime Web files are bundled with the game (`?url` imports of the
  transformers.js copies), never fetched from a CDN.
- Fallback: the browser's Web Speech API, only after a notice ("Your browser's speech service will be
  used. It may send your voice to the browser maker.").
- The transcript appears in the box and sends itself after 1.5 s unless the kid taps the box to edit it.
- Benchmark: `node tools/stt_bench.mjs` (Kokoro-spoken kid-style questions in three voices →
  `docs/audit/new-flow/stt-bench.json`, local only).

## Brain (`server/nova/`, `odyssey/nova/brain.ts`)

- v4.6: Google Gemini through the official `google-genai` Python SDK 2.34.0, model
  `gemini-3.5-flash-lite` (verified with `client.models.list()`; `NOVA_MODEL` to change it),
  streaming, `max_output_tokens` 220, safety settings `BLOCK_LOW_AND_ABOVE` on all four categories. When
  the model is busy (503/429) before the first word, `gemini-3.1-flash-lite` then `gemini-3.5-flash`
  answer. Questions that clearly mention space skip the classifier round trip (the local guard has
  already filtered them and every output sentence is still checked).
- Gemini is an OPTIONAL online layer: no key or no internet → the offline fact-sheet answers.
- Greetings and small talk ("hi", "how are you", "what's your name") get a short pre-voiced line that
  steers back to space (client and server, works offline); other topics get "That's not a space
  question! Want to know about the Moon or Mars?".
- Output post-filter: links, personal questions back, unsourced numbers, unsafe words, the Never Say
  list ("died"/"broke down" → "went quiet"; the lander "flew back" is blocked), 60-word cap.
- The key lives only in `server/.env` on this computer (`GEMINI_API_KEY`); the browser never sees it.
- System prompt: `server/nova/system_prompt.md` (versioned). Nova: friendly astronaut guide for 7–12;
  only NASA missions, spacecraft, rovers, astronauts' mission roles, and the Moon, Mars, planets and
  space science as NASA studies them; 1–3 short sentences, ≤ 60 words, grade 3–5 words, one fun detail;
  prefers the injected `<facts>`; never invents numbers, dates, names or quotes ("I'm not sure about that
  one. You could look it up on nasa.gov with a grown-up!"); refuses personal, off-topic, unsafe and
  "ignore your rules" messages warmly and suggests a NASA question; never asks for or repeats personal
  information; never pretends to be a person.
- Facts: the game's own sourced lines (both chapters, the curiosities and `content/nova-faq.json`); the
  six most relevant (plus the current mission's basics) go into each request.

### Guard layer (code, not only the prompt)

1. Input: trimmed to 200 characters; the player's saved name becomes "the explorer" in the browser
   before anything is sent; emails, phone numbers, street addresses, ages, schools, names after "my name
   is" and links are replaced on both the browser and the server.
2. A worrying message (hurt, scared at home, unsafe, bullied, wanting to run away…) gets the safety line
   at once, in the browser, without any network call: "That sounds really important. Please tell a
   grown-up you trust, like a parent or teacher, right away." Then Nova offers to keep talking about space.
3. A local pre-check catches obvious personal questions, jailbreaks and off-topic words; then a short
   classifier call (structured output `{on_topic, category}`) runs alongside the answer stream, and no
   text leaves the server until it says the question is about NASA / space. Off-topic → one of six canned
   redirect lines (pre-rendered; each suggests a question Nova can answer).
4. Output check, sentence by sentence: ≤ 60 words in all, no links except nasa.gov, no personal questions
   back to the kid, no number that is not in the game's sourced facts. A failed first sentence → the
   "not sure" line; a later one ends the answer there.
5. Rate limit: 1 request every 3 s and 40 per session per device (browser and server).
6. No chat content is logged or stored anywhere: not on the server (no access log, counts only), not in
   the browser (the last 6 turns live in memory only, for context).

### Offline / no key

Without a key or a connection, Nova answers from `content/nova-faq.json` (fuzzy keyword match; every
answer is sourced) and says "I don't know that one yet! Try asking me about the Moon landing or the Mars
rover." when nothing matches. The whole game plays without the API.

### Notices

- First use of the chat, once: a card for grown-ups ("Nova uses an AI service…") with **OK** and **Turn
  off Ask Nova** (Nova then answers only from the fact sheet).
- Under the chat: "Nova is an AI helper and can make mistakes."

## Where Nova speaks (scripts: `content/nova-lines.json`)

- Dashboard, first visit: greeting with the name, "How are you today?" (chips, typing or voice; a kind
  reply), "Are you ready…?", the how-to (the mission wall glows, the Ask Nova button pulses twice, the
  Moon icon glows). Returning players: "Welcome back, {name}!". After a mission: one short line.
- Check-in after each story (`odyssey/screens/CheckIn.tsx`): how was it → learn something (+ one sourced
  fun fact) → any questions (mission-scoped chat with mission chips, "Any other questions?") → ready for
  a mini-game, or back to the story.

## Tests

`npm run nova:test` (`server/tests/test_nova.py`): 100 offline tests (guard, privacy scrub, the 30 + 30
prompt lists against the local pre-check and fact sheet, the output check, the streaming logic against a
fake model, the name never reaching the API) and 63 live tests (30 on-topic, 33 off-topic) that
run only when `GEMINI_API_KEY` is set and write `docs/audit/new-flow/chat-tests.json`.
