"""Voices (v4.6 §7). Offline pre-render: the game plays these clips with no internet.

  python -I scripts/voices.py --audition [--kokoro-only]   A/B samples → apps/web/public/audio/voicelab/
                                              *.mp3 + voicelab.json (pitch, range, pace, pauses) for /dev/voices
  python -I scripts/voices.py --nova [--force]         every scripted Nova line → public/audio/nova/<id>.mp3
  python -I scripts/voices.py --story 1|2 [--force]    chapter narration (narrator + Nova lines) →
                                              public/audio/vo/ch1|ch2/<id>.mp3 + durations.json
  --engine=kokoro (default) | --engine=gemini

Casting:
  Nova      Kokoro am_puck, a touch faster, plus a slight pitch lift (+6 %): young and jolly.
            (Gemini TTS "Puck" with a style prompt when --engine=gemini and the key has TTS quota.)
  narrator  Kokoro af_heart at bedtime pace (0.88) spoken phrase by phrase, with a short rest at
            commas and a longer one at full stops. (Gemini "Sulafat" storyteller with --engine=gemini.)
The free Gemini tier allows only 10 TTS requests per model per day, so the shipped clips are Kokoro.
Every clip is loudness-normalised (EBU R128, -17 LUFS). {name} lead parts are never rendered (the local
server voices them live, never a cloud voice). Existing clips made by the same voice are kept unless --force."""
from __future__ import annotations

import io
import json
import re
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
import numpy as np  # noqa: E402

G = None  # Gemini TTS was removed in v7 (Kokoro only); --engine=gemini is no longer available
from server.nova import tts as kokoro  # noqa: E402
from server.nova.config import CONTENT  # noqa: E402
from nova_voices import FF, FP, pitch_track  # noqa: E402

PUB = ROOT / "apps" / "web" / "public" / "audio"
FORCE = "--force" in sys.argv
ENGINE = next((a.split("=")[1] for a in sys.argv if a.startswith("--engine=")), "kokoro")

# pitch up with rubberband (tempo kept): a young, bright, jolly voice from a male Kokoro voice
NOVA_K = {"voice": "af_heart", "speed": 1.04, "pitch": 1.12}  # v7.2: ONE voice, full model, gentle formant-preserving lift
NARR_K = {"voice": "af_heart", "speed": 0.98, "comma": 0.2, "stop": 0.42}

NOVA_CANDIDATES = ["Puck", "Fenrir", "Sadachbia", "Achird", "Zephyr", "Laomedeia"]
NARRATOR_CANDIDATES = ["Sulafat", "Vindemiatrix", "Achernar", "Aoede", "Despina"]
NOVA_LINES = ["Hi, explorer! I'm Nova, your space guide on Starship Odyssey!", "Woohoo! Martian blueberries are tiny round pebbles. Want to see?"]
STORY_LINE = "Long ago, a little lander named Eagle touched the Moon. Its engines went quiet, and the dust settled softly around its feet."


def samples(wav: bytes) -> tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(wav)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    return x, sr


def _wav(x: np.ndarray, sr: int) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    return out.getvalue()


def pre_filter(pitch: float) -> str:
    return f"rubberband=pitch={pitch}:pitchq=quality:formant=preserved," if pitch != 1.0 else ""


def shift(wav: bytes, pitch: float) -> bytes:
    """the pitch-shifted WAV (for measuring what kids will hear)"""
    if pitch == 1.0:
        return wav
    with tempfile.TemporaryDirectory() as d:
        a, b = Path(d) / "a.wav", Path(d) / "b.wav"
        a.write_bytes(wav)
        subprocess.run([FF, "-v", "error", "-y", "-i", str(a), "-af", pre_filter(pitch).rstrip(","), str(b)], check=True)
        return b.read_bytes()


