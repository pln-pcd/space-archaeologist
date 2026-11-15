"""The game's own fact sheet, used three ways:
1. retrieval: the facts relevant to the question (and the current mission) go into Claude's prompt,
2. the offline / no-key answers (nova-faq.json),
3. the number check: every number Nova says must appear somewhere in these sourced facts.
Only lines with type "fact" and sourceIds are used (they trace back to content/sources.json)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache

from .config import CONTENT

STOP = set(
    "a an the is are was were do does did how why what when where who which of on in to for and or it its it's i you me my your can could would will about tell please there this that they them their".split()
)


@dataclass(frozen=True)
class Fact:
    id: str
    text: str
    mission: str | None
    keys: tuple[str, ...] = ()
    faq: bool = False


# v8: what speech-to-text often mishears in space questions (whole words / phrases)
SPEECH_FIX = [
    (r"\bknow va\b|\bno va\b|\bnover\b", "nova"),
    (r"\bmass rover\b", "mars rover"),
    (r"\bmarz\b|\bmass\b(?= (?:rover|planet|mission|dust|day|sol))", "mars"),
    (r"\b(?:the )?noon\b(?= (?:landing|rock|dust|base|mission|lander))", "moon"),
    (r"\bmoan\b", "moon"),
    (r"\bapolo\b|\bappollo\b|\ba polo\b", "apollo"),
    (r"\bopportunities\b(?= rover)", "opportunity"),
    (r"\bretro reflector\b|\bretro-reflector\b", "retroreflector"),
    (r"\bseismo meter\b|\bseismograph\b", "seismometer"),
    (r"\bblue berries\b", "blueberries"),
    (r"\bneil armstrong's\b", "neil armstrong"),
]


def fix_speech(s: str) -> str:
    t = s.lower()
    for pat, to in SPEECH_FIX:
        t = re.sub(pat, to, t)
    return t


# v8: words that mean the same thing in this game (search both ways)
SYNONYMS = {
    "moon": ["lunar"], "lunar": ["moon"],
    "rover": ["opportunity"], "opportunity": ["rover"],
    "lander": ["eagle", "descent"], "eagle": ["lander"], "lem": ["lander", "eagle"],
    "mars": ["martian"], "martian": ["mars"],
    "rocket": ["launch"], "launch": ["rocket"],
    "laser": ["reflector", "retroreflector"], "mirror": ["reflector"], "reflector": ["laser", "retroreflector"], "retroreflector": ["reflector", "laser"],
    "earthquake": ["moonquake", "seismometer"], "moonquake": ["seismometer"], "quake": ["seismometer"], "shake": ["seismometer"],
    "blueberry": ["hematite"], "hematite": ["blueberry"], "pebble": ["blueberry"],
    "solar": ["panel"], "panel": ["solar"], "power": ["solar"],
    "armstrong": ["neil"], "aldrin": ["buzz"], "plaque": ["sign", "message"], "sign": ["plaque"],
    "gravity": ["weight"], "far": ["distance"], "distance": ["far"],
    "storm": ["dust"], "airbag": ["bounce"], "bounce": ["airbag"],
}


def words(s: str) -> list[str]:
    return [w for w in re.sub(r"[^a-z0-9\s-]", " ", fix_speech(s)).split() if w and w not in STOP]


def expand(ws: set[str]) -> set[str]:
    out = set(ws)
    for w in ws:
        for syn in SYNONYMS.get(w, []):
            out.add(stem(syn))
    return out


def stem(w: str) -> str:
    return re.sub(r"(ies|es|s|ing|ed)$", "", w)


def _read(name: str):
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def all_facts() -> tuple[Fact, ...]:
    out: list[Fact] = []
    for f in _read("nova-faq.json")["faq"]:
        out.append(Fact(f["id"], f["a"], f.get("mission"), tuple(f["keys"]), True))
    for file, mission in (("chapters/ch1-moon.json", "eagle"), ("chapters/ch2-mars.json", "opportunity")):
        for beat in _read(file)["beats"]:
            for line in beat["lines"]:
                if line.get("type") == "fact" and line.get("sourceIds"):
                    out.append(Fact(line["id"], line["text"], mission))
    for c in _read("curiosities.json")["curiosities"]:
        if c.get("type") == "fact":
            out.append(Fact(c["id"], c["text"], None))
    sources = _read("sources.json")["sources"]
    verified = {s["id"] for s in sources if s["status"] == "verified"}
    # v8: every sourced dataset in the game feeds Nova
    # 1. the glossary (kid words with sources)
    for key, term in (_read("glossary.json").get("terms") or {}).items():
        if term.get("sourceIds") and set(term["sourceIds"]) & verified:
            out.append(Fact(f"glossary/{key}", f"{term.get('word', key).capitalize()}: {term['kid']}", None))
    # 2. the sealed missions' teasers (Viking 1, Pioneer 10, Voyager 1)
    for t in _read("teasers.json").get("teasers", []):
        for i, line in enumerate(t.get("lines", [])):
            if line.get("type") == "fact" and set(line.get("sourceIds") or []) & verified:
                out.append(Fact(f"teaser/{t['chapter']}/{i}", f"{t['title']}: {line['text']}", None))
    # 3. the quizzes (question + right answer + clue)
    qdir = CONTENT / "questions"
    if qdir.exists():
        for file in qdir.glob("*.json"):
            data = json.loads(file.read_text(encoding="utf-8"))
            ch = data.get("chapter")
            mission = "opportunity" if ch == "opportunity" else "eagle" if ch in ("eagle", "moon") else None
            for q in data.get("questions", []):
                # only plain questions with a right answer (not "true story or imagine?" games)
                if not set(q.get("sourceIds") or []) & verified or q.get("format") not in ("pick", "number") or "imagine" in q.get("prompt", "").lower():
                    continue
                right = [o.get("label", "") for o in q.get("options", []) if o.get("correct")]
                text = f"{q['prompt'].rstrip('…. ')} {right[0] if right else ''}. {q.get('clue', '')}".strip()
                out.append(Fact(f"quiz/{q['id']}", text, mission))
    # 4. NASA source fact sheets (their titles hold the checked numbers: gravity, distances, dates)
    for src in sources:
        if src["status"] == "verified" and src.get("title"):
            out.append(Fact(f"source/{src['id']}", src["title"], None))
    # 5. the missions' sourced lines (both the Moon and Mars)
    def walk(value, path, mission):
        if isinstance(value, list):
            for i, item in enumerate(value): walk(item, f"{path}/{i}", mission)
        elif isinstance(value, dict):
            if value.get("kind") == "fact" and value.get("sourceId") in verified:
                out.append(Fact(path, value["text"], mission))
            for key, item in value.items(): walk(item, f"{path}/{key}", mission)
    directory = CONTENT / "missions"
    if directory.exists():
        for file in directory.glob("*.json"):
            walk(json.loads(file.read_text(encoding="utf-8")), file.stem, "opportunity" if file.stem.startswith("mars") else "eagle")
    # one copy of each sentence (the same fact appears in several files)
    seen: set[str] = set()
    uniq: list[Fact] = []
    for f in out:
        k = f.text.strip().lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(f)
    return tuple(uniq)


def artifact_context(context: dict | None) -> tuple[str, list[Fact]]:
    """Only IDs cross the API. Resolve trusted, sourced copy on the server; no client facts/notes."""
    if not context: return "", []
    mission_id = context.get("missionId", "")
    if not isinstance(mission_id, str) or not re.fullmatch(r"[a-z0-9-]{1,60}", mission_id): return "", []
    path = CONTENT / "missions" / f"{mission_id}.json"
    if not path.is_file(): return "", []
    mission = json.loads(path.read_text(encoding="utf-8"))
    artifact = next((a for a in mission["artifacts"] if a["id"] == context.get("artifactId")), None)
    step = context.get("step")
    if not isinstance(step, int) or not 1 <= step <= 12: return "", []
    if step == 8:
        reconstruction = mission["reconstruction"]
        facts = [reconstruction["stages"][0]["name"], reconstruction["summary"], reconstruction["stages"][1]["function"], reconstruction["stages"][0]["function"], reconstruction["timeline"][-1]["fact"]]
        verified = {s["id"] for s in _read("sources.json")["sources"] if s["status"] == "verified"}
        safe = [Fact(f"reconstruction/{i}", fact["text"], "eagle") for i, fact in enumerate(facts) if fact.get("sourceId") in verified]
        return "Current mission step: 8. The screen shows a reconstruction of the Lunar Module.", safe
    if artifact is None: return f"Mission step {step}; no artifact selected.", []
    verified = {s["id"] for s in _read("sources.json")["sources"] if s["status"] == "verified"}
    facts = [artifact["name"], artifact["summary"], artifact["purpose"], artifact["leftBehindReason"]["fact"], artifact["significance"]]
    tag = "opportunity" if mission_id.startswith("mars") else "eagle"
    parts = [c for c in artifact.get("components", [])]
    facts += [p["clue"] for p in parts if isinstance(p.get("clue"), dict)] + [p["function"] for p in parts if isinstance(p.get("function"), dict)]
    safe = [Fact(f"{artifact['id']}/{i}", f["text"], tag) for i, f in enumerate(facts) if f.get("sourceId") in verified]
    return f"Current mission step: {step}. The object on screen is {artifact['name']['text']}.", safe


def _score(q: set[str], f: Fact, mission: str | None) -> float:
    s = 0.0
    for k in f.keys:
        kw = [stem(w) for w in words(k)]
        if kw:
            hit = sum(1 for w in kw if w in q) / len(kw)
            s = max(s, 1 + len(kw) * 0.1 if hit == 1 else hit * 0.7)
    tw = {stem(w) for w in words(f.text)}
    if tw:
        s = max(s, len(q & tw) / max(3, len(q)) * 0.9)
    if mission and f.mission == mission:
        s += 0.15
    return s


def retrieve(question: str, mission: str | None, k: int = 6) -> list[Fact]:
    q = expand({stem(w) for w in words(question)})
    ranked = sorted(all_facts(), key=lambda f: _score(q, f, mission), reverse=True)
    top = [f for f in ranked[:k] if _score(q, f, mission) > 0.15]
    if mission and len(top) < 3:  # always give the mission's basics
        top += [f for f in all_facts() if f.mission == mission and f.faq and f not in top][: 3 - len(top)]
    return top


def local_answer(question: str, mission: str | None) -> Fact | None:
    q = expand({stem(w) for w in words(question)})
    if not q:
        return None
    best = max((f for f in all_facts() if f.faq), key=lambda f: _score(q, f, mission))
    return best if _score(q, best, mission) >= 0.7 else None


NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")


@lru_cache(maxsize=1)
def known_numbers() -> frozenset[str]:
    nums: set[str] = set()
    for f in all_facts():
        nums.update(n.replace(",", "") for n in NUM.findall(f.text))
    for s in _read("sources.json")["sources"]:
        nums.update(n.replace(",", "") for n in NUM.findall(s.get("title", "")))
    return frozenset(nums)


def unknown_numbers(text: str, question: str = "") -> list[str]:
    asked = {n.replace(",", "") for n in NUM.findall(question)}
    return [n for n in (x.replace(",", "") for x in NUM.findall(text)) if n not in known_numbers() and n not in asked]
