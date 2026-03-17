"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export default function ReferralInput() {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { mutate: globalMutate } = useSWRConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", code: code.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Referral code applied successfully! You received $5 credit." });
        setCode("");
        // Refresh user data
        globalMutate("/api/monitored-airports");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to apply referral code" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
      <h4 className="mb-2 text-sm font-medium text-accent">Have a referral code?</h4>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter referral code"
          className="w-full rounded-md border border-border bg-navy-700 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50"
          maxLength={8}
        />
        <button
          type="submit"
          disabled={!code.trim() || isSubmitting}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Applying..." : "Apply Code"}
        </button>
      </form>

      {message && (
        <div
          className={`mt-2 rounded-md px-3 py-2 text-xs ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
