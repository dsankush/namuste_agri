import { randomUUID } from "node:crypto";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { NextResponse } from "next/server";

// Runs on the server only. LIVEKIT_API_SECRET never reaches the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGES = new Set([
  "hi-IN", "en-IN", "mr-IN", "gu-IN", "pa-IN", "bn-IN", "od-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN",
]);

// Light abuse protection: max 8 new sessions per IP per minute (per server instance).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  const agentName = process.env.AGENT_NAME || "kisan-sathi";
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "Server is missing LiveKit settings" }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: string; language?: string };
  const mode = body.mode === "chat" ? "chat" : "voice";
  const attributes: Record<string, string> = { mode };
  if (body.language && LANGUAGES.has(body.language)) attributes.language = body.language;

  const roomName = `kisan-${randomUUID().slice(0, 12)}`;
  const identity = `web-${randomUUID().slice(0, 12)}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: "Customer",
    ttl: "15m",
    attributes,
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true, // lets the page switch voice/chat mid-conversation
  });
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName })],
  });

  return NextResponse.json(
    { serverUrl: LIVEKIT_URL, participantToken: await at.toJwt() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
