# AI use

Space Archaeologist was made with the help of AI tools. This page lists which tools were used, and
for what, so judges, teachers and parents can see exactly where AI is involved.

## Inside the game (what players meet)

| Tool | What it does in the game | Safeguards |
|---|---|---|
| **Google Gemini API** (`gemini-3.5-flash-lite`, fallbacks `gemini-3.1-flash-lite`, `gemini-3.5-flash`) | Writes Nova's free-form answers to questions about NASA and space. | Optional online layer, called only by our own server (the key never reaches the browser). A guard written in code keeps Nova on space topics, removes names and personal details before sending, answers worrying messages with a fixed safety line and no network call, and checks every answer (60 words at most, no links except nasa.gov, no numbers that are not in our sourced facts). No chat is saved. Grown-ups can switch the AI off in Settings ("AI helper"). Under the chat: "Nova is an AI helper and can make mistakes." |
| **Kokoro-82M** text-to-speech (Apache-2.0), run on the player's computer | Nova's voice and the story narration. | Runs locally; no audio goes to a cloud service. |
| **NVIDIA Parakeet TDT 0.6B v2** (CC-BY-4.0) via onnx-asr, with **Whisper** (MIT) as the in-browser fallback | Turns a spoken question into text when the player presses Nova's microphone button. | Runs on the computer; audio is processed in memory and never saved or sent. |
| **Google MediaPipe** hand landmarker (Apache-2.0) | Star Gloves: turns the webcam image of a hand into 21 points so the game can recognise point, pinch, grab and open palm. | Optional, opt-in, on device; camera frames are never recorded, saved or sent. The whole game also works with mouse, keyboard and touch. |

Without internet, or with the AI helper off, Nova answers from the game's own fact sheet: lines
written by the team, each tied to a NASA source in `apps/web/src/content/sources.json`.

## Making the game and the submission

| Tool | Used for |
|---|---|
| **Claude Code** (Anthropic) | Writing and reviewing much of the code, tests, documentation, the submission texts and the demo video kit, under the team's direction. Every fact was checked against the NASA sources listed in `sources.json` and `docs/ACCURACY_REPORT.md`. |
| **Gemini 3.5 Flash** (Google) | A listening check during the narrator voice audition (it scored each sample for warmth, clarity and naturalness, because the audition ran automatically). |
| **Kokoro-82M** (Apache-2.0) | The narrator voice and the spoken question in the demo video (an adult text-to-speech voice, labelled on screen; no under-18 voices). Gemini TTS was auditioned but not used. |
| **HyperFrames** (Apache-2.0) | Rendering the story films and the demo video from HTML. |

The demo video carries a visible "Made with AI tools" label on every frame, the same note in the
MP4 metadata, and in its description text.

## What is not AI

The game design, the characters, the art direction, the missions and the choice and checking of
every fact are the team's work. The music and sound effects are written in code with Tone.js and
ZzFX. NASA footage, photographs and audio are real and credited on screen.
