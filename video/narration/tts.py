"""Narration for the demo video.

  python -I video/narration/tts.py audition      4+ voices x the same 3 lines -> video/auditions/
  python -I video/narration/tts.py render VOICE  every line in lines.json -> video/narration/out/
  python -I video/narration/tts.py kid VOICE     the child's question (labelled as TTS on screen)

Voices: Gemini TTS prebuilt voices (GEMINI_API_KEY from server/.env, never printed or stored
elsewhere) and, for comparison, the game's own Kokoro voice through the local Nova server.
Nobody on the team can listen during an automated run, so each audition is measured instead:
  - intelligibility: the game's own speech-to-text (Parakeet via /api/nova/hear) transcribes the
    clip and we compute the word error rate against the script,
  - pace: words per minute,
  - a listening judge: a Gemini model hears the clip and scores warmth, clarity, confidence,
    playful energy and naturalness from 1 to 10 (no text is shared beyond the script line).
Results go to video/auditions/results.json; docs/DECISIONS.md records the pick.
"""
from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

import httpx
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
LINES = json.loads((ROOT / "video/narration/lines.json").read_text(encoding="utf-8"))
AUD = ROOT / "video/auditions"
OUT = ROOT / "video/narration/out"
SERVER = "http://127.0.0.1:8000"
FF = os.environ.get("FFMPEG", "ffmpeg")
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-lite-tts")
JUDGE_MODEL = "gemini-3.5-flash"
PACE = 7.0  # seconds between TTS calls (stay under the per-minute quota)
STYLE = "Read this aloud in a warm, clear and confident voice, speaking to judges, with the playful energy of a kids' game trailer: "


def _env():
    for line in (ROOT / "server/.env").read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z_]+)\s*=\s*(.*)\s*$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip().strip('"')


def _client():
    _env()
    from google import genai

    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def wav_bytes(pcm: bytes, rate: int) -> bytes:
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return b.getvalue()


def gemini(text: str, voice: str, style: bool = True) -> bytes:
    from google.genai import types

    c = _client()
    for attempt in range(3):
        try:
            r = c.models.generate_content(
                model=TTS_MODEL,
                contents=(STYLE + text) if style else text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))),
                ),
            )
            part = r.candidates[0].content.parts[0].inline_data
            time.sleep(PACE)
            if "wav" in (part.mime_type or ""):
                return part.data
            m = re.search(r"rate=(\d+)", part.mime_type or "")
            return wav_bytes(part.data, int(m.group(1)) if m else 24000)
        except Exception as e:  # rate limits: back off and retry
            m = re.search(r"retry in ([\d.]+)s|'retryDelay': '(\d+)s'", str(e))
            wait = float(next(g for g in m.groups() if g)) + 2 if m else 15 * (attempt + 1)
            print(f"  {voice}: {str(e)[:90]} ... retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("TTS failed")


def kokoro(text: str, voice: str = "heart") -> bytes:
    for attempt in range(4):
        try:
            r = httpx.post(f"{SERVER}/api/nova/speak", json={"text": text, "voice": voice}, timeout=240)
            r.raise_for_status()
            return r.content
        except httpx.HTTPError as e:
            print("  kokoro retry", attempt, str(e)[:80], file=sys.stderr)
            time.sleep(5)
    raise RuntimeError("kokoro failed")


def to_float16k(wav: bytes) -> np.ndarray:
    p = subprocess.run([FF, "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"], input=wav, capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32)


def hear(wav: bytes) -> str:
    pcm = to_float16k(wav)[: 16000 * 19]
    r = httpx.post(f"{SERVER}/api/nova/hear", content=pcm.tobytes(), timeout=240)
    r.raise_for_status()
    return r.json()["text"]


def _words(s: str) -> list[str]:
    return re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("'", "")).split()


def wer(ref: str, hyp: str) -> float:
    a, b = _words(ref), _words(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(b)] / max(1, len(a))


def duration(wav: bytes) -> float:
    with wave.open(io.BytesIO(wav)) as w:
        return w.getnframes() / w.getframerate()


def judge(wav: bytes, text: str) -> dict:
    from google.genai import types

    c = _client()
    prompt = (
        "You are a strict casting director for a kids' game trailer narrated to competition judges. "
        "Listen to this voice reading the line: \"" + text + "\". Score 1 to 10 each: warmth, clarity, confidence, "
        "playful_energy, naturalness (10 = sounds like a real professional human narrator), and say in under 15 words "
        "anything wrong (mispronounced words, robotic artifacts, odd pauses, reading stage directions aloud). "
        'Reply as JSON only: {"warmth":n,"clarity":n,"confidence":n,"playful_energy":n,"naturalness":n,"issues":"..."}'
    )
    for attempt in range(4):
        try:
            r = c.models.generate_content(model=JUDGE_MODEL, contents=[types.Part.from_bytes(data=wav, mime_type="audio/wav"), prompt])
            m = re.search(r"\{.*\}", r.text, re.S)
            return json.loads(m.group(0))
        except Exception as e:
            print(f"  judge: {str(e)[:80]}", file=sys.stderr)
            time.sleep(6 * (attempt + 1))
    return {}


