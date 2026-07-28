import Link from "next/link";
import { ArrowLeft, CheckCircle2, PackageCheck, XCircle } from "lucide-react";
import { decidePurchaseOrder, receivePurchaseOrder } from "@/app/app/procurement/actions";
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
import { enumLabel, money, number, shortDate } from "@/lib/utils";

export default async function PurchaseOrderPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  const session = await requireSession("procurement:view");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    include: {
      project: true,
      vendor: true,
      items: { include: { item: true } },
      receipts: { include: { location: true, items: { include: { item: true } } }, orderBy: { receivedDate: "desc" } },
      bills: { orderBy: { billDate: "desc" } }
    }
  });
  if (!po) return <EmptyState icon={PackageCheck} title="Purchase order not found" description="It may have been removed or belongs to another organization." />;
  const locations = await prisma.inventoryLocation.findMany({
    where: { organizationId: session.organizationId, active: true },
    orderBy: { name: "asc" }
  });
  const canApprove = can(session.role, "procurement:approve") && po.status === "REQUESTED";
  const canReceive = can(session.role, "inventory:manage") && ["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status);

  return (
    <div className="space-y-7">
      <div>
        <Link href="/app/procurement" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Procurement</Link>
        <PageHeader eyebrow={po.poNumber} title={po.vendor.name} description={`${po.project.code} · ${po.project.name}`} action={<Badge variant={po.status === "APPROVED" || po.status === "RECEIVED" ? "success" : po.status === "REJECTED" ? "destructive" : "warning"}>{enumLabel(po.status)}</Badge>} />
      </div>
      <AlertMessage error={searchParams.error} success={searchParams.success} />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Order value</p><p className="mt-2 text-xl font-bold">{money(po.totalAmount, session.currency)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Order date</p><p className="mt-2 text-base font-semibold">{shortDate(po.orderDate)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Expected delivery</p><p className="mt-2 text-base font-semibold">{shortDate(po.expectedDate)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Payment terms</p><p className="mt-2 text-base font-semibold">{po.vendor.paymentTerms ?? "30 days"}</p></CardContent></Card>
      </section>
      <Card>
        <CardHeader><CardTitle>Order lines</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Received</TableHead><TableHead>Unit price</TableHead><TableHead>Tax</TableHead><TableHead className="text-right">Line value</TableHead></TableRow></TableHeader>
            <TableBody>{po.items.map((line) => <TableRow key={line.id}><TableCell><p className="font-semibold">{line.item?.name ?? line.description}</p><p className="text-xs text-muted-foreground">{line.item?.sku} · {line.description}</p></TableCell><TableCell>{number(line.quantity)} {line.unit}</TableCell><TableCell>{number(line.receivedQuantity)} {line.unit}</TableCell><TableCell>{money(line.unitPrice, session.currency)}</TableCell><TableCell>{number(line.taxPercent)}%</TableCell><TableCell className="text-right font-semibold">{money(line.lineTotal, session.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
          <div className="mt-4 flex justify-end"><div className="w-full max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(po.subtotal, session.currency)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{money(po.taxAmount, session.currency)}</span></div><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{money(po.totalAmount, session.currency)}</span></div></div></div>
        </CardContent>
      </Card>
      {canApprove ? (
        <Card>
          <CardHeader><CardTitle>Approval decision</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <form action={decidePurchaseOrder} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><input type="hidden" name="purchaseOrderId" value={po.id} /><input type="hidden" name="decision" value="approve" /><p className="font-semibold text-emerald-900">Approve this order</p><p className="mt-1 text-sm text-emerald-700">The order becomes available for material receipt.</p><Button type="submit" className="mt-4"><CheckCircle2 className="h-4 w-4" />Approve PO</Button></form>
            <form action={decidePurchaseOrder} className="rounded-xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="purchaseOrderId" value={po.id} /><input type="hidden" name="decision" value="reject" /><FormField label="Reason"><Input name="reason" placeholder="Commercial or specification issue" required /></FormField><Button type="submit" variant="destructive" className="mt-4"><XCircle className="h-4 w-4" />Reject PO</Button></form>
          </CardContent>
        </Card>
      ) : null}
      {canReceive ? (
        <Card>
          <CardHeader><CardTitle>Receive delivery</CardTitle><p className="text-sm text-muted-foreground">A GRN, stock movement, weighted-average cost update and vendor payable will be created together.</p></CardHeader>
          <CardContent>
            <form action={receivePurchaseOrder} className="space-y-5">
              <input type="hidden" name="purchaseOrderId" value={po.id} />
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="Receive into"><Select name="locationId" required><option value="">Select warehouse or site store</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</Select></FormField><FormField label="Receipt date"><Input name="receivedDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField></div>
              <div className="space-y-3">{po.items.map((line) => { const remaining = Number(line.quantity) - Number(line.receivedQuantity); return <div key={line.id} className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px]"><div><p className="text-sm font-semibold">{line.item?.name ?? line.description}</p><p className="text-xs text-muted-foreground">Remaining {number(remaining)} {line.unit}</p></div><FormField label="Receive now"><Input name={`quantity-${line.id}`} type="number" min="0" max={remaining} step="0.001" defaultValue={remaining} disabled={remaining <= 0} /></FormField></div>; })}</div>
              <FormField label="Receipt notes"><Textarea name="notes" placeholder="Vehicle, challan, quality remarks…" /></FormField>
              <Button type="submit"><PackageCheck className="h-4 w-4" />Record goods receipt</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Receipt and payable history</CardTitle></CardHeader>
        <CardContent>
          {po.receipts.length ? <div className="space-y-3">{po.receipts.map((receipt) => <div key={receipt.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{receipt.receiptNumber}</p><p className="mt-1 text-xs text-muted-foreground">{receipt.location.name} · {shortDate(receipt.receivedDate)}</p></div><Badge variant="success">{receipt.items.length} lines received</Badge></div><div className="mt-3 flex flex-wrap gap-2">{receipt.items.map((line) => <span key={line.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{line.item.name}: {number(line.quantity)} {line.item.unit}</span>)}</div></div>)}</div> : <EmptyState icon={PackageCheck} title="No deliveries received" description="Approved purchase order receipts will appear here." />}
          {po.bills.length ? <div className="mt-5 border-t pt-5"><p className="mb-3 text-sm font-semibold">Linked vendor bills</p>{po.bills.map((bill) => <div key={bill.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"><div><p className="font-semibold">{bill.billNumber}</p><p className="text-xs text-muted-foreground">Due {shortDate(bill.dueDate)}</p></div><div className="text-right"><p className="font-semibold">{money(bill.amount, session.currency)}</p><Badge variant={bill.status === "PAID" ? "success" : "warning"}>{enumLabel(bill.status)}</Badge></div></div>)}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
