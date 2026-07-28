"use server";

import { revalidatePath } from "next/cache";
import { accountIds, postJournal } from "@/lib/accounting";
import { dateValue, fail, numberValue, ok, optionalText, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function createSubcontractor(formData: FormData) {
  const session = await requireSession("subcontractors:manage");
  if (!text(formData, "name") || !text(formData, "code") || !text(formData, "trade")) {
    fail("/app/subcontractors", "Name, code and trade are required.");
  }
  await prisma.subcontractor.create({
    data: {
      organizationId: session.organizationId,
      name: text(formData, "name"),
      code: text(formData, "code").toUpperCase(),
      trade: text(formData, "trade"),
      contactPerson: optionalText(formData, "contactPerson"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      gstin: optionalText(formData, "gstin"),
      address: optionalText(formData, "address"),
      rating: numberValue(formData, "rating") || undefined,
      notes: optionalText(formData, "notes")
    }
  });
  revalidatePath("/app/subcontractors");
  ok("/app/subcontractors", "Subcontractor added.");
}

export async function createWorkOrder(formData: FormData) {
  const session = await requireSession("subcontractors:manage");
  const projectId = text(formData, "projectId");
  const subcontractorId = text(formData, "subcontractorId");
  const value = numberValue(formData, "value");
  const [project, subcontractor] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } }),
    prisma.subcontractor.findFirst({ where: { id: subcontractorId, organizationId: session.organizationId, active: true } })
  ]);
  if (!project || !subcontractor || !text(formData, "scope") || value <= 0) fail("/app/subcontractors", "Project, subcontractor, scope and value are required.");
  const count = await prisma.workOrder.count({ where: { organizationId: session.organizationId } });
  await prisma.workOrder.create({
    data: {
      organizationId: session.organizationId,
      projectId,
      subcontractorId,
      milestoneId: optionalText(formData, "milestoneId"),
      workOrderNumber: `WO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
      scope: text(formData, "scope"),
      startDate: dateValue(formData, "startDate"),
      endDate: dateValue(formData, "endDate"),
      value,
      retentionPercent: Math.max(0, numberValue(formData, "retentionPercent")),
      status: "ISSUED"
    }
  });
  revalidatePath("/app/subcontractors");
  ok("/app/subcontractors", "Work order issued.");
}

export async function createSubcontractorBill(formData: FormData) {
  const session = await requireSession("subcontractors:manage");
  const workOrderId = text(formData, "workOrderId");
  const amount = numberValue(formData, "amount");
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: session.organizationId },
    include: { subcontractor: true }
  });
  if (!workOrder || amount <= 0 || !text(formData, "billNumber")) fail("/app/subcontractors", "Work order, bill number and amount are required.");
  const invoiced = await prisma.vendorBill.aggregate({
    where: { workOrderId, status: { not: "VOID" } },
    _sum: { amount: true }
  });
  if (Number(invoiced._sum.amount ?? 0) + amount > Number(workOrder.value) * 1.001) {
    fail("/app/subcontractors", "Total subcontractor billing cannot exceed the work order value.");
  }
  await prisma.$transaction(async (tx) => {
    const bill = await tx.vendorBill.create({
      data: {
        organizationId: session.organizationId,
        projectId: workOrder.projectId,
        subcontractorId: workOrder.subcontractorId,
        workOrderId,
        billNumber: text(formData, "billNumber"),
        billDate: dateValue(formData, "billDate") ?? new Date(),
        dueDate: dateValue(formData, "dueDate") ?? new Date(Date.now() + 30 * 86_400_000),
        amount,
        status: "OPEN",
        description: optionalText(formData, "description") ?? `Bill against ${workOrder.workOrderNumber}`
      }
    });
    const accounts = await accountIds(tx, session.organizationId, ["2000", "5100"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: bill.billDate,
      description: `Subcontractor bill · ${workOrder.subcontractor.name} · ${bill.billNumber}`,
      source: "VENDOR_BILL",
      sourceId: bill.id,
      lines: [
        { accountId: accounts.get("5100")!, projectId: workOrder.projectId, debit: amount },
        { accountId: accounts.get("2000")!, projectId: workOrder.projectId, credit: amount }
      ]
    });
  });
  revalidatePath("/app/subcontractors");
  revalidatePath("/app/finance");
  ok("/app/subcontractors", "Subcontractor bill recorded and added to payables.");
}
