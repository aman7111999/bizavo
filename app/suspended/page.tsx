import { AlertTriangle, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { enumLabel, shortDate } from "@/lib/utils";

export const metadata = { title: "Workspace unavailable" };

export default async function SuspendedPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");
  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    include: { subscription: { include: { plan: { select: { name: true } } } } }
  });
  if (!organization) redirect("/login");
  if (organization.status === "ACTIVE") redirect("/app");

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-5 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle className="h-7 w-7" /></div>
          <CardTitle>{organization.name} is currently {organization.status.toLowerCase()}</CardTitle>
          <p className="max-w-md text-sm text-muted-foreground">Workspace access is paused at the platform level. Your company data is retained and has not been deleted.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-semibold">{organization.subscription?.plan.name ?? "Unassigned"}</p></div>
              <div><p className="text-xs text-muted-foreground">Subscription</p><p className="font-semibold">{organization.subscription ? enumLabel(organization.subscription.status) : "None"}</p></div>
              <div><p className="text-xs text-muted-foreground">Paused on</p><p className="font-semibold">{shortDate(organization.suspendedAt)}</p></div>
              <div><p className="text-xs text-muted-foreground">Reason</p><p className="font-semibold">{organization.suspensionReason ?? "Contact Bizavo support for details."}</p></div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">Contact your Bizavo account administrator to resolve billing or access status.</p>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }} className="flex justify-center">
            <Button type="submit" variant="outline"><LogOut className="h-4 w-4" />Sign out</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
