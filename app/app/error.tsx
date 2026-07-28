"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApplicationError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600"><AlertTriangle className="h-6 w-6" /></div>
        <h2 className="mt-5 text-xl font-bold">This view could not be loaded</h2>
        <p className="mt-2 text-sm text-muted-foreground">No changes were made. Retry the request, or return to the overview if the problem continues.</p>
        <Button onClick={reset} className="mt-5"><RotateCcw className="h-4 w-4" />Try again</Button>
      </div>
    </div>
  );
}
