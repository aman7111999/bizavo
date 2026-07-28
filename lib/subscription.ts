import { Industry, PlatformRole, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { type Permission } from "@/lib/permissions";
import { industryModules, type ModuleKey } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

export const controllableModules: { key: ModuleKey; label: string; description: string }[] = [
  { key: "projects", label: "Projects", description: "Projects, contracts, milestones and documents" },
  { key: "procurement", label: "Procurement", description: "Vendors, purchase orders and approvals" },
  { key: "inventory", label: "Inventory", description: "Items, stores, receipts and material issues" },
  { key: "subcontractors", label: "Subcontractors", description: "Work orders, billing and payables" },
  { key: "hr", label: "People & HR", description: "Employees, attendance, leave and payroll" },
  { key: "finance", label: "Finance", description: "Invoices, payables, payments and reports" },
  { key: "landing", label: "Public page", description: "Company page, showcase and website leads" }
];

const permissionModules: Partial<Record<Permission, ModuleKey>> = {
  "projects:view": "projects",
  "projects:manage": "projects",
  "procurement:view": "procurement",
  "procurement:request": "procurement",
  "procurement:approve": "procurement",
  "inventory:view": "inventory",
  "inventory:manage": "inventory",
  "subcontractors:view": "subcontractors",
  "subcontractors:manage": "subcontractors",
  "hr:view": "hr",
  "hr:manage": "hr",
  "finance:view": "finance",
  "finance:manage": "finance",
  "landing:manage": "landing"
};

function planModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(controllableModules.map((module) => module.key));
  return value.filter((key): key is ModuleKey => typeof key === "string" && allowed.has(key as ModuleKey));
}

export function moduleForPermission(permission?: Permission) {
  return permission ? permissionModules[permission] : undefined;
}

export async function getEnabledModules(organizationId: string, industry: Industry = "CONSTRUCTION") {
  const [subscription, overrides] = await Promise.all([
    prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: { select: { modules: true } } }
    }),
    prisma.organizationModuleOverride.findMany({
      where: { organizationId },
      select: { moduleKey: true, enabled: true }
    })
  ]);
  const enabled = new Set(subscription ? planModules(subscription.plan.modules) : industryModules[industry]);
  for (const override of overrides) {
    if (override.enabled) enabled.add(override.moduleKey as ModuleKey);
    else enabled.delete(override.moduleKey as ModuleKey);
  }
  return [...enabled];
}

export async function organizationCanUseModule(
  organizationId: string,
  module: ModuleKey,
  industry: Industry = "CONSTRUCTION"
) {
  const enabled = await getEnabledModules(organizationId, industry);
  return enabled.includes(module);
}

export async function getOrganizationUsage(organizationId: string) {
  const [users, projects, documents] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.project.count({ where: { organizationId } }),
    prisma.projectDocument.aggregate({
      where: { organizationId },
      _sum: { sizeBytes: true }
    })
  ]);
  return {
    users,
    projects,
    storageBytes: documents._sum.sizeBytes ?? 0
  };
}

export async function getOrganizationPlanLimits(organizationId: string) {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    select: {
      plan: {
        select: { maxUsers: true, maxProjects: true, maxStorageMb: true }
      }
    }
  });
  return subscription?.plan ?? null;
}

function bootstrapAdminEmails() {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function platformAccessForUser(userId: string, email?: string | null) {
  const access = await prisma.platformAdministrator.findUnique({
    where: { userId },
    select: { role: true, active: true }
  });
  if (access?.active) return access.role;
  if (email && bootstrapAdminEmails().has(email.toLowerCase())) return PlatformRole.SUPER_ADMIN;
  return null;
}

export async function requirePlatformAdmin(allowedRoles?: PlatformRole[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/control");
  const role = await platformAccessForUser(session.user.id, session.user.email);
  if (!role || (allowedRoles && !allowedRoles.includes(role))) redirect("/app?error=Platform access denied");
  return { session, role };
}

export async function writePlatformAudit(input: {
  actorUserId: string;
  organizationId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Prisma.InputJsonObject;
}) {
  await prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details
    }
  });
}
