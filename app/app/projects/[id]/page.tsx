import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  MapPin,
  Plus,
  ReceiptIndianRupee,
  WalletCards
} from "lucide-react";
import {
  createContract,
  createMilestone,
  createPhase,
  updateMilestone,
  updatePhase,
  uploadProjectDocument
} from "@/app/app/projects/actions";
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
import { getProjectFinancials } from "@/lib/finance";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireProject } from "@/lib/session";
import { cn, enumLabel, money, number, shortDate } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  const { session } = await requireProject(params.id);
  const manage = can(session.role, "projects:manage");
  const [project, financial] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        contracts: { include: { milestones: { orderBy: { dueDate: "asc" } } }, orderBy: { createdAt: "desc" } },
        phases: { include: { milestone: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        clientInvoices: { orderBy: { issueDate: "desc" } },
        inventoryLocations: { select: { id: true, name: true, code: true } }
      }
    }),
    getProjectFinancials(session.organizationId, [params.id]).then((rows) => rows[0])
  ]);

  const milestones = project.contracts.flatMap((contract) => contract.milestones);

  return (
    <div className="space-y-7">
      <div>
        <Link href="/app/projects" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />All projects
        </Link>
        <PageHeader
          eyebrow={project.code}
          title={project.name}
          description={`${project.clientName} · ${project.location}`}
          action={<Badge variant={project.status === "ACTIVE" ? "success" : project.status === "ON_HOLD" ? "warning" : "secondary"}>{enumLabel(project.status)}</Badge>}
        />
      </div>
      <AlertMessage error={searchParams.error} success={searchParams.success} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Approved budget", value: money(project.budget, session.currency), icon: WalletCards },
          { label: "Actual cost", value: money(financial?.actualCost ?? 0, session.currency), icon: ReceiptIndianRupee },
          { label: "Recognized revenue", value: money(financial?.revenue ?? 0, session.currency), icon: Landmark },
          { label: "Gross margin", value: `${number(financial?.margin ?? 0, 1)}%`, icon: CheckCircle2 }
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}><CardContent className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 text-xl font-bold">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.label}</p></CardContent></Card>
          );
        })}
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle>Project brief</CardTitle><p className="mt-1 text-sm text-muted-foreground">Core delivery information and site setup.</p></div>
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Client</p><p className="mt-1 font-semibold">{project.clientName}</p><p className="text-muted-foreground">{project.clientEmail ?? "No email"}</p></div>
          <div><p className="text-xs text-muted-foreground">Timeline</p><p className="mt-1 font-semibold">{shortDate(project.startDate)}</p><p className="text-muted-foreground">to {shortDate(project.endDate)}</p></div>
          <div><p className="text-xs text-muted-foreground">Site store</p><p className="mt-1 font-semibold">{project.inventoryLocations[0]?.name ?? "Not configured"}</p><p className="text-muted-foreground">{project.inventoryLocations[0]?.code}</p></div>
          <div><p className="text-xs text-muted-foreground">Description</p><p className="mt-1 text-muted-foreground">{project.description ?? "No project description."}</p></div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Contracts and milestones</CardTitle><p className="mt-1 text-sm text-muted-foreground">Completion at 100% automatically creates a draft milestone invoice.</p></div>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-6">
            {project.contracts.length ? project.contracts.map((contract) => (
              <div key={contract.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{contract.contractNumber}</p><p className="mt-1 text-xs text-muted-foreground">{contract.paymentTerms}</p></div>
                  <div className="text-right"><p className="font-semibold">{money(contract.contractValue, session.currency)}</p><p className="text-xs text-muted-foreground">Signed {shortDate(contract.signedAt)}</p></div>
                </div>
                <div className="mt-4 space-y-3">
                  {contract.milestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="text-sm font-semibold">{milestone.name}</p><p className="text-xs text-muted-foreground">{number(milestone.billingPercent)}% · {money(milestone.billingAmount, session.currency)} · Due {shortDate(milestone.dueDate)}</p></div>
                        <Badge variant={milestone.status === "COMPLETED" || milestone.status === "INVOICED" ? "success" : milestone.status === "IN_PROGRESS" ? "warning" : "secondary"}>{enumLabel(milestone.status)}</Badge>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white"><div className="h-full rounded-full bg-primary" style={{ width: `${milestone.completionPercent}%` }} /></div>
                      {manage ? (
                        <form action={updateMilestone} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="milestoneId" value={milestone.id} />
                          <Input name="completion" type="number" min="0" max="100" defaultValue={milestone.completionPercent} aria-label="Completion percent" />
                          <Select name="status" defaultValue={milestone.status} aria-label="Milestone status">
                            <option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="INVOICED">Invoiced</option>
                          </Select>
                          <Button type="submit" variant="outline">Update</Button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                  {!contract.milestones.length ? <p className="text-sm text-muted-foreground">No billing milestones yet.</p> : null}
                </div>
                {manage ? (
                  <details className="mt-4 rounded-lg border bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">Add milestone</summary>
                    <form action={createMilestone} className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="contractId" value={contract.id} />
                      <FormField label="Milestone name"><Input name="name" required /></FormField>
                      <FormField label="Due date"><Input name="dueDate" type="date" /></FormField>
                      <FormField label="Billing percentage"><Input name="billingPercent" type="number" min="0.01" max="100" step="0.01" required /></FormField>
                      <FormField label="Description"><Input name="description" /></FormField>
                      <div className="sm:col-span-2"><Button type="submit" size="sm"><Plus className="h-4 w-4" />Add milestone</Button></div>
                    </form>
                  </details>
                ) : null}
              </div>
            )) : (
              <EmptyState icon={Landmark} title="No contract added" description="Add the signed contract before defining milestone billing." />
            )}
            {manage ? (
              <details className="rounded-xl border border-dashed p-4">
                <summary className="cursor-pointer font-semibold text-primary">Add project contract</summary>
                <form action={createContract} className="mt-4 grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <FormField label="Contract number"><Input name="contractNumber" required /></FormField>
                  <FormField label="Contract value"><Input name="contractValue" type="number" min="1" step="0.01" required /></FormField>
                  <FormField label="Signed date"><Input name="signedAt" type="date" /></FormField>
                  <FormField label="Payment terms"><Input name="paymentTerms" defaultValue="30 days from milestone invoice" required /></FormField>
                  <div className="sm:col-span-2"><Button type="submit">Save contract</Button></div>
                </form>
              </details>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Client invoices</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {project.clientInvoices.length ? project.clientInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold">{invoice.invoiceNumber}</p><Badge variant={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "destructive" : "secondary"}>{enumLabel(invoice.status)}</Badge></div>
                <p className="mt-2 text-lg font-bold">{money(invoice.totalAmount, session.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Due {shortDate(invoice.dueDate)}</p>
              </div>
            )) : <EmptyState icon={ReceiptIndianRupee} title="No invoices yet" description="Draft invoices appear here when milestones reach 100%." />}
            <Link href="/app/finance" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Manage invoices</Link>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Delivery phases</CardTitle><p className="mt-1 text-sm text-muted-foreground">Foundation, structure, MEP, finishing and other execution packages.</p></div><ClipboardList className="h-5 w-5 text-muted-foreground" /></CardHeader>
        <CardContent>
          {project.phases.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Phase</TableHead><TableHead>Milestone</TableHead><TableHead>Owner</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {project.phases.map((phase) => (
                  <TableRow key={phase.id}>
                    <TableCell><p className="font-semibold">{phase.name}</p><p className="text-xs text-muted-foreground">{phase.description}</p></TableCell>
                    <TableCell>{phase.milestone?.name ?? "—"}</TableCell>
                    <TableCell>{phase.assignee ?? "Unassigned"}</TableCell>
                    <TableCell className="min-w-40"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${phase.completion}%` }} /></div><span className="text-xs">{phase.completion}%</span></div></TableCell>
                    <TableCell><Badge variant={phase.status === "COMPLETED" ? "success" : phase.status === "BLOCKED" ? "destructive" : "secondary"}>{enumLabel(phase.status)}</Badge></TableCell>
                    <TableCell>
                      {manage ? <details><summary className="cursor-pointer text-xs font-semibold text-primary">Update</summary><form action={updatePhase} className="mt-2 grid w-52 gap-2"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="phaseId" value={phase.id} /><Input name="completion" type="number" min="0" max="100" defaultValue={phase.completion} /><Select name="status" defaultValue={phase.status}><option value="NOT_STARTED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="BLOCKED">Blocked</option><option value="COMPLETED">Completed</option></Select><Button type="submit" size="sm">Save</Button></form></details> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <EmptyState icon={ClipboardList} title="No phases defined" description="Break the project into execution phases with owners and status." />}
          {manage ? (
            <details className="mt-5 rounded-xl border border-dashed p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add delivery phase</summary>
              <form action={createPhase} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="projectId" value={project.id} />
                <FormField label="Phase name"><Input name="name" required /></FormField>
                <FormField label="Linked milestone"><Select name="milestoneId"><option value="">No milestone</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</Select></FormField>
                <FormField label="Assigned lead"><Input name="assignee" placeholder="Site engineer or team" /></FormField>
                <FormField label="Start date"><Input name="startDate" type="date" /></FormField>
                <FormField label="End date"><Input name="endDate" type="date" /></FormField>
                <FormField label="Description"><Input name="description" /></FormField>
                <div className="lg:col-span-3"><Button type="submit">Add phase</Button></div>
              </form>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Project documents</CardTitle><p className="mt-1 text-sm text-muted-foreground">Drawings, permits, approvals and site records. Maximum 8 MB per file.</p></div><FileText className="h-5 w-5 text-muted-foreground" /></CardHeader>
        <CardContent>
          {project.documents.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Category</TableHead><TableHead>Uploaded</TableHead><TableHead>Size</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{project.documents.map((document) => <TableRow key={document.id}><TableCell className="font-medium">{document.name}</TableCell><TableCell><Badge variant="secondary">{document.category}</Badge></TableCell><TableCell>{shortDate(document.createdAt)}</TableCell><TableCell>{number(document.sizeBytes / 1024, 0)} KB</TableCell><TableCell className="text-right"><Link href={`/api/documents/${document.id}`} target="_blank" className="text-sm font-semibold text-primary">Open</Link></TableCell></TableRow>)}</TableBody>
            </Table>
          ) : <EmptyState icon={FileText} title="No documents uploaded" description="Keep project drawings, approvals and permits accessible to the assigned team." />}
          {manage ? (
            <form action={uploadProjectDocument} className="mt-5 grid gap-4 rounded-xl border border-dashed p-4 sm:grid-cols-[1fr_180px_1fr_auto] sm:items-end">
              <input type="hidden" name="projectId" value={project.id} />
              <FormField label="Display name"><Input name="name" placeholder="Approved floor plan" /></FormField>
              <FormField label="Category"><Select name="category"><option>Drawing</option><option>Approval</option><option>Permit</option><option>Contract</option><option>Site record</option><option>Other</option></Select></FormField>
              <FormField label="File"><Input name="file" type="file" required /></FormField>
              <Button type="submit">Upload</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
