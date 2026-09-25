"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function Chip({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "gray" }) {
  const cls =
    tone === "green"
      ? "bg-g100 text-g700"
      : "bg-card-soft text-muted border border-line";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] ${cls}`}>{children}</span>
  );
}

export function Dot({ live = false, className = "" }: { live?: boolean; className?: string }) {
  return <span className={`inline-block size-2 rounded-full bg-g500 ${live ? "dot-live" : ""} ${className}`} />;
}

export function IconBox({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-card-soft text-g700">
      {children}
    </span>
  );
}

/** A pill that looks like the reference's selector but uses a native select (works great on phones). */
export function SelectPill<T extends string>({
  icon,
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  icon: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <label
      className={`relative inline-flex h-[58px] items-center gap-3 rounded-2xl border border-line bg-card-soft px-5 text-[19px] font-medium text-ink transition hover:border-g400/60 ${
        disabled ? "opacity-60" : "cursor-pointer"
      }`}
    >
      <span className="text-muted">{icon}</span>
      <span className="whitespace-nowrap">{current}</span>
      <ChevronDown className="size-4 text-muted-2" />
      <select
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
