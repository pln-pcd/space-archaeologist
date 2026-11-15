# Mistwood Cottage Style Study & Technical Specification

> **Reference:** Mistwood Cottage © 2025 Amira Deuraseh ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))  
> Repository studied: `https://github.com/amiradeu/mistwood-cottage`  
> Studied from a read-only shallow clone in `/tmp/refs/mistwood/repo`.

---

## 1. Executive Summary & Aesthetic Analysis

Mistwood Cottage is a handcrafted, warm, tactile 3D diorama that achieves an intimate, miniature feel through:
1. **Baked Lighting as the Foundation:** All static architecture and terrain are rendered with unlit `MeshBasicMaterial` using baked Blender Cycles lightmaps (diffuse bounce, soft shadows, warm area lamps, and ambient occlusion).
2. **Cineon Tone Mapping at Exposure 1.75:** The renderer uses `THREE.CineonToneMapping` with `toneMappingExposure = 1.75` and sRGB output. This lifts dark and mid-tones while compressing highlights (max 3D luminance ~0.90), giving a soft, filmic look where pure UI white (`#FFFFFF`) stands out brighter than any element in the 3D scene.
3. **Four Mood Cycles:** Seamless 2-second crossfades between 4 distinct atmospheric moods:
   - **☀︎ Sunrise:** Warm amber light, low sun angle, fog far ~71 H.
   - **Daylight:** Neutral soft sun, fog far ~86 H.
   - **Pink Sunset:** Rose-magenta glow, romantic cabin warmth, fog far ~71 H.
   - **Night ☽:** Deep blue-violet exterior ambience, glowing interior lamps, fog far ~43 H.
4. **Telephoto Diorama Camera:** Low vertical FOV (35°), framing the scene like a physical miniature diorama on a table.
5. **Distinctive UI Typography & Layout:** Ethereal titles in **Bigelow Rules**, monospace technical and body text in **Roboto Mono**, signature blue-on-white button highlight (`#0000FF` on `#FFFFFF`), and rich indigo panels (`#566095`).

---

## 2. Confirmed Technical Numbers & Measurements

All measurements below are verified directly from `mistwood-cottage/src/Experience/`:

### A. Renderer Settings (`Renderer.js`, `Constants.js`)
| Parameter | Value in Code | Verified Effect |
| :--- | :--- | :--- |
| **Tone Mapping** | `THREE.CineonToneMapping` | Filmic S-curve, highlights compressed to ~0.90 |
| **Exposure** | `1.75` | Lifts dark bakes (mean 0.15–0.32 sRGB) to rich mid-tones |
| **Antialias** | `true` | Clean silhouette edges |
| **Clear Color** | `#211d20` | Dark warm charcoal background for loading / clear |
| **Pixel Ratio** | `min(devicePixelRatio, 2)` | Crisp on Retina displays without overloading GPU |
| **Post-Processing** | None (Bloom disabled) | Zero post-processing passes; all glow comes from color math |

#### Cineon Curve Behavior (sRGB Input → Screen Output at 1.75 Exposure):
- `0.05` → `0.00` (deepest shadows crush to rich blacks)
- `0.10` → `0.07`
- `0.20` → `0.26` (strong mid-tone lift)
- `0.27` → `0.38`
- `0.35` → `0.51`
- `0.50` → `0.68`
- `0.80` → `0.85`
- `1.00` → `0.90` (never hits 1.0; UI white is always brightest)

---

