import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, CreditCard, IndianRupee } from "lucide-react";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/subscription";
import { cn, enumLabel, money, shortDate } from "@/lib/utils";

export const metadata = { title: "Bizavo Control" };

export default async function ControlPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const search = query.q?.trim();
  const [organizations, pendingRequests, unpaidInvoices] = await Promise.all([
    prisma.organization.findMany({
      where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : undefined,
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { memberships: true, projects: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.subscriptionRequest.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.subscriptionInvoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
      select: { totalAmount: true, paidAmount: true, dueDate: true }
    })
  ]);
  const allOrganizations = search
    ? await prisma.organization.findMany({ include: { subscription: { include: { plan: true } } } })
    : organizations;
  const mrr = allOrganizations.reduce((sum, organization) => {
    const subscription = organization.subscription;
    if (!subscription || !["TRIAL", "ACTIVE", "PAST_DUE"].includes(subscription.status)) return sum;
    if (subscription.billingCycle === "ANNUAL") return sum + Number(subscription.plan.annualPrice) / 12;
    if (subscription.billingCycle === "MONTHLY") return sum + Number(subscription.plan.monthlyPrice);
    return sum;
  }, 0);
  const outstanding = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount) - Number(invoice.paidAmount), 0);
  const overdue = unpaidInvoices.filter((invoice) => invoice.dueDate < new Date()).length;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Platform operations" title="Bizavo control center" description="Manage every customer workspace, subscription, module entitlement, invoice and recorded payment from one database-backed console." />
      <AlertMessage error={query.error} success={query.success} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organizations</p><Building2 className="h-5 w-5 text-primary" /></div><p className="mt-2 text-3xl font-bold">{allOrganizations.length}</p><p className="mt-1 text-xs text-muted-foreground">{allOrganizations.filter((org) => org.status === "ACTIVE").length} active</p></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimated MRR</p><IndianRupee className="h-5 w-5 text-emerald-600" /></div><p className="mt-2 text-3xl font-bold">{money(mrr)}</p><p className="mt-1 text-xs text-muted-foreground">Annual plans normalized monthly</p></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding</p><CreditCard className="h-5 w-5 text-amber-600" /></div><p className="mt-2 text-3xl font-bold">{money(outstanding)}</p><p className="mt-1 text-xs text-muted-foreground">{overdue} overdue invoice{overdue === 1 ? "" : "s"}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open requests</p><CalendarClock className="h-5 w-5 text-cyan-600" /></div><p className="mt-2 text-3xl font-bold">{pendingRequests}</p><p className="mt-1 text-xs text-muted-foreground">Plan, cancel or reactivate</p></CardContent></Card>
      </section>

      <section id="organizations" className="space-y-4 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-bold">Organizations</h2><p className="text-sm text-muted-foreground">Live workspace usage and commercial status.</p></div>
          <form className="flex gap-2"><Input name="q" defaultValue={search} placeholder="Search company or slug" className="w-64" /><button className={buttonVariants({ variant: "outline" })}>Search</button></form>
        </div>
        <Card>
          <CardContent className="pt-5">
            {organizations.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Workspace</TableHead><TableHead>Plan</TableHead><TableHead>Subscription</TableHead><TableHead>Renewal</TableHead><TableHead>Usage</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {organizations.map((organization) => (
                    <TableRow key={organization.id}>
                      <TableCell><p className="font-semibold">{organization.name}</p><p className="text-xs text-muted-foreground">{enumLabel(organization.industry)}</p></TableCell>
                      <TableCell><Badge variant={organization.status === "ACTIVE" ? "success" : "destructive"}>{enumLabel(organization.status)}</Badge></TableCell>
                      <TableCell>{organization.subscription?.plan.name ?? "Unassigned"}</TableCell>
                      <TableCell><Badge variant={organization.subscription?.status === "ACTIVE" ? "success" : organization.subscription?.status === "PAST_DUE" ? "warning" : "secondary"}>{organization.subscription ? enumLabel(organization.subscription.status) : "None"}</Badge></TableCell>
                      <TableCell>{shortDate(organization.subscription?.currentPeriodEnd)}</TableCell>
                      <TableCell>{organization._count.memberships} users · {organization._count.projects} projects</TableCell>
                      <TableCell><Link href={`/control/organizations/${organization.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Manage</Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyState icon={AlertTriangle} title="No organizations found" description={search ? "Try a different search." : "New Bizavo workspaces will appear here."} />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
