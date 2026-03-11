"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageTransition from "@/components/shared/PageTransition";
import AirportStatusCard from "@/components/dashboard/AirportStatusCard";
import ScanCountdown from "@/components/dashboard/ScanCountdown";
import AlertFeed from "@/components/dashboard/AlertFeed";
import { useScan } from "@/contexts/ScanContext";

interface DashboardData {
  airport: { iata: string; destination_iata: string | null; active: number; last_scan_at: number | null };
  subscription: { tier: string; scan_interval_seconds: number; status: string };
}

export default function DashboardPage() {
  const { status } = useSession({ required: true });
  const router = useRouter();
  const { nextScanAt } = useScan();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (json.redirect) {
          router.replace(json.redirect);
          return;
        }
        setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 h-8 w-48 rounded-md bg-navy-700 shimmer" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-navy-700 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-white">Dashboard</h1>

        {data.subscription.tier === "free" && (
          <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
            <p className="text-sm text-accent">
              You are on the Free plan (30-minute scans).{" "}
              <Link href="/plans" className="font-medium underline underline-offset-2">
                Upgrade for faster monitoring
              </Link>
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <AirportStatusCard airportIata={data.airport.iata} />
          <ScanCountdown nextScanAt={nextScanAt} />
          <AlertFeed />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/edit-details"
            className="group rounded-xl border border-border bg-navy-700 p-5 transition-colors hover:border-accent/30"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-accent">
              Edit Details
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Update your airport, destination, or travel dates.
            </p>
          </Link>
          <Link
            href="/flights"
            className="group rounded-xl border border-border bg-navy-700 p-5 transition-colors hover:border-accent/30"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-accent">
              View Flights
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Browse all departing flights and book instantly.
            </p>
          </Link>
          <Link
            href="/account"
            className="group rounded-xl border border-border bg-navy-700 p-5 transition-colors hover:border-accent/30"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-accent">
              Account Settings
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Manage your subscription and notification preferences.
            </p>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
