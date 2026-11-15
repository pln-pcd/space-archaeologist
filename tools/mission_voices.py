"""Prepare local narrator clips from sourced mission JSON; no external voice service."""
import json
import io
import wave
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "apps/web/src/content/missions"
for path in CONTENT.glob("*.json"):
    mission = json.loads(path.read_text(encoding="utf-8"))
    folder = ROOT / "apps/web/public/audio/vo/missions" / mission["meta"]["id"]
    folder.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for shot in mission["storyShots"]:
        for index, line in enumerate(shot["lines"]):
            key = f"{shot['id']}-{index}"
            request = urllib.request.Request("http://127.0.0.1:8000/api/nova/speak", data=json.dumps({"text": line["text"], "voice": "af_heart", "private": True}).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
            with wave.open(io.BytesIO(data)) as wav:
                duration = wav.getnframes() / wav.getframerate()
            (folder / f"{key}.wav").write_bytes(data)  # the manifest (imported by the game) is written once below
            manifest[key] = {"text": line["text"], "duration": round(duration, 3)}
            print(f"{mission['meta']['id']}/{key}: {duration:.2f}s", flush=True)
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
