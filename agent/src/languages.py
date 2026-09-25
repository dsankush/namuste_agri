"""Languages the agent can speak, and how to map a customer's language to Sarvam."""

# Sarvam TTS (bulbul) supports these. STT supports more, and auto-detects.
TTS_LANGUAGES: dict[str, str] = {
    "hi-IN": "Hindi",
    "en-IN": "English",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "pa-IN": "Punjabi",
    "bn-IN": "Bengali",
    "od-IN": "Odia",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
}

# Languages the listener understands but the voice cannot speak -> closest spoken fallback.
TTS_FALLBACK: dict[str, str] = {
    "as-IN": "bn-IN",  # Assamese -> Bengali
    "ur-IN": "hi-IN",
    "ne-IN": "hi-IN",
    "mai-IN": "hi-IN",
    "doi-IN": "hi-IN",
    "kok-IN": "mr-IN",
    "ks-IN": "hi-IN",
    "sd-IN": "hi-IN",
}

NAME_TO_CODE: dict[str, str] = {
    name.lower(): code for code, name in TTS_LANGUAGES.items()
}
NAME_TO_CODE.update(
    {"oriya": "od-IN", "bangla": "bn-IN", "hinglish": "hi-IN", "assamese": "bn-IN"}
)

DEFAULT_LANGUAGE = "hi-IN"


def normalise(lang: str | None) -> str:
    """Return a language code Sarvam TTS can speak."""
    if not lang:
        return DEFAULT_LANGUAGE
    s = lang.strip()
    if s.lower() in NAME_TO_CODE:
        return NAME_TO_CODE[s.lower()]
    # accept "hi", "hi-in", "hi-IN"
    base = s.split("-")[0].lower()
    code = f"{base}-IN"
    if code in TTS_LANGUAGES:
        return code
    return TTS_FALLBACK.get(code, DEFAULT_LANGUAGE)


def name(code: str) -> str:
    return TTS_LANGUAGES.get(normalise(code), "Hindi")
