"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import useSWR from "swr";
import PageTransition from "@/components/shared/PageTransition";
import SubscriptionPanel from "@/components/account/SubscriptionPanel";
import NotificationToggle from "@/components/account/NotificationToggle";
import DeleteAccountButton from "@/components/account/DeleteAccountButton";

interface AccountData {
  subscription: {
    tier: "free" | "standard" | "pro" | "ultimate";
    status: string;
    scanIntervalSeconds: number;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: 0 | 1;
    hasActiveStripeSubscription: boolean;
  };
  monitoredAirport: {
    airportIata: string;
    destinationIata: string | null;
  } | null;
  pushEnabled: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load account data");
    return r.json();
  });


export default function AccountPage() {
  const { status } = useSession({ required: true });
  const { data, mutate, error } = useSWR<AccountData>(
    status === "authenticated" ? "/api/account" : null,
    fetcher
  );

  if (status !== "authenticated") return null;

  const airport = data?.monitoredAirport;

  return (
    <PageTransition>
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold text-white">Account</h1>

        {error && (
          <div className="mb-6 rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
            {error.message}
          </div>
        )}

        {/* ── Section A: Subscription ─────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-navy-700 p-6">
          <SubscriptionPanel sub={data?.subscription} onMutate={mutate} />
        </section>

        <hr className="my-1 border-transparent" />

        {/* ── Section B: Notifications ────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-navy-700 p-6">
          <NotificationToggle
            pushEnabled={data?.pushEnabled ?? false}
            onMutate={mutate}
          />
        </section>

        <hr className="my-1 border-transparent" />

        {/* ── Section C: Travel Details ───────────────────────────────── */}
        <section className="rounded-xl border border-border bg-navy-700 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Travel Details
          </h2>

          {!data ? (
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-navy-600 shimmer" />
              <div className="h-4 w-32 rounded bg-navy-600 shimmer" />
            </div>
          ) : airport ? (
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-slate-400">Departure airport</dt>
                <dd className="font-mono font-medium text-white">{airport.airportIata}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-slate-400">Preferred destination</dt>
                <dd className="font-medium text-white">
                  {airport.destinationIata ?? "Any"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">No airport set.</p>
          )}

          <Link
            href="/edit-details"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Edit Details →
          </Link>
        </section>

        <hr className="my-1 border-transparent" />

        {/* ── Section D: Session ──────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-navy-700 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Session
          </h2>
          <div className="space-y-4">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="min-h-[44px] w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              Sign Out
            </button>
            <DeleteAccountButton />
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
