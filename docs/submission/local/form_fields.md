# Project page: paste-ready text

Field names follow the official Project Submission Guide
(https://www.spaceappschallenge.org/resources/project-submission-guide/). All text is English with no dashes.

## Project Name

Space Archaeologist

## High-Level Project Summary

See `project_description.md` (248 words).

## Link to Project Demo

_Paste the public video link here once uploaded (see MY_TASKS)._

## Link to Final Project

https://space-archaeologist.vercel.app (play in the browser, no login)
Code: https://github.com/pln-pcd/space-archaeologist

## Detailed Project Description

**What it does.** Space Archaeologist is a free 3D browser game for kids aged 7 to 12 about the
machines NASA left on the Moon and Mars. Players design an explorer, board a ship and pick a mission.

Mission 1 retells Apollo 11:
1. Real NASA film of the crew on launch morning, then a launch the player starts with a lever.
2. The flight to the Moon and the landing.
3. A walkable Tranquility Base with four real artifacts: Eagle's descent stage, the laser reflector,
   the seismometer and the plaque.
4. For each artifact: brush the Moon dust away, turn the find around, and open its parts. Each part
   card shows its job and a true fact.
5. A hands-on activity for each artifact: a laser ping that takes about 2.5 seconds to come back,
   a moonquake demonstration, a soft landing, and the plaque's message.
6. An evidence quiz with four answers, picked by holding up one to four fingers.
7. Then Fill the Rock Box, rebuild the lunar module, file a mission report nobody can fail, and
   earn the Tranquility Storykeeper badge.

Mission 2 keeps the Opportunity rover going in Sol Keeper by wiping dust from its solar panels.
Missions 3 to 5 (Viking 1, Pioneer 10, Voyager 1) are planned.

**How it works.**
- React and three.js (React Three Fiber) render a toon-shaded world in any modern desktop browser.
- Google MediaPipe hand tracking runs on the player's computer and turns hand poses into game
  actions:
  - point to walk;
  - pinch to press;
  - a fist to grab or turn a find;
  - an open palm to blow dust;
  - one to four fingers to answer.
- Nova, the guide, answers through Google Gemini behind a safety guard written in code, or from
  the game's own fact sheet when offline.
- Her voice (Kokoro) and her speech recognition (Parakeet, or Whisper in the browser) run on the
  computer.
- Every story line and quiz answer lives in JSON files and must cite a NASA source; automated fact
  tests check all 275 facts against 46 sources.

**Benefits.** The challenge notes that young space fans mostly hear about missions flying today, and
that the history of older machines lives in dense websites and textbooks. Space Archaeologist turns
that history into play:
- kids learn by doing;
- every fact comes from NASA;
- stories are read aloud with captions for early readers;
- the game is free, needs no account, and works offline.

**What we hope to achieve.** We want every kid who plays to know what was left behind, why it
stayed, and that scientists still use some of it today (the laser reflector), and to want the next
mission.

**Tools.**
- TypeScript, React, three.js, React Three Fiber, zustand and Tone.js (music made in code), built
  with Vite.
- Google MediaPipe, a Python FastAPI server, Google Gemini, Kokoro text-to-speech, and Parakeet and
  Whisper speech recognition.
- HyperFrames for the story films and the demo video; Playwright and Vitest for tests.

## Use of Super Intelligence (SI)

Yes. In the game, Nova's free-form answers come from Google Gemini behind our own safety guard
(space topics only, personal details removed, answers checked against our sourced facts, nothing
saved, an off switch for grown-ups). We used Claude Code (Anthropic) as a coding assistant to write
and review code, tests, documentation and the demo video kit under the team's direction. The idea,
the game design and the choice and checking of every fact are the team's. The demo video's narration
is text-to-speech (Kokoro), and the video carries a visible "Made with AI tools" watermark on every
frame, with the same note in its metadata and description. Full details: AI_USE.md in the repository.

## NASA Data

See `nasa_resources.md` for every source with its link. In short:
- NSSDCA catalog entries for the Apollo 11 lunar module and EASEP, and the Moon and Mars fact sheets.
- NASA Science and NASA.gov mission pages for Apollo 11, Opportunity, Viking 1, Pioneer 10 and Voyager 1.
- The Apollo Lunar Surface Journal.
- NASA/JPL press kits and images.
- Apollo 11 film from NASA's Kennedy Space Center (NASA Image and Video Library).
- Apollo 11 photographs of the artifacts.
- NASA open APIs used by Nova when the server runs: NeoWs (near-Earth asteroids), DONKI (space
  weather) and the Curiosity rover REMS weather report.

## Space Agency Partner Data and Other References

- No Space Agency Partner data was used.
- Other references: Physics World (IOP Publishing) for one fact about the Apollo 11 seismometer.
- Code libraries, fonts, models and tools are listed with their licences in CREDITS.md (React,
  three.js, React Three Fiber, drei, zustand, Tone.js, ZzFX, MediaPipe, Kokoro, Parakeet, Whisper,
  Gemini API, HyperFrames, Vite, Fredoka, Lilita One, Lexend and OpenDyslexic fonts).
- All 3D models, characters and music are original work made in code.
