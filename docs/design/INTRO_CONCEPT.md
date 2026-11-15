# Starship Odyssey: opening sequence concept (v2, with player name)
### Cover → Pick your explorer + type your name → Hide and seek → The portal → Become an astronaut → Aboard the Odyssey

(Part 1 of the brief. It holds the exact script used by `apps/web/src/content/intro.json`.)

## Why this opening works
- **It starts on Earth, on an ordinary summer afternoon.** That's the natural home for the "Quiet Afternoon" style (warm sun, painted clouds, drifting cloud shadows, swaying trees), and on Earth those effects are scientifically fine.
- **Hide and seek gives a reason to explore** and a gentle clock: a friend is counting in the background.
- **You pick a look and type your own explorer name.** The kid you pick becomes *you*, with your name. The three kids you didn't pick keep their names and become your friends; one of them is the seeker.
- **Nova shows itself in the portal and explains**, and the kid chooses to go. It's an invitation, not a stranger's voice luring a child. "You'll be back before they finish counting" reassures kids and parents.
- **No hand tracking.** Movement: WASD / arrows, click-to-move, tap. Choices: buttons.
- **Length:** about 2½–3 minutes, skippable.

## Flow at a glance
```
COVER (Start / Continue / Settings / Credits)
 → CHARACTER SELECT: pick 1 of 4 kids → type your explorer name
 → SCENE 1  Summer afternoon: "You and your friends are playing hide and seek"
 → SCENE 2  Player control: find a hiding spot while the seeker counts
 → SCENE 3  Behind the old shed: a humming ring of light, the Moon inside it
 → SCENE 4  Nova in the ring: "Are you curious enough to come and see, <Name>?" (choices)
 → SCENE 5  Chalk arrows draw themselves to the portal: walk in
 → SCENE 6  Transformation: clothes become a spacesuit, and a <NAME> patch stitches on
 → SCENE 7  Aboard the Odyssey: "Welcome aboard, <Name>. Your first stop is the Moon."
```

## The cover
- A quiet street at golden hour: a big old tree, a low wall, an old wooden shed at the end of the lane with a faint shimmer behind it, and the pale Moon rising.
- Title "Starship Odyssey" (Stylish), subtitle "Abandoned, but not forgotten."
- Tilted paper buttons: **Start** (sage), **Continue** (only if a save exists; it greets you by name), **Settings**, **Credits**.

## Step 1: Pick your explorer
Four ordinary kids aged 9–11, **moderate chibi** since the cute polish (≈ 3.3–3.5 heads tall, see bible §22 and docs/design/KIDS.md), low-poly with outlines. Each one's colour becomes their spacesuit accent.

| | **Maya** (10) | **Leo** (11) | **Amara** (9) | **Migo** (10) |
|---|---|---|---|---|
| Personality | The curious one | The tinkerer | The stargazer | The adventurer |
| Look | Long dark braid, ochre raincoat, rain boots | Round glasses, rolled sleeves, dusty-blue overalls, tool pouch | Curly hair in two puffs, terracotta hoodie | Backwards cap, sage T-shirt, sneakers, knee bandage |
| Prop | Small notebook and pencil | Screwdriver | Pocket telescope | Nothing; he can't keep still |
| Idle animation | Flips through notebook | Spins screwdriver, pushes up glasses | Looks through telescope, points at sky | Bounces on toes, stretches |
| Card line | "Always asks one more question." | "Wants to know how things work." | "Counts the stars every night." | "Nobody ever finds his hiding spots." |
| Suit accent | Ochre #B8914F | Dusty blue #6D8295 | Terracotta #B8714F | Sage #6A8C70 |

Hovering or tapping a kid makes them step forward, turn toward you, and show their paper card. **"Choose this explorer"** confirms the pick.

## Step 2: Type your explorer name
Right after you choose, the camera eases in on the chosen kid, and a paper card asks:

