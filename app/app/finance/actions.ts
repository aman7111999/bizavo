"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { accountIds, postJournal } from "@/lib/accounting";
import { createPaymentReceipt } from "@/lib/business-documents";
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
  const submittedTax = numberValue(formData, "taxAmount");
  if (submittedTax < 0) fail("/app/finance?view=invoices", "Tax amount cannot be negative.");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.clientInvoice.update({
      where: { id: invoice.id },
      data: {
        issueDate: dateValue(formData, "issueDate") ?? invoice.issueDate,
        dueDate: dateValue(formData, "dueDate") ?? invoice.dueDate,
        taxAmount: submittedTax || invoice.taxAmount,
        totalAmount: Number(invoice.subtotal) + (submittedTax || Number(invoice.taxAmount)),
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
  if (!Number.isFinite(amount) || amount <= 0) {
    fail("/app/finance?view=invoices", "Enter a valid payment not exceeding the invoice balance.");
  }
  const paymentDate = dateValue(formData, "paymentDate") ?? new Date();
  let projectId: string | null = null;
  try {
    projectId = await prisma.$transaction(async (tx) => {
      const invoice = await tx.clientInvoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: session.organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }
        },
        include: {
          project: { select: { clientName: true, clientEmail: true, clientPhone: true, location: true } }
        }
      });
      const balance = invoice ? Number(invoice.totalAmount) - Number(invoice.paidAmount) : 0;
      if (!invoice || amount > balance + 0.01) return null;
      const paidAmount = Number(invoice.paidAmount) + amount;
      const payment = await tx.clientPayment.create({
        data: {
          organizationId: session.organizationId,
          invoiceId,
          paymentDate,
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
      await createPaymentReceipt(tx, {
        organizationId: session.organizationId,
        currency: session.currency,
        createdById: session.user.id,
        payment,
        invoice
      });
      const accounts = await accountIds(tx, session.organizationId, ["1000", "1100"]);
      await postJournal(tx, {
        organizationId: session.organizationId,
        entryDate: paymentDate,
        description: `Client payment · ${invoice.invoiceNumber}`,
        source: "CLIENT_PAYMENT",
        sourceId: payment.id,
        lines: [
          { accountId: accounts.get("1000")!, debit: amount },
          { accountId: accounts.get("1100")!, projectId: invoice.projectId, credit: amount }
        ]
      });
      return invoice.projectId;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      fail("/app/finance?view=invoices", "The invoice changed while this payment was being saved. Review the balance and try again.");
    }
    throw error;
  }
  if (!projectId) {
    fail("/app/finance?view=invoices", "Enter a valid payment not exceeding the invoice balance.");
  }
  revalidatePath("/app/finance");
  revalidatePath("/app/documents");
  revalidatePath("/app");
  revalidatePath(`/app/projects/${projectId}`);
  ok("/app/finance?view=invoices", "Client payment recorded.");
}

export async function recordVendorPayment(formData: FormData) {
  const session = await requireSession("finance:manage");
  const billId = text(formData, "billId");
  const amount = numberValue(formData, "amount");
  if (!Number.isFinite(amount) || amount <= 0) {
    fail("/app/finance?view=payables", "Enter a valid payment not exceeding the bill balance.");
  }
  const paymentDate = dateValue(formData, "paymentDate") ?? new Date();
  let paid = false;
  try {
    paid = await prisma.$transaction(async (tx) => {
      const bill = await tx.vendorBill.findFirst({
        where: {
          id: billId,
          organizationId: session.organizationId,
          status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] }
        }
      });
      const balance = bill ? Number(bill.amount) - Number(bill.paidAmount) : 0;
      if (!bill || amount > balance + 0.01) return false;
      const paidAmount = Number(bill.paidAmount) + amount;
      const payment = await tx.vendorPayment.create({
        data: {
          organizationId: session.organizationId,
          vendorBillId: bill.id,
          vendorId: bill.vendorId,
          subcontractorId: bill.subcontractorId,
          paymentDate,
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
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      fail("/app/finance?view=payables", "The bill changed while this payment was being saved. Review the balance and try again.");
    }
    throw error;
  }
  if (!paid) {
    fail("/app/finance?view=payables", "Enter a valid payment not exceeding the bill balance.");
  }
  revalidatePath("/app/finance");
  revalidatePath("/app");
  ok("/app/finance?view=payables", "Payment recorded and payable updated.");
}

export async function recordPayrollPayment(formData: FormData) {
  const session = await requireSession("finance:manage");
  const payrollRunId = text(formData, "payrollRunId");
  const paymentDate = dateValue(formData, "paymentDate") ?? new Date();
  let paid = false;
  try {
    paid = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: {
          id: payrollRunId,
          organizationId: session.organizationId,
          status: "PROCESSED"
        }
      });
      if (!run || Number(run.totalNet) <= 0) return false;
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: "PAID",
          paidAt: paymentDate,
          paymentMethod: text(formData, "method") || "Bank transfer",
          paymentReference: optionalText(formData, "reference")
        }
      });
      await tx.payslip.updateMany({
        where: { payrollRunId: run.id, organizationId: session.organizationId },
        data: { paidAt: paymentDate }
      });
      const accounts = await accountIds(tx, session.organizationId, ["1000", "2100"]);
      await postJournal(tx, {
        organizationId: session.organizationId,
        entryDate: paymentDate,
        description: `Net payroll paid · ${String(run.month).padStart(2, "0")}/${run.year}`,
        source: "PAYROLL",
        sourceId: run.id,
        lines: [
          { accountId: accounts.get("2100")!, debit: Number(run.totalNet) },
          { accountId: accounts.get("1000")!, credit: Number(run.totalNet) }
        ]
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      fail("/app/finance?view=payments", "Payroll changed while the payment was being saved. Refresh and try again.");
    }
    throw error;
  }
  if (!paid) fail("/app/finance?view=payments", "Payroll is no longer awaiting payment.");
  revalidatePath("/app/finance");
  revalidatePath("/app/hr");
  revalidatePath("/app");
  ok("/app/finance?view=payments", "Payroll marked paid and the bank/payment journal was posted.");
}

export async function createExpense(formData: FormData) {
  const session = await requireSession("finance:manage");
  const accountId = text(formData, "accountId");
  const amount = numberValue(formData, "amount");
  const account = await prisma.chartAccount.findFirst({
    where: { id: accountId, organizationId: session.organizationId, type: "EXPENSE", active: true }
  });
  if (!account || amount <= 0 || !text(formData, "description")) fail("/app/finance?view=expenses", "Expense account, description and positive amount are required.");
  const projectId = optionalText(formData, "projectId");
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!project) fail("/app/finance?view=expenses", "Select a valid project.");
  }
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        organizationId: session.organizationId,
        projectId,
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
