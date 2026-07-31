import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appNavigation } from "@/lib/app-navigation";
import { can } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { getEnabledModules } from "@/lib/subscription";

export const metadata = { title: "All modules" };

export default async function MenuPage() {
  const session = await requireSession();
  const enabledModules = await getEnabledModules(session.organizationId);
  return <div className="space-y-7">
    <PageHeader eyebrow="Workspace" title="All modules" description="Everything available to your role, grouped by the work you need to do." />
    <div className="grid gap-5 md:grid-cols-2">
      {appNavigation.map((section) => {
        const items = section.items.filter((item) => can(session.role, item.permission) && (!item.module || enabledModules.includes(item.module)));
        if (!items.length) return null;
        return <Card key={section.label}><CardHeader><CardTitle>{section.label}</CardTitle></CardHeader><CardContent className="grid gap-2">{items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-blue-100 hover:bg-blue-50/60"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-950">{item.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p></div></Link>; })}</CardContent></Card>;
      })}
    </div>
  </div>;
}
