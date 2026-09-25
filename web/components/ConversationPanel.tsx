"use client";

import { ChevronDown, Loader2, Mic, MicOff, Phone, PhoneOff, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/config";
import Orb from "./Orb";

type Msg = {
  id: string;
  timestamp: number;
  type?: "userTranscript" | "agentTranscript" | "chatMessage";
  message: string;
  from?: { identity: string };
};

const STATE_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  "pre-connect-buffering": "Connecting…",
  initializing: "Joining…",
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  failed: "Could not connect",
  disconnected: "",
};

export default function ConversationPanel({
  mode,
  connected,
  starting,
  agentState,
  level,
  messages,
  localIdentity,
  micOn,
  error,
  onStart,
  onEnd,
  onToggleMic,
  onSend,
}: {
  mode: Mode;
  connected: boolean;
  starting: boolean;
  agentState: string;
  level: number;
  messages: Msg[];
  localIdentity: string;
  micOn: boolean;
  error: string | null;
  onStart: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const active = connected || starting;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-line bg-card">
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="flex items-center gap-2.5 text-[21px] font-semibold text-ink">
          <span className={`size-2.5 rounded-full bg-g500 ${active ? "dot-live" : "opacity-70"}`} /> Live Conversation
        </h2>
        {active && (
          <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-muted">
            {STATE_LABEL[agentState] ?? agentState}
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="stage-glow pointer-events-none absolute inset-x-6 top-2 bottom-2" />

        {!hasMessages ? (
          <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
            <Orb size={150} level={level} active={active} />
            <h3 className="mt-5 text-[30px] font-semibold tracking-tight text-ink sm:text-[32px]">
              {active ? (
                STATE_LABEL[agentState] || "Connecting…"
              ) : (
                <>
                  Ready when <span className="text-g700">you are.</span>
                </>
              )}
            </h3>
            <p className="mt-3 max-w-md text-[18px] text-ink-2 sm:text-[20px]">
              {active
                ? mode === "voice"
                  ? "Say hello. Speak in any Indian language."
                  : "Type your message below in any language."
                : mode === "voice"
                  ? "Tap “Start Voice Call” and speak in any Indian language."
                  : "Type a message below, or tap a suggestion to begin."}
            </p>
            <ChevronDown className="mt-8 size-5 text-ink-2" />
          </div>
        ) : (
          <>
            <div className="relative flex items-center gap-4 border-b border-line-soft px-6 py-3">
              <Orb size={44} rings={false} level={level} active />
              <span className="text-[16px] text-muted">{STATE_LABEL[agentState] || ""}</span>
            </div>
            <div ref={listRef} className="scroll-thin relative flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
              {messages.map((m) => {
                const mine = m.type === "userTranscript" || (m.type !== "agentTranscript" && m.from?.identity === localIdentity);
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[17px] leading-relaxed ${
                        mine
                          ? "rounded-br-md bg-g700 text-white dark:bg-g500 dark:text-[#10230a]"
                          : "rounded-bl-md border border-line bg-card-soft text-ink"
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-line-soft px-4 pb-5 pt-4 sm:px-6">
        {error && (
          <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-[15px] text-danger">{error}</p>
        )}

        {mode === "chat" ? (
          <div className="flex items-center gap-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Type in any language… e.g. My number is 9000000007"
              className="h-[64px] flex-1 rounded-2xl border border-line bg-card-soft px-5 text-[18px] text-ink outline-none placeholder:text-muted-2 focus:border-g400"
            />
            <button
              onClick={submit}
              aria-label="Send"
              className="btn-green grid h-[64px] w-[64px] place-items-center rounded-2xl text-white"
            >
              <SendHorizontal className="size-6" />
            </button>
            {active && (
              <button
                onClick={onEnd}
                className="h-[64px] rounded-2xl border border-line px-4 text-[16px] text-muted hover:text-ink"
              >
                End
              </button>
            )}
          </div>
        ) : active ? (
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMic}
              disabled={!connected}
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              className={`grid h-[74px] w-[74px] shrink-0 place-items-center rounded-2xl border transition ${
                micOn ? "border-line bg-card-soft text-ink" : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              {micOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}
            </button>
            <button
              onClick={onEnd}
              className="btn-end flex h-[74px] flex-1 items-center justify-center gap-3 rounded-2xl text-[21px] font-semibold text-white"
            >
              {starting ? <Loader2 className="size-6 animate-spin" /> : <PhoneOff className="size-6" />}
              {starting ? "Connecting…" : "End Call"}
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="btn-green flex h-[78px] w-full items-center justify-center gap-3 rounded-2xl text-[22px] font-semibold text-[#0f2208]"
          >
            <Phone className="size-6" /> Start Voice Call
          </button>
        )}

        <p className="mt-3 text-center text-[15px] leading-snug text-muted">
          {mode === "voice" ? "Uses your microphone. " : ""}Conversations are saved to improve service. Demo prices and
          stock: please don&apos;t share bank or payment details.
        </p>
      </div>
    </section>
  );
}
