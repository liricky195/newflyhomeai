"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import BookingCard from "@/components/bookings/BookingCard";
import type { DbBookingWithFlight } from "@/lib/db";

// Augmented type matching API response shape — overrides total_amount to Duffel string
type BookingApiItem = Omit<DbBookingWithFlight, "total_amount"> & {
  total_amount: string | null;
  total_currency: string | null;
  cancellation_pending: 0 | 1;
  confirm_fetch_failed: 0 | 1;
};

interface BookingsResponse {
  bookings: BookingApiItem[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load bookings");
    return r.json() as Promise<BookingsResponse>;
  });

function BookingsLoadingSkeleton() {
  return (
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
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface CancelResult {
  refundAmount: string;
  refundCurrency: string;
  refundTo: string;
  refundMessage: string;
}

function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-green-500/30 bg-slate-900 px-4 py-3 shadow-lg">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <p className="text-sm text-slate-200">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-500 hover:text-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function BookingsPage() {
  const { data, error, isLoading } = useSWR<BookingsResponse>(
    "/api/bookings",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [localBookings, setLocalBookings] = useState<BookingApiItem[] | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const bookings = localBookings ?? data?.bookings ?? [];

  // Show success toast when most recent booking was just confirmed
  useEffect(() => {
    if (!data?.bookings?.length) return;
    const mostRecent = data.bookings[0];
    if (!mostRecent) return;

    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
    if (
      mostRecent.status === "confirmed" &&
      mostRecent.created_at > fiveMinutesAgo
    ) {
      const ref = mostRecent.booking_reference;
      if (ref && ref !== "PENDING") {
        setSuccessToast(`Your booking is confirmed! Reference: ${ref}`);
      } else if (ref === "PENDING") {
        setSuccessToast("Your booking is confirmed! Your reference will arrive by email shortly.");
      }
    }
  }, [data]);

  function handleCancelled(bookingId: string, _result: CancelResult) {
    const source = data?.bookings ?? [];
    setLocalBookings(
      source.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: "cancelled" as const,
              cancelled_reason: "user_cancelled",
            }
          : b
      )
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-white">My Bookings</h1>
      <p className="mb-8 text-sm text-slate-400">
        Your flight bookings and their current status.
      </p>

      {isLoading && <BookingsLoadingSkeleton />}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
          Failed to load bookings. Please refresh the page.
        </div>
      )}

      {!isLoading && !error && bookings.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mb-2 text-base font-medium text-white">
            You have no bookings yet.
          </p>
          <p className="mb-4 text-sm text-slate-400">
            When you book a flight it will appear here.
          </p>
          <Link
            href="/flights"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
          >
            Browse Flights
          </Link>
        </div>
      )}

      {!isLoading && !error && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancelled={handleCancelled}
            />
          ))}
        </div>
      )}

      {successToast && (
        <SuccessToast
          message={successToast}
          onClose={() => setSuccessToast(null)}
        />
      )}
    </main>
  );
}
