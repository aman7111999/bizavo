import {
  Boxes,
  Building2,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  FileStack,
  Globe2,
  HardHat,
  LayoutDashboard,
  Settings2,
  ShoppingCart,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { type Permission } from "@/lib/permissions";
import { type ModuleKey } from "@/lib/modules";

export type AppNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
  module?: ModuleKey;
};

export const appNavigation: { label: string; items: AppNavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Home", description: "Priorities and business health", icon: LayoutDashboard, permission: "dashboard:view" }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/app/projects", label: "Projects", description: "Delivery, contracts and milestones", icon: Building2, permission: "projects:view", module: "projects" },
      { href: "/app/procurement", label: "Purchases", description: "Vendors, POs and approvals", icon: ShoppingCart, permission: "procurement:view", module: "procurement" },
      { href: "/app/inventory", label: "Inventory", description: "Items, stores and movements", icon: Boxes, permission: "inventory:view", module: "inventory" },
      { href: "/app/subcontractors", label: "Subcontractors", description: "Work orders and billing", icon: HardHat, permission: "subcontractors:view", module: "subcontractors" }
    ]
  },
  {
    label: "People & money",
    items: [
      { href: "/app/hr", label: "People", description: "Employees, leave and payroll", icon: UsersRound, permission: "hr:view", module: "hr" },
      { href: "/app/finance", label: "Finance", description: "Receivables, payables and books", icon: CircleDollarSign, permission: "finance:view", module: "finance" },
      { href: "/app/documents", label: "Documents", description: "Receipts, quotes and delivery", icon: FileStack, permission: "documents:view", module: "documents" }
    ]
  },
  {
    label: "Growth",
    items: [
      { href: "/app/leads", label: "Leads", description: "Website enquiries and follow-up", icon: ContactRound, permission: "landing:manage", module: "landing" },
      { href: "/app/settings/landing", label: "Website", description: "Public company page", icon: Globe2, permission: "landing:manage", module: "landing" }
    ]
  },
  {
    label: "Manage",
    items: [
      { href: "/app/settings/team", label: "Team & access", description: "Members, roles and projects", icon: Settings2, permission: "members:manage" },
      { href: "/app/settings/subscription", label: "Plan & billing", description: "Usage, plan and invoices", icon: CreditCard, permission: "subscription:view" }
    ]
  }
];
