"""v8: writes apps/web/src/content/missions/mars-001.json, the Mars mission on the same engine as the
Moon (explore → investigate → finger quiz → hand game). Every factual line carries ONE verified source
from content/sources.json; nothing here is new science, it is the same facts the Ch2 story already uses.
Run: python -I tools/v8/make_mars_mission.py"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/src/content/missions/mars-001.json"


def F(text, src):
    assert len(text.split()) <= 15, text
    return {"kind": "fact", "text": text, "sourceId": src}


def I(text):
    assert len(text.split()) <= 15, text
    return {"kind": "imagine", "text": text}


MISSION = F("Mars Exploration Rover · 2004", "F4")


def artifact(id, name, model, spawn, hint, reason_cat, reason, purpose, significance, summary, parts, activity, activity_fact, photo, caption, photo_src):
    comps = [{"id": pid, "name": pname, "hotspotPosition": pos, "clue": clue, "function": fn} for pid, pname, pos, clue, fn in parts]
    return {
        "id": id,
        "name": name,
        "modelRef": model,
        "spawnPosition": spawn,
        "discoveryHint": I(hint),
        "leftBehindReason": {"category": reason_cat, "fact": reason},
        "originalMission": MISSION,
        "purpose": purpose,
        "significance": significance,
        "summary": summary,
        "components": comps,
        "cluesRequired": len(comps),
        "activity": activity,
        "activityFact": activity_fact,
        "photo": {"src": f"/media/artifacts/{photo}", "caption": caption, "credit": F("NASA", photo_src), "sourceId": photo_src, "license": "public-domain"},
        "evidence": [
            {"id": f"{id}-part", "slot": "component", "fact": comps[0]["name"]},
            {"id": f"{id}-mission", "slot": "mission", "fact": MISSION},
            {"id": f"{id}-photo", "slot": "photo", "fact": caption},
            {"id": f"{id}-function", "slot": "function", "fact": purpose},
            {"id": f"{id}-reason", "slot": "reason", "fact": reason},
        ],
    }


rover = artifact(
    "opportunity-rover", F("Opportunity Rover", "F4"), "rover", [4.4, 0, 2.6],
    "Wheel tracks lead toward something big, to the east.",
    "operation", F("A giant dust storm blocked the sunlight, and it went quiet.", "F5"),
    F("Explore Mars and look for clues of past water.", "F14"),
    F("Clues showed its landing place was once the shore of a salty sea.", "F14"),
    F("Planned for 90 Martian days, it worked about 60 times longer.", "F5"),
    [
        ("solar-panels", F("Solar panels", "M_EDL"), [-0.95, 0.95, 0.35], F("Martian winds sometimes blew the dust off its panels.", "F15"), F("Make power from sunlight.", "F15")),
        ("wheels", F("Wheels", "F24"), [0.95, 0.3, 0.72], F("Its top speed on flat ground was 5 centimetres a second.", "F24"), F("Drive across Mars, crater after crater.", "F4")),
        ("camera-mast", F("Camera mast", "M_EDL"), [0.35, 1.95, -0.15], F("It unfolded its camera mast after it landed.", "M_EDL"), F("Hold up the rover's cameras.", "M_EDL")),
    ],
    "solar", F("Martian winds really cleaned rover panels!", "F15"),
    "rover.jpg", F("The rocket carrying Opportunity lifts off at night, July 2003.", "K_LAUNCH"), "K_LAUNCH",
)
lander = artifact(
    "mars-lander", F("Lander and airbags", "M_EDL"), "marslander", [-4.6, 0, 3.4],
    "Something shiny rests in a small crater, to the west.",
    "operation", F("The rover drove away; its landing hardware stayed in Eagle crater.", "F22"),
    F("Carry the rover safely down to the ground.", "M_EDL"),
    F("It rolled into a small crater: a hole-in-one!", "F17"),
    F("Airbags let it bounce 26 times before it rolled into a crater.", "F17"),
    [
        ("airbags", F("Airbags", "M_EDL"), [0.9, 0.35, 0.55], F("The lander bounced 26 times before it stopped.", "F17"), F("Cushion the bouncy landing.", "M_EDL")),
        ("petals", F("Petals", "M_EDL"), [-0.15, 0.2, -0.85], F("The lander opened its petals like a flower.", "M_EDL"), F("Open up so the rover could drive out.", "M_EDL")),
        ("bridle", F("Bridle rope", "M_EDL"), [0.0, 0.55, 0.0], F("The lander hung on a rope below the backshell.", "M_EDL"), F("Lower the lander before the drop.", "M_EDL")),
    ],
    "airbag", F("It bounced 26 times before rolling into a small crater.", "F17"),
    "mars-lander.jpg", F("Airbags fitted on Opportunity's lander at Kennedy Space Center, 2003.", "K_AIRBAGS"), "K_AIRBAGS",
)
entry = artifact(
    "entry-hardware", F("Heat shield and parachute", "M_EDL"), "chute", [0.8, 0, -3.4],
    "Something round and dark lies to the north.",
    "operation", F("The heat shield fell away during the landing.", "M_EDL"),
    F("Slow Opportunity down as it fell toward Mars.", "M_EDL"),
    F("The heat shield protected Opportunity in the thin Martian air.", "M_EDL"),
    F("A heat shield, a parachute and rockets slowed Opportunity's fall.", "M_EDL"),
    [
        ("heat-shield", F("Heat shield", "M_EDL"), [-0.7, 0.45, 0.45], F("It protected Opportunity as it entered the thin Martian air.", "M_EDL"), F("Protect the lander while it enters the air.", "M_EDL")),
        ("parachute", F("Parachute", "M_EDL"), [0.85, 0.25, 0.3], F("A parachute opened to slow the fall.", "M_EDL"), F("Slow the fall.", "M_EDL")),
        ("rockets", F("Backshell rockets", "M_EDL"), [0.15, 0.85, -0.3], F("Rockets on the backshell slowed the fall almost to a stop.", "M_EDL"), F("Brake just before the drop.", "M_EDL")),
    ],
    "chute", F("A parachute opened to slow the fall.", "M_EDL"),
    "entry.jpg", F("Opportunity's heat shield and backshell at Kennedy Space Center, 2003.", "K_SHIELD"), "K_SHIELD",
)

mission = {
    "schemaVersion": 1,
    "meta": {
        "id": "mars-001",
        "title": "The Brave Rover of Mars",
        "location": F("Meridiani Planum · Eagle crater", "F22"),
        "difficulty": "Beginner",
        "framing": [I("Your Space Archaeologist adventure continues on Mars."), I("Find what Opportunity left behind.")],
        "briefing": [I("Every object has a story."), I("Your job is to discover it.")],
        "estimatedMinutes": [15, 20],
    },
    "storyShots": [
        {"id": "meridiani", "cameraRef": "landed", "lines": [F("Opportunity woke up inside a small crater on a plain called Meridiani.", "F22")]},
    ],
    "artifacts": [rover, lander, entry],
    "evidenceSlots": [
        {"id": "component", "label": "Component"},
        {"id": "mission", "label": "Mission"},
        {"id": "photo", "label": "Historical photo"},
        {"id": "function", "label": "Function"},
        {"id": "reason", "label": "Why it stayed"},
    ],
    "reconstruction": {
        "prompt": "How did Opportunity land?",
        "modelRef": "marslander",
        "stages": [
            {"id": "entry", "name": F("Heat shield", "M_EDL"), "function": F("Protect the lander while it enters the air.", "M_EDL")},
            {"id": "airbags", "name": F("Airbags", "M_EDL"), "function": F("Cushion the bouncy landing.", "M_EDL")},
        ],
        "timeline": [
            {"id": "chute", "fact": F("A parachute opened to slow the fall.", "M_EDL")},
            {"id": "bags", "fact": F("Giant airbags inflated around the lander.", "M_EDL")},
            {"id": "roll", "fact": F("It rolled into a small crater. A hole-in-one!", "F14")},
        ],
        "hints": [I("What slowed the fall first?"), F("A parachute opened to slow the fall.", "M_EDL")],
        "summary": F("A heat shield, a parachute and rockets slowed Opportunity's fall.", "M_EDL"),
    },
    "discovery": [
        F("Opportunity ran on sunlight. Dust slowly covered its solar panels.", "F15"),
        F("Tiny round pebbles called blueberries formed in water long ago.", "F14"),
        F("It became the first robot to drive farther than a marathon on another world.", "F4"),
    ],
    "challenge": [
        {
            "id": "stayed",
            "format": "pick",
            "prompt": F("Where did Opportunity's landing hardware stay?", "F22"),
            "options": [
                {"id": "eagle", "label": F("Eagle crater", "F22")},
                {"id": "endeavour", "label": F("Endeavour crater", "F4")},
            ],
            "answer": ["eagle"],
            "explanation": F("The rover drove away; its landing hardware stayed in Eagle crater.", "F22"),
        }
    ],
    "rewards": {"badge": "Meridiani Storykeeper", "points": 400, "rank": "Space Archaeologist"},
}
OUT.write_text(json.dumps(mission, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("wrote", OUT)
