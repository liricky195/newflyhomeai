"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

interface ReferralStats {
  code: string | null;
  balance_cents: number;
  referrals_count: number;
  total_earned_cents: number;
}

export default function ReferralSection() {
  const { data: stats, mutate } = useSWR<ReferralStats>("/api/referrals?action=stats", fetcher);
  const [copied, setCopied] = useState(false);

  const copyReferralCode = async () => {
    if (!stats?.code) return;
    
    try {
      await navigator.clipboard.writeText(stats.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy referral code:", error);
    }
  };

  const formatBalance = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  if (!stats) {
    return (
      <div className="rounded-lg border border-border bg-navy-700/40 p-6">
        <div className="h-6 w-32 rounded-md bg-navy-600 shimmer" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-navy-700/40 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Refer & Earn</h3>
      
      {stats.code ? (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-slate-400">Your referral code:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-navy-600 px-3 py-2 font-mono text-sm text-white">
                {stats.code}
              </code>
              <button
                onClick={copyReferralCode}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-accent">{stats.referrals_count}</p>
              <p className="text-xs text-slate-400">Successful referrals</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">${formatBalance(stats.balance_cents)}</p>
              <p className="text-xs text-slate-400">Available balance</p>
            </div>
          </div>

          <div className="rounded-md bg-accent/5 border border-accent/30 p-3">
            <p className="text-sm text-accent">
              Share your code with friends! You both get $5 when they sign up.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Generate your referral code to start earning rewards!
          </p>
          <button
            onClick={() => mutate()}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
          >
            Generate Referral Code
          </button>
        </div>
      )}
    </div>
  );
}
