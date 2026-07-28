"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ContactRound,
  FileText,
  HardHat,
  LayoutDashboard,
  Layers3,
  Settings2,
  ShoppingCart,
  UsersRound
} from "lucide-react";
import { OrgRole } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions";
import { cn, enumLabel } from "@/lib/utils";

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/app/projects", label: "Projects", icon: Building2, permission: "projects:view" },
  { href: "/app/procurement", label: "Procurement", icon: ShoppingCart, permission: "procurement:view" },
  { href: "/app/inventory", label: "Inventory", icon: Boxes, permission: "inventory:view" },
  { href: "/app/subcontractors", label: "Subcontractors", icon: HardHat, permission: "subcontractors:view" },
  { href: "/app/hr", label: "People & HR", icon: UsersRound, permission: "hr:view" },
  { href: "/app/finance", label: "Finance", icon: CircleDollarSign, permission: "finance:view" },
  { href: "/app/leads", label: "Website leads", icon: ContactRound, permission: "landing:manage" },
  { href: "/app/settings/landing", label: "Public page", icon: FileText, permission: "landing:manage" },
  { href: "/app/settings/team", label: "Team & roles", icon: Settings2, permission: "members:manage" }
];

export function AppSidebar({
  role,
  organizationName
}: {
  role: OrgRole;
  organizationName: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden h-screen w-[252px] shrink-0 flex-col bg-[#071a5c] text-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-300 text-[#071a5c]">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold">Bizavo</p>
          <p className="text-[9px] font-semibold tracking-[0.22em] text-blue-200">ONE CONNECTED SYSTEM</p>
        </div>
      </div>
      <div className="mx-4 mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="truncate text-sm font-semibold">{organizationName}</p>
        <p className="mt-0.5 text-xs text-blue-200">{enumLabel(role)}</p>
      </div>
      <nav className="scrollbar-subtle mt-4 flex-1 space-y-1 overflow-y-auto px-3">
        {navItems
          .filter((item) => can(role, item.permission))
          .map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-100 transition",
                  active ? "bg-white text-[#071a5c]" : "hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/20">
            <BriefcaseBusiness className="h-4 w-4 text-cyan-200" />
          </div>
          <div>
            <p className="text-xs font-semibold">Construction pack</p>
            <p className="text-[11px] text-blue-200">Phase 1 · Active</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
