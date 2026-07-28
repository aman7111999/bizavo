import Link from "next/link";
import { ExternalLink, Globe2 } from "lucide-react";
import { updateLandingPage } from "@/app/app/settings/landing/actions";
import { AlertMessage } from "@/components/alert-message";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Public page" };

export default async function LandingSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const session = await requireSession("landing:manage");
  const query = await searchParams;
  const [landing, projects] = await Promise.all([
    prisma.landingPage.findUnique({ where: { organizationId: session.organizationId } }),
    prisma.project.findMany({ where: { organizationId: session.organizationId }, orderBy: { startDate: "desc" } })
  ]);
  const services = Array.isArray(landing?.services) ? landing.services.map(String).join("\n") : "";
  const selected = new Set(Array.isArray(landing?.showcaseProjectIds) ? landing.showcaseProjectIds.map(String) : []);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="No-code website"
        title="Public company page"
        description="Edit your company story and turn website enquiries into CRM leads."
        action={<Link href={`/s/${session.organizationSlug}`} target="_blank" className={buttonVariants({ variant: "outline" })}><ExternalLink className="h-4 w-4" />Open public page</Link>}
      />
      <AlertMessage error={query.error} success={query.success} />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" />Page content</CardTitle><p className="text-sm text-muted-foreground">Your page is available at /s/{session.organizationSlug}</p></CardHeader>
        <CardContent>
          <form action={updateLandingPage} className="grid gap-5 sm:grid-cols-2">
            <FormField label="Hero title" className="sm:col-span-2"><Input name="heroTitle" defaultValue={landing?.heroTitle ?? `Building with ${session.organizationName}`} required /></FormField>
            <FormField label="Hero subtitle" className="sm:col-span-2"><Textarea name="heroSubtitle" defaultValue={landing?.heroSubtitle ?? "Reliable construction delivery, transparent progress and uncompromising quality."} required /></FormField>
            <FormField label="About section title"><Input name="aboutTitle" defaultValue={landing?.aboutTitle ?? "Built on trust"} required /></FormField>
            <FormField label="Brand accent"><Input name="primaryColor" type="color" defaultValue={landing?.primaryColor ?? "#245DFF"} /></FormField>
            <FormField label="About copy" className="sm:col-span-2"><Textarea name="aboutBody" className="min-h-32" defaultValue={landing?.aboutBody ?? ""} required /></FormField>
            <FormField label="Services" hint="One service per line, maximum eight" className="sm:col-span-2"><Textarea name="services" className="min-h-40" defaultValue={services} /></FormField>
            <FormField label="Contact email"><Input name="contactEmail" type="email" defaultValue={landing?.contactEmail ?? ""} /></FormField>
            <FormField label="Contact phone"><Input name="contactPhone" defaultValue={landing?.contactPhone ?? ""} /></FormField>
            <div className="sm:col-span-2"><p className="text-sm font-medium">Project showcase</p><p className="mt-1 text-xs text-muted-foreground">Select projects to display publicly.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.map((project) => <label key={project.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" name="showcaseProjectIds" value={project.id} defaultChecked={selected.has(project.id)} className="mt-1" /><span><span className="font-medium">{project.name}</span><span className="block text-xs text-muted-foreground">{project.clientName} · {project.location}</span></span></label>)}</div></div>
            <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-4 text-sm font-medium sm:col-span-2"><input type="checkbox" name="published" defaultChecked={landing?.published ?? true} />Publish this page</label>
            <div className="flex justify-end border-t pt-5 sm:col-span-2"><Button type="submit">Save public page</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
