"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Layers3, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Products", href: "#products" },
  { label: "Platform", href: "#platform" },
  { label: "Construction", href: "#construction" },
  { label: "Why Bizavo", href: "#why-bizavo" }
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Bizavo home">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#071a5c] text-white shadow-[0_8px_24px_rgba(7,26,92,0.18)]">
            <Layers3 className="h-[19px] w-[19px]" />
          </span>
          <span>
            <span className="block text-[19px] font-extrabold leading-none tracking-[-0.04em] text-[#071a5c]">Bizavo</span>
            <span className="mt-1 block text-[7px] font-bold uppercase tracking-[0.26em] text-slate-500">One connected system</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-600 transition hover:text-[#245dff]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 sm:flex">
          <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            Sign in
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#071a5c] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(7,26,92,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0d287d]">
            Start free <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 sm:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className={cn("border-t border-slate-200 bg-white px-5 py-4 sm:hidden", open ? "block" : "hidden")}>
        <nav className="grid gap-1" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
          <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700">Sign in</Link>
          <Link href="/register" className="rounded-xl bg-[#071a5c] px-4 py-3 text-center text-sm font-semibold text-white">Start free</Link>
        </div>
      </div>
    </header>
  );
}
