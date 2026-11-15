"""Starship Odyssey local server (FastAPI). Run with `npm run dev` (starts Vite + this) or
`python -m uvicorn server.app:app --port 8000 --no-access-log`.

  POST /api/nova/chat   {message, missionId|null, history}  → NDJSON stream (see nova/brain.py)
  POST /api/nova/speak  {text, private?}                    → audio (WAV from Kokoro; MP3 if ElevenLabs)
  POST /api/nova/hear   16 kHz float32 PCM                   → {"text"} (speech-to-text on this laptop)
  GET  /api/nova/status                                      → which brain and voice are available

The Gemini key lives only in server/.env on this computer (never in the browser bundle). No chat content is logged or saved."""
from __future__ import annotations

import json
import time
from collections import defaultdict

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from .nova import config, ears, tts
from .nova.brain import STATS, answer

app = FastAPI(title="Starship Odyssey · Nova", version="1.0", docs_url=None, redoc_url=None)


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    text: str = Field(max_length=600)


class MissionContext(BaseModel):
    missionId: str = Field(pattern="^[a-z0-9-]{1,60}$")
    step: int = Field(ge=1, le=12)
    artifactId: str | None = Field(default=None, pattern="^[a-z0-9-]{1,60}$")


class Memory(BaseModel):
    """in-game memory the browser keeps (no names, no chat text)"""
    missionsDone: list[str] = Field(default_factory=list, max_length=6)
    found: list[str] = Field(default_factory=list, max_length=8)
    topics: list[str] = Field(default_factory=list, max_length=8)
    screen: str | None = Field(default=None, max_length=40)


class Chat(BaseModel):
    message: str = Field(max_length=1000)
    missionId: str | None = Field(default=None, pattern="^(eagle|opportunity)$")
    history: list[Turn] = Field(default_factory=list, max_length=12)
    context: MissionContext | None = None
    memory: Memory | None = None
    # the message came from the microphone (speech-to-text): fix mishearings before answering
    spoken: bool = False


class Speak(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    private: bool = False
    # Nova's voice choice from Settings ("puck" | "michael" | "heart") or a Kokoro voice id (dev/bench)
    voice: str | None = Field(default=None, pattern="^([a-z]{2}_[a-z]+|puck|michael|heart)$")


# ---- rate limit: 1 request / 3 s and 40 per session, per device (session header + address) ----
_last: dict[str, float] = {}
_count: defaultdict[str, int] = defaultdict(int)


def _limit(request: Request, session: str) -> str | None:
    key = f"{request.client.host if request.client else 'local'}|{session[:40]}"
    now = time.monotonic()
    if now - _last.get(key, 0) < config.RATE_SECONDS:
        return "chat-wait"
    if _count[key] >= config.RATE_PER_SESSION:
        return "chat-rest"
    _last[key] = now
    _count[key] += 1
    return None


@app.on_event("startup")
def _warm():
    tts.warm()
    ears.warm()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/nova/status")
def status():
    return {"brain": "gemini" if config.api_key() else "offline", "model": config.MODEL if config.api_key() else None, "voice": tts.status(), "ears": ears.status(), "stats": dict(STATS)}


@app.post("/api/nova/chat")
async def chat(body: Chat, request: Request, x_nova_session: str = Header(default="anon")):
    limited = _limit(request, x_nova_session)

    async def events():
        if limited:
            yield json.dumps({"type": "meta", "kind": "limit", "lineId": limited}) + "\n"
            yield json.dumps({"type": "end"}) + "\n"
            return
        async for e in answer(body.message, body.missionId, [t.model_dump() for t in body.history], context=body.context.model_dump() if body.context else None, memory=body.memory.model_dump() if body.memory else None, spoken=body.spoken):
            yield json.dumps(e) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson", headers={"cache-control": "no-store"})


@app.post("/api/nova/speak")
async def speak(body: Speak):
    text = body.text.strip()
    # every voice is Kokoro on this laptop (natural, free, private); no cloud TTS
    wav = await run_in_threadpool(tts.speak, text, body.voice)
    if wav is None:
        raise HTTPException(503, "voice unavailable")
    return Response(wav, media_type="audio/wav", headers={"cache-control": "no-store", "x-voice": "kokoro"})


@app.post("/api/nova/hear")
async def hear(request: Request):
    """16 kHz mono float32 PCM (at most 20 s) -> {"text"}. In memory only: never saved or logged."""
    body = await request.body()
    if len(body) > 16000 * 4 * 20 or len(body) % 4:
        raise HTTPException(413, "too long")
    text = await run_in_threadpool(ears.hear, body)
    if text is None:
        raise HTTPException(503, "ears unavailable")
    return {"text": text, "model": ears.status()}
