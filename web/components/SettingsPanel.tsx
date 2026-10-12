"use client";

import { Loader2, Lock, Play, RotateCcw, Save, SlidersHorizontal, Square, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  AMBIENCE,
  type AgentSettings,
  DEFAULTS,
  ENGINES,
  FEMALE_SPEAKERS,
  LENGTHS,
  MALE_SPEAKERS,
  MODELS,
  RANGES,
  SETTING_LANGUAGES,
  STYLES,
} from "@/lib/settings";
import { NATURAL_VOICES } from "@/lib/voices";

const PW_KEY = "kisan-admin-pw";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LANG_NAMES = Object.fromEntries(SETTING_LANGUAGES.map(([c, n]) => [c.split("-")[0], n]));
const voiceLabel = (v: (typeof NATURAL_VOICES)[number]) => `${v.name} · ${v.style}`;

type Status = { kind: "idle" | "ok" | "error"; text: string };

// ---------------------------------------------------------------------------
// Small controls
// ---------------------------------------------------------------------------
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line bg-card p-5">
      <h3 className="text-[19px] font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-1 text-[15px] leading-snug text-muted">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[16px] font-medium text-ink-2">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[14px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  range,
  onChange,
  format,
  left,
  right,
}: {
  label: string;
  hint?: string;
  value: number;
  range: readonly [number, number, number];
  onChange: (v: number) => void;
  format?: (v: number) => string;
  left?: string;
  right?: string;
}) {
  const [min, max, step] = range;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[16px] font-medium text-ink-2">{label}</span>
        <span className="font-mono text-[15px] text-g700">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="settings-range w-full"
        aria-label={label}
      />
      {(left || right) && (
        <div className="mt-1 flex justify-between text-[13px] text-muted-2">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
      {hint && <p className="mt-1.5 text-[14px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[16px] font-medium text-ink-2">{label}</span>
        {hint && <span className="mt-1 block text-[14px] leading-snug text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-7 w-12 rounded-full bg-line transition peer-checked:bg-g500 peer-focus-visible:ring-2 peer-focus-visible:ring-g400" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const selectCls =
  "h-[52px] w-full rounded-2xl border border-line bg-card-soft px-4 text-[17px] text-ink outline-none transition focus:border-g400";

function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <select aria-label={label} className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [s, setS] = useState<AgentSettings>(DEFAULTS);
  const [saved, setSaved] = useState<AgentSettings>(DEFAULTS);
  const [customised, setCustomised] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "load" | "save" | "reset" | "preview">("");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const set = <K extends keyof AgentSettings>(k: K, v: AgentSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const call = useCallback(
    async (path: string, init: RequestInit = {}, pw = password) => {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", "x-admin-password": pw },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
      return data;
    },
    [password],
  );

  const apply = (data: { settings: AgentSettings; customised: boolean; updatedAt: string | null }) => {
    setS(data.settings);
    setSaved(data.settings);
    setCustomised(data.customised);
    setUpdatedAt(data.updatedAt);
  };

  const unlock = useCallback(
    async (pw: string) => {
      setBusy("load");
      setStatus({ kind: "idle", text: "" });
      try {
        apply(await call("/api/settings", {}, pw));
        setUnlocked(true);
        try {
          sessionStorage.setItem(PW_KEY, pw);
        } catch {}
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 401) {
          try {
            sessionStorage.removeItem(PW_KEY);
          } catch {}
        }
        setStatus({ kind: "error", text: err.message });
      } finally {
        setBusy("");
      }
    },
    [call],
  );

  // Re-use the password for this browser tab, so you don't retype it every time.
  useEffect(() => {
    if (!open || unlocked) return;
    let pw = "";
    try {
      pw = sessionStorage.getItem(PW_KEY) || "";
    } catch {}
    if (pw) {
      setPassword(pw);
      void unlock(pw);
    }
  }, [open, unlocked, unlock]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) audioRef.current?.pause();
  }, [open]);

  const save = async () => {
    setBusy("save");
    try {
      apply(await call("/api/settings", { method: "PUT", body: JSON.stringify({ settings: s }) }));
      setStatus({ kind: "ok", text: "Saved. Start a new call or chat to hear the changes." });
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      apply(await call("/api/settings", { method: "PUT", body: JSON.stringify({ reset: true }) }));
      setStatus({ kind: "ok", text: "Back to the recommended defaults." });
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const preview = async () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    setBusy("preview");
    try {
      const { audio, voice } = await call("/api/settings/preview", {
        method: "POST",
        body: JSON.stringify({ settings: s }),
      });
      setHeard(voice || "");
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = audio;
      el.onended = () => setPlaying(false);
      await el.play();
      setPlaying(true);
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  // Natural voices for the default language (Hindi if that language has none).
  const defaultTag = s.default_language.split("-")[0];
  const naturalTag = NATURAL_VOICES.some((v) => v.lang === defaultTag) ? defaultTag : "hi";
  const naturalList = NATURAL_VOICES.filter((v) => v.lang === naturalTag);
  const chosenNatural = NATURAL_VOICES.find((v) => v.id === s.voice_natural);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Agent settings">
      <button aria-label="Close settings" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />

      {/* Own zoom so it matches the page scale; height cancels the zoom to fill the screen. */}
      <div className="app-scale relative flex h-[calc(100dvh/var(--z))] w-full max-w-[560px] flex-col bg-stage shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-card px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-g100 text-g700">
              <SlidersHorizontal className="size-5" />
            </span>
            <div>
              <h2 className="text-[22px] font-semibold leading-tight text-ink">Agent settings</h2>
              <p className="text-[14px] text-muted">
                {unlocked
                  ? customised
                    ? `Custom settings${updatedAt ? ` · saved ${new Date(updatedAt).toLocaleString()}` : ""}`
                    : "Using recommended defaults"
                  : "Tune the voice, personality and timing"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full border border-line bg-card-soft text-ink hover:border-g400"
          >
            <X className="size-5" />
          </button>
        </div>

        {!unlocked ? (
          <form
            className="m-6 rounded-[22px] border border-line bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) void unlock(password);
            }}
          >
            <div className="flex items-center gap-2 text-[18px] font-semibold text-ink">
              <Lock className="size-5 text-g700" /> Admin password
            </div>
            <p className="mt-1 text-[15px] text-muted">
              Only people with the password (ADMIN_PASSWORD on Vercel) can change how the agent behaves.
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${selectCls} mt-4`}
              placeholder="Password"
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={!password || busy === "load"}
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-g700 text-[17px] font-semibold text-white transition hover:bg-g900 disabled:opacity-50 dark:text-[#10230a]"
            >
              {busy === "load" && <Loader2 className="size-5 animate-spin" />} Unlock
            </button>
            {status.kind === "error" && <p className="mt-3 text-[15px] text-danger">{status.text}</p>}
          </form>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <Section title="Voice" hint="How the assistant sounds on calls.">
                <Field
                  label="Voice quality"
                  hint={
                    s.voice_engine === "natural"
                      ? "Natural voices are recorded for a job (customer care, conversation) and sound the most human."
                      : "Classic voices work in every language but sound flatter."
                  }
                >
                  <Select label="Voice quality" value={s.voice_engine} onChange={(v) => set("voice_engine", v)}>
                    {ENGINES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {s.voice_engine === "natural" && (
                  <Field
                    label={`Voice (${LANG_NAMES[naturalTag] ?? "Hindi"})`}
                    hint={
                      naturalTag === s.default_language.split("-")[0]
                        ? "When the customer switches language, the same person (or the closest voice of the same gender) is used automatically."
                        : `No natural ${LANG_NAMES[s.default_language.split("-")[0]]} voice yet, so that language uses the backup voice below. Showing Hindi voices.`
                    }
                  >
                    <Select label="Natural voice" value={s.voice_natural} onChange={(v) => set("voice_natural", v)}>
                      {!naturalList.some((v) => v.id === s.voice_natural) && chosenNatural && (
                        <option value={chosenNatural.id}>
                          {voiceLabel(chosenNatural)} ({LANG_NAMES[chosenNatural.lang] ?? chosenNatural.lang})
                        </option>
                      )}
                      {(["female", "male"] as const).map((g) => (
                        <optgroup key={g} label={g === "female" ? "Female" : "Male"}>
                          {naturalList
                            .filter((v) => v.gender === g)
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {voiceLabel(v)}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field
                  label={s.voice_engine === "natural" ? "Backup voice" : "Speaker"}
                  hint={
                    s.voice_engine === "natural"
                      ? "Used only for languages without a natural voice (for example Odia and Malayalam). Matched to the natural voice's gender."
                      : undefined
                  }
                >
                  <Select label="Speaker" value={s.voice_speaker} onChange={(v) => set("voice_speaker", v)}>
                    <optgroup label="Female">
                      {FEMALE_SPEAKERS.map((v) => (
                        <option key={v} value={v}>
                          {cap(v)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Male">
                      {MALE_SPEAKERS.map((v) => (
                        <option key={v} value={v}>
                          {cap(v)}
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                </Field>
                <Slider
                  label="Speed"
                  value={s.voice_pace}
                  range={RANGES.voice_pace}
                  onChange={(v) => set("voice_pace", v)}
                  format={(v) => `${v.toFixed(2)}×`}
                  left="Slower"
                  right="Faster"
                  hint="1.0 is normal. 1.05–1.2 sounds most natural for quick conversation."
                />
                {s.voice_engine === "natural" ? (
                  <Slider
                    label="Pitch"
                    value={s.voice_pitch}
                    range={RANGES.voice_pitch}
                    onChange={(v) => set("voice_pitch", v)}
                    format={(v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                    left="Deeper"
                    right="Higher"
                    hint="0 is the voice's natural pitch. Small changes (±0.1) sound best."
                  />
                ) : (
                  <Slider
                    label="Expressiveness"
                    value={s.voice_expressiveness}
                    range={RANGES.voice_expressiveness}
                    onChange={(v) => set("voice_expressiveness", v)}
                    left="Flat, steady"
                    right="Lively, varied"
                    hint="Higher sounds more human and emotional; too high can sound uneven."
                  />
                )}
                <button
                  onClick={preview}
                  disabled={busy === "preview"}
                  className="flex h-[50px] items-center gap-2 rounded-2xl border border-g400/60 bg-g50 px-5 text-[16px] font-semibold text-g700 transition hover:bg-g100 disabled:opacity-60"
                >
                  {busy === "preview" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : playing ? (
                    <Square className="size-4" />
                  ) : (
                    <Play className="size-5" />
                  )}
                  {playing ? "Stop" : "Preview this voice"}
                </button>
                {heard && <p className="-mt-2 text-[14px] text-muted">Last preview: {heard}</p>}
              </Section>

              <Section title="Personality" hint="Who the assistant is and how it talks.">
                <Field label="Assistant name" hint="The name it introduces itself with.">
                  <input
                    className={selectCls}
                    value={s.assistant_name}
                    maxLength={30}
                    onChange={(e) => set("assistant_name", e.target.value)}
                  />
                </Field>
                <Field label="Speaking style">
                  <Select label="Speaking style" value={s.speaking_style} onChange={(v) => set("speaking_style", v)}>
                    {STYLES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reply length">
                  <Select label="Reply length" value={s.reply_length} onChange={(v) => set("reply_length", v)}>
                    {LENGTHS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Default language"
                  hint="Used when the page is on Auto Detect. The assistant still switches if the customer speaks another language."
                >
                  <Select label="Default language" value={s.default_language} onChange={(v) => set("default_language", v)}>
                    {SETTING_LANGUAGES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Toggle
                  label="Use the customer's name"
                  hint="Now and then, like a person who knows them."
                  checked={s.use_customer_name}
                  onChange={(v) => set("use_customer_name", v)}
                />
              </Section>

              <Section title="Timing" hint="How quickly it replies and how it handles pauses.">
                <Slider
                  label="Reply delay"
                  value={s.reply_delay}
                  range={RANGES.reply_delay}
                  onChange={(v) => set("reply_delay", v)}
                  format={(v) => `${v.toFixed(2)} s`}
                  left="Snappy"
                  right="Patient"
                  hint="Silence before it answers. Lower feels quicker but may cut people off."
                />
                <Slider
                  label="Longest wait"
                  value={s.max_wait}
                  range={RANGES.max_wait}
                  onChange={(v) => set("max_wait", v)}
                  format={(v) => `${v.toFixed(1)} s`}
                  hint="The most it waits when the customer seems to be still thinking."
                />
                <Slider
                  label="Wait while saying a mobile number"
                  value={s.number_wait}
                  range={RANGES.number_wait}
                  onChange={(v) => set("number_wait", v)}
                  format={(v) => `${v.toFixed(1)} s`}
                  hint="People pause between digit groups; a longer wait avoids interrupting."
                />
                <Toggle
                  label="Let customers interrupt"
                  hint="The assistant stops talking when the customer speaks over it."
                  checked={s.allow_interruptions}
                  onChange={(v) => set("allow_interruptions", v)}
                />
                <Toggle
                  label='Say "one second, checking" during lookups'
                  checked={s.fillers_enabled}
                  onChange={(v) => set("fillers_enabled", v)}
                />
                {s.fillers_enabled && (
                  <Slider
                    label="Say it after"
                    value={s.filler_delay}
                    range={RANGES.filler_delay}
                    onChange={(v) => set("filler_delay", v)}
                    format={(v) => `${v.toFixed(1)} s`}
                    hint="Only spoken if the lookup takes longer than this."
                  />
                )}
              </Section>

              <Section title="Background sound" hint="Soft sounds make the call feel less like a machine.">
                <Field label="Room sound">
                  <Select label="Room sound" value={s.ambience} onChange={(v) => set("ambience", v)}>
                    {AMBIENCE.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {s.ambience !== "off" && (
                  <Slider
                    label="Room sound volume"
                    value={s.ambience_volume}
                    range={RANGES.ambience_volume}
                    onChange={(v) => set("ambience_volume", v)}
                    format={(v) => `${Math.round(v * 100)}%`}
                    hint="Keep it low (15–30%) so it never covers the voice."
                  />
                )}
                <Toggle
                  label="Typing sound while thinking"
                  hint="Soft keyboard sound while it looks things up."
                  checked={s.thinking_sound}
                  onChange={(v) => set("thinking_sound", v)}
                />
                {s.thinking_sound && (
                  <Slider
                    label="Typing volume"
                    value={s.thinking_volume}
                    range={RANGES.thinking_volume}
                    onChange={(v) => set("thinking_volume", v)}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                )}
              </Section>

              <Section title="AI model" hint="The brain behind the replies.">
                <Field label="Model">
                  <Select label="Model" value={s.llm_model} onChange={(v) => set("llm_model", v)}>
                    {!MODELS.some((m) => m.value === s.llm_model) && <option value={s.llm_model}>{s.llm_model}</option>}
                    {MODELS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Slider
                  label="Creativity"
                  value={s.llm_temperature}
                  range={RANGES.llm_temperature}
                  onChange={(v) => set("llm_temperature", v)}
                  left="Predictable"
                  right="Varied"
                  hint="0.3–0.5 keeps facts reliable while still sounding natural."
                />
              </Section>
            </div>

            {/* Footer */}
            <div className="border-t border-line bg-card px-5 py-4">
              {status.text && (
                <p className={`mb-3 text-[15px] ${status.kind === "error" ? "text-danger" : "text-g700"}`}>{status.text}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={reset}
                  disabled={!!busy}
                  className="flex h-[52px] items-center gap-2 rounded-2xl border border-line bg-card-soft px-4 text-[16px] text-muted transition hover:text-ink disabled:opacity-50"
                >
                  {busy === "reset" ? <Loader2 className="size-5 animate-spin" /> : <RotateCcw className="size-5" />}
                  Defaults
                </button>
                {dirty && (
                  <button onClick={() => setS(saved)} className="px-2 text-[15px] text-muted underline-offset-4 hover:underline">
                    Undo changes
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={!dirty || !!busy}
                  className="ml-auto flex h-[52px] items-center gap-2 rounded-2xl bg-g700 px-6 text-[17px] font-semibold text-white transition hover:bg-g900 disabled:opacity-50 dark:text-[#10230a]"
                >
                  {busy === "save" ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
                  Save
                </button>
              </div>
              <p className="mt-2 text-[13px] text-muted-2">Changes apply to the next call or chat. No redeploy needed.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
