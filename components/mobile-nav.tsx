"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Building2, CircleDollarSign, LayoutDashboard, ShoppingCart } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Home", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/app/projects", label: "Projects", icon: Building2, permission: "projects:view" },
  { href: "/app/procurement", label: "POs", icon: ShoppingCart, permission: "procurement:view" },
  { href: "/app/inventory", label: "Stock", icon: Boxes, permission: "inventory:view" },
  { href: "/app/finance", label: "Finance", icon: CircleDollarSign, permission: "finance:view" }
] satisfies { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[];

export function MobileNav({ role }: { role: OrgRole }) {
  const pathname = usePathname();
  const visibleItems = items.filter((item) => can(role, item.permission));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid border-t bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
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
    </nav>
  );
}
