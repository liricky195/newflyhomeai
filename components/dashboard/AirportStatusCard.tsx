// CHANGED IN STEP 9: Made airportIata prop optional; handles null/undefined without crash
"use client";

const AIRPORT_NAMES: Record<string, string> = {
  DXB: "Dubai International",
  AUH: "Abu Dhabi International",
  DOH: "Hamad International",
  BAH: "Bahrain International",
  KWI: "Kuwait International",
};

interface AirportStatusCardProps {
  airportIata?: string | null;
}

export default function AirportStatusCard({ airportIata }: AirportStatusCardProps) {
  if (!airportIata) {
    return (
      <div className="rounded-xl border border-border bg-navy-700 p-6">
        <p className="text-sm text-slate-500">No airport configured.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-navy-700 p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-2xl font-bold text-white">
          {airportIata}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-400"
            data-testid="disruption-indicator"
            aria-label="Disruption status indicator"
          />
          Status Unknown
        </span>
      </div>
      <p className="text-sm text-slate-400">
        {AIRPORT_NAMES[airportIata] ?? airportIata}
      </p>
    </div>
  );
}
