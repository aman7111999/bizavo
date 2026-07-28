import { ContactRound } from "lucide-react";
import { updateLeadStatus } from "@/app/app/leads/actions";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { enumLabel, shortDate } from "@/lib/utils";

export const metadata = { title: "Website leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const session = await requireSession("landing:manage");
  const query = await searchParams;
  const leads = await prisma.lead.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Simple CRM" title="Website leads" description="Enquiries submitted through your public company page." />
      <AlertMessage error={query.error} success={query.success} />
      <Card><CardHeader><CardTitle>Contact enquiries</CardTitle></CardHeader><CardContent>{leads.length ? <Table><TableHeader><TableRow><TableHead>Received</TableHead><TableHead>Contact</TableHead><TableHead>Message</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{leads.map((lead) => <TableRow key={lead.id}><TableCell>{shortDate(lead.createdAt)}</TableCell><TableCell><p className="font-semibold">{lead.name}</p><p className="text-xs text-muted-foreground">{lead.email ?? lead.phone}</p></TableCell><TableCell className="max-w-md"><p className="line-clamp-3 text-sm text-muted-foreground">{lead.message}</p></TableCell><TableCell>{lead.source}</TableCell><TableCell><Badge variant={lead.status === "WON" ? "success" : lead.status === "LOST" ? "destructive" : lead.status === "NEW" ? "warning" : "secondary"}>{enumLabel(lead.status)}</Badge></TableCell><TableCell><form action={updateLeadStatus} className="flex min-w-56 gap-2"><input type="hidden" name="leadId" value={lead.id} /><Select name="status" defaultValue={lead.status}><option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="QUALIFIED">Qualified</option><option value="WON">Won</option><option value="LOST">Lost</option></Select><Button type="submit" variant="outline">Save</Button></form></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={ContactRound} title="No website leads" description="New enquiries from your public page will land here automatically." />}</CardContent></Card>
    </div>
  );
}
