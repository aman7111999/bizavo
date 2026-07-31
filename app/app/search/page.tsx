import Link from "next/link";
import { Boxes, Building2, CircleDollarSign, ContactRound, FileStack, Search, Store, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { appNavigation } from "@/lib/app-navigation";
import { documentTitle } from "@/lib/business-documents";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { accessibleProjectIds, requireSession } from "@/lib/session";
import { getEnabledModules } from "@/lib/subscription";
import { money, shortDate } from "@/lib/utils";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession();
  const query = (await searchParams).q?.trim() ?? "";
  const [enabledModules, projectIds] = await Promise.all([getEnabledModules(session.organizationId), accessibleProjectIds(session)]);
  const valid = query.length >= 2;
  const projectWhere = projectIds !== undefined ? { id: { in: projectIds } } : {};
  const contains = { contains: query, mode: "insensitive" as const };
  const [projects, vendors, items, employees, invoices, documents, leads] = valid ? await Promise.all([
    enabledModules.includes("projects") && can(session.role, "projects:view") ? prisma.project.findMany({ where: { organizationId: session.organizationId, ...projectWhere, OR: [{ name: contains }, { code: contains }, { clientName: contains }, { location: contains }] }, select: { id: true, name: true, code: true, clientName: true, location: true }, take: 8 }) : [],
    enabledModules.includes("procurement") && can(session.role, "procurement:view") ? prisma.vendor.findMany({ where: { organizationId: session.organizationId, OR: [{ name: contains }, { code: contains }, { category: contains }, { contactPerson: contains }] }, select: { id: true, name: true, code: true, category: true, contactPerson: true }, take: 8 }) : [],
    enabledModules.includes("inventory") && can(session.role, "inventory:view") ? prisma.inventoryItem.findMany({ where: { organizationId: session.organizationId, OR: [{ name: contains }, { sku: contains }, { description: contains }] }, select: { id: true, name: true, sku: true, unit: true }, take: 8 }) : [],
    enabledModules.includes("hr") && can(session.role, "hr:view") ? prisma.employee.findMany({ where: { organizationId: session.organizationId, ...(!can(session.role, "hr:manage") ? { userId: session.user.id } : {}), OR: [{ name: contains }, { employeeCode: contains }, { designation: contains }, { department: contains }] }, select: { id: true, name: true, employeeCode: true, designation: true, department: true }, take: 8 }) : [],
    enabledModules.includes("finance") && can(session.role, "finance:view") ? prisma.clientInvoice.findMany({ where: { organizationId: session.organizationId, ...(projectIds !== undefined ? { projectId: { in: projectIds } } : {}), OR: [{ invoiceNumber: contains }, { project: { clientName: contains } }, { project: { name: contains } }] }, include: { project: { select: { name: true, clientName: true } } }, take: 8 }) : [],
    enabledModules.includes("documents") && can(session.role, "documents:view") ? prisma.businessDocument.findMany({ where: { organizationId: session.organizationId, OR: [{ documentNumber: contains }, { recipientName: contains }, { recipientEmail: contains }, { paymentReference: contains }] }, select: { id: true, documentNumber: true, type: true, recipientName: true, totalAmount: true, currency: true, issueDate: true }, take: 8 }) : [],
    enabledModules.includes("landing") && can(session.role, "landing:manage") ? prisma.lead.findMany({ where: { organizationId: session.organizationId, OR: [{ name: contains }, { email: contains }, { phone: contains }, { message: contains }] }, select: { id: true, name: true, email: true, phone: true, status: true }, take: 8 }) : []
  ]) : [[], [], [], [], [], [], []];
  const total = projects.length + vendors.length + items.length + employees.length + invoices.length + documents.length + leads.length;
  const visibleModules = appNavigation.flatMap((section) => section.items).filter((item) => can(session.role, item.permission) && (!item.module || enabledModules.includes(item.module))).slice(1, 9);

  return <div className="space-y-7">
    <PageHeader eyebrow="Find anything" title="Search Bizavo" description="Search connected records without knowing which module stores them." />
    <form className="relative max-w-3xl" action="/app/search" method="get"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input name="q" defaultValue={query} autoFocus placeholder="Try a project, client, employee, SKU, invoice or receipt number" className="h-14 rounded-2xl bg-white pl-12 pr-4 text-base shadow-sm" /></form>
    {!valid ? <Card><CardHeader><CardTitle>Browse modules</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{visibleModules.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl border p-3 hover:border-blue-200 hover:bg-blue-50/60"><div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{item.label}</p><p className="text-[11px] text-muted-foreground">{item.description}</p></div></Link>; })}</CardContent></Card> : null}
    {valid && !total ? <EmptyState icon={Search} title="No matching records" description={`Nothing in your accessible workspace matched “${query}”. Try a shorter name, code or reference.`} /> : null}
    {total ? <div className="grid gap-5 xl:grid-cols-2">
      {projects.length ? <ResultGroup title="Projects" icon={Building2}>{projects.map((item) => <ResultLink key={item.id} href={`/app/projects/${item.id}`} title={`${item.code} · ${item.name}`} meta={`${item.clientName} · ${item.location}`} />)}</ResultGroup> : null}
      {vendors.length ? <ResultGroup title="Vendors" icon={Store}>{vendors.map((item) => <ResultLink key={item.id} href="/app/procurement?view=vendors" title={`${item.code} · ${item.name}`} meta={`${item.category}${item.contactPerson ? ` · ${item.contactPerson}` : ""}`} />)}</ResultGroup> : null}
      {items.length ? <ResultGroup title="Inventory items" icon={Boxes}>{items.map((item) => <ResultLink key={item.id} href="/app/inventory?view=items" title={`${item.sku} · ${item.name}`} meta={`Tracked in ${item.unit}`} />)}</ResultGroup> : null}
      {employees.length ? <ResultGroup title="People" icon={UsersRound}>{employees.map((item) => <ResultLink key={item.id} href="/app/hr?view=directory" title={`${item.employeeCode} · ${item.name}`} meta={`${item.designation} · ${item.department}`} />)}</ResultGroup> : null}
      {invoices.length ? <ResultGroup title="Client invoices" icon={CircleDollarSign}>{invoices.map((item) => <ResultLink key={item.id} href="/app/finance?view=invoices" title={item.invoiceNumber} meta={`${item.project.clientName} · ${item.project.name} · ${money(item.totalAmount, session.currency)}`} />)}</ResultGroup> : null}
      {documents.length ? <ResultGroup title="Documents" icon={FileStack}>{documents.map((item) => <ResultLink key={item.id} href="/app/documents" title={item.documentNumber} meta={`${documentTitle(item.type)} · ${item.recipientName} · ${money(item.totalAmount, item.currency)} · ${shortDate(item.issueDate)}`} />)}</ResultGroup> : null}
      {leads.length ? <ResultGroup title="Leads" icon={ContactRound}>{leads.map((item) => <ResultLink key={item.id} href="/app/leads" title={item.name} meta={`${item.email ?? item.phone ?? "No contact"} · ${item.status}`} />)}</ResultGroup> : null}
    </div> : null}
  </div>;
}

function ResultGroup({ title, icon: Icon, children }: { title: string; icon: typeof Search; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-4 w-4 text-blue-600" />{title}</CardTitle></CardHeader><CardContent className="divide-y">{children}</CardContent></Card>;
}

function ResultLink({ href, title, meta }: { href: string; title: string; meta: string }) {
  return <Link href={href} className="block py-3 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-slate-950 hover:text-blue-600">{title}</p><p className="mt-1 text-xs text-muted-foreground">{meta}</p></Link>;
}
