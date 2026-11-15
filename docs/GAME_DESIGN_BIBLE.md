# Starship Odyssey — Game Design Bible v4.2
### *Wake the Quiet Machines*
**NASA Space Apps Challenge 2026 · "Abandoned but not Forgotten"** · Ages 7 and up (kids, families, classrooms) · Hand gestures are the controls inside the chapters

> Put this file in the repo as `docs/GAME_DESIGN_BIBLE.md`. Every Claude Code prompt points back to its sections (§0–§20). If code and this document disagree, this document wins. If this document and a NASA source disagree, NASA wins, and you fix this document.

---

## §0 · Current scope (read first)

- **Only two chapters are playable:** **Chapter 1, the Moon** (Apollo 11's *Eagle* descent stage) and **Chapter 2, Mars** (the *Opportunity* rover).
- **Chapters 3–5 are closed for now** (Viking 1, Pioneer 10, Voyager 1). They appear in the base as sealed "Coming soon" books with a teaser (§11). They can't be entered.
- **Runs on localhost only.** `npm run dev`, plus the existing desktop launcher (`launch_game.py`, port 8391).
- **No CI/CD.** No GitHub Actions, no deploy pipeline, no build-blocking validators, no big test suites. Claude Code checks its own work by running the game locally and taking screenshots.
- New in v4.1: the **Odyssey Base redesign** (§6) and **Memory Catch**, an AR "grab the answer" quiz that uses the webcam (§10).
- New in v4.2: **Fun first, facts inside** (§2.1), every ⚠ fact checked against NASA (§16: F16 and F17 now verified, F18–F27 added), the **key map** (§4.1), measured gesture-engine decisions (§5.1) and performance findings (§18.1). The unsourced "fingernails" comparison is removed.
- New in v4.3, **Chapter 1 rebuild:** the Moon chapter is now a short film you take part in (NASA video → launch lever → landing → first steps → narrated story → summary → camera mini-game "Fill the Rock Box"), §8. **Hand tracking lives only in post-story mini-games** (§5.2): the base, the Story Portal, videos, cutscenes and storytelling never start the camera. The Glove Academy and the boot camera option are gone. Chapter 2 keeps its story with mouse, touch and keys; its post-story Sol Keeper uses the same opt-in camera flow.

- **New in v4.5, the NEW FLOW + NOVA HOST (§23, wins over everything earlier where they disagree):** cover → name card → dashboard (ship room with the mission wall) → mission (video, launch lever, landing, story film, Nova check-in, mini-game, results + stamp) → dashboard. Nova is a talking astronaut host (Claude API through our local server, Kokoro voice, on-device speech-to-text). Removed: the hide-and-seek opening (§21), the portal, the transformation, character select, ship walking, the summary cards, the Moon debrief, the Mars portal and everything after the Mars mini-game. Style = the after-p2 look + colour, texture, outlines and cream cards.

---

## §1 · The pitch, and what changed

**For a 9-year-old:** *"Your hands are magic space gloves. Open a storybook, fall into the page, and land next to a real robot NASA left on the Moon or Mars. Wake it up, help it remember its mission with your hands, then catch the right memories to fix its memory core!"*

**For judges:** a playable pop-up storybook. Kids act out the real engineering of NASA hardware that was left behind, using webcam hand tracking. They aim a laser at the Apollo 11 reflector, then drive Opportunity across Mars and wave away the dust on its solar panels. An AR quiz puts the kid "on" the Moon or Mars to check what they learned. Every fact is sourced, and the fiction is clearly labelled.

| Before (v3) | Now (v4.1) |
|---|---|
| A big hub with a corridor and a bridge; you press **E** at consoles | A compact **round Odyssey Base** where everything is about 10 seconds' walk away, and it comes alive as you play (§6) |
| Chapters were panels you read | Each chapter is a **6–8 minute playable diorama** with a story you act out with your hands |
| Gestures were one feature | **Star Gloves** are the main controller. Mouse, touch and keyboard all work too |
| Chapter 2 was Opportunity but the order and the destinations were muddled ("Mars Lab") | **Ch1 Moon (Eagle) → Ch2 Mars (Opportunity)** playable. Ch3 Viking 1, Ch4 Pioneer 10, Ch5 Voyager 1 are sealed |
| No knowledge check | **Memory Catch:** an AR quiz where you grab answer orbs and drop them into the machine's memory core (§10) |
| Warp speed shown as if real | Kept for fun but tagged **✨ IMAGINE**. The **Reality Check** panel shows how long the real trips took |

---

## §2 · Design pillars

1. **Hands tell the story.** Every important beat is something the player *does*, and the action matches the real engineering.
2. **True, and kind about it.** Real dates and numbers with sources. The robots can talk (✨ IMAGINE), but what they say about their missions is true (🛰 TRUE STORY). Endings are bittersweet, never scary.
3. **Quiet wonder.** Calm and cute (v4.5: moderate-chibi kids, outlines, soft colour; see §22), restrained colour. Every input gets a clear, gentle response (a soft sound, a light, a calm motion).
4. **A 7-year-old can finish it; a 12-year-old wants 3 stars.** Aim assist, no lives, no fail screens. Optional star goals and secrets for older kids.

### §2.1 · Fun first, facts inside (v4.2)
The game teaches by **doing**, not by reading. Facts are the treasure, not the homework.
- **Play ≥ 70% of every chapter.** Reading, listening and quiz time together stay under 30%.
- **One new fact per beat, at most,** always attached to something the kid just *did* or *sees* (bounce the laser → "the light took 2½ seconds!"). Never a wall of facts.
- **Show the number, don't lecture it:** a ticking 2½-second wait for the laser echo, a marathon flag at 42 km, a bunny hop that floats in 1/6 gravity. The exact figure sits small on the TRUE STORY badge.
- **The machines tell jokes; the facts stay true.** IMAGINE lines carry personality and humour; TRUE STORY lines carry the science. Both ≤ 15 words.
- **Optional depth for 12-year-olds:** extra facts are collectible **Star Cards** in the Mission Logbook. Never required to finish.
- **Quizzes never block.** Memory Catch always ends with the memory restored; wrong answers become clue cards (§10).
- **Wonder over trivia:** prefer "whoa" facts (it bounced 26 times, the Moon drifts away, blue sunsets, two moons) over dates and part names.

---

## §3 · Core loop (each chapter, 6–8 minutes)

| # | Step | What happens | Main gesture |
|---|---|---|---|
| 1 | **Open** | Pick a book in the Story Library; it flies to you and opens | ✋ Power Palm |
| 2 | **Dive** | Pages riffle, a pop-up diorama rises, you push *into* the page: one soft flash, then you land in the world (§7) | 👉 Swoosh, 🫸 Rocket Push |
| 3 | **Arrive** | Establishing shot of the real site today; a place/date card with a 🛰 TRUE STORY badge | — |
| 4 | **Find** | The machine is quiet and dusty. A shimmer trail leads to it. Clear it | 👋 Wave Wind / ☝️ Pointer |
| 5 | **Wake** | Hold your palm to it; an energy ring fills, it boots with its musical motif and "speaks" (✨ IMAGINE) | ✋ Power Palm |
| 6 | **Remember** | 3–4 memory beats in first person, each re-enacting real engineering. One beat includes a **Quick Catch** (a single AR question, §10) | Chapter-specific |
| 7 | **Mission** | One featured mini-game based on the real science. 60–90 s, 3 stars, instant retry | Chapter-specific |
| 8 | **Discover** | A "What we learned" card plus an "…and today" link to a current mission | 👍 Thumbs Up |
| 9 | **Memory Catch** | A 5-question AR round. Each right answer rebuilds a piece of the machine's hologram and plays the next note of its song (§10) | ✊ Grab → ✋ Release |
| 10 | **Stamp** | Frame a souvenir photo, stamp the Passport; the machine's instrument joins the base's song; back to the base | 🖼 Photo Frame, ✊ Fist Stamp |

**Teaching rhythm:** Chapter 1 teaches Pointer, Pinch, Power Palm, Wave Wind, Pilot Hand, Rocket Push and Grab. Chapter 2 adds Dial/Steer and reuses the Chapter 1 gestures in new ways (introduce → develop → twist).

---

## §4 · Star Gloves: the gesture vocabulary

Every verb has a kid-friendly name, an SVG icon, a one-line tutorial, and **a mouse, touch and keyboard fallback**. Game code never reads raw gestures. It reads *intents* (§5).

| Kid name | Icon | What the hand does | Detection summary | Used for | Fallback |
|---|---|---|---|---|---|
| **Star Pointer** | ☝️ | Move your hand; the glove cursor follows | Index knuckle (landmark 5) blended 70/30 with palm centre, so pinching doesn't make the cursor jump. One Euro filter. Aim assist | Aim, hover | Mouse / touch / arrows |
| **Star Pinch** | 🤏 | Thumb tip to index tip | Pinch ratio = dist(4,8) ÷ palm size; hysteresis; per-kid calibration | Press, drag, scoop | Click-drag / tap-drag / Space |
| **Grab & Release** | ✊→✋ | Close your fist over an object to hold it; open your hand to drop it | Fist = fingers curled (joint angles) + MediaPipe `Closed_Fist`; release = `Open_Palm` or extension | Memory Catch orbs, carrying tools | Drag & drop / keys 1-2-3 |
| **Toss** | 🤾 | Release while moving fast | Hand speed at the moment of release; magnet assist toward the target | Bonus throws in Memory Catch (older kids) | Flick-drag |
| **Power Palm** | ✋ | Open hand facing the screen, held ~1.2 s | 5 fingers extended + palm facing the camera + low speed; a dwell ring fills | Wake, confirm, open book | Hold Space or E / long-press |
| **Wave Wind** | 👋 | Wave side to side | ≥3 direction flips in 1.2 s, each > 0.6 palm-widths | Blow dust, clean solar panels, greet Nova | Rapid A/D / scrub |
| **Swoosh** | 👉 | Quick swipe | Velocity peak above threshold; 450 ms cooldown | Turn pages, rotate the base view | Arrows / swipe |
| **Dial Twist / Steer** | 🔄 | Pinch to "grab" a knob, then twist your wrist. Two fists = steering wheel | In-plane angle of wrist→middle knuckle while pinching; for two hands, the angle of the line between them | Rotate globe, drive the rover | Scroll / Q-E / on-screen wheel |
| **Rocket Push** | 🫸 | Push your palm toward the screen | Apparent palm size grows > 18% in < 400 ms | Launch, dive into page, send wake-up call | Enter / big button |
| **Pilot Hand** | 🛩 | Hand height = throttle, tilt = steer | Normalised y + roll angle | Landing Eagle | W/S + A/D / slider |
| **Photo Frame** | 🖼 | Two "L" hands make a frame (one-hand L also works) | Thumb + index extended, others curled | Souvenir photos | P / camera button |
| **Thumbs Up** | 👍 | Thumbs up | MediaPipe `Thumb_Up` **and** a rule check | Yes / continue | Enter / tap |
| **Fist Stamp** | ✊⬇ | Fist, then move down fast | Closed fist + downward speed peak | Passport stamp | Click |

**Ergonomics for kids, laptops and classrooms:**
- The central ~60% of the camera frame maps to the whole screen, so nobody has to stretch.
- Targets are at least 96 px, with aim assist (snap within ~80 px).
- Never more than ~60 s of gestures without a rest beat.
- Left-handed mode and one-hand mode (every two-hand gesture has a one-hand version).
- Each scene enables only the verbs it needs, which means fewer false triggers.

### §4.1 · Key map and fallbacks (v4.2)
Fallbacks emit the **same intents** as gestures (§5). Navigation helpers `move`, `turnView`, `zoomView`, `choose` and `back` are always on.

| Input | Does |
|---|---|
| WASD / arrows | walk in the base; pilot (W/S throttle, A/D tilt) and steer (A/D) in those scenes; arrows move an on-screen cursor in aiming scenes |
| Z / X, drag, Swoosh | turn the base view (Q/E no longer turn the view) |
| E (tap or hold) | Power Palm / use the station you are next to. A quick tap counts |
| Space | pinch, grab or stamp (whichever the scene uses); hold Space = Power Palm where nothing else uses Space |
| Enter | Rocket Push, Thumbs Up |
| Q / E | Dial Twist, only in dial scenes |
| 1 · 2 · 3 | pick an answer orb (Memory Catch) |
| P · F9 · Esc | photo frame · gesture debug overlay · back |
| Mouse | move = pointer, press = pinch/grab/stamp, long-press = Power Palm, quick fling = Swoosh, scrub back and forth = Wave Wind, wheel = Dial |
| Touch | as mouse; plus on-screen buttons for Push, Thumbs Up, Frame, a Steer wheel and a Pilot slider. Tapping any prompt pill does its action |

---

## §5 · Gesture engine (built for accuracy)

**Library:** `@mediapipe/tasks-vision` (Google MediaPipe Tasks, runs **on-device**). Use the **GestureRecognizer** task: one pass gives the **21 hand landmarks plus** canned labels (`Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`, `None`). Combine those with our own rule-based features. The retired Memory Catch implementation used **ImageSegmenter** (selfie segmentation, to swap the background) and **FaceDetector** (only to keep the UI clear of the kid's face, plus an optional helmet overlay). Sol Keeper loads only the hand recognizer and shares one stream from camera check to game; it does not load segmentation or face detection.

**Pipeline**
1. **Camera:** 960×540 at 30 fps, mirrored. Drop to 640×360 if inference is slow. Handle denied, busy and missing cameras with a friendly fallback.
2. **Inference:** `VIDEO` mode, `numHands: 2`, GPU delegate with CPU fallback, driven by `requestVideoFrameCallback`. At most 30 Hz, decoupled from the 60 fps render loop. Try a Web Worker and keep it only if measuring shows it helps.
3. **Self-host** the WASM in `/public/mediapipe/wasm/` and the `.task`/`.tflite` models in `/public/models/`, so it works offline at the venue.
4. **Features:** wrist-relative landmarks normalised by palm size; finger extension from joint **angles**; palm normal; pinch ratio; roll; apparent palm scale (depth); velocity and acceleration; handedness corrected for the mirror.
5. **Smoothing:** a **One Euro filter** (`1eurofilter` on npm). Tune it: set β = 0, raise `mincutoff` until a still hand stops jittering, then raise β until fast moves stop lagging. Start at `mincutoff 1.0, β 0.02`.
6. **Classify:** one small state machine per verb, with enter/exit hysteresis, minimum hold time, cooldown, and confidence that builds over frames. **Intent lock:** a grab or drag stays held until a clear release.
7. **Calibrate per kid** in each mini-game's camera check ("show one hand", then "pinch to start"): record their open-hand and pinch values and set thresholds 40% of the way between them.
8. **Intents:** `pointer`, `pinchStart/Move/End`, `grab/release{velocity}`, `palmHold{progress}`, `wave`, `swipe`, `dial`, `steer`, `push`, `pilot`, `frame`, `thumbsUp`, `fistStamp`. Mouse, touch and keys emit the **same** intents.

**Feedback:**
- An on-screen **glove avatar** mirrors the hand and changes colour per verb.
- A **Hand Coach** gives tips like "Move back a little", "Bring your hand into the box", "It's dark, face a light".
- Dwell rings, snap sparkles, and a soft tick sound when a verb is recognised.
- **Debug overlay** (F9 or `?debug=gestures`): landmarks, a live score per verb, FPS, inference time, thresholds.

### §5.1 · Engine decisions (measured, v4.2)
- **Library:** `@mediapipe/tasks-vision` **0.10.35**, pinned. The 1.x line is reported to send usage metrics by default; for a kids' game we stay on 0.10.x until that is confirmed off.
- **Self-hosted:** WASM in `/public/mediapipe/wasm/` (classic and ES-module loaders), models in `/public/models/`; `tools/fetch_mediapipe.mjs` runs before dev and build.
- **Web Worker by default**, main thread as fallback. On the Radeon 680M test laptop the GPU delegate's first inference compiles shaders for **~8.5 s**: on the main thread that froze the whole UI, in the worker the game stays responsive. With gloves on, the render rate in the worker setup is about twice the main-thread one (base 38 vs 18 fps; Academy ~100 vs 55 fps). The worker must use MediaPipe's **ES-module loader** (`forVisionTasks(path, true)`).
- **The camera `<video>` stays in the DOM** (invisible): off-DOM videos may never fire `requestVideoFrameCallback`; a 600 ms watchdog falls back to rAF polling.
- **Inference cost:** 20–30 ms per frame with the 3D scene paused, ~43 ms while the base renders (GPU contention). Above the 15 ms target; see §18.1.
- **Per-kid calibration** happens in the mini-game camera check and is stored on the local Explorer profile.

### §5.2 · Where the camera may run (v4.3, Chapter 1 rebuild)
- **Only in post-story mini-games** (Ch1 "Fill the Rock Box", Ch2 Sol Keeper). Never at boot, in the ship, the Story Portal, videos, cutscenes or storytelling.
- A mini-game asks first ("Ready for a mini-game?", then a camera check card with "Nothing is saved or sent" and a grown-ups note). Only after **Yes** does it call `useHandsWanted()`; `GlovesLayer` then starts the tracker. Denied, busy or missing camera: the same game with mouse or touch.
- Leaving the mini-game unmounts the hook: the camera track is stopped and the recognizer disposed (1.5 s grace).
- `src/input` stays, but only the mini-game context enables it. **Dev guard:** `acquireCamera()` logs `[camera-guard]` as an error (and counts `window.__cameraGuard`) if the camera is requested while no mini-game wants hands.
- Outside mini-games every prompt reads `E · Click · Tap` (no hand glyphs).

**Checking accuracy locally (dev tools only, not CI):**
- A landmark **recorder** that saves JSON, never video.
- An `npm run gestures:check` script that replays recordings and prints true and false triggers per verb.
- Aim for at least 95% detection per verb and less than 1 false trigger per minute with idle hands.

---

## §6 · The Odyssey Base (redesign)

**Goal:** one round, calm, readable spacecraft interior where everything is within about 10 seconds' walk. It should feel like a quiet afternoon on a working ship: warm light through the dome, neutral surfaces, colour only on a few lights and on the one button that launches.

### Layout (top view)
```
                       N
              ┌── LAUNCH BAY ──┐
              │ big window,    │
              │ graphite       │
              │ console, dome  │
              │ button         │
   W  ┌───────┴────────────────┴───────┐  E
      │ COZY       ╭──────────╮  HALL OF │
      │ CORNER     │  STORY   │  ECHOES  │
      │ sofa, rug, │ LIBRARY  │  shelf,  │
      │ lamp, Nova │ + MEMORY │ Passport,│
      │ dock,Glove │   CORE   │ Mirror   │
      │ Academy mat│  GLOBE   │ Pod      │
      │            ╰──────────╯ (orrery  │
      │                         above)   │
      └───────────┬──────────────┬───────┘
                  │   AIRLOCK    │  ← Voyager live panel
                  └──────────────┘
                         S
```
- **Shape:** a round hangar about 24 units across under a **graphite dome frame** with glass. Through it you see space (#1B2230 → #3A4656 with a faint warm nebula band) and **Earth in natural colours**; after a chapter unlocks the destination appears there.
- **Palette (MASTER, shadow / mid / light):** hull panels bone `#8E8A82 / #C9C2B4 / #ECE6DA`; ribs, frames, handrails warm grey `#5C5A57 / #85817A / #A9A49A`; deck sandstone `#7A7468 / #B3A792 / #D8CDB8`; inlays, consoles, mats slate `#3B464C / #55646B / #7E9097`; ceiling and dome frame graphite `#3A3836 / #57534F / #6F6B66`; seats dusty blue `#4A5866 / #6D8295 / #8FA3B5`; brass trim `#6E6046 / #A8936A / #CDB98E` (≤ 5 % of the screen); plants sage `#4F684E / #6A8C70 / #82AD8C` (≤ 2 planters). Glass `#D8E3E6` at 15–25 %, lamp light `#FFE9C7`, screens `#2F3A3F` with `#CFE6D8` text, LEDs sage `#6A8C70` and terracotta `#B5674A`. About 90 % neutrals, about 5 % accents.
- **Floor:** sandstone tiles with thin slate seams; a **slate inlay ring** around the library with darker engraved orbit lines (no glow, no sparkles); a warm floor-light strip along the walkway.
- **Walls:** bone hull panels with seams, **warm-grey ribs about every 3 m**, a handrail at hand height, two graphite-framed portholes, large simple cable trays and vents. "Did you know?" panels are framed bone panels in the paper-card style (sourced facts, no NASA logos).
- **Ceiling:** long linear warm lights hung under the dome ribs and **one large, slow orrery** above the library (graphite arms, brass rings). Its Moon and Mars are dim until their chapter is complete, then they show in natural colours. Progress you can see at a glance.

### Zones
1. **Story Library (centre):** five lecterns in a half circle around the **Memory Core Globe** (graphite bases, bone tops).
   - **Ch1 Moon and Ch2 Mars:** large **cloth-bound books** (Moon silver-grey `#5F6266`, Mars terracotta `#7A4632`) with embossed line art and their titles in Stylish ("The Moon", "Eagle · 1969"; "Mars", "Opportunity · 2004"). The book you can open has its small reading lamp on; a completed book carries a brass ribbon.
   - **Ch3–Ch5 (closed):** a dim book inside a **frosted glass case** with a low light and **one engraved plaque**: "COMING SOON" with the machine and year (IBM Plex Mono). Pinching one shows a **teaser card** (§11). It can never be entered.
   - **Memory Core Globe:** a soft cream hologram of the Moon or Mars on a graphite table with an engraved plaque. Pinch and twist to spin it (Dial Twist). Pins mark the real sites: Tranquility Base (0.674°N, 23.473°E, F27) and Opportunity's landing at Eagle crater, Meridiani Planum (1.95°S, 354.47°E, F22). Both verified.
2. **Launch Bay (north):** a big window, a graphite console with slate screens, the **terracotta dome button in a brass guard ring**, a warm-grey throttle, dusty-blue pilot seats and the **Reality Check** screen (card style): *Apollo 11 took about 4 days to reach the Moon · Opportunity took about 6½ months to reach Mars.* When a new chapter unlocks, a short **warp cinematic** plays (one Rocket Push to launch; Shepard-tone riser; soft streaks on the glass; tagged Imagine) and the dome view changes to the new destination.
3. **Hall of Echoes (east):** a warm-grey shelf where each machine you've woken appears as a matte cream hologram (dim graphite models until then). Also here: the **Passport stand** and the **Mirror Pod** (slate booth, bone frame) for Memory Catch replays.
4. **Cozy Corner (west):** a dusty-blue sofa on a plain rug (keep the sitting system), a warm-grey reading lamp, **two sage planters** (the only plants in the base) and Nova's graphite dock. (v4.3: the Glove Academy mat is removed; hand practice lives in each mini-game's camera check.)
5. **Airlock (south):** a graphite door with a slate status screen. Next to it is the **Live Voyager panel** (framed slate screen), a teaser for the locked Chapter 5: a countdown to 18 Nov 2026 10:16:07 UTC, then "Voyager 1 has been more than one light-day away for N days". Show NASA's milestone distance (25.9 billion km). Don't fake a live odometer, because Earth's own orbit makes the real distance shrink and grow during the year.

### Living details (calm, each with a reason)
- Soft light dapples drifting over the floor (0.85–1.0), a few dust motes inside the faint light shafts, sway only on the two planters, the orrery turning slowly, a breathing camera.
- Indicator lights are steady (sage = fine, terracotta = attention). Nothing blinks, wanders or spins for no reason.
- Nova hovers beside you and answers with its light ring.
- **"The ship comes alive":** every machine you wake lights its sphere on the orrery, adds a hologram to the Hall of Echoes, and adds an instrument to the base music.

### Navigation and camera
- Point and pinch on the floor to walk there. WASD works too.
- Swoosh rotates the view around the centre.
- Zoom out for a **whole-ship view** (from above at an angle).
- The camera auto-frames the player with whatever they're near. Objects between the camera and the player fade out.
- The corridor is a **short tube** with automatic doors leading to the Launch Bay (keeps the door feature, removes long walks).

### Fixes from the v3 screenshot
Replace the flat 2D chapter card with 3D books. Raise the floor contrast. Show all three input glyphs on every prompt (`✋ Hold · E · Tap`). Fix the camera clipping into foreground objects. Stop the prompt pill from overlapping the player. Remove the duplicate astronaut beside the console (or make it a clearly different crewmate if it's meant to be one).

**Status (Mistwood Cottage restyle):**
- Sandstone deck with slate ring inlay ✅, 3-glyph prompts ✅, occluder fade ✅, cloth-bound books on lecterns ✅, one plaque per sealed case ✅, orrery ✅, Nova is a faceless drone ✅.
- **Mistwood visual updates:** Cineon tone mapping (1.75), frosted porthole glass, Cozy Corner low table with ceramic mug and procedural rising steam (`<Steam />`), emissive radial gradient materials for lamps and plinths, and SVG hand cursors. Legacy rendering path preserved behind `?style=legacy`.

---

## §7 · The Story Portal ("open the book → swirl → you're on the Moon")

*v4.3: one action. The book flies up by itself; "Open the book" with **E, click or tap** opens it and the dive follows on its own. No hand gestures here (§5.2).*

1. **Summon:** the book lifts, spins and flies to the camera (GSAP, ~0.6 s, overshoot ease). Page-flutter sound.
2. **Open:** "Open the book · E · Click · Tap". The cover opens (hinge or page-curl shader). The title page is an SVG: chapter number, machine, place, year.
3. **Peek:** the right-hand page is a **live window into the world** (drei `MeshPortalMaterial` or `RenderTexture`), and a paper pop-up of the machine rises from it.
4. **Dive:** "🫸 Push into the page!" The camera dollies into the page, the portal blend goes 0→1, then a **cream swirl dissolve** (≈ 1.4 s: the scene swirls into warm cream `#FFFDF8`, then swirls out into the chapter) and a paper "whump". No flash at all: the dissolve is slow and low-contrast, safe for photosensitive players.
5. **Land:** a swoop down from above, a dust puff (Moon dust flies in clean arcs because there's no air), and the arrival card.
6. **Exit:** the same swirl in reverse, the world folds back into paper and you're back in the base, with the book now gold.
7. **Reduced motion:** a 0.6 s crossfade instead.

---

## §8 · Chapter 1: THE MOON. EAGLE (v4.3 rebuild)
**🌕 Apollo 11 · July 1969**

A short film you take part in (~8–9 min). Mouse, touch and keys everywhere; the camera only in the mini-game at the end (§5.2). Code: `apps/web/src/story/ch1/`; content: `content/chapters/ch1-moon.json` (every line is a fact with `sourceIds` or an `imagine` line).

**Flow** (autosaved per state; deep links `?chapter=1&scene=A…G`; Judge Mode can jump to any scene or "Skip to mini-game"; cream swirl ≈ 1.2 s between scenes, crossfade in reduced motion):
`OPEN_BOOK → A_VIDEO → B_LAUNCH → C_TRIP_AND_LANDING → D_FIRST_STEPS → E_STORY → F_SUMMARY_AND_ASK → G_CAMERA_CHECK → G_MINIGAME → RESULTS → STAMP → BACK_TO_SHIP`

| Scene | What happens | Input |
|---|---|---|
| Open book | Paper card with a cloth cover, "Open the book" | E · Click · Tap |
| A · Video | 76 s cut of NASA's own Kennedy Space Center film "Apollo 11 Activities" (launch-day ambience, no narration, no music), paper-card player "Apollo 11 · July 1969 · Video: NASA", Play/Pause, Captions (descriptive), Skip. Nova: "Now it's your turn. Let's help the rocket launch." | click |
| B · Launch | Pad 39A morning, Saturn V and tower, venting vapour. Countdown slate T-minus 10. ONE lever: at T-9 "Pull down to start the engines" (drag, Space, ↓, or the Pull button), ignition, smoke rolls sideways, rumble, gentle shake (off in reduced motion). At 0 "Liftoff", then "Push up to climb": the camera rides along, the first stage falls away, the sky darkens, then Earth from space. Never fails (6 s pulse + hint). Cards: launch date and time (F30, F32), Pad 39A (F30), Imagine: "Really, computers and the launch team ran the launch." | lever |
| C · Trip and landing | About three days to the Moon; Collins stays in Columbia; Armstrong steers Eagle past a crater to a safer spot (no fuel seconds); flat dust sheets (no air), engine stop, silence; real NASA audio "Houston, Tranquility Base here. The Eagle has landed." Card "July 20, 1969" | watch |
| D · First steps | Hatch, ladder, pause on the footpad, real NASA audio "That's one small step for [a] man…", a boot print close-up, Aldrin follows, the camera rises to Eagle and Earth | watch |
| E · Story | ~2½ min of short shots with a calm narrator (Kokoro TTS, pre-rendered) and the same line on a caption card: moonwalk, footprints, Columbia, flag, rocks, seismometer, reflector, solar wind sheet, the plaque (real text), ascent, splashdown, scientists today. Pause, Replay line, Skip to summary. Visors down, no faces, no made-up astronaut dialogue | watch |
| F · Summary and ask | "That's what happened on the Moon": 5 lines with line icons. "Ready for a mini-game?" [Yes, let's play] / [Not yet: Watch again · Back to ship] | click |
| G · Camera check | Kid card ("Nothing is saved or sent", grown-ups note). Allow, "Show one hand", "Pinch to start" (calibrates), 3-2-1. Denied or "Use mouse or touch": same game | camera or mouse |
| G · Fill the Rock Box | 90 s + Laser Ping finale. Full-screen mirrored camera, transparent 3D layer, muted low-poly samples (basalt 1.5, breccia 1.0, small rock 0.6, soil bag 0.5, core tube 2.0 kg). Pinch or fist to grab, open hand over the box to drop; mouse/touch drag works the same. Earth items (leaf, raindrop, seashell) go to the "Back to Earth" bin (+2 s). Imagine tag: the real moonwalk took about 2½ hours. Finale: hold on the reflector 1 s, a laser from Earth, the dot comes back: "about 2.5 s round trip, ~385,000 km" (F23, F10). Stars at 10 / 16 / 21.5 kg ("You matched Apollo 11!", F31) | hands or mouse |
| Results, Stamp | Results card + "Scientists still study Apollo Moon samples today." (F34). Stamp by click/tap; the Moon book turns gold, the orrery Moon lights up | click |

**Respect:** the real astronauts keep adult proportions (≈ 6.5–7 heads, never chibi), all-white Apollo 11 suits, gold visors down, no faces, real NASA audio only for the astronauts' words. **No haze, wind or sound on the Moon** (only our music and NASA radio). Moon gravity ~1/6 g (F19). The old Ch1 beats (Find, Wake, Memories, Laser Bounce, Memory Catch) are retired.

---

## §9 ? Chapter 2: Mars - Opportunity, One More Hill

The Mars chapter replaces the old Find/Wake/Marathon Drive/Memory Catch route. Moon completion returns to Nova's two-choice debrief, sourced recap and Mars invitation. Look around first restores walking. The player follows chalk arrows and physically enters a cream/pale-blue book portal. Completed books turn gold; the existing orrery and Hall of Echoes reflect the completed missions.

| State | Behaviour |
|---|---|
| A_VIDEO | JPL's June 2003 prelaunch plan, 90-second edit, always-on descriptive captions, Pause / Replay / Skip. Original audio removed. Cornell attribution and JPL educational-use basis remain in credits. |
| B_LAUNCH | Night at SLC 17B. Shared Moon one-lever controller. Six Delta II Heavy boosters light on the ground, three in the air (NASA/JPL 2003 launch kit pp. 24-25). Compressed timing is Imagine. |
| C_CRUISE_AND_LANDING | Cruise, heat shield, parachute, shield release, approximately 20 m bridle, airbags, backshell rockets, rope cut, repeated bounces and Eagle crater hole-in-one. No bounce count. January 24, 2004 is explicitly U.S. time. |
| D_ROLL_OFF | Airbags pull back, three petals open, solar wings and camera mast unfold; six wheels roll off and leave tracks. The procedural MER has no face. |
| E_STORY | Eighteen sourced lines in ten picture-book compositions, about 162 seconds: grey hematite, ancient water clues, wind cleaning, sand entrapment, marathon milestone, Endeavour, gentle 2018 storm, recovery commands, retirement and Perseverance's 2026 continuation. No invented last words. |
| F_SUMMARY_AND_ASK | Five sourced recap facts. Yes opens camera check; Not yet offers story replay or ship return. |
| G_CAMERA_CHECK | Shared Moon privacy, permission, open-hand observation, pinch calibration and countdown. Denied/missing cameras offer the identical mouse/touch game. |
| G_MINIGAME | Sol Keeper, below. |
| RESULTS / STAMP | Sols, pebbles, cleaning events, stars, replay and stamp. Completion saves Opportunity and swirls back to the ship. |

Shared systems: ordered state/autosave store, source-linked captions, local voice, narration clock, video card, lever controller, rail camera stage, summary, camera check and swirl. Result data survives reload. An interrupted camera game resumes at consent. Deep links `?chapter=2&scene=A` through `G` and Judge Mode jumps are supported.

**Sol Keeper: keep Opportunity rolling.** Only this post-story game and its consent check request hands. Full mirrored camera video has opacity 1, no filters, segmentation, background replacement or dimming. A transparent canvas draws the solar deck, grey pebbles, dust devil and restrained particles. Camera denial uses a neutral cream surface.

- Dust grid 28 x 5; initially 18% dust / 82% power. Dust increases 0.013 per second, then 0.022 after 75 seconds; power = 100 x (1 - mean dust). Help multiplies dust growth by 0.65.
- Both open hands clean independently. Swipe radius 0.075-0.145, strength 0.12-0.62; pointer drag uses the same cleaning function. Phone dust cap 30, larger-screen cap 80.
- Grey pebbles begin near 20 seconds, every 3.2 seconds (2.6 when doing well). Pinch/fist or drag pickup; release into Science Box. Grab radius 0.064, adaptive 0.105. Left-handed mode moves the box.
- Whirlwinds begin at 45 seconds, then at least 20 seconds apart. Point or press-hold 0.5 seconds and steer onto the deck for full cleaning and bonus science. Guaranteed cleaning is Imagine; wind-cleaning facts are sourced.
- About one sol/second while powered. Zero power rests the rover and pauses sols; wiping wakes it. No failure. Sol 90 starts a ten-second celebration filling 60 suns.
- Stars: reach Sol 90; also collect eight pebbles; also trigger one cleaning event. MediaPipe inference is independently capped at 30 Hz.

**Closing and going home.** Nova's closing uses the warm ship, slow push and unlocked brass/marimba layers. Home invitation offers Yes or walking first. Chalk arrows route around the library, through the corridor to the console. Seven controls cover hatch, access arm, guarded internal-power switch, tank-pressure dial, three-team GO poll, forming helmet/visor and Earth throttle. E/Enter and arrows or pointer/touch operate them. The Imagine ship checks are inspired by real NASA countdown activities; this is not a literal Artemis order. In-space travel shows receding Mars, passing Moon, growing Earth and gentle stars, without a homeward liftoff.

**Ending.** Swirl to the original summer street behind the shed; no ring. The chosen child wakes on grass in everyday clothes, with Imagine grey/red shoe dust. Player/seeker/friend roles rotate with the chosen explorer. One leaf hints at the adventure; friends play again and the camera cranes to the pale Moon. Pause / Replay / Skip remain. The end card saves `profile.gameCompleted`; full credits, cover return and replay with the same/new explorer are available. Cover Continue shows Completed.

**Audio and controls.** 55 Mars clips, 33 homecoming/checklist clips and 60 ending clips (15 lines x four characters), all local Kokoro at natural pitch. Exact-audio name fallback says explorer; personal names appear on result/end-card headings. `scripts/RECORDING_LIST.md` covers child recording and consent. Mars uses marimba, low pad and filtered wind; ending returns to street ambience and a quiet end-card chime. Computer: WASD/arrows, Space, E, right-mouse look. Touch: viewport-safe joystick, Jump, Action, drag look. No click/tap movement. Camera stops on exit. Primary captions are >=28 px. Reduced motion holds shots and removes decorative movement.


---

## §10 · Legacy Memory Catch (retired from both playable chapters): the AR "grab the answer" quiz
*(Based on the webcam quiz idea where you grab an answer bubble and drop it into a portal, rebuilt for our story and for players aged 7 and up.)*

### Where it appears
- **During the story:** 1–2 **Quick Catch** moments inside the memory beats (a single question, no score pressure).
- **After the story:** the **Memory Restore** round, with 5 questions (about 2 minutes) before the Stamp. The machine's memory core is broken; every right answer rebuilds a hologram piece of the machine above the core and plays the **next note of its motif**. Five right answers = the whole song plays, and its memory is restored.
- **Replay** any time from the **Mirror Pod** in the Hall of Echoes. Questions are drawn at random from a bank of 8–10 per chapter, so replays differ.

### What we kept from the reference idea
The camera feed as a mirror, grabbing an answer with your hand, dropping it into a glowing portal, big chunky bubbles, and score/streak feedback.

### What we improved
| Reference problem | Memory Catch fix |
|---|---|
| Your messy room fills the screen | **Space mirror:** selfie segmentation puts the kid *on the Moon or Mars* (the chapter scenery behind them). On slower laptops it falls back to a dimmed, softly blurred, colour-graded feed with floating star particles. This also hides the home background for privacy |
| The portal and question card cover the kid's face | **The UI avoids your face:** FaceDetector finds the face box, and the core, question card and orbs reposition to stay clear of it |
| Answers sit at the bottom edge, so kids have to reach | Orbs float at **shoulder-to-chest height** to the left and right, placed using the face box size (about 1.5–2.5 face-widths out) |
| Lives and hearts punish young kids | **No lives.** Stars plus a "Memory restored %" bar. A wrong orb bounces back gently and becomes a **clue card** ("Remember the mirror?"). After 2 misses, Nova makes the right orb glow. Streaks only add sparkle, never a penalty |
| 10 rounds is long | **5 questions**, about 2 minutes, with a rest beat at the end |
| Generic grammar questions | **Story questions** with sources, in several formats (below) |
| Small text on a busy video | Big text (question ≤ 12 words; answers ≤ 3 words + an icon) on solid cards; a 🔊 read-aloud button |
| Only grab and drop | **Grab & Release** for everyone; **Toss** (throw it in) earns bonus sparkle for older kids; magnet assist near the core |

### Question formats
1. **Pick one:** text or picture orbs (e.g. three photos: "Which one is Eagle?").
2. **Number sense:** "How far away is the Moon?" → 385 km / **385,000 km** / 385 million km.
3. **TRUE STORY or IMAGINE?** Two cores; drop each statement card into the right one. This teaches the game's own fact/fiction labels.
4. **Put it in order:** drop 3 event orbs into slots 1-2-3.
5. **Spot it:** grab the real thing (the reflector, a blueberry, the solar panel).

### Starter question banks (every item needs a sourceId)
- **Moon:**
  - What did the astronauts leave so lasers can bounce back? → **Reflector** / Flag / Rover
  - How far is the Moon, about? → **385,000 km**
  - How much does the Moon drift away each year? → **About 3.8 cm** / 3.8 km / Not at all
  - What could the seismometer feel? → **Astronauts' footsteps** / Wind / Music (teaching point: there's no wind on the Moon)
  - Which half of Eagle stayed on the Moon? → **Bottom half**
  - TRUE STORY or IMAGINE: "The reflector needs no batteries" (TRUE) · "Eagle can talk" (IMAGINE)
  - Put in order: Land → Set up science → Top half flies home
- **Mars:**
  - How long was Opportunity planned to work? → **90 days**
  - How long did it really work? → **Almost 15 years**
  - Blueberries are a clue that Mars once had… → **Water**
  - What cleaned its solar panels? → **Wind** / Rain / Astronauts
  - What stopped it in 2018? → **A giant dust storm**
  - How far did it drive? → **Farther than a marathon** / 1 km / 1,000 km
  - What colour is the glow around the Sun at a Mars sunset? → **Blue**
  - Where did it land? → **Inside a small crater**
  - TRUE STORY or IMAGINE: "Opportunity landed in a small crater" (TRUE) · "Opportunity waved at me" (IMAGINE)

### Getting in and out
The machine says *"Let me open a window to Earth… I can see you!"* The 3D world shrinks into a round porthole that opens onto the camera mirror. At the end, the porthole closes back into the world.

### Camera off, or mouse and touch players
The same round plays over the 3D chapter backdrop. The glove avatar or cursor drags the orbs (keys 1-2-3 work too). "Mirror off" is in Settings for kids who'd rather not see themselves.

### Optional Duo Mode (great for classrooms)
`numHands: 4`, two kids side by side, each with their own glove colour. A "Team catch" sparkle when both hold the same orb.

### Privacy
The camera image is only ever shown live. It's never saved, sent anywhere or put in souvenir photos. FaceDetector only gives a box position; there's no face recognition or identity.

---

## §11 · Closed chapters (teasers only for now)

Each sealed book shows a silhouette, a title and **one sourced teaser fact**. Keep the facts below for later builds.

| Ch | Machine | Destination | Teaser line | Source |
|---|---|---|---|---|
| 3 | **Viking 1** lander | Mars · Chryse Planitia · 1976–1982 | "The first spacecraft to land on Mars and do its job." | F6 |
| 4 | **Pioneer 10** | Asteroid belt and Jupiter · 1972–2003 | "The first spacecraft to cross the asteroid belt." | F8 |
| 5 | **Voyager 1** | Interstellar space · 1977–today | "One light-day from Earth on 18 Nov 2026!" (linked to the live panel) | F1 |

---

## §12 · Art direction: Mistwood Cottage Visual Style (Default)

> [!NOTE]
> The default visual look is restyled to **Mistwood Cottage** by Amira Deuraseh (CC BY 4.0).
> The previous "Quiet Afternoon in Space" (Summer Afternoon-inspired) rendering path remains preserved and accessible under `?style=legacy`.

**Visual Direction:**
- **Tone mapping & Renderer:** WebGL antialias, `THREE.CineonToneMapping` at exposure `1.75`, clear colour `#211d20` (Moon: `#000000`). Pixel ratio `min(window.devicePixelRatio, 2)`. Zero bloom pass, zero LUT grading, zero near-camera line dither in the modern path.
- **Lighting & Materials:** Unlit/baked lighting model via `MoodLitMaterial` (two-tone sun shade with ~20% mood tint and baked AO support), `EmissiveGradientMaterial` (radial & linear gradients on lamps, fixtures, and pedestals), soft contact blob shadows (`BlobShadow`) instead of heavy real-time cascades.
- **Sky & Atmosphere:** Linear fog `#dfe9f3` on Earth/Base exteriors (near ≈ 1.4 H, far 43–86 H). Moon has zero atmosphere or fog. Mars features butterscotch sky, dust haze, and an ancient sea `<GhostWater />` FBM wave layer on the blueberries beat.
- **VFX:** Ambient fireflies (`Fireflies.tsx`) with safe `pow(abs(cos(x)), 0.5)` flicker, cozy rising steam (`Steam.tsx`) on mugs and thermal vents.
- **UI & Typography:**
  - Solid `#566095` midnight blue panels (`border-radius: 1em 0 1em 1em`, 2px solid `rgba(255,255,255,0.85)`).
  - Pill buttons with 2px white borders (`border-radius: 999px`).
  - Signature blue-on-white active/hover button highlight (`#0000ff` text on `#ffffff` background).
  - Dark grain `#0c0a09` backdrop screen with tiling noise grain (`/textures/grain.png`).
  - Typography: **Bigelow Rules** 400 for titles and display headings; **Roboto Mono** for UI, body, labels, and monospace readouts; **Lexend** for Easy-read; **OpenDyslexic** toggle.
  - Cursors: Kenney CC0 hand cursor suite (`hand_open.svg`, `hand_closed.svg`, `hand_point.svg`).
- **Character Designs:** Four distinct kid characters redesigned from turnaround reference images (Maya, Leo, Amara, Migo) preserving shared animations, rig, and suit customization.
- **Audio & Gameplay:** Frozen. No copy, dialogue, audio timing, physics, or input mapping changed.

- **Shading = painted ramps:** every world mesh uses the shared ramp material (`src/fx/ramp.ts`). Colour comes from palette rows (`src/fx/palette.ts`, the §6 MASTER table): `rampX = (N·L remapped 0..1) × smoothstep(0.1, 0.9, shadow)` picks one of three flat bands. Faceted normals for terrain, props and characters; smooth only where a curve must read (cables, rails).
- **Removed for good:** oversized heads and cartoon proportions, faces on robots and screens, outlines, Bloom, glow, tilt-shift, N8AO, squash and stretch, hit-stop, particle bursts, confetti, floor sparkles, bunting and string lights, planet mobiles, the cleaning robot, floating 3D labels, emoji, babble voices and the typewriter effect.
- **Lights:** hemisphere `#33434F` / `#737575` (~0.7) + one warm, low sun (`#FFE9CF`) following the player with a tight shadow frustum (2048 map, normal bias 0.07): long soft shadows in the base. Moon: harsh, low sun, crisp very dark shadows. Mars: warm sun, softer shadows. Warm linear ceiling fixtures and faint gradient-plane light shafts in the base.
- **Atmosphere (HSV distance fade):** base 15 → 60 units (S → 0.35, V → 0.75); Mars 25 → 150 (S → 0.25, V → 0.72); **Moon: none (no air, no drifting shadows, no sway).**
- **Drifting light:** base dapples (0.85–1.0); Mars dust-haze shadows (0.7–1.0); **Moon: none.**
- **Near-camera line dither:** non-character meshes within 1.5–2.0 units of the camera fade with a thin line stipple instead of clipping.
- **Sky:** base space `#1B2230` → `#3A4656` with a nebula band `#E8D5BC` at 10–20 %; Mars butterscotch with a thin dust band and a blue glow at sunset; Moon true black with a crisp Earth.
- **Grade:** one fullscreen pass: SMAA + a generated 3D LUT per world (base warm cream with lifted, desaturated warm-grey blacks; Moon neutral silver; Mars ochre), soft contrast.
- **Chapter colours** (covers, stamps and cases only): Moon `#9A9C9F` / `#5F6266`; Mars `#B8714F` / `#7A4632`; sealed chapters graphite.
- **Echo Ranger (the old default explorer, used only by saves without a kid):** about 6.4 heads tall (the four kids of §21/§22 are moderate chibi), low-poly faceted and ramp-shaded. Indoors: a bone flight suit with accent panels and a terracotta shoulder patch, **no helmet**. On the Moon and Mars: an EVA suit with a correctly sized helmet, a **gold visor `#A8936A`** and a backpack. The suit option changes only the accent panels (HSL saturation 0.4, lightness 0.3). Animations: idle (breathing), walk, run, air, sit, bored (looks up at the dome).
- **Nova:** a matte drone about 0.5 m across, bone body, graphite underside and **one cream light ring `#FFE9C7`**. No face; it talks with its light, a small tilt and a slow hover bob. In 2D it is a line drawing.
- **Glove avatar:** matte bone gloves with a graphite outline and graphite cuffs, no glow; a thin sage cuff light (terracotta while a hold is confirming). Prompts and the Glove Academy show a plain line drawing of a real hand (stroke `#716C66`, 2 px).
- **Machines:** realistic shapes and muted real colours, no faces, steady status lights.
- **UI theme "stacked paper":** a light card `#F9F2E4` over a shadow card `#BAB3A5` translated 9 px and **rotated 0.8°**, radius 5; 2 s pop with `cubic-bezier(0.5, 0, 0.1, 1)`, text fading in afterwards. Toasts `#FFF6E3` on `#B5A997`. Headings `#5D5A57`, body `#6B665E`. Buttons: neutral `#F9EFDC` (shadow `#716C66`, text `#3B3936`), primary sage `#4F6D60` (text `#FBF6EC`, shadow `#2F3A3F`), one terracotta action `#9A5639` per screen (shadow `#5C3322`). Focus ring 3 px `#5D5A57`. Tags: "True story" `#E3E8E9`/`#3B464C`, "Imagine" `#EFE6D3`/`#5C4F37`, 20 px, radius 4. Corner nav (sound, suit accent, Passport, settings, info) with the curiosity counter tag; it replaces the old menu star and avatar badge. Kid sizes: ≥ 64 px visible, ≥ 96 px hit area.
- **Type (§6B, self-hosted, OFL):** **Stylish 400** for all UI and story text (−0.03 em, sentence case); **IBM Plex Mono 400/500** (+0.08–0.12 em) only for in-world technical text, the only place ALL CAPS is allowed; **Lexend 400** for Easy-read and long reading (Logbook, grown-ups notes, 20 px / 1.5); **OpenDyslexic** toggle. No weights above 400 (Plex Mono 500 only), no outlined, glowing or gradient text. Sizes: modal title 45, story line 30 (min 28), speaker 22, prompt action 26, hints 22, tags 20, settings labels 26, counter 33, loader title 50 with one sourced tip at 26. The full list is `docs/audit/master/TEXT_INVENTORY.md`.
- **Dialogue box:** bottom centre, max 760 px, speaker name over a thin rule (no portrait circle), the line at 30 px fading in as a whole over 0.6 s with one soft tick, a tag clipped to the top-left at −3°, and a tilted "Continue" button.
- **Writing voice:** calm and observational, 15 words or fewer, "you" for narration, first person for machines, sentence case, no emoji, at most one "!" per chapter, no sound words. Every change is logged in `docs/copy-changes.md`.
- **Motion language:** eases inOut1 (0.5, 0, 0.1, 1), inOut2 (0.56, 0, 0, 1), inOut3 (0.6, 0, 0, 1), inOut4 (0.4, 0, −0.06, 1); slow and calm: card pops 2 s, nav slide 0.75 s after the boot, overlay wash 1 s, reveal 4 s, intro dolly 6 s, appear pops 0.35 s. Boot: cream loader, then a 4 s swirl dissolve into the base. Every modal washes the scene toward cream (90 %, 1 s). Reduced motion turns off the drift, sway, orrery turn, motes and camera breathing.
---

## §13 · Camera and movement

- **Base:** a calm, low follow camera: FOV 45, offset ≈ (0, 1.4, −8) behind the 1.7-unit explorer, horizon at ~45 % of the screen. Frame-rate-independent damping (rotate 0.075, zoom 0.05, pan 0.15, 0.175 on touch). Auto-aligns behind the player only while moving; while idle it drifts back very slowly (× 0.025) and never fights a manual drag. Pointer parallax up to ±(0.075, 0.05)·π/2 rad (eases back on release); an always-on, very subtle "breathing" sway (0.08, 0.08, 0.02 rad at speed 0.2). The hull clamp is the collision zoom. Drag to orbit, wheel to zoom, a whole-diorama zoom-out, fading occluders and a near-camera line dither. Boot dolly: starts 12 units further out and settles in 6 s.
- **Chapters:** authored shot rails (`CatmullRomCurve3` + drei `CameraControls`):
  - a swoop-in when you arrive
  - a low-angle hero shot when the machine wakes
  - slow push-ins during memories
  - **a locked or slow camera during gesture missions**, so the hand-to-screen mapping stays predictable
- **Trauma-based shake** for launches and landings; off in reduced-motion mode. Reduced motion also turns off parallax and breathing.
- **Movement:**
  - acceleration and deceleration curves (never instant starts or stops); a small hop (Space or a second-finger tap) with a snappy-floor, slightly floaty feel
  - gravity per place (Moon ≈ 1/6, Mars ≈ 0.38): floaty hops and clean dust arcs on the Moon, wind-blown dust on Mars
---

## §14 · Audio, all made in JavaScript

**Stack:** **Tone.js** (music and mixing), **ZzFX** (procedural sound effects), and the Web Audio API (ambience). Audio starts on the player's first gesture.

- **Base theme "Starship Lullaby":** ~88 BPM, Lydian mode, Rhodes/celesta plus a warm pad. **Each machine you wake adds its instrument** (Eagle: warm brass synth; Opportunity: plucky marimba). The locked chapters' instruments are kept for later.
- **Motifs:** a 4-bar phrase per machine. **Memory Catch plays it one note per correct answer**, and on the fifth answer the whole phrase blooms.
- **Musical gestures:** gesture sounds are pitched to the current key and lightly snapped to the beat (pinch = a note, wave = an arpeggio sweep, wake = a chord swell).
- **Ambience:**
  - Moon: silence outside; helmet breath and hum
  - Mars: filtered wind with gusts
  - Base: soft hum, a low engine hum near the Launch Bay
  - Memory Catch: a light rhythmic loop that speeds up a little with each streak
- **Sound effects:** page turn, book open, portal swell, soft shimmer, warp riser, landing thud, dust puff, wake chime, data chime, answer pick-up and drop, correct chime, gentle "try again" (never a buzzer), stamp, UI ticks, rover motors, laser fire and return.
- **Mixing behaviour:** audio starts on the first interaction and the master fades in (time constant ≈ 1 s) to ≈ 0.25 of max; mute/unmute fades 0.25 s / 0.5 s; a hidden tab fades out (0.5 s) and back in (2 s); any open modal ducks music and ambience to 40 % over 1.35 s; position-based ambience crossfade (Cozy Corner hum ↔ Launch Bay engine hum; Mars wind louder near the crater rim); footsteps follow speed (power2.in of fit(speed)) — helmet-muffled thumps on the Moon, quiet muffled steps on Mars; UI click at 0.25.
- **Voices:** no babble. Each caption line arrives with **one soft tick**, and an optional **"Read to me"** reads it with the browser's speech synthesis. Music ducks under speech. Volume sliders for Master, Music, SFX and Voice.

---

## §15 · Accessibility, privacy and kid safety

- Three complete input modes (Gestures, Touch, Mouse/Keys); switch at any time.
- Reduced motion, a single soft flash (never strobing), captions always on, text size setting, OpenDyslexic, high contrast, and colour-blind-safe states (never colour alone).
- **No accounts and no personal data.** Local Explorer profiles (callsign + avatar) in `localStorage`.
- The camera is opt-in, with a kid-friendly explainer and a "For grown-ups" note. Frames never leave the device and are never saved; a camera-on indicator is always shown; the whole game is playable with the camera off.
- Autosave after every beat. Rest reminders.

---

## §16 · Accuracy

- All story and quiz text lives in `src/content/` JSON. Each line has `type: "fact" | "imagine"`. Every fact line points to `sourceIds` in `sources.json`.
- In the game, every card carries a 🛰 TRUE STORY badge (tap it to see "How do we know?" and the source) or an ✨ IMAGINE badge. The **Mission Logbook** lists every fact with its source.
- **Dev-mode only:** in development, a console warning appears for any fact without a source, any line over 15 words, or any "Never say" phrase. A `/dev/facts` page lists them all. **It never blocks a build. There is no CI.**

### Verified fact sheet (⚠ = verify before using)

| # | Fact | Source |
|---|---|---|
| F1 | Voyager 1 is one light-day from Earth on **18 Nov 2026, 2:16:07 a.m. PST (10:16:07 UTC)**: 16,094,799,096 mi / 25,902,068,356 km | science.nasa.gov/?p=338314 |
| F4 | Opportunity: launched 7 Jul 2003; landed Jan 2004 (24 Jan US time / 25 Jan UTC); last contact **10 Jun 2018**; mission ended 13 Feb 2019; **45.16 km**; first to go farther than a marathon on another world; its record stood until **Perseverance passed it on 11 Oct 2026** | science.nasa.gov/mission/mer-opportunity/ |
| F5 | Designed for 90 Martian days and 1,000 m; lasted about 60 times longer than planned; more than 1,000 recovery commands; final resting place Perseverance Valley | nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end |
| F6 | Viking 1 made the first truly successful Mars landing (1976); it operated until 11 Nov 1982 | science.nasa.gov/mission/viking-1 |
| F8 | Pioneer 10 was the first spacecraft through the asteroid belt (1972–73) and the first past Jupiter (Dec 1973); its last signal arrived 23 Jan 2003 | science.nasa.gov/missions/pioneer/10-things-pioneer-days/ |
| F10 | Apollo reflectors need no power; the Moon is about 385,000 km away on average and recedes **3.8 cm per year** | nasa.gov/solar-system/the-apollo-experiment-that-keeps-on-giving/ |
| F11 | Apollo 11's seismometer could detect the astronauts' footsteps | physicsworld.com/?p=81310 |
| F12 | The Apollo 11 seismometer was the **first seismometer on the Moon** and sent data for **about three weeks** | science.nasa.gov/resource/apollo-11-seismic-experiment/ |
| F13 | The Apollo 11 reflector is an array of **100 fused-silica cubes** aimed at Earth; Apollo 11 was a simpler test mission with only two main experiments | nasa.gov/history/alsj/HamishALSEP.html |
| F14 | Opportunity's landing is called a **"hole-in-one"** because it came to rest inside a small crater (Eagle crater); it found hematite as small balls nicknamed **"blueberries"**, iron-rich concretions formed in deposits **soaked with groundwater**; the landing site was once the **shoreline of a salty sea**; it got **stuck in a sand dune for over a month** | NASA Mars rovers mission page (archived): webarchive.library.unt.edu/web/20201219070427/https://science.nasa.gov/missions/mars-rovers |
| F15 | Passing winds often cleaned Opportunity's solar panels and gave it energy boosts, helping it survive years past its 90-day plan | nasa.gov/?p=70994 |
| F16 | Mars dust scatters blue light forward, creating a bluish glow near the setting Sun (Spirit 2005; Pathfinder PIA00917 explains it too) | science.nasa.gov/photojournal/the-sun-sets-on-mars/ ✅ verified in v4.2 |
| F17 | Opportunity's lander **bounced 26 times** before rolling into a small crater (the "hole-in-one") | appel.nasa.gov/2024/01/11/this-month-in-nasa-history-opportunitys-hole-in-one ✅ (the ~220 yd distance stays ⚠ unused) |
| F18 | Perseverance passed Opportunity's off-world driving record on **11 Oct 2026** (45.22 km vs 45.16 km) | science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/… |
| F19 | Moon surface gravity 1.62 m/s², **0.165 of Earth's (≈ 1/6)** | nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html |
| F20 | Mars gravity **≈ 0.38 of Earth's**; a sol ≈ 24 h 40 min; two moons, Phobos and Deimos | nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| F21 | Apollo 11 launched 16 July 1969 and Eagle landed 20 July 1969: **about 4 days** (Reality Check panel) | nasa.gov/missions/apollo/apollo-11-mission-overview/ |
| F22 | Eagle crater is about 22 m wide, at 1.95°S, 354.47°E in Meridiani Planum | jpl.nasa.gov/images/rovers-landing-hardware-at-eagle-crater-mars (PIA21494) |
| F23 | A laser pulse to the Moon and back takes **about 2.5 seconds** | ssd.jpl.nasa.gov/ftp/eph/planets/ioms/LLR_Model_2020_DR.pdf |
| F24 | MER top speed 5 cm/s on flat hard ground, about 1 cm/s on average with hazard checks (NSSDCA lists ~3.75 cm/s, so say "a few centimetres a second") | jpl.nasa.gov/news/press_kits/merlaunch.pdf ✅ |
| F25 | No wind on the Moon, so footprints can last for millions of years | starchild.gsfc.nasa.gov (Apollo 11) |
| F26 | The Apollo 11 seismometer stopped responding on 25 Aug 1969 (overheating): about 3 weeks of data | nasa.gov ALSJ, HamishALSEP |
| F27 | Tranquility Base (Eagle landing site) 0.67416°N, 23.47314°E, from Lunar Reconnaissance Orbiter images | nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C ✅ |
| ⚠ | Descent-stage foil: art may look gold/amber, but never state the material as a fact | — |

### Never say
- ❌ "My battery is low and it's getting dark." A journalist's poetic summary, **not** a real Opportunity message.
- ❌ "Opportunity still holds the driving record." It was passed on 11 Oct 2026.
- ❌ Sound outside on the Moon. Wind on the Moon.
- ❌ An exact number of seconds of fuel left during the Eagle landing (unless sourced).
- ❌ "Eagle's seismometer still works." It stopped in 1969. (The *reflector* still works.)
- ❌ "The Moon drifts away as fast as your fingernails grow." A popular comparison with no NASA source.
- ❌ "The lander is covered in real gold." The foil looks gold; don't claim the material.
- ❌ Pioneer 10 or Voyager 1 drawn sitting on the ground. They fly in space.

---

## §17 · Assets, licences and Space Apps rules

- **Space Apps:** cite **every** resource, open source included, or awards can be removed. Third-party materials must be openly licensed. **No NASA insignia ("meatball"), logotype ("worm") or mission patches.** Don't imply NASA endorses the game. Keep `CREDITS.md` complete.
- **NASA 3D Resources** (science.nasa.gov/3d-resources, mirrored on GitHub at nasa/NASA-3D-Resources): free GLB models, including the **Apollo Lunar Module** and the Mars rovers (search the catalogue). Follow NASA's media guidelines. Optimise with `gltf-transform`.
- **NASA images and textures** (Moon and Mars globe maps, Opportunity photos): generally public domain. Check each item for third-party credits.
- **CC0 kits:** Quaternius *Ultimate Space Kit* and *Sci-Fi Essentials Kit*; Kenney *Space Kit* and *Space Station Kit*.
- **Code:** MIT/Apache/BSD only. Don't copy GPL code in. **Never** use copyrighted characters, music or fonts.

---

## §18 · Tech architecture (localhost)

```
src/
  input/     MediaPipe wrapper, features, verb state machines, 1€ filters, intents, fallbacks, recorder
  ar/        Memory Catch: mirror view, segmentation background, face-aware layout, orbs, cores, question runner
  audio/     Tone.js engine, motifs, ZzFX bank, ambience, babble voices, mixer
  story/     chapter state machine (Arrive→Find→Wake→Remember→Mission→Discover→MemoryCatch→Stamp)
  portal/    book summon/open/dive
  base/      Odyssey Base zones, Dusty, planet mobiles, Hall of Echoes, live Voyager panel
  chapters/  ch1-moon-eagle/, ch2-mars-opportunity/  (lazy-loaded)
  content/   chapters/*.json, questions/*.json, sources.json, glossary.json
  ui/        SVG icons, HUD, glove avatar, hand coach, Passport, Logbook
  fx/        post-processing presets, particles, camera shake
```
- **Run:** `npm run dev` on localhost (the camera works on localhost without HTTPS), plus `launch_game.py` on port 8391 for app mode. No deploy step for now.
- **Performance:**
  - 60 fps target on an integrated-GPU laptop (DPR capped at 1.5, adapted with `PerformanceMonitor`)
  - gesture inference ≤ 15 ms
  - Memory Catch pauses the heavy 3D scene while the mirror is showing
  - each chapter is lazy-loaded
- **Debug flags:** `?debug=gestures`, `?judge=1`, `?chapter=1&beat=3`, `?catch=moon`, `?reduceMotion=1`, `?mirror=off`.

---

### §18.1 · Performance findings (Radeon 680M iGPU, 1440×900)
- v3 hub before any v4 work: **49–55 fps**, p95 frame 28–41 ms. DPR is now capped at 1.5.
- Gloves on, live base: **~38 fps** (worker), because tracker inference and the 3D scene share one GPU.
- Plan (Prompt 3): pause or simplify the 3D scene behind full-screen UI (done for input overlays); a "gloves on" quality preset (no N8AO, tilt-shift off, DPR 1); run the tracker at ~20 Hz in scenes without fast gestures; instanced props; baked shadows. Memory Catch already pauses the 3D scene by design.
- Done in Prompt 3: auto quality starts **Low** (no post-processing, native MSAA, CSS vignette) and upgrades to **High** (Bloom, tilt-shift) only when the PerformanceMonitor sees headroom; **N8AO is opt-in** (it cost ~15 fps); gloves on forces Low. Measured 63–98 fps across base views on the test laptop (large run-to-run variance).

---

## §19 · Scope and Judge Mode

| Must work (P0) | Nice to have (P1) | Later |
|---|---|---|
| Gesture engine (mini-games only, §5.2); Odyssey Base redesign; Story Portal; **Ch1 Moon complete**; **Ch2 Mars complete**; Memory Catch with segmentation fallback; sealed Ch3–5 teasers; audio core; Judge Mode | Duo Mode; helmet overlay; Toss bonus; printable Passport (canvas → PNG) | Ch3 Viking 1, Ch4 Pioneer 10, Ch5 Voyager 1, finale "Homeward", deployment |

**Judge Mode** (`?judge=1`, or the "Mission Control" button on the title screen):
- unlocks Ch1 and Ch2 (Ch3–5 stay sealed)
- jump to any beat
- a **5-minute guided path:** Moon story → Moon "Fill the Rock Box" → Mars Memory Catch
- a TRUE STORY/IMAGINE overlay
- a "Learning goals" panel per chapter

---

## §20 · Modern game references (borrow the idea, never the assets)

| Game | Borrow |
|---|---|
| **Astro Bot** | A clear response to every input, a collection room |
| **Captain Toad: Treasure Tracker** | A compact rotating diorama base |
| **It Takes Two / Tearaway / Paper Mario** | Paper and book worlds, diving into a page |
| **Outer Wilds** | Musical motifs that come together; discovery-led learning |
| **Animal Crossing** | Cozy UI, Animalese voices, a museum shelf |
| **Tetris Effect** | Player actions that make music |
| **Just Dance / Kinect-era party games** | A mirror view of yourself, big readable prompts, no-fail fun |
| **Pokémon Snap** | Photo framing as a joyful verb |
| **Super Mario Odyssey** | A souvenir for every world; a ship as home base |


---

## §21 · Opening sequence and player profile (v4.4) — SUPERSEDED by §23 (only the name rules and local-only saving remain)

Script: `docs/design/INTRO_CONCEPT.md` (exact lines in `apps/web/src/content/intro.json`, all `type: "imagine"`). Code: `apps/web/src/screens/` (Cover, CharacterSelect, NameEntry, Opening), `apps/web/src/intro/` (street, portal, chalk arrows, transformation, HUD, voice, ambience, arrival), `apps/web/src/story/intro.ts` (state machine, autosaved), `apps/web/src/characters/` (the four kids).

**Flow:** Cover (Start · Continue as <Name> · Settings · Credits; Judge Mode adds Skip intro) → pick 1 of 4 kids (Maya, Leo, Amara, Migo; hover, tap or ← →, then "Choose this explorer") → "What should we call you, explorer?" → S1 summer afternoon (crane down, the seeker starts counting) → S2 find a hiding spot (WASD/arrows, click or tap the ground; decoys: bush, wall; near the shed a hum and self-drawing chalk arrows; an edge arrow when the ring is off screen) → S3 the ring of light with the Moon and a tiny lander inside → S4 Nova on the far side, three choices (buttons or 1-2-3; each question once) → S5 walk into the ring ("…twenty! Ready or not") → S6 the suit forms piece by piece (boots, gloves, suit, backpack, helmet with the visor down and up, name patch), each with a rising chime → S7 on the ship, helmet off, Nova's welcome, the floor trail leads to the Moon book. About 2½–3 min; every cutscene has captions, Pause and Skip.

**Rules:** no camera and no hand tracking anywhere in the opening. Earth gets the full afternoon look (sky, cloud shadows, haze, sway, grass bending away from the player); the Moon seen through the ring has none of that (black sky, no haze). No flashes; reduced motion crossfades S6.

**Player profile** (local save, versioned): `characterId`, `playerName` (shown as typed), `playerPatch` (capitals, for the suit patch), `accentColor`, `introDone`, `arrival`, `createdAt`. Saved only in this browser, never sent anywhere (a dev check warns if the name appears in any fetch/XHR). The name appears in Nova's captions where the voice allows, on the suit patch, the Passport ("Explorer: <Name>"), results cards ("Well done, <Name>"), the certificate and "Continue as <Name>". Settings → Explorer: Change explorer name, Change explorer look, Replay intro, Delete my save (with a confirm card). Older saves migrate as "intro already seen".

**Names:** 2–12 characters, letters (accents, ñ), numbers, spaces, hyphens; not numbers only; a small local rude-word list (English + Filipino/Tagalog) checked on a squashed form (spaces/dots/hyphens removed, 3→e 1→i 0→o 4→a 5→s). Messages inline, never a popup. Random names: Comet, Orbit, Pebble, Starling, Luna, Rocket, Meteor, Juno, Atlas, Sky, Pixel, Ember, Cosmo (never "Nova"). While the name box has focus no game key does anything. `apps/web/src/profile/name.ts`, tests in `tests/name.test.ts`.

**Voice:** narrator `af_heart`, Nova `bf_emma` (Kokoro-82M, pre-rendered, same as Ch1). Lines with {name} play their pre-rendered "…explorer" version and the caption shows exactly that. The personalised in-browser voice is not built: it would ship eSpeak NG (GPL-3, inside kokoro-js's phonemizer) and an ~90 MB model in the game. The seeker's counting uses placeholder voices at natural pitch until the team records real kids (`scripts/RECORDING_LIST.md`).

---

## §23 · The new flow and Nova, the talking host (v4.5)

**Flow.** COVER (3D: the Starship Odyssey, the grey cratered Moon close and big, Mars, Earth, a ringed
planet, slow shooting stars, Nova waving; "Start my learning experience!") → NAME CARD (first time only;
Nova peeks over the card; the §21 name rules, profanity filter and Random name; saved only in this
browser) → DASHBOARD (a cozy ship room: big round window with the Moon and Mars, lamps, plants, rug, star
chart, the mission wall with five big 3D icons of our own design: Moon/Eagle, Mars/Opportunity, and three
sealed "Coming soon"; static camera with gentle parallax; Nova floats nearby; the Nova card at the bottom;
the round Ask Nova button) → MISSION → DASHBOARD. Settings (gear, top right, everywhere): Nova's voice and
volume, text size, easy-read font, reduced motion, device layout (auto/computer/tablet/phone), microphone,
the AI service, "Forget my name and progress". Judge Mode: `?judge=1` jump strip.

**Missions.** Dashboard icon → confirm card ("Start the Moon mission?" Let's go! / Not yet) → NASA video →
launch lever → trip and landing (the Mars roll-off stays) → STORY FILM → NOVA CHECK-IN → camera check →
mini-game → results + stamp → dashboard (one short Nova line; after both: "You've finished all the open
missions, {name}! More are coming soon…"). The summary card is gone.

**Story films.** Ten shots each, same narration, facts and durations; after-p2 look; power2.inOut moves
then holds ≥ 2.5 s; soft wipes, irises, a dust swirl and match cuts; 3D diagrams in the shots; bottom
30 % kept for the live caption card; the narration is the master clock; pause / replay / skip; phones
play the 720p render of the same module (`docs/design/ANIMATION_PIPELINE.md`).

**Nova check-in.** Nova flies in from the side over the story's last frame (dimmed 20 %): How was the
mission, {name}? → Did you learn something? (+ one sourced fun fact) → Any questions? (mission-scoped chat,
"Any other questions?") → Ready for a mini-game? (or back to the story).

**Nova.** A cute astronaut, ~2.5 heads, face always visible through the visor, 8 expressions, gestures,
lip sync from his voice. Every line is spoken and shown. Brain: the Claude API behind a code guard (NASA
and space only, personal details stripped, the name never sent to a third party, safety line for worrying
messages, 60-word cap, nasa.gov links only, no unsourced numbers, no chat stored, 1 per 3 s and 40 per
session). Offline: the game's own fact sheet. Full spec: `docs/design/NOVA.md`.

**Style.** after-p2 (`docs/research/after-p2-style.md`) + colour ≈ 65/25/10, painted texture + hatch +
paper grain, outlines (Nova 3 px, objects 2–2.5 px, environment 1.5 px, warm dark, fading with distance),
cream cards (#FFF8EC, 3 px #3A2A24, 20 px, Lexend 500 ≥ 28 px; 24 px on phones, ≤ 45 characters, ≤ 3 lines).

