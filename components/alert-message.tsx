export function AlertMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {error ?? success}
    </div>
  );
}
