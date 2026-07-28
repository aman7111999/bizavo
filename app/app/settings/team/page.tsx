import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { assignProjectAccess, createTeamInvite, removeProjectAccess, revokeTeamInvite, updateMemberRole } from "@/app/app/settings/team/actions";
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
import { requireSession } from "@/lib/session";
import { enumLabel, shortDate } from "@/lib/utils";

export const metadata = { title: "Team & roles" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const session = await requireSession("members:manage");
  const query = await searchParams;
  const [members, invites, projects] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: session.organizationId },
      include: {
        user: { select: { name: true, email: true } },
        projectMembers: { include: { project: { select: { name: true } } } }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.organizationInvite.findMany({
      where: { organizationId: session.organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.project.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    })
  ]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Access control" title="Team & roles" description="Organization membership, role-based access and project-restricted site engineers." />
      <AlertMessage error={query.error} success={query.success} />
      <Card>
        <CardHeader><CardTitle>Organization members</CardTitle></CardHeader>
        <CardContent>
          {members.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead>Project access</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell><p className="font-semibold">{member.user.name ?? "Unnamed user"}</p><p className="text-xs text-muted-foreground">{member.user.email}</p></TableCell>
                    <TableCell>
                      {member.role === "OWNER" || member.userId === session.user.id ? (
                        <Badge variant={member.role === "OWNER" ? "default" : "secondary"}>{enumLabel(member.role)}</Badge>
                      ) : (
                        <form action={updateMemberRole} className="flex min-w-60 items-center gap-2">
                          <input type="hidden" name="membershipId" value={member.id} />
                          <Select name="role" defaultValue={member.role}>
                            <option value="ADMIN">Admin</option><option value="PROJECT_MANAGER">Project Manager</option><option value="SITE_ENGINEER">Site Engineer</option><option value="PROCUREMENT">Procurement</option><option value="HR">HR</option><option value="ACCOUNTANT">Accountant</option><option value="VIEWER">Viewer</option>
                          </Select>
                          <Button type="submit" size="sm" variant="outline">Save</Button>
                        </form>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.role === "SITE_ENGINEER" ? (
                        member.projectMembers.length ? <div className="flex flex-wrap gap-2">{member.projectMembers.map((item) => <form key={item.id} action={removeProjectAccess} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs"><input type="hidden" name="projectMemberId" value={item.id} /><span>{item.project.name}</span><button type="submit" className="font-bold text-red-600" aria-label={`Remove ${item.project.name}`}>×</button></form>)}</div> : "No projects assigned"
                      ) : "Organization-wide as permitted"}
                    </TableCell>
                    <TableCell>{shortDate(member.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <EmptyState icon={UsersRound} title="No team members" description="Invite teammates and assign the role that matches their responsibilities." />}
        </CardContent>
      </Card>
      <section className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Invite team member</CardTitle><p className="text-sm text-muted-foreground">Invite links expire after seven days. Email delivery is deferred; copy and share the link.</p></CardHeader><CardContent><form action={createTeamInvite} className="grid gap-4"><FormField label="Email"><Input name="email" type="email" required /></FormField><FormField label="Role"><Select name="role"><option value="ADMIN">Admin</option><option value="PROJECT_MANAGER">Project Manager</option><option value="SITE_ENGINEER">Site Engineer</option><option value="PROCUREMENT">Procurement</option><option value="HR">HR</option><option value="ACCOUNTANT">Accountant</option><option value="VIEWER">Viewer</option></Select></FormField><Button type="submit">Create invite link</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Pending invitations</CardTitle></CardHeader><CardContent>{invites.length ? <div className="space-y-3">{invites.map((invite) => <div key={invite.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{invite.email}</p><p className="mt-1 text-xs text-muted-foreground">{enumLabel(invite.role)} · expires {shortDate(invite.expiresAt)}</p></div><form action={revokeTeamInvite}><input type="hidden" name="inviteId" value={invite.id} /><Button type="submit" size="sm" variant="outline">Revoke</Button></form></div><div className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">{appUrl}/invite/{invite.token}</div></div>)}</div> : <EmptyState icon={ShieldCheck} title="No pending invites" description="New invite links will appear here until accepted or expired." />}</CardContent></Card>
      </section>
      {members.some((member) => member.role === "SITE_ENGINEER") ? (
        <Card>
          <CardHeader><CardTitle>Assign site engineer project access</CardTitle><p className="text-sm text-muted-foreground">Site Engineers can see only projects explicitly assigned here.</p></CardHeader>
          <CardContent>
            <form action={assignProjectAccess} className="flex flex-wrap items-end gap-4">
              <FormField label="Site engineer"><Select name="membershipId" required><option value="">Select member</option>{members.filter((member) => member.role === "SITE_ENGINEER").map((member) => <option key={member.id} value={member.id}>{member.user.name} · {member.user.email}</option>)}</Select></FormField>
              <FormField label="Project"><Select name="projectId" required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</Select></FormField>
              <Button type="submit">Assign project</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
