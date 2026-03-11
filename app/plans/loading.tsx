export default function PlansLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="h-8 w-56 rounded-md bg-navy-700 shimmer" />
        <div className="h-4 w-72 rounded-md bg-navy-700 shimmer" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-navy-700 shimmer" />
        ))}
      </div>
    </div>
  );
}
