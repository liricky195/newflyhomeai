"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { SubscriptionTier } from "@/lib/db";

// ─── Tier metadata ────────────────────────────────────────────────────────────

const TIER_META: Record<
  SubscriptionTier,
  {
    label: string;
    price: number;
    display: string;
    interval: string;
    features: string[];
    recommended?: boolean;
  }
> = {
  free: {
    label: "Free",
    price: 0,
    display: "$0",
    interval: "10-min scans",
    features: [
      "Flight status alerts",
      "1 monitored airport",
      "10-minute scan interval",
      "Push notifications",
    ],
  },
  standard: {
    label: "Standard",
    price: 19.99,
    display: "$19.99/wk",
    interval: "3-min scans",
    features: [
      "Everything in Free",
      "3-minute scan interval",
    ],
  },
  pro: {
    label: "Pro",
    price: 39.99,
    display: "$39.99/wk",
    interval: "60-sec scans",
    features: [
      "Everything in Standard",
      "60-second scan interval",
    ],
    recommended: true,
  },
  ultimate: {
    label: "Ultimate",
    price: 99.99,
    display: "$99.99/wk",
    interval: "30-sec scans",
    features: [
      "Everything in Pro",
      "30-second scan interval",
      "Dedicated scan queue",
    ],
  },
};

const TIER_PRICE_DISPLAY: Record<SubscriptionTier, string> = {
  free: "$0",
  standard: "$19.99/wk",
  pro: "$39.99/wk",
  ultimate: "$99.99/wk",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCents(cents: number, currency = "USD"): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json();
  });

// ─── Props ────────────────────────────────────────────────────────────────────

