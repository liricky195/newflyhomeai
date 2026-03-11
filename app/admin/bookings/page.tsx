"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import type { DbAdminBookingRow } from "@/lib/db";

interface AdminBookingsResponse {
  bookings: DbAdminBookingRow[];
}

const fetcher = (url: string) =>
  fetch(url, { headers: { "Cache-Control": "no-store" } }).then((r) => {
    if (r.status === 403) throw new Error("Forbidden");
    if (!r.ok) throw new Error("Failed to load");
    return r.json() as Promise<AdminBookingsResponse>;
  });

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency ?? "GBP").toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ row }: { row: DbAdminBookingRow }) {
  if (row.status === "confirmed") {
    return (
      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400">
        Confirmed
      </span>
    );
  }
  if (row.status === "pending") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
        Pending
      </span>
    );
  }
  if (row.status === "cancelled") {
    if (row.cancelled_reason === "user_cancelled") {
      return (
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
          Cancelled by User
        </span>
      );
    }
    if (row.cancelled_reason === "flight_cancelled") {
      return (
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
          Cancelled by Airline
        </span>
      );
    }
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
        Booking Failed
      </span>
    );
  }
  return <span className="text-slate-500">—</span>;
}

type SortKey = keyof DbAdminBookingRow | "net_profit_cents";

export default function AdminBookingsPage() {
  const { data: session, status } = useSession();
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "cancelled" | "pending">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, error, isLoading } = useSWR<AdminBookingsResponse>(
    status === "authenticated" ? "/api/admin/bookings" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (status === "unauthenticated") {
    redirect("/");
  }

  const bookings = data?.bookings ?? [];

  const filtered = useMemo(() => {
    let list = bookings;
    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.user_email?.toLowerCase().includes(q) ||
          b.booking_reference?.toLowerCase().includes(q) ||
          b.flight_number?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey] ?? 0;
      const bv = (b as unknown as Record<string, unknown>)[sortKey] ?? 0;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [bookings, statusFilter, search, sortKey, sortDir]);

  const totalNetRevenue = filtered.reduce((s, b) => s + (b.net_profit_cents ?? 0), 0);
  const confirmedCount = filtered.filter((b) => b.status === "confirmed").length;
  const cancelledCount = filtered.filter((b) => b.status === "cancelled").length;
  const pendingCount = filtered.filter((b) => b.status === "pending").length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-slate-600">↕</span>;
    return <span className="ml-1 text-accent">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  if (error?.message === "Forbidden") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-400">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-white">All Bookings</h1>
      <p className="mb-6 text-sm text-slate-400">
        Every booking across all users — admin view only.
      </p>

      {/* Summary row */}
      {!isLoading && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Total bookings</p>
            <p className="mt-1 text-2xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="rounded-lg bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Net Revenue</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {formatCurrency(totalNetRevenue, bookings[0]?.currency ?? "GBP")}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">By status</p>
            <p className="mt-1 text-sm text-white">
              <span className="text-green-400">{confirmedCount} confirmed</span>
              {" · "}
              <span className="text-red-400">{cancelledCount} cancelled</span>
              {" · "}
              <span className="text-amber-400">{pendingCount} pending</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Viewing</p>
            <p className="mt-1 text-sm text-white">{filtered.length} of {bookings.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, ref, or flight…"
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          {(["all", "confirmed", "cancelled", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-md px-3 py-2 text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? "bg-accent text-navy"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-800" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <p className="text-sm text-red-400">Failed to load bookings: {error.message}</p>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort("user_email")}>
                  User <SortIcon col="user_email" />
                </th>
                <th className="px-4 py-3">Flight</th>
                <th className="px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort("scheduled_departure")}>
                  Departure <SortIcon col="scheduled_departure" />
                </th>
                <th className="px-4 py-3">Booking Ref</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort("total_amount")}>
                  Total <SortIcon col="total_amount" />
                </th>
                <th className="px-4 py-3">Refund</th>
                <th className="px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort("net_profit_cents")}>
                  Net Profit <SortIcon col="net_profit_cents" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort("created_at")}>
                  Booked <SortIcon col="created_at" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No bookings match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="bg-slate-900 transition-colors hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">{row.user_email ?? "—"}</td>
                    <td className="px-4 py-3 text-white">
                      {row.flight_number ?? "—"} · {row.departure_airport ?? "—"} →{" "}
                      {row.destination_airport ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.scheduled_departure ? formatDateTime(row.scheduled_departure) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-white">
                      {row.booking_reference ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3 text-white">
                      {formatCurrency(row.total_amount, row.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {row.refund_amount_cents != null && row.refund_amount_cents > 0 ? (
                        <span className="text-red-400">
                          -{formatCurrency(row.refund_amount_cents, row.currency)}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          (row.net_profit_cents ?? 0) > 0
                            ? "font-medium text-green-400"
                            : "text-slate-500"
                        }
                      >
                        {formatCurrency(row.net_profit_cents ?? 0, row.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.created_at ? formatDateTime(row.created_at) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
