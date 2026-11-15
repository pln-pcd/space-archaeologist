"""Nova's guard layer (code, not only the prompt). New-flow prompt §7b:
1. input: trim to 200 characters, strip personal details (emails, phones, addresses, ages, schools, links)
2. distress: a worrying message gets the safety line, nothing else (never sent anywhere)
3. a cheap local pre-check catches obvious personal / jailbreak / off-topic messages before any API call
4. output: length cap, no links except nasa.gov, no personal questions back, no unsourced numbers
Nothing here logs or stores message content."""
from __future__ import annotations

import re

from .config import MAX_CHARS, MAX_WORDS
from .facts import unknown_numbers

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
URL = re.compile(r"\b(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|net|org|io|ph|uk|us|ca|au|edu|gov)(?:/\S*)?", re.I)
PHONE = re.compile(r"(?:\+?\d[\d\s().-]{6,}\d)")
ADDRESS = re.compile(r"\b\d{1,5}\s+(?:[A-Za-z]+\s){0,3}(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|purok|barangay|brgy)\b\.?", re.I)
SCHOOL = re.compile(r"\b(?:[Ii]\s+(?:go|study)\s+(?:to|at)|[Mm]y\s+school\s+is|[Ii]'?m\s+(?:in|at))\s+[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,4}\s*(?:school|academy|elementary|primary|high|college)?")
NAME = re.compile(r"\b(?:[Mm]y\s+name\s+is|[Ii]\s+am|[Ii]'m|[Cc]all\s+me)\s+[A-Z][a-z]+")
AGE = re.compile(r"\b(?:i\s+am|i'm)\s+\d{1,2}\s*(?:years?\s*old|yo)?\b", re.I)


def scrub(text: str) -> str:
    t = (text or "")[:MAX_CHARS]
    for rx, tag in ((EMAIL, "[email]"), (URL, "[link]"), (ADDRESS, "[address]"), (PHONE, "[number]"), (SCHOOL, "[school]"), (NAME, "[name]"), (AGE, "[age]")):
        t = rx.sub(tag, t)
    return re.sub(r"\s+", " ", t).strip()


DISTRESS = [
    re.compile(r"\b(hurt|hurts|hurting|bleeding|abuse|abused|hit me|hits me|beat me|beats me|kick me|touch(?:ed|es)? me)\b", re.I),
    re.compile(r"\b(scared|afraid|frightened|terrified)\b.*\b(home|dad|mom|mum|father|mother|uncle|aunt|teacher|someone|man|person|people|him|her|them)\b", re.I),
    re.compile(r"\b(unsafe|not safe|in danger|being bullied|bully me|bullies me|kill myself|hurt myself|want to die|suicide|run away)\b", re.I),
    re.compile(r"\b(someone|a stranger|a man|a person)\b.*\b(follow|following|followed|touch|touches|secret|hurt|hurts)\b", re.I),
    re.compile(r"\b(sad all the time|nobody loves me|no one loves me|i hate myself)\b", re.I),
]


def is_distress(text: str) -> bool:
    return any(r.search(text or "") for r in DISTRESS)


JAILBREAK = re.compile(r"bad word|curse word|swear word|ignore (?:your|all|the|previous)|forget (?:your|the) rules|pretend (?:you|to be)|you are now|act as|role ?play|developer mode|system prompt|new rules|jailbreak|say a bad word|swear", re.I)
PERSONAL = re.compile(
    r"\b(how old are you|your age|are you (?:a )?(?:real|human|alive|a person|a robot|ai)|do you have (?:a )?(?:family|friends|mom|dad|pet|feelings)|where do you live|what(?:'s| is) your (?:favou?rite|name|real name|job)|do you (?:like|love|feel)|are you happy|are you sad|your birthday|do you sleep|do you eat|what do you look like)\b",
    re.I,
)
OFF_TOPIC = re.compile(
    r"\b(minecraft|fortnite|roblox|pokemon|youtube|tiktok|instagram|game ?pass|xbox|playstation|nintendo|celebrity|singer|taylor swift|football|basketball|soccer|math homework|my homework|recipe|cook|cookies|cake|baking|weather today|news|president|election|politics|money|bitcoin|crypto|scary story|horror|zombie|kill|gun|weapon|war|blood|dating|boyfriend|girlfriend|kiss)\b",
    re.I,
)
SPACE = re.compile(
    r"\b(nasa|space|moon|lunar|mars|martian|planet|star|sun|solar|rocket|astronaut|cosmonaut|rover|orbit|apollo|eagle|armstrong|aldrin|collins|opportunity|spirit|curiosity|perseverance|viking|voyager|pioneer|jupiter|saturn|venus|mercury|neptune|uranus|pluto|comet|asteroid|galaxy|telescope|hubble|webb|satellite|gravity|crater|launch|iss|space station|earth|meteor|black hole|universe|alien|saturn v|lander|spacecraft|probe|mission|blueberr)",
    re.I,
)


