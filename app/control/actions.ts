"use server";

import {
  BillingCycle,
  OrganizationStatus,
  PlatformRole,
  Prisma,
  SubscriptionRequestStatus,
  SubscriptionStatus
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dateValue, fail, numberValue, ok, optionalText, parseOrFail, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { controllableModules, requirePlatformAdmin, writePlatformAudit } from "@/lib/subscription";

const controlPath = (organizationId?: string) =>
  organizationId ? `/control/organizations/${organizationId}` : "/control";

function selectedModules(formData: FormData) {
  const allowed = new Set(controllableModules.map((module) => module.key));
  return formData
    .getAll("modules")
    .filter((value): value is string => typeof value === "string" && allowed.has(value as never));
}

const planSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9_-]+$/, "Use uppercase letters, numbers, dashes or underscores."),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  monthlyPrice: z.number().finite().nonnegative(),
  annualPrice: z.number().finite().nonnegative(),
  trialDays: z.number().int().min(0).max(365),
  maxUsers: z.number().int().positive().max(100000),
  maxProjects: z.number().int().positive().max(100000),
  maxStorageMb: z.number().int().positive().max(10_000_000)
});

function planData(formData: FormData) {
  return parseOrFail(
    planSchema,
    {
      code: text(formData, "code").toUpperCase(),
      name: text(formData, "name"),
      description: optionalText(formData, "description"),
      currency: text(formData, "currency") || "INR",
      monthlyPrice: numberValue(formData, "monthlyPrice"),
      annualPrice: numberValue(formData, "annualPrice"),
      trialDays: numberValue(formData, "trialDays"),
      maxUsers: numberValue(formData, "maxUsers"),
      maxProjects: numberValue(formData, "maxProjects"),
      maxStorageMb: numberValue(formData, "maxStorageMb")
    },
    "/control/plans"
  );
}

export async function createPlan(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const data = planData(formData);
  const modules = selectedModules(formData);
  if (!modules.length) fail("/control/plans", "Enable at least one module.");
  const duplicate = await prisma.subscriptionPlan.findUnique({ where: { code: data.code } });
  if (duplicate) fail("/control/plans", "That plan code already exists.");
  const plan = await prisma.subscriptionPlan.create({
    data: { ...data, modules, active: true }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    action: "plan.created",
    entityType: "SubscriptionPlan",
    entityId: plan.id,
    details: { code: plan.code, modules }
  });
  revalidatePath("/control/plans");
  ok("/control/plans", "Plan created.");
}

export async function updatePlan(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const planId = text(formData, "planId");
  const data = planData(formData);
  const modules = selectedModules(formData);
  if (!modules.length) fail("/control/plans", "Enable at least one module.");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) fail("/control/plans", "Plan not found.");
  const duplicateCode = await prisma.subscriptionPlan.findFirst({
    where: { code: data.code, id: { not: plan.id } },
    select: { id: true }
  });
  if (duplicateCode) fail("/control/plans", "That plan code already exists.");
  const isDefault = text(formData, "isDefault") === "on";
  const active = text(formData, "active") === "on";
  if (plan.isDefault && !isDefault) {
    const anotherDefault = await prisma.subscriptionPlan.findFirst({
      where: { id: { not: plan.id }, isDefault: true, active: true },
      select: { id: true }
    });
    if (!anotherDefault) fail("/control/plans", "Choose another active default plan before removing this default.");
  }
  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.subscriptionPlan.updateMany({ where: { id: { not: plan.id } }, data: { isDefault: false } });
    }
    await tx.subscriptionPlan.update({
      where: { id: plan.id },
      data: { ...data, modules, active, isDefault }
    });
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    action: "plan.updated",
    entityType: "SubscriptionPlan",
    entityId: plan.id,
    details: { code: data.code, active, isDefault, modules }
  });
  revalidatePath("/control/plans");
  revalidatePath("/control");
  ok("/control/plans", "Plan updated.");
}

