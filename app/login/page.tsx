import { redirect } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Layers3 } from "lucide-react";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  if (session) redirect("/app");

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/app"
      });
    } catch (error) {
      if (error instanceof AuthError) redirect("/login?error=Invalid email or password");
      throw error;
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#06164d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_20%,#245dff_0,transparent_30%),radial-gradient(circle_at_80%_75%,#00b8d9_0,transparent_28%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-300 text-[#06164d]">
            <Layers3 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold">Bizavo</p>
            <p className="text-[10px] font-semibold tracking-[0.26em] text-blue-200">ONE CONNECTED SYSTEM</p>
          </div>
        </div>
        <div className="relative z-10 max-w-2xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
            <Building2 className="h-3.5 w-3.5" />
            Construction OS
          </span>
          <h1 className="text-balance text-5xl font-semibold leading-[1.08]">
            Projects, materials, people and money in one calm workspace.
          </h1>
          <div className="mt-8 grid gap-3 text-sm text-blue-100 sm:grid-cols-2">
            {["Project profitability", "PO approval and receipts", "Site inventory control", "Workforce and payroll"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-blue-200">Built for construction companies that need operational truth, not more spreadsheets.</p>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#071a5c] text-white">
              <Layers3 className="h-5 w-5" />
            </div>
            <p className="text-xl font-bold text-[#071a5c]">Bizavo</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Sign in to your workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">Use the demo account below or your organization credentials.</p>
          {searchParams.error ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {searchParams.error}
            </div>
          ) : null}
          <form action={login} className="mt-7 grid gap-5">
            <FormField label="Work email">
              <Input name="email" type="email" defaultValue="owner@demo.bizavo.in" required autoComplete="email" />
            </FormField>
            <FormField label="Password">
              <Input name="password" type="password" defaultValue="Bizavo@2026" minLength={8} required autoComplete="current-password" />
            </FormField>
            <Button type="submit" size="lg" className="mt-1 w-full">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            New construction company? <a href="/register" className="font-semibold text-primary">Create a workspace</a>
          </p>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold">Demo workspace</p>
            <p className="mt-1 text-muted-foreground">owner@demo.bizavo.in · Bizavo@2026</p>
          </div>
        </div>
      </section>
    </main>
  );
}
