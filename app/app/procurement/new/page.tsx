import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createPurchaseOrder } from "@/app/app/procurement/actions";
import { AlertMessage } from "@/components/alert-message";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await requireSession("procurement:request");
  const [projects, vendors, items] = await Promise.all([
    prisma.project.findMany({ where: { organizationId: session.organizationId, status: { in: ["PLANNING", "ACTIVE"] } }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader eyebrow="Procurement request" title="New purchase order" description="The PO will be submitted to Procurement, Admin or Owner for approval." action={<Link href="/app/procurement" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="h-4 w-4" />Back</Link>} />
      <AlertMessage error={searchParams.error} />
      {!projects.length || !vendors.length || !items.length ? (
        <Card><CardContent className="p-6 text-sm">You need at least one active project, vendor and inventory item before raising a PO. Add vendors and items from Procurement and Inventory.</CardContent></Card>
      ) : (
        <form action={createPurchaseOrder} className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="Project"><Select name="projectId" required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</Select></FormField>
              <FormField label="Vendor"><Select name="vendorId" required><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.code} · {vendor.name}</option>)}</Select></FormField>
              <FormField label="Order date"><Input name="orderDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField>
              <FormField label="Expected delivery"><Input name="expectedDate" type="date" /></FormField>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Itemized requirement</CardTitle><p className="text-sm text-muted-foreground">Use up to five lines in this Phase 1 form. Empty lines are ignored.</p></CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[1.25fr_1.4fr_0.55fr_0.7fr_0.55fr]">
                  <FormField label={`Item ${index + 1}`}><Select name="itemId"><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name} ({item.unit})</option>)}</Select></FormField>
                  <FormField label="Description"><Input name="description" placeholder="Specification or grade" /></FormField>
                  <FormField label="Quantity"><Input name="quantity" type="number" min="0" step="0.001" /></FormField>
                  <FormField label="Unit price"><Input name="unitPrice" type="number" min="0" step="0.01" /></FormField>
                  <FormField label="Tax %"><Input name="taxPercent" type="number" min="0" max="100" step="0.01" defaultValue="18" /></FormField>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card><CardContent className="p-6"><FormField label="Commercial notes"><Textarea name="notes" placeholder="Delivery instructions, quality requirements, payment notes…" /></FormField><div className="mt-5 flex justify-end gap-3"><Link href="/app/procurement" className={buttonVariants({ variant: "outline" })}>Cancel</Link><Button type="submit">Submit for approval</Button></div></CardContent></Card>
        </form>
      )}
    </div>
  );
}
