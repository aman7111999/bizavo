import { BillStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const activeInvoiceStatuses: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"];
const activeBillStatuses: BillStatus[] = ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE"];

export async function getProjectFinancials(organizationId: string, projectIds?: string[]) {
  const projectWhere = {
    organizationId,
    ...(projectIds !== undefined ? { id: { in: projectIds } } : {})
  };
  const projects = await prisma.project.findMany({
    where: projectWhere,
    orderBy: { name: "asc" },
    include: {
      clientInvoices: { where: { status: { in: activeInvoiceStatuses } }, select: { totalAmount: true } },
      materialIssues: { include: { items: { select: { lineTotal: true } } } },
      vendorBills: {
        where: { subcontractorId: { not: null }, status: { in: activeBillStatuses } },
        select: { amount: true }
      },
      expenses: { select: { amount: true } }
    }
  });

  const payroll = await prisma.payslip.groupBy({
    by: ["projectId"],
    where: {
      organizationId,
      projectId: projectIds !== undefined ? { in: projectIds } : { not: null }
    },
    _sum: { gross: true }
  });
  const payrollByProject = new Map(
    payroll.filter((row) => row.projectId).map((row) => [row.projectId!, Number(row._sum.gross ?? 0)])
  );

  return projects.map((project) => {
    const revenue = project.clientInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    const materialCost = project.materialIssues.reduce(
      (issueSum, issue) => issueSum + issue.items.reduce((lineSum, line) => lineSum + Number(line.lineTotal), 0),
      0
    );
    const subcontractorCost = project.vendorBills.reduce((sum, bill) => sum + Number(bill.amount), 0);
    const expenseCost = project.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const laborCost = payrollByProject.get(project.id) ?? 0;
    const actualCost = materialCost + subcontractorCost + laborCost + expenseCost;
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      budget: Number(project.budget),
      revenue,
      materialCost,
      subcontractorCost,
      laborCost,
      expenseCost,
      actualCost,
      grossProfit: revenue - actualCost,
      margin: revenue ? ((revenue - actualCost) / revenue) * 100 : 0
    };
  });
}

export async function getBalanceSheet(organizationId: string) {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { organizationId, posted: true }
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { code: true, name: true, type: true } }
    }
  });
  const grouped = new Map<string, { code: string; name: string; type: string; balance: number }>();
  for (const line of lines) {
    const key = line.account.code;
    const existing = grouped.get(key) ?? {
      code: line.account.code,
      name: line.account.name,
      type: line.account.type,
      balance: 0
    };
    const debitNormal = line.account.type === "ASSET" || line.account.type === "EXPENSE";
    existing.balance += debitNormal
      ? Number(line.debit) - Number(line.credit)
      : Number(line.credit) - Number(line.debit);
    grouped.set(key, existing);
  }
  const accounts = Array.from(grouped.values()).filter((account) => Math.abs(account.balance) > 0.005);
  const revenue = accounts.filter((a) => a.type === "REVENUE").reduce((sum, a) => sum + a.balance, 0);
  const expenses = accounts.filter((a) => a.type === "EXPENSE").reduce((sum, a) => sum + a.balance, 0);
  const currentEarnings = revenue - expenses;
  return {
    assets: accounts.filter((a) => a.type === "ASSET"),
    liabilities: accounts.filter((a) => a.type === "LIABILITY"),
    equity: accounts.filter((a) => a.type === "EQUITY"),
    totalAssets: accounts.filter((a) => a.type === "ASSET").reduce((sum, a) => sum + a.balance, 0),
    totalLiabilities: accounts.filter((a) => a.type === "LIABILITY").reduce((sum, a) => sum + a.balance, 0),
    totalEquity: accounts.filter((a) => a.type === "EQUITY").reduce((sum, a) => sum + a.balance, 0) + currentEarnings,
    currentEarnings,
    revenue,
    expenses
  };
}
