import { createHash, randomBytes } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BusinessDocumentType, type Prisma } from "@prisma/client";

export function documentPrefix(type: BusinessDocumentType) {
  return {
    PAYMENT_RECEIPT: "REC",
    SALES_RECEIPT: "SRC",
    QUOTATION: "QUO",
    PROFORMA_INVOICE: "PRO"
  }[type];
}

export function documentTitle(type: BusinessDocumentType) {
  return {
    PAYMENT_RECEIPT: "Payment receipt",
    SALES_RECEIPT: "Sales receipt",
    QUOTATION: "Quotation",
    PROFORMA_INVOICE: "Proforma invoice"
  }[type];
}

export function createDocumentNumber(type: BusinessDocumentType, stableId?: string, date = new Date()) {
  const suffix = (stableId?.slice(-8) ?? randomBytes(4).toString("hex")).toUpperCase();
  return `${documentPrefix(type)}-${date.getUTCFullYear()}-${suffix}`;
}

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function communicationConfiguration() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.BIZAVO_EMAIL_FROM),
    whatsapp: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_DOCUMENT_TEMPLATE
    )
  };
}

export async function createPaymentReceipt(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    currency: string;
    createdById: string;
    payment: { id: string; paymentDate: Date; amount: Prisma.Decimal; method: string; reference: string | null };
    invoice: {
      invoiceNumber: string;
      projectId: string;
      project: { clientName: string; clientEmail: string | null; clientPhone: string | null; location: string };
    };
  }
) {
  return tx.businessDocument.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.invoice.projectId,
      clientPaymentId: input.payment.id,
      type: "PAYMENT_RECEIPT",
      status: "ISSUED",
      documentNumber: createDocumentNumber("PAYMENT_RECEIPT", input.payment.id, input.payment.paymentDate),
      recipientName: input.invoice.project.clientName,
      recipientEmail: input.invoice.project.clientEmail,
      recipientPhone: input.invoice.project.clientPhone,
      billingAddress: input.invoice.project.location,
      issueDate: input.payment.paymentDate,
      currency: input.currency,
      subtotal: input.payment.amount,
      taxAmount: 0,
      totalAmount: input.payment.amount,
      paymentMethod: input.payment.method,
      paymentReference: input.payment.reference,
      notes: `Payment received against ${input.invoice.invoiceNumber}.`,
      createdById: input.createdById,
      items: {
        create: {
          description: `Payment received against invoice ${input.invoice.invoiceNumber}`,
          quantity: 1,
          unit: "payment",
          unitPrice: input.payment.amount,
          taxPercent: 0,
          lineTotal: input.payment.amount
        }
      }
    }
  });
}

