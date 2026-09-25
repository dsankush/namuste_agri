"use client";

import { ChevronRight, Languages, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import { ASSISTANT, BUSINESS, SUPPORTED, type Mode } from "@/lib/config";
import Orb from "./Orb";
import { Chip, Dot } from "./ui";

export default function AssistantPanel({
  level,
  bands,
  speaking,
  connected,
  onTry,
  mode,
}: {
  level: number;
  bands: number[];
  speaking: boolean;
  connected: boolean;
  onTry: () => void;
  mode: Mode;
}) {
  return (
    <section className="flex h-full flex-col rounded-[26px] border border-line bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[21px] font-semibold text-ink">AI Assistant</h2>
        <Chip>
          <Dot live={connected} /> {connected ? "In session" : "Online"}
        </Chip>
      </div>

      <div className="mt-5 flex gap-4 rounded-2xl border border-line bg-card-soft p-4 sm:p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-g100 text-g700">
          <Sprout className="size-7" />
        </span>
        <div className="min-w-0">
          <div className="text-[21px] font-semibold leading-tight text-ink">{BUSINESS}</div>
          <div className="mt-1 text-[17px] text-ink-2">Virtual Sales &amp; Crop Advisor</div>
          <div className="mt-1.5 text-[15px] text-muted">Demo · live stock, prices &amp; advice</div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-line bg-card-soft px-4 py-4 sm:px-5">
        <Orb size={54} rings={false} level={level} active={connected} />
        <div className="min-w-0">
          <div className="text-[21px] font-semibold text-ink">{ASSISTANT}</div>
          <div className="text-[17px] text-ink-2">AI Agri Assistant</div>
        </div>
        <div className="ml-auto flex h-6 items-center gap-[5px]" aria-hidden>
          {(speaking ? bands : [0, 0, 0, 0, 0]).map((b, i) => (
            <span
              key={i}
              className={`w-[6px] rounded-full transition-all duration-100 ${speaking ? "bg-g500" : "bg-muted-2/60"}`}
              style={{ height: speaking ? `${Math.max(3, Math.min(24, b * 60))}px` : "2px" }}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2.5 text-[18px] font-semibold text-ink">
        <Languages className="size-5" /> Languages Supported
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {SUPPORTED.map((l) => (
          <span key={l} className="rounded-full border border-line bg-card-soft px-4 py-2 text-[17px] text-ink-2">
            {l}
          </span>
        ))}
      </div>

      <button
        onClick={onTry}
        disabled={connected}
        className="try-card mt-6 flex items-center gap-4 rounded-2xl border border-g400/40 px-5 py-5 text-left transition hover:brightness-[1.02] disabled:opacity-70"
      >
        <span className="grid size-12 place-items-center rounded-xl bg-g700 text-white dark:bg-g500 dark:text-[#10230a]">
          <Sparkles className="size-6" />
        </span>
        <span>
          <span className="block text-[20px] font-semibold text-ink">Try it now</span>
          <span className="block text-[16px] text-ink-2">
            {mode === "voice" ? "Start a real voice call" : "Start a live chat"}
          </span>
        </span>
        <ChevronRight className="ml-auto size-5 text-ink-2" />
      </button>

      <div className="flex-1" />

      <div className="mt-6 flex gap-3 rounded-2xl border border-g400/30 bg-g50 p-5 text-[16px] leading-relaxed text-ink-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-g700" />
        <p>
          Quotes from live stock and prices. Reads every order back before confirming, and never advises more than the
          label dose.
        </p>
      </div>
    </section>
  );
}
