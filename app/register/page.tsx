import Link from "next/link";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AlertMessage } from "@/components/alert-message";
import { FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(2),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/)
});

export const metadata = { title: "Create workspace" };

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  async function register(formData: FormData) {
    "use server";
    const parsed = registerSchema.safeParse({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      organizationName: String(formData.get("organizationName") ?? "").trim(),
      slug: slugify(String(formData.get("slug") ?? ""))
    });
    if (!parsed.success) redirect(`/register?error=${encodeURIComponent("Check all fields. Password must be at least 8 characters.")}`);
    const duplicate = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (duplicate) redirect(`/register?error=${encodeURIComponent("An account with that email already exists.")}`);
    const slugExists = await prisma.organization.findUnique({ where: { slug: parsed.data.slug } });
    if (slugExists) redirect(`/register?error=${encodeURIComponent("That workspace URL is already taken.")}`);
    const passwordHash = await hash(parsed.data.password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: parsed.data.name, email: parsed.data.email, passwordHash }
      });
      const organization = await tx.organization.create({
        data: {
          name: parsed.data.organizationName,
          slug: parsed.data.slug,
          industry: "CONSTRUCTION",
          memberships: { create: { userId: user.id, role: "OWNER" } },
          landingPage: {
            create: {
              heroTitle: `Building with ${parsed.data.organizationName}`,
              heroSubtitle: "Reliable construction delivery, transparent progress and uncompromising quality.",
              aboutTitle: "Built on trust",
              aboutBody: "We manage every project with disciplined planning, clear communication and attention to detail.",
              services: ["General contracting", "Project management", "Civil and structural works"],
              showcaseProjectIds: [],
              contactEmail: parsed.data.email
            }
          }
        }
      });
      const accounts = [
        ["1000", "Cash and bank", "ASSET"], ["1100", "Accounts receivable", "ASSET"], ["1300", "Inventory asset", "ASSET"],
        ["1400", "Input tax credit", "ASSET"], ["2000", "Accounts payable", "LIABILITY"], ["2100", "Payroll payable", "LIABILITY"],
        ["2200", "Output tax payable", "LIABILITY"], ["3000", "Owner's equity", "EQUITY"], ["4000", "Construction revenue", "REVENUE"],
        ["5000", "Direct material cost", "EXPENSE"], ["5100", "Subcontractor cost", "EXPENSE"], ["5200", "Direct labour cost", "EXPENSE"],
        ["5300", "Site operating expenses", "EXPENSE"], ["6000", "Administrative expenses", "EXPENSE"]
      ] as const;
      await tx.chartAccount.createMany({
        data: accounts.map(([code, name, type]) => ({ organizationId: organization.id, code, name, type, system: true }))
      });
      await tx.inventoryLocation.create({
        data: {
          organizationId: organization.id,
          name: "Central Warehouse",
          code: "WH-CENTRAL",
          type: "CENTRAL_WAREHOUSE"
        }
      });
    });
    redirect("/login?registered=1");
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center"><p className="text-2xl font-bold text-[#071a5c]">Bizavo</p><p className="mt-1 text-xs font-semibold tracking-[0.2em] text-primary">CREATE YOUR CONSTRUCTION OS</p></div>
        <AlertMessage error={searchParams.error} />
        <Card className="mt-5">
          <CardHeader><CardTitle>Create your organization</CardTitle><p className="text-sm text-muted-foreground">You’ll be the Owner and can invite your team after signing in.</p></CardHeader>
          <CardContent><form action={register} className="grid gap-4 sm:grid-cols-2"><FormField label="Your name"><Input name="name" required /></FormField><FormField label="Work email"><Input name="email" type="email" required /></FormField><FormField label="Password"><Input name="password" type="password" minLength={8} required /></FormField><FormField label="Company name"><Input name="organizationName" required /></FormField><FormField label="Workspace URL" hint="bizavo.vercel.app/s/your-company" className="sm:col-span-2"><Input name="slug" placeholder="your-company" pattern="[a-z0-9-]+" required /></FormField><div className="mt-2 flex justify-end gap-3 border-t pt-5 sm:col-span-2"><Link href="/login" className={buttonVariants({ variant: "outline" })}>Back to sign in</Link><Button type="submit">Create workspace</Button></div></form></CardContent>
        </Card>
      </div>
    </main>
  );
}
