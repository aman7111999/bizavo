"use server";

import { addDays } from "date-fns";
import { VendorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountIds, postJournal } from "@/lib/accounting";
import { dateValue, fail, numberValue, ok, optionalText, parseOrFail, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const vendorSchema = z.object({
  name: z.string().min(2, "Vendor name is required."),
  code: z.string().min(2, "Vendor code is required."),
  type: z.nativeEnum(VendorType),
  category: z.string().min(2, "Vendor category is required."),
  rating: z.number().int().min(1).max(5).optional()
});

export async function createVendor(formData: FormData) {
  const session = await requireSession("procurement:request");
  const ratingValue = numberValue(formData, "rating");
  const payload = parseOrFail(
    vendorSchema,
    {
      name: text(formData, "name"),
      code: text(formData, "code").toUpperCase(),
      type: text(formData, "type"),
      category: text(formData, "category"),
      rating: ratingValue ? ratingValue : undefined
    },
    "/app/procurement"
  );
  const duplicate = await prisma.vendor.findFirst({
    where: { organizationId: session.organizationId, code: payload.code },
    select: { id: true }
  });
  if (duplicate) fail("/app/procurement", "That vendor code is already in use.");
  await prisma.vendor.create({
    data: {
      organizationId: session.organizationId,
      ...payload,
      contactPerson: optionalText(formData, "contactPerson"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      gstin: optionalText(formData, "gstin"),
      address: optionalText(formData, "address"),
      paymentTerms: optionalText(formData, "paymentTerms"),
      notes: optionalText(formData, "notes")
    }
  });
  revalidatePath("/app/procurement");
  ok("/app/procurement", "Vendor added.");
}

export async function createPurchaseOrder(formData: FormData) {
  const session = await requireSession("procurement:request");
  const projectId = text(formData, "projectId");
  const vendorId = text(formData, "vendorId");
  const [project, vendor] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } }),
    prisma.vendor.findFirst({ where: { id: vendorId, organizationId: session.organizationId, active: true } })
  ]);
  if (!project || !vendor) fail("/app/procurement/new", "Select a valid project and vendor.");

  const itemIds = formData.getAll("itemId").map(String);
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const unitPrices = formData.getAll("unitPrice").map(Number);
  const taxes = formData.getAll("taxPercent").map(Number);
  const itemsById = new Map(
    (await prisma.inventoryItem.findMany({
      where: { organizationId: session.organizationId, id: { in: itemIds.filter(Boolean) }, active: true }
    })).map((item) => [item.id, item])
  );
  const lines = itemIds
    .map((itemId, index) => {
      const item = itemsById.get(itemId);
      const quantity = quantities[index] ?? 0;
      const unitPrice = unitPrices[index] ?? 0;
      const taxPercent = taxes[index] ?? 0;
      if (!item || quantity <= 0 || unitPrice < 0) return null;
      return {
        itemId,
        description: descriptions[index]?.trim() || item.name,
        quantity,
        unit: item.unit,
        unitPrice,
        taxPercent,
        lineTotal: quantity * unitPrice
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
  if (!lines.length) fail("/app/procurement/new", "Add at least one valid item line.");
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const taxAmount = lines.reduce((sum, line) => sum + line.lineTotal * (line.taxPercent / 100), 0);
  const count = await prisma.purchaseOrder.count({ where: { organizationId: session.organizationId } });
  const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId: session.organizationId,
      projectId,
      vendorId,
      poNumber,
      orderDate: dateValue(formData, "orderDate") ?? new Date(),
      expectedDate: dateValue(formData, "expectedDate"),
      status: "REQUESTED",
      notes: optionalText(formData, "notes"),
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      requestedById: session.user.id,
      requestedAt: new Date(),
      items: { create: lines }
    }
  });
  revalidatePath("/app/procurement");
  ok(`/app/procurement/${po.id}`, "Purchase order submitted for approval.");
}

export async function decidePurchaseOrder(formData: FormData) {
  const session = await requireSession("procurement:approve");
  const purchaseOrderId = text(formData, "purchaseOrderId");
  const decision = text(formData, "decision");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, organizationId: session.organizationId, status: "REQUESTED" }
  });
  if (!po) fail("/app/procurement", "Purchase order is no longer awaiting approval.");
  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: decision === "approve"
      ? { status: "APPROVED", approvedById: session.user.id, approvedAt: new Date(), rejectionReason: null }
      : { status: "REJECTED", approvedById: session.user.id, approvedAt: new Date(), rejectionReason: text(formData, "reason") || "Rejected by approver" }
  });
  revalidatePath("/app/procurement");
  revalidatePath(`/app/procurement/${po.id}`);
  ok(`/app/procurement/${po.id}`, decision === "approve" ? "Purchase order approved." : "Purchase order rejected.");
}

