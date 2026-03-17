"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DbFlight } from "@/lib/db";
import { getAirportTimezone } from "@/lib/airportTimezone";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(unixSeconds: number, airportIata: string): string {
  const tz = getAirportTimezone(airportIata);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ModalState =
  | "loading"
  | "ready"
  | "redirecting";

// ─── Component ───────────────────────────────────────────────────────────────

interface BookingModalProps {
  flight: DbFlight | null;
  onClose: () => void;
}

export default function BookingModal({ flight, onClose }: BookingModalProps) {
  const [modalState, setModalState] = useState<ModalState>("loading");
  const submittingRef = useRef(false);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Reset when a new flight is opened
  useEffect(() => {
    if (!flight) return;
    setModalState("ready");
    submittingRef.current = false;
  }, [flight]);

  // Body scroll lock
  useEffect(() => {
    if (flight) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [flight]);

  // Escape key closes modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState !== "redirecting") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, modalState]);

  // Focus the close button when modal opens
  useEffect(() => {
    if (flight) {
      const id = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [flight]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!flight) return;

      setModalState("redirecting");

      const departureDate = new Date(flight.scheduled_departure * 1000)
        .toISOString()
        .slice(0, 10);
      const googleFlightsUrl = `https://www.google.com/travel/flights?q=One-way+Flights+from+${flight.departure_airport}+to+${flight.destination_airport}+on+${departureDate}`;

      setTimeout(() => {
        window.open(googleFlightsUrl, "_blank");
        setModalState("ready");
      }, 500);
    },
    [flight]
  );

  if (!flight) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Book flight"
      onClick={(e) => {
        if (e.target === e.currentTarget && modalState !== "redirecting")
          onClose();
      }}
    >
      <div className="relative flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-navy-800 sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Book Flight</h2>
            <p className="mt-0.5 font-mono text-sm text-slate-400">
              {flight.flight_number} · {flight.departure_airport} →{" "}
              {flight.destination_airport}
            </p>
            <p className="text-xs text-slate-500">
              Dep. {formatTime(flight.scheduled_departure, flight.departure_airport)} · {flight.airline}
            </p>
          </div>
          {modalState !== "redirecting" && (
            <button
              ref={firstFocusRef}
              onClick={onClose}
              aria-label="Close modal"
              className="ml-4 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-navy-700 hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Redirecting ── */}
          {modalState === "redirecting" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                className="mb-4 h-10 w-10 animate-spin text-accent"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <p className="text-base font-medium text-white">
                Redirecting to Google Flights...
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Please don&apos;t close this window.
              </p>
            </div>
          )}

          {/* ── Ready ── */}
          {modalState === "ready" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-4">
                <p className="text-sm font-medium text-accent">
                  Book this flight on Google Flights
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  You'll be redirected to Google Flights to complete your booking
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submittingRef.current}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-medium text-navy transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue to Google Flights
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
