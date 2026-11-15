# The four kids (CUTE POLISH v2, bible §22 A2)

Reference sheets are kept **outside the repo** (`/tmp/refs/kids/ref_K1..K4.jpg`); they are references only, never traced or shipped. Sheet 3 carries a stock-image watermark, so it must never ship in any form. Comparisons: `docs/audit/cute/K1..K4.png` (`node tools/kid_shots.mjs compare`).

## Proportions (all four)
- Moderate chibi: ≈ 3.3–3.5 heads tall (Kid 2 rounder, ≈ 3). Not super-deformed: no 2-head bodies, no stick limbs, no anime sparkle eyes.
- A big round head with full cheeks and a soft blush; large round eyes set wide and a little low, two white catch-lights; a tiny nose and a small mouth.
- Short, slightly chubby limbs; simple box hands; chunky shoes.
- On the ship they are shown at 1.38× so the player fills ~25–30 % of the screen height.

## Slots (characterId, name and voices unchanged)
| Slot | id | Look (from the sheet) | Accent |
|---|---|---|---|
| Kid 1 | `maya` | messy near-black hair with a cowlick, green stud earrings, baggy teal camp shirt, khaki shorts, slate sneakers with pink | teal `#5FA39C` |
| Kid 2 | `leo` | fluffy chocolate bob, orange A-line dress over a rust top, red boots | orange `#EF8A3E` |
| Kid 3 | `amara` | wavy chestnut hair, white tee, mint overalls with a bib pocket, red canvas sneakers | mint |
| Kid 4 | `migo` | high dark ponytail with lime bobbles, blunt bangs, pale green pinafore with a front pocket, red slip-ons | leaf green |

(The card lines still describe the original designs; "his hiding spots" for Kid 4 needs a decision.)

## Expressions and life (`KidDriver.expr`, `KidDriver.act`)
- Blink every ~3.6 s (seeded, a function of time, so it is safe in HyperFrames films).
- `happy`: eyes become soft arcs, a wider smile. `curious`: head tilt + brows up. `surprised`: bigger eyes, small "o" mouth. `determined`: narrower eyes, brows down. `sleepy`: half-closed eyes (for the ending).
- Secondary motion: hair bounce with the walk, ponytail swing, dress-hem sway. A small excited `hop` (crouch, hop, soft landing). Calm: no wild squash and stretch.

## Spacesuit
Round helmet with a clear front, the face visible, the visor slides down and up during the transformation; each kid's accent on the shoulder yoke and panels; the name patch on the chest (shows "EXPLORER" in rendered films, the real name only in the engine).

## Real astronauts
Armstrong, Aldrin and Collins are **not** chibi: adult proportions (≈ 6.5 heads), all-white Apollo 11 suits, gold visors down, no faces, no cartoon expressions; same 2.5 px outlines so they belong in the picture.