interface PricingCardProps {
  tier: SubscriptionTier;
  userId: string | null;
  currentTier: SubscriptionTier;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: 0 | 1;
  hasActiveStripeSubscription: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PricingCard({
  tier,
  userId,
  currentTier,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  hasActiveStripeSubscription,
}: PricingCardProps) {
  const router = useRouter();
  const meta = TIER_META[tier];
  const currentMeta = TIER_META[currentTier];

  const isCurrentPlan = tier === currentTier;
  const isCancellationPending = isCurrentPlan && cancelAtPeriodEnd === 1;
  const isUpgrade = meta.price > currentMeta.price;
  const isDowngrade = meta.price < currentMeta.price && tier !== "free";
  const isFreeForPaidUser = tier === "free" && currentTier !== "free";
  const isRecommended = meta.recommended;

  // Fetch proration only for upgrade when user has active Stripe subscription
  const prorateKey =
    userId && isUpgrade && hasActiveStripeSubscription
      ? `/api/subscriptions/proration?targetTier=${tier}`
      : null;
  const { data: prorateData, isLoading: prorateLoading } = useSWR<{
    amountDueCents: number;
    currency: string;
  }>(prorateKey, fetcher);

  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "upgrade" | "downgrade" | "reactivate") {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = { action };
      if (action === "upgrade" || action === "downgrade") body.tier = tier;
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.url) {
        router.push(data.url);
      } else {
        router.refresh();
        setConfirming(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Card border / bg ───────────────────────────────────────────────────────
  const cardClass = isRecommended
    ? "rounded-xl border-2 border-accent bg-accent/5 p-6 flex flex-col"
    : "rounded-xl border border-border bg-navy-700 p-6 flex flex-col";

  return (
    <div className={cardClass}>
      {/* Badge row */}
      <div className="mb-3 flex items-center gap-2">
        {isRecommended && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-navy">
            Popular
          </span>
        )}
        {isCurrentPlan && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-slate-400">
            Current Plan
          </span>
        )}
      </div>

      {/* Tier name + price */}
      <h3 className="text-lg font-semibold text-white">{meta.label}</h3>
      <p className="mt-1 text-2xl font-bold text-white">{meta.display}</p>
      <p className="mt-1 text-xs text-slate-400">{meta.interval}</p>

      {/* Feature list */}
      <ul className="mt-4 flex-1 space-y-1.5">
        {meta.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
            <span className="mt-0.5 text-accent">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA area */}
      <div className="mt-6 space-y-2">
        {/* Unauthenticated */}
        {!userId && (
          <a
            href="/auth"
            className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
          >
            Get Started
          </a>
        )}

        {/* Current plan — cancellation pending */}
        {userId && isCancellationPending && (
          <>
            <p className="text-xs text-amber-400">
              Access until{" "}
              {currentPeriodEnd ? formatDate(currentPeriodEnd) : "—"}
            </p>
            <button
              onClick={() => handleAction("reactivate")}
              disabled={loading}
              className="w-full rounded-lg border border-accent/50 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Undoing…
                </span>
              ) : (
                "Undo Cancellation"
              )}
            </button>
          </>
        )}

        {/* Current plan — active (no CTA button, badge already shown) */}
        {userId && isCurrentPlan && !isCancellationPending && tier !== "free" && (
          <p className="text-center text-xs text-slate-500">
            Next billing{" "}
            {currentPeriodEnd ? formatDate(currentPeriodEnd) : "—"}
          </p>
        )}

        {/* Free tier for a paid user — link to cancel on /account */}
        {userId && isFreeForPaidUser && (
          <a
            href="/account"
            className="block rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            Cancel Plan
          </a>
        )}

        {/* Upgrade */}
        {userId && isUpgrade && (
          <>
            {/* Proration estimate */}
            {hasActiveStripeSubscription && (
              <div className="min-h-[20px] text-xs text-slate-400">
                {prorateLoading ? (
                  <span className="inline-block h-3 w-36 rounded bg-navy-600 shimmer" />
                ) : prorateData ? (
                  <span>
                    ~{formatCents(prorateData.amountDueCents, prorateData.currency)}{" "}
                    due now, then {meta.display}
                  </span>
                ) : null}
              </div>
            )}

            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
              >
                Upgrade
              </button>
            ) : (
              <div className="rounded-lg border border-border bg-navy-800 p-3 text-xs text-slate-300">
                {hasActiveStripeSubscription && prorateData ? (
                  <p className="mb-2">
                    You&apos;ll be charged{" "}
                    <strong className="text-white">
                      {formatCents(prorateData.amountDueCents, prorateData.currency)}
                    </strong>{" "}
                    today, then{" "}
                    <strong className="text-white">{meta.display}</strong>.
                  </p>
                ) : (
                  <p className="mb-2">
                    You&apos;ll be charged{" "}
                    <strong className="text-white">{meta.display}</strong>{" "}
                    upfront and billed weekly.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("upgrade")}
                    disabled={loading}
                    className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-navy hover:bg-accent-dark disabled:opacity-50"
                  >
                    {loading ? <Spinner /> : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={loading}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Downgrade */}
        {userId && isDowngrade && (
          <>
            {currentPeriodEnd && (
              <p className="text-xs text-slate-400">
                Takes effect {formatDate(currentPeriodEnd)}
              </p>
            )}

            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                Downgrade
              </button>
            ) : (
              <div className="rounded-lg border border-border bg-navy-800 p-3 text-xs text-slate-300">
                <p className="mb-2">
                  You&apos;ll keep{" "}
                  <strong className="text-white">{currentMeta.label}</strong>{" "}
                  access until{" "}
                  <strong className="text-white">
                    {currentPeriodEnd ? formatDate(currentPeriodEnd) : "period end"}
                  </strong>
                  , then pay{" "}
                  <strong className="text-white">
                    {TIER_PRICE_DISPLAY[tier]}
                  </strong>
                  .
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("downgrade")}
                    disabled={loading}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50"
                  >
                    {loading ? <Spinner /> : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={loading}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Inline error */}
        {error && (
          <p className="text-xs text-critical">{error}</p>
        )}
      </div>
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
