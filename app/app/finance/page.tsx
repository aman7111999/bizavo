import Link from "next/link";
import { Landmark, ReceiptIndianRupee, Scale, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { createExpense, issueClientInvoice, recordClientPayment, recordVendorPayment } from "@/app/app/finance/actions";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBalanceSheet, getProjectFinancials } from "@/lib/finance";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cn, enumLabel, money, number, shortDate } from "@/lib/utils";

export const metadata = { title: "Finance" };

export default async function FinancePage({
  searchParams
}: {
  searchParams: { error?: string; success?: string; view?: string };
}) {
  const session = await requireSession("finance:view");
  const [financials, balanceSheet, invoices, bills, expenses, accounts, projects, journals] = await Promise.all([
    getProjectFinancials(session.organizationId),
    getBalanceSheet(session.organizationId),
    prisma.clientInvoice.findMany({
      where: { organizationId: session.organizationId },
      include: { project: { select: { name: true, code: true } }, milestone: { select: { name: true } } },
      orderBy: { issueDate: "desc" }
    }),
    prisma.vendorBill.findMany({
      where: { organizationId: session.organizationId },
      include: {
        project: { select: { name: true, code: true } },
        vendor: { select: { name: true } },
        subcontractor: { select: { name: true } }
      },
      orderBy: { billDate: "desc" }
    }),
    prisma.expense.findMany({
      where: { organizationId: session.organizationId },
      include: { project: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
      take: 100
    }),
    prisma.chartAccount.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { code: "asc" } }),
    prisma.project.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.journalEntry.findMany({
      where: { organizationId: session.organizationId },
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 50
    })
  ]);
  const view = searchParams.view ?? "overview";
  const manage = can(session.role, "finance:manage");
  const receivables = invoices.filter((invoice) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.totalAmount) - Number(invoice.paidAmount), 0);
  const payables = bills.filter((bill) => ["OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(bill.status)).reduce((sum, bill) => sum + Number(bill.amount) - Number(bill.paidAmount), 0);

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Accounting backbone" title="Finance" description="Construction revenue, project costs, receivables, payables and double-entry financial statements." />
      <AlertMessage error={searchParams.error} success={searchParams.success} />
      <div className="flex flex-wrap gap-2">{[["overview", "Overview"], ["projects", "Project P&L"], ["invoices", "Client invoices"], ["payables", "Payables"], ["expenses", "Expenses"], ["ledger", "Ledger & accounts"]].map(([value, label]) => <Link key={value} href={`/app/finance?view=${value}`} className={buttonVariants({ variant: view === value ? "default" : "outline", size: "sm" })}>{label}</Link>)}</div>

      {view === "overview" ? (
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="p-5"><TrendingUp className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-2xl font-bold">{money(balanceSheet.revenue, session.currency)}</p><p className="text-xs text-muted-foreground">Recognized revenue</p></CardContent></Card>
            <Card><CardContent className="p-5"><TrendingDown className="h-5 w-5 text-amber-600" /><p className="mt-4 text-2xl font-bold">{money(balanceSheet.expenses, session.currency)}</p><p className="text-xs text-muted-foreground">Total posted expenses</p></CardContent></Card>
            <Card><CardContent className="p-5"><ReceiptIndianRupee className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-bold">{money(receivables, session.currency)}</p><p className="text-xs text-muted-foreground">Accounts receivable</p></CardContent></Card>
            <Card><CardContent className="p-5"><WalletCards className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-bold">{money(payables, session.currency)}</p><p className="text-xs text-muted-foreground">Accounts payable</p></CardContent></Card>
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Overall profit & loss</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between rounded-lg bg-slate-50 p-3"><span>Construction revenue</span><span className="font-semibold">{money(balanceSheet.revenue, session.currency)}</span></div><div className="flex justify-between rounded-lg bg-slate-50 p-3"><span>Total expenses</span><span className="font-semibold text-amber-700">({money(balanceSheet.expenses, session.currency)})</span></div><div className="flex justify-between border-t pt-4 text-lg font-bold"><span>Net profit</span><span className={balanceSheet.currentEarnings >= 0 ? "text-emerald-700" : "text-red-700"}>{money(balanceSheet.currentEarnings, session.currency)}</span></div></CardContent></Card>
            <Card><CardHeader><CardTitle>Balance sheet</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between rounded-lg bg-slate-50 p-3"><span>Total assets</span><span className="font-semibold">{money(balanceSheet.totalAssets, session.currency)}</span></div><div className="flex justify-between rounded-lg bg-slate-50 p-3"><span>Total liabilities</span><span className="font-semibold">{money(balanceSheet.totalLiabilities, session.currency)}</span></div><div className="flex justify-between rounded-lg bg-slate-50 p-3"><span>Equity incl. current earnings</span><span className="font-semibold">{money(balanceSheet.totalEquity, session.currency)}</span></div><div className="flex items-center justify-between border-t pt-4 text-sm"><span className="flex items-center gap-2 font-semibold"><Scale className="h-4 w-4 text-primary" />Balance check</span><span className={Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilities - balanceSheet.totalEquity) < 1 ? "text-emerald-700" : "text-red-700"}>{money(balanceSheet.totalAssets - balanceSheet.totalLiabilities - balanceSheet.totalEquity, session.currency)}</span></div></CardContent></Card>
          </section>
        </div>
      ) : null}

      {view === "projects" ? (
        <Card><CardHeader><CardTitle>Project-wise profitability</CardTitle><p className="text-sm text-muted-foreground">Revenue from issued milestone invoices versus consumed materials, subcontractor bills, payroll and direct expenses.</p></CardHeader><CardContent>{financials.length ? <Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Budget</TableHead><TableHead>Revenue</TableHead><TableHead>Materials</TableHead><TableHead>Subcontractors</TableHead><TableHead>Labour</TableHead><TableHead>Other</TableHead><TableHead className="text-right">Profit / margin</TableHead></TableRow></TableHeader><TableBody>{financials.map((project) => <TableRow key={project.id}><TableCell><Link href={`/app/projects/${project.id}`} className="font-semibold text-primary">{project.name}</Link><p className="text-xs text-muted-foreground">{project.code}</p></TableCell><TableCell>{money(project.budget, session.currency)}</TableCell><TableCell>{money(project.revenue, session.currency)}</TableCell><TableCell>{money(project.materialCost, session.currency)}</TableCell><TableCell>{money(project.subcontractorCost, session.currency)}</TableCell><TableCell>{money(project.laborCost, session.currency)}</TableCell><TableCell>{money(project.expenseCost, session.currency)}</TableCell><TableCell className="text-right"><p className={cn("font-semibold", project.grossProfit >= 0 ? "text-emerald-700" : "text-red-700")}>{money(project.grossProfit, session.currency)}</p><p className="text-xs text-muted-foreground">{number(project.margin, 1)}%</p></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={Landmark} title="No project financial activity" description="Project P&L appears after milestone invoices and project costs are recorded." />}</CardContent></Card>
      ) : null}

      {view === "invoices" ? (
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Client invoices</CardTitle></CardHeader><CardContent>{invoices.length ? <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Project / milestone</TableHead><TableHead>Issue / due</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead><TableHead /></TableRow></TableHeader><TableBody>{invoices.map((invoice) => { const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount); return <TableRow key={invoice.id}><TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell><TableCell><p>{invoice.project.name}</p><p className="text-xs text-muted-foreground">{invoice.milestone?.name ?? "Manual invoice"}</p></TableCell><TableCell><p>{shortDate(invoice.issueDate)}</p><p className="text-xs text-muted-foreground">Due {shortDate(invoice.dueDate)}</p></TableCell><TableCell><Badge variant={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "destructive" : invoice.status === "DRAFT" ? "secondary" : "warning"}>{enumLabel(invoice.status)}</Badge></TableCell><TableCell>{money(invoice.totalAmount, session.currency)}</TableCell><TableCell className="font-semibold">{money(balance, session.currency)}</TableCell><TableCell>{manage && invoice.status === "DRAFT" ? <details><summary className="cursor-pointer text-xs font-semibold text-primary">Issue</summary><form action={issueClientInvoice} className="mt-2 grid w-56 gap-2"><input type="hidden" name="invoiceId" value={invoice.id} /><Input name="issueDate" type="date" defaultValue={invoice.issueDate.toISOString().slice(0, 10)} /><Input name="dueDate" type="date" defaultValue={invoice.dueDate.toISOString().slice(0, 10)} /><Input name="taxAmount" type="number" min="0" step="0.01" defaultValue={Number(invoice.taxAmount)} placeholder="Tax amount" /><Button type="submit" size="sm">Issue invoice</Button></form></details> : manage && balance > 0 && invoice.status !== "VOID" ? <details><summary className="cursor-pointer text-xs font-semibold text-primary">Record payment</summary><form action={recordClientPayment} className="mt-2 grid w-56 gap-2"><input type="hidden" name="invoiceId" value={invoice.id} /><Input name="amount" type="number" min="0.01" max={balance} step="0.01" placeholder={`Max ${balance}`} required /><Input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /><Select name="method"><option>Bank transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option></Select><Input name="reference" placeholder="Reference" /><Button type="submit" size="sm">Save payment</Button></form></details> : null}</TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={ReceiptIndianRupee} title="No client invoices" description="Completing project milestones creates draft invoices here." />}</CardContent></Card>
        </div>
      ) : null}

      {view === "payables" ? (
        <Card><CardHeader><CardTitle>Vendor and subcontractor payables</CardTitle></CardHeader><CardContent>{bills.length ? <Table><TableHeader><TableRow><TableHead>Bill</TableHead><TableHead>Payee</TableHead><TableHead>Project</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>Balance</TableHead><TableHead /></TableRow></TableHeader><TableBody>{bills.map((bill) => { const balance = Number(bill.amount) - Number(bill.paidAmount); return <TableRow key={bill.id}><TableCell><p className="font-semibold">{bill.billNumber}</p><p className="text-xs text-muted-foreground">{shortDate(bill.billDate)}</p></TableCell><TableCell>{bill.vendor?.name ?? bill.subcontractor?.name ?? "Other"}</TableCell><TableCell><p>{bill.project.name}</p><p className="text-xs text-muted-foreground">{bill.project.code}</p></TableCell><TableCell>{shortDate(bill.dueDate)}</TableCell><TableCell><Badge variant={bill.status === "PAID" ? "success" : bill.status === "OVERDUE" ? "destructive" : "warning"}>{enumLabel(bill.status)}</Badge></TableCell><TableCell>{money(bill.amount, session.currency)}</TableCell><TableCell className="font-semibold">{money(balance, session.currency)}</TableCell><TableCell>{manage && balance > 0 && bill.status !== "VOID" ? <details><summary className="cursor-pointer text-xs font-semibold text-primary">Pay</summary><form action={recordVendorPayment} className="mt-2 grid w-56 gap-2"><input type="hidden" name="billId" value={bill.id} /><Input name="amount" type="number" min="0.01" max={balance} step="0.01" required /><Input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /><Select name="method"><option>Bank transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option></Select><Input name="reference" placeholder="Reference" /><Button type="submit" size="sm">Record payment</Button></form></details> : null}</TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={WalletCards} title="No payables" description="Goods receipts and subcontractor bills create payable records automatically." />}</CardContent></Card>
      ) : null}

      {view === "expenses" ? (
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Direct expenses</CardTitle></CardHeader><CardContent>{expenses.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead>Project</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{expenses.map((expense) => <TableRow key={expense.id}><TableCell>{shortDate(expense.expenseDate)}</TableCell><TableCell className="font-medium">{expense.description}</TableCell><TableCell>{expense.vendorName ?? "—"}</TableCell><TableCell>{expense.project?.name ?? "Organization"}</TableCell><TableCell>{expense.paymentMethod}</TableCell><TableCell className="text-right font-semibold">{money(expense.amount, session.currency)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={TrendingDown} title="No direct expenses" description="Record site or administrative expenses not already captured through inventory or subcontractor billing." />}</CardContent></Card>
          {manage ? <Card><CardHeader><CardTitle>Record expense</CardTitle></CardHeader><CardContent><form action={createExpense} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Expense date"><Input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><FormField label="Expense account"><Select name="accountId" required><option value="">Select account</option>{accounts.filter((account) => account.type === "EXPENSE").map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</Select></FormField><FormField label="Project"><Select name="projectId"><option value="">Organization-wide</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></FormField><FormField label="Amount"><Input name="amount" type="number" min="0.01" step="0.01" required /></FormField><FormField label="Description"><Input name="description" required /></FormField><FormField label="Vendor / payee"><Input name="vendorName" /></FormField><FormField label="Payment method"><Select name="paymentMethod"><option>Bank transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option><option>Corporate card</option></Select></FormField><FormField label="Reference"><Input name="reference" /></FormField><div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Record expense</Button></div></form></CardContent></Card> : null}
        </div>
      ) : null}

      {view === "ledger" ? (
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Chart of accounts</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{accounts.map((account) => <div key={account.id} className="rounded-lg border p-3"><div className="flex items-center justify-between"><p className="text-xs font-bold text-primary">{account.code}</p>{account.system ? <Badge variant="secondary">System</Badge> : null}</div><p className="mt-2 text-sm font-semibold">{account.name}</p><p className="mt-1 text-xs text-muted-foreground">{enumLabel(account.type)}</p></div>)}</div></CardContent></Card>
          <Card><CardHeader><CardTitle>Journal entries</CardTitle><p className="text-sm text-muted-foreground">Every posted business transaction remains balanced and traceable to its source.</p></CardHeader><CardContent>{journals.length ? <div className="space-y-3">{journals.map((journal) => <details key={journal.id} className="rounded-xl border p-4"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{journal.entryNumber} · {journal.description}</p><p className="mt-1 text-xs text-muted-foreground">{shortDate(journal.entryDate)} · {enumLabel(journal.source)}</p></div><p className="font-semibold">{money(journal.lines.reduce((sum, line) => sum + Number(line.debit), 0), session.currency)}</p></div></summary><Table className="mt-4"><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{journal.lines.map((line) => <TableRow key={line.id}><TableCell>{line.account.code} · {line.account.name}</TableCell><TableCell>{line.description ?? "—"}</TableCell><TableCell className="text-right">{Number(line.debit) ? money(line.debit, session.currency) : "—"}</TableCell><TableCell className="text-right">{Number(line.credit) ? money(line.credit, session.currency) : "—"}</TableCell></TableRow>)}</TableBody></Table></details>)}</div> : <EmptyState icon={Landmark} title="No journal entries" description="Operational transactions post balanced journal entries automatically." />}</CardContent></Card>
        </div>
      ) : null}
    </div>
  );
}
