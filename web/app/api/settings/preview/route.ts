import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { backupSpeaker, cleanSettings, isMale } from "@/lib/settings";
import { pickNaturalVoice } from "@/lib/voices";

// Plays a short sample in the chosen Sarvam voice, so you can hear a change before saving.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLES: Record<string, [female: string, male: string]> = {
  "hi-IN": [
    "हाँ जी, नमस्ते! मैं {a} बोल रही हूँ। अच्छा, Pegasus का 250 ग्राम वाला पैक स्टॉक में है। कितने कार्टन चाहिए?",
    "हाँ जी, नमस्ते! मैं {a} बोल रहा हूँ। अच्छा, Pegasus का 250 ग्राम वाला पैक स्टॉक में है। कितने कार्टन चाहिए?",
  ],
  "en-IN": [
    "Hello ji! This is {a}. Pegasus 250 gram is in stock. How many cartons do you need?",
    "Hello ji! This is {a}. Pegasus 250 gram is in stock. How many cartons do you need?",
  ],
  "mr-IN": [
    "हो, नमस्कार! मी {a} बोलतेय. Pegasus चा 250 ग्रॅमचा पॅक स्टॉकमध्ये आहे. किती कार्टन हवेत?",
    "हो, नमस्कार! मी {a} बोलतोय. Pegasus चा 250 ग्रॅमचा पॅक स्टॉकमध्ये आहे. किती कार्टन हवेत?",
  ],
  "pa-IN": [
    "ਹਾਂ ਜੀ, ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ {a} ਬੋਲ ਰਹੀ ਹਾਂ। Pegasus ਸਟਾਕ ਵਿੱਚ ਹੈ। ਕਿੰਨੇ ਕਾਰਟਨ ਚਾਹੀਦੇ ਹਨ?",
    "ਹਾਂ ਜੀ, ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ {a} ਬੋਲ ਰਿਹਾ ਹਾਂ। Pegasus ਸਟਾਕ ਵਿੱਚ ਹੈ। ਕਿੰਨੇ ਕਾਰਟਨ ਚਾਹੀਦੇ ਹਨ?",
  ],
  "gu-IN": ["હા જી, નમસ્તે! હું {a}. Pegasus સ્ટોકમાં છે. કેટલા કાર્ટન જોઈએ?", "હા જી, નમસ્તે! હું {a}. Pegasus સ્ટોકમાં છે. કેટલા કાર્ટન જોઈએ?"],
  "bn-IN": ["হ্যাঁ, নমস্কার! আমি {a}. Pegasus স্টকে আছে। কত কার্টন লাগবে?", "হ্যাঁ, নমস্কার! আমি {a}. Pegasus স্টকে আছে। কত কার্টন লাগবে?"],
  "od-IN": ["ହଁ, ନମସ୍କାର! ମୁଁ {a}. Pegasus ଷ୍ଟକରେ ଅଛି। କେତେ କାର୍ଟନ ଦରକାର?", "ହଁ, ନମସ୍କାର! ମୁଁ {a}. Pegasus ଷ୍ଟକରେ ଅଛି। କେତେ କାର୍ଟନ ଦରକାର?"],
  "ta-IN": ["வணக்கம்! நான் {a}. Pegasus ஸ்டாக்கில் இருக்கு. எத்தனை கார்டன் வேண்டும்?", "வணக்கம்! நான் {a}. Pegasus ஸ்டாக்கில் இருக்கு. எத்தனை கார்டன் வேண்டும்?"],
  "te-IN": ["నమస్కారం! నేను {a}. Pegasus స్టాక్‌లో ఉంది. ఎన్ని కార్టన్లు కావాలి?", "నమస్కారం! నేను {a}. Pegasus స్టాక్‌లో ఉంది. ఎన్ని కార్టన్లు కావాలి?"],
  "kn-IN": ["ನಮಸ್ಕಾರ! ನಾನು {a}. Pegasus ಸ್ಟಾಕ್ ಇದೆ. ಎಷ್ಟು ಕಾರ್ಟನ್ ಬೇಕು?", "ನಮಸ್ಕಾರ! ನಾನು {a}. Pegasus ಸ್ಟಾಕ್ ಇದೆ. ಎಷ್ಟು ಕಾರ್ಟನ್ ಬೇಕು?"],
  "ml-IN": ["നമസ്കാരം! ഞാൻ {a}. Pegasus സ്റ്റോക്കുണ്ട്. എത്ര കാർട്ടൺ വേണം?", "നമസ്കാരം! ഞാൻ {a}. Pegasus സ്റ്റോക്കുണ്ട്. എത്ര കാർട്ടൺ വേണം?"],
};

export async function POST(req: Request) {
  const denied = checkAdmin(req);
  if (denied) return denied;
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Server is missing SARVAM_API_KEY." }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { settings?: unknown };
  const s = cleanSettings(body.settings);
  const [female, male] = SAMPLES[s.default_language] ?? SAMPLES["hi-IN"];
  const text = (isMale(s) ? male : female).replace("{a}", s.assistant_name);

  // Same choice a real call makes: the natural voice for this language, else the classic one.
  const natural = s.voice_engine === "natural" ? pickNaturalVoice(s.default_language, s.voice_natural, isMale(s)) : null;
  const voice = natural
    ? { model: "bulbul:v4-flash", speaker: natural.id, pitch: s.voice_pitch }
    : { model: "bulbul:v3", speaker: backupSpeaker(s), temperature: s.voice_expressiveness };

  let res: Response;
  try {
    res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_language_code: s.default_language,
        ...voice,
        pace: s.voice_pace,
        speech_sample_rate: 24000,
      }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Sarvam. Try again in a moment." }, { status: 502 });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Sarvam could not make the sample (${res.status}). ${detail.slice(0, 160)}` },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { audios?: string[] };
  const audio = data.audios?.[0];
  if (!audio) return NextResponse.json({ error: "Sarvam returned no audio." }, { status: 502 });
  return NextResponse.json({
    audio: `data:audio/wav;base64,${audio}`,
    text,
    voice: natural ? `${natural.name} · ${natural.style}` : `${voice.speaker} (classic)`,
  });
}
