"""Nova's voice, offline (new-flow prompt §7c). Kokoro-82M on this laptop (server/nova/tts.py).

  python -I scripts/nova_voices.py --cast    the same 5 test lines in 5 friendly young male voices at
                                             speed 1.0 and 1.1 → docs/audio/nova-voice-tests/ + a
                                             measured comparison (pitch range = liveliness, rate, level)
  python -I scripts/nova_voices.py           pre-render every SCRIPTED line (content/nova-lines.json;
                                             the {name} lead parts are never rendered: they are voiced
                                             live by the local server) → apps/web/public/audio/nova/
                                             <id>.mp3 + durations.json
The chosen voice is ONE config value: apps/web/src/content/nova-voice.json."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import numpy as np  # noqa: E402

from server.nova import tts  # noqa: E402
from server.nova.config import CONTENT  # noqa: E402

FF_DIR = Path.home() / "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin"
FF = str(FF_DIR / "ffmpeg.exe") if (FF_DIR / "ffmpeg.exe").exists() else shutil.which("ffmpeg")
FP = str(FF_DIR / "ffprobe.exe") if (FF_DIR / "ffprobe.exe").exists() else shutil.which("ffprobe")

CAST = ["am_puck", "am_michael", "am_liam", "am_eric", "am_echo"]
TEST_LINES = [
    "Hi! I'm Nova, your space guide on Starship Odyssey!",
    "Ooh, great question! The trip to Mars took about six and a half months.",
    "Let's start with the Moon. Ready? Click it!",
    "Martian blueberries are tiny round pebbles. They're really grey!",
    "That sounds really important. Please tell a grown-up you trust, right away.",
]


def to_mp3(wav: bytes, out: Path) -> float:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav)
        tmp = f.name
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-v", "error", "-y", "-i", tmp, "-af", "loudnorm=I=-17:TP=-2:LRA=7,apad=pad_dur=0.12", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "64k", str(out)], check=True)
    Path(tmp).unlink(missing_ok=True)
    return float(subprocess.run([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip())


def pitch_track(x: np.ndarray, sr: int) -> np.ndarray:
    """a simple autocorrelation pitch tracker (voiced frames only)"""
    hop, win = int(sr * 0.01), int(sr * 0.04)
    f0 = []
    for i in range(0, len(x) - win, hop):
        fr = x[i : i + win] * np.hanning(win)
        if np.sqrt(np.mean(fr**2)) < 0.02:
            continue
        ac = np.correlate(fr, fr, "full")[win - 1 :]
        lo, hi = int(sr / 400), int(sr / 75)
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.3 * ac[0]:
            f0.append(sr / lag)
    return np.array(f0)


def cast():
    import io
    import wave

    out = ROOT / "docs/audio/nova-voice-tests"
    rows = []
    for v in CAST:
        for speed in (1.0, 1.1):
            f0s, secs, words = [], 0.0, 0
            for i, line in enumerate(TEST_LINES):
                wav = tts.speak(line, voice=v, speed=speed)
                with wave.open(io.BytesIO(wav)) as w:
                    sr = w.getframerate()
                    x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32767
                f0s.append(pitch_track(x, sr))
                secs += to_mp3(wav, out / f"{v}-{speed:.1f}-{i + 1}.mp3")
                words += len(line.split())
            f0 = np.concatenate(f0s)
            semis = 12 * np.log2(f0 / np.median(f0))
            rows.append({"voice": v, "speed": speed, "median_pitch_hz": round(float(np.median(f0)), 1), "pitch_range_semitones": round(float(np.percentile(semis, 90) - np.percentile(semis, 10)), 2), "words_per_min": round(words / secs * 60, 1)})
            print(rows[-1])
    (out / "comparison.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")


def render():
    lines = json.loads((CONTENT / "nova-lines.json").read_text(encoding="utf-8"))["lines"]
    out = ROOT / "apps/web/public/audio/nova"
    durations = {}
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--only=")), None)
    for l in lines:
        if only and l["id"] not in only:
            continue
        text = l["text"].replace("⭐", "").strip()
        if not text:
            continue
        if "{" in text:
            raise SystemExit(f"{l['id']}: scripted body text must not contain placeholders")
        wav = tts.speak(text)
        durations[l["id"]] = round(to_mp3(wav, out / f"{l['id']}.mp3"), 3)
        print(f"{l['id']:24s} {durations[l['id']]:.2f} s")
    old = json.loads((out / "durations.json").read_text()) if (out / "durations.json").exists() and only else {"lines": {}}
    old["lines"].update(durations)
    (out / "durations.json").write_text(json.dumps({"voice": json.loads((CONTENT / "nova-voice.json").read_text()), "model": "Kokoro-82M v1.0 int8 (kokoro-onnx)", "lines": old["lines"]}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    cast() if "--cast" in sys.argv else render()
