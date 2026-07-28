import { PlatformRole } from "@prisma/client";
import { ShieldCheck, UserPlus } from "lucide-react";
import { setPlatformAdministratorActive, upsertPlatformAdministrator } from "@/app/control/actions";
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
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/subscription";
import { enumLabel, shortDate } from "@/lib/utils";

export const metadata = { title: "Platform access" };

export default async function PlatformAdminsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { role } = await requirePlatformAdmin();
  const query = await searchParams;
  const administrators = await prisma.platformAdministrator.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" }
  });
  const canManage = role === PlatformRole.SUPER_ADMIN;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Security" title="Platform access" description="Global Bizavo access is separate from organization roles. Use the least-privileged role and keep the bootstrap email allowlist private." />
      <AlertMessage error={query.error} success={query.success} />
      <Card>
        <CardHeader><CardTitle>Database administrators</CardTitle></CardHeader>
        <CardContent>
          {administrators.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Administrator</TableHead><TableHead>Platform role</TableHead><TableHead>Status</TableHead><TableHead>Added</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {administrators.map((administrator) => <TableRow key={administrator.id}><TableCell><p className="font-semibold">{administrator.user.name ?? "Unnamed user"}</p><p className="text-xs text-muted-foreground">{administrator.user.email}</p></TableCell><TableCell>{enumLabel(administrator.role)}</TableCell><TableCell><Badge variant={administrator.active ? "success" : "secondary"}>{administrator.active ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{shortDate(administrator.createdAt)}</TableCell><TableCell>{canManage ? <form action={setPlatformAdministratorActive}><input type="hidden" name="adminId" value={administrator.id} /><input type="hidden" name="active" value={administrator.active ? "false" : "true"} /><Button type="submit" size="sm" variant="outline">{administrator.active ? "Deactivate" : "Activate"}</Button></form> : null}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          ) : <EmptyState icon={ShieldCheck} title="No database administrators" description="Access can still be bootstrapped using PLATFORM_ADMIN_EMAILS, then saved here." />}
        </CardContent>
      </Card>
      {canManage ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Add or update administrator</CardTitle><p className="text-sm text-muted-foreground">The person must already have a Bizavo login. Saving an existing email updates its platform role and activates access.</p></CardHeader>
          <CardContent>
            <form action={upsertPlatformAdministrator} className="flex flex-wrap items-end gap-4">
              <FormField label="Existing user email"><Input name="email" type="email" className="w-72" required /></FormField>
              <FormField label="Platform role"><Select name="role" className="w-52"><option value="SUPPORT">Support · view only</option><option value="BILLING">Billing · subscriptions & payments</option><option value="SUPER_ADMIN">Super Admin · full control</option></Select></FormField>
              <Button type="submit">Save administrator</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
