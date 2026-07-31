import Link from "next/link";
import { CheckCircle2, Download, FileCheck2, FilePlus2, Mail, MessageCircle, ReceiptText, Send, ShieldCheck } from "lucide-react";
import { shareBusinessDocument, voidBusinessDocument } from "@/app/app/documents/actions";
import { AlertMessage } from "@/components/alert-message";
import { DocumentComposer } from "@/components/document-composer";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appOrigin, communicationConfiguration, documentTitle, normalizeWhatsAppPhone } from "@/lib/business-documents";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cn, enumLabel, money, shortDate } from "@/lib/utils";

export const metadata = { title: "Documents & receipts" };

export default async function DocumentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; view?: string; share?: string; channel?: string; recipient?: string; document?: string; created?: string }>;
}) {
  const session = await requireSession("documents:view");
  const query = await searchParams;
  const view = query.view ?? "all";
  const manage = can(session.role, "documents:manage");
  const [documents, projects, shares] = await Promise.all([
    prisma.businessDocument.findMany({
      where: { organizationId: session.organizationId },
      include: {
        project: { select: { name: true, code: true } },
        shares: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 200
    }),
    prisma.project.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, code: true, clientName: true, clientEmail: true, clientPhone: true, location: true },
      orderBy: { name: "asc" }
    }),
    prisma.documentShare.findMany({
      where: { organizationId: session.organizationId },
      include: { document: { select: { documentNumber: true, type: true, recipientName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);
  const providers = communicationConfiguration();
  const preparedUrl = query.share ? `${appOrigin()}/share/${query.share}` : null;
  const preparedMessage = preparedUrl && query.document ? `Your Bizavo document ${query.document} is ready: ${preparedUrl}` : "";
  const fallbackHref = preparedUrl && query.channel === "WHATSAPP"
    ? `https://wa.me/${normalizeWhatsAppPhone(query.recipient ?? "")}?text=${encodeURIComponent(preparedMessage)}`
    : preparedUrl
      ? `mailto:${encodeURIComponent(query.recipient ?? "")}?subject=${encodeURIComponent(`Document ${query.document ?? ""}`)}&body=${encodeURIComponent(preparedMessage)}`
      : null;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Document studio"
        title="Documents & receipts"
        description="Create, download and deliver professional receipts, quotes and proforma invoices from one auditable workspace."
        action={manage ? <Link href="/app/documents?view=create" className={buttonVariants({ size: "lg" })}><FilePlus2 className="h-4 w-4" />Create document</Link> : undefined}
      />
      <AlertMessage error={query.error} success={query.success} />

      {fallbackHref ? (
        <Card className="border-blue-200 bg-blue-50/70">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white"><Send className="h-4 w-4" /></div>
              <div><p className="font-semibold text-slate-950">Secure link is ready</p><p className="mt-1 text-sm text-slate-600">Automatic provider delivery is not configured, so send it from your device. The link expires in 30 days.</p></div>
            </div>
            <a href={fallbackHref} target="_blank" rel="noreferrer" className={buttonVariants()}>{query.channel === "WHATSAPP" ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}Open {query.channel === "WHATSAPP" ? "WhatsApp" : "email"}</a>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[["all", "All documents"], ["create", "Create"], ["delivery", "Delivery log"]].filter(([value]) => value !== "create" || manage).map(([value, label]) => (
          <Link key={value} href={`/app/documents?view=${value}`} className={buttonVariants({ variant: view === value ? "default" : "outline", size: "sm" })}>{label}</Link>
        ))}
      </div>

      {view === "all" ? (
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="p-5"><ReceiptText className="h-5 w-5 text-blue-600" /><p className="mt-4 text-2xl font-bold">{documents.length}</p><p className="text-xs text-muted-foreground">Documents created</p></CardContent></Card>
            <Card><CardContent className="p-5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-2xl font-bold">{documents.filter((document) => document.type === "PAYMENT_RECEIPT").length}</p><p className="text-xs text-muted-foreground">Payment receipts</p></CardContent></Card>
            <Card><CardContent className="p-5"><Mail className="h-5 w-5 text-violet-600" /><p className="mt-4 text-2xl font-bold">{shares.filter((share) => share.channel === "EMAIL" && share.status === "SENT").length}</p><p className="text-xs text-muted-foreground">Emails delivered</p></CardContent></Card>
            <Card><CardContent className="p-5"><MessageCircle className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-2xl font-bold">{shares.filter((share) => share.channel === "WHATSAPP" && share.status === "SENT").length}</p><p className="text-xs text-muted-foreground">WhatsApp delivered</p></CardContent></Card>
          </section>
          <Card>
            <CardHeader><CardTitle>Document register</CardTitle></CardHeader>
            <CardContent>
              {documents.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Recipient</TableHead><TableHead>Project</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-[260px]">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow key={document.id} className={cn(query.created === document.id && "bg-blue-50")}>
                        <TableCell><p className="font-semibold">{document.documentNumber}</p><p className="text-xs text-muted-foreground">{documentTitle(document.type)}</p></TableCell>
                        <TableCell><p className="font-medium">{document.recipientName}</p><p className="text-xs text-muted-foreground">{document.recipientEmail ?? document.recipientPhone ?? "No delivery contact"}</p></TableCell>
                        <TableCell>{document.project ? <><p>{document.project.name}</p><p className="text-xs text-muted-foreground">{document.project.code}</p></> : "—"}</TableCell>
                        <TableCell>{shortDate(document.issueDate)}</TableCell>
                        <TableCell><Badge variant={document.status === "ISSUED" ? "success" : document.status === "VOID" ? "destructive" : "secondary"}>{enumLabel(document.status)}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{money(document.totalAmount, document.currency)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <a href={`/api/business-documents/${document.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}><Download className="h-3.5 w-3.5" />PDF</a>
                            {manage && document.status === "ISSUED" ? (
                              <details className="relative">
                                <summary className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer list-none")}><Send className="h-3.5 w-3.5" />Share</summary>
                                <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border bg-white p-4 shadow-xl">
                                  <form action={shareBusinessDocument} className="space-y-3">
                                    <input type="hidden" name="documentId" value={document.id} />
                                    <FormField label="Channel"><Select name="channel"><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option></Select></FormField>
                                    <FormField label="Recipient"><Input name="recipient" defaultValue={document.recipientEmail ?? document.recipientPhone ?? ""} placeholder="Email or WhatsApp number" required /></FormField>
                                    <Button type="submit" size="sm" className="w-full">Send secure link</Button>
                                  </form>
                                </div>
                              </details>
                            ) : null}
                            {manage && document.status === "ISSUED" && !document.clientPaymentId ? <form action={voidBusinessDocument}><input type="hidden" name="documentId" value={document.id} /><Button type="submit" variant="ghost" size="sm">Void</Button></form> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <EmptyState icon={FileCheck2} title="No documents yet" description="Create a receipt or quote, or record a client payment to generate a receipt automatically." action={manage ? <Link href="/app/documents?view=create" className={buttonVariants()}>Create first document</Link> : undefined} />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === "create" && manage ? <Card><CardHeader><CardTitle>Create a business document</CardTitle><p className="text-sm text-muted-foreground">The number, totals and PDF are generated by Bizavo and saved to the organization register.</p></CardHeader><CardContent><DocumentComposer projects={projects} currency={session.currency} /></CardContent></Card> : null}

      {view === "delivery" ? (
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="flex items-start gap-3 p-5"><div className={cn("grid h-10 w-10 place-items-center rounded-xl", providers.email ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}><Mail className="h-4 w-4" /></div><div><p className="font-semibold">Email provider</p><p className="mt-1 text-sm text-muted-foreground">{providers.email ? "Configured for automatic delivery." : "Not configured. Users receive a secure mail-app share action."}</p></div></CardContent></Card>
            <Card><CardContent className="flex items-start gap-3 p-5"><div className={cn("grid h-10 w-10 place-items-center rounded-xl", providers.whatsapp ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}><MessageCircle className="h-4 w-4" /></div><div><p className="font-semibold">WhatsApp Business</p><p className="mt-1 text-sm text-muted-foreground">{providers.whatsapp ? "Configured with an approved document template." : "Not configured. Users receive a secure WhatsApp share action."}</p></div></CardContent></Card>
          </section>
          <Card><CardHeader><CardTitle>Delivery audit</CardTitle></CardHeader><CardContent>{shares.length ? <Table><TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Document</TableHead><TableHead>Channel</TableHead><TableHead>Recipient</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader><TableBody>{shares.map((share) => <TableRow key={share.id}><TableCell>{shortDate(share.createdAt)}</TableCell><TableCell><p className="font-medium">{share.document.documentNumber}</p><p className="text-xs text-muted-foreground">{share.document.recipientName}</p></TableCell><TableCell>{enumLabel(share.channel)}</TableCell><TableCell>{share.recipient}</TableCell><TableCell><Badge variant={share.status === "SENT" ? "success" : share.status === "FAILED" ? "destructive" : "warning"}>{enumLabel(share.status)}</Badge>{share.errorMessage ? <p className="mt-1 max-w-xs text-xs text-red-600">{share.errorMessage}</p> : null}</TableCell><TableCell>{shortDate(share.expiresAt)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={ShieldCheck} title="No delivery activity" description="Every email, WhatsApp send, and prepared secure link is recorded here." />}</CardContent></Card>
        </div>
      ) : null}
    </div>
  );
}
