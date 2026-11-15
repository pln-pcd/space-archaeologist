# Space Archaeologist framework

The game title and player role live in `apps/web/src/missions/constants.ts`. The existing
Odyssey shell handles cover, local name validation, the designer and the starship room.
`MissionRunner.ts` owns steps 04–12. Screens emit typed Intent Bus commands; the reducer
controls gates, retries, assistance and rewards. `session.ts` saves at each transition.

Content is registered from `apps/web/src/content/missions/*.json`. The checked-in JSON Schema,
typed validator and Vitest provenance gate reject missing fact objects, unknown sources,
unsourced activity copy, long dialogue and invalid puzzle references. Copy tagged IMAGINE
is fiction; factual copy is a `{kind, text, sourceId}` object. Photographs are local NASA
assets with credits and hashes in `public/media/artifacts/credits.json`.

To add a mission:

1. Author JSON against `missions/mission.schema.json`, including every artifact's reason category.
2. Verify primary sources and register them in `content/sources.json` before using their IDs.
3. Supply model refs, positioned hotspots and spawn positions. Register new geometry in the
   shared `ArtifactModel` adapter. The shipped world/film adapter uses the Moon diorama and its
   camera refs; a new world gets its own adapter using existing scenes/models where possible.
4. Run `python tools/mission_voices.py` with the local voice server running. It prepares narrator
   clips and a text/duration manifest. Changing story copy requires regenerating its clips.
5. Add the mission token to the existing Mission Wall, then run the content and flow gates.

`ArtifactInvestigation`, `EvidenceBoard`, `Reconstruction`, `Discovery`, `Challenge`, `Rewards`
and `Archive` consume the definition and state. They do not contain Apollo quiz answers.
The current loop requires all four investigations. Hands-on adapters reuse laser timing,
Rock Box collecting, seismic demonstration and the existing matching/input mechanics.
Future worlds still need their models/camera adapter; adding unverified JSON does not ship a mission.
Opportunity remains in the legacy chapter registry as a playable Story Mission.

Local data: `odyssey-avatar-v5`, `odyssey-missions-v5`, and the existing profile/settings key.
Archive notes are length-limited, filtered and saved locally. They are absent from Nova payloads.
The bridge sends mission/step/artifact IDs; Python resolves its own verified copy. A generic
pointing question uses a precise sourced answer; other questions retain the Gemini guard and
offline FAQ. Reconstruction gets reconstruction context, rather than the previous artifact.

Desktop entry points:

- `/?mission=moon-001&step=01` through `12`; 01 is cover, 02 designer, 03 hub.
- `/?mission=moon-001&artifact=retroreflector` (also descent-stage, seismometer, plaque).
- `/dev/avatar`, `/dev/artifacts`; append `?judge=1` to show the loop and source IDs.
- `/?chapter=2` preserves Opportunity; `/?chapter=1` preserves the legacy Moon player.

Normal launches resume saved progress. Debug jumps never grant earned rewards. Reset progress
in Settings asks for an explicit grown-up confirmation and clears avatar, archive and notes.
Camera requests require consent and are confined to steps 06, 07, 08 and 10. Mouse and keyboard
work throughout. Exploration and Archive accept the same intents, but do not start a camera.

Verification commands (desktop scope):

```text
node tools/flow_qa.mjs --missions --phase=8
node tools/overlap_qa.mjs --missions --phase=8
node tools/accuracy_report.mjs
npx vitest run
npx playwright test tests/missions.spec.ts
python -m pytest server/tests -q -k "not live"
npm run build
```

The Playwright tests start at cover with preference-only fixtures. They create an avatar,
walk to each artifact, scan, complete activities, pin evidence, reconstruct, report and earn
the Archive. They also reload at boundaries, verify local notes and assert no camera or
third-party requests. The mouse route includes native drag-and-drop and a gentle wrong answer.
