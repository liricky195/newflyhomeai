"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR, { useSWRConfig } from "swr";
import AirportCombobox from "@/components/shared/AirportCombobox";

const jsonFetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));

export default function FirstAirportModal() {
  const { status } = useSession();
  const { mutate: globalMutate } = useSWRConfig();
  const [selectedIata, setSelectedIata] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading, mutate } = useSWR<{
    airport: { airport_iata: string } | null;
  }>(
    status === "authenticated" ? "/api/monitored-airports" : null,
    jsonFetcher,
    { revalidateOnFocus: false }
  );

  // Render nothing when:
  // - not authenticated
  // - still loading
  // - user already has an airport set
  // - user dismissed after setting
  if (
    status !== "authenticated" ||
    isLoading ||
    data?.airport !== null ||
    dismissed
  ) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIata) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/monitored-airports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airport_iata: selectedIata }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to save. Please try again."
        );
      }

      await mutate();
      setDismissed(true);

      // Trigger a GET /api/flights refresh 3 seconds after the user confirms
      // their stranded airport, giving the monitor time to complete the
      // immediate scan (flagged by the POST handler via flagAirportForImmediateScan).
      // This is Case 2 of the scan-trigger contract: "user chooses stranded airport".
      // The timeout is intentionally NOT cleared on unmount — the component may
      // already be hidden (dismissed = true) when it fires, but the SWR mutate
      // is idempotent and safe to call from a detached closure.
      const iata = selectedIata;
      setTimeout(() => {
        globalMutate(`/api/flights?airport=${iata}`);
        globalMutate("/api/scan-status");
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-navy-700 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">Where are you stranded?</h2>
          <p className="mt-2 text-sm text-slate-400">
            Choose your stranded airport. This is permanent and cannot be changed after setup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AirportCombobox
            value={selectedIata}
            onChange={setSelectedIata}
            placeholder="Search city or airport — e.g. Dubai, Dubai International, DXB"
            required
          />

          {error && (
            <div className="rounded-lg bg-critical/10 px-4 py-3 text-sm text-critical">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedIata || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-navy transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {submitting ? "Saving…" : "Confirm My Airport"}
          </button>
        </form>
      </div>
    </div>
  );
}
