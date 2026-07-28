import { Bell, LogOut, Search } from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";

export function AppTopbar({
  userName,
  organizationName
}: {
  userName?: string | null;
  organizationName: string;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-semibold lg:hidden">Bizavo</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          <span className="font-medium text-foreground">{organizationName}</span>
          <span className="mx-2">/</span>
          Construction operations
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-[#071a5c] text-xs font-bold text-white">
          {initials(userName)}
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="icon" aria-label="Sign out" type="submit">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
