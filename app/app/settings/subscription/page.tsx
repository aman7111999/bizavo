import { Boxes, CalendarClock, CheckCircle2, CreditCard, HardDrive, UsersRound } from "lucide-react";
import { createSubscriptionRequest, updateBillingProfile } from "@/app/app/settings/subscription/actions";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { controllableModules, getOrganizationUsage } from "@/lib/subscription";
import { enumLabel, money, number, shortDate } from "@/lib/utils";

export const metadata = { title: "Subscription & billing" };

function percent(used: number, limit: number) {
  return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
}

export default async function SubscriptionPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireSession("subscription:view");
  const query = await searchParams;
  const [organization, plans, usage] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      include: {
        billingProfile: true,
        moduleOverrides: true,
        subscription: {
          include: {
            plan: true,
            invoices: {
              include: { payments: { orderBy: { paymentDate: "desc" } } },
              orderBy: { issueDate: "desc" },
              take: 12
            }
          }
        },
        subscriptionRequests: {
          include: { requestedPlan: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 8
        }
      }
    }),
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { monthlyPrice: "asc" } }),
    getOrganizationUsage(session.organizationId)
  ]);
  if (!organization) return null;
  const subscription = organization.subscription;
  const baseModules = new Set(
    Array.isArray(subscription?.plan.modules)
      ? subscription.plan.modules.filter((value): value is string => typeof value === "string")
      : []
  );
  for (const override of organization.moduleOverrides) {
    if (override.enabled) baseModules.add(override.moduleKey);
    else baseModules.delete(override.moduleKey);
  }
  const canManage = can(session.role, "subscription:manage");
  const profile = organization.billingProfile;
  const storageMb = usage.storageBytes / 1024 / 1024;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace settings"
        title="Subscription & billing"
        description="Your plan, live usage, enabled modules, billing details and Bizavo subscription payments."
      />
      <AlertMessage error={query.error} success={query.success} />

      {subscription ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current plan</p><p className="mt-2 text-2xl font-bold">{subscription.plan.name}</p></div>
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-3 flex gap-2"><Badge>{enumLabel(subscription.status)}</Badge><Badge variant="secondary">{enumLabel(subscription.billingCycle)}</Badge></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team seats</p>
                <p className="mt-2 text-2xl font-bold">{usage.users} <span className="text-sm font-medium text-muted-foreground">/ {subscription.plan.maxUsers}</span></p>
                <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${percent(usage.users, subscription.plan.maxUsers)}%` }} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projects</p>
                <p className="mt-2 text-2xl font-bold">{usage.projects} <span className="text-sm font-medium text-muted-foreground">/ {subscription.plan.maxProjects}</span></p>
                <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-cyan-500" style={{ width: `${percent(usage.projects, subscription.plan.maxProjects)}%` }} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document storage</p>
                <p className="mt-2 text-2xl font-bold">{number(storageMb, 1)} MB <span className="text-sm font-medium text-muted-foreground">/ {number(subscription.plan.maxStorageMb / 1024, 0)} GB</span></p>
                <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percent(storageMb, subscription.plan.maxStorageMb)}%` }} /></div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <Card>
              <CardHeader><CardTitle>Plan details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4"><CalendarClock className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Current period</p><p className="mt-1 text-sm font-semibold">{shortDate(subscription.currentPeriodStart)} – {shortDate(subscription.currentPeriodEnd)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><UsersRound className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">User limit</p><p className="mt-1 text-sm font-semibold">{subscription.plan.maxUsers} members</p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><HardDrive className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Storage limit</p><p className="mt-1 text-sm font-semibold">{number(subscription.plan.maxStorageMb / 1024, 0)} GB</p></div>
                </div>
                <div className="mt-5">
                  <p className="text-sm font-semibold">Enabled modules</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {controllableModules.map((module) => (
                      <div key={module.key} className="flex items-start gap-3 rounded-lg border p-3">
                        {baseModules.has(module.key) ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Boxes className="mt-0.5 h-4 w-4 text-slate-300" />}
                        <div><p className="text-sm font-semibold">{module.label}</p><p className="text-xs text-muted-foreground">{baseModules.has(module.key) ? module.description : "Not included in this workspace"}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Request a change</CardTitle><p className="text-sm text-muted-foreground">Requests are stored and reviewed in the Bizavo control center.</p></CardHeader>
              <CardContent>
                {canManage ? (
                  <form action={createSubscriptionRequest} className="grid gap-4">
                    <FormField label="Request"><Select name="type" required><option value="CHANGE_PLAN">Change plan</option><option value="CANCEL">Cancel at period end</option><option value="REACTIVATE">Reactivate subscription</option></Select></FormField>
                    <FormField label="Requested plan"><Select name="requestedPlanId"><option value="">Select for plan change</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.monthlyPrice, plan.currency)}/month</option>)}</Select></FormField>
                    <FormField label="Notes"><Textarea name="notes" rows={3} placeholder="Tell us what you need or when the change should take effect." /></FormField>
                    <Button type="submit">Submit request</Button>
                  </form>
                ) : <p className="text-sm text-muted-foreground">Only the organization Owner can request billing changes.</p>}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <EmptyState icon={CreditCard} title="No subscription assigned" description="Your workspace is active, but a Bizavo plan has not been assigned yet. Contact the platform administrator." />
      )}

      <Card>
        <CardHeader><CardTitle>Subscription invoices & payments</CardTitle></CardHeader>
        <CardContent>
          {subscription?.invoices.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Issued / due</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Last payment</TableHead></TableRow></TableHeader>
              <TableBody>
                {subscription.invoices.map((invoice) => {
                  const overdue = invoice.status !== "PAID" && invoice.status !== "VOID" && invoice.dueDate < new Date();
                  return <TableRow key={invoice.id}><TableCell><p className="font-semibold">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">{invoice.notes ?? "Bizavo subscription"}</p></TableCell><TableCell>{shortDate(invoice.issueDate)}<br/><span className="text-xs text-muted-foreground">Due {shortDate(invoice.dueDate)}</span></TableCell><TableCell><Badge variant={invoice.status === "PAID" ? "success" : overdue ? "destructive" : "secondary"}>{overdue ? "Overdue" : enumLabel(invoice.status)}</Badge></TableCell><TableCell>{money(invoice.totalAmount, organization.currency)}</TableCell><TableCell>{money(invoice.paidAmount, organization.currency)}</TableCell><TableCell>{invoice.payments[0] ? <><span className="font-medium">{shortDate(invoice.payments[0].paymentDate)}</span><br/><span className="text-xs text-muted-foreground">{invoice.payments[0].method} · {invoice.payments[0].reference ?? "No reference"}</span></> : "—"}</TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          ) : <EmptyState icon={CreditCard} title="No subscription invoices" description="Invoices and recorded payments will appear here." />}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Billing profile</CardTitle><p className="text-sm text-muted-foreground">Used on Bizavo subscription invoices. This is separate from project/client accounting.</p></CardHeader>
          <CardContent>
            {canManage ? (
              <form action={updateBillingProfile} className="grid gap-4 sm:grid-cols-2">
                <FormField label="Legal name" className="sm:col-span-2"><Input name="legalName" defaultValue={profile?.legalName ?? organization.name} required /></FormField>
                <FormField label="Billing email"><Input name="billingEmail" type="email" defaultValue={profile?.billingEmail ?? session.user.email ?? ""} required /></FormField>
                <FormField label="Billing phone"><Input name="billingPhone" defaultValue={profile?.billingPhone ?? ""} /></FormField>
                <FormField label="GST / tax ID"><Input name="taxId" defaultValue={profile?.taxId ?? ""} /></FormField>
                <FormField label="Country"><Input name="country" defaultValue={profile?.country ?? "India"} required /></FormField>
                <FormField label="Address line 1" className="sm:col-span-2"><Input name="addressLine1" defaultValue={profile?.addressLine1 ?? ""} /></FormField>
                <FormField label="Address line 2" className="sm:col-span-2"><Input name="addressLine2" defaultValue={profile?.addressLine2 ?? ""} /></FormField>
                <FormField label="City"><Input name="city" defaultValue={profile?.city ?? ""} /></FormField>
                <FormField label="State"><Input name="state" defaultValue={profile?.state ?? ""} /></FormField>
                <FormField label="Postal code"><Input name="postalCode" defaultValue={profile?.postalCode ?? ""} /></FormField>
                <div className="flex items-end"><Button type="submit">Save billing profile</Button></div>
              </form>
            ) : (
              <div className="text-sm"><p className="font-semibold">{profile?.legalName ?? organization.name}</p><p className="mt-1 text-muted-foreground">{profile?.billingEmail ?? "No billing email saved"}</p><p className="mt-1 text-muted-foreground">{[profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ") || "No billing address saved"}</p></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Request history</CardTitle></CardHeader>
          <CardContent>
            {organization.subscriptionRequests.length ? <div className="space-y-3">{organization.subscriptionRequests.map((request) => <div key={request.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{enumLabel(request.type)}{request.requestedPlan ? ` · ${request.requestedPlan.name}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{shortDate(request.createdAt)} · {request.notes ?? "No notes"}</p></div><Badge variant={request.status === "REJECTED" ? "destructive" : request.status === "COMPLETED" ? "success" : "secondary"}>{enumLabel(request.status)}</Badge></div>{request.resolutionNote ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{request.resolutionNote}</p> : null}</div>)}</div> : <EmptyState icon={CalendarClock} title="No plan requests" description="Plan change, cancellation and reactivation requests will be tracked here." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