export async function updateOrganizationSubscription(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN, PlatformRole.BILLING]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const planId = text(formData, "planId");
  const status = text(formData, "status") as SubscriptionStatus;
  const billingCycle = text(formData, "billingCycle") as BillingCycle;
  const periodStart = dateValue(formData, "currentPeriodStart");
  const periodEnd = dateValue(formData, "currentPeriodEnd");
  if (
    !Object.values(SubscriptionStatus).includes(status) ||
    !Object.values(BillingCycle).includes(billingCycle) ||
    !periodStart ||
    !periodEnd ||
    periodEnd <= periodStart
  ) {
    fail(path, "Check subscription status, cycle and period dates.");
  }
  const [organization, plan] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } })
  ]);
  if (!organization || !plan) fail(path, "Organization or active plan not found.");
  const subscription = await prisma.organizationSubscription.upsert({
    where: { organizationId },
    update: {
      planId,
      status,
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEndsAt: dateValue(formData, "trialEndsAt"),
      notes: optionalText(formData, "notes"),
      cancelAtPeriodEnd: text(formData, "cancelAtPeriodEnd") === "on"
    },
    create: {
      organizationId,
      planId,
      status,
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEndsAt: dateValue(formData, "trialEndsAt"),
      notes: optionalText(formData, "notes"),
      cancelAtPeriodEnd: text(formData, "cancelAtPeriodEnd") === "on"
    }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: "subscription.updated",
    entityType: "OrganizationSubscription",
    entityId: subscription.id,
    details: {
      planId,
      status,
      billingCycle,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    }
  });
  revalidatePath(path);
  revalidatePath("/control");
  revalidatePath("/app/settings/subscription");
  ok(path, "Subscription updated.");
}

export async function setOrganizationStatus(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const status = text(formData, "status") as OrganizationStatus;
  const reason = optionalText(formData, "reason");
  if (!Object.values(OrganizationStatus).includes(status)) fail(path, "Choose a valid organization status.");
  if (status !== "ACTIVE" && !reason) fail(path, "A suspension or archive reason is required.");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) fail(path, "Organization not found.");
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        status,
        suspendedAt: status === "SUSPENDED" ? new Date() : null,
        suspensionReason: status === "ACTIVE" ? null : reason
      }
    });
    const subscription = await tx.organizationSubscription.findUnique({ where: { organizationId } });
    if (subscription) {
      await tx.organizationSubscription.update({
        where: { organizationId },
        data: {
          status: status === "SUSPENDED"
            ? "SUSPENDED"
            : status === "ARCHIVED"
              ? "CANCELLED"
              : subscription.status === "SUSPENDED"
                ? "ACTIVE"
                : subscription.status
        }
      });
    }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: `organization.${status.toLowerCase()}`,
    entityType: "Organization",
    entityId: organizationId,
    details: { reason }
  });
  revalidatePath(path);
  revalidatePath("/control");
  ok(path, `Organization marked ${status.toLowerCase()}.`);
}

export async function setModuleOverride(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const moduleKey = text(formData, "moduleKey");
  const valid = controllableModules.some((module) => module.key === moduleKey);
  if (!valid) fail(path, "Choose a valid module.");
  const enabled = text(formData, "enabled") === "true";
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) fail(path, "Organization not found.");
  const override = await prisma.organizationModuleOverride.upsert({
    where: { organizationId_moduleKey: { organizationId, moduleKey } },
    update: { enabled, updatedById: session.user.id },
    create: { organizationId, moduleKey, enabled, updatedById: session.user.id }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: "module.override.updated",
    entityType: "OrganizationModuleOverride",
    entityId: override.id,
    details: { moduleKey, enabled }
  });
  revalidatePath(path);
  revalidatePath("/app");
  ok(path, `${moduleKey} ${enabled ? "enabled" : "disabled"} for this organization.`);
}

export async function clearModuleOverride(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const moduleKey = text(formData, "moduleKey");
  const override = await prisma.organizationModuleOverride.findUnique({
    where: { organizationId_moduleKey: { organizationId, moduleKey } }
  });
  if (!override) fail(path, "That module already follows the plan default.");
  await prisma.organizationModuleOverride.delete({ where: { id: override.id } });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: "module.override.cleared",
    entityType: "OrganizationModuleOverride",
    entityId: override.id,
    details: { moduleKey }
  });
  revalidatePath(path);
  revalidatePath("/app");
  ok(path, `${moduleKey} now follows the plan default.`);
}

