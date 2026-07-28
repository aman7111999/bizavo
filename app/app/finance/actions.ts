"use server";

import { revalidatePath } from "next/cache";
import { accountIds, postJournal } from "@/lib/accounting";
import { dateValue, fail, numberValue, ok, optionalText, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function issueClientInvoice(formData: FormData) {
  const session = await requireSession("finance:manage");
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId, organizationId: session.organizationId, status: "DRAFT" }
  });
  if (!invoice) fail("/app/finance?view=invoices", "Invoice is no longer in draft.");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.clientInvoice.update({
      where: { id: invoice.id },
      data: {
        issueDate: dateValue(formData, "issueDate") ?? invoice.issueDate,
        dueDate: dateValue(formData, "dueDate") ?? invoice.dueDate,
        taxAmount: numberValue(formData, "taxAmount") || invoice.taxAmount,
        totalAmount: Number(invoice.subtotal) + (numberValue(formData, "taxAmount") || Number(invoice.taxAmount)),
        status: "ISSUED"
      }
    });
    if (invoice.milestoneId) {
      await tx.contractMilestone.update({ where: { id: invoice.milestoneId }, data: { status: "INVOICED" } });
    }
    const accounts = await accountIds(tx, session.organizationId, ["1100", "2200", "4000"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: updated.issueDate,
      description: `Client invoice · ${updated.invoiceNumber}`,
      source: "CLIENT_INVOICE",
      sourceId: updated.id,
      lines: [
        { accountId: accounts.get("1100")!, projectId: updated.projectId, debit: Number(updated.totalAmount) },
        { accountId: accounts.get("4000")!, projectId: updated.projectId, credit: Number(updated.subtotal) },
        ...(Number(updated.taxAmount) > 0 ? [{ accountId: accounts.get("2200")!, projectId: updated.projectId, credit: Number(updated.taxAmount) }] : [])
      ]
    });
  });
  revalidatePath("/app/finance");
  revalidatePath(`/app/projects/${invoice.projectId}`);
  ok("/app/finance?view=invoices", "Invoice issued and revenue posted.");
}

export async function recordClientPayment(formData: FormData) {
  const session = await requireSession("finance:manage");
  const invoiceId = text(formData, "invoiceId");
  const amount = numberValue(formData, "amount");
  const invoice = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId, organizationId: session.organizationId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }
  });
  if (!invoice || amount <= 0 || amount > Number(invoice.totalAmount) - Number(invoice.paidAmount) + 0.01) {
    fail("/app/finance?view=invoices", "Enter a valid payment not exceeding the invoice balance.");
  }
  await prisma.$transaction(async (tx) => {
    const paidAmount = Number(invoice.paidAmount) + amount;
    await tx.clientPayment.create({
      data: {
        organizationId: session.organizationId,
        invoiceId,
        paymentDate: dateValue(formData, "paymentDate") ?? new Date(),
        amount,
        method: text(formData, "method") || "Bank transfer",
        reference: optionalText(formData, "reference")
      }
    });
    await tx.clientInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        status: paidAmount >= Number(invoice.totalAmount) - 0.01 ? "PAID" : "PARTIALLY_PAID"
      }
    });
    const accounts = await accountIds(tx, session.organizationId, ["1000", "1100"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: dateValue(formData, "paymentDate") ?? new Date(),
      description: `Client payment · ${invoice.invoiceNumber}`,
      source: "CLIENT_PAYMENT",
      sourceId: invoice.id,
      lines: [
        { accountId: accounts.get("1000")!, debit: amount },
        { accountId: accounts.get("1100")!, projectId: invoice.projectId, credit: amount }
      ]
    });
  });
  revalidatePath("/app/finance");
  revalidatePath("/app");
  ok("/app/finance?view=invoices", "Client payment recorded.");
}

export async function recordVendorPayment(formData: FormData) {
  const session = await requireSession("finance:manage");
  const billId = text(formData, "billId");
  const amount = numberValue(formData, "amount");
  const bill = await prisma.vendorBill.findFirst({
    where: { id: billId, organizationId: session.organizationId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } }
  });
  if (!bill || amount <= 0 || amount > Number(bill.amount) - Number(bill.paidAmount) + 0.01) {
    fail("/app/finance?view=payables", "Enter a valid payment not exceeding the bill balance.");
  }
  await prisma.$transaction(async (tx) => {
    const paidAmount = Number(bill.paidAmount) + amount;
    const payment = await tx.vendorPayment.create({
      data: {
        organizationId: session.organizationId,
        vendorBillId: bill.id,
        vendorId: bill.vendorId,
        subcontractorId: bill.subcontractorId,
        paymentDate: dateValue(formData, "paymentDate") ?? new Date(),
        amount,
        method: text(formData, "method") || "Bank transfer",
        reference: optionalText(formData, "reference")
      }
    });
    await tx.vendorBill.update({
      where: { id: bill.id },
      data: { paidAmount, status: paidAmount >= Number(bill.amount) - 0.01 ? "PAID" : "PARTIALLY_PAID" }
    });
    const accounts = await accountIds(tx, session.organizationId, ["1000", "2000"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: payment.paymentDate,
      description: `Payable payment · ${bill.billNumber}`,
      source: "VENDOR_PAYMENT",
      sourceId: payment.id,
      lines: [
        { accountId: accounts.get("2000")!, projectId: bill.projectId, debit: amount },
        { accountId: accounts.get("1000")!, credit: amount }
      ]
    });
  });
  revalidatePath("/app/finance");
  revalidatePath("/app");
  ok("/app/finance?view=payables", "Payment recorded and payable updated.");
}

export async function createExpense(formData: FormData) {
  const session = await requireSession("finance:manage");
  const accountId = text(formData, "accountId");
  const amount = numberValue(formData, "amount");
  const account = await prisma.chartAccount.findFirst({
    where: { id: accountId, organizationId: session.organizationId, type: "EXPENSE", active: true }
  });
  if (!account || amount <= 0 || !text(formData, "description")) fail("/app/finance?view=expenses", "Expense account, description and positive amount are required.");
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        organizationId: session.organizationId,
        projectId: optionalText(formData, "projectId"),
        accountId,
        expenseDate: dateValue(formData, "expenseDate") ?? new Date(),
        amount,
        vendorName: optionalText(formData, "vendorName"),
        description: text(formData, "description"),
        paymentMethod: text(formData, "paymentMethod") || "Bank transfer",
        reference: optionalText(formData, "reference")
      }
    });
    const accounts = await accountIds(tx, session.organizationId, ["1000"]);
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: expense.expenseDate,
      description: `Expense · ${expense.description}`,
      source: "EXPENSE",
      sourceId: expense.id,
      lines: [
        { accountId, projectId: expense.projectId ?? undefined, debit: amount },
        { accountId: accounts.get("1000")!, credit: amount }
      ]
    });
  });
  revalidatePath("/app/finance");
  revalidatePath("/app");
  ok("/app/finance?view=expenses", "Expense recorded.");
}
