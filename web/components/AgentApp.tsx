"use client";

import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useMultibandTrackVolume,
  useSession,
  useSessionMessages,
  type UseSessionReturn,
} from "@livekit/components-react";
import { RoomEvent, TokenSource } from "livekit-client";
import { Globe, RotateCcw, Sprout, Store, Phone, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOMER_TYPES, LANGUAGES, type CustomerType, type Mode } from "@/lib/config";
import Header from "./Header";
import AssistantPanel from "./AssistantPanel";
import ConversationPanel from "./ConversationPanel";
import ActionsPanel, { type Snapshot, type ToolEvent } from "./ActionsPanel";
import { SelectPill } from "./ui";

const ACTIVITY_TOPIC = "agent.activity";

export default function AgentApp() {
  const [mode, setMode] = useState<Mode>("voice");
  const [language, setLanguage] = useState("auto");
  const cfg = useRef({ mode, language });
  cfg.current = { mode, language };

  // A fresh room for every conversation. The LiveKit hook also asks for a token when the
  // page loads and after each call; we reuse that unused token for the next start instead of
  // requesting a new one each time (keeps the token endpoint well under its rate limit).
  const tokenSource = useMemo(() => {
    let cached: { key: string; at: number; data: { serverUrl: string; participantToken: string } } | null = null;
    return TokenSource.literal(async () => {
      const { mode, language } = cfg.current;
      const key = `${mode}|${language}`;
      if (cached && cached.key === key && Date.now() - cached.at < 5 * 60_000) {
        const data = cached.data;
        cached = null; // each token (room) is used once
        return data;
      }
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, language: language === "auto" ? undefined : language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start the session");
      cached = { key, at: Date.now(), data };
      return data;
    });
  }, []);

  const session = useSession(tokenSource, { agentConnectTimeoutMilliseconds: 30_000 });

  return (
    <SessionProvider session={session}>
      <Shell
        session={session}
        mode={mode}
        setMode={setMode}
        language={language}
        setLanguage={setLanguage}
      />
      <RoomAudioRenderer />
    </SessionProvider>
  );
}

