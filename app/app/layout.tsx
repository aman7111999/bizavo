import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { MobileNav } from "@/components/mobile-nav";
import { requireSession } from "@/lib/session";
import { getEnabledModules, platformAccessForUser } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [enabledModules, platformRole] = await Promise.all([
    getEnabledModules(session.organizationId),
    platformAccessForUser(session.user.id, session.user.email)
  ]);
  return (
    <div className="flex min-h-screen bg-[#f7f9fc]">
      <AppSidebar role={session.role} organizationName={session.organizationName} enabledModules={enabledModules} />
      <div className="min-w-0 flex-1">
        <AppTopbar userName={session.user.name} organizationName={session.organizationName} platformAdmin={Boolean(platformRole)} />
        <main className="mx-auto max-w-[1540px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <MobileNav role={session.role} enabledModules={enabledModules} />
    </div>
  );
}
