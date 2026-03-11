"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DbBookingWithFlight } from "@/lib/db";

// Augmented type for API response — overrides total_amount to Duffel decimal string
type BookingWithTotals = Omit<DbBookingWithFlight, "total_amount"> & {
  total_amount: string | null;
  total_currency: string | null;
  cancellation_pending: 0 | 1;
  confirm_fetch_failed: 0 | 1;
};

interface BookingCardProps {
  booking: BookingWithTotals;
  onCancelled: (bookingId: string, result: CancelResult) => void;
}

interface CancelResult {
  refundAmount: string;
  refundCurrency: string;
  refundTo: string;
  refundMessage: string;
}

interface ConditionsData {
  available: boolean;
  baggage?: {
    cabin: Array<{ quantity: number; type: string; max_weight_kg: number | null }>;
    checked: Array<{ quantity: number; type: string; max_weight_kg: number | null }>;
  };
  conditions?: {
    refundable: boolean;
    refundPenalty: string | null;
    refundPenaltyCurrency: string | null;
    changeable: boolean;
    changePenalty: string | null;
    changePenaltyCurrency: string | null;
  };
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json() as Promise<ConditionsData>;
  });

function formatDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ booking }: { booking: BookingWithTotals }) {
  if (booking.status === "confirmed") {
    if (booking.cancellation_pending === 1) {
      return (
        <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
          Confirmed
        </span>
      );
    }
    return (
      <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
        Confirmed
      </span>
    );
  }
  if (booking.status === "pending") {
    return (
      <span className="rounded-full bg-slate-500/15 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
        Payment in progress
      </span>
    );
  }
  if (booking.status === "cancelled") {
    const reason = booking.cancelled_reason;
    if (reason === "user_cancelled") {
      return (
        <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400">
          Cancelled by You
        </span>
      );
    }
    if (reason === "flight_cancelled") {
      return (
        <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400">
          Cancelled by Airline
        </span>
      );
    }
    if (reason === "duffel_failure") {
      return (
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
          Booking Failed
        </span>
      );
    }
    return (
      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
        Cancelled
      </span>
    );
  }
  return null;
}

function borderClass(booking: BookingWithTotals): string {
  if (booking.status === "confirmed") return "border-l-4 border-green-500";
  if (booking.status === "cancelled") return "border-l-4 border-red-500";
  return "border-l-4 border-slate-500";
}

