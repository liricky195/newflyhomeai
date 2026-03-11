import type { AdminStats } from "@/lib/db";

interface StatsPanelProps {
  stats: AdminStats;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const { totalUsers, subscriptions, activeAirports } = stats;

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Total Users" value={totalUsers.toLocaleString()} />
      <StatCard
        label="Free"
        value={subscriptions.free.toLocaleString()}
        sub="tier"
      />
      <StatCard
        label="Standard"
        value={subscriptions.standard.toLocaleString()}
        sub="tier"
      />
      <StatCard
        label="Pro"
        value={subscriptions.pro.toLocaleString()}
        sub="tier"
      />
      <StatCard
        label="Ultimate"
        value={subscriptions.ultimate.toLocaleString()}
        sub="tier"
      />
      <div className="col-span-2 sm:col-span-3 lg:col-span-5 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Active Monitored Airports ({activeAirports.length})
        </p>
        {activeAirports.length === 0 ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeAirports.map((iata) => (
              <span
                key={iata}
                className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-mono text-slate-300"
              >
                {iata}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
        {sub && <span className="ml-1 normal-case text-slate-500">{sub}</span>}
      </p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
