export default function ApplicationLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 rounded-xl border bg-white" />)}
      </div>
      <div className="h-96 rounded-xl border bg-white" />
    </div>
  );
}
