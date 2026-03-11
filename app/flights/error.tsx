"use client";

export default function FlightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-xl font-semibold text-white">
        Failed to load flights
      </h2>
      <p className="max-w-md text-center text-sm text-slate-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
      >
        Try again
      </button>
    </div>
  );
}
