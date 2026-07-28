import Link from "next/link";
import { Building2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f9fc] p-5 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page may be unpublished, removed or outside your organization.</p>
        <Link href="/app" className={`${buttonVariants()} mt-5`}>Return to Bizavo</Link>
      </div>
    </main>
  );
}
