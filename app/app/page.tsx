import Link from "next/link";
import { endOfWeek, startOfDay } from "date-fns";
import { ArrowRight, Building2, CircleAlert, IndianRupee, ReceiptIndianRupee, WalletCards } from "lucide-react";
import { InvoiceStatus, ProjectStatus } from "@prisma/client";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProjectFinancials } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cn, money, shortDate } from "@/lib/utils";

const activeInvoiceStatuses: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const session = await requireSession("dashboard:view");
  const now = new Date();
  const [activeProjects, contracts, overdueInvoices, dueBills, financials] = await Promise.all([
    prisma.project.count({ where: { organizationId: session.organizationId, status: ProjectStatus.ACTIVE } }),
    prisma.projectContract.aggregate({
      where: { organizationId: session.organizationId },
      _sum: { contractValue: true }
    }),
    prisma.clientInvoice.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: activeInvoiceStatuses },
        dueDate: { lt: startOfDay(now) }
      },
      include: { project: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5
    }),
    prisma.vendorBill.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lte: endOfWeek(now, { weekStartsOn: 1 }) }
      },
      include: {
        vendor: { select: { name: true } },
        subcontractor: { select: { name: true } }
      },
      orderBy: { dueDate: "asc" },
      take: 5
    }),
    getProjectFinancials(session.organizationId)
  ]);

  const totalOutstanding = overdueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.totalAmount) - Number(invoice.paidAmount),
    0
  );
  const payablesDue = dueBills.reduce(
    (sum, bill) => sum + Number(bill.amount) - Number(bill.paidAmount),
    0
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Organization overview"
        title={`Good to see you, ${session.user.name?.split(" ")[0] ?? "there"}`}
        description="Live operational and financial signals from your construction workspace."
        action={
          <Link href="/app/projects/new" className={cn(buttonVariants(), "w-fit")}>
            New project
          </Link>
        }
      />
      <AlertMessage error={searchParams.error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active projects", value: activeProjects.toString(), icon: Building2, meta: `${financials.length} total projects` },
          { label: "Total contract value", value: money(contracts._sum.contractValue ?? 0, session.currency), icon: IndianRupee, meta: "Across signed contracts" },
          { label: "Overdue receivables", value: money(totalOutstanding, session.currency), icon: CircleAlert, meta: `${overdueInvoices.length} overdue invoices` },
          { label: "Payables due this week", value: money(payablesDue, session.currency), icon: WalletCards, meta: `${dueBills.length} bills due` }
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
                <p className="mt-5 text-2xl font-bold tracking-tight">{metric.value}</p>
                <p className="mt-1 text-sm font-medium">{metric.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.meta}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Budget vs actual spend</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Materials consumed, subcontractor bills, payroll and direct expenses.</p>
          </div>
          <Link href="/app/finance" className="text-sm font-semibold text-primary">View P&amp;L</Link>
        </CardHeader>
        <CardContent>
          {financials.length ? (
            <div className="space-y-5">
              {financials.slice(0, 6).map((project) => {
                const percent = project.budget ? Math.min((project.actualCost / project.budget) * 100, 100) : 0;
                return (
                  <div key={project.id}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <Link href={`/app/projects/${project.id}`} className="text-sm font-semibold hover:text-primary">{project.name}</Link>
                        <p className="text-xs text-muted-foreground">{project.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{money(project.actualCost, session.currency)}</p>
                        <p className="text-xs text-muted-foreground">of {money(project.budget, session.currency)}</p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${percent > 90 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Building2} title="No projects yet" description="Create your first project to start tracking contracts, costs and profitability." />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Overdue client payments</CardTitle>
            <ReceiptIndianRupee className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overdueInvoices.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Project</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {overdueInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.project.name}</TableCell>
                      <TableCell><Badge variant="destructive">{shortDate(invoice.dueDate)}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{money(Number(invoice.totalAmount) - Number(invoice.paidAmount), session.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState icon={ReceiptIndianRupee} title="Nothing overdue" description="Outstanding client invoices will appear here when they pass their due date." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Payments due this week</CardTitle>
            <WalletCards className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dueBills.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Payee</TableHead><TableHead>Bill</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dueBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.vendor?.name ?? bill.subcontractor?.name ?? "Other"}</TableCell>
                      <TableCell>{bill.billNumber}</TableCell>
                      <TableCell>{shortDate(bill.dueDate)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(Number(bill.amount) - Number(bill.paidAmount), session.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState icon={WalletCards} title="No payments due" description="Approved vendor and subcontractor bills due this week will appear here." />
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex justify-end">
        <Link href="/app/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          Open project portfolio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
