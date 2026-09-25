"use client";

import {
  Activity,
  CheckCircle2,
  Globe,
  Lightbulb,
  Receipt,
  Sprout,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { DEMO_NUMBERS, SUGGESTIONS, type CustomerType } from "@/lib/config";
import { Chip, IconBox } from "./ui";

export type Snapshot = {
  status?: string;
  channel?: string;
  language?: string;
  customer?: string | null;
  role?: string | null;
  location?: string | null;
  crop?: string;
  product?: string;
  quote_total?: number;
  order_number?: string;
  reference?: string;
};

export type ToolEvent = { id: string; label: string; detail?: string | null; ok: boolean; at: number };

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const rupees = (n?: number) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "");

function Row({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-4">
      <IconBox>{icon}</IconBox>
      <div className="min-w-0">
        <div className="text-[14px] font-medium tracking-[0.06em] text-muted">{label}</div>
        <div className="truncate text-[20px] text-ink">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function ActionsPanel({
  snapshot,
  events,
  connected,
  languageFallback,
  customerType,
  onSuggestion,
}: {
  snapshot: Snapshot;
  events: ToolEvent[];
  connected: boolean;
  languageFallback: string;
  customerType: CustomerType;
  onSuggestion: (text: string) => void;
}) {
  const status = snapshot.status || (connected ? "Connecting…" : "Ready for a call");
  const customer = snapshot.customer
    ? `${snapshot.customer}${snapshot.role ? ` · ${cap(snapshot.role)}` : ""}`
    : null;
  const cropLine = [cap(snapshot.crop), snapshot.product].filter(Boolean).join(" · ");
  const orderLine = snapshot.order_number
    ? `${snapshot.order_number}${snapshot.quote_total ? ` · ${rupees(snapshot.quote_total)}` : ""}`
    : snapshot.quote_total
      ? `Quote ${rupees(snapshot.quote_total)}`
      : null;

  return (
    <section className="flex h-full flex-col rounded-[26px] border border-line bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[21px] font-semibold text-ink">
          <Activity className="size-5" /> Live Actions
        </h2>
        <Chip>{connected ? "Live" : "Ready"}</Chip>
      </div>

      <div className="mt-6 grid gap-5">
        <Row icon={<Activity className="size-5" />} label="STATUS" value={status} />
        <Row
          icon={<Globe className="size-5" />}
          label="LANGUAGE"
          value={snapshot.language || (languageFallback === "Auto Detect" ? "Auto Detect" : languageFallback)}
        />
        <Row
          icon={<UserRound className="size-5" />}
          label="CUSTOMER"
          value={customer ? `${customer}${snapshot.location ? ` · ${snapshot.location}` : ""}` : null}
        />
        <Row icon={<Sprout className="size-5" />} label="CROP / PRODUCT" value={cropLine || null} />
        <Row icon={<Receipt className="size-5" />} label="ORDER" value={orderLine} />
        <Row icon={<Tag className="size-5" />} label="REFERENCE" value={snapshot.reference} />
      </div>

      <div className="mt-7 flex items-center gap-2.5 text-[18px] font-semibold text-ink">
        <Tag className="size-5" /> Tool Activity
      </div>
      <div className="scroll-thin mt-3 min-h-[64px] flex-1 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="pt-3 text-[17px] text-muted">No activity yet. Start a call or chat.</p>
        ) : (
          <ul className="grid gap-2.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line-soft bg-card-soft px-3.5 py-2.5">
                {e.ok ? (
                  <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-g500" />
                ) : (
                  <XCircle className="mt-0.5 size-[18px] shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-medium text-ink">{e.label}</div>
                  {e.detail && <div className="truncate text-[14px] text-muted">{e.detail}</div>}
                </div>
                <time className="shrink-0 font-mono text-[12px] text-muted-2">
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-card-soft p-5">
        <div className="flex items-center gap-2.5 text-[18px] font-semibold text-ink">
          <Lightbulb className="size-5 text-muted" /> Need something to try?
        </div>
        <div className="mt-4 grid gap-2.5 sm:pl-8">
          {SUGGESTIONS[customerType].map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="rounded-xl border border-line bg-card px-4 py-2.5 text-left text-[16px] italic text-ink-2 transition hover:border-g400/70 hover:text-ink"
            >
              “{s}”
            </button>
          ))}
          <p className="pt-1 text-[14px] text-muted">
            Demo mobile for a {customerType}: <span className="font-mono">{DEMO_NUMBERS[customerType]}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
