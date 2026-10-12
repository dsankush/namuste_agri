"""Tunable settings, edited from the website's Settings panel.

Stored in Supabase (table ``agent_settings``, row ``default``) and read at the start of
every call, so changes apply to the next call without redeploying. Every value is
clamped to a safe range here, so a bad value can never break a call.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import asdict, dataclass

logger = logging.getLogger("agent.settings")

FEMALE_SPEAKERS = [
    "priya",
    "ritu",
    "simran",
    "kavya",
    "neha",
    "roopa",
    "pooja",
    "ishita",
    "shreya",
    "tanya",
    "shruti",
    "suhani",
    "kavitha",
    "rupali",
]
MALE_SPEAKERS = [
    "shubh",
    "aditya",
    "rahul",
    "amit",
    "rohan",
    "dev",
    "kabir",
    "varun",
    "manan",
    "sumit",
    "ratan",
    "aayan",
    "ashutosh",
    "advait",
]
SPEAKERS = FEMALE_SPEAKERS + MALE_SPEAKERS

AMBIENCE = ("off", "office", "crowded", "city", "forest")
STYLES = ("casual", "balanced", "formal")
LENGTHS = ("short", "normal")
LANGUAGES = (
    "hi-IN",
    "en-IN",
    "mr-IN",
    "gu-IN",
    "pa-IN",
    "bn-IN",
    "od-IN",
    "ta-IN",
    "te-IN",
    "kn-IN",
    "ml-IN",
)
MODEL_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{1,40}$")


@dataclass
class Settings:
    # Voice
    voice_speaker: str = os.getenv("SARVAM_TTS_SPEAKER", "priya")
    voice_pace: float = float(os.getenv("SARVAM_TTS_PACE", "1.1"))
    voice_expressiveness: float = float(os.getenv("SARVAM_TTS_TEMPERATURE", "0.75"))
    # Personality
    assistant_name: str = os.getenv("AGENT_ASSISTANT_NAME", "Priya")
    speaking_style: str = "casual"
    reply_length: str = "short"
    use_customer_name: bool = True
    default_language: str = "hi-IN"
    # Timing
    reply_delay: float = float(os.getenv("ENDPOINT_MIN_DELAY", "0.35"))
    max_wait: float = float(os.getenv("ENDPOINT_MAX_DELAY", "2.5"))
    number_wait: float = 1.2
    allow_interruptions: bool = True
    fillers_enabled: bool = True
    filler_delay: float = float(os.getenv("FILLER_DELAY_SECONDS", "0.8"))
    # Background sound
    ambience: str = "off"
    ambience_volume: float = 0.25
    thinking_sound: bool = False
    thinking_volume: float = 0.5
    # AI model
    llm_model: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    llm_temperature: float = 0.4

    @property
    def is_male(self) -> bool:
        return self.voice_speaker in MALE_SPEAKERS

    def to_dict(self) -> dict:
        return asdict(self)


def _num(v, lo: float, hi: float, default: float) -> float:
    try:
        return round(min(hi, max(lo, float(v))), 3)
    except (TypeError, ValueError):
        return default


def _pick(v, allowed, default):
    return v if v in allowed else default


def _bool(v, default: bool) -> bool:
    return v if isinstance(v, bool) else default


def clean(raw: dict | None) -> Settings:
    """Merge saved values over the defaults, clamping everything to safe ranges."""
    d = Settings()
    r = raw or {}
    name = (
        str(r.get("assistant_name") or d.assistant_name).strip()[:30]
        or d.assistant_name
    )
    model = str(r.get("llm_model") or d.llm_model).strip()
    return Settings(
        voice_speaker=_pick(
            str(r.get("voice_speaker", "")).lower(), SPEAKERS, d.voice_speaker
        ),
        voice_pace=_num(r.get("voice_pace"), 0.5, 2.0, d.voice_pace),
        voice_expressiveness=_num(
            r.get("voice_expressiveness"), 0.1, 1.2, d.voice_expressiveness
        ),
        assistant_name=name,
        speaking_style=_pick(r.get("speaking_style"), STYLES, d.speaking_style),
        reply_length=_pick(r.get("reply_length"), LENGTHS, d.reply_length),
        use_customer_name=_bool(r.get("use_customer_name"), d.use_customer_name),
        default_language=_pick(
            r.get("default_language"), LANGUAGES, d.default_language
        ),
        reply_delay=_num(r.get("reply_delay"), 0.2, 1.5, d.reply_delay),
        max_wait=_num(r.get("max_wait"), 1.0, 5.0, d.max_wait),
        number_wait=_num(r.get("number_wait"), 0.6, 3.0, d.number_wait),
        allow_interruptions=_bool(r.get("allow_interruptions"), d.allow_interruptions),
        fillers_enabled=_bool(r.get("fillers_enabled"), d.fillers_enabled),
        filler_delay=_num(r.get("filler_delay"), 0.3, 2.0, d.filler_delay),
        ambience=_pick(r.get("ambience"), AMBIENCE, d.ambience),
        ambience_volume=_num(r.get("ambience_volume"), 0.0, 1.0, d.ambience_volume),
        thinking_sound=_bool(r.get("thinking_sound"), d.thinking_sound),
        thinking_volume=_num(r.get("thinking_volume"), 0.0, 1.0, d.thinking_volume),
        llm_model=model if MODEL_RE.match(model) else d.llm_model,
        llm_temperature=_num(r.get("llm_temperature"), 0.0, 1.0, d.llm_temperature),
    )
