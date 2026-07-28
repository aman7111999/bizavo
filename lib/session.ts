import { notFound, redirect } from "next/navigation";
import { OrgRole, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { can, type Permission, projectRestrictedRoles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function requireSession(permission?: Permission) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");
  if (permission && !can(session.role, permission)) redirect("/app?error=Access denied");
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
  const where: Prisma.ProjectWhereInput = { organizationId: session.organizationId };
  if (projectRestrictedRoles.includes(session.role)) {
    where.members = { some: { membershipId: session.membershipId } };
  }
  return { session, where };
}

export async function requireProject(projectId: string, permission: Permission = "projects:view") {
  const { session, where } = await projectScope(permission);
  const project = await prisma.project.findFirst({ where: { ...where, id: projectId } });
  if (!project) notFound();
  return { session, project };
}
