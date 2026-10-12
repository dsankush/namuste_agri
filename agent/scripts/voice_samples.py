"""Make short sample clips in several Sarvam voices so you can pick the most natural one.

Run from the agent folder:
    uv run python scripts/voice_samples.py            # Hindi
    uv run python scripts/voice_samples.py mr-IN      # any language code

Clips are saved to voice_samples/. Then set the one you like in .env.local:
    SARVAM_TTS_SPEAKER=ritu
and update the secret on LiveKit Cloud:
    lk agent update-secrets --secrets "SARVAM_TTS_SPEAKER=ritu"
"""

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env.local")

SPEAKERS = [
    "priya",
    "ritu",
    "simran",
    "kavya",
    "neha",
    "roopa",
    "shubh",
    "aditya",
    "rahul",
]
TEXTS = {
    "hi-IN": "हाँ जी, नमस्ते! Pegasus का 250 ग्राम वाला पैक स्टॉक में है। एक कार्टन का रेट 29,328 रुपये है। कितने कार्टन चाहिए?",
    "en-IN": "Yes, hello! Pegasus 250 gram is in stock. One carton is 29,328 rupees. How many cartons do you need?",
    "mr-IN": "हो, नमस्कार! Pegasus चा 250 ग्रॅमचा पॅक स्टॉकमध्ये आहे. एका कार्टनचा दर 29,328 रुपये आहे. किती कार्टन हवेत?",
    "pa-IN": "ਹਾਂ ਜੀ, ਸਤ ਸ੍ਰੀ ਅਕਾਲ! Pegasus ਦਾ 250 ਗ੍ਰਾਮ ਪੈਕ ਸਟਾਕ ਵਿੱਚ ਹੈ। ਕਿੰਨੇ ਕਾਰਟਨ ਚਾਹੀਦੇ ਹਨ?",
}


def main() -> None:
    lang = sys.argv[1] if len(sys.argv) > 1 else "hi-IN"
    text = TEXTS.get(lang, TEXTS["hi-IN"])
    key = os.environ.get("SARVAM_API_KEY")
    if not key:
        sys.exit("SARVAM_API_KEY is missing from .env.local")
    out = Path("voice_samples")
    out.mkdir(exist_ok=True)
    for speaker in SPEAKERS:
        body = {
            "text": text,
            "target_language_code": lang,
            "speaker": speaker,
            "model": "bulbul:v3",
            "pace": float(os.getenv("SARVAM_TTS_PACE", "1.1")),
            "temperature": float(os.getenv("SARVAM_TTS_TEMPERATURE", "0.75")),
            "speech_sample_rate": 24000,
        }
        req = urllib.request.Request(
            "https://api.sarvam.ai/text-to-speech",
            data=json.dumps(body).encode(),
            headers={"api-subscription-key": key, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                audio = base64.b64decode(json.load(r)["audios"][0])
        except Exception as e:  # keep going if one voice fails
            print(f"{speaker}: failed ({e})")
            continue
        path = out / f"{lang}_{speaker}.wav"
        path.write_bytes(audio)
        print(f"saved {path}")
    print(
        f"\nOpen the {out}/ folder and listen. Female: priya ritu simran kavya neha roopa. Male: shubh aditya rahul."
    )


if __name__ == "__main__":
    main()
