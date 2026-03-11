import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function BookingConfirmErrorPage({ searchParams }: PageProps) {
  const { ref } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-10 shadow-md">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <svg
              className="h-7 w-7 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-white">Payment Received</h1>

        <p className="mb-6 text-base text-slate-300">
          We received confirmation that your payment succeeded. However, we could not retrieve
          your booking details — this sometimes happens when airlines take a few minutes to issue
          a ticket.
        </p>

        <p className="mb-6 text-base text-slate-300">
          Your booking reference will arrive by email within 10 minutes.
        </p>

        {ref && (
          <p className="mb-6 text-sm text-slate-400">
            If you don&apos;t receive it, contact support with your session reference:{" "}
            <span className="font-mono text-accent">{ref}</span>
          </p>
        )}

        <Link
          href="/bookings"
          className="inline-block rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
        >
          View My Bookings
        </Link>
      </div>
    </main>
  );
}
