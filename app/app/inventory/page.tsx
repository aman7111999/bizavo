import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Boxes, ClipboardMinus, PackagePlus, SlidersHorizontal, Warehouse } from "lucide-react";
import { adjustStock, createInventoryItem, createInventoryLocation, issueMaterial, transferStock } from "@/app/app/inventory/actions";
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
import { cn, enumLabel, money, number, shortDate } from "@/lib/utils";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; view?: string }>;
}) {
  const session = await requireSession("inventory:view");
  const query = await searchParams;
  const projectIds = await accessibleProjectIds(session);
  const locationScope = projectIds !== undefined ? { projectId: { in: projectIds } } : {};
  const projectScope = projectIds !== undefined ? { id: { in: projectIds } } : {};
  const [items, locations, stocks, movements, projects, vendors] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { organizationId: session.organizationId },
      include: {
        category: true,
        preferredVendor: { select: { name: true } },
        stocks: {
          where: projectIds !== undefined ? { location: { projectId: { in: projectIds } } } : {},
          select: { quantity: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.inventoryLocation.findMany({
      where: { organizationId: session.organizationId, active: true, ...locationScope },
      include: { project: { select: { name: true } }, _count: { select: { stocks: true } } },
      orderBy: { name: "asc" }
    }),
    prisma.inventoryStock.findMany({
      where: {
        organizationId: session.organizationId,
        ...(projectIds !== undefined ? { location: { projectId: { in: projectIds } } } : {})
      },
      include: { item: true, location: true },
      orderBy: [{ location: { name: "asc" } }, { item: { name: "asc" } }]
    }),
    prisma.stockMovement.findMany({
      where: {
        organizationId: session.organizationId,
        ...(projectIds !== undefined ? { location: { projectId: { in: projectIds } } } : {})
      },
      include: { item: true, location: true, project: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 100
    }),
    prisma.project.findMany({ where: { organizationId: session.organizationId, status: { in: ["PLANNING", "ACTIVE"] }, ...projectScope }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } })
  ]);
  const totalByItem = new Map(items.map((item) => [item.id, item.stocks.reduce((sum, stock) => sum + Number(stock.quantity), 0)]));
  const lowStockItems = items.filter((item) => Number(item.reorderLevel) > 0 && (totalByItem.get(item.id) ?? 0) <= Number(item.reorderLevel));
  const stockValue = stocks.reduce((sum, stock) => sum + Number(stock.quantity) * Number(stock.item.averageCost), 0);
  const view = query.view ?? "items";
  const manage = can(session.role, "inventory:manage");
  const catalogueManage = manage && session.role !== "SITE_ENGINEER";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Zoho-inspired, construction-specific"
        title="Inventory"
        description="Item catalogue, site stores, weighted-average stock value, receipts, issues, transfers and adjustments."
      />
      <AlertMessage error={query.error} success={query.success} />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5"><Boxes className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-bold">{items.length}</p><p className="text-xs text-muted-foreground">Active catalogue items</p></CardContent></Card>
        <Card><CardContent className="p-5"><Warehouse className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-bold">{locations.length}</p><p className="text-xs text-muted-foreground">Warehouses and site stores</p></CardContent></Card>
        <Card><CardContent className="p-5"><AlertTriangle className="h-5 w-5 text-amber-500" /><p className="mt-4 text-2xl font-bold">{lowStockItems.length}</p><p className="text-xs text-muted-foreground">At or below reorder level</p></CardContent></Card>
        <Card><CardContent className="p-5"><PackagePlus className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-bold">{money(stockValue, session.currency)}</p><p className="text-xs text-muted-foreground">Weighted-average stock value</p></CardContent></Card>
      </section>
      <div className="flex flex-wrap gap-2">
        {[["items", "Items"], ["stock", "Stock by location"], ["movements", "Movement history"], ["operations", "Stock operations"]].map(([value, label]) => (
          <Link key={value} href={`/app/inventory?view=${value}`} className={buttonVariants({ variant: view === value ? "default" : "outline", size: "sm" })}>{label}</Link>
        ))}
      </div>

      {view === "items" ? (
        <div className="space-y-5">
          {lowStockItems.length ? (
            <Card className="border-amber-200 bg-amber-50/50"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-900"><AlertTriangle className="h-5 w-5" />Reorder attention</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{lowStockItems.map((item) => <span key={item.id} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium">{item.name}: {number(totalByItem.get(item.id) ?? 0)} {item.unit} / reorder {number(item.reorderLevel)}</span>)}</CardContent></Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>Item catalogue</CardTitle></CardHeader>
            <CardContent>
              {items.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Preferred vendor</TableHead><TableHead>On hand</TableHead><TableHead>Reorder point</TableHead><TableHead>Avg. cost</TableHead><TableHead className="text-right">Stock value</TableHead></TableRow></TableHeader>
                  <TableBody>{items.map((item) => { const onHand = totalByItem.get(item.id) ?? 0; return <TableRow key={item.id}><TableCell><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku} · {item.unit}</p></TableCell><TableCell>{item.category?.name ?? "Uncategorized"}</TableCell><TableCell>{item.preferredVendor?.name ?? "—"}</TableCell><TableCell><span className={cn("font-semibold", Number(item.reorderLevel) > 0 && onHand <= Number(item.reorderLevel) ? "text-amber-700" : "")}>{number(onHand)} {item.unit}</span></TableCell><TableCell>{number(item.reorderLevel)} {item.unit}</TableCell><TableCell>{money(item.averageCost, session.currency)}</TableCell><TableCell className="text-right font-semibold">{money(onHand * Number(item.averageCost), session.currency)}</TableCell></TableRow>; })}</TableBody>
                </Table>
              ) : <EmptyState icon={Boxes} title="No inventory items" description="Create the catalogue that purchase orders, receipts and site issues will use." />}
            </CardContent>
          </Card>
          {catalogueManage ? (
            <Card>
              <CardHeader><CardTitle>Create item</CardTitle><p className="text-sm text-muted-foreground">Opening stock is optional and posts to the inventory asset account.</p></CardHeader>
              <CardContent>
                <form action={createInventoryItem} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField label="Item name"><Input name="name" required /></FormField>
                  <FormField label="SKU"><Input name="sku" placeholder="CEM-OPC53" required /></FormField>
                  <FormField label="Category"><Input name="category" placeholder="Cement" /></FormField>
                  <FormField label="Unit"><Select name="unit"><option>Bag</option><option>Kg</option><option>MT</option><option>Nos</option><option>Sqft</option><option>Cum</option><option>Rmt</option><option>Litre</option></Select></FormField>
                  <FormField label="Purchase price"><Input name="purchasePrice" type="number" min="0" step="0.01" required /></FormField>
                  <FormField label="Reorder level"><Input name="reorderLevel" type="number" min="0" step="0.001" defaultValue="0" /></FormField>
                  <FormField label="Preferred vendor"><Select name="preferredVendorId"><option value="">None</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</Select></FormField>
                  <FormField label="Opening location"><Select name="locationId"><option value="">No opening stock</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</Select></FormField>
                  <FormField label="Opening quantity"><Input name="openingQuantity" type="number" min="0" step="0.001" defaultValue="0" /></FormField>
                  <FormField label="Description" className="sm:col-span-2 lg:col-span-3"><Input name="description" /></FormField>
                  <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Create item</Button></div>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {view === "stock" ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{locations.map((location) => { const locationStocks = stocks.filter((stock) => stock.locationId === location.id); const value = locationStocks.reduce((sum, stock) => sum + Number(stock.quantity) * Number(stock.item.averageCost), 0); return <Card key={location.id}><CardContent className="p-5"><div className="flex items-start justify-between"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Warehouse className="h-5 w-5" /></div><Badge variant={location.type === "SITE_STORE" ? "warning" : "secondary"}>{enumLabel(location.type)}</Badge></div><h2 className="mt-4 font-semibold">{location.name}</h2><p className="text-xs text-muted-foreground">{location.code} · {location.project?.name ?? "Organization-wide"}</p><div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-[11px] text-muted-foreground">Items</p><p className="font-semibold">{locationStocks.filter((stock) => Number(stock.quantity) !== 0).length}</p></div><div><p className="text-[11px] text-muted-foreground">Value</p><p className="font-semibold">{money(value, session.currency)}</p></div></div></CardContent></Card>; })}</div>
          <Card><CardHeader><CardTitle>Stock by location</CardTitle></CardHeader><CardContent>{stocks.length ? <Table><TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Avg. cost</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader><TableBody>{stocks.filter((stock) => Number(stock.quantity) !== 0).map((stock) => <TableRow key={stock.id}><TableCell><p className="font-medium">{stock.location.name}</p><p className="text-xs text-muted-foreground">{stock.location.code}</p></TableCell><TableCell><p className="font-medium">{stock.item.name}</p><p className="text-xs text-muted-foreground">{stock.item.sku}</p></TableCell><TableCell className="font-semibold">{number(stock.quantity)} {stock.item.unit}</TableCell><TableCell>{money(stock.item.averageCost, session.currency)}</TableCell><TableCell className="text-right font-semibold">{money(Number(stock.quantity) * Number(stock.item.averageCost), session.currency)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={Warehouse} title="No stock recorded" description="Receive an approved purchase order or add opening stock to an item." />}</CardContent></Card>
          {catalogueManage ? <Card><CardHeader><CardTitle>Add inventory location</CardTitle></CardHeader><CardContent><form action={createInventoryLocation} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Name"><Input name="name" required /></FormField><FormField label="Code"><Input name="code" required /></FormField><FormField label="Type"><Select name="type"><option value="CENTRAL_WAREHOUSE">Central warehouse</option><option value="SITE_STORE">Site store</option></Select></FormField><FormField label="Linked project"><Select name="projectId"><option value="">Organization-wide</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></FormField><FormField label="Address" className="sm:col-span-2 lg:col-span-4"><Input name="address" /></FormField><div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Create location</Button></div></form></CardContent></Card> : null}
        </div>
      ) : null}

      {view === "movements" ? (
        <Card><CardHeader><CardTitle>Stock movement history</CardTitle><p className="text-sm text-muted-foreground">Immutable receipt, issue, transfer, opening and adjustment events.</p></CardHeader><CardContent>{movements.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Location</TableHead><TableHead>Project / reference</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader><TableBody>{movements.map((movement) => <TableRow key={movement.id}><TableCell>{shortDate(movement.occurredAt)}</TableCell><TableCell><Badge variant={Number(movement.quantity) >= 0 ? "success" : "warning"}>{enumLabel(movement.type)}</Badge></TableCell><TableCell><p className="font-medium">{movement.item.name}</p><p className="text-xs text-muted-foreground">{movement.item.sku}</p></TableCell><TableCell>{movement.location.name}</TableCell><TableCell><p>{movement.project?.name ?? movement.referenceType}</p><p className="text-xs text-muted-foreground">{movement.note}</p></TableCell><TableCell className={cn("text-right font-semibold", Number(movement.quantity) >= 0 ? "text-emerald-700" : "text-amber-700")}>{Number(movement.quantity) >= 0 ? "+" : ""}{number(movement.quantity)} {movement.item.unit}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={ArrowRightLeft} title="No stock movements" description="Receipts, issues, transfers and adjustments will be recorded here." />}</CardContent></Card>
      ) : null}

      {view === "operations" ? (
        manage ? (
          <div className="grid gap-5 xl:grid-cols-3">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardMinus className="h-5 w-5 text-primary" />Issue to project</CardTitle><p className="text-sm text-muted-foreground">Consumes stock and records material cost against the project.</p></CardHeader><CardContent><form action={issueMaterial} className="grid gap-4"><FormField label="Project"><Select name="projectId" required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></FormField><FormField label="Source location"><Select name="locationId" required><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></FormField><FormField label="Item"><Select name="itemId" required><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</Select></FormField><FormField label="Quantity"><Input name="quantity" type="number" min="0.001" step="0.001" required /></FormField><FormField label="Issue date"><Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><FormField label="Issued to"><Input name="issuedTo" placeholder="Team or subcontractor" required /></FormField><FormField label="Project phase"><Input name="phaseName" placeholder="Foundation" /></FormField><FormField label="Notes"><Textarea name="notes" /></FormField><Button type="submit">Issue material</Button></form></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Transfer stock</CardTitle><p className="text-sm text-muted-foreground">Move stock between central and site stores without changing value.</p></CardHeader><CardContent><form action={transferStock} className="grid gap-4"><FormField label="Item"><Select name="itemId" required><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</Select></FormField><FormField label="From"><Select name="fromLocationId" required><option value="">Source location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></FormField><FormField label="To"><Select name="toLocationId" required><option value="">Destination location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></FormField><FormField label="Quantity"><Input name="quantity" type="number" min="0.001" step="0.001" required /></FormField><FormField label="Transfer date"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><Button type="submit">Transfer stock</Button></form></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" />Adjust stock</CardTitle><p className="text-sm text-muted-foreground">Correct physical variance with a reason and accounting entry.</p></CardHeader><CardContent><form action={adjustStock} className="grid gap-4"><FormField label="Location"><Select name="locationId" required><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></FormField><FormField label="Item"><Select name="itemId" required><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</Select></FormField><FormField label="Adjustment quantity" hint="Use a negative number for shortage"><Input name="adjustment" type="number" step="0.001" required /></FormField><FormField label="Date"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><FormField label="Reason"><Textarea name="reason" placeholder="Physical count variance, damage, correction…" required /></FormField><Button type="submit">Post adjustment</Button></form></CardContent></Card>
          </div>
        ) : <EmptyState icon={SlidersHorizontal} title="Read-only inventory access" description="Your role can view stock and movements but cannot post inventory transactions." />
      ) : null}
    </div>
  );
}
