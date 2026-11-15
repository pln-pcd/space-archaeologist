"""Nova's ears on this laptop (v7): speech-to-text with onnx-asr (MIT) on onnxruntime.

Default model: NVIDIA Parakeet TDT 0.6B v2 (CC-BY-4.0), int8, the most accurate free English
recogniser that runs on a laptop CPU; Whisper base (MIT) if Parakeet can't load. The browser sends 16 kHz
mono float32 PCM; the audio is processed in memory and never written to disk, logged or sent anywhere.
Kids often say space words the models rarely hear, so a small fixer maps common mishearings back
("know va" -> "Nova", "opportunity rover", ...)."""
from __future__ import annotations

import os
import re
import threading

import numpy as np

_lock = threading.Lock()
_model = None
_name = ""
_error: str | None = None
MODELS = [os.getenv("NOVA_STT_MODEL", "nemo-parakeet-tdt-0.6b-v2"), "whisper-base"]


def _load():
    global _model, _name, _error
    with _lock:
        if _model is not None or _error:
            return _model
        try:
            import onnx_asr
        except Exception as e:  # pragma: no cover
            _error = f"onnx-asr missing ({type(e).__name__})"
            return None
        for name in MODELS:
            try:
                _model = onnx_asr.load_model(name, quantization="int8" if name.startswith("nemo") else None)
                _name = name
                return _model
            except Exception as e:  # pragma: no cover
                _error = f"{name}: {type(e).__name__}"
        return None


def warm():
    threading.Thread(target=_load, daemon=True).start()


def status() -> str:
    return _name if _model is not None else ("loading" if not _error else "off")


WORDS = {
    r"\bknow ?va\b|\bno ?va\b|\bnover\b|\bnoah va\b|\bnovah\b": "Nova",
    r"\bapollo eleven\b": "Apollo 11",
    r"\bopper ?tunity\b|\boppertunity\b": "Opportunity",
    r"\bjupyter\b|\bjupitor\b": "Jupiter",
    r"\bnaza\b|\bnassa\b|\bnasa\b": "NASA",
    r"\bvoyageur\b": "Voyager",
    r"\bastronot\b|\bastro not\b": "astronaut",
}


def fix(text: str) -> str:
    t = text.strip()
    for pat, rep in WORDS.items():
        t = re.sub(pat, rep, t, flags=re.I)
    t = re.sub(r"\s+", " ", t)
    # Whisper sometimes "hears" captions in silence
    if re.fullmatch(r"(thank you\.?|thanks for watching!?|you\.?|\.+|\[.*\])", t, re.I):
        return ""
    return t


def hear(pcm: bytes, rate: int = 16000) -> str | None:
    """float32 little-endian mono PCM -> text ('' if nothing was said, None if no model)"""
    m = _load()
    if m is None:
        return None
    x = np.frombuffer(pcm, dtype="<f4").astype(np.float32)
    if x.size < rate * 0.25:
        return ""
    # gentle normalisation: quiet voices (kids, laptop mics) get lifted, loud ones aren't clipped
    peak = float(np.max(np.abs(x))) or 1.0
    if peak < 0.5:
        x = x * min(8.0, 0.5 / peak)
    # pad a little silence so the first and last words are never cut
    pad = np.zeros(int(rate * 0.25), dtype=np.float32)
    x = np.concatenate([pad, x, pad])
    with _lock:
        out = m.recognize(x, sample_rate=rate)
    text = out if isinstance(out, str) else str(getattr(out, "text", out))
    return fix(text)