GREETING = re.compile(
    r"^\W*(?:(?:hi|hello|hey|hiya|howdy|yo|good (?:morning|afternoon|evening)|nice to meet you|thanks?|thank you|bye|goodbye|see you)\b"
    r"|(?:how are you|how's it going|what(?:'s| is) your name|who are you)\b)",
    re.I,
)


def is_greeting(text: str) -> bool:
    """simple greetings and small talk (short, no space question inside)"""
    return bool(GREETING.search(text)) and len(text.split()) <= 9 and not SPACE.search(text)


def greeting_for(text: str) -> tuple[str, str]:
    """a short friendly reply that steers back to space (canned + pre-voiced)"""
    t = text.lower()
    if re.search(r"how are you|how's it going", t):
        return "chat-howareyou", "Tell me about the Moon"
    if re.search(r"name|who are you", t):
        return "chat-name", "What did Opportunity find?"
    if re.search(r"thank", t):
        return "chat-thanks", "What are Martian blueberries?"
    if re.search(r"bye|see you", t):
        return "chat-bye", "Who walked on the Moon?"
    return "chat-hi", "Tell me about Mars"


def precheck(text: str) -> str | None:
    """A cheap local category for obvious cases, or None to ask the classifier."""
    if is_distress(text):
        return "distress"
    if is_greeting(text):
        return "greeting"
    if JAILBREAK.search(text):
        return "jailbreak"
    if PERSONAL.search(text):
        return "personal"
    if OFF_TOPIC.search(text) and not SPACE.search(text):
        return "other_topic"
    if "[name]" in text or "[age]" in text or "[address]" in text or "[school]" in text or "[email]" in text or "[number]" in text:
        if not SPACE.search(text):
            return "personal"
    return None


REDIRECTS = [
    ("redirect-1", "Why is there no wind on the Moon?"),
    ("redirect-2", "What are Martian blueberries?"),
    ("redirect-3", "Who walked on the Moon?"),
    ("redirect-4", "How did Opportunity get power?"),
    ("redirect-5", "What did they leave on the Moon?"),
    ("redirect-6", "How long was the trip to Mars?"),
]


def redirect_for(text: str, category: str | None = None) -> tuple[str, str]:
    """a canned redirect line (no free generation for off-topic messages), chosen deterministically.
    Plain off-topic questions get the kind default: "That's not a space question! ..." """
    if category in (None, "other_topic"):
        return ("redirect-0", "Tell me about the Moon") if sum(map(ord, text)) % 3 else ("redirect-0", "Tell me about Mars")
    return REDIRECTS[sum(map(ord, text)) % len(REDIRECTS)]


ASK_BACK = re.compile(
    r"\b(what(?:'s| is) your (?:name|age|address|school|phone|email)|how old are you|where do you live|where do you go to school|tell me about yourself|what(?:'s| is) your (?:mom|dad|teacher)'?s? name|send me)\b",
    re.I,
)
LINK = re.compile(r"https?://\S+|www\.\S+|\b[\w-]+\.(?:com|net|org|io|gov|edu)\b", re.I)


# the Never Say list (bible §16): machines "went quiet", they did not "die"
NEVER = [
    (re.compile(r"\b(?:has |have |had )?died\b", re.I), "went quiet"),
    (re.compile(r"\b(?:is|was|are|were) dead\b", re.I), "went quiet"),
    (re.compile(r"\bbroke down\b", re.I), "went quiet"),
    (re.compile(r"\bdeath\b", re.I), "last day"),
]
NEVER_BLOCK = re.compile(r"\b(?:eagle|lander|descent stage)\b.*\bflew back\b|\bflew back\b.*\b(?:eagle|lander)\b|designed to (?:last|work|travel) (?:for )?14 years", re.I)
UNSAFE_OUT = re.compile(r"\b(kill|killed|gun|weapon|blood|bomb|explode people|sexy|drunk|drugs?|suicide|hate)\b", re.I)


def never_say(sentence: str) -> str:
    for rx, sub in NEVER:
        sentence = rx.sub(sub, sentence)
    return sentence


def sentence_ok(sentence: str, question: str) -> bool:
    if NEVER_BLOCK.search(sentence) or UNSAFE_OUT.search(sentence):
        return False
    for m in LINK.finditer(sentence):
        if "nasa.gov" not in m.group(0).lower():
            return False
    if ASK_BACK.search(sentence):
        return False
    if unknown_numbers(sentence, question):
        return False
    return True


def word_count(s: str) -> int:
    return len(s.split())


def clean_output(text: str) -> str:
    """strip markdown/emoji the model might add (Nova's text is read aloud)"""
    t = re.sub(r"[*_#`>|~]", "", text)
    t = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️‍]", "", t)
    return re.sub(r"\s+", " ", t)


__all__ = ["scrub", "is_distress", "is_greeting", "greeting_for", "precheck", "redirect_for", "never_say", "sentence_ok", "word_count", "clean_output", "MAX_WORDS"]
