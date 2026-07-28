import Link from "next/link";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { AlertMessage } from "@/components/alert-message";
import { FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { enumLabel } from "@/lib/utils";

export default async function InvitePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const route = await params;
  const query = await searchParams;
  const invite = await prisma.organizationInvite.findUnique({
    where: { token: route.token },
    include: { organization: { select: { name: true } } }
  });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();

  async function accept(formData: FormData) {
    "use server";
    const currentInvite = await prisma.organizationInvite.findUnique({ where: { token: route.token } });
    if (!currentInvite || currentInvite.acceptedAt || currentInvite.expiresAt <= new Date()) redirect(`/invite/${route.token}?error=This invite is invalid or expired.`);
    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (name.length < 2 || password.length < 8) redirect(`/invite/${route.token}?error=Enter your name and a password of at least 8 characters.`);
    const existing = await prisma.user.findUnique({ where: { email: currentInvite.email } });
    if (existing) redirect(`/invite/${route.token}?error=An account already exists for this email. Ask the administrator for a fresh membership invite.`);
    const passwordHash = await hash(password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email: currentInvite.email, passwordHash } });
      await tx.membership.create({
        data: { organizationId: currentInvite.organizationId, userId: user.id, role: currentInvite.role }
      });
      const employee = await tx.employee.findFirst({
        where: {
          organizationId: currentInvite.organizationId,
          email: currentInvite.email,
          userId: null
        },
        select: { id: true }
      });
      if (employee) await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
      await tx.organizationInvite.update({ where: { id: currentInvite.id }, data: { acceptedAt: new Date() } });
    });
    redirect("/login");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f9fc] p-5">
      <Card className="w-full max-w-lg">
        <CardHeader><p className="text-sm font-bold text-primary">BIZAVO INVITATION</p><CardTitle>{valid ? `Join ${invite.organization.name}` : "Invite unavailable"}</CardTitle>{valid ? <p className="text-sm text-muted-foreground">You’re invited as {enumLabel(invite.role)} using {invite.email}.</p> : null}</CardHeader>
        <CardContent>
          <AlertMessage error={query.error} />
          {valid ? <form action={accept} className="mt-4 grid gap-4"><FormField label="Full name"><Input name="name" required /></FormField><FormField label="Email"><Input value={invite.email} disabled /></FormField><FormField label="Create password"><Input name="password" type="password" minLength={8} required /></FormField><Button type="submit">Accept invitation</Button></form> : <div className="mt-4"><p className="text-sm text-muted-foreground">The link has expired, was already used, or does not exist.</p><Link href="/login" className={`${buttonVariants({ variant: "outline" })} mt-4`}>Back to sign in</Link></div>}
        </CardContent>
      </Card>
    </main>
  );
}
