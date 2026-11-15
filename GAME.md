# Space Archaeologist

**A 3D learning game about the machines NASA left behind on the Moon and Mars.**
NASA Space Apps Challenge 2026 · theme *"Abandoned but not Forgotten"* · ages 7 and up · desktop browser

Play it: **https://space-archaeologist.vercel.app**

---

## The idea

It is the year 2075. You are a young **Space Archaeologist**. Your job is to visit real machines that
were left behind in space, study them like treasure, and keep their true stories alive.

Your host is **Nova**, a cute chibi astronaut girl. She greets you, explains every game, and answers
your questions about NASA and space, by voice or by typing.

Everything the game says about a mission is true and backed by a NASA source. The fun, made-up parts
(talking machines, the year 2075 agency) are clearly marked as *imagine*.

---

## How a game session flows

```
Title screen ─ START
  └─ First time only: short intro tour (4 steps) → your name → design your explorer
       └─ The ship (home base): Nova, mission platforms, Collection, Logbook, Badges
            └─ Pick a mission → play it start to finish → back to the ship with a badge
```

Every screen has a way back: Exit on the ship, Back on the intro and name screens, Home or Back inside
missions, and an X (or Esc) on every panel.

---

## Mission 1: The Moon (Apollo 11, the Eagle lander, 1969)

**Story part**
1. Real NASA footage of Neil Armstrong.
2. Pull the launch lever. The Saturn V lifts off, stages, and the little spacecraft flies to the Moon.
3. The arrival film: landing at Tranquility Base.
4. A mission briefing film shows each find you need to study.

**Play part: a required path.** Every step must be finished before the next one unlocks:

| Step | What you do |
|---|---|
| **Finds 0/4** | Walk around the landing site and study four real objects: the Eagle descent stage, the laser reflector, the moonquake detector (seismometer) and the plaque. Each has a dust dig; then the find sits big in the middle, kids twist and turn it (a fist moves it when the camera is on) and open its glowing parts, each with its job and a true fact; a hands-on activity (test the landing legs, send a laser ping, feel a moonquake, read the message); and an evidence quiz: four answers A to D, picked by holding up 1, 2, 3 or 4 fingers to the camera, or by tapping. |
| **Rock Box** | Pick up Moon rocks and drop them into the sample box, using your hands on camera or the mouse. |
| **Badge** | Earn the **Tranquility Storykeeper** badge, then "Chapter complete!" and back to the ship. |

**Extra fun on the Moon:** collect 8 sparkly Moon samples hidden around the site, and do a floaty
low-gravity **Hop** (J key or the Hop button).

---

## Mission 2: Mars (the Opportunity rover, 2004–2018)

1. NASA's plan for Mars (real footage).
2. A night launch.
3. Cruise and a soft, bouncy landing.
4. Opportunity opens up like a flower and rolls off.
5. The story: "One more hill".
6. Talk with Nova about what you saw.
7. **Sol Keeper** mini-game: keep Opportunity alive day after day ("sols") by wiping dust off its solar
   panels and collecting Mars "blueberries". Earn up to 3 stars.
8. Stamp your passport.

**Missions 3–5** (Viking 1, Pioneer 10, Voyager 1) appear on the ship as "coming soon", each with one
true teaser fact.

---

## The games, kid-first

- Every game opens with **one "how to play" card**: what the game is, 3 picture steps and a big
  *Let's play!* button. Nova reads it aloud.
- No lives, no fail screens, no buzzers. Hints are always there.
- Short lines (15 words or fewer), big buttons, at most 3 choices at a time.
- A cute, chunky cartoon style: toon-shaded 3D, soft outlines, white cards with indigo ink, sunny yellow
  buttons.

---

## Controls

- **Mouse, keyboard and touch** work everywhere.
- **Hand gestures with the webcam (Star Gloves)** are optional and only switch on after the player
  chooses them:
  - Moon exploration: point to walk, pinch to go, open palm to scan, thumbs up to investigate.
  - Rock Box and Sol Keeper: a glove sits right on your real hand in the camera picture, so you grab
    things with your actual hand.
  - Investigation: make a fist and move it to turn the find; point and pinch to open a part.
  - Evidence quiz: hold up 1 to 4 fingers for answers A to D. A tracker drawn on your hand in the
    camera picture shows what the game sees.
- The microphone is used only when you press Nova's mic button.

---

## Nova, the host

- **Voice:** a natural, friendly voice (Kokoro, the same voice for every line). Every line is spoken
  *and* shown as text.
- **Brain:**
  - Local version: Google Gemini behind a safety guard. Nova only talks about NASA and space.
  - Live NASA data: picture of the day, near-Earth asteroids, space weather and Mars weather.
  - Memory: Nova remembers which missions you finished and what you found (never your name or chat).
- **Offline:** without internet or a key, Nova answers from the game's own sourced fact sheet and plays
  pre-recorded lines. The online version at Vercel works this way.
- **Ears:** speech-to-text runs on the computer, so audio never leaves it.

---

## Privacy and safety

- No accounts. The explorer's name and progress stay in this browser only.
- Camera frames are processed on the device. They are never recorded, saved or sent.
- Chat is never logged or stored. Names and personal details are removed before any AI call.
- Grown-ups can turn the AI off in Settings, and can wipe the name and progress.

---

## Accessibility and comfort

- Captions are always on.
- Reduced motion setting, with at most one soft flash and never a strobe.
- Easy-read text size, an OpenDyslexic font option, and background music on/off.
- The whole game is playable with the camera off.

---

## Accuracy

- All story, quiz and Nova text lives in `apps/web/src/content/*.json`.
- Every fact cites a NASA source in `sources.json` (45 sources). The full list is in `docs/ACCURACY_REPORT.md`, and
  `/dev/facts` shows each fact with its source.
- The game uses no NASA logos, insignia or mission patches, and it is **not endorsed by NASA**.

---

## Built with

React 19, three.js with React Three Fiber and drei, zustand, Tone.js (music and cute sound effects),
MediaPipe hand tracking, Kokoro text-to-speech, Parakeet / Whisper speech-to-text, a FastAPI Nova server
with Google Gemini, HyperFrames for the story films, and Vite. Licences and every asset are listed in
[CREDITS.md](CREDITS.md).

---

## Run it yourself

```powershell
npm install
pip install -r server/requirements.txt
npm run dev        # game on http://127.0.0.1:5173 + Nova server on 127.0.0.1:8000
```

The Nova server is optional. Put a Gemini key in `server/.env` (`GEMINI_API_KEY=...`) for live answers.
Without it the game still plays completely.

Build for the web: `npm run build` creates a static `dist/` folder (this is what is deployed to Vercel).
