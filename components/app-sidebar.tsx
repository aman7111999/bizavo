"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers3, Sparkles } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { appNavigation } from "@/lib/app-navigation";
import { can } from "@/lib/permissions";
import { type ModuleKey } from "@/lib/modules";
import { cn, enumLabel } from "@/lib/utils";

export function AppSidebar({
  role,
  organizationName,
  enabledModules
}: {
  role: OrgRole;
  organizationName: string;
  enabledModules: ModuleKey[];
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden h-screen w-[268px] shrink-0 flex-col border-r border-slate-200/80 bg-[#0f1930] text-white lg:flex">
      <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#5d83ff] to-[#67e8f9] text-[#0f1930] shadow-lg shadow-blue-950/30">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[17px] font-bold tracking-tight">Bizavo</p>
          <p className="text-[8px] font-semibold tracking-[0.2em] text-blue-200/80">ONE CONNECTED SYSTEM</p>
        </div>
      </div>
      <div className="mx-3 mt-4 rounded-xl border border-white/10 bg-white/[0.055] p-3.5">
        <p className="truncate text-sm font-semibold">{organizationName}</p>
        <p className="mt-1 text-[11px] text-slate-300">{enumLabel(role)} workspace</p>
      </div>
      <nav className="scrollbar-subtle mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-5">
        {appNavigation.map((section) => {
          const items = section.items.filter((item) => can(role, item.permission) && (!item.module || enabledModules.includes(item.module)));
          if (!items.length) return null;
          return <div key={section.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.label}</p>
            <div className="space-y-0.5">{items.map((item) => {
              const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-300 transition", active ? "bg-white text-[#111c35] shadow-sm" : "hover:bg-white/[0.07] hover:text-white")}><Icon className={cn("h-[17px] w-[17px]", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-200")} />{item.label}</Link>;
            })}</div>
          </div>;
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.055] p-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-400/15"><Sparkles className="h-4 w-4 text-blue-200" /></div>
          <div>
            <p className="text-xs font-semibold">Construction OS</p>
            <p className="text-[10px] text-slate-400">All systems connected</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
