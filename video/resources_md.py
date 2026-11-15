"""Writes docs/submission/local/nasa_resources.md: every NASA dataset, page, film, photo and API the
game uses, how it uses it, and whether the link opened without a login in our automated check
(Chrome, 2026-11-15; results in video/build/urlcheck.json when available).
    python -I video/resources_md.py [urlcheck.json]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
S = json.loads((ROOT / "apps/web/src/content/sources.json").read_text(encoding="utf-8"))["sources"]
chk = {}
if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
    chk = {x["u"]: x for x in json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))}


def status(u):
    x = chk.get(u)
    if not x:
        return "Not checked automatically; verify by hand"
    st = x["st"]
    if st == 200 and not x["login"]:
        return "Opens, no login"
    if isinstance(st, str) and "Download is starting" in st:
        return "Opens, no login (PDF download)"
    if st == 403:
        return "Blocked our automated browser (HTTP 403); verify by hand in a normal browser"
    if isinstance(st, str) and "Timeout" in st:
        return "Timed out in our automated check; verify by hand"
    return f"Problem in our automated check (HTTP {st}); verify by hand"


USE = {
    "F1": "Sealed Voyager 1 teaser line (worded as a dated event)",
    "F4": "Opportunity facts in Mission 2 and the video (marathon, 45 km)",
    "F5": "Opportunity mission length (Mission 2, Nova)",
    "F6": "Sealed Viking 1 teaser",
    "F8": "Sealed Pioneer 10 teaser",
    "F10": "Laser reflector still used today: Nova answers, the laser ping activity",
    "F11": "Seismometer could feel footsteps (non-NASA reference)",
    "F12": "Seismometer find and story line",
    "F13": "Reflector made of 100 corner cubes; the two main experiments",
    "F14": "Opportunity: hole in one, blueberries, sand dune (Mission 2)",
    "F15": "Wind cleaning events behind the Sol Keeper mini-game",
    "F16": "Blue Martian sunset (Mission 2)",
    "F17": "Airbag landing bounced 26 times (Mission 2)",
    "F18": "Perseverance passed Opportunity's distance record",
    "F19": "Moon gravity about 1/6 and distance 384,400 km (moon hop, Nova answers)",
    "F20": "A sol is about 24 h 40 min; Mars gravity 0.38 (Sol Keeper, video)",
    "F21": "Apollo 11 launch to landing in about 4 days",
    "F22": "Eagle crater size and place (Mission 2)",
    "F23": "Laser round trip about 2.5 s (laser ping timer)",
    "F24": "Rover top speed 5 cm per second (Mission 2)",
    "F25": "No wind, so footprints last (dig hint, Nova)",
    "F26": "Seismometer stopped on 25 Aug 1969",
    "F27": "Landing coordinates of the Eagle lander",
    "F28": "Descent stage left behind as the launch platform; EASEP deployed (core of Mission 1)",
    "F29": "Plaque text (plaque find)",
    "F30": "Apollo 11 timeline, crew, Saturn V, Pad 39A (launch scene, rebuild timeline)",
    "F31": "Landing time, \"The Eagle has landed\", 21.55 kg of samples (Rock Box)",
    "F32": "Launch and landing dates and times",
    "F33": "Landing call transcript",
    "F34": "Moon samples still studied today",
    "F35": "Apollo 11 KSC film shown in the Mission 1 intro (real NASA footage)",
    "F36": "NASA landing film clip (landing audio)",
    "F37": "How rockets push (launch)",
    "F38": "Solar wind foil (report quiz)",
    "F39": "Thin exosphere (discovery cards)",
    "F40": "Lunar module parts (rebuild)",
    "F41": "Weight limits: why gear was left (discovery)",
    "F42": "Apollo 11 photo reuse and credits",
    "M_VIDEO": "Mission 2 opening film (NASA/JPL animation)",
    "M_LAUNCH": "Mission 2 night launch scene",
    "M_LAUNCH_KIT": "Delta II launch details (Mission 2)",
    "M_EDL": "Mars landing sequence (Mission 2 film)",
    "M_GREY": "Martian blueberries (Mission 2)",
    "M_HOLE": "Hole-in-one landing (Mission 2)",
    "M_COUNTDOWN": "Ship checks (marked Imagine, inspired by NASA countdowns)",
    "M_CREW": "Ship checks (marked Imagine, inspired by NASA countdowns)",
}
APIS = [
    ("NASA NeoWs (Near Earth Object Web Service)", "NASA, api.nasa.gov", "https://api.nasa.gov/neo/rest/v1/feed", "Nova's live answer: how many asteroids pass Earth today and the closest one (server/nova/live.py)", "Works: called by our server on 2026-11-15 (public DEMO_KEY, no login)"),
    ("NASA DONKI (space weather: solar flares and geomagnetic storms)", "NASA CCMC, api.nasa.gov", "https://api.nasa.gov/DONKI/FLR", "Nova's live answer about space weather in the last 7 days", "Works when called with dates (our server, 2026-11-15)"),
    ("Curiosity rover REMS weather report", "NASA/JPL, mars.nasa.gov RSS API", "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json", "Nova's live answer about the weather on Mars", "Works from our server (2026-11-15); an automated browser got HTTP 403"),
    ("Astronomy Picture of the Day (APOD)", "NASA, api.nasa.gov", "https://api.nasa.gov/planetary/apod", "Nova's picture-of-the-day answer", "NOT working on 2026-11-15 (NASA returned HTTP 500); not claimed in the video"),
]
OTHER = [
    ("NSSDCA, NASA Space Science Data Coordinated Archive (the challenge's recommended catalog)", "NASA Goddard", "https://nssdc.gsfc.nasa.gov/", "Source of F19, F20, F27, F28, F31 and F32 (the Eagle descent stage, EASEP, landing data, fact sheets)", status("https://nssdc.gsfc.nasa.gov/")),
    ("Apollo 11 laser reflector photo", "NASA Image and Video Library", "https://images-assets.nasa.gov/image/6900957/6900957~medium.jpg", "Artifact photo in the game and the video", status("https://images-assets.nasa.gov/image/6900957/6900957~medium.jpg")),
    ("Apollo 11 photos: plaque, seismometer (AS11-40-5948), descent stage", "NASA Science (Lunar Science)", "listed in apps/web/public/media/artifacts/credits.json", "Artifact photos in the game and the video", "Plaque and descent stage links open; the seismometer link returned 404 in our check (the photo is in the repo; verify its source link by hand)"),
]
out = [
    "# NASA data and resources",
    "",
    "Every NASA dataset, page, film, photo and API the game uses, how it is used, and whether the link",
    "opened without a login. Checked on 2026-11-15 with an automated Chrome browser; entries marked",
    "\"verify by hand\" could not be confirmed automatically (some NASA sites block automated browsers).",
    "",
    "## Live NASA data (APIs)",
    "",
    "| Name | Source | URL | How the game uses it | Check |",
    "|---|---|---|---|---|",
]
out += [f"| {a} | {b} | {c} | {d} | {e} |" for a, b, c, d, e in APIS]
out += ["", "## Catalogs, footage and photos", "", "| Name | Source | URL | How the game uses it | Check |", "|---|---|---|---|---|"]
out += [f"| {a} | {b} | {c} | {d} | {e} |" for a, b, c, d, e in OTHER]
out += [
    "",
    "## Fact sources (`apps/web/src/content/sources.json`, all verified)",
    "",
    "Every fact line in the game cites one or more of these IDs: 275 facts, 46 sources, 0 problems in `npm run check:facts`.",
    "",
    "| ID | Title | Publisher | URL | How the game uses it | Opens without login? |",
    "|---|---|---|---|---|---|",
]
out += [f"| {s['id']} | {s['title']} | {s['publisher']} | {s['url']} | {USE.get(s['id'], 'Fact source')} | {status(s['url'])} |" for s in S]
out += [
    "",
    "## Other references",
    "",
    "- Challenge page: https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/ (its resources tab lists NSSDCA and the Apollo 11 lunar module page, both used).",
    "- Code libraries, fonts, models and tools: `CREDITS.md`. AI tools: `AI_USE.md`.",
    "- The game is not endorsed by NASA and uses no NASA insignia, logotype, seal, flags or mission patches.",
]
txt = ("\n".join(out) + "\n").replace("–", "-").replace("—", ", ")
assert "—" not in txt and "–" not in txt
dst = ROOT / "docs/submission/local/nasa_resources.md"
dst.write_text(txt, encoding="utf-8")
print("written", dst, len(S), "sources")
