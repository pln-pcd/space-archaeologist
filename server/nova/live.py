"""Live NASA data for Nova (v7). When a question is about today's sky, Nova looks it up on NASA's open
APIs (api.nasa.gov, free; NASA_API_KEY in server/.env or the public DEMO_KEY) and gets the numbers as
<live_nasa> facts it is allowed to use:

  picture of the day  -> APOD title + first sentence
  asteroids           -> NeoWs: how many fly past Earth today, the closest one in Moon-distances
  space weather       -> DONKI: solar flares and geomagnetic storms in the last 7 days
  weather on Mars     -> the Curiosity rover's REMS weather report (Gale Crater), when NASA publishes it

Nothing about the child is sent: only the fixed API query. Results are cached for 30 minutes; every
call has a 4 s timeout; any failure simply means no live block (Nova answers from its facts)."""
from __future__ import annotations

import datetime as dt
import os
import re
import time

import httpx

KEY = os.getenv("NASA_API_KEY", "DEMO_KEY")
_cache: dict[str, tuple[float, str | None]] = {}
TTL = 30 * 60

TOPICS = {
    "apod": re.compile(r"\b(picture|photo|image) of the day\b|\bapod\b|\btoday'?s (space )?(picture|photo)\b", re.I),
    "asteroids": re.compile(r"\b(asteroids?|near[- ]earth|space rocks?|meteoroids?)\b", re.I),
    "space_weather": re.compile(r"\b(space weather|solar flares?|sun storms?|solar storms?|geomagnetic|auroras?|northern lights|cme|coronal)\b", re.I),
    "mars_weather": re.compile(r"\b(weather|temperature|cold|hot|warm|season)\b.*\bmars\b|\bmars\b.*\b(weather|temperature|cold|hot|warm|season)\b", re.I),
}


def _get(url: str, params: dict | None = None) -> dict | list | None:
    try:
        r = httpx.get(url, params=params, timeout=6.0, headers={"user-agent": "space-archaeologist/1.0"})
        return r.json() if r.status_code == 200 else None
    except Exception:
        return None


def _cached(name: str, fn) -> str | None:
    hit = _cache.get(name)
    # a good answer is kept for 30 minutes; a failed call only for 1 minute (v7.6: a slow NASA
    # reply used to silence the live answer for half an hour)
    if hit and time.time() - hit[0] < (TTL if hit[1] else 60):
        return hit[1]
    try:
        val = fn()
    except Exception:
        val = None
    _cache[name] = (time.time(), val)
    return val


def _apod() -> str | None:
    j = _get("https://api.nasa.gov/planetary/apod", {"api_key": KEY})
    if not isinstance(j, dict) or not j.get("title"):
        return None
    first = re.split(r"(?<=[.!?])\s", (j.get("explanation") or "").strip())[0][:220]
    return f"NASA's Astronomy Picture of the Day ({j.get('date')}) is called \"{j['title']}\". {first}"


def _asteroids() -> str | None:
    today = dt.date.today().isoformat()
    j = _get("https://api.nasa.gov/neo/rest/v1/feed", {"start_date": today, "end_date": today, "api_key": KEY})
    if not isinstance(j, dict):
        return None
    neos = (j.get("near_earth_objects") or {}).get(today) or []
    if not neos:
        return None
    best = None
    for n in neos:
        for c in n.get("close_approach_data") or []:
            ld = float(c.get("miss_distance", {}).get("lunar", "nan"))
            if best is None or ld < best[0]:
                best = (ld, n.get("name", "an asteroid"))
    hazardous = sum(1 for n in neos if n.get("is_potentially_hazardous_asteroid"))
    s = f"Today NASA is tracking {len(neos)} asteroids flying past Earth."
    if best:
        s += f" The closest one, {best[1]}, passes about {round(best[0])} times farther away than the Moon, so it is safe."
    if hazardous == 0:
        s += " None of them will hit Earth."
    return s


def _space_weather() -> str | None:
    end = dt.date.today()
    start = end - dt.timedelta(days=7)
    flares = _get("https://api.nasa.gov/DONKI/FLR", {"startDate": start.isoformat(), "endDate": end.isoformat(), "api_key": KEY})
    storms = _get("https://api.nasa.gov/DONKI/GST", {"startDate": start.isoformat(), "endDate": end.isoformat(), "api_key": KEY})
    if flares is None and storms is None:
        return None
    nf = len(flares) if isinstance(flares, list) else 0
    ns = len(storms) if isinstance(storms, list) else 0
    big = ""
    if isinstance(flares, list) and flares:
        classes = [f.get("classType") or "" for f in flares]
        top = max(classes, key=lambda c: ("ABCMX".find(c[:1]), float(c[1:] or 0) if c[1:].replace(".", "").isdigit() else 0))
        if top:
            big = f" The biggest was a class {top} flare."
    return f"In the last 7 days NASA's space weather team counted {nf} solar flares and {ns} geomagnetic storms.{big}"


def _mars_weather() -> str | None:
    j = _get("https://mars.nasa.gov/rss/api/", {"feed": "weather", "category": "msl", "feedtype": "json"})
    sols = (j or {}).get("soles") if isinstance(j, dict) else None
    if not sols:
        return None
    s = sols[0]
    try:
        lo, hi = int(s["min_temp"]), int(s["max_temp"])
    except Exception:
        return None
    return f"The Curiosity rover's weather station on Mars (sol {s.get('sol')}, {s.get('terrestrial_date')}) measured a high of {hi} degrees Celsius and a low of {lo} degrees Celsius."


FETCH = {"apod": _apod, "asteroids": _asteroids, "space_weather": _space_weather, "mars_weather": _mars_weather}


def lookup(question: str) -> list[str]:
    """live facts for this question (blocking; call in a thread). [] when nothing applies or offline"""
    out = []
    for name, pat in TOPICS.items():
        if pat.search(question):
            v = _cached(name, FETCH[name])
            if v:
                out.append(v)
    return out
