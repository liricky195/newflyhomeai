"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface ConfirmationData {
  status: string;
  cancelled_reason?: string | null;
  booking_reference: string | null;
  ticket_number: string | null;
  flight_id: string;
  currency: string;
  total_amount: number;
  refund_initiated?: boolean;
  refund_error?: string | null;
}

type ConfirmState = "confirming" | "confirmed" | "failed" | "timeout";

export default function BookingConfirmation() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingSuccess = searchParams.get("booking");
  const sessionId = searchParams.get("session_id");

  const [state, setState] = useState<ConfirmState>("confirming");
  const [data, setData] = useState<ConfirmationData | null>(null);

  const dismiss = useCallback(() => {
    router.replace("/flights");
  }, [router]);

  useEffect(() => {
    if (bookingSuccess !== "success" || !sessionId) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 15; // 30 seconds at 2s intervals
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/bookings/confirm?session_id=${encodeURIComponent(sessionId!)}`);
        if (res.ok) {
          const json: ConfirmationData = await res.json();
          if (json.status === "confirmed") {
            setData(json);
            setState("confirmed");
            return;
          }
          // Booking was cancelled (e.g. Duffel offer expired) — stop polling and show error
          if (json.status === "cancelled") {
            setData(json);
            setState("failed");
            return;
          }
        }
      } catch { /* keep polling */ }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        setState("timeout");
        return;
      }

      if (!cancelled) {
        setTimeout(poll, 2000);
      }
    }

    poll();

    return () => { cancelled = true; };
  }, [bookingSuccess, sessionId]);

  // Don't render if not on the success redirect URL
  if (bookingSuccess !== "success" || !sessionId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-navy-800 p-8 shadow-2xl">
        {state === "confirming" && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-10 w-10 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Confirming your booking…</h2>
            <p className="mt-2 text-sm text-slate-400">
              Please wait while we confirm your reservation with the airline.
            </p>
          </div>
        )}

        {state === "confirmed" && data && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Booking Confirmed!</h2>
            <p className="mt-1 text-sm text-slate-400">Your flight has been booked successfully.</p>

            {data.booking_reference && (
              <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/5 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Booking Reference
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-green-400">
                  {data.booking_reference}
                </p>
              </div>
            )}

            {data.ticket_number && (
              <div className="mt-3 rounded-xl border border-border bg-navy-700 px-6 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ticket Number
                </p>
                <p className="mt-1 font-mono text-sm text-white">{data.ticket_number}</p>
              </div>
            )}

            <p className="mt-4 text-xs text-slate-500">
              A confirmation email has been sent to your registered address.
            </p>

            <button
              onClick={dismiss}
              className="mt-6 w-full rounded-lg bg-accent px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-navy transition-colors hover:bg-accent-dark"
            >
              Done
            </button>
          </div>
        )}

        {state === "failed" && data && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-semibold text-white">Booking Failed</h2>
            <p className="mt-2 text-sm text-slate-400">
              We couldn&apos;t complete your booking with the airline.
            </p>
            {data.refund_initiated ? (
              <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400">
                A full refund of {new Intl.NumberFormat("en-GB", { style: "currency", currency: data.currency }).format(data.total_amount / 100)} has been initiated and should appear within 5–10 business days.
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                Your payment was received but your refund could not be processed automatically. Please contact support — you will be refunded in full.
              </div>
            )}
            <button
              onClick={dismiss}
              className="mt-6 w-full rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              Back to Flights
            </button>
          </div>
        )}

        {state === "timeout" && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-semibold text-white">Payment Received</h2>
            <p className="mt-2 text-sm text-slate-400">
              Your payment was received — your booking reference will arrive by email shortly.
            </p>
            <button
              onClick={dismiss}
              className="mt-6 w-full rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              Back to Flights
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
