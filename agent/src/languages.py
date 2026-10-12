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


# ---------------------------------------------------------------------------
# Spoken lines that don't need the AI model (play instantly).
# Written for a female assistant voice; adjust if you switch to a male speaker.
# ---------------------------------------------------------------------------
GREETINGS: dict[str, str] = {
    "hi-IN": "नमस्ते! मैं {a}, {c} से बोल रही हूँ। अपना मोबाइल नंबर बताइए?",
    "en-IN": "Hello! I'm {a} from {c}. Could you tell me your mobile number?",
    "mr-IN": "नमस्कार! मी {a}, {c} मधून बोलतेय. तुमचा मोबाईल नंबर सांगाल का?",
    "gu-IN": "નમસ્તે! હું {a}, {c} માંથી બોલું છું. તમારો મોબાઇલ નંબર કહેશો?",
    "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ {a}, {c} ਤੋਂ ਬੋਲ ਰਹੀ ਹਾਂ। ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦੱਸੋ?",
    "bn-IN": "নমস্কার! আমি {a}, {c} থেকে বলছি। আপনার মোবাইল নম্বরটা বলবেন?",
    "od-IN": "ନମସ୍କାର! ମୁଁ {a}, {c} ରୁ କହୁଛି। ଆପଣଙ୍କ ମୋବାଇଲ ନମ୍ବର କହିବେ କି?",
    "ta-IN": "வணக்கம்! நான் {a}, {c}-லிருந்து பேசுகிறேன். உங்கள் மொபைல் நம்பரை சொல்ல முடியுமா?",
    "te-IN": "నమస్కారం! నేను {a}, {c} నుండి మాట్లాడుతున్నాను. మీ మొబైల్ నంబర్ చెప్తారా?",
    "kn-IN": "ನಮಸ್ಕಾರ! ನಾನು {a}, {c} ಇಂದ ಮಾತಾಡ್ತಿದ್ದೀನಿ. ನಿಮ್ಮ ಮೊಬೈಲ್ ನಂಬರ್ ಹೇಳ್ತೀರಾ?",
    "ml-IN": "നമസ്കാരം! ഞാൻ {a}, {c}-ൽ നിന്ന് സംസാരിക്കുന്നു. നിങ്ങളുടെ മൊബൈൽ നമ്പർ പറയാമോ?",
}

# Short lines spoken while a lookup takes more than a moment.
FILLERS: dict[str, list[str]] = {
    "hi-IN": ["एक सेकंड, देख रही हूँ।", "हाँ जी, बस एक मिनट।", "ठीक है, चेक करती हूँ।"],
    "en-IN": ["One second, let me check.", "Sure, just a moment."],
    "mr-IN": ["एक सेकंद, बघते हं.", "हो, जरा थांबा."],
    "gu-IN": ["એક સેકન્ડ, જોઉં છું.", "હા, એક મિનિટ."],
    "pa-IN": ["ਇੱਕ ਸਕਿੰਟ, ਵੇਖਦੀ ਹਾਂ।", "ਹਾਂ ਜੀ, ਬੱਸ ਇੱਕ ਮਿੰਟ।"],
    "bn-IN": ["এক সেকেন্ড, দেখছি।", "হ্যাঁ, একটু অপেক্ষা করুন।"],
    "od-IN": ["ଗୋଟିଏ ସେକେଣ୍ଡ, ଦେଖୁଛି।", "ହଁ, ଟିକେ ଅପେକ୍ଷା କରନ୍ତୁ।"],
    "ta-IN": ["ஒரு நொடி, பார்க்கிறேன்.", "சரி, கொஞ்சம் காத்திருங்கள்."],
    "te-IN": ["ఒక్క సెకను, చూస్తున్నాను.", "సరే, ఒక్క నిమిషం."],
    "kn-IN": ["ಒಂದು ಸೆಕೆಂಡ್, ನೋಡ್ತೀನಿ.", "ಸರಿ, ಸ್ವಲ್ಪ ಇರಿ."],
    "ml-IN": ["ഒരു സെക്കൻഡ്, നോക്കട്ടെ.", "ശരി, ഒരു നിമിഷം."],
}


# Male-voice wording for languages whose verbs change with gender.
GREETINGS_MALE: dict[str, str] = {
    "hi-IN": "नमस्ते! मैं {a}, {c} से बोल रहा हूँ। अपना मोबाइल नंबर बताइए?",
    "mr-IN": "नमस्कार! मी {a}, {c} मधून बोलतोय. तुमचा मोबाईल नंबर सांगाल का?",
    "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ {a}, {c} ਤੋਂ ਬੋਲ ਰਿਹਾ ਹਾਂ। ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦੱਸੋ?",
}
FILLERS_MALE: dict[str, list[str]] = {
    "hi-IN": ["एक सेकंड, देख रहा हूँ।", "हाँ जी, बस एक मिनट।", "ठीक है, चेक करता हूँ।"],
    "mr-IN": ["एक सेकंद, बघतो हं.", "हो, जरा थांबा."],
    "pa-IN": ["ਇੱਕ ਸਕਿੰਟ, ਵੇਖਦਾ ਹਾਂ।", "ਹਾਂ ਜੀ, ਬੱਸ ਇੱਕ ਮਿੰਟ।"],
}


def greeting(lang: str, assistant: str, company: str, male: bool = False) -> str:
    code = normalise(lang)
    table = {**GREETINGS, **GREETINGS_MALE} if male else GREETINGS
    return table.get(code, GREETINGS[DEFAULT_LANGUAGE]).format(a=assistant, c=company)


def filler(lang: str, male: bool = False) -> str:
    import random

    code = normalise(lang)
    table = {**FILLERS, **FILLERS_MALE} if male else FILLERS
    return random.choice(table.get(code, FILLERS[DEFAULT_LANGUAGE]))