### B. Camera & Framing (`Camera.js`, `CameraThirdPerson.js`)
$H$ = character height (in Mistwood, player height = 0.7 units).
- **Vertical FOV:** `35°` (PerspectiveCamera).
- **Camera Distance:** `4.0` units ($4.0 / 0.7 \approx 5.71\ H$).
- **Aim Height:** Player position + `0.5` units ($0.5 / 0.7 \approx 0.71\ H$ above feet).
- **Position Smoothing:** Frame-rate independent lerp:
  $$\text{smoothFactor} = 1.0 - 0.9^{\Delta t \times 60}$$
  (Equivalent to Mistwood's 0.1 per frame at 60 FPS, but consistent across all refresh rates).
- **Pointer Orbit:** When pointer is down (dragging), smoothing factor becomes `1.0` (zero lag during drag).
- **Minimum Elevation:** Camera elevation clamped to terrain height + $0.3\ H$ to prevent clipping below ground.

---

### C. Atmosphere, Sky & Fog (`World/Fog.js`, `Constants.js`)
- **Fog Type:** `THREE.Fog` (linear fog).
- **Fog Color:** `#dfe9f3` (matches sky/background exactly for seamless infinite horizon).
- **Fog Near:** `1.0` unit ($\approx 1.4\ H$).
- **Fog Far by Mood:**
  - *Daylight:* `60.0` units ($\approx 86\ H$)
  - *Sunrise:* `50.0` units ($\approx 71\ H$)
  - *Sunset:* `50.0` units ($\approx 71\ H$)
  - *Night:* `30.0` units ($\approx 43\ H$)
- **Transition:** 2.0-second GSAP tween on `fog.far` during cycle changes.

---

### D. Dynamic Character & Prop Shading (`PlayerMaterial.js`, `getSunShade.glsl`)
For movable objects that cannot be baked into static lightmaps:
- **Two-Tone Sun Shade:**
  $$\text{sunShade} = 0.5 - 0.5 \times (\mathbf{N} \cdot \mathbf{L})$$
  $$\text{color} = \text{mix}(\text{albedo} \times \text{litTint}, \text{albedo} \times \text{shadeTint}, \text{sunShade})$$
- **Mood Tints on Albedo (~20% mix):**
  - Sunrise: `#ff9b3d`
  - Daylight: `#fffd94`
  - Sunset: `#fda0ef`
  - Night: `#af58bb`
- **Shade Tints:**
  - Warm shade: `#b17412` (Sunrise, Daylight)
  - Cool shade: `#332951` (Night)
  - Sunset shade: `#72404e` (interpolated rose-violet)
- **Blob Shadow:** Soft radial black blob (35% center opacity fading smoothly to 0 at edge) projected onto floor geometry.

---

### E. Effects Library (`Objects/Emissive.js`, `World/Fireflies.js`)
1. **Emissive Gradient Lamps:**
   - No post-processing bloom; glow is computed mathematically across UV2 coordinates.
   - *Radial Gradient:*
     $$d = \text{pow}(\text{clamp}(\text{distance}(uv_2, 0.5) / \text{radius}, 0, 1), \text{power})$$
     $$\text{color} = \text{mix}(\text{ColorA}, \text{ColorB}, \text{smoothstep}(0, 1, d))$$
   - *Linear Gradient:*
     $$g = \text{pow}(\text{abs}(uv_2.y - 0.5) \times 2.0, \text{power})$$
     $$\text{color} = \text{mix}(\text{ColorA}, \text{ColorB}, g)$$
2. **Fireflies & Motes:**
   - Rendered with additive particle points on layer 2 (preventing black-box artifacts in Three.js Reflector/Refractor passes).
   - Lissajous drift paths with multi-frequency sinusoidal oscillation.
   - Fixed flicker formula using `pow(abs(cos(t)), 0.5)` to eliminate negative square-root NaN glitches.
3. **Steam & Vapour:**
   - 16×64 quad geometry, rising scrolling Perlin noise with Y-axis twist and wind displacement.
4. **Frosted Glass:**
   - `#464851` base at 0.8 opacity with subtle surface streak alpha mask.

---

### F. UI & Design System (`scss/`, `index.html`)
- **Typography:**
  - Titles & Speaker Headings: **Bigelow Rules** (OFL-1.1).
  - Body, Tech & Counters: **Roboto Mono** (OFL-1.1).
  - Accessibility Overrides: **Lexend** (Easy-read) and **OpenDyslexic** preserved.
- **Color Hierarchy:**
  - Base Backdrop / Scrims: `#0c0a09` with fine subtle grain texture.
  - Main Panels: Solid `#566095` with white border/text, 1em radius (`1em 0 1em 1em`).
  - Text: `#f5f5f4` on dark, `#ffffff` on panels.
  - Active / Hover Highlight: White solid pill with blue `#0000ff` text (contrast ratio **8.6:1**).
  - Unselected Tabs: White text with gentle drop-shadow `1px -1px 6px #6962c578`.
  - Secondary / Keycaps: `#5f7776` active fill with white 1px border.
  - Gold Accents: `#ffd009` for achievement stars, badges, and fireflies.

---

## 3. Reference Imagery Audit

The following reference frames from `mistwood-cottage/docs/` establish our visual benchmarks:
1. **Sunrise Exterior (`SunrisefromtheMountain.jpg`):** Golden hour amber sunlight raking across pine trees, cobblestone paths, and mist fading into `#dfe9f3`.
2. **Daylight Exterior (`StylizedCottage.png`):** Neutral, clean lighting, clear shadow definition, textured wood tiles, and slate-violet roof tiles.
3. **Sunset Exterior (`CottageintheHills.jpg`):** Rose-magenta glow, porch lanterns lit with radial orange gradients, soft lavender skies.
4. **Night Exterior (`cottage.gif`):** Deep cobalt violet world, glowing windows, active path lanterns, and sparkling golden fireflies.
5. **Interior Scene (`Interior.png`, `interior.webp`):** Warm, intimate cottage diorama with rich wood paneling, glowing desk lamps, cozy rugs, and mugs with rising steam.
6. **Intro & UI Overlay (`how-it-started.png`, `CollectingtheCoins.jpg`):** Bigelow Rules title screen on dark grain backdrop, pill-shaped button with `→`, and vertical counter pill (`coins / total`).

