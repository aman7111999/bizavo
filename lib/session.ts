import { notFound, redirect } from "next/navigation";
import { OrgRole, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { can, type Permission, projectRestrictedRoles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { moduleForPermission, organizationCanUseModule } from "@/lib/subscription";

export async function requireSession(permission?: Permission) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");
  if (permission && !can(session.role, permission)) redirect("/app?error=Access denied");
  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { status: true, industry: true }
  });
  if (!organization || organization.status !== "ACTIVE") redirect("/suspended");
  const requiredModule = moduleForPermission(permission);
  if (requiredModule && !(await organizationCanUseModule(session.organizationId, requiredModule, organization.industry))) {
    redirect("/app?error=This module is not enabled for your subscription");
  }
  return session;
}

export async function requireRoles(roles: OrgRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/app?error=Access denied");
  return session;
}

export async function projectScope(
  permission: Permission = "projects:view"
): Promise<{ session: Awaited<ReturnType<typeof requireSession>>; where: Prisma.ProjectWhereInput }> {
  const session = await requireSession(permission);
  const where = projectWhereForSession(session);
  return { session, where };
}

export type AppSession = Awaited<ReturnType<typeof requireSession>>;

export function projectWhereForSession(session: AppSession): Prisma.ProjectWhereInput {
  return {
    organizationId: session.organizationId,
    ...(projectRestrictedRoles.includes(session.role)
      ? { members: { some: { membershipId: session.membershipId } } }
      : {})
  };
}

/**
 * Undefined means organization-wide access. An empty array means the member has
 * no assigned projects and must not see any project-bound records.
 */
export async function accessibleProjectIds(session: AppSession): Promise<string[] | undefined> {
  if (!projectRestrictedRoles.includes(session.role)) return undefined;
  const projects = await prisma.project.findMany({
    where: projectWhereForSession(session),
    select: { id: true }
  });
  return projects.map((project) => project.id);
}

export async function requireProject(projectId: string, permission: Permission = "projects:view") {
  const { session, where } = await projectScope(permission);
  const project = await prisma.project.findFirst({ where: { ...where, id: projectId } });
  if (!project) notFound();
  return { session, project };
}
