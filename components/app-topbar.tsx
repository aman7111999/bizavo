import Link from "next/link";
import { LogOut, Search, ShieldCheck } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { enumLabel, initials } from "@/lib/utils";

export function AppTopbar({
  userName,
  organizationName,
  role,
  platformAdmin
}: {
  userName?: string | null;
  organizationName: string;
  role: OrgRole;
  platformAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 lg:hidden">{organizationName}</p>
        <p className="hidden text-sm font-semibold text-slate-900 lg:block">{organizationName}</p>
        <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{enumLabel(role)} · Construction workspace</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <form action="/app/search" method="get" className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" aria-label="Search Bizavo" placeholder="Search projects, people, vendors…" className="h-10 w-[300px] rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 xl:w-[360px]" />
        </form>
        <Link href="/app/search" className="inline-grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Search"><Search className="h-4 w-4" /></Link>
        {platformAdmin ? (
          <Link href="/control" className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 xl:inline-flex">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Bizavo control
          </Link>
        ) : null}
        <div className="ml-1 grid h-9 w-9 place-items-center rounded-xl bg-[#111c35] text-xs font-bold text-white">
          {initials(userName)}
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="icon" aria-label="Sign out" type="submit">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
