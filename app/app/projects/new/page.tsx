import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createProject } from "@/app/app/projects/actions";
import { AlertMessage } from "@/components/alert-message";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/session";

export const metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession("projects:manage");
  const query = await searchParams;
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <PageHeader
        eyebrow="Project setup"
        title="Create a project"
        description="A linked site store will be created automatically for material receipts and consumption."
        action={<Link href="/app/projects" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="h-4 w-4" />Back</Link>}
      />
      <AlertMessage error={query.error} />
      <Card>
        <CardContent className="p-6">
          <form action={createProject} className="grid gap-5 sm:grid-cols-2">
            <FormField label="Project name" className="sm:col-span-2"><Input name="name" placeholder="Lakeside Business Park" required /></FormField>
            <FormField label="Project code"><Input name="code" placeholder="LBP-001" required /></FormField>
            <FormField label="Status"><Select name="status" defaultValue="PLANNING"><option value="PLANNING">Planning</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option></Select></FormField>
            <FormField label="Client name"><Input name="clientName" placeholder="Meridian Developers" required /></FormField>
            <FormField label="Project location"><Input name="location" placeholder="Powai, Mumbai" required /></FormField>
            <FormField label="Client email"><Input name="clientEmail" type="email" placeholder="projects@client.com" /></FormField>
            <FormField label="Client phone"><Input name="clientPhone" placeholder="+91 98..." /></FormField>
            <FormField label="Start date"><Input name="startDate" type="date" required /></FormField>
            <FormField label="Expected end date"><Input name="endDate" type="date" /></FormField>
            <FormField label="Approved budget" hint="Internal project cost budget"><Input name="budget" type="number" min="1" step="0.01" placeholder="25000000" required /></FormField>
            <FormField label="Project description" className="sm:col-span-2"><Textarea name="description" placeholder="Scope, constraints and delivery context…" /></FormField>
            <div className="flex justify-end gap-3 border-t pt-5 sm:col-span-2">
              <Link href="/app/projects" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