export async function createSubscriptionInvoice(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN, PlatformRole.BILLING]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const issueDate = dateValue(formData, "issueDate");
  const dueDate = dateValue(formData, "dueDate");
  const subtotal = numberValue(formData, "subtotal");
  const taxAmount = numberValue(formData, "taxAmount");
  const invoiceNumber = text(formData, "invoiceNumber").toUpperCase();
  if (
    !invoiceNumber ||
    !issueDate ||
    !dueDate ||
    dueDate < issueDate ||
    !Number.isFinite(subtotal) ||
    !Number.isFinite(taxAmount) ||
    subtotal < 0 ||
    taxAmount < 0 ||
    subtotal + taxAmount <= 0
  ) {
    fail(path, "Check the invoice number, dates and amounts.");
  }
  const subscription = await prisma.organizationSubscription.findUnique({ where: { organizationId } });
  if (!subscription) fail(path, "Assign a subscription before invoicing.");
  const duplicate = await prisma.subscriptionInvoice.findUnique({ where: { invoiceNumber } });
  if (duplicate) fail(path, "That subscription invoice number already exists.");
  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      organizationId,
      subscriptionId: subscription.id,
      invoiceNumber,
      issueDate,
      dueDate,
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      status: "ISSUED",
      notes: optionalText(formData, "notes")
    }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: "subscription_invoice.issued",
    entityType: "SubscriptionInvoice",
    entityId: invoice.id,
    details: { invoiceNumber, totalAmount: subtotal + taxAmount }
  });
  revalidatePath(path);
  revalidatePath("/control");
  revalidatePath("/app/settings/subscription");
  ok(path, "Subscription invoice issued.");
}

export async function recordSubscriptionPayment(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN, PlatformRole.BILLING]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const invoiceId = text(formData, "invoiceId");
  const amount = numberValue(formData, "amount");
  const paymentDate = dateValue(formData, "paymentDate");
  const method = text(formData, "method");
  if (!Number.isFinite(amount) || amount <= 0 || !paymentDate || !method) {
    fail(path, "Enter a positive amount, payment date and method.");
  }
  const payment = await prisma.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId }
    });
    if (!invoice || invoice.status === "VOID") throw new Error("INVOICE_NOT_PAYABLE");
    const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (amount > remaining + 0.001) throw new Error("PAYMENT_EXCEEDS_BALANCE");
    const paidAmount = Number(invoice.paidAmount) + amount;
    const created = await tx.subscriptionPayment.create({
      data: {
        organizationId,
        invoiceId,
        paymentDate,
        amount,
        method,
        reference: optionalText(formData, "reference"),
        notes: optionalText(formData, "notes"),
        recordedById: session.user.id
      }
    });
    await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        status: paidAmount >= Number(invoice.totalAmount) - 0.001 ? "PAID" : "PARTIALLY_PAID"
      }
    });
    if (paidAmount >= Number(invoice.totalAmount) - 0.001) {
      const otherPastDue = await tx.subscriptionInvoice.count({
        where: {
          organizationId,
          id: { not: invoice.id },
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lt: new Date() }
        }
      });
      if (otherPastDue === 0) {
        await tx.organizationSubscription.updateMany({
          where: { organizationId, status: "PAST_DUE" },
          data: { status: "ACTIVE" }
        });
      }
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "PAYMENT_EXCEEDS_BALANCE") fail(path, "Payment exceeds the invoice balance.");
    if (error instanceof Error && error.message === "INVOICE_NOT_PAYABLE") fail(path, "That invoice cannot receive a payment.");
    throw error;
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: "subscription_payment.recorded",
    entityType: "SubscriptionPayment",
    entityId: payment.id,
    details: { invoiceId, amount, method }
  });
  revalidatePath(path);
  revalidatePath("/control");
  revalidatePath("/app/settings/subscription");
  ok(path, "Subscription payment recorded.");
}

