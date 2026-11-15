"""Nova server settings. Secrets come only from the environment, server/.env or the repo-root .env
(both git-ignored, never committed, never sent to the browser)."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "apps" / "web" / "src" / "content"
MODELS = ROOT / "server" / "models"

try:  # .env is optional; python-dotenv is in server/requirements.txt
    from dotenv import load_dotenv

    load_dotenv(ROOT / "server" / ".env")
    load_dotenv(ROOT / ".env")
except Exception:  # pragma: no cover
    pass

# The brain (v4.6): Google Gemini through the official google-genai SDK. Model ids verified on
# with client.models.list() against this key (not guessed):
#   gemini-3.5-flash-lite  stable, fastest 3.5 text model; measured first token ~1.4 s
MODEL = os.getenv("NOVA_MODEL", "gemini-3.5-flash-lite")
# when the main model is busy (503 / 429) these verified models answer instead
FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash"]  # gemini-2.5-flash-lite is listed but 404s for new keys
MAX_TOKENS = 220
FIRST_WORD_TIMEOUT = 8.0

MAX_CHARS = 200
HISTORY_TURNS = 6
RATE_SECONDS = 3.0
RATE_PER_SESSION = 40
MAX_WORDS = 60


def api_key() -> str | None:
    return os.getenv("GEMINI_API_KEY") or None


def elevenlabs_key() -> str | None:
    return os.getenv("ELEVENLABS_API_KEY") or None


ELEVENLABS_VOICE = os.getenv("ELEVENLABS_VOICE_ID", "")


def voice() -> dict:
    """Nova's Kokoro voice (one config value shared with the game: content/nova-voice.json)."""
    try:
        return json.loads((CONTENT / "nova-voice.json").read_text(encoding="utf-8"))
    except Exception:
        return {"voice": "am_puck", "speed": 1.05}


SYSTEM_PROMPT = (ROOT / "server" / "nova" / "system_prompt.md").read_text(encoding="utf-8").split("-->", 1)[-1].strip()
