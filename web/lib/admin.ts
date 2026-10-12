import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Password check for the Settings panel. ADMIN_PASSWORD lives only in the server env.
const failures = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 10;

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Returns an error response, or null when the request carries the right password. */
export function checkAdmin(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Settings are locked: set ADMIN_PASSWORD in the server environment (Vercel)." },
      { status: 503 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_FAILURES) {
    return NextResponse.json({ error: "Too many wrong passwords. Try again in 10 minutes." }, { status: 429 });
  }
  const given = req.headers.get("x-admin-password") ?? "";
  if (!timingSafeEqual(digest(given), digest(expected))) {
    recent.push(now);
    failures.set(ip, recent);
    if (failures.size > 5000) failures.clear();
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  return null;
}