export async function resolveSubscriptionRequest(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN, PlatformRole.BILLING]);
  const organizationId = text(formData, "organizationId");
  const path = controlPath(organizationId);
  const requestId = text(formData, "requestId");
  const status = text(formData, "status") as SubscriptionRequestStatus;
  if (!["COMPLETED", "REJECTED"].includes(status)) fail(path, "Complete or reject the request.");
  const request = await prisma.subscriptionRequest.findFirst({
    where: { id: requestId, organizationId, status: { in: ["PENDING", "APPROVED"] } }
  });
  if (!request) fail(path, "Pending request not found.");
  await prisma.$transaction(async (tx) => {
    if (status === "COMPLETED") {
      const subscription = await tx.organizationSubscription.findUnique({ where: { organizationId } });
      if (!subscription) throw new Error("SUBSCRIPTION_REQUIRED");
      if (request.type === "CHANGE_PLAN") {
        if (!request.requestedPlanId) throw new Error("PLAN_REQUIRED");
        await tx.organizationSubscription.update({
          where: { organizationId },
          data: { planId: request.requestedPlanId }
        });
      } else if (request.type === "CANCEL") {
        await tx.organizationSubscription.update({
          where: { organizationId },
          data: { cancelAtPeriodEnd: true }
        });
      } else {
        await tx.organizationSubscription.update({
          where: { organizationId },
          data: { status: "ACTIVE", cancelAtPeriodEnd: false, cancelledAt: null }
        });
        await tx.organization.update({
          where: { id: organizationId },
          data: { status: "ACTIVE", suspendedAt: null, suspensionReason: null }
        });
      }
    }
    await tx.subscriptionRequest.update({
      where: { id: request.id },
      data: {
        status,
        resolutionNote: optionalText(formData, "resolutionNote"),
        resolvedById: session.user.id,
        resolvedAt: new Date()
      }
    });
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "SUBSCRIPTION_REQUIRED") fail(path, "Assign a subscription before resolving this request.");
    if (error instanceof Error && error.message === "PLAN_REQUIRED") fail(path, "The requested plan no longer exists.");
    throw error;
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    organizationId,
    action: `subscription_request.${status.toLowerCase()}`,
    entityType: "SubscriptionRequest",
    entityId: request.id,
    details: { type: request.type, requestedPlanId: request.requestedPlanId }
  });
  revalidatePath(path);
  revalidatePath("/control");
  revalidatePath("/app/settings/subscription");
  ok(path, `Request ${status.toLowerCase()}.`);
}

export async function upsertPlatformAdministrator(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role") as PlatformRole;
  if (!email.includes("@") || !Object.values(PlatformRole).includes(role)) {
    fail("/control/admins", "Enter an existing user email and valid platform role.");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail("/control/admins", "That email does not have a Bizavo user account yet.");
  const admin = await prisma.platformAdministrator.upsert({
    where: { userId: user.id },
    update: { role, active: true },
    create: { userId: user.id, role, active: true }
  });
  await writePlatformAudit({
    actorUserId: session.user.id,
    action: "platform_admin.upserted",
    entityType: "PlatformAdministrator",
    entityId: admin.id,
    details: { userId: user.id, email, role }
  });
  revalidatePath("/control/admins");
  ok("/control/admins", "Platform administrator saved.");
}

export async function setPlatformAdministratorActive(formData: FormData) {
  const { session } = await requirePlatformAdmin([PlatformRole.SUPER_ADMIN]);
  const adminId = text(formData, "adminId");
  const active = text(formData, "active") === "true";
  const admin = await prisma.platformAdministrator.findUnique({
    where: { id: adminId },
    include: { user: { select: { id: true, email: true } } }
  });
  if (!admin) fail("/control/admins", "Platform administrator not found.");
  if (admin.user.id === session.user.id && !active) fail("/control/admins", "You cannot deactivate your own platform access.");
  await prisma.platformAdministrator.update({ where: { id: admin.id }, data: { active } });
  await writePlatformAudit({
    actorUserId: session.user.id,
    action: active ? "platform_admin.activated" : "platform_admin.deactivated",
    entityType: "PlatformAdministrator",
    entityId: admin.id,
    details: { email: admin.user.email }
  });
  revalidatePath("/control/admins");
  ok("/control/admins", `Platform administrator ${active ? "activated" : "deactivated"}.`);
}
