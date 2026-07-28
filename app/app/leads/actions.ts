"use server";

import { LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { fail, ok, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function updateLeadStatus(formData: FormData) {
  const session = await requireSession("landing:manage");
  const status = text(formData, "status") as LeadStatus;
  const lead = await prisma.lead.findFirst({
    where: { id: text(formData, "leadId"), organizationId: session.organizationId }
  });
  if (!lead || !Object.values(LeadStatus).includes(status)) fail("/app/leads", "Lead or status is invalid.");
  await prisma.lead.update({ where: { id: lead.id }, data: { status } });
  revalidatePath("/app/leads");
  ok("/app/leads", "Lead status updated.");
}
