import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  createDocumentNumber,
  createShareToken,
  documentTitle,
  generateBusinessDocumentPdf,
  hashShareToken,
  normalizeWhatsAppPhone,
} from "@/lib/business-documents";

describe("business document helpers", () => {
  it("creates stable payment receipt numbers from the payment identity", () => {
    expect(createDocumentNumber("PAYMENT_RECEIPT", "cm1234567890", new Date("2026-07-31T00:00:00Z"))).toBe("REC-2026-34567890");
    expect(documentTitle("PAYMENT_RECEIPT")).toBe("Payment receipt");
  });

  it("stores only a one-way share-token hash", () => {
    const token = createShareToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashShareToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashShareToken(token)).not.toContain(token);
  });

  it("normalizes Indian WhatsApp numbers without changing explicit country codes", () => {
    expect(normalizeWhatsAppPhone("98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("+44 7700 900123")).toBe("447700900123");
  });

  it("renders a multi-page itemized document with standard PDF fonts", async () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      description: `Construction service line ${index + 1}`,
      quantity: new Prisma.Decimal(2),
      unit: "lot",
      unitPrice: new Prisma.Decimal(1250),
      taxPercent: new Prisma.Decimal(18),
      lineTotal: new Prisma.Decimal(2950),
    }));

    const pdf = await generateBusinessDocumentPdf({
      type: "QUOTATION",
      documentNumber: "QUO-2026-0001",
      issueDate: new Date("2026-07-31T00:00:00Z"),
      currency: "INR",
      recipientName: "Apex Buildcon Client",
      recipientEmail: "client@example.com",
      recipientPhone: "9876543210",
      billingAddress: "Mumbai, Maharashtra",
      subtotal: new Prisma.Decimal(62500),
      taxAmount: new Prisma.Decimal(11250),
      totalAmount: new Prisma.Decimal(73750),
      paymentMethod: null,
      paymentReference: null,
      notes: "Valid for 30 days.",
      organization: { name: "Apex Buildcon", billingProfile: null },
      project: { name: "Seaside Residency", code: "SR-01" },
      items,
    });

    expect(pdf.byteLength).toBeGreaterThan(2_000);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
