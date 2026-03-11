// CHANGED IN STEP 9: Added proper loading/error/empty states, Retry button, 20-notification cap
"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DbNotification } from "@/lib/db";
import Link from "next/link";

const MAX_VISIBLE = 20;

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<{ notifications: DbNotification[]; total: number }>;
  });

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type NotificationType = DbNotification["type"];

function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === "new_flight") {
    return (
      <svg
        className="h-4 w-4 shrink-0 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"
        />
      </svg>
    );
  }
  if (type === "status_change") {
    return (
      <svg
        className="h-4 w-4 shrink-0 text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    );
  }
  if (type === "booking_confirmed") {
    return (
      <svg
        className="h-4 w-4 shrink-0 text-green-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="h-4 w-4 shrink-0 text-red-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function AlertFeedSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-navy-700 p-6">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-4 w-4 shrink-0 rounded-full bg-navy-600 shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-navy-600 shimmer" />
              <div className="h-3 w-1/2 rounded bg-navy-600 shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AlertFeed() {
  const { data, error, isLoading, mutate } = useSWR<{
    notifications: DbNotification[];
    total: number;
  }>("/api/notifications", fetcher, { refreshInterval: 30000 });

  const [marking, setMarking] = useState(false);

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await fetch("/api/notifications", { method: "POST" });
      await mutate();
    } finally {
      setMarking(false);
    }
  }

  if (isLoading) {
    return <AlertFeedSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-navy-700 p-6">
        <p className="mb-3 text-sm text-red-400">
          {(error as Error).message ?? "Failed to load notifications"}
        </p>
        <button
          onClick={() => mutate()}
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          Retry
        </button>
      </div>
    );
  }

  const allNotifications = data?.notifications ?? [];
  const total = data?.total ?? 0;
  const visibleNotifications = allNotifications.slice(0, MAX_VISIBLE);
  const hasMore = total > MAX_VISIBLE;

  if (allNotifications.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-navy-700 p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-4 h-3 w-3 rounded-full bg-accent animate-radar" />
          <p className="text-sm text-slate-400">
            No alerts yet. Monitoring is active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-navy-700">
      <div className="divide-y divide-border">
        {visibleNotifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5">
              <NotificationIcon type={n.type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {!n.read_at && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    data-testid="unread-dot"
                  />
                )}
                <h4 className="truncate text-sm font-medium text-white">
                  {n.title}
                </h4>
              </div>
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                {n.body}
              </p>
              <p className="mt-1 text-xs text-slate-600">{timeAgo(n.sent_at)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        {hasMore ? (
          <Link
            href="/flights"
            className="text-xs font-medium text-accent hover:underline"
          >
            View all
          </Link>
        ) : (
          <span />
        )}
        <button
          onClick={handleMarkAllRead}
          disabled={marking || allNotifications.length === 0}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {marking ? "Clearing…" : "Mark all as Read"}
        </button>
      </div>
    </div>
  );
}
