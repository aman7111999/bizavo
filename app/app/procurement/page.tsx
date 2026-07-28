import Link from "next/link";
import { ShoppingCart, Star, Store, Truck } from "lucide-react";
import { createVendor } from "@/app/app/procurement/actions";
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
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { accessibleProjectIds, requireSession } from "@/lib/session";
import { cn, enumLabel, money, shortDate } from "@/lib/utils";

export const metadata = { title: "Procurement" };

export default async function ProcurementPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; view?: string }>;
}) {
  const session = await requireSession("procurement:view");
  const query = await searchParams;
  const projectIds = await accessibleProjectIds(session);
  const boundProjectScope = projectIds !== undefined ? { projectId: { in: projectIds } } : {};
  const [purchaseOrders, vendors] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { organizationId: session.organizationId, ...boundProjectScope },
      include: { project: { select: { name: true, code: true } }, vendor: { select: { name: true } }, _count: { select: { receipts: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId },
      include: {
        purchaseOrders: { where: boundProjectScope, select: { totalAmount: true } },
        bills: { where: { ...boundProjectScope, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } }, select: { amount: true, paidAmount: true } }
      },
      orderBy: { name: "asc" }
    })
  ]);
  const showVendors = query.view === "vendors";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Source to site"
        title="Procurement"
        description="Vendor directory, purchase order approvals, material receipts and linked payables."
        action={can(session.role, "procurement:request") ? <Link href="/app/procurement/new" className={buttonVariants()}>New purchase order</Link> : undefined}
      />
      <AlertMessage error={query.error} success={query.success} />
      <div className="flex gap-2">
        <Link href="/app/procurement" className={buttonVariants({ variant: !showVendors ? "default" : "outline", size: "sm" })}>Purchase orders</Link>
        <Link href="/app/procurement?view=vendors" className={buttonVariants({ variant: showVendors ? "default" : "outline", size: "sm" })}>Vendors</Link>
      </div>

      {!showVendors ? (
        <Card>
          <CardHeader><CardTitle>Purchase orders</CardTitle></CardHeader>
          <CardContent>
            {purchaseOrders.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Vendor</TableHead><TableHead>Project</TableHead><TableHead>Expected</TableHead><TableHead>Status</TableHead><TableHead>Receipts</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell><Link href={`/app/procurement/${po.id}`} className="font-semibold text-primary">{po.poNumber}</Link><p className="text-xs text-muted-foreground">{shortDate(po.orderDate)}</p></TableCell>
                      <TableCell className="font-medium">{po.vendor.name}</TableCell>
                      <TableCell><p>{po.project.name}</p><p className="text-xs text-muted-foreground">{po.project.code}</p></TableCell>
                      <TableCell>{shortDate(po.expectedDate)}</TableCell>
                      <TableCell><Badge variant={po.status === "APPROVED" || po.status === "RECEIVED" ? "success" : po.status === "REJECTED" ? "destructive" : po.status === "REQUESTED" ? "warning" : "secondary"}>{enumLabel(po.status)}</Badge></TableCell>
                      <TableCell>{po._count.receipts}</TableCell>
                      <TableCell className="text-right font-semibold">{money(po.totalAmount, session.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyState icon={ShoppingCart} title="No purchase orders" description="Raise your first itemized PO against a project and route it for approval." action={can(session.role, "procurement:request") ? <Link href="/app/procurement/new" className={buttonVariants()}>Create PO</Link> : undefined} />}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {vendors.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {vendors.map((vendor) => {
                const ordered = vendor.purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0);
                const payable = vendor.bills.reduce((sum, bill) => sum + Number(bill.amount) - Number(bill.paidAmount), 0);
                return (
                  <Card key={vendor.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between"><div className="rounded-xl bg-primary/10 p-3 text-primary">{vendor.type === "MATERIAL_SUPPLIER" ? <Truck className="h-5 w-5" /> : <Store className="h-5 w-5" />}</div><Badge variant={vendor.active ? "success" : "secondary"}>{vendor.active ? "Active" : "Inactive"}</Badge></div>
                      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-primary">{vendor.code}</p>
                      <h2 className="mt-1 text-lg font-semibold">{vendor.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{vendor.category} · {enumLabel(vendor.type)}</p>
                      <div className="mt-3 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < (vendor.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}</div>
                      <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-[11px] text-muted-foreground">Ordered</p><p className="mt-0.5 text-sm font-semibold">{money(ordered, session.currency)}</p></div><div><p className="text-[11px] text-muted-foreground">Payable</p><p className="mt-0.5 text-sm font-semibold">{money(payable, session.currency)}</p></div></div>
                      <div className="mt-4 text-xs text-muted-foreground"><p>{vendor.contactPerson ?? "No contact person"}</p><p>{vendor.phone ?? vendor.email ?? "No contact details"}</p></div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : <EmptyState icon={Truck} title="No vendors yet" description="Add material suppliers and service vendors before creating purchase orders." />}
          {can(session.role, "procurement:request") ? (
            <Card>
              <CardHeader><CardTitle>Add vendor</CardTitle></CardHeader>
              <CardContent>
                <form action={createVendor} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField label="Vendor name"><Input name="name" required /></FormField>
                  <FormField label="Vendor code"><Input name="code" placeholder="VND-001" required /></FormField>
                  <FormField label="Type"><Select name="type"><option value="MATERIAL_SUPPLIER">Material supplier</option><option value="SERVICE_VENDOR">Service vendor</option><option value="BOTH">Both</option></Select></FormField>
                  <FormField label="Category"><Input name="category" placeholder="Cement & concrete" required /></FormField>
                  <FormField label="Contact person"><Input name="contactPerson" /></FormField>
                  <FormField label="Email"><Input name="email" type="email" /></FormField>
                  <FormField label="Phone"><Input name="phone" /></FormField>
                  <FormField label="GSTIN"><Input name="gstin" /></FormField>
                  <FormField label="Rating"><Select name="rating"><option value="">Not rated</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></Select></FormField>
                  <FormField label="Payment terms"><Input name="paymentTerms" placeholder="30 days" /></FormField>
                  <FormField label="Address" className="sm:col-span-2"><Input name="address" /></FormField>
                  <FormField label="Notes" className="sm:col-span-2 lg:col-span-4"><Textarea name="notes" /></FormField>
                  <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Add vendor</Button></div>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
