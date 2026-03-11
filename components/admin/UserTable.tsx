// CHANGED IN STEP 9: Skeleton loading rows, Retry button on error, improved role toggle labels
"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import type { DbAdminUser } from "@/lib/db";

interface UserTableProps {
  currentUserId: string;
}

interface UsersResponse {
  users: DbAdminUser[];
  total: number;
  page: number;
  limit: number;
}

interface RowState {
  loading: boolean;
  error: string | null;
}

const TIERS = ["free", "standard", "pro", "ultimate"] as const;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<UsersResponse>;
  });

function fmtInterval(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${secs / 60}m`;
  return `${secs / 3600}h`;
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-b border-white/5">
          {[...Array(6)].map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 w-full animate-pulse rounded bg-white/10" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function UserTable({ currentUserId }: UserTableProps) {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(
    `/api/admin/users?page=${page}&limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [pendingTiers, setPendingTiers] = useState<Record<string, string>>({});
  const [confirmState, setConfirmState] = useState<{
    userId: string;
    action: "resetAirport" | "toggleRole";
    label: string;
  } | null>(null);

  const setRowState = useCallback(
    (userId: string, state: Partial<RowState>) => {
      setRowStates((prev) => ({
        ...prev,
        [userId]: Object.assign(
          { loading: false, error: null },
          prev[userId],
          state
        ),
      }));
    },
    []
  );

  const filteredUsers = (data?.users ?? []).filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  async function handleSubscriptionChange(userId: string) {
    const tier = pendingTiers[userId];
    if (!tier) return;
    setRowState(userId, { loading: true, error: null });
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await mutate();
      setPendingTiers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e) {
      setRowState(userId, { error: (e as Error).message });
    } finally {
      setRowState(userId, { loading: false });
    }
  }

  async function handleResetAirport(userId: string) {
    setConfirmState(null);
    setRowState(userId, { loading: true, error: null });
    try {
      const res = await fetch(`/api/admin/users/${userId}/airport`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await mutate();
    } catch (e) {
      setRowState(userId, { error: (e as Error).message });
    } finally {
      setRowState(userId, { loading: false });
    }
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    setConfirmState(null);
    const newRole = currentRole === "admin" ? "user" : "admin";
    setRowState(userId, { loading: true, error: null });
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await mutate();
    } catch (e) {
      setRowState(userId, { error: (e as Error).message });
    } finally {
      setRowState(userId, { loading: false });
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filter by email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          onClick={() => mutate()}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
        >
          Refresh
        </button>
        {data && (
          <span className="ml-auto text-xs text-slate-500">
            {data.total} users · page {page}/{totalPages}
          </span>
        )}
      </div>

      {/* Confirm overlay */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f172a] p-6 shadow-xl">
            <p className="mb-4 text-sm text-slate-300">{confirmState.label}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmState(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmState.action === "resetAirport") {
                    void handleResetAirport(confirmState.userId);
                  } else {
                    const user = data?.users.find(
                      (u) => u.id === confirmState.userId
                    );
                    if (user)
                      void handleToggleRole(confirmState.userId, user.role);
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Airport</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Scan</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows />}
            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center">
                  <p className="mb-2 text-sm text-red-400">
                    {(error as Error).message}
                  </p>
                  <button
                    onClick={() => mutate()}
                    className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              filteredUsers.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const rowState = rowStates[user.id] ?? {
                  loading: false,
                  error: null,
                };
                const pendingTier = pendingTiers[user.id] ?? user.tier;
                const tierChanged = pendingTier !== user.tier;

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                      isCurrentUser ? "bg-sky-900/20" : ""
                    }`}
                  >
                    {/* Email */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {user.email}
                      {isCurrentUser && (
                        <span className="ml-2 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          YOU
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          user.role === "admin"
                            ? "bg-amber-600/30 text-amber-300"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "User"}
                      </span>
                    </td>

                    {/* Airport */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {user.airport_iata ?? (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Tier selector */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={pendingTier}
                          onChange={(e) =>
                            setPendingTiers((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                          disabled={rowState.loading}
                          aria-label={`Subscription tier for ${user.email}`}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        {tierChanged && (
                          <button
                            onClick={() => handleSubscriptionChange(user.id)}
                            disabled={rowState.loading}
                            className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Scan interval */}
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {fmtInterval(user.scan_interval_seconds)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {rowState.loading && (
                          <span className="text-xs text-slate-500">
                            Working…
                          </span>
                        )}
                        {rowState.error && (
                          <span className="max-w-[140px] text-[11px] text-red-400">
                            {rowState.error}
                          </span>
                        )}

                        {/* Reset Airport */}
                        {!rowState.loading && (
                          <button
                            onClick={() =>
                              setConfirmState({
                                userId: user.id,
                                action: "resetAirport",
                                label: `Reset airport for ${user.email}? They will need to re-select on next login.`,
                              })
                            }
                            disabled={!user.airport_iata}
                            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            Reset Airport
                          </button>
                        )}

                        {/* Toggle Role — hidden for current user */}
                        {isCurrentUser ? (
                          <span className="rounded-md bg-sky-900/30 px-2 py-1 text-[11px] font-semibold text-sky-400">
                            You
                          </span>
                        ) : (
                          !rowState.loading && (
                            <button
                              onClick={() =>
                                setConfirmState({
                                  userId: user.id,
                                  action: "toggleRole",
                                  label: `Change ${user.email}'s role from "${user.role}" to "${
                                    user.role === "admin" ? "user" : "admin"
                                  }"?`,
                                })
                              }
                              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10"
                            >
                              {user.role === "admin"
                                ? "Remove Admin"
                                : "Make Admin"}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-400 hover:bg-white/5 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-400 hover:bg-white/5 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
