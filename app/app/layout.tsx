import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { MobileNav } from "@/components/mobile-nav";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen bg-[#f7f9fc]">
      <AppSidebar role={session.role} organizationName={session.organizationName} />
      <div className="min-w-0 flex-1">
        <AppTopbar userName={session.user.name} organizationName={session.organizationName} />
        <main className="mx-auto max-w-[1540px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <MobileNav role={session.role} />
    </div>
  );
}
