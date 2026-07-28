import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { projectScope } from "@/lib/session";
import { cn, enumLabel, money, shortDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: { error?: string; success?: string; status?: string };
}) {
  const { session, where } = await projectScope();
  const projects = await prisma.project.findMany({
    where: { ...where, ...(searchParams.status ? { status: searchParams.status as never } : {}) },
    include: {
      contracts: { select: { contractValue: true } },
      milestones: { select: { completionPercent: true } },
      phases: { select: { completion: true } }
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }]
  });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Project control"
        title="Projects"
        description="Contracts, milestones, delivery phases, documents and project financial health."
        action={<Link href="/app/projects/new" className={cn(buttonVariants(), "w-fit")}>New project</Link>}
      />
      <AlertMessage error={searchParams.error} success={searchParams.success} />
      <div className="flex flex-wrap gap-2">
        {["", "PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"].map((status) => (
          <Link
            key={status || "all"}
            href={status ? `/app/projects?status=${status}` : "/app/projects"}
            className={cn(buttonVariants({ variant: (searchParams.status ?? "") === status ? "default" : "outline", size: "sm" }))}
          >
            {status ? enumLabel(status) : "All"}
          </Link>
        ))}
      </div>
      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const milestoneProgress = project.milestones.length
              ? Math.round(project.milestones.reduce((sum, item) => sum + item.completionPercent, 0) / project.milestones.length)
              : project.phases.length
                ? Math.round(project.phases.reduce((sum, item) => sum + item.completion, 0) / project.phases.length)
                : 0;
            const contractValue = project.contracts.reduce((sum, contract) => sum + Number(contract.contractValue), 0);
            return (
              <Link key={project.id} href={`/app/projects/${project.id}`} className="group">
                <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary"><Building2 className="h-5 w-5" /></div>
                      <Badge variant={project.status === "ACTIVE" ? "success" : project.status === "ON_HOLD" ? "warning" : "secondary"}>{enumLabel(project.status)}</Badge>
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-wide text-primary">{project.code}</p>
                    <h2 className="mt-1 text-lg font-semibold group-hover:text-primary">{project.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{project.clientName}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{project.location}</div>
                    <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                      <div><p className="text-[11px] text-muted-foreground">Contract</p><p className="mt-0.5 text-sm font-semibold">{money(contractValue, session.currency)}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Budget</p><p className="mt-0.5 text-sm font-semibold">{money(project.budget, session.currency)}</p></div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs"><span>Overall progress</span><span className="font-semibold">{milestoneProgress}%</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${milestoneProgress}%` }} /></div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">{shortDate(project.startDate)} → {shortDate(project.endDate)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Building2} title="No projects found" description="Create a project or change the selected status filter." action={<Link href="/app/projects/new" className={buttonVariants()}>Create first project</Link>} />
      )}
    </div>
  );
}
