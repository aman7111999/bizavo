import Link from "next/link";
import { HardHat, Star, Wrench } from "lucide-react";
import { createSubcontractor, createSubcontractorBill, createWorkOrder } from "@/app/app/subcontractors/actions";
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
import { cn, enumLabel, money } from "@/lib/utils";

export const metadata = { title: "Subcontractors" };

export default async function SubcontractorsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; view?: string }>;
}) {
  const session = await requireSession("subcontractors:view");
  const query = await searchParams;
  const projectIds = await accessibleProjectIds(session);
  const boundProjectScope = projectIds !== undefined ? { projectId: { in: projectIds } } : {};
  const [subcontractors, workOrders, projects] = await Promise.all([
    prisma.subcontractor.findMany({
      where: { organizationId: session.organizationId },
      include: {
        workOrders: { where: { ...boundProjectScope, status: { not: "CANCELLED" } }, select: { id: true, value: true } },
        bills: { where: { ...boundProjectScope, status: { not: "VOID" } }, select: { amount: true, paidAmount: true } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.workOrder.findMany({
      where: { organizationId: session.organizationId, ...boundProjectScope },
      include: {
        project: { select: { name: true, code: true } },
        milestone: { select: { name: true } },
        subcontractor: { select: { name: true, trade: true } },
        bills: { where: { status: { not: "VOID" } }, select: { amount: true, paidAmount: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.project.findMany({
      where: { organizationId: session.organizationId, status: { in: ["PLANNING", "ACTIVE"] }, ...(projectIds !== undefined ? { id: { in: projectIds } } : {}) },
      include: { milestones: { where: { status: { not: "INVOICED" } }, select: { id: true, name: true } } },
      orderBy: { name: "asc" }
    })
  ]);
  const view = query.view ?? "work-orders";
  const manage = can(session.role, "subcontractors:manage");

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Trade partners" title="Subcontractors" description="Trade directory, work orders, milestone linkage and billed-versus-paid control." />
      <AlertMessage error={query.error} success={query.success} />
      <div className="flex gap-2"><Link href="/app/subcontractors?view=work-orders" className={buttonVariants({ variant: view === "work-orders" ? "default" : "outline", size: "sm" })}>Work orders</Link><Link href="/app/subcontractors?view=directory" className={buttonVariants({ variant: view === "directory" ? "default" : "outline", size: "sm" })}>Directory</Link></div>

      {view === "work-orders" ? (
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Work orders and billing</CardTitle></CardHeader>
            <CardContent>
              {workOrders.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Work order</TableHead><TableHead>Subcontractor</TableHead><TableHead>Project / milestone</TableHead><TableHead>Status</TableHead><TableHead>Value</TableHead><TableHead>Invoiced</TableHead><TableHead className="text-right">Pending</TableHead></TableRow></TableHeader>
                  <TableBody>{workOrders.map((wo) => { const invoiced = wo.bills.reduce((sum, bill) => sum + Number(bill.amount), 0); const paid = wo.bills.reduce((sum, bill) => sum + Number(bill.paidAmount), 0); return <TableRow key={wo.id}><TableCell><p className="font-semibold">{wo.workOrderNumber}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{wo.scope}</p></TableCell><TableCell><p className="font-medium">{wo.subcontractor.name}</p><p className="text-xs text-muted-foreground">{wo.subcontractor.trade}</p></TableCell><TableCell><p>{wo.project.name}</p><p className="text-xs text-muted-foreground">{wo.milestone?.name ?? "No milestone"}</p></TableCell><TableCell><Badge variant={wo.status === "COMPLETED" ? "success" : wo.status === "IN_PROGRESS" ? "warning" : "secondary"}>{enumLabel(wo.status)}</Badge></TableCell><TableCell>{money(wo.value, session.currency)}</TableCell><TableCell>{money(invoiced, session.currency)}</TableCell><TableCell className="text-right"><p className="font-semibold">{money(invoiced - paid, session.currency)}</p><p className="text-xs text-muted-foreground">Paid {money(paid, session.currency)}</p></TableCell></TableRow>; })}</TableBody>
                </Table>
              ) : <EmptyState icon={Wrench} title="No work orders" description="Issue a work order against a project and optionally link it to a contract milestone." />}
            </CardContent>
          </Card>
          {manage ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Issue work order</CardTitle></CardHeader>
                <CardContent><form action={createWorkOrder} className="grid gap-4 sm:grid-cols-2"><FormField label="Project"><Select name="projectId" required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</Select></FormField><FormField label="Subcontractor"><Select name="subcontractorId" required><option value="">Select partner</option>{subcontractors.filter((sub) => sub.active).map((sub) => <option key={sub.id} value={sub.id}>{sub.name} · {sub.trade}</option>)}</Select></FormField><FormField label="Linked milestone" hint="Optional"><Select name="milestoneId"><option value="">No milestone</option>{projects.flatMap((project) => project.milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{project.code} · {milestone.name}</option>))}</Select></FormField><FormField label="Work order value"><Input name="value" type="number" min="1" step="0.01" required /></FormField><FormField label="Start date"><Input name="startDate" type="date" /></FormField><FormField label="End date"><Input name="endDate" type="date" /></FormField><FormField label="Retention %" hint="Held back from payments"><Input name="retentionPercent" type="number" min="0" max="100" step="0.01" defaultValue="5" /></FormField><FormField label="Scope of work" className="sm:col-span-2"><Textarea name="scope" required /></FormField><div className="sm:col-span-2"><Button type="submit">Issue work order</Button></div></form></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Record subcontractor bill</CardTitle><p className="text-sm text-muted-foreground">Creates a project cost and accounts payable entry.</p></CardHeader>
                <CardContent><form action={createSubcontractorBill} className="grid gap-4 sm:grid-cols-2"><FormField label="Work order"><Select name="workOrderId" required><option value="">Select work order</option>{workOrders.filter((wo) => wo.status !== "CANCELLED").map((wo) => <option key={wo.id} value={wo.id}>{wo.workOrderNumber} · {wo.subcontractor.name}</option>)}</Select></FormField><FormField label="Bill number"><Input name="billNumber" required /></FormField><FormField label="Bill date"><Input name="billDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><FormField label="Due date"><Input name="dueDate" type="date" required /></FormField><FormField label="Amount"><Input name="amount" type="number" min="1" step="0.01" required /></FormField><FormField label="Description"><Input name="description" /></FormField><div className="sm:col-span-2"><Button type="submit">Record bill</Button></div></form></CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {subcontractors.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{subcontractors.map((sub) => { const contractValue = sub.workOrders.reduce((sum, wo) => sum + Number(wo.value), 0); const billed = sub.bills.reduce((sum, bill) => sum + Number(bill.amount), 0); const paid = sub.bills.reduce((sum, bill) => sum + Number(bill.paidAmount), 0); return <Card key={sub.id}><CardContent className="p-5"><div className="flex items-start justify-between"><div className="rounded-xl bg-primary/10 p-3 text-primary"><HardHat className="h-5 w-5" /></div><Badge variant={sub.active ? "success" : "secondary"}>{sub.active ? "Active" : "Inactive"}</Badge></div><p className="mt-5 text-xs font-bold uppercase tracking-wide text-primary">{sub.code}</p><h2 className="mt-1 text-lg font-semibold">{sub.name}</h2><p className="mt-1 text-sm text-muted-foreground">{sub.trade}</p><div className="mt-3 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < (sub.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}</div><div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3"><div><p className="text-[10px] text-muted-foreground">Contracts</p><p className="mt-0.5 text-xs font-semibold">{money(contractValue, session.currency)}</p></div><div><p className="text-[10px] text-muted-foreground">Billed</p><p className="mt-0.5 text-xs font-semibold">{money(billed, session.currency)}</p></div><div><p className="text-[10px] text-muted-foreground">Pending</p><p className="mt-0.5 text-xs font-semibold">{money(billed - paid, session.currency)}</p></div></div><p className="mt-4 text-xs text-muted-foreground">{sub.contactPerson ?? "No contact"} · {sub.phone ?? sub.email ?? "No details"}</p></CardContent></Card>; })}</div> : <EmptyState icon={HardHat} title="No subcontractors" description="Add trade partners such as civil, MEP, façade and finishing contractors." />}
          {manage ? <Card><CardHeader><CardTitle>Add subcontractor</CardTitle></CardHeader><CardContent><form action={createSubcontractor} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Business name"><Input name="name" required /></FormField><FormField label="Code"><Input name="code" required /></FormField><FormField label="Trade / specialty"><Input name="trade" placeholder="Electrical" required /></FormField><FormField label="Rating"><Select name="rating"><option value="">Not rated</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</Select></FormField><FormField label="Contact person"><Input name="contactPerson" /></FormField><FormField label="Email"><Input name="email" type="email" /></FormField><FormField label="Phone"><Input name="phone" /></FormField><FormField label="GSTIN"><Input name="gstin" /></FormField><FormField label="Address" className="sm:col-span-2"><Input name="address" /></FormField><FormField label="Notes" className="sm:col-span-2"><Input name="notes" /></FormField><div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Add subcontractor</Button></div></form></CardContent></Card> : null}
        </div>
      )}
    </div>
  );
}
