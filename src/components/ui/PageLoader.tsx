export function PageLoader() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-slate-200/60" />
    </div>
  )
}
