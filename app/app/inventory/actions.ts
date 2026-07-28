"use server";

import { revalidatePath } from "next/cache";
import { StockMovementType } from "@prisma/client";
import { accountIds, postJournal } from "@/lib/accounting";
import { dateValue, fail, numberValue, ok, optionalText, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function createInventoryItem(formData: FormData) {
  const session = await requireSession("inventory:manage");
  const name = text(formData, "name");
  const sku = text(formData, "sku").toUpperCase();
  const purchasePrice = numberValue(formData, "purchasePrice");
  if (!name || !sku || !text(formData, "unit") || purchasePrice < 0) fail("/app/inventory", "Name, SKU, unit and a valid price are required.");
  const categoryName = text(formData, "category");
  const category = categoryName
    ? await prisma.itemCategory.upsert({
        where: { organizationId_name: { organizationId: session.organizationId, name: categoryName } },
        update: {},
        create: { organizationId: session.organizationId, name: categoryName }
      })
    : null;
  const duplicate = await prisma.inventoryItem.findFirst({
    where: { organizationId: session.organizationId, sku },
    select: { id: true }
  });
  if (duplicate) fail("/app/inventory", "That SKU already exists.");
  const item = await prisma.inventoryItem.create({
    data: {
      organizationId: session.organizationId,
      name,
      sku,
      unit: text(formData, "unit"),
      description: optionalText(formData, "description"),
      purchasePrice,
      averageCost: purchasePrice,
      reorderLevel: Math.max(0, numberValue(formData, "reorderLevel")),
      categoryId: category?.id,
      preferredVendorId: optionalText(formData, "preferredVendorId")
    }
  });
  const openingQuantity = numberValue(formData, "openingQuantity");
  const locationId = optionalText(formData, "locationId");
  if (openingQuantity > 0 && locationId) {
    const location = await prisma.inventoryLocation.findFirst({
      where: { id: locationId, organizationId: session.organizationId }
    });
    if (location) {
      await prisma.$transaction(async (tx) => {
        await tx.inventoryStock.create({
          data: { organizationId: session.organizationId, itemId: item.id, locationId, quantity: openingQuantity }
        });
        await tx.stockMovement.create({
          data: {
            organizationId: session.organizationId,
            itemId: item.id,
            locationId,
            type: "OPENING",
            quantity: openingQuantity,
            unitCost: purchasePrice,
            referenceType: "OpeningStock",
            referenceId: item.id,
            occurredAt: new Date(),
            createdById: session.user.id
          }
        });
        const total = openingQuantity * purchasePrice;
        const accounts = await accountIds(tx, session.organizationId, ["1300", "3000"]);
        await postJournal(tx, {
          organizationId: session.organizationId,
          entryDate: new Date(),
          description: `Opening stock · ${item.name}`,
          source: "OPENING",
          sourceId: item.id,
          lines: [
            { accountId: accounts.get("1300")!, debit: total },
            { accountId: accounts.get("3000")!, credit: total }
          ]
        });
      });
    }
  }
  revalidatePath("/app/inventory");
  ok("/app/inventory", "Inventory item created.");
}

export async function createInventoryLocation(formData: FormData) {
  const session = await requireSession("inventory:manage");
  if (!text(formData, "name") || !text(formData, "code")) fail("/app/inventory", "Location name and code are required.");
  await prisma.inventoryLocation.create({
    data: {
      organizationId: session.organizationId,
      projectId: optionalText(formData, "projectId"),
      name: text(formData, "name"),
      code: text(formData, "code").toUpperCase(),
      type: text(formData, "type") === "SITE_STORE" ? "SITE_STORE" : "CENTRAL_WAREHOUSE",
      address: optionalText(formData, "address")
    }
  });
  revalidatePath("/app/inventory");
  ok("/app/inventory", "Inventory location created.");
}

export async function issueMaterial(formData: FormData) {
  const session = await requireSession("inventory:manage");
  const projectId = text(formData, "projectId");
  const locationId = text(formData, "locationId");
  const itemId = text(formData, "itemId");
  const quantity = numberValue(formData, "quantity");
  const [project, stock] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } }),
    prisma.inventoryStock.findFirst({
      where: { itemId, locationId, organizationId: session.organizationId },
      include: { item: true }
    })
  ]);
  if (!project || !stock || quantity <= 0) fail("/app/inventory", "Select a valid project, stock item and quantity.");
  if (Number(stock.quantity) < quantity) fail("/app/inventory", `Only ${Number(stock.quantity)} ${stock.item.unit} is available at this location.`);
  const count = await prisma.materialIssue.count({ where: { organizationId: session.organizationId } });
  const issueNumber = `MI-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const unitCost = Number(stock.item.averageCost);
  const lineTotal = unitCost * quantity;
  await prisma.$transaction(async (tx) => {
    const issue = await tx.materialIssue.create({
      data: {
        organizationId: session.organizationId,
        projectId,
        locationId,
        issueNumber,
        issueDate: dateValue(formData, "issueDate") ?? new Date(),
        issuedTo: text(formData, "issuedTo"),
        phaseName: optionalText(formData, "phaseName"),
        notes: optionalText(formData, "notes"),
        issuedById: session.user.id,
        items: { create: { itemId, quantity, unitCost, lineTotal } }
      }
    });
    await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: { decrement: quantity } } });
    await tx.stockMovement.create({
      data: {
        organizationId: session.organizationId,
        itemId,
        locationId,
        projectId,
        type: "PROJECT_ISSUE",
        quantity: -quantity,
        unitCost,
        referenceType: "MaterialIssue",
        referenceId: issue.id,
        note: `${issueNumber} · ${text(formData, "issuedTo")}`,
        occurredAt: issue.issueDate,
        createdById: session.user.id
      }
    });
    const accounts = await accountIds(tx, session.organizationId, ["1300", "5000"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: issue.issueDate,
      description: `Material issued to ${project.name} · ${issueNumber}`,
      source: "INVENTORY",
      sourceId: issue.id,
      lines: [
        { accountId: accounts.get("5000")!, projectId, debit: lineTotal },
        { accountId: accounts.get("1300")!, projectId, credit: lineTotal }
      ]
    });
  });
  revalidatePath("/app/inventory");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/finance");
  ok("/app/inventory", `${issueNumber} recorded and project cost updated.`);
}

export async function transferStock(formData: FormData) {
  const session = await requireSession("inventory:manage");
  const itemId = text(formData, "itemId");
  const fromLocationId = text(formData, "fromLocationId");
  const toLocationId = text(formData, "toLocationId");
  const quantity = numberValue(formData, "quantity");
  if (fromLocationId === toLocationId) fail("/app/inventory", "Source and destination locations must be different.");
  const stock = await prisma.inventoryStock.findFirst({
    where: { organizationId: session.organizationId, itemId, locationId: fromLocationId },
    include: { item: true }
  });
  const destination = await prisma.inventoryLocation.findFirst({
    where: { organizationId: session.organizationId, id: toLocationId, active: true }
  });
  if (!stock || !destination || quantity <= 0 || Number(stock.quantity) < quantity) fail("/app/inventory", "Insufficient stock or invalid transfer details.");
  const referenceId = crypto.randomUUID();
  const occurredAt = dateValue(formData, "date") ?? new Date();
  await prisma.$transaction(async (tx) => {
    await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: { decrement: quantity } } });
    await tx.inventoryStock.upsert({
      where: { itemId_locationId: { itemId, locationId: toLocationId } },
      update: { quantity: { increment: quantity } },
      create: { organizationId: session.organizationId, itemId, locationId: toLocationId, quantity }
    });
    await tx.stockMovement.createMany({
      data: [
        {
          organizationId: session.organizationId, itemId, locationId: fromLocationId, type: "TRANSFER_OUT",
          quantity: -quantity, unitCost: stock.item.averageCost, referenceType: "StockTransfer", referenceId,
          note: `Transfer to ${destination.name}`, occurredAt, createdById: session.user.id
        },
        {
          organizationId: session.organizationId, itemId, locationId: toLocationId, type: "TRANSFER_IN",
          quantity, unitCost: stock.item.averageCost, referenceType: "StockTransfer", referenceId,
          note: "Inter-location transfer", occurredAt, createdById: session.user.id
        }
      ]
    });
  });
  revalidatePath("/app/inventory");
  ok("/app/inventory", "Stock transferred.");
}

export async function adjustStock(formData: FormData) {
  const session = await requireSession("inventory:manage");
  const itemId = text(formData, "itemId");
  const locationId = text(formData, "locationId");
  const adjustment = numberValue(formData, "adjustment");
  const stock = await prisma.inventoryStock.findFirst({
    where: { organizationId: session.organizationId, itemId, locationId },
    include: { item: true }
  });
  if (!stock || adjustment === 0 || Number(stock.quantity) + adjustment < 0) fail("/app/inventory", "Invalid adjustment or resulting quantity.");
  const total = Math.abs(adjustment) * Number(stock.item.averageCost);
  await prisma.$transaction(async (tx) => {
    await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: { increment: adjustment } } });
    const movement = await tx.stockMovement.create({
      data: {
        organizationId: session.organizationId,
        itemId,
        locationId,
        type: StockMovementType.ADJUSTMENT,
        quantity: adjustment,
        unitCost: stock.item.averageCost,
        referenceType: "StockAdjustment",
        referenceId: crypto.randomUUID(),
        note: text(formData, "reason"),
        occurredAt: dateValue(formData, "date") ?? new Date(),
        createdById: session.user.id
      }
    });
    const accounts = await accountIds(tx, session.organizationId, ["1300", "5300"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: movement.occurredAt,
      description: `Stock adjustment · ${stock.item.name} · ${text(formData, "reason")}`,
      source: "INVENTORY",
      sourceId: movement.id,
      lines: adjustment > 0
        ? [{ accountId: accounts.get("1300")!, debit: total }, { accountId: accounts.get("5300")!, credit: total }]
        : [{ accountId: accounts.get("5300")!, debit: total }, { accountId: accounts.get("1300")!, credit: total }]
    });
  });
  revalidatePath("/app/inventory");
  ok("/app/inventory", "Stock adjusted with an audit trail.");
}
