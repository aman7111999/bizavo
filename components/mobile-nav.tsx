"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2X2, Search } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { appNavigation, type AppNavItem } from "@/lib/app-navigation";
import { can } from "@/lib/permissions";
import { type ModuleKey } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function MobileNav({ role, enabledModules }: { role: OrgRole; enabledModules: ModuleKey[] }) {
  const pathname = usePathname();
  const allItems = appNavigation.flatMap((section) => section.items).filter((item) => can(role, item.permission) && (!item.module || enabledModules.includes(item.module)));
  const preferredHref: Record<OrgRole, string> = {
    OWNER: "/app/projects", ADMIN: "/app/projects", PROJECT_MANAGER: "/app/projects", SITE_ENGINEER: "/app/projects",
    PROCUREMENT: "/app/procurement", HR: "/app/hr", ACCOUNTANT: "/app/finance", VIEWER: "/app/projects"
  };
  const home = allItems.find((item) => item.href === "/app");
  const primary = allItems.find((item) => item.href === preferredHref[role]);
  const secondary = allItems.find((item) => item.href === "/app/documents") ?? allItems.find((item) => item.href === "/app/inventory") ?? allItems.find((item) => item.href !== "/app" && item.href !== primary?.href);
  const visibleItems = [home, primary, secondary].filter((item, index, list): item is AppNavItem => Boolean(item) && list.findIndex((candidate) => candidate?.href === item?.href) === index);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      {visibleItems.map((item) => {
        const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 py-2 text-[10px] font-medium", active ? "text-primary" : "text-slate-500")}>
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
      <Link href="/app/search" className={cn("flex flex-col items-center gap-1 py-2 text-[10px] font-medium", pathname.startsWith("/app/search") ? "text-primary" : "text-slate-500")}><Search className="h-5 w-5" />Search</Link>
      <Link href="/app/menu" className={cn("flex flex-col items-center gap-1 py-2 text-[10px] font-medium", pathname.startsWith("/app/menu") ? "text-primary" : "text-slate-500")}><Grid2X2 className="h-5 w-5" />More</Link>
    </nav>
  );
}
