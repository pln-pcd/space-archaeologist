# Starship Odyssey — Color Script & Mood Mapping

Visual restyle inspired by **Mistwood Cottage** by Amira Deuraseh (CC BY 4.0).
NASA Space Apps Challenge 2026.

## 1. Global Visual Direction
- **Tone Mapping:** `THREE.CineonToneMapping` at exposure `1.75`.
- **Renderer Clear Color:** `#211d20` (Space / Earth / Mars) and `#000000` (Moon vacuum).
- **Pixel Ratio:** `min(window.devicePixelRatio, 2)`.
- **Atmospheric Fog:** `#dfe9f3` (Earth / Base exteriors), near ≈ 1.4 H, far 43–86 H depending on mood.
- **Lighting Model:** Unlit / baked two-tone sun shade (`MoodLitMaterial`) with soft radial blob contact shadows (`BlobShadow`).
- **Post-processing:** Zero runtime bloom, zero LUT grading, zero near-camera line dither (Cineon tone mapping provides natural soft highlight rolloff; max 3D luminance capped at ~0.90 so UI white `#ffffff` pops).

---

## 2. Per-Scene Mood Mapping Table

| Scene / Phase | Primary Mood | Sun Position | Ambient / Player Tint | Ground / Sky Color | Lighting & VFX Highlights |
|---|---|---|---|---|---|
| **Cover Screen (`?cover=1`)** | Night | `[-0.7, 0.4, 0.6]` | `#8898b8` (cool blue) | `#0c0a09` (grain screen) | Bigelow Rules display title; 2px white pill buttons; SVG hand cursor |
| **Character Select** | Daylight | `[-0.6, 0.7, 0.4]` | `#fbf8f2` (neutral warm) | `#566095` cards | 4 kid turnarounds; white border highlight; subtle keycaps |
| **Name Entry / Boarding** | Daylight | `[-0.6, 0.7, 0.4]` | `#fbf8f2` | `#566095` passport | Blue-on-white button highlight (`#0000ff` on `#ffffff`) |
| **Intro Transformation** | Sunrise | `[-0.8, 0.3, 0.5]` | `#ffdca8` (warm amber) | `#dfe9f3` | Radial emissive burst; suit transformation |
| **Odyssey Hub (Base)** | Daylight / Interior | `[-0.5, 0.8, 0.4]` | `#f8f6f0` | Bone hull, slate deck | Frosted glass portholes; Cozy Corner table with steaming ceramic mug (`<Steam />`) |
| **Hall of Echoes & Globe** | Sunrise / Amber | `[-0.7, 0.5, 0.5]` | `#ffe4b5` | Graphite pedestals | Emissive radial gradient on brass plinths and Memory Core globe |
| **Chapter 1: Moon (Eagle)** | Lunar (Vacuum) | `[-0.7, 0.7, 0.2]` | `#e8e8ea` (crisp solar) | True black `#000000` | Zero fog, zero wind; silver regolith; Apollo 11 suits without red stripes; ballistic arcs |
| **Chapter 2: Mars (Arrive)** | Mars Day | `[-0.5, 0.6, -0.6]` | `#fcd8b8` (butterscotch) | Rust & ochre terrain | Warm directional sunlight; Phobos and Deimos; 6-wheeled Opportunity |
| **Chapter 2: Blueberries** | Ancient Sea | `[-0.5, 0.6, -0.6]` | `#d0e6f8` | Ghost water shimmer | Hematite blueberries with `<GhostWater />` FBM wave layer (`#186691` to `#bbd8e0`) |
| **Chapter 2: 2018 Dust Storm**| Dust Storm | `[-0.2, 0.2, -0.2]` | `#6e4632` (dark ochre) | Dense dust fog (near 4, far 25) | Heavy atmospheric dust; solar array power drop; low amber visibility |
| **Chapter 2: Marathon Sunset**| Martian Dusk | `[0.1, 0.1, -1.0]` | `#7b6b8b` (purple-slate) | Dusk gradient `#2A2240` | Blue sunset halo around sun low over valley rim (F16) |
| **Memory Catch Mini-Game** | Deep Cosmos | `[0, 1, 0]` | `#b0c4de` | Starfield / nebula | Self-contained AR frame; camera opt-in; floating memory orbs |

---

## 3. UI Color Tokens
- `--color-panel`: `#566095` (solid Mistwood midnight blue; border-radius `1em 0 1em 1em`, 2px solid `rgba(255,255,255,0.85)`)
- `--color-panel-hover`: `#4e547e`
- `--color-text-white`: `#ffffff`
- `--color-text-muted`: `#d7dcef`
- `--color-highlight-blue`: `#0000ff` (used exclusively inside white hovered/active buttons)
- `--color-bg-dark`: `#0c0a09` (with procedural 128x128 repeat noise grain)
- `--color-key-active`: `#5f7776` (keycaps hint active state)
- `--color-gold`: `#ffd009`

