"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND, DEMO_URL } from "@/lib/config";

function Logo() {
  // Wordmark: swap for your own logo by placing /public/logo.svg and replacing this component.
  return (
    <span className="flex items-end gap-2 select-none">
      <svg viewBox="0 0 32 32" className="mb-1 size-8 sm:size-10" aria-hidden>
        <path d="M16 29c0-9 0-14 0-17" stroke="#467a2b" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M16 15C16 8 21 4 28 4c0 7-5 11-12 11Z" fill="#86c35a" />
        <path d="M16 19C16 13 11 9 4 9c0 6 5 10 12 10Z" fill="#c9722e" />
      </svg>
      <span className="text-[30px] font-medium leading-none tracking-tight text-ink sm:text-[44px]">
        {BRAND.toLowerCase()}
      </span>
      <sup className="mb-5 hidden text-[10px] text-ink sm:inline">™</sup>
    </span>
  );
}

export default function Header({
  status,
  onMenuAction,
}: {
  status: { live: boolean; text: string };
  onMenuAction: (a: "voice" | "chat" | "reset") => void;
}) {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <header className="relative z-20 flex h-[78px] items-center justify-between gap-4 border-b border-line-soft px-4 sm:h-[98px] sm:px-12">
      <Logo />

      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 font-mono text-[17px] tracking-[0.12em] text-ink-2 lg:flex">
        <span className={`size-2 rounded-full ${status.live ? "bg-g500 dot-live" : "bg-g400/70"}`} />
        {status.text}
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="grid size-11 place-items-center rounded-full border border-line bg-card-soft text-ink transition hover:border-g400 sm:size-[54px]"
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <a
          href={DEMO_URL}
          className="hidden h-[58px] items-center rounded-full bg-[#111] px-7 text-[20px] font-semibold text-white transition hover:bg-black sm:inline-flex dark:bg-white dark:text-black"
        >
          Book a demo
        </a>
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-3 px-1 text-[18px] font-semibold tracking-wide text-ink sm:text-[20px]"
            aria-expanded={open}
          >
            <span className="hidden sm:inline">MENU</span>
            {open ? <X className="size-7" /> : <Menu className="size-7" strokeWidth={1.6} />}
          </button>
          {open && (
            <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
              {(
                [
                  ["voice", "Start a voice call"],
                  ["chat", "Start a chat"],
                  ["reset", "Reset conversation"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => {
                    setOpen(false);
                    onMenuAction(k);
                  }}
                  className="block w-full px-5 py-3 text-left text-[16px] text-ink hover:bg-card-soft"
                >
                  {label}
                </button>
              ))}
              <a href={DEMO_URL} className="block px-5 py-3 text-[16px] text-ink hover:bg-card-soft sm:hidden">
                Book a demo
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
