import Link from "next/link";
import { Building2, CreditCard, LayoutDashboard, LogOut, Settings2, ShieldCheck } from "lucide-react";
import { signOut } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/subscription";
import { cn, enumLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  const { session, role } = await requirePlatformAdmin();
  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="sticky top-0 z-40 border-b bg-[#071a5c] text-white">
        <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300 text-[#071a5c]"><ShieldCheck className="h-5 w-5" /></div>
            <div><p className="font-bold">Bizavo Control</p><p className="text-[10px] font-semibold tracking-[0.18em] text-blue-200">PLATFORM OPERATIONS</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-blue-100 sm:inline">{session.user.email} · {enumLabel(role)}</span>
            <Link href="/app" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/20 bg-white/10 text-white hover:bg-white/20")}>Open workspace</Link>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <Button type="submit" size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1540px]">
        <aside className="hidden min-h-[calc(100vh-4rem)] w-60 shrink-0 border-r bg-white p-4 lg:block">
          <nav className="space-y-1">
            <Link href="/control" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><LayoutDashboard className="h-4 w-4 text-primary" />Overview</Link>
            <Link href="/control#organizations" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Building2 className="h-4 w-4 text-primary" />Organizations</Link>
            <Link href="/control/plans" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><CreditCard className="h-4 w-4 text-primary" />Plans</Link>
            <Link href="/control/admins" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Settings2 className="h-4 w-4 text-primary" />Platform access</Link>
          </nav>
          <div className="mt-6 rounded-xl bg-blue-50 p-4 text-xs text-blue-900">
            <p className="font-semibold">Separate control plane</p>
            <p className="mt-1 leading-5 text-blue-700">Subscription billing is isolated from each company&apos;s construction accounting.</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
