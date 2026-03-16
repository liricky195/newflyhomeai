"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import PageTransition from "@/components/shared/PageTransition";
import AirportCombobox from "@/components/shared/AirportCombobox";
import type { AirportEntry } from "@/components/shared/AirportCombobox";

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditDetailsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [airportIata, setAirportIata] = useState<string | null>(null);
  const [airportEntry, setAirportEntry] = useState<AirportEntry | null>(null);
  const [destinationIata, setDestinationIata] = useState<string | null>(null);
  const [maxPriceUsd, setMaxPriceUsd] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, router]);

  // Pre-populate form from saved data
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/monitored-airports")
      .then((r) => r.json())
      .then(async (data) => {
        if (data.airport) {
          setAirportIata(data.airport.airport_iata ?? null);
          setDestinationIata(data.airport.destination_iata ?? null);

          // Look up airport name from the JSON for read-only display
          if (data.airport.airport_iata) {
            try {
              const res = await fetch("/data/airports.json");
              if (res.ok) {
                const airports: AirportEntry[] = await res.json();
                const found = airports.find((a) => a.iata === data.airport.airport_iata);
                if (found) setAirportEntry(found);
              }
            } catch { /* ignore */ }
          }
        }
        if (data.airport?.max_price_usd !== undefined) {
          setMaxPriceUsd(data.airport.max_price_usd?.toString() ?? "");
        }
      })
      .catch(() => {});
  }, [status]);

  if (status !== "authenticated") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        destination_iata: destinationIata || null,
        max_price_usd: maxPriceUsd ? parseInt(maxPriceUsd, 10) : null,
      };

      // Only include airport_iata on initial setup (when airportIata is not yet set)
      // After setup, the airport is locked and must not be sent
      if (!airportIata) {
        setError("Please set your stranded airport first.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/monitored-airports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error((resBody as { error?: string }).error ?? "Failed to save. Please try again.");
      }

      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-white">Flight Preferences</h1>
        <p className="mb-8 text-sm text-slate-400">
          Set your destination and notification preferences.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Stranded Airport — read-only display */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Stranded Airport
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-navy-800/60 px-4 py-2.5">
              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <div className="flex-1">
                {airportEntry ? (
                  <span className="text-sm text-white">
                    {airportEntry.name}{" "}
                    <span className="font-mono text-accent">({airportEntry.iata})</span>
                    {" "}— {airportEntry.city}, {airportEntry.country}
                  </span>
                ) : airportIata ? (
                  <span className="font-mono text-sm text-white">{airportIata}</span>
                ) : (
                  <span className="text-sm text-slate-500">Not yet configured</span>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Cannot be changed — contact support if this is incorrect.
            </p>
          </div>

          {/* Preferred destination */}
          <AirportCombobox
            label="Preferred Destination"
            value={destinationIata}
            onChange={setDestinationIata}
            placeholder="Search city or airport — e.g. London, Heathrow, LHR"
          />

          {/* Max Price Filter */}
          <div className="border-t border-border pt-6">
            <h2 className="mb-1 text-lg font-semibold text-white">Notification Filters</h2>
            <p className="mb-4 text-xs text-slate-500">
              Only get notified about flights matching these criteria.
            </p>
            <div>
              <label
                htmlFor="max-price"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Maximum Price (USD)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  id="max-price"
                  type="number"
                  placeholder="e.g. 500"
                  value={maxPriceUsd}
                  onChange={(e) => setMaxPriceUsd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-navy-800 pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Leave empty to be notified about all bookable flights.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-critical/10 px-4 py-3 text-sm text-critical">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-navy transition-colors hover:bg-accent-dark disabled:opacity-60"
          >
            {submitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </PageTransition>
  );
}