def to_mp3(wav: bytes, out: Path, pitch: float = 1.0) -> float:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav)
        tmp = f.name
    out.parent.mkdir(parents=True, exist_ok=True)
    af = pre_filter(pitch) + "loudnorm=I=-17:TP=-2:LRA=7,apad=pad_dur=0.12"
    subprocess.run([FF, "-v", "error", "-y", "-i", tmp, "-af", af, "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "112k", str(out)], check=True)
    Path(tmp).unlink(missing_ok=True)
    return float(subprocess.run([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip())


def metrics(wav: bytes, text: str, pitch: float = 1.0) -> dict:
    x, sr = samples(shift(wav, pitch))
    f0 = pitch_track(x, sr)
    secs = len(x) / sr
    hop = int(sr * 0.02)
    rms = np.array([np.sqrt(np.mean(x[i : i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    return {
        "seconds": round(secs, 2),
        "wpm": round(len(text.split()) / secs * 60) if secs else 0,
        "pitch_hz": round(float(np.median(f0)), 1) if len(f0) else 0,
        "pitch_range_hz": round(float(np.percentile(f0, 90) - np.percentile(f0, 10)), 1) if len(f0) else 0,
        "pause_share": round(float(np.mean(rms < 0.015)), 2) if len(rms) else 0,
    }


def kokoro_narrator(text: str) -> bytes | None:
    """bedtime pacing: phrase by phrase, a short rest at commas and a longer one at full stops"""
    parts = [p for p in re.split(r"(?<=[,.;!?])\s+", text.strip()) if p]
    chunks: list[np.ndarray] = []
    sr = 24000
    for p in parts:
        w = kokoro.speak(p, voice=NARR_K["voice"], speed=NARR_K["speed"])
        if not w:
            return None
        x, sr = samples(w)
        chunks.append(x)
        rest = NARR_K["stop"] if p.rstrip()[-1:] in ".!?" else NARR_K["comma"]
        chunks.append(np.zeros(int(sr * rest), dtype=np.float32))
    return _wav(np.concatenate(chunks[:-1]), sr) if chunks else None


def clip(text: str, role: str) -> tuple[bytes | None, float, str]:
    """(wav, pitch lift, voice label) for one line in the chosen engine"""
    if ENGINE == "gemini":
        v, st = (G.NOVA_VOICE, G.NOVA_STYLE) if role == "nova" else (G.NARRATOR_VOICE, G.NARRATOR_STYLE)
        return G.speak(text, voice=v, style=st), 1.0, f"gemini:{v}"
    if role == "nova":
        return kokoro.speak(text), 1.0, f"kokoro:{NOVA_K['voice']}-v73"
    return kokoro.speak(text, speed=NARR_K["speed"]), 1.0, "kokoro:af_heart-v73"


def audition():
    out = PUB / "voicelab"
    out.mkdir(parents=True, exist_ok=True)
    only_k = "--kokoro-only" in sys.argv
    old = json.loads((out / "voicelab.json").read_text(encoding="utf-8")) if (out / "voicelab.json").exists() else {"rows": []}
    rows = []  # (Gemini rows from free-tier runs read the style prompt aloud: not kept)
    if not only_k:
        for v in NOVA_CANDIDATES:
            for i, line in enumerate(NOVA_LINES):
                wav = G.speak(line, voice=v, style=G.NOVA_STYLE)
                if wav:
                    f = f"nova-{v.lower()}-{i}.mp3"
                    to_mp3(wav, out / f)
                    rows.append({"group": "nova", "engine": "gemini", "voice": v, "file": f, "text": line, **metrics(wav, line)})
                time.sleep(1.5)
        for v in NARRATOR_CANDIDATES:
            wav = G.speak(STORY_LINE, voice=v, style=G.NARRATOR_STYLE)
            if wav:
                f = f"narrator-{v.lower()}.mp3"
                to_mp3(wav, out / f)
                rows.append({"group": "narrator", "engine": "gemini", "voice": v, "file": f, "text": STORY_LINE, **metrics(wav, STORY_LINE)})
            time.sleep(1.5)
    for group, voice, speed, lift, line, label in [
        ("nova", "am_puck", 1.0, 1.0, NOVA_LINES[0], "am_puck (old)"),
        ("nova", "am_puck", NOVA_K["speed"], NOVA_K["pitch"], NOVA_LINES[0], "am_puck, pitch x1.32 (chosen)"),
        ("nova", "am_puck", NOVA_K["speed"], NOVA_K["pitch"], NOVA_LINES[1], "am_puck, pitch x1.32 (chosen)"),
        ("nova", "am_puck", 1.06, 1.5, NOVA_LINES[0], "am_puck, pitch x1.5"),
        ("nova", "am_echo", 1.06, 1.32, NOVA_LINES[0], "am_echo, pitch x1.32"),
        ("nova", "af_sky", 1.05, 0.95, NOVA_LINES[0], "af_sky, pitch x0.95"),
        ("narrator", "af_heart", 0.95, 1.0, STORY_LINE, "af_heart (old pacing)"),
        ("narrator", "af_bella", 0.9, 1.0, STORY_LINE, "af_bella"),
    ]:
        wav = kokoro.speak(line, voice=voice, speed=speed)
        if wav:
            f = f"{group}-kokoro-{voice}-{len(rows)}.mp3"
            to_mp3(wav, out / f, lift)
            rows.append({"group": group, "engine": "kokoro", "voice": label, "file": f, "text": line, **metrics(wav, line, lift)})
    wav = kokoro_narrator(STORY_LINE)
    if wav:
        to_mp3(wav, out / "narrator-kokoro-bedtime.mp3")
        rows.append({"group": "narrator", "engine": "kokoro", "voice": "af_heart bedtime pacing (chosen)", "file": "narrator-kokoro-bedtime.mp3", "text": STORY_LINE, **metrics(wav, STORY_LINE)})
    (out / "voicelab.json").write_text(json.dumps({"novaStyle": G.NOVA_STYLE, "narratorStyle": G.NARRATOR_STYLE, "rows": rows}, indent=1), encoding="utf-8")
    for r in rows:
        print(r["group"], r["engine"], r["voice"], r["seconds"], r["wpm"], r["pitch_hz"], r["pitch_range_hz"])


def _render(jobs: list[tuple[str, str, str]], out: Path, head: dict):
    """jobs: (id, text, role)"""
    out.mkdir(parents=True, exist_ok=True)
    man = out / "durations.json"
    old = json.loads(man.read_text(encoding="utf-8")) if man.exists() else {}
    made_by = dict(old.get("madeBy", {}))
    lines = dict(old.get("lines", {}))
    want = "gemini:" if ENGINE == "gemini" else "kokoro:"
    for i, (lid, text, role) in enumerate(jobs):
        mp3 = out / f"{lid}.mp3"
        if mp3.exists() and made_by.get(lid, "").startswith(want) and not FORCE:
            continue
        wav, lift, voice = clip(text, role)
        if not wav:
            print(f"!! {lid}: no audio (kept the old clip)")
            continue
        lines[lid] = round(to_mp3(wav, mp3, lift), 3)
        made_by[lid] = voice
        print(f"{i + 1}/{len(jobs)} {lid:26s} {voice:24s} {lines[lid]:.2f} s")
    # written ONCE at the end: the game imports these files, and rewriting them per clip made the
    # Vite dev server hot-reload the page about once a second (a black flash)
    man.write_text(json.dumps({**old, **head, "madeBy": made_by, "lines": lines}, indent=1), encoding="utf-8")


def nova():
    data = json.loads((CONTENT / "nova-lines.json").read_text(encoding="utf-8"))["lines"]
    jobs = [(l["id"], l["text"], "nova") for l in data if l.get("text")]
    _render(jobs, PUB / "nova", {"voice": NOVA_K if ENGINE == "kokoro" else {"engine": "gemini", "voice": G.NOVA_VOICE}, "model": "Kokoro-82M v1.0 int8 (kokoro-onnx)" if ENGINE == "kokoro" else "Gemini TTS"})


def story(ch: str):
    f = {"1": "chapters/ch1-moon.json", "2": "chapters/ch2-mars.json"}[ch]
    beats = json.loads((CONTENT / f).read_text(encoding="utf-8"))["beats"]
    jobs = [(l["id"], l.get("voText") or l["text"], "nova" if l.get("speaker") == "nova" else "narrator") for b in beats for l in b["lines"] if l.get("vo")]
    _render(jobs, PUB / "vo" / f"ch{ch}", {"narrator": NARR_K, "nova": NOVA_K, "model": "Kokoro-82M v1.0 int8 (kokoro-onnx)" if ENGINE == "kokoro" else "Gemini TTS"})


if __name__ == "__main__":
    if "--audition" in sys.argv:
        audition()
    elif "--nova" in sys.argv:
        nova()
    elif "--story" in sys.argv:
        story(sys.argv[sys.argv.index("--story") + 1])
    else:
        print(__doc__)