function PoliciesSection({ bookingId, status }: { bookingId: string; status: string }) {
  const shouldFetch = status === "confirmed";
  const { data, isLoading, error } = useSWR<ConditionsData>(
    shouldFetch ? `/api/bookings/${bookingId}/conditions` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  if (!shouldFetch) return null;

  if (isLoading) {
    return (
      <div className="space-y-2 pt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-slate-700" />
        ))}
      </div>
    );
  }

  if (error || !data?.available) {
    return (
      <p className="pt-3 text-sm text-slate-500">Policy details unavailable</p>
    );
  }

  const { baggage, conditions } = data;
  const cabin = baggage?.cabin?.[0];
  const checked = baggage?.checked?.[0];

  // CHANGED IN STEP 9: Updated refund policy text to match spec
  function refundPolicyText(): string {
    if (!conditions) return "Refund policy information is not available";
    if (!conditions.refundable) return "non-refundable";
    if (conditions.refundPenalty && conditions.refundPenalty !== "0.00") {
      return `cancellation fee is ${conditions.refundPenalty}`;
    }
    return "fully refundable";
  }

  return (
    <div className="space-y-2 border-t border-slate-700 pt-3">
      {/* Baggage */}
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
        </svg>
        <div className="text-sm">
          {cabin && cabin.quantity > 0 ? (
            <p className="text-slate-300">{cabin.quantity} carry-on bag included</p>
          ) : (
            <p className="text-slate-500">No carry-on baggage</p>
          )}
          {checked && checked.quantity > 0 ? (
            <p className="text-slate-300">
              {checked.quantity} checked bag{checked.quantity > 1 ? "s" : ""}
              {checked.max_weight_kg ? ` (${checked.max_weight_kg}kg)` : ""} included
            </p>
          ) : (
            <p className="text-slate-500">No checked baggage included</p>
          )}
        </div>
      </div>

      {/* Cancellation policy */}
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
        <div className="text-sm">
          <p className={!conditions?.refundable ? "text-red-400" : conditions?.refundPenalty && conditions.refundPenalty !== "0.00" ? "text-amber-400" : "text-green-400"}>
            {refundPolicyText()}
          </p>
          {conditions?.changeable !== undefined && (
            conditions.changeable ? (
              conditions.changePenalty && conditions.changePenalty !== "0.00" ? (
                <p className="text-amber-400">
                  Changes allowed — {conditions.changePenaltyCurrency}{" "}
                  {conditions.changePenalty} fee
                </p>
              ) : (
                <p className="text-slate-300">Changes allowed (no fee)</p>
              )
            ) : (
              <p className="text-slate-500">No changes permitted</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function CancelPanel({
  booking,
  conditions,
  onCancelled,
  onClose,
}: {
  booking: BookingWithTotals;
  conditions: ConditionsData | undefined;
  onCancelled: (result: CancelResult) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cond = conditions?.conditions;

  let refundEstimate: string;
  if (!conditions?.available || !cond) {
    refundEstimate =
      "Refund policy information is not available for this fare. Cancellation may be non-refundable — check with the airline before proceeding.";
  } else if (!cond.refundable) {
    refundEstimate = "This fare is non-refundable. Cancelling will not result in any refund.";
  } else if (cond.refundPenalty && cond.refundPenalty !== "0.00") {
    refundEstimate = `You may receive a partial refund. The airline's cancellation fee is ${cond.refundPenalty} ${cond.refundPenaltyCurrency ?? ""}. Duffel will process any eligible refund to your original payment method.`;
  } else {
    refundEstimate =
      "This fare is fully refundable before departure. Duffel will return your payment to your original payment method.";
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
      });
      const body = (await res.json()) as {
        success?: boolean;
        error?: string;
        refundAmount?: string;
        refundCurrency?: string;
        refundTo?: string;
        refundMessage?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Cancellation failed. Please try again.");
        return;
      }
      // CHANGED IN STEP 9: Build refund message based on refundTo field
      const refundTo = body.refundTo ?? "";
      let refundMessage = body.refundMessage ?? "";
      if (!refundMessage) {
        if (refundTo === "voucher") {
          refundMessage = "Your refund will be issued as a voucher.";
        } else if (refundTo === "balance") {
          refundMessage = "Your refund will be credited to your operator account balance.";
        }
      }
      onCancelled({
        refundAmount: body.refundAmount ?? "0.00",
        refundCurrency: body.refundCurrency ?? "",
        refundTo,
        refundMessage,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/20 p-4">
      <h4 className="mb-2 text-sm font-semibold text-white">Confirm Cancellation</h4>

      <p className="mb-4 text-sm text-slate-300">{refundEstimate}</p>

      <p className="mb-4 text-xs text-slate-500">
        Refund eligibility and timing are determined by the airline&apos;s fare conditions. If a
        refund is due, Duffel will issue it to your original payment method.
      </p>

      {error && (
        <p className="mb-3 rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Confirm Cancellation
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Keep Booking
        </button>
      </div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
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

export default function BookingCard({ booking: initialBooking, onCancelled }: BookingCardProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [showCancelPanel, setShowCancelPanel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const shouldFetchConditions = booking.status === "confirmed";
  const { data: conditionsData } = useSWR<ConditionsData>(
    shouldFetchConditions ? `/api/bookings/${booking.id}/conditions` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  function handleCancelled(result: CancelResult) {
    const updated = {
      ...booking,
      status: "cancelled" as const,
      cancelled_reason: "user_cancelled",
    };
    setBooking(updated);
    setShowCancelPanel(false);
    onCancelled(booking.id, result);
    setToast(`Your booking has been cancelled. ${result.refundMessage}`);
  }

  return (
    <>
      <div className={`rounded-xl bg-slate-900 p-5 shadow-md ${borderClass(booking)}`}>
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-white">
              {booking.flight_number ?? "—"} ·{" "}
              {booking.departure_airport ?? "—"} → {booking.destination_airport ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              {booking.scheduled_departure
                ? formatDateTime(booking.scheduled_departure)
                : "—"}
            </p>
          </div>
          <StatusBadge booking={booking} />
        </div>

        {/* Pending state — payment in progress */}
        {booking.status === "pending" && (
          <div className="mb-4 rounded-lg bg-slate-800/50 p-3 text-sm text-slate-400">
            <p>Payment in progress. Once confirmed, your booking details will appear here.</p>
          </div>
        )}

        {/* Cancellation pending warning */}
        {booking.status === "confirmed" && booking.cancellation_pending === 1 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3">
            <p className="text-sm font-medium text-amber-400">
              A cancellation attempt is pending manual review. Do not attempt to cancel again.
              Contact support.
            </p>
          </div>
        )}

        {/* Booking reference + ticket */}
        {booking.status !== "pending" && (
          <div className="mb-4 space-y-1">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Booking Reference
              </span>
              <p className="font-mono text-xl font-bold text-white">
                {booking.booking_reference ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Ticket Number
              </span>
              <p className="font-mono text-sm font-bold text-white">
                {booking.ticket_number ?? "—"}
              </p>
            </div>
          </div>
        )}

        {/* Total paid */}
        {booking.status === "confirmed" && booking.total_amount && (
          <div className="mb-4 rounded-lg bg-slate-800/50 p-3 text-sm">
            <div className="flex justify-between font-semibold text-white">
              <span>Total paid</span>
              <span>
                {booking.total_amount} {booking.total_currency ?? ""}
              </span>
            </div>
          </div>
        )}

        {/* Policies */}
        <PoliciesSection bookingId={booking.id} status={booking.status} />

        {/* Cancel button — confirmed bookings without pending cancellation only */}
        {booking.status === "confirmed" &&
          booking.cancellation_pending !== 1 &&
          !showCancelPanel && (
            <div className="mt-4 border-t border-slate-700 pt-4">
              <button
                onClick={() => setShowCancelPanel(true)}
                className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:border-red-500 hover:text-red-300"
              >
                Cancel Booking
              </button>
            </div>
          )}

        {/* Inline cancel confirmation panel */}
        {booking.status === "confirmed" &&
          booking.cancellation_pending !== 1 &&
          showCancelPanel && (
            <CancelPanel
              booking={booking}
              conditions={conditionsData}
              onCancelled={handleCancelled}
              onClose={() => setShowCancelPanel(false)}
            />
          )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