export async function deliverDocument(input: {
  channel: "EMAIL" | "WHATSAPP";
  recipient: string;
  recipientName: string;
  documentNumber: string;
  documentType: BusinessDocumentType;
  shareUrl: string;
}) {
  if (input.channel === "EMAIL") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.BIZAVO_EMAIL_FROM;
    if (!apiKey || !from) return { configured: false as const };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: `${documentTitle(input.documentType)} ${input.documentNumber}`,
        html: `<p>Hello ${escapeHtml(input.recipientName)},</p><p>Your ${escapeHtml(documentTitle(input.documentType).toLowerCase())} <strong>${escapeHtml(input.documentNumber)}</strong> is ready.</p><p><a href="${escapeHtml(input.shareUrl)}">View and download document</a></p><p>This secure link expires in 30 days.</p>`
      })
    });
    const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) throw new Error(result.message ?? "Email provider rejected the message.");
    return { configured: true as const, providerId: result.id };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_DOCUMENT_TEMPLATE;
  if (!accessToken || !phoneNumberId || !templateName) return { configured: false as const };
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeWhatsAppPhone(input.recipient),
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: input.recipientName },
              { type: "text", text: documentTitle(input.documentType) },
              { type: "text", text: input.documentNumber },
              { type: "text", text: input.shareUrl }
            ]
          }
        ]
      }
    })
  });
  const result = (await response.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(result.error?.message ?? "WhatsApp provider rejected the message.");
  return { configured: true as const, providerId: result.messages?.[0]?.id };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function pdfMoney(value: Prisma.Decimal | number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;
}

function drawRight(page: PDFPage, text: string | null | undefined, x: number, y: number, font: PDFFont, size: number, color = rgb(0.05, 0.1, 0.2)) {
  const safeText = text ?? "—";
  page.drawText(safeText, { x: x - font.widthOfTextAtSize(safeText, size), y, font, size, color });
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export async function generateBusinessDocumentPdf(document: {
  documentNumber: string;
  type: BusinessDocumentType;
  issueDate: Date;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  billingAddress: string | null;
  currency: string;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  organization: { name: string; billingProfile: { legalName: string; taxId: string | null; billingEmail: string; billingPhone: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null } | null };
  project: { name: string; code: string } | null;
  items: { description: string; quantity: Prisma.Decimal; unit: string; unitPrice: Prisma.Decimal; taxPercent: Prisma.Decimal; lineTotal: Prisma.Decimal }[];
}) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(17 / 255, 28 / 255, 53 / 255);
  const muted = rgb(96 / 255, 109 / 255, 135 / 255);
  const blue = rgb(47 / 255, 91 / 255, 234 / 255);
  const mist = rgb(246 / 255, 248 / 255, 252 / 255);

  page.drawRectangle({ x: 0, y: 730, width: 595, height: 112, color: ink });
  page.drawText("BIZAVO", { x: 42, y: 800, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ONE CONNECTED SYSTEM", { x: 42, y: 782, size: 7, font: bold, color: rgb(0.55, 0.72, 1) });
  drawRight(page, documentTitle(document.type).toUpperCase(), 553, 799, bold, 13, rgb(1, 1, 1));
  drawRight(page, document.documentNumber, 553, 780, regular, 9, rgb(0.78, 0.84, 1));

  const company = document.organization.billingProfile?.legalName ?? document.organization.name;
  page.drawText(truncate(company, 52), { x: 42, y: 690, size: 16, font: bold, color: ink });
  const companyAddress = [document.organization.billingProfile?.addressLine1, document.organization.billingProfile?.addressLine2, document.organization.billingProfile?.city, document.organization.billingProfile?.state, document.organization.billingProfile?.postalCode].filter(Boolean).join(", ");
  if (companyAddress) page.drawText(truncate(companyAddress, 85), { x: 42, y: 672, size: 8, font: regular, color: muted });
  if (document.organization.billingProfile?.taxId) page.drawText(`Tax ID: ${document.organization.billingProfile.taxId}`, { x: 42, y: 657, size: 8, font: regular, color: muted });

  page.drawText("ISSUED TO", { x: 42, y: 614, size: 8, font: bold, color: blue });
  page.drawText(truncate(document.recipientName, 42), { x: 42, y: 594, size: 11, font: bold, color: ink });
  if (document.recipientEmail) page.drawText(truncate(document.recipientEmail, 46), { x: 42, y: 578, size: 8, font: regular, color: muted });
  if (document.recipientPhone) page.drawText(document.recipientPhone, { x: 42, y: 564, size: 8, font: regular, color: muted });
  if (document.project) page.drawText(`Project: ${truncate(document.project.name, 32)} (${document.project.code})`, { x: 320, y: 594, size: 9, font: regular, color: ink });
  page.drawText(`Issue date: ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(document.issueDate)}`, { x: 320, y: 576, size: 9, font: regular, color: ink });

  const drawTableHeader = (target: PDFPage, boxY: number) => {
    target.drawRectangle({ x: 42, y: boxY, width: 511, height: 30, color: ink });
    target.drawText("DESCRIPTION", { x: 54, y: boxY + 11, size: 8, font: bold, color: rgb(1, 1, 1) });
    drawRight(target, "QTY", 365, boxY + 11, bold, 8, rgb(1, 1, 1));
    drawRight(target, "RATE", 455, boxY + 11, bold, 8, rgb(1, 1, 1));
    drawRight(target, "AMOUNT", 541, boxY + 11, bold, 8, rgb(1, 1, 1));
  };
  drawTableHeader(page, 507);

  let y = 480;
  for (const item of document.items) {
    if (y < 215) {
      page.drawText(`Continued · ${document.documentNumber}`, { x: 42, y: 45, size: 7.5, font: regular, color: muted });
      page = pdf.addPage([595, 842]);
      page.drawText(documentTitle(document.type).toUpperCase(), { x: 42, y: 795, size: 12, font: bold, color: ink });
      drawRight(page, document.documentNumber, 553, 795, regular, 9, muted);
      drawTableHeader(page, 747);
      y = 720;
    }
    page.drawText(truncate(item.description, 48), { x: 54, y, size: 9, font: regular, color: ink });
    drawRight(page, `${Number(item.quantity).toLocaleString("en-IN")} ${item.unit}`, 365, y, regular, 8, muted);
    drawRight(page, pdfMoney(item.unitPrice, document.currency), 455, y, regular, 8, muted);
    drawRight(page, pdfMoney(item.lineTotal, document.currency), 541, y, bold, 8, ink);
    page.drawLine({ start: { x: 54, y: y - 12 }, end: { x: 541, y: y - 12 }, thickness: 0.5, color: rgb(0.88, 0.9, 0.94) });
    y -= 34;
  }

  const totalsY = Math.max(174, y - 4);
  page.drawRectangle({ x: 316, y: totalsY - 80, width: 237, height: 94, color: mist });
  page.drawText("Subtotal", { x: 330, y: totalsY - 10, size: 9, font: regular, color: muted });
  drawRight(page, pdfMoney(document.subtotal, document.currency), 539, totalsY - 10, regular, 9, ink);
  page.drawText("Tax", { x: 330, y: totalsY - 34, size: 9, font: regular, color: muted });
  drawRight(page, pdfMoney(document.taxAmount, document.currency), 539, totalsY - 34, regular, 9, ink);
  page.drawText("TOTAL", { x: 330, y: totalsY - 65, size: 9, font: bold, color: ink });
  drawRight(page, pdfMoney(document.totalAmount, document.currency), 539, totalsY - 65, bold, 13, blue);

  if (document.paymentMethod || document.paymentReference) {
    page.drawText("PAYMENT", { x: 42, y: totalsY - 12, size: 8, font: bold, color: blue });
    page.drawText([document.paymentMethod, document.paymentReference].filter(Boolean).join(" · "), { x: 42, y: totalsY - 31, size: 9, font: regular, color: ink });
  }
  if (document.notes) page.drawText(truncate(document.notes, 78), { x: 42, y: 87, size: 8, font: regular, color: muted });
  page.drawText("Generated electronically by Bizavo. Verify this document with the issuing organization.", { x: 42, y: 55, size: 7.5, font: regular, color: muted });

  return pdf.save();
}
