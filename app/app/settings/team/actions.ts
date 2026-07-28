"use server";

import { addDays } from "date-fns";
import { OrgRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { fail, ok, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function createTeamInvite(formData: FormData) {
  const session = await requireSession("members:manage");
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role") as OrgRole;
  if (!email.includes("@") || !Object.values(OrgRole).includes(role)) fail("/app/settings/team", "Enter a valid email and role.");
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { organizationId: session.organizationId } } }
  });
  if (existingUser?.memberships.length) fail("/app/settings/team", "That person is already a member.");
  await prisma.organizationInvite.create({
    data: {
      organizationId: session.organizationId,
      email,
      role,
      token: crypto.randomUUID(),
      expiresAt: addDays(new Date(), 7),
      invitedById: session.user.id
    }
  });
  revalidatePath("/app/settings/team");
  ok("/app/settings/team", "Invite link created. Share it securely with the team member.");
}

export async function assignProjectAccess(formData: FormData) {
  const session = await requireSession("members:manage");
  const membershipId = text(formData, "membershipId");
  const projectId = text(formData, "projectId");
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: session.organizationId, role: "SITE_ENGINEER" }
  });
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: session.organizationId }
  });
  if (!membership || !project) fail("/app/settings/team", "Choose a site engineer and project.");
  await prisma.projectMember.upsert({
    where: { projectId_membershipId: { projectId, membershipId } },
    update: {},
    create: { projectId, membershipId }
  });
  revalidatePath("/app/settings/team");
  ok("/app/settings/team", "Project access assigned.");
}
