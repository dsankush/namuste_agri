import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { cleanSettings } from "@/lib/settings";

// Reads and saves the agent's settings (Supabase table agent_settings, row "default").
// The Supabase service key stays on the server; the browser only sends the admin password.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    endpoint: `${url.replace(/\/$/, "")}/rest/v1/agent_settings`,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

const missing = () =>
  NextResponse.json(
    { error: "Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
    { status: 500 },
  );

function tableHint(status: number, text: string) {
  if (status === 404 || text.includes("agent_settings")) {
    return "The agent_settings table is missing. Run supabase/agent_settings.sql in the Supabase SQL Editor.";
  }
  return `Supabase error (${status}).`;
}

export async function GET(req: Request) {
  const denied = checkAdmin(req);
  if (denied) return denied;
  const sb = supabase();
  if (!sb) return missing();
  const res = await fetch(`${sb.endpoint}?id=eq.default&select=settings,updated_at`, {
    headers: sb.headers,
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: tableHint(res.status, await res.text()) }, { status: 502 });
  }
  const rows = (await res.json()) as { settings: unknown; updated_at: string }[];
  const saved = rows[0]?.settings ?? {};
  return NextResponse.json({
    settings: cleanSettings(saved),
    customised: Object.keys(saved as object).length > 0,
    updatedAt: rows[0]?.updated_at ?? null,
  });
}

export async function PUT(req: Request) {
  const denied = checkAdmin(req);
  if (denied) return denied;
  const sb = supabase();
  if (!sb) return missing();
  const body = (await req.json().catch(() => null)) as { settings?: unknown; reset?: boolean } | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  // reset -> empty row, so the agent falls back to its own defaults
  const settings = body.reset ? {} : cleanSettings(body.settings);
  const res = await fetch(`${sb.endpoint}?on_conflict=id`, {
    method: "POST",
    headers: { ...sb.headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: "default", settings }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: tableHint(res.status, await res.text()) }, { status: 502 });
  }
  const rows = (await res.json()) as { updated_at: string }[];
  return NextResponse.json({
    settings: cleanSettings(settings),
    customised: !body.reset,
    updatedAt: rows[0]?.updated_at ?? null,
  });
}
