export default function FlightsLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header bar skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 rounded-md bg-navy-700 shimmer" />
          <div className="h-5 w-48 rounded bg-navy-700 shimmer" />
        </div>
        <div className="h-5 w-32 rounded bg-navy-700 shimmer" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border bg-navy-700">
        {/* Column headers */}
        <div className="hidden border-b border-border px-4 py-3 md:grid md:grid-cols-7 md:gap-4">
          {["Flight №", "Airline", "Destination", "Gate", "Scheduled", "Status", "Action"].map(
            (col) => (
              <div key={col} className="h-4 w-20 rounded bg-navy-600 shimmer" />
            )
          )}
        </div>

        {/* 7 skeleton rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-0 md:grid md:grid-cols-7 md:items-center md:gap-4"
          >
            {/* Flight № */}
            <div className="h-4 w-16 rounded bg-navy-600 shimmer font-mono" />
            {/* Airline */}
            <div className="h-4 w-24 rounded bg-navy-600 shimmer" />
            {/* Destination */}
            <div className="h-4 w-12 rounded bg-navy-600 shimmer font-mono" />
            {/* Gate */}
            <div className="h-4 w-8 rounded bg-navy-600 shimmer" />
            {/* Scheduled */}
            <div className="h-4 w-20 rounded bg-navy-600 shimmer font-mono" />
            {/* Status badge */}
            <div className="h-6 w-24 rounded-full bg-navy-600 shimmer" />
            {/* Action button */}
            <div className="h-8 w-20 rounded-md bg-navy-600 shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
