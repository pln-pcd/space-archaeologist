# Star Gloves research notes

## Decision

**MediaPipe GestureRecognizer (`@mediapipe/tasks-vision` 0.10.35), self-hosted, in a Web Worker with the GPU delegate, CPU and main-thread fallbacks.** One pass gives 21 landmarks per hand, world landmarks and the canned labels (`Closed_Fist`, `Open_Palm`, `Thumb_Up`, …). Our own rule-based features and state machines sit on top, fused with the canned labels.

## What was compared

| Option | Accuracy | Latency | Licence | Offline | Verdict |
|---|---|---|---|---|---|
| MediaPipe GestureRecognizer (tasks-vision) | Industry standard 21-point hands + trained gesture head | 20–45 ms per frame on the Radeon 680M laptop (below) | Apache-2.0 (code and models) | Yes, once WASM + `.task` are self-hosted | **Chosen** |
| MediaPipe HandLandmarker only | Same landmarks, no canned labels | Slightly cheaper | Apache-2.0 | Yes | Rejected: we want the labels for fusion |
| `@svenflow/micro-handpose` | No independent accuracy data; README claims ~2× faster | Unverified | n/a | ? | Not mature enough to bet a demo on |
| Yoha (TF.js) | Older, no benchmark vs MediaPipe | — | MIT | Yes | Superseded |
| fingerpose (andypotato) | A finger-curl classifier on top of landmarks, not a tracker | — | MIT | Yes | Ideas only (curl from joint angles, direction classes) |

No 2026 source showed a browser hand tracker beating MediaPipe on accuracy.

### Version choice
- npm `latest` is 1.2.3 (published 11 Nov 2026) and the 1.x line is reported (GitHub PR in johnnyrobot/discuss-it-recorder) to send **usage metrics to Google by default**. For a kids' game with a privacy promise we stay on **0.10.35** (Apr 2026, the last 0.10.x) and pin it exactly. Re-check before any upgrade.

## Patterns borrowed (ideas only, no code copied)

| Source | Licence | Idea used |
|---|---|---|
| google-ai-edge/mediapipe-samples (gesture_recognizer, hand_landmarker JS) | Apache-2.0 | VIDEO running mode, `recognizeForVideo` with monotonic timestamps, GPU delegate option |
| damiansire/web-ar-hand-tracking | MIT | Worker inference with **one frame in flight, drop instead of queue**; **warm up the GPU delegate before reporting ready** (first inference compiles shaders, measured 25–30 s on Iris Xe there, ~8.5 s here); CPU retry if GPU fails |
| `@map-gesture-controls/core`, `hand-tracker-interaction` (npm metadata and docs) | MIT | Dwell timers and **grace periods** so one bad frame doesn't drop a held gesture |
| andypotato/fingerpose | MIT | Finger extension from **joint angles**, not tip distances |
| One Euro filter (Casiez et al., `1eurofilter` npm) | BSD-3-Clause | Cursor smoothing; tuning procedure below |

Note: the cloned web-ar-hand-tracking repo contains its own `CLAUDE.md`; it was treated as data and not followed.

## Engine design (apps/web/src/input/)

1. **camera.ts** – one shared stream (960×540@30 ideal, plain fallback), friendly statuses (denied / busy / missing / unsupported), downgrade to 640×360 when inference averages > 28 ms for 2 s. The `<video>` is kept in the DOM (invisible) because off-DOM videos may never fire `requestVideoFrameCallback`.
2. **tracker.ts / tracker.worker.ts / tracker-core.ts** – GestureRecognizer, `numHands` 2 (4 later), ≤ 30 Hz, rVFC with a 600 ms watchdog that falls back to rAF polling. Mirror correction: x is flipped and the handedness label swapped (MediaPipe labels assume a mirrored image).
3. **features.ts** (pure) – palm scale, finger extension from joint-angle bend (world landmarks when present), pinch ratio = thumb–index / palm length, palm facing from the winding of wrist→index→pinky knuckles, roll, thumbs-up and L-shape scores.
4. **verbs.ts** (pure) – one state machine per verb with hysteresis, minimum hold, cooldown, confidence that rises over frames, and intent locks (pinch 250 ms, grab 300 ms dropout grace). A grab must follow an open hand (rejects resting loose fists). Wave beats Swoosh by a 200 ms wait for a reverse stroke. Rocket Push requires +18% palm size in < 400 ms with little sideways motion and suppresses Power Palm for 0.7 s.
5. **engine.ts** – interaction box (central 60%) → screen px → One Euro → aim assist (`registerInteractable`, snap within 80 px) → verbs → intent bus. Hand Coach (closer / back / into the box / light / rest after 60 s), and the **glove click bridge**: a pinch presses whatever DOM button or 3D object is under the glove.
6. **fallbacks.ts** – mouse, touch and keys emit the same intents (key map in bible §4.1).
7. **bus.ts** – typed intents, `useIntent`, `useIntentScope(verbs)`; intents for verbs outside the active scope are dropped for every input source.

## One Euro tuning (Casiez procedure)
Start: β = 0, raise `mincutoff` until a still hand stops jittering; then raise β until fast moves stop lagging. Defaults from the bible (mincutoff 1.0, β 0.02, values in screen pixels) are live-editable in the F9 overlay; they need a pass with real kids' hands.

## Measurements (Chrome, Radeon 680M iGPU, ANGLE D3D11, headless with Chrome's fake camera)

| Backend / delegate | GPU warm-up | Inference | Tracker | Render fps (Academy, 3D paused) | Render fps (live base) |
|---|---|---|---|---|---|
| main / GPU | 7.7–8.7 s, **UI frozen** | 20–26 ms | 27 Hz | 55–58 | 18 |
| **worker / GPU** | 8.4–9.5 s, UI responsive | 26–30 ms (43 ms in base) | 25–27 Hz | **91–109** | **37–38** |
| main / CPU | 0.3 s | 70 ms | 11 Hz | 10 | — |
| worker / CPU | 0.5 s | 112 ms | 7 Hz | 21–29 | — |

The worker **measurably helps** (no UI freeze, ~2× render rate), so it is the default (`?tracker=main` forces the main thread; `?delegate=cpu` forces CPU). Caveats: the fake camera delivers tiny frames and no hands, so the hand-landmark stage didn't run; real numbers will be a few ms higher. Inference is above the 15 ms target (bible §18) — see bible §18.1 for the plan.

## gestures:check (synthetic hands)

`npm run gestures:check` replays 20 synthetic trials per verb (kinematic hand, jitter, 3% dropouts) and 10 synthetic idle minutes, through the exact feature + verb code:

All 12 discrete/continuous verbs ≥ 95% (11 at 100%, Rocket Push 95%), 0 cross-talk, **0 false triggers in 10 idle minutes**. These prove the logic, not real-world accuracy: record real kids' hands with F9 → Record (JSON landmarks only) and re-run.