> **What should we call you, explorer?**
> [ text box, big and friendly: "Your explorer name" ]
> *Use a nickname, not your full name.*
> [Random name] [Let's go] (sage)

- **Rules:** 2–12 characters; letters (accents and ñ allowed), numbers, spaces, hyphens. Rude words are blocked with a friendly message ("Let's pick a different name."). The box can't be left empty, but **Random name** suggests friendly space nicknames (Comet, Orbit, Pebble, Starling, Luna, Rocket, Meteor, Juno…).
- **Where your name appears:** Nova speaks to you by name (in the captions, and also in the voice if the personalised voice works); the **name patch** stitched onto your suit during the transformation; the welcome on the ship; your **Passport** cover, results cards and the end certificate; "Continue as <Name>" on the cover.
- **Privacy:** the name is saved **only on this computer** (local save). It's never sent anywhere. You can change it later in Settings, and "Delete my save" erases everything.
- **The friends:** the three kids you didn't pick keep their own names (Maya, Leo, Amara or Migo) and play hide and seek with you.

## Storyboard and script
*N = narrator (calm, warm). NOVA = the ship's guide. SEEKER = the friend who counts (default Leo; if you picked Leo, then Maya). **<Name>** = the name the player typed.*

### Scene 1: A summer afternoon (cutscene, ~20 s)
A slow crane down from the treetops. You and your three friends stand by the big tree; the seeker turns to the trunk and covers their eyes.
- **N:** "It's a quiet summer afternoon on your street."
- **N:** "You and your friends are playing hide and seek."
- **SEEKER:** "I'll count to twenty. No peeking! One… two… three…"
- **N:** "Quick. Find a good place to hide."

### Scene 2: Find a hiding spot (player control, ~30–45 s)
Prompt card: "Find a hiding spot" (WASD · Click · Tap). The count continues softly.
- Decoy spots: the bush: **N:** "Too small. Your shoes are sticking out." The wall: **N:** "Hmm. That's where everyone hides."
- Near the shed: a low hum starts and leaves drift toward it. **N:** "Behind the old shed… something is humming."
- **Chalk arrows** draw themselves on the ground, stroke by stroke, to the back of the shed. If the shed is off-screen, an edge arrow points the way.

### Scene 3: The portal (cutscene, ~10 s)
A ring of soft light (cream and pale blue, gentle ripple, no neon, no flashing) floats above the grass. **Through it: real space**, with a black sky, the grey Moon, and a tiny gold-legged lander (a sneak peek of Chapter 1). Leaves drift in.
- **N:** "A ring of light. And inside it… the Moon."

### Scene 4: Nova's invitation (choices, ~30 s)
Nova glides into view on the far side of the portal and stays there.
- **NOVA:** "Hello? Oh, you can see me. Good."
- **NOVA:** "I'm Nova. I'm a guide on the starship Odyssey."
- **NOVA:** "Long ago, people sent brave machines to the Moon and to Mars."
- **NOVA:** "Many of their missions have ended. They're quiet now… but not forgotten."
- **NOVA:** "Each one has a true story. I need a curious explorer to find them."
- **NOVA:** "Are you curious enough to come and see, <Name>?"

Choices:
- **[I'm curious!]** → Scene 5
- **[Who are you, really?]** → "A ship's robot. I look after the memories of the quiet machines."
- **[Is it safe?]** → "Yes. And time moves slowly out here. You'll be back before they finish counting."

Distant seeker: "…seventeen… eighteen…"

### Scene 5: Step through (player control, ~10 s)
- **NOVA:** "Then follow the arrows. Step through the ring."
- Prompt: "Walk into the portal". At the ring: **SEEKER** (fading): "…twenty! Ready or not, here I come!" Then silence.

### Scene 6: The transformation (cutscene, ~10 s)
A calm tunnel of drifting stars and pale light ribbons; the camera slowly orbits you. The suit forms piece by piece, each with a rising chime: 1. boots, 2. gloves (you flex your fingers), 3. the suit, white with your colour on the panels, 4. the backpack, 5. the helmet (the gold visor slides down, then back up to show your face), 6. the name patch stitches itself on: **<NAME>**.
- **NOVA:** "Boots… gloves… suit… backpack… helmet."
- **NOVA:** "There. Every explorer needs a good suit."

Tagged Imagine. Reduced motion: a crossfade with the chimes.

### Scene 7: Aboard the Odyssey (~15 s, then free play)
The ship's deck in warm window light, helmet off. Nova floats down beside you.
- **NOVA:** "Welcome aboard the Odyssey, <Name>."
- **NOVA:** "These books hold the stories of the quiet machines."
- **NOVA:** "Your first stop is the Moon. Open the Moon book when you're ready."

A chalk arrow on the deck points to the Moon book.

## Voice
- **Narrator and Nova:** two calm Kokoro TTS voices (offline, Apache-licensed), pre-rendered.
- **Lines with the player's name:** the recorded voice can't know the name in advance, so these lines are made in two ways: (1) **personalised (best):** while the intro plays, the browser quietly generates the name lines with Kokoro in the background; (2) **fallback:** if that's slow or fails, Nova says the line without the name ("Welcome aboard the Odyssey, explorer."), and the caption matches exactly. The name still shows on the patch, cards and Passport.
- **Kids' lines** (the seeker counting): recorded by the team (with consent). Don't fake kid voices by pitch-shifting.
