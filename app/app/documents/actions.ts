"use server";

import { BusinessDocumentType, CommunicationChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  appOrigin,
  createDocumentNumber,
  createShareToken,
  deliverDocument,
  hashShareToken,
  normalizeWhatsAppPhone
} from "@/lib/business-documents";
import { dateValue, fail, ok, optionalText, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const itemSchema = z.object({
  description: z.string().trim().min(1, "Every line needs a description.").max(160),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(24),
  unitPrice: z.number().nonnegative().max(1_000_000_000),
  taxPercent: z.number().min(0).max(100)
});

const itemsSchema = z.array(itemSchema).min(1, "Add at least one line item.").max(25, "A document can contain up to 25 line items.");

export async function createBusinessDocument(formData: FormData) {
  const session = await requireSession("documents:manage");
  const typeValue = text(formData, "type");
  if (!Object.values(BusinessDocumentType).includes(typeValue as BusinessDocumentType)) {
    fail("/app/documents?view=create", "Choose a valid document type.");
  }
  const recipientName = text(formData, "recipientName");
  if (!recipientName) fail("/app/documents?view=create", "Recipient name is required.");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text(formData, "itemsJson"));
  } catch {
    fail("/app/documents?view=create", "Line items could not be read. Refresh and try again.");
  }
  const parsed = itemsSchema.safeParse(parsedJson);
  if (!parsed.success) fail("/app/documents?view=create", parsed.error.issues[0]?.message ?? "Check the line items.");

  const projectId = optionalText(formData, "projectId");
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!project) fail("/app/documents?view=create", "Choose a valid project.");
  }

  const issueDate = dateValue(formData, "issueDate") ?? new Date();
  const items = parsed.data.map((item) => ({
    ...item,
    lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = items.reduce((sum, item) => sum + item.lineTotal * (item.taxPercent / 100), 0);
  const roundedTax = Math.round(taxAmount * 100) / 100;
  const totalAmount = Math.round((subtotal + roundedTax) * 100) / 100;

  const document = await prisma.businessDocument.create({
    data: {
      organizationId: session.organizationId,
      projectId,
      type: typeValue as BusinessDocumentType,
      status: "ISSUED",
      documentNumber: createDocumentNumber(typeValue as BusinessDocumentType, undefined, issueDate),
      recipientName,
      recipientEmail: optionalText(formData, "recipientEmail")?.toLowerCase(),
      recipientPhone: optionalText(formData, "recipientPhone"),
      billingAddress: optionalText(formData, "billingAddress"),
      issueDate,
      currency: session.currency,
      subtotal,
      taxAmount: roundedTax,
      totalAmount,
      paymentMethod: optionalText(formData, "paymentMethod"),
      paymentReference: optionalText(formData, "paymentReference"),
      notes: optionalText(formData, "notes"),
      createdById: session.user.id,
      items: {
        create: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          lineTotal: item.lineTotal
        }))
      }
    }
  });
  revalidatePath("/app/documents");
  ok(`/app/documents?view=all&created=${document.id}`, `${document.documentNumber} created and saved.`);
}

export async function shareBusinessDocument(formData: FormData) {
  const session = await requireSession("documents:manage");
  const documentId = text(formData, "documentId");
  const channelValue = text(formData, "channel");
  if (!Object.values(CommunicationChannel).includes(channelValue as CommunicationChannel)) {
    fail("/app/documents", "Choose email or WhatsApp.");
  }
  const channel = channelValue as CommunicationChannel;
  const document = await prisma.businessDocument.findFirst({
    where: { id: documentId, organizationId: session.organizationId, status: "ISSUED" },
    select: {
      id: true,
      documentNumber: true,
      type: true,
      recipientName: true,
      recipientEmail: true,
      recipientPhone: true
    }
  });
  if (!document) fail("/app/documents", "This document is unavailable or void.");
  const recipient = text(formData, "recipient") || (channel === "EMAIL" ? document.recipientEmail : document.recipientPhone) || "";
  if (channel === "EMAIL" && !z.string().email().safeParse(recipient).success) {
    fail("/app/documents", "Enter a valid recipient email address.");
  }
  if (channel === "WHATSAPP" && normalizeWhatsAppPhone(recipient).length < 11) {
    fail("/app/documents", "Enter a WhatsApp number with country code.");
  }

  const token = createShareToken();
  const shareUrl = `${appOrigin()}/share/${token}`;
  const share = await prisma.documentShare.create({
    data: {
      organizationId: session.organizationId,
      documentId: document.id,
      tokenHash: hashShareToken(token),
      channel,
      recipient,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdById: session.user.id
    }
  });

  try {
    const delivery = await deliverDocument({
      channel,
      recipient,
      recipientName: document.recipientName,
      documentNumber: document.documentNumber,
      documentType: document.type,
      shareUrl
    });
    if (!delivery.configured) {
      revalidatePath("/app/documents");
      ok(
        `/app/documents?share=${encodeURIComponent(token)}&channel=${channel}&recipient=${encodeURIComponent(recipient)}&document=${encodeURIComponent(document.documentNumber)}`,
        "Secure link prepared. Open the share action below to send it from your device."
      );
    }
    await prisma.documentShare.update({
      where: { id: share.id },
      data: { status: "SENT", sentAt: new Date(), providerId: delivery.providerId }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The delivery provider rejected the message.";
    await prisma.documentShare.update({
      where: { id: share.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) }
    });
    revalidatePath("/app/documents");
    fail("/app/documents", `${channel === "EMAIL" ? "Email" : "WhatsApp"} was not sent: ${message}`);
  }

  revalidatePath("/app/documents");
  ok("/app/documents", `${channel === "EMAIL" ? "Email" : "WhatsApp"} sent and logged.`);
}

export async function voidBusinessDocument(formData: FormData) {
  const session = await requireSession("documents:manage");
  const documentId = text(formData, "documentId");
  const updated = await prisma.businessDocument.updateMany({
    where: { id: documentId, organizationId: session.organizationId, status: "ISSUED", clientPaymentId: null },
    data: { status: "VOID" }
  });
  if (!updated.count) fail("/app/documents", "Payment receipts cannot be voided here, or the document is already unavailable.");
  revalidatePath("/app/documents");
  ok("/app/documents", "Document voided. Its history remains available for audit.");
}
