# Space Archaeologist

**A free 3D browser game where kids aged 7 to 12 dig up the true stories of the machines NASA left
on the Moon and Mars.** NASA Space Apps Challenge 2026 entry for *Abandoned but not Forgotten:
Storytelling about NASA's Discarded Equipment on the Moon and Mars*.

- **Play it:** https://space-archaeologist.vercel.app (desktop browser, nothing to install, no account)
- **Demo video:** _link coming soon_ <!-- VIDEO_LINK: paste the public video link here -->
- **Code:** https://github.com/pln-pcd/space-archaeologist

Not endorsed by NASA. The game uses no NASA insignia, logotype, seal, flags or mission patches.

## What it is

You are a young Space Archaeologist. Design an explorer, board the ship and pick a mission.

**Mission 1, the Moon (Apollo 11, 1969):**
1. It opens with real Apollo 11 film from NASA, then a launch you pull yourself.
2. On the Moon you dig up four real artifacts left behind: Eagle's descent stage, the laser reflector,
   the seismometer and the plaque.
3. For each one you brush away the dust and turn it around. Then you open its parts, each with its
   job and a true fact.
4. You run a hands-on activity (like a laser ping) and answer a short evidence quiz.
5. Then you fill the Rock Box, rebuild the lander, file a report nobody can fail, and earn a badge.

**Mission 2, Mars:** keep the rover Opportunity going in Sol Keeper.

**Missions 3 to 5** (Viking 1, Pioneer 10, Voyager 1) are planned.

Nova, a friendly AI guide, answers questions by voice or text the whole way.

## Why it is built this way

The audience is kids aged 7 to 12. Each core feature has a reason:

1. **Nova, the AI guide:** kids ask lots of questions.
   - Nova answers by voice or text and stays on NASA and space topics.
   - She uses facts with sources, so curiosity is rewarded safely.
2. **Star Gloves (hand tracking):** moving their real hands keeps kids engaged and makes learning
   active, not passive. With their hands, kids scan, grab, turn the finds, send a laser ping and
   count answers on their fingers.
   - It is optional: mouse, keyboard and touch work everywhere.
3. **Voiced storytelling with captions:** the story is read aloud and captioned, which makes it more
   fun and helps younger kids and early readers follow along.

**Safety and access:**
- No accounts. Camera and voice are processed on the computer.
- A switch lets grown-ups turn the AI off.
- Captions are always on. There is a calm-motion setting and an easy-read font (OpenDyslexic).
- The whole game plays without a camera, and offline.

## How NASA data is used

- **Every fact is sourced.** 275 fact lines, each linked to one of 46 NASA sources in
  `apps/web/src/content/sources.json`, checked by `npm run check:facts` (0 problems). The full list
  is in `docs/ACCURACY_REPORT.md`, and the `/dev/facts` page in the game shows each fact with its source.
  - Sources include NSSDCA (the challenge's recommended catalog), NASA Science and NASA.gov mission
    pages, the Apollo Lunar Surface Journal, and NASA/JPL press kits.
- **Real NASA media:** Apollo 11 film from NASA's Kennedy Space Center, and Apollo 11 photographs of
  the artifacts, credited on screen.
- **Live NASA data:** Nova reads NASA's open APIs: near-Earth asteroids today (NeoWs), space weather
  (DONKI) and the Curiosity rover's weather on Mars. This needs the Nova server, so it runs in the
  local version; the hosted site uses the offline fact sheet.
- Full list with links: `docs/submission/local/nasa_resources.md`.

## Run it yourself

```powershell
npm install
pip install -r server/requirements.txt
npm run dev        # the game on http://127.0.0.1:5173 and Nova's server on 127.0.0.1:8000
```

The Nova server is optional. With a Gemini key in `server/.env` (`GEMINI_API_KEY=...`), Nova
answers live; without it, or offline, the game still plays completely from its own fact sheet.
Keys only ever live in `.env` files, which are never committed.

Checks: `npm run check:facts`, `npx tsc -b`, `npx vitest run`, `npx playwright test` (with `npm run dev` running).

## AI use

AI tools helped make this project; the details are in [AI_USE.md](AI_USE.md). In the game, Nova's
free-form answers come from Google Gemini behind a safety guard, and her voice and ears run on the
computer. The demo video carries a visible "Made with AI tools" label on every frame.

## Credits and licence

- Code: MIT ([LICENSE](LICENSE)).
- NASA footage and photographs are courtesy of NASA. Fonts, models and libraries keep their own
  licences, listed in [CREDITS.md](CREDITS.md).

## Team (Philippines)

- Natasha Nicole E. Remoto (Team Owner)
- Paulina C. Dela Cruz
- Ella Mae Dolon
- Jason Michael J. Lorente
- Earl Clester Barde
- Jana Melissa Regondola