export async function receivePurchaseOrder(formData: FormData) {
  const session = await requireSession("inventory:manage");
  const purchaseOrderId = text(formData, "purchaseOrderId");
  const locationId = text(formData, "locationId");
  const po = await prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      organizationId: session.organizationId,
      status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] }
    },
    include: { items: { include: { item: true } }, vendor: true }
  });
  const location = await prisma.inventoryLocation.findFirst({
    where: { id: locationId, organizationId: session.organizationId, active: true }
  });
  if (!po || !location) fail(`/app/procurement/${purchaseOrderId}`, "Select an approved PO and valid stock location.");
  const receiptLines = po.items.map((line) => {
    const quantity = Number(formData.get(`quantity-${line.id}`) ?? 0);
    const remaining = Number(line.quantity) - Number(line.receivedQuantity);
    return {
      line,
      quantity: Math.min(quantity, remaining)
    };
  }).filter(({ line, quantity }) => line.item && quantity > 0);
  if (!receiptLines.length) fail(`/app/procurement/${po.id}`, "Enter at least one receipt quantity.");
  const receiptCount = await prisma.goodsReceipt.count({ where: { organizationId: session.organizationId } });
  const receiptNumber = `GRN-${new Date().getFullYear()}-${String(receiptCount + 1).padStart(4, "0")}`;

  await prisma.$transaction(async (tx) => {
    const receipt = await tx.goodsReceipt.create({
      data: {
        organizationId: session.organizationId,
        purchaseOrderId: po.id,
        locationId,
        receiptNumber,
        receivedDate: dateValue(formData, "receivedDate") ?? new Date(),
        receivedById: session.user.id,
        notes: optionalText(formData, "notes")
      }
    });
    let receiptSubtotal = 0;
    let receiptTax = 0;
    for (const { line, quantity } of receiptLines) {
      const item = line.item!;
      const unitCost = Number(line.unitPrice);
      receiptSubtotal += quantity * unitCost;
      receiptTax += quantity * unitCost * (Number(line.taxPercent) / 100);
      const currentStock = await tx.inventoryStock.aggregate({
        where: { itemId: item.id },
        _sum: { quantity: true }
      });
      const totalBefore = Number(currentStock._sum.quantity ?? 0);
      const averageCost = totalBefore + quantity > 0
        ? (totalBefore * Number(item.averageCost) + quantity * unitCost) / (totalBefore + quantity)
        : unitCost;
      await tx.goodsReceiptItem.create({
        data: {
          goodsReceiptId: receipt.id,
          purchaseOrderItemId: line.id,
          itemId: item.id,
          quantity,
          unitCost
        }
      });
      await tx.purchaseOrderItem.update({
        where: { id: line.id },
        data: { receivedQuantity: { increment: quantity } }
      });
      await tx.inventoryStock.upsert({
        where: { itemId_locationId: { itemId: item.id, locationId } },
        update: { quantity: { increment: quantity } },
        create: { organizationId: session.organizationId, itemId: item.id, locationId, quantity }
      });
      await tx.inventoryItem.update({ where: { id: item.id }, data: { averageCost } });
      await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          itemId: item.id,
          locationId,
          projectId: po.projectId,
          type: "RECEIPT",
          quantity,
          unitCost,
          referenceType: "GoodsReceipt",
          referenceId: receipt.id,
          note: `${po.poNumber} · ${receiptNumber}`,
          occurredAt: receipt.receivedDate,
          createdById: session.user.id
        }
      });
    }
    const updatedLines = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
    const fullyReceived = updatedLines.every((line) => Number(line.receivedQuantity) >= Number(line.quantity));
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" }
    });
    const billTotal = receiptSubtotal + receiptTax;
    const bill = await tx.vendorBill.create({
      data: {
        organizationId: session.organizationId,
        projectId: po.projectId,
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        billNumber: `BILL-${receiptNumber}`,
        billDate: receipt.receivedDate,
        dueDate: addDays(receipt.receivedDate, 30),
        amount: billTotal,
        status: "OPEN",
        description: `Auto-created from ${receiptNumber} against ${po.poNumber}`
      }
    });
    const accounts = await accountIds(tx, session.organizationId, ["1300", "1400", "2000"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: receipt.receivedDate,
      description: `Inventory received from ${po.vendor.name} · ${receiptNumber}`,
      source: "VENDOR_BILL",
      sourceId: bill.id,
      lines: [
        { accountId: accounts.get("1300")!, projectId: po.projectId, debit: receiptSubtotal },
        ...(receiptTax > 0 ? [{ accountId: accounts.get("1400")!, projectId: po.projectId, debit: receiptTax }] : []),
        { accountId: accounts.get("2000")!, projectId: po.projectId, credit: billTotal }
      ]
    });
  });
  revalidatePath("/app/procurement");
  revalidatePath("/app/inventory");
  revalidatePath("/app/finance");
  ok(`/app/procurement/${po.id}`, `${receiptNumber} recorded, stock updated and vendor payable created.`);
}
