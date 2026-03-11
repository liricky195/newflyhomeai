export default function RootLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 h-8 w-48 rounded-md bg-navy-700 shimmer" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 rounded-xl bg-navy-700 shimmer"
          />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-xl bg-navy-700 shimmer" />
    </div>
  );
}
