"""Nova's voice on this laptop: Kokoro-82M (Apache-2.0 weights) through kokoro-onnx (MIT), int8 model in
server/models/ (see README). Lines with the player's name are only ever voiced here, never by a cloud
voice. Optional premium voice: ElevenLabs, only if ELEVENLABS_API_KEY is set, only for free-form
answers (the game marks name lines private), off by default."""
from __future__ import annotations

import io
import json
import threading
import wave

import numpy as np

from . import config

_lock = threading.Lock()
_model = None
_error: str | None = None


def _load():
    global _model, _error
    with _lock:
        if _model is not None or _error:
            return _model
        # v7.2: the full-precision model sounds much smoother (int8 adds a metallic buzz); int8 = fallback
        onnx = config.MODELS / "kokoro-v1.0.onnx"
        if not onnx.exists():
            onnx = config.MODELS / "kokoro-v1.0.int8.onnx"
        voices = config.MODELS / "voices-v1.0.bin"
        if not onnx.exists() or not voices.exists():
            _error = "model files missing (see README: server/models)"
            return None
        try:
            from kokoro_onnx import Kokoro

            _model = Kokoro(str(onnx), str(voices))
        except Exception as e:  # pragma: no cover
            _error = type(e).__name__
        return _model


def warm():
    threading.Thread(target=_load, daemon=True).start()


def status() -> str:
    return "kokoro" if _model is not None else ("loading" if not _error else "off")


def _wav(samples: np.ndarray, rate: int) -> bytes:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return out.getvalue()


def _sentences(text: str) -> list[str]:
    import re

    parts = re.findall(r"[^.!?]+[.!?]+[\"')\]]*|[^.!?]+$", text.strip())
    return [p.strip() for p in parts if p.strip()] or [text]


def _style(sentence: str, base_speed: float, base_lift: float) -> tuple[float, float]:
    """v8 lively delivery: excited lines quicker and brighter, questions lifted, the rest still bouncy"""
    s = sentence.strip()
    low = s.lower()
    if s.endswith("!") or low.startswith(("ooh", "wow", "yay", "hooray", "great", "awesome", "amazing", "hi", "hello", "welcome")):
        return base_speed * 1.06, base_lift * 1.05
    if s.endswith("?"):
        return base_speed * 1.02, base_lift * 1.04
    return base_speed, base_lift


_blend_cache: dict = {}


def _voice_style(m, v: dict):
    """v8: Nova's voice can be a blend of Kokoro voices (content/nova-voice.json "blend"): a warm, natural
    base with a brighter, more energetic voice mixed in sounds livelier than pitching one voice up"""
    blend = v.get("blend") or {}
    if not blend:
        return v["voice"]
    key = json.dumps(blend, sort_keys=True)
    if key not in _blend_cache:
        total = sum(blend.values()) or 1.0
        _blend_cache[key] = sum(m.get_voice_style(name) * (w / total) for name, w in blend.items())
    return _blend_cache[key]


def speak(text: str, voice: str | None = None, speed: float | None = None, pitch: float | None = None) -> bytes | None:
    """WAV bytes, or None if Kokoro isn't available. Nova's own voice (no `voice` given, or af_heart) is
    delivered expressively: each sentence gets its own pace and a gentle formant-preserving lift, with a
    small natural pause between sentences. One voice for the whole game (content/nova-voice.json)."""
    m = _load()
    if m is None:
        return None
    v = config.voice()
    named = (v.get("voices") or {}).get(voice or "")
    if named:
        voice = None if named == v["voice"] else named
    own = voice in (None, v["voice"])
    base_speed = speed or float(v["speed"])
    base_lift = pitch if pitch is not None else (float(v.get("pitch", 1.0)) if own else 1.0)
    chunks = []
    rate = 24000
    parts = _sentences(text) if own and pitch is None else [text]
    for i, part in enumerate(parts):
        sp, lift = _style(part, base_speed, base_lift) if own and pitch is None else (base_speed, base_lift)
        with _lock:  # one synthesis at a time (onnxruntime session)
            samples, rate = m.create(part, voice=voice or _voice_style(m, v), speed=sp, lang="en-us")
        w = _wav(samples, rate)
        if lift != 1.0:
            w = _pitch(w, lift)
        r = wave.open(io.BytesIO(w))
        chunks.append(np.frombuffer(r.readframes(r.getnframes()), dtype="<i2").astype(np.float32) / 32768)
        if i < len(parts) - 1:
            chunks.append(np.zeros(int(rate * (0.12 if part.endswith((",", ";")) else 0.2)), dtype=np.float32))
    # 60 ms of silence at the start so the first syllable is never clipped
    out = np.concatenate([np.zeros(int(rate * 0.06), dtype=np.float32), *chunks])
    return _wav(out, rate)


def _pitch(wav: bytes, lift: float) -> bytes:
    """pitch up without changing the tempo (ffmpeg rubberband); the plain voice if ffmpeg is missing"""
    import shutil
    import subprocess
    from pathlib import Path

    ff_dir = Path.home() / "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin"
    ff = str(ff_dir / "ffmpeg.exe") if (ff_dir / "ffmpeg.exe").exists() else shutil.which("ffmpeg")
    if not ff:
        return wav
    try:
        rate = wave.open(io.BytesIO(wav)).getframerate()
        # raw PCM out (a piped WAV header has no length), then a proper WAV around it
        r = subprocess.run([ff, "-v", "error", "-f", "wav", "-i", "pipe:0", "-af", f"rubberband=pitch={lift}:pitchq=quality:formant=preserved", "-f", "s16le", "-ac", "1", "-ar", str(rate), "pipe:1"], input=wav, capture_output=True, timeout=10)
        if r.returncode != 0 or len(r.stdout) < 1000:
            return wav
        out = io.BytesIO()
        with wave.open(out, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(r.stdout)
        return out.getvalue()
    except Exception:
        return wav


def elevenlabs(text: str) -> bytes | None:
    key = config.elevenlabs_key()
    if not key or not config.ELEVENLABS_VOICE:
        return None
    import httpx

    r = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE}?output_format=mp3_44100_128",
        headers={"xi-api-key": key, "content-type": "application/json"},
        json={"text": text, "model_id": "eleven_flash_v2_5"},
        timeout=10,
    )
    return r.content if r.status_code == 200 else None
