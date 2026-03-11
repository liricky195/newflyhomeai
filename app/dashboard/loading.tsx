export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 h-8 w-48 rounded-md bg-navy-700 shimmer" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-navy-700 shimmer" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-navy-700 shimmer" />
        ))}
      </div>
    </div>
  );
}
