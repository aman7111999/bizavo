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
  if (!email.includes("@") || !Object.values(OrgRole).includes(role) || role === "OWNER") fail("/app/settings/team", "Enter a valid email and assignable role.");
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true }
  });
  if (existingUser?.memberships.some((membership) => membership.organizationId === session.organizationId)) {
    fail("/app/settings/team", "That person is already a member.");
  }
  if (existingUser?.memberships.length) {
    fail("/app/settings/team", "This account already belongs to another workspace. Cross-workspace switching is planned for Phase 2.");
  }
  const pending = await prisma.organizationInvite.findFirst({
    where: { organizationId: session.organizationId, email, acceptedAt: null }
  });
  if (pending) {
    await prisma.organizationInvite.update({
      where: { id: pending.id },
      data: {
        role,
        token: crypto.randomUUID(),
        expiresAt: addDays(new Date(), 7),
        invitedById: session.user.id
      }
    });
    revalidatePath("/app/settings/team");
    ok("/app/settings/team", "A fresh invite link replaced the previous one.");
  }
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

export async function revokeTeamInvite(formData: FormData) {
  const session = await requireSession("members:manage");
  const invite = await prisma.organizationInvite.findFirst({
    where: {
      id: text(formData, "inviteId"),
      organizationId: session.organizationId,
      acceptedAt: null
    },
    select: { id: true }
  });
  if (!invite) fail("/app/settings/team", "That invitation is no longer pending.");
  await prisma.organizationInvite.delete({ where: { id: invite.id } });
  revalidatePath("/app/settings/team");
  ok("/app/settings/team", "Invitation revoked.");
}

export async function updateMemberRole(formData: FormData) {
  const session = await requireSession("members:manage");
  const membershipId = text(formData, "membershipId");
  const role = text(formData, "role") as OrgRole;
  if (!Object.values(OrgRole).includes(role) || role === "OWNER") {
    fail("/app/settings/team", "Select a valid assignable role.");
  }
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: session.organizationId },
    select: { id: true, userId: true, role: true }
  });
  if (!membership || membership.role === "OWNER" || membership.userId === session.user.id) {
    fail("/app/settings/team", "The owner or your own role cannot be changed here.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: membership.id }, data: { role } });
    if (role !== "SITE_ENGINEER") {
      await tx.projectMember.deleteMany({ where: { membershipId: membership.id } });
    }
  });
  revalidatePath("/app/settings/team");
  ok("/app/settings/team", "Member role updated.");
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

export async function removeProjectAccess(formData: FormData) {
  const session = await requireSession("members:manage");
  const assignment = await prisma.projectMember.findFirst({
    where: {
      id: text(formData, "projectMemberId"),
      membership: { organizationId: session.organizationId, role: "SITE_ENGINEER" },
      project: { organizationId: session.organizationId }
    },
    select: { id: true }
  });
  if (!assignment) fail("/app/settings/team", "That project assignment no longer exists.");
  await prisma.projectMember.delete({ where: { id: assignment.id } });
  revalidatePath("/app/settings/team");
  ok("/app/settings/team", "Project access removed.");
}
