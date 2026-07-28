import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformRole } from "@prisma/client";
import { ArrowLeft, Building2, CreditCard, FileClock, HardDrive, Layers3, ReceiptIndianRupee, UsersRound } from "lucide-react";
import {
  clearModuleOverride,
  createSubscriptionInvoice,
  recordSubscriptionPayment,
  resolveSubscriptionRequest,
  setModuleOverride,
  setOrganizationStatus,
  updateOrganizationSubscription
} from "@/app/control/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { controllableModules, getOrganizationUsage, requirePlatformAdmin } from "@/lib/subscription";
import { cn, enumLabel, money, number, shortDate } from "@/lib/utils";

export const metadata = { title: "Manage organization" };

const inputDate = (value?: Date | null) => value ? value.toISOString().slice(0, 10) : "";

export default async function OrganizationControlPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { role } = await requirePlatformAdmin();
  const { id } = await params;
  const query = await searchParams;
  const [organization, plans, usage] = await Promise.all([
    prisma.organization.findUnique({
      where: { id },
      include: {
        billingProfile: true,
        moduleOverrides: true,
        memberships: { where: { role: "OWNER" }, include: { user: { select: { name: true, email: true } } }, take: 1 },
        subscription: {
          include: {
            plan: true,
            invoices: {
              include: { payments: { orderBy: { paymentDate: "desc" } } },
              orderBy: { issueDate: "desc" }
            }
          }
        },
        subscriptionRequests: {
          include: { requestedPlan: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20
        },
        platformAuditLogs: { orderBy: { createdAt: "desc" }, take: 30 }
      }
    }),
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { monthlyPrice: "asc" } }),
    getOrganizationUsage(id)
  ]);
  if (!organization) notFound();
  const auditActors = await prisma.user.findMany({
    where: { id: { in: [...new Set(organization.platformAuditLogs.map((log) => log.actorUserId))] } },
    select: { id: true, name: true, email: true }
  });
  const auditActorMap = new Map(auditActors.map((actor) => [actor.id, actor]));
  const subscription = organization.subscription;
  const planModules = new Set(
    Array.isArray(subscription?.plan.modules)
      ? subscription.plan.modules.filter((value): value is string => typeof value === "string")
      : []
  );
  const overrideMap = new Map(organization.moduleOverrides.map((override) => [override.moduleKey, override]));
  const canControl = role === PlatformRole.SUPER_ADMIN;
  const canBill = canControl || role === PlatformRole.BILLING;
  const storageMb = usage.storageBytes / 1024 / 1024;
  const openInvoices = subscription?.invoices.filter((invoice) => invoice.status !== "PAID" && invoice.status !== "VOID") ?? [];

  return (
    <div className="space-y-7">
      <Link href="/control" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-3")}><ArrowLeft className="h-4 w-4" />Back to control center</Link>
      <PageHeader eyebrow="Organization control" title={organization.name} description={`/${organization.slug} · ${enumLabel(organization.industry)} · created ${shortDate(organization.createdAt)}`} />
      <AlertMessage error={query.error} success={query.success} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="pt-5"><Building2 className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Workspace status</p><div className="mt-1"><Badge variant={organization.status === "ACTIVE" ? "success" : "destructive"}>{enumLabel(organization.status)}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-5"><CreditCard className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Plan</p><p className="mt-1 font-bold">{subscription?.plan.name ?? "Unassigned"}</p><p className="text-xs text-muted-foreground">{subscription ? enumLabel(subscription.status) : "No subscription"}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><UsersRound className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Users</p><p className="mt-1 text-xl font-bold">{usage.users}<span className="text-sm text-muted-foreground"> / {subscription?.plan.maxUsers ?? "—"}</span></p></CardContent></Card>
        <Card><CardContent className="pt-5"><Layers3 className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Projects</p><p className="mt-1 text-xl font-bold">{usage.projects}<span className="text-sm text-muted-foreground"> / {subscription?.plan.maxProjects ?? "—"}</span></p></CardContent></Card>
        <Card><CardContent className="pt-5"><HardDrive className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Documents</p><p className="mt-1 text-xl font-bold">{number(storageMb, 1)} MB</p><p className="text-xs text-muted-foreground">{subscription ? `${number(subscription.plan.maxStorageMb / 1024, 0)} GB limit` : "No plan limit"}</p></CardContent></Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Subscription assignment</CardTitle><p className="text-sm text-muted-foreground">The selected plan controls limits and base module access. All dates are saved as billing period data.</p></CardHeader>
          <CardContent>
            {canBill ? (
              <form action={updateOrganizationSubscription} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={organization.id} />
                <FormField label="Plan"><Select name="planId" defaultValue={subscription?.planId} required><option value="">Select plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.monthlyPrice, plan.currency)}/month</option>)}</Select></FormField>
                <FormField label="Status"><Select name="status" defaultValue={subscription?.status ?? "TRIAL"}><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="PAST_DUE">Past due</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option></Select></FormField>
                <FormField label="Billing cycle"><Select name="billingCycle" defaultValue={subscription?.billingCycle ?? "MONTHLY"}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option><option value="MANUAL">Manual / custom</option></Select></FormField>
                <FormField label="Trial ends"><Input name="trialEndsAt" type="date" defaultValue={inputDate(subscription?.trialEndsAt)} /></FormField>
                <FormField label="Period starts"><Input name="currentPeriodStart" type="date" defaultValue={inputDate(subscription?.currentPeriodStart) || inputDate(new Date())} required /></FormField>
                <FormField label="Period ends"><Input name="currentPeriodEnd" type="date" defaultValue={inputDate(subscription?.currentPeriodEnd)} required /></FormField>
                <FormField label="Internal notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={subscription?.notes ?? ""} rows={2} /></FormField>
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="cancelAtPeriodEnd" defaultChecked={subscription?.cancelAtPeriodEnd} />Cancel at period end</label>
                <div className="flex justify-end"><Button type="submit">Save subscription</Button></div>
              </form>
            ) : <p className="text-sm text-muted-foreground">Support access is read-only for subscription terms.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Workspace control</CardTitle><p className="text-sm text-muted-foreground">Suspension blocks every tenant route server-side. Data is retained and the public page remains available.</p></CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold">Owner</p><p className="mt-1 text-muted-foreground">{organization.memberships[0]?.user.name ?? "No owner"} · {organization.memberships[0]?.user.email ?? "No email"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold">Billing profile</p><p className="mt-1 text-muted-foreground">{organization.billingProfile?.legalName ?? "Not configured"}<br/>{organization.billingProfile?.billingEmail ?? "No billing email"}<br/>{organization.billingProfile?.taxId ?? "No tax ID"}</p></div>
            {canControl ? (
              <form action={setOrganizationStatus} className="grid gap-3">
                <input type="hidden" name="organizationId" value={organization.id} />
                <FormField label="Workspace status"><Select name="status" defaultValue={organization.status}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="ARCHIVED">Archived</option></Select></FormField>
                <FormField label="Reason" hint="Required for suspension or archive"><Textarea name="reason" rows={2} defaultValue={organization.suspensionReason ?? ""} /></FormField>
                <Button type="submit" variant={organization.status === "ACTIVE" ? "destructive" : "default"}>Apply workspace status</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Module controls</CardTitle><p className="text-sm text-muted-foreground">Plan defaults are shown first. A per-company override takes effect immediately in navigation and server-side permission checks.</p></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {controllableModules.map((module) => {
              const override = overrideMap.get(module.key);
              const included = override ? override.enabled : planModules.has(module.key);
              return (
                <div key={module.key} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{module.label}</p><p className="mt-1 text-xs text-muted-foreground">{module.description}</p></div><Badge variant={included ? "success" : "secondary"}>{included ? "Enabled" : "Disabled"}</Badge></div>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{override ? "Organization override" : "Plan default"}</p>
                  {canControl ? <div className="mt-3 flex flex-wrap gap-2"><form action={setModuleOverride}><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="moduleKey" value={module.key} /><input type="hidden" name="enabled" value={included ? "false" : "true"} /><Button type="submit" size="sm" variant="outline">{included ? "Disable" : "Enable"}</Button></form>{override ? <form action={clearModuleOverride}><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="moduleKey" value={module.key} /><Button type="submit" size="sm" variant="ghost">Reset to plan</Button></form> : null}</div> : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Issue subscription invoice</CardTitle><p className="text-sm text-muted-foreground">This creates a Bizavo SaaS receivable, not a construction client invoice.</p></CardHeader>
          <CardContent>
            {canBill ? (
              <form action={createSubscriptionInvoice} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={organization.id} />
                <FormField label="Invoice number"><Input name="invoiceNumber" placeholder="BIZ-2026-0002" required /></FormField>
                <FormField label="Issue date"><Input name="issueDate" type="date" defaultValue={inputDate(new Date())} required /></FormField>
                <FormField label="Due date"><Input name="dueDate" type="date" required /></FormField>
                <FormField label="Subtotal"><Input name="subtotal" type="number" step="0.01" min={0} defaultValue={subscription?.billingCycle === "ANNUAL" ? String(subscription.plan.annualPrice) : subscription ? String(subscription.plan.monthlyPrice) : ""} required /></FormField>
                <FormField label="Tax amount"><Input name="taxAmount" type="number" step="0.01" min={0} defaultValue={0} required /></FormField>
                <FormField label="Notes" className="sm:col-span-2"><Input name="notes" placeholder="Plan and billing period" /></FormField>
                <div className="sm:col-span-2"><Button type="submit">Issue invoice</Button></div>
              </form>
            ) : <p className="text-sm text-muted-foreground">Billing or Super Admin access is required.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Record payment</CardTitle><p className="text-sm text-muted-foreground">Manual bank, UPI, cash or cheque receipts are posted against an open subscription invoice with overpayment protection.</p></CardHeader>
          <CardContent>
            {canBill && openInvoices.length ? (
              <form action={recordSubscriptionPayment} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={organization.id} />
                <FormField label="Open invoice" className="sm:col-span-2"><Select name="invoiceId" required><option value="">Select invoice</option>{openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · balance {money(Number(invoice.totalAmount) - Number(invoice.paidAmount), organization.currency)}</option>)}</Select></FormField>
                <FormField label="Payment date"><Input name="paymentDate" type="date" defaultValue={inputDate(new Date())} required /></FormField>
                <FormField label="Amount"><Input name="amount" type="number" min={0.01} step="0.01" required /></FormField>
                <FormField label="Method"><Select name="method"><option value="Bank transfer">Bank transfer</option><option value="UPI">UPI</option><option value="Cheque">Cheque</option><option value="Cash">Cash</option><option value="Payment gateway">Payment gateway</option></Select></FormField>
                <FormField label="Reference"><Input name="reference" placeholder="UTR / transaction ID" /></FormField>
                <FormField label="Notes" className="sm:col-span-2"><Input name="notes" /></FormField>
                <div className="sm:col-span-2"><Button type="submit">Record payment</Button></div>
              </form>
            ) : <EmptyState icon={ReceiptIndianRupee} title="No invoice ready for payment" description={canBill ? "Issue an invoice first, or all invoices are already paid." : "Billing or Super Admin access is required."} />}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Invoice & payment register</CardTitle></CardHeader>
        <CardContent>
          {subscription?.invoices.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Issue / due</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Paid / balance</TableHead><TableHead>Payments</TableHead></TableRow></TableHeader>
              <TableBody>
                {subscription.invoices.map((invoice) => {
                  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
                  const overdue = balance > 0 && invoice.dueDate < new Date();
                  return <TableRow key={invoice.id}><TableCell><p className="font-semibold">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">{invoice.notes ?? "Subscription invoice"}</p></TableCell><TableCell>{shortDate(invoice.issueDate)}<br/><span className="text-xs text-muted-foreground">Due {shortDate(invoice.dueDate)}</span></TableCell><TableCell><Badge variant={invoice.status === "PAID" ? "success" : overdue ? "destructive" : "secondary"}>{overdue ? "Overdue" : enumLabel(invoice.status)}</Badge></TableCell><TableCell>{money(invoice.totalAmount, organization.currency)}</TableCell><TableCell>{money(invoice.paidAmount, organization.currency)}<br/><span className="text-xs text-muted-foreground">Balance {money(balance, organization.currency)}</span></TableCell><TableCell>{invoice.payments.length ? <div className="space-y-1">{invoice.payments.map((payment) => <p key={payment.id} className="text-xs"><span className="font-semibold">{money(payment.amount, organization.currency)}</span> · {shortDate(payment.paymentDate)} · {payment.method}<br/><span className="text-muted-foreground">{payment.reference ?? "No reference"}</span></p>)}</div> : "—"}</TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          ) : <EmptyState icon={CreditCard} title="No subscription invoices" description="Issued invoices and their payment allocations will appear here." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Customer requests</CardTitle><p className="text-sm text-muted-foreground">Completing a request applies the saved plan change, cancellation flag or reactivation in the same database transaction.</p></CardHeader>
        <CardContent>
          {organization.subscriptionRequests.length ? <div className="space-y-3">{organization.subscriptionRequests.map((request) => <div key={request.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{enumLabel(request.type)}{request.requestedPlan ? ` · ${request.requestedPlan.name}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{shortDate(request.createdAt)} · {request.notes ?? "No customer note"}</p></div><Badge variant={request.status === "COMPLETED" ? "success" : request.status === "REJECTED" ? "destructive" : "secondary"}>{enumLabel(request.status)}</Badge></div>{canBill && ["PENDING", "APPROVED"].includes(request.status) ? <form action={resolveSubscriptionRequest} className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="requestId" value={request.id} /><FormField label="Resolution"><Select name="status" className="w-40"><option value="COMPLETED">Complete & apply</option><option value="REJECTED">Reject</option></Select></FormField><FormField label="Resolution note"><Input name="resolutionNote" className="w-72" /></FormField><Button type="submit" size="sm">Resolve request</Button></form> : request.resolutionNote ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{request.resolutionNote}</p> : null}</div>)}</div> : <EmptyState icon={FileClock} title="No customer requests" description="Plan changes, cancellation and reactivation requests will be listed here." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit trail</CardTitle><p className="text-sm text-muted-foreground">Recent subscription and control actions for this organization.</p></CardHeader>
        <CardContent>
          {organization.platformAuditLogs.length ? <div className="space-y-2">{organization.platformAuditLogs.map((log) => { const actor = auditActorMap.get(log.actorUserId); return <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"><div><p className="font-semibold">{enumLabel(log.action.replaceAll(".", "_"))}</p><p className="text-xs text-muted-foreground">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</p></div><div className="text-right text-xs text-muted-foreground"><p>{shortDate(log.createdAt)}</p><p>{actor?.name ?? actor?.email ?? log.actorUserId}</p></div></div>; })}</div> : <EmptyState icon={FileClock} title="No control activity yet" description="Plan, invoice, payment, module and workspace changes will be recorded here." />}
        </CardContent>
      </Card>
    </div>
  );
}
