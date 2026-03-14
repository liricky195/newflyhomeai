"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function DeleteAccountButton() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete account");
      }
      // Log out after deletion
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError((err as Error).message);
      setIsDeleting(false);
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
      >
        Delete Account
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-500/50 bg-red-500/5 p-4">
      <p className="text-sm font-semibold text-red-400">Are you absolutely sure?</p>
      <p className="text-xs text-slate-400">
        This action is permanent. All your travel data, monitored airports, and active subscriptions will be deleted immediately.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 rounded-md bg-red-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
          className="flex-1 rounded-md border border-slate-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
