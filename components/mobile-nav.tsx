"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Building2, CircleDollarSign, LayoutDashboard, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Home", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: Building2 },
  { href: "/app/procurement", label: "POs", icon: ShoppingCart },
  { href: "/app/inventory", label: "Stock", icon: Boxes },
  { href: "/app/finance", label: "Finance", icon: CircleDollarSign }
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((item) => {
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
