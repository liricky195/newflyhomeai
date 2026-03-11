"use client";

import { useState } from "react";
import Link from "next/link";
import type { SubscriptionTier } from "@/lib/db";

interface SubData {
  tier: SubscriptionTier;
  status: string;
  scanIntervalSeconds: number;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: 0 | 1;
  hasActiveStripeSubscription: boolean;
}

interface Props {
  sub: SubData | undefined;
  onMutate: () => void;
}

const TIER_PRICE: Record<SubscriptionTier, string> = {
  free: "$0",
  standard: "$19.99/wk",
  pro: "$39.99/wk",
  ultimate: "$69.99/wk",
};

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  standard: "Standard",
  pro: "Pro",
  ultimate: "Ultimate",
};

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatInterval(seconds: number): string {
  if (seconds >= 60) return `${seconds / 60}-minute scans`;
  return `${seconds}-second scans`;
}

export default function SubscriptionPanel({ sub, onMutate }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sub) {
    return (
      <div className="space-y-1">
        <div className="h-4 w-24 rounded bg-navy-600 shimmer" />
        <div className="h-4 w-48 rounded bg-navy-600 shimmer" />
      </div>
    );
  }

  const isFree = sub.tier === "free";
  const isCancelPending = sub.cancelAtPeriodEnd === 1;

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setConfirming(false);
      onMutate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReactivate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      onMutate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Free tier ──────────────────────────────────────────────────────────────
  if (isFree) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Subscription
        </h2>
        <p className="text-base font-medium text-white">Free plan — no billing</p>
        <p className="mt-1 text-xs text-slate-400">{formatInterval(sub.scanIntervalSeconds)}</p>
        <Link
          href="/plans"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Upgrade plan →
        </Link>
      </div>
    );
  }

  // ── Cancellation pending ───────────────────────────────────────────────────
  if (isCancelPending) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Subscription
        </h2>
        <p className="font-medium text-amber-400">
          Cancellation pending — access until{" "}
          {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {TIER_LABEL[sub.tier]} · {formatInterval(sub.scanIntervalSeconds)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          No further charges after this date.
        </p>

        {error && <p className="mt-2 text-xs text-critical">{error}</p>}

        <button
          onClick={handleReactivate}
          disabled={loading}
          className="mt-3 rounded-lg border border-accent/50 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Undoing…
            </span>
          ) : (
            "Undo Cancellation"
          )}
        </button>
      </div>
    );
  }

  // ── Active paid ────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Subscription
      </h2>
      <div className="flex items-baseline gap-2">
        <p className="text-base font-medium text-white">
          {TIER_LABEL[sub.tier]}
        </p>
        <p className="text-sm text-slate-400">{TIER_PRICE[sub.tier]}</p>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">
        {formatInterval(sub.scanIntervalSeconds)}
      </p>
      {sub.currentPeriodEnd && (
        <p className="mt-0.5 text-xs text-slate-400">
          Next billing {formatDate(sub.currentPeriodEnd)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href="/plans"
          className="text-sm font-medium text-accent hover:underline"
        >
          Change Plan →
        </Link>

        {sub.hasActiveStripeSubscription && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:border-critical/50 hover:text-critical"
          >
            Cancel Plan
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-lg border border-border bg-navy-800 p-4 text-sm text-slate-300">
          <p className="mb-1">
            Your{" "}
            <strong className="text-white">{TIER_LABEL[sub.tier]}</strong>{" "}
            access continues until{" "}
            <strong className="text-white">
              {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"}
            </strong>
            .
          </p>
          <p className="mb-3 text-xs text-slate-400">
            No further charges will be made after this date.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="min-h-[44px] flex-1 rounded-md border border-critical/50 px-3 py-2 text-sm font-medium text-critical hover:bg-critical/10 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Cancelling…
                </span>
              ) : (
                "Confirm Cancellation"
              )}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={loading}
              className="min-h-[44px] flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-50"
            >
              Keep Plan
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="inline-block h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
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
        d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4A12 12 0 014 12z"
      />
    </svg>
  );
}
