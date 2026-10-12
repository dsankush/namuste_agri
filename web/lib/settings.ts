import { DEFAULT_NATURAL_VOICE, NATURAL_VOICES } from "./voices";

// Agent settings edited from the Settings panel. Mirrors agent/src/settings.py:
// the same names, defaults and safe ranges (the agent clamps again on its side).

export const FEMALE_SPEAKERS = [
  "priya", "ritu", "simran", "kavya", "neha", "roopa", "pooja", "ishita", "shreya",
  "tanya", "shruti", "suhani", "kavitha", "rupali",
] as const;
export const MALE_SPEAKERS = [
  "shubh", "aditya", "rahul", "amit", "rohan", "dev", "kabir", "varun", "manan",
  "sumit", "ratan", "aayan", "ashutosh", "advait",
] as const;
export const SPEAKERS: readonly string[] = [...FEMALE_SPEAKERS, ...MALE_SPEAKERS];

export const ENGINES = [
  { value: "natural", label: "Natural · Bulbul v4 persona voices (recommended)" },
  { value: "classic", label: "Classic · Bulbul v3" },
] as const;

export const STYLES = [
  { value: "casual", label: "Casual · like a village shop" },
  { value: "balanced", label: "Balanced · friendly customer care" },
  { value: "formal", label: "Formal · polite and proper" },
] as const;
export const LENGTHS = [
  { value: "short", label: "Short · 1–2 sentences" },
  { value: "normal", label: "Normal · up to 4 sentences" },
] as const;
export const AMBIENCE = [
  { value: "off", label: "Off" },
  { value: "office", label: "Office" },
  { value: "crowded", label: "Busy shop / crowd" },
  { value: "city", label: "Street" },
  { value: "forest", label: "Outdoors / nature" },
] as const;
export const MODELS = [
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini · fast, recommended" },
  { value: "gpt-4.1", label: "gpt-4.1 · smarter, slower, costlier" },
  { value: "gpt-4o-mini", label: "gpt-4o-mini · fast" },
  { value: "gpt-4o", label: "gpt-4o" },
] as const;
export const SETTING_LANGUAGES = [
  ["hi-IN", "Hindi"], ["en-IN", "English"], ["mr-IN", "Marathi"], ["gu-IN", "Gujarati"],
  ["pa-IN", "Punjabi"], ["bn-IN", "Bengali"], ["od-IN", "Odia"], ["ta-IN", "Tamil"],
  ["te-IN", "Telugu"], ["kn-IN", "Kannada"], ["ml-IN", "Malayalam"],
] as const;

export type AgentSettings = {
  voice_engine: string;
  voice_natural: string;
  voice_pitch: number;
  voice_speaker: string;
  voice_pace: number;
  voice_expressiveness: number;
  assistant_name: string;
  speaking_style: string;
  reply_length: string;
  use_customer_name: boolean;
  default_language: string;
  reply_delay: number;
  max_wait: number;
  number_wait: number;
  allow_interruptions: boolean;
  fillers_enabled: boolean;
  filler_delay: number;
  ambience: string;
  ambience_volume: number;
  thinking_sound: boolean;
  thinking_volume: number;
  llm_model: string;
  llm_temperature: number;
};

export const DEFAULTS: AgentSettings = {
  voice_engine: "natural",
  voice_natural: DEFAULT_NATURAL_VOICE,
  voice_pitch: 0,
  voice_speaker: "priya",
  voice_pace: 1.1,
  voice_expressiveness: 0.75,
  assistant_name: "Priya",
  speaking_style: "casual",
  reply_length: "short",
  use_customer_name: true,
  default_language: "hi-IN",
  reply_delay: 0.35,
  max_wait: 2.5,
  number_wait: 1.2,
  allow_interruptions: true,
  fillers_enabled: true,
  filler_delay: 0.8,
  ambience: "off",
  ambience_volume: 0.25,
  thinking_sound: false,
  thinking_volume: 0.5,
  llm_model: "gpt-4.1-mini",
  llm_temperature: 0.4,
};

