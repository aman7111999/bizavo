import { PlatformRole } from "@prisma/client";
import { CreditCard, PlusCircle } from "lucide-react";
import { createPlan, updatePlan } from "@/app/control/actions";
import { AlertMessage } from "@/components/alert-message";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { controllableModules, requirePlatformAdmin } from "@/lib/subscription";
import { money } from "@/lib/utils";

export const metadata = { title: "Subscription plans" };

function ModuleChecks({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {controllableModules.map((module) => (
        <label key={module.key} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input type="checkbox" name="modules" value={module.key} defaultChecked={selected.includes(module.key)} className="mt-1" />
          <span><span className="font-semibold">{module.label}</span><span className="block text-xs text-muted-foreground">{module.description}</span></span>
        </label>
      ))}
    </div>
  );
}

export default async function PlansPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { role } = await requirePlatformAdmin();
  const query = await searchParams;
  const plans = await prisma.subscriptionPlan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { monthlyPrice: "asc" }
  });
  const canEdit = role === PlatformRole.SUPER_ADMIN;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Commercial catalog" title="Subscription plans" description="Plan prices, capacity limits and included modules. Changes are saved in PostgreSQL and immediately drive workspace access." />
      <AlertMessage error={query.error} success={query.success} />

      <section className="grid gap-5 xl:grid-cols-2">
        {plans.map((plan) => {
          const modules = Array.isArray(plan.modules) ? plan.modules.filter((value): value is string => typeof value === "string") : [];
          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div><CardTitle>{plan.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{money(plan.monthlyPrice, plan.currency)}/month · {money(plan.annualPrice, plan.currency)}/year</p></div>
                  <div className="flex gap-2">{plan.isDefault ? <Badge>Default</Badge> : null}<Badge variant={plan.active ? "success" : "secondary"}>{plan.active ? "Active" : "Inactive"}</Badge></div>
                </div>
                <p className="text-xs text-muted-foreground">{plan._count.subscriptions} assigned subscription{plan._count.subscriptions === 1 ? "" : "s"}</p>
              </CardHeader>
              <CardContent>
                {canEdit ? (
                  <form action={updatePlan} className="grid gap-4">
                    <input type="hidden" name="planId" value={plan.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Plan code"><Input name="code" defaultValue={plan.code} required /></FormField>
                      <FormField label="Plan name"><Input name="name" defaultValue={plan.name} required /></FormField>
                      <FormField label="Currency"><Input name="currency" defaultValue={plan.currency} maxLength={3} required /></FormField>
                      <FormField label="Trial days"><Input name="trialDays" type="number" min={0} defaultValue={plan.trialDays} required /></FormField>
                      <FormField label="Monthly price"><Input name="monthlyPrice" type="number" min={0} step="0.01" defaultValue={String(plan.monthlyPrice)} required /></FormField>
                      <FormField label="Annual price"><Input name="annualPrice" type="number" min={0} step="0.01" defaultValue={String(plan.annualPrice)} required /></FormField>
                      <FormField label="Maximum users"><Input name="maxUsers" type="number" min={1} defaultValue={plan.maxUsers} required /></FormField>
                      <FormField label="Maximum projects"><Input name="maxProjects" type="number" min={1} defaultValue={plan.maxProjects} required /></FormField>
                      <FormField label="Storage (MB)"><Input name="maxStorageMb" type="number" min={1} defaultValue={plan.maxStorageMb} required /></FormField>
                      <div className="flex items-end gap-4 pb-2"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={plan.active} />Active</label><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="isDefault" defaultChecked={plan.isDefault} />Default</label></div>
                    </div>
                    <FormField label="Description"><Textarea name="description" defaultValue={plan.description ?? ""} rows={2} /></FormField>
                    <ModuleChecks selected={modules} />
                    <div><Button type="submit">Save plan</Button></div>
                  </form>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">{controllableModules.filter((module) => modules.includes(module.key)).map((module) => <div key={module.key} className="rounded-lg border p-3 text-sm font-semibold">{module.label}</div>)}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {canEdit ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" />Create plan</CardTitle><p className="text-sm text-muted-foreground">New plans are inactive only if you later disable them; no organization is changed automatically.</p></CardHeader>
          <CardContent>
            <form action={createPlan} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FormField label="Plan code"><Input name="code" placeholder="BUSINESS" required /></FormField>
                <FormField label="Plan name"><Input name="name" placeholder="Business" required /></FormField>
                <FormField label="Currency"><Input name="currency" defaultValue="INR" maxLength={3} required /></FormField>
                <FormField label="Trial days"><Input name="trialDays" type="number" min={0} defaultValue={14} required /></FormField>
                <FormField label="Monthly price"><Input name="monthlyPrice" type="number" min={0} step="0.01" required /></FormField>
                <FormField label="Annual price"><Input name="annualPrice" type="number" min={0} step="0.01" required /></FormField>
                <FormField label="Maximum users"><Input name="maxUsers" type="number" min={1} defaultValue={25} required /></FormField>
                <FormField label="Maximum projects"><Input name="maxProjects" type="number" min={1} defaultValue={15} required /></FormField>
                <FormField label="Storage (MB)"><Input name="maxStorageMb" type="number" min={1} defaultValue={10240} required /></FormField>
                <FormField label="Description" className="sm:col-span-2 xl:col-span-3"><Input name="description" /></FormField>
              </div>
              <ModuleChecks selected={controllableModules.map((module) => module.key)} />
              <div><Button type="submit"><CreditCard className="h-4 w-4" />Create plan</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