def save_m4a(wav: bytes, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-v", "error", "-y", "-i", "pipe:0", "-c:a", "aac", "-b:a", "128k", str(path)], input=wav, check=True)


def audition():
    """Kokoro voices line by line (local, unlimited) and Gemini voices with the three lines in ONE
    request each (the free tier allows 10 TTS requests per model per day)."""
    ids = ["n01", "n08", "n29"]
    lines = {l["id"]: l["say"] for l in LINES["lines"]}
    results = []

    def measure(kind, v, line, text, wav):
        heard = hear(wav)
        secs = duration(wav)
        row = {"engine": kind, "voice": v, "line": line, "seconds": round(secs, 2), "wpm": round(len(text.split()) / secs * 60), "heard": heard, "wer": round(wer(text, heard), 3), "judge": judge(wav, text)}
        print(json.dumps(row)[:300], flush=True)
        results.append(row)

    for v in ["am_michael", "af_bella", "am_puck", "bm_george", "bf_emma"]:
        for i in ids:
            wav = kokoro(lines[i], v)
            save_m4a(wav, AUD / f"kokoro-{v}-{i}.m4a")
            measure("kokoro", v, i, lines[i], wav)
    for v in ["Achird", "Sulafat"]:
        text = " ... ".join(lines[i] for i in ids)
        try:
            wav = gemini(text, v)
        except Exception as e:
            print("gemini", v, "unavailable:", str(e)[:120])
            continue
        save_m4a(wav, AUD / f"gemini-{v}-3lines.m4a")
        measure("gemini", v, "n01+n08+n29", text, wav)
    summary = {}
    for r in results:
        s_ = summary.setdefault(f"{r['engine']}:{r['voice']}", {"wer": [], "wpm": [], "score": []})
        s_["wer"].append(r["wer"])
        s_["wpm"].append(r["wpm"])
        j = r["judge"]
        if j:
            s_["score"].append(sum(j.get(k, 0) for k in ["warmth", "clarity", "confidence", "playful_energy", "naturalness"]) / 5)
    table = {k: {"mean_wer": round(float(np.mean(v["wer"])), 3), "mean_wpm": round(float(np.mean(v["wpm"]))), "mean_judge": round(float(np.mean(v["score"])), 2) if v["score"] else None} for k, v in summary.items()}
    (AUD / "results.json").write_text(json.dumps({"gemini_model": TTS_MODEL, "judge_model": JUDGE_MODEL, "style_prompt": STYLE, "summary": table, "clips": results}, indent=1), encoding="utf-8")
    print(json.dumps(table, indent=1))


def render(voice: str):
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for l in LINES["lines"]:
        p = OUT / f"{l['id']}.wav"
        if not p.exists():
            wav = kokoro(l["say"], voice) if re.match(r"^[a-z]{2}_[a-z]+$", voice) else gemini(l["say"], voice)
            p.write_bytes(wav)
        wav = p.read_bytes()
        heard = hear(wav)
        report[l["id"]] = {"seconds": round(duration(wav), 3), "wer": round(wer(l["say"], heard), 3), "heard": heard}
        print(l["id"], report[l["id"]]["seconds"], report[l["id"]]["wer"])
    (OUT / "report.json").write_text(json.dumps({"voice": voice, "model": TTS_MODEL, "lines": report}, indent=1), encoding="utf-8")


def kid(voice: str):
    """The spoken question for the voice demo. Space Apps rules forbid voices or likenesses of anyone
    under 18 in the demo, so this is a neutral ADULT text-to-speech voice, labelled on screen."""
    OUT.mkdir(parents=True, exist_ok=True)
    k = LINES["kid"]
    wav = kokoro(k["say"], voice if re.match(r"^[a-z]{2}_[a-z]+$", voice) else "af_bella")
    (OUT / "k01.wav").write_bytes(wav)
    # the fake microphone file: 1 s of silence, the question, 5 s of silence (16-bit mono 48 kHz)
    subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-t", "1", "-i", "anullsrc=r=48000:cl=mono", "-i", str(OUT / "k01.wav"), "-f", "lavfi", "-t", "5", "-i", "anullsrc=r=48000:cl=mono",
                    "-filter_complex", "[1:a]aresample=48000,aformat=channel_layouts=mono[q];[0:a][q][2:a]concat=n=3:v=0:a=1", "-map_metadata", "-1", "-flags", "+bitexact", "-fflags", "+bitexact", "-c:a", "pcm_s16le", str(OUT / "k01_mic.wav")], check=True)
    print("question", duration(wav), hear(wav))


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "audition":
        audition()
    elif cmd == "render":
        render(sys.argv[2])
    elif cmd == "kid":
        kid(sys.argv[2])
