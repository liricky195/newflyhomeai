export default function EditDetailsLoading() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-2 h-8 w-48 rounded-md bg-navy-700 shimmer" />
      <div className="mb-8 h-4 w-72 rounded-md bg-navy-700 shimmer" />
      <div className="space-y-6">
        <div className="h-16 rounded-lg bg-navy-700 shimmer" />
        <div className="h-16 rounded-lg bg-navy-700 shimmer" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 rounded-lg bg-navy-700 shimmer" />
          <div className="h-16 rounded-lg bg-navy-700 shimmer" />
        </div>
        <div className="h-12 rounded-lg bg-navy-700 shimmer" />
      </div>
    </div>
  );
}
