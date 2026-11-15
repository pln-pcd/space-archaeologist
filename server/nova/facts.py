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


def words(s: str) -> list[str]:
    return [w for w in re.sub(r"[^a-z0-9\s-]", " ", s.lower()).split() if w and w not in STOP]


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
    verified = {s["id"] for s in _read("sources.json")["sources"] if s["status"] == "verified"}
    def walk(value, path):
        if isinstance(value, list):
            for i, item in enumerate(value): walk(item, f"{path}/{i}")
        elif isinstance(value, dict):
            if value.get("kind") == "fact" and value.get("sourceId") in verified:
                out.append(Fact(path, value["text"], "eagle"))
            for key, item in value.items(): walk(item, f"{path}/{key}")
    directory = CONTENT / "missions"
    if directory.exists():
        for file in directory.glob("*.json"):
            walk(json.loads(file.read_text(encoding="utf-8")), file.stem)
    return tuple(out)


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
    safe = [Fact(f"{artifact['id']}/{i}", f["text"], "eagle") for i, f in enumerate(facts) if f.get("sourceId") in verified]
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
    q = {stem(w) for w in words(question)}
    ranked = sorted(all_facts(), key=lambda f: _score(q, f, mission), reverse=True)
    top = [f for f in ranked[:k] if _score(q, f, mission) > 0.15]
    if mission and len(top) < 3:  # always give the mission's basics
        top += [f for f in all_facts() if f.mission == mission and f.faq and f not in top][: 3 - len(top)]
    return top


def local_answer(question: str, mission: str | None) -> Fact | None:
    q = {stem(w) for w in words(question)}
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
