"use server";

import { SubscriptionRequestType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, optionalText, parseOrFail, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { writePlatformAudit } from "@/lib/subscription";

const billingProfileSchema = z.object({
  legalName: z.string().min(2, "Enter the legal company name.").max(160),
  billingEmail: z.string().email("Enter a valid billing email."),
  billingPhone: z.string().max(40).optional(),
  taxId: z.string().max(40).optional(),
  addressLine1: z.string().max(180).optional(),
  addressLine2: z.string().max(180).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().min(2).max(80)
});

export async function updateBillingProfile(formData: FormData) {
  const session = await requireSession("subscription:manage");
  const data = parseOrFail(
    billingProfileSchema,
    {
      legalName: text(formData, "legalName"),
      billingEmail: text(formData, "billingEmail").toLowerCase(),
      billingPhone: optionalText(formData, "billingPhone"),
      taxId: optionalText(formData, "taxId"),
      addressLine1: optionalText(formData, "addressLine1"),
      addressLine2: optionalText(formData, "addressLine2"),
      city: optionalText(formData, "city"),
      state: optionalText(formData, "state"),
      postalCode: optionalText(formData, "postalCode"),
      country: text(formData, "country") || "India"
    },
    "/app/settings/subscription"
  );
  await prisma.organizationBillingProfile.upsert({
    where: { organizationId: session.organizationId },
    update: data,
    create: { organizationId: session.organizationId, ...data }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId: session.organizationId,
    action: "billing_profile.updated",
    entityType: "OrganizationBillingProfile"
  });
  revalidatePath("/app/settings/subscription");
  ok("/app/settings/subscription", "Billing profile saved.");
}

export async function createSubscriptionRequest(formData: FormData) {
  const session = await requireSession("subscription:manage");
  const type = text(formData, "type") as SubscriptionRequestType;
  if (!Object.values(SubscriptionRequestType).includes(type)) {
    fail("/app/settings/subscription", "Choose a valid subscription request.");
  }
  const requestedPlanId = optionalText(formData, "requestedPlanId");
  if (type === "CHANGE_PLAN") {
    const plan = requestedPlanId
      ? await prisma.subscriptionPlan.findFirst({ where: { id: requestedPlanId, active: true } })
      : null;
    if (!plan) fail("/app/settings/subscription", "Choose an active plan.");
    const current = await prisma.organizationSubscription.findUnique({
      where: { organizationId: session.organizationId },
      select: { planId: true }
    });
    if (current?.planId === requestedPlanId) {
      fail("/app/settings/subscription", "That is already your current plan.");
    }
  }
  const pending = await prisma.subscriptionRequest.findFirst({
    where: {
      organizationId: session.organizationId,
      type,
      status: "PENDING"
    }
  });
  if (pending) fail("/app/settings/subscription", "A matching request is already pending.");
  const request = await prisma.subscriptionRequest.create({
    data: {
      organizationId: session.organizationId,
      requestedById: session.user.id,
      type,
      requestedPlanId: type === "CHANGE_PLAN" ? requestedPlanId : undefined,
      notes: optionalText(formData, "notes")
    }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId: session.organizationId,
    action: "subscription.requested",
    entityType: "SubscriptionRequest",
    entityId: request.id,
    details: { type, requestedPlanId }
  });
  revalidatePath("/app/settings/subscription");
  ok("/app/settings/subscription", "Your request was saved for Bizavo review.");
}