function Shell({
  session,
  mode,
  setMode,
  language,
  setLanguage,
}: {
  session: UseSessionReturn;
  mode: Mode;
  setMode: (m: Mode) => void;
  language: string;
  setLanguage: (l: string) => void;
}) {
  const agent = useAgent();
  const { messages, send } = useSessionMessages(session);
  const [customerType, setCustomerType] = useState<CustomerType>("farmer");
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [events, setEvents] = useState<ToolEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const pending = useRef<string[]>([]);

  const connected = session.isConnected;
  const agentReady = agent.state === "listening" || agent.state === "thinking" || agent.state === "speaking";
  const inConversation = connected || starting;

  // --- agent voice level for the orb and the mini visualiser
  const bands = useMultibandTrackVolume(agent.microphoneTrack, { bands: 5, loPass: 100, hiPass: 200 });
  const level = bands.length ? Math.min(1, (bands.reduce((a, b) => a + b, 0) / bands.length) * 2.2) : 0;

  // --- call timer
  useEffect(() => {
    if (!connected) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [connected]);

  // --- Live Actions feed from the agent
  useEffect(() => {
    const room = session.room;
    const onData = (payload: Uint8Array, _p: unknown, _k: unknown, topic?: string) => {
      if (topic !== ACTIVITY_TOPIC) return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "error") {
          setError(`The assistant's ${msg.component} is not responding right now. Please try again in a few minutes.`);
          return;
        }
        if (msg.snapshot) setSnapshot(msg.snapshot);
        if (msg.type === "tool") {
          setEvents((prev) =>
            [
              { id: `${msg.at}-${msg.tool}`, label: msg.label, detail: msg.detail, ok: msg.ok, at: msg.at * 1000 },
              ...prev,
            ].slice(0, 25),
          );
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [session.room]);

  // --- send typed messages that were queued before the agent was ready
  useEffect(() => {
    if (!agentReady || !pending.current.length) return;
    const queue = pending.current.splice(0);
    queue.forEach((t) => send(t).catch(() => setError("Message could not be sent.")));
  }, [agentReady, send]);

  useEffect(() => {
    if (agent.state === "failed") {
      setError("The assistant did not join. Please try again in a moment.");
      setStarting(false);
    }
  }, [agent.state]);

  const start = useCallback(
    async (withMode: Mode = mode) => {
      if (session.isConnected || starting) return;
      setError(null);
      setStarting(true);
      setSnapshot({});
      setEvents([]);
      try {
        await session.start({ tracks: { microphone: { enabled: withMode === "voice" } } });
        setMicOn(withMode === "voice");
        await session.room.localParticipant
          .setAttributes({ mode: withMode, ...(language !== "auto" ? { language } : {}) })
          .catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("session start failed", e);
        setError(
          /permission|NotAllowed/i.test(msg)
            ? "Microphone permission was blocked. Allow the microphone in your browser, or use Chat."
            : /too many/i.test(msg)
              ? msg
              : "Could not connect to the assistant. Check your internet and try again.",
        );
      } finally {
        setStarting(false);
      }
    },
    [mode, language, session, starting],
  );

  const end = useCallback(async () => {
    pending.current = [];
    await session.end().catch(() => {});
  }, [session]);

  const reset = useCallback(async () => {
    await end();
    setSnapshot({});
    setEvents([]);
    setError(null);
  }, [end]);

  const changeMode = useCallback(
    async (m: Mode) => {
      setMode(m);
      if (!session.isConnected) return;
      const lp = session.room.localParticipant;
      try {
        await lp.setAttributes({ mode: m });
        await lp.setMicrophoneEnabled(m === "voice");
        setMicOn(m === "voice");
      } catch {
        setError("Could not switch mode. Please try again.");
      }
    },
    [session, setMode],
  );

  const changeLanguage = useCallback(
    async (l: string) => {
      setLanguage(l);
      if (session.isConnected && l !== "auto") {
        await session.room.localParticipant.setAttributes({ language: l }).catch(() => {});
      }
    },
    [session, setLanguage],
  );

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    await session.room.localParticipant.setMicrophoneEnabled(next).catch(() => {});
    setMicOn(next);
  }, [micOn, session]);

  const sendText = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (agentReady) {
        await send(t).catch(() => setError("Message could not be sent."));
        return;
      }
      pending.current.push(t);
      if (!session.isConnected && !starting) await start(mode);
    },
    [agentReady, mode, send, session.isConnected, start, starting],
  );

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const status = connected
    ? { live: true, text: `${mode === "voice" ? "CALL" : "CHAT"} IN PROGRESS · ${mm}:${ss}` }
    : starting
      ? { live: true, text: "CONNECTING…" }
      : { live: false, text: "READY · ANY INDIAN LANGUAGE" };

  const langLabel = LANGUAGES.find((l) => l.code === language)?.label ?? "Auto Detect";

  return (
    <div className="app-scale min-h-dvh bg-page">
      <Header
        status={status}
        onMenuAction={(a) => (a === "reset" ? reset() : (changeMode(a), start(a)))}
      />

      <main className="mx-0 mt-4 rounded-t-[32px] bg-stage px-2 pb-6 pt-3 sm:mt-9 sm:rounded-t-[56px] sm:px-3">
        <div className="mx-auto mb-4 mt-3 h-[7px] w-[88px] rounded-full bg-muted-2/40" />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-[26px] border border-line bg-card px-4 py-4 sm:px-6 lg:rounded-[30px]">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="hidden text-[18px] text-muted sm:inline">Customer</span>
            <SelectPill<CustomerType>
              label="Customer type"
              icon={customerType === "farmer" ? <Sprout className="size-5" /> : <Store className="size-5" />}
              value={customerType}
              onChange={setCustomerType}
              options={CUSTOMER_TYPES.map((c) => ({ value: c.id, label: c.label }))}
            />
            <span className="hidden pl-2 text-[18px] text-muted sm:inline">Language</span>
            <SelectPill
              label="Language"
              icon={<Globe className="size-5" />}
              value={language}
              onChange={changeLanguage}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.code === "auto" ? l.label : `${l.label} · ${l.native}` }))}
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex h-[62px] items-center rounded-2xl border border-line bg-card-soft p-1.5">
              {(
                [
                  ["voice", "Voice", Phone],
                  ["chat", "Chat", MessageSquare],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  className={`flex h-full items-center gap-2.5 rounded-xl px-5 text-[19px] font-medium transition sm:px-7 ${
                    mode === m ? "bg-pill text-[#10230a] shadow-sm" : "text-muted hover:text-ink"
                  }`}
                  aria-pressed={mode === m}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="flex h-[62px] items-center gap-2.5 rounded-2xl border border-line bg-card-soft px-5 text-[19px] text-muted transition hover:text-ink"
            >
              <RotateCcw className="size-5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Three columns */}
        <div className="mt-6 grid gap-5 lg:h-[max(760px,calc(100dvh/var(--z)-300px))] lg:grid-cols-[0.66fr_1fr_0.74fr]">
          <div className="order-3 min-h-0 lg:order-1">
            <AssistantPanel
              level={level}
              bands={bands}
              speaking={agent.state === "speaking"}
              connected={connected}
              onTry={() => start(mode)}
              mode={mode}
            />
          </div>
          <div className="order-1 min-h-[640px] lg:order-2 lg:min-h-0">
            <ConversationPanel
              mode={mode}
              connected={connected}
              starting={starting}
              agentState={agent.state}
              level={level}
              messages={messages}
              localIdentity={session.room.localParticipant.identity}
              micOn={micOn}
              error={error}
              onStart={() => start(mode)}
              onEnd={end}
              onToggleMic={toggleMic}
              onSend={sendText}
            />
          </div>
          <div className="order-2 min-h-0 lg:order-3">
            <ActionsPanel
              snapshot={snapshot}
              events={events}
              connected={inConversation}
              languageFallback={langLabel}
              customerType={customerType}
              onSuggestion={sendText}
            />
          </div>
        </div>

        <div className="mx-auto mt-6 h-[7px] w-[148px] rounded-full bg-muted-2/40" />
      </main>
    </div>
  );
}
