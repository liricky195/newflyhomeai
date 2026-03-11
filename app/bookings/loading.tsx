export default function BookingsLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 h-8 w-40 animate-pulse rounded bg-slate-700" />
      <div className="mb-8 h-4 w-64 animate-pulse rounded bg-slate-700" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border-l-4 border-slate-700 bg-slate-900 p-5">
            <div className="mb-3 flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-700" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-700" />
              </div>
              <div className="h-5 w-20 animate-pulse rounded-full bg-slate-700" />
            </div>
            <div className="mb-4 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-700" />
              <div className="h-8 w-40 animate-pulse rounded bg-slate-700" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-700" />
              <div className="h-5 w-36 animate-pulse rounded bg-slate-700" />
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
