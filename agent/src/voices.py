"""Picks the most natural Sarvam voice for each language.

"Natural" voices (bulbul:v4-flash) are persona voices recorded for a job, e.g.
``ritu_hi_customer_warm`` = Ritu, Hindi, customer care, warm. Each one speaks one
language, so when the customer switches language we pick the closest match:
the same person if she/he exists in that language, otherwise a voice of the same
gender with a conversational style. Languages without a natural voice (for
example Odia and Malayalam) use the classic bulbul:v3 voice instead.
"""

from __future__ import annotations

from dataclasses import dataclass

from livekit.plugins.sarvam.models import BULBUL_V4_FLASH_SPEAKERS

V4_MODEL = "bulbul:v4-flash"
V3_MODEL = "bulbul:v3"

V4_VOICES: frozenset[str] = frozenset(BULBUL_V4_FLASH_SPEAKERS)

FEMALE_NAMES = frozenset(
    [
        "aarti",
        "aditi",
        "amelia",
        "aparna",
        "chaitra",
        "chandrika",
        "chhavi",
        "ishita",
        "kangkana",
        "kavitha",
        "kavya",
        "mouchumi",
        "mrunal",
        "neha",
        "nupur",
        "payal",
        "pooja",
        "priya",
        "ritu",
        "roopa",
        "rupali",
        "sanchita",
        "sarika",
        "shabana",
        "shalini",
        "shilpa",
        "shreya",
        "shruti",
        "simran",
        "sophia",
        "suchitra",
        "suhani",
        "tanya",
        "vandana",
        "zarina",
    ]
)
MALE_NAMES = frozenset(
    [
        "aayan",
        "aditya",
        "advait",
        "amit",
        "anand",
        "aryaman",
        "ashok",
        "ashutosh",
        "ashwin",
        "bappa",
        "bhavik",
        "bimal",
        "chetan",
        "chirag",
        "dev",
        "deven",
        "girish",
        "gokul",
        "jaspal",
        "kabir",
        "kalpit",
        "kunal",
        "mahesh",
        "manan",
        "mohit",
        "mukul",
        "nachiket",
        "nilesh",
        "ojas",
        "rahul",
        "ratan",
        "rehan",
        "rohan",
        "rustom",
        "sarang",
        "shubh",
        "soham",
        "sumit",
        "sunny",
        "tarun",
        "vaibhav",
        "varun",
        "vetri",
        "vijay",
        "vipul",
    ]
)
# International-accent voices: never picked automatically for Indian customers.
INTERNATIONAL = frozenset({"amelia", "sophia"})
# Styles that suit a sales/advice call, best first. Others (news, kids, devotional,
# suspense, stories, ...) are never picked automatically.
STYLE_RANK = (
    "conversational",
    "conversation",
    "customer_warm",
    "customer",
    "customer_expressive",
    "companion",
    "assistant",
    "customer_utility",
    "sales",
    "market",
    "banking",
    "insurance",
    "narration",
)

DEFAULT_V4_VOICE = "ritu_hi_customer_warm"


def parts(voice: str) -> tuple[str, str, str]:
    """``ritu_hi_customer_warm`` -> ("ritu", "hi", "customer_warm")."""
    name, lang, *style = voice.split("_")
    return name, lang, "_".join(style)


def gender(voice: str) -> str | None:
    name = voice.split("_")[0]
    if name in FEMALE_NAMES:
        return "female"
    if name in MALE_NAMES:
        return "male"
    return None


def style_rank(voice: str) -> int | None:
    style = parts(voice)[2]
    return STYLE_RANK.index(style) if style in STYLE_RANK else None


@dataclass(frozen=True)
class VoiceChoice:
    model: str
    speaker: str


def pick(
    language: str, v4_voice: str, v3_speaker: str, male: bool, natural: bool
) -> VoiceChoice:
    """Best voice for ``language`` (e.g. "mr-IN") given the chosen settings."""
    if natural:
        tag = language.split("-")[0].lower()
        if v4_voice in V4_VOICES and parts(v4_voice)[1] == tag:
            return VoiceChoice(V4_MODEL, v4_voice)
        want = "male" if male else "female"
        name = parts(v4_voice)[0]
        options = [
            v
            for v in V4_VOICES
            if parts(v)[1] == tag
            and gender(v) == want
            and style_rank(v) is not None
            and parts(v)[0] not in INTERNATIONAL
        ]
        if options:
            # Same person first, then the most conversational style.
            best = min(options, key=lambda v: (parts(v)[0] != name, style_rank(v), v))
            return VoiceChoice(V4_MODEL, best)
    return VoiceChoice(V3_MODEL, v3_speaker)