/** Slider ranges: [min, max, step]. Same limits as the agent. */
export const RANGES = {
  voice_pitch: [-0.5, 0.5, 0.05],
  voice_pace: [0.5, 2.0, 0.05],
  voice_expressiveness: [0.1, 1.2, 0.05],
  reply_delay: [0.2, 1.5, 0.05],
  max_wait: [1.0, 5.0, 0.1],
  number_wait: [0.6, 3.0, 0.1],
  filler_delay: [0.3, 2.0, 0.1],
  ambience_volume: [0, 1, 0.05],
  thinking_volume: [0, 1, 0.05],
  llm_temperature: [0, 1, 0.05],
} as const satisfies Partial<Record<keyof AgentSettings, readonly [number, number, number]>>;

const MODEL_RE = /^[a-z0-9][a-z0-9.\-]{1,40}$/;

function num(v: unknown, key: keyof typeof RANGES): number {
  const [lo, hi] = RANGES[key];
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULTS[key] as number;
  return Math.round(Math.min(hi, Math.max(lo, n)) * 1000) / 1000;
}
function pick<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return allowed.includes(v as T) ? (v as T) : d;
}
function bool(v: unknown, d: boolean) {
  return typeof v === "boolean" ? v : d;
}

/** Merge raw values over the defaults, clamping everything to safe ranges. */
export function cleanSettings(raw: unknown): AgentSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULTS;
  const name = String(r.assistant_name ?? "").trim().slice(0, 30) || d.assistant_name;
  const model = String(r.llm_model ?? "").trim();
  const natural = String(r.voice_natural ?? "").toLowerCase();
  return {
    voice_engine: pick(r.voice_engine, ENGINES.map((e) => e.value), d.voice_engine),
    voice_natural: NATURAL_VOICES.some((v) => v.id === natural) ? natural : d.voice_natural,
    voice_pitch: num(r.voice_pitch, "voice_pitch"),
    voice_speaker: pick(String(r.voice_speaker ?? "").toLowerCase(), SPEAKERS, d.voice_speaker),
    voice_pace: num(r.voice_pace, "voice_pace"),
    voice_expressiveness: num(r.voice_expressiveness, "voice_expressiveness"),
    assistant_name: name,
    speaking_style: pick(r.speaking_style, STYLES.map((s) => s.value), d.speaking_style),
    reply_length: pick(r.reply_length, LENGTHS.map((s) => s.value), d.reply_length),
    use_customer_name: bool(r.use_customer_name, d.use_customer_name),
    default_language: pick(r.default_language, SETTING_LANGUAGES.map(([c]) => c), d.default_language),
    reply_delay: num(r.reply_delay, "reply_delay"),
    max_wait: num(r.max_wait, "max_wait"),
    number_wait: num(r.number_wait, "number_wait"),
    allow_interruptions: bool(r.allow_interruptions, d.allow_interruptions),
    fillers_enabled: bool(r.fillers_enabled, d.fillers_enabled),
    filler_delay: num(r.filler_delay, "filler_delay"),
    ambience: pick(r.ambience, AMBIENCE.map((s) => s.value), d.ambience),
    ambience_volume: num(r.ambience_volume, "ambience_volume"),
    thinking_sound: bool(r.thinking_sound, d.thinking_sound),
    thinking_volume: num(r.thinking_volume, "thinking_volume"),
    llm_model: MODEL_RE.test(model) ? model : d.llm_model,
    llm_temperature: num(r.llm_temperature, "llm_temperature"),
  };
}

export const isClassicMale = (speaker: string) => (MALE_SPEAKERS as readonly string[]).includes(speaker);

/** Whether the assistant speaks as a man (decides wording like "रहा/रही"). */
export const isMale = (s: AgentSettings) =>
  s.voice_engine === "natural"
    ? NATURAL_VOICES.find((v) => v.id === s.voice_natural)?.gender === "male"
    : isClassicMale(s.voice_speaker);

/** Classic voice used when a language has no natural voice; matches the natural voice's gender. */
export const backupSpeaker = (s: AgentSettings) =>
  s.voice_engine === "natural" && isClassicMale(s.voice_speaker) !== isMale(s)
    ? isMale(s)
      ? "shubh"
      : "priya"
    : s.voice_speaker;
