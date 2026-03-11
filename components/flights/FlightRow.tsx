"use client";

import React from "react";
import { motion } from "framer-motion";
import type { DbFlight } from "@/lib/db";
function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

interface StatusConfig {
  label: string;
  dot: string;
  badge: string;
  pulse: boolean;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  scheduled: {
    label: "Scheduled",
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    pulse: false,
  },
  active: {
    label: "Boarding",
    dot: "bg-green-400",
    badge: "bg-green-400/10 text-green-400 border-green-400/20",
    pulse: true,
  },
  landed: {
    label: "Landed",
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    pulse: false,
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    pulse: false,
  },
  diverted: {
    label: "Diverted",
    dot: "bg-orange-400",
    badge: "bg-orange-400/10 text-orange-400 border-orange-400/20",
    pulse: false,
  },
};

function formatDateTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) return time;

  const date = d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
  return `${date} · ${time}`;
}

interface FlightRowProps {
  flight: DbFlight;
  isNew: boolean;
  onBook: (flight: DbFlight) => void;
  preferredDest?: string | null;
  cityMap?: Map<string, string>;
}

function FlightRow({ flight, isNew, onBook, preferredDest, cityMap }: FlightRowProps) {
  const config = STATUS_CONFIG[flight.status] ?? STATUS_CONFIG.scheduled;
  const isPreferred = !!preferredDest && flight.destination_airport === preferredDest;
  const destCity = cityMap?.get(flight.destination_airport);

  const hasConfirmedPrice = flight.lowest_price_cents !== null && flight.price_currency !== null;

  const priceDisplay = hasConfirmedPrice
    ? `from ${formatCurrency(flight.lowest_price_cents!, flight.price_currency!)}`
    : "—";

  return (
    <motion.tr
      layout
      layoutId={flight.id}
      initial={isNew ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`group border-b border-border last:border-0 transition-colors duration-[2000ms] ${
        isNew ? "animate-new-flight" : ""
      }`}
    >
      {/* Flight № */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span className="font-mono text-sm font-semibold text-white">
          {flight.flight_number}
        </span>
      </td>

      {/* Airline */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span className="text-sm text-slate-300">{flight.airline}</span>
      </td>

      {/* Destination */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span className={`font-mono text-sm font-semibold ${isPreferred ? "text-accent" : "text-white"}`}>
          {flight.destination_airport}
          {destCity && (
            <span className="ml-1 font-sans font-normal text-slate-400">
              {" - "}{destCity}
            </span>
          )}
          {isPreferred && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
              Direct
            </span>
          )}
        </span>
      </td>

      {/* Scheduled Dep. */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span className="font-mono text-sm text-slate-300">
          {formatDateTime(flight.scheduled_departure)}
          {flight.estimated_departure &&
            flight.estimated_departure !== flight.scheduled_departure && (
              <span className="ml-1 text-xs text-amber-400">
                +
                {Math.round(
                  (flight.estimated_departure - flight.scheduled_departure) / 60
                )}
                m
              </span>
            )}
        </span>
      </td>

      {/* Status badge */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {config.pulse && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-75`}
              />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`}
            />
          </span>
          {config.label}
        </span>
      </td>

      {/* Price */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span className={`font-mono text-sm ${flight.lowest_price_cents !== null ? "text-accent" : "text-slate-500"}`}>
          {priceDisplay}
        </span>
      </td>

      {/* Action */}
      <td className="hidden px-4 py-3 md:table-cell">
        <button
          onClick={() => hasConfirmedPrice && onBook(flight)}
          disabled={!hasConfirmedPrice}
          title={!hasConfirmedPrice ? "Checking availability…" : undefined}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            hasConfirmedPrice
              ? "border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 hover:border-accent/50"
              : "cursor-not-allowed border-slate-700 bg-transparent text-slate-600"
          }`}
        >
          Book Flight
        </button>
      </td>

      {/* Mobile card layout — visible only on sm screens */}
      <td className="table-cell px-4 py-4 md:hidden" colSpan={6}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-white">
                {flight.flight_number}
              </span>
              <span className="text-slate-500">→</span>
              <span className={`font-mono text-base font-bold ${isPreferred ? "text-accent" : "text-white"}`}>
                {flight.destination_airport}
                {destCity && (
                  <span className="ml-1 font-sans text-sm font-normal text-slate-400">
                    {" - "}{destCity}
                  </span>
                )}
                {isPreferred && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                    Direct
                  </span>
                )}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{flight.airline}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-sm text-slate-300">
                {formatDateTime(flight.scheduled_departure)}
                {flight.estimated_departure &&
                  flight.estimated_departure !== flight.scheduled_departure && (
                    <span className="ml-1 text-xs text-amber-400">
                      +
                      {Math.round(
                        (flight.estimated_departure -
                          flight.scheduled_departure) /
                          60
                      )}
                      m
                    </span>
                  )}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${config.badge}`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {config.pulse && (
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-75`}
                    />
                  )}
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`}
                  />
                </span>
                {config.label}
              </span>
            </div>
          </div>
          <button
            onClick={() => hasConfirmedPrice && onBook(flight)}
            disabled={!hasConfirmedPrice}
            title={!hasConfirmedPrice ? "Checking availability…" : undefined}
            className={`shrink-0 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              hasConfirmedPrice
                ? "border-accent/30 bg-accent/5 text-accent hover:bg-accent/10"
                : "cursor-not-allowed border-slate-700 bg-transparent text-slate-600"
            }`}
          >
            Book
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

export default React.memo(FlightRow);
