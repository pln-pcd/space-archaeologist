# The "after-p2" style (reference for the new flow)

Source: the 22 screenshots in `docs/audit/after-p2/` (committed in
`0f4615f`, code state = `23255da` + `0f4615f`, "Star Gloves gesture engine, Glove Academy and audit
fixes"). Style code read at that commit: `style/toon.ts`, `style/StyleRig.tsx`, `style/palette.ts`,
`anim/kit.ts`, `style/motion.css`, `ship/Chubby.tsx`, `Ship3D.tsx`.

We restore the **style system** (shading, motion language, transitions, camera feel), not the
scenes or layouts in those screenshots.

## Shading and lighting

- `MeshToonMaterial` with a **3-step ramp** (118 / 186 / 255): matte, hand-painted, no gloss. Shadows
  are lifted so they stay pastel and never go black.
- Gloss only where it belongs: visors and glass (`MeshStandardMaterial`, roughness 0.12, metalness 0.35).
- Unlit glow material (`MeshBasicMaterial` × 1.8, not tone-mapped) for lamps, screens and engine glows;
  a light bloom (threshold 0.95, intensity 0.35) picks them up.
- Lights: warm cream hemisphere (`#FFF1E2` over `#5A4A9A`, 1.15), lilac ambient (0.35), one warm key
  (`#FFE2C2`, 2.1, soft PCF shadows radius 6) high and to the left, a cool blue rim (`#9FB4FF`, 0.7)
  from behind, warm point lamps (`#FFD7A0`).
- ACES Filmic tone mapping, exposure 1.05. Soft round blob shadows under characters.
- Post: very light bloom, **tilt-shift** on the top and bottom bands (diorama feel), soft vignette (offset
  0.28, darkness 0.42). The HUD is HTML on top, never blurred.

## Palette and colour amount

- Architecture in **cool indigo/plum** (`#2A2358`, `#3A3170`, `#4A4088`), space `#14102E`.
- Floors and props in **warm cream / peach** (`#FFE7C7`, `#F2D3AA`, `#F5B98A`).
- **Brass / marigold** (`#E8B84A`, `#C9963A`) for frames, rails and the star-map lines.
- Small saturated accents: mint `#7FD8BE`, teal `#3FB6A8`, coral `#FF8E8A`, pink `#F29BC2`, lavender `#9B8CE8`.
- Ink `#3A2A4A` (warm plum, never black).
- In the screenshots the frame reads roughly 50 % indigo/cream neutrals, 35 % soft colour, 15 % brass/accents:
  friendlier than the later "master restyle" greys, calmer than a rainbow.

## Line work and texture

- **No outlines** at after-p2: silhouettes come from the toon ramp step and the rim light.
- Surfaces are flat colour with the ramp; no painted texture, no grain. (Both are the "additions" below.)

## Shapes and characters

- Chunky, rounded, toy-like forms (`RoundedBox` everywhere, big radii), short and wide proportions.
- Chubby astronauts: big round helmet, glossy visor with a simple face, mitten hands, boots, backpack with
  an antenna, a glowing chest patch.

## Camera feel

- Perspective, FOV 46 (52 on squarer windows, 58 on portrait), high three-quarter view looking down onto a
  round diorama, slow damped follow (exponential `damp`), never shows empty space.
- Tilt-shift makes it read as a miniature.

## Motion timing and eases

- Springs: stiffness 120–260, damping 10–20 (toy-like, small overshoot); exponential damping for follow.
- Most motions 0.12–0.4 s, ease-out with a tiny overshoot (`popEase`, c1 = 1.4); squash and stretch on
  land/start/stop/pop; follow-through on antennas; idle breathing, blinks every 3.2–4.6 s, slow glance.
- CSS: `--spring: cubic-bezier(.34,1.56,.64,1)`, `--ease-out: cubic-bezier(.22,1,.36,1)`. Buttons squash on
  press (`scale(1.06,.88)`, 80 ms) and spring back (280 ms); icons wiggle on hover; reward pops (`scale .3 → 1`);
  panels slide in with a small overshoot.
- Reduced motion: no overshoot, no sway, fades only.

## Transitions

- Short fades and pops between UI states; "A forgotten signal is calling…" fade card before a story.
- Story opens with a big title card over the 3D scene, then pages.

## UI shapes

- Dark plum translucent pills and panels (`#1e182e`-ish), chunky 14–26 px radii with a **bottom lip**
  (`0 5px 0 #1a1238`), cream/marigold primary buttons, Fredoka titles + Lexend body.

## What we keep from later passes (the four additions, new-flow prompt §1d)

1. **Colour, just enough**: about 65 % neutrals / 25 % soft colour / 10 % accents. The after-p2 palette is
   kept but its neutrals (indigo and cream) carry more of the frame; soft hues on fabrics, plants, lamps,
   planets and UI accents.
2. **Texture**: painted value variation (±8–12 %) on every surface, faint hatching in the darkest ramp step,
   static paper grain 3–4 % over the frame (`fx/ramp.ts` texture code, `ui/cute.css` grain). Space stays black.
3. **Outlines**: inverted hulls (Nova 3 px, objects 2–2.5 px), edge pass 1.5 px on the environment, warm dark
   `#3A2A24`-family lines that fade with distance, none on particles/glass/glow.
4. **Readable text boxes**: solid cream `#FFF8EC` cards, 3 px `#3A2A24` outline, 20 px radius, offset shadow
   `0 5px 0 rgba(58,42,36,.25)`, Lexend 500 ≥ 28 px, line-height 1.45, ≤ 45 characters per line, ≤ 3 lines.

These replace the dark plum translucent panels of after-p2 for any text; the plum stays for the 3D world.

## Where it lives now

- `apps/web/src/odyssey/look.ts`: the restored toon ramp + after-p2 palette + painted texture/hatch, used by
  the cover, the dashboard and Nova.
- `apps/web/src/odyssey/odyssey.css`: the motion language (springs, squash on press) + the cream cards.
