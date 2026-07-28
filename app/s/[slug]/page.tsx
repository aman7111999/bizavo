import { notFound } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Layers3, Mail, MapPin, Phone } from "lucide-react";
import { submitWebsiteLead } from "@/app/s/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { enumLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicOrganizationPage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams: { error?: string; success?: string };
}) {
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    include: { landingPage: true }
  });
  if (!organization?.landingPage?.published) notFound();
  const landing = organization.landingPage;
  const projectIds = Array.isArray(landing.showcaseProjectIds) ? landing.showcaseProjectIds.map(String) : [];
  const projects = await prisma.project.findMany({
    where: { organizationId: organization.id, id: { in: projectIds } },
    orderBy: { startDate: "desc" }
  });
  const services = Array.isArray(landing.services) ? landing.services.map(String) : [];

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ "--brand": landing.primaryColor } as React.CSSProperties}>
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#071a5c] text-white"><Layers3 className="h-5 w-5" /></div><div><p className="font-bold">{organization.name}</p><p className="text-[9px] font-bold tracking-[0.2em] text-slate-400">BUILT WITH BIZAVO</p></div></div>
          <a href="#contact" className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: landing.primaryColor }}>Start a conversation</a>
        </div>
      </header>
      <section className="relative overflow-hidden bg-[#071a5c] text-white">
        <div className="absolute inset-0 opacity-45 [background:radial-gradient(circle_at_20%_30%,#245dff_0,transparent_32%),radial-gradient(circle_at_80%_75%,#00b8d9_0,transparent_26%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:py-32"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Construction, delivered with clarity</p><h1 className="mt-5 max-w-4xl text-balance text-4xl font-bold leading-tight sm:text-6xl">{landing.heroTitle}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">{landing.heroSubtitle}</p><a href="#projects" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#071a5c]">Explore our work <ArrowRight className="h-4 w-4" /></a></div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: landing.primaryColor }}>About us</p><h2 className="mt-3 text-3xl font-bold">{landing.aboutTitle}</h2></div><p className="text-lg leading-8 text-slate-600">{landing.aboutBody}</p></section>
      <section className="bg-slate-50 py-20"><div className="mx-auto max-w-7xl px-5"><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: landing.primaryColor }}>What we do</p><h2 className="mt-3 text-3xl font-bold">Built around your project</h2><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map((service, index) => <div key={service} className="rounded-2xl border bg-white p-6"><div className="grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: landing.primaryColor }}>{String(index + 1).padStart(2, "0")}</div><h3 className="mt-5 text-lg font-semibold">{service}</h3><p className="mt-2 text-sm leading-6 text-slate-500">Delivered with disciplined planning, transparent coordination and measurable progress.</p></div>)}</div></div></section>
      <section id="projects" className="mx-auto max-w-7xl px-5 py-20"><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: landing.primaryColor }}>Selected work</p><h2 className="mt-3 text-3xl font-bold">Projects that speak for us</h2>{projects.length ? <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{projects.map((project) => <article key={project.id} className="overflow-hidden rounded-2xl border"><div className="grid h-52 place-items-center bg-gradient-to-br from-slate-100 to-blue-100"><Building2 className="h-14 w-14 text-blue-300" /></div><div className="p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide" style={{ color: landing.primaryColor }}>{project.code}</p><span className="text-xs text-slate-400">{enumLabel(project.status)}</span></div><h3 className="mt-2 text-lg font-semibold">{project.name}</h3><p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" />{project.location}</p></div></article>)}</div> : <p className="mt-8 text-slate-500">Project showcase coming soon.</p>}</section>
      <section id="contact" className="bg-[#071a5c] py-20 text-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Contact</p><h2 className="mt-3 max-w-lg text-4xl font-bold">Let’s discuss what you’re building.</h2><p className="mt-5 max-w-lg text-blue-100">Share your project context. Your enquiry goes directly to our project team.</p><div className="mt-8 space-y-3 text-sm text-blue-100">{landing.contactEmail ? <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{landing.contactEmail}</p> : null}{landing.contactPhone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{landing.contactPhone}</p> : null}</div></div><form action={submitWebsiteLead.bind(null, params.slug)} className="grid gap-4 rounded-2xl bg-white p-6 text-slate-950 sm:grid-cols-2">{searchParams.error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{searchParams.error}</div> : null}{searchParams.success ? <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 sm:col-span-2"><CheckCircle2 className="h-4 w-4" />Thanks. Our team will contact you shortly.</div> : null}<label className="grid gap-1.5 text-sm font-medium">Name<Input name="name" required /></label><label className="grid gap-1.5 text-sm font-medium">Phone<Input name="phone" /></label><label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Email<Input name="email" type="email" /></label><label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Tell us about the project<Textarea name="message" className="min-h-32" required /></label><div className="sm:col-span-2"><Button type="submit" size="lg" style={{ backgroundColor: landing.primaryColor }}>Send enquiry <ArrowRight className="h-4 w-4" /></Button></div></form></div></section>
      <footer className="border-t bg-[#061544] py-6 text-blue-200"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 text-xs"><p>© {new Date().getFullYear()} {organization.name}</p><p>Operations powered by Bizavo · One Connected System</p></div></footer>
    </main>
  );
}
