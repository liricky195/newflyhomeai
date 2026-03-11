"use client";

import { useScan } from "@/contexts/ScanContext";

function fmt(secs: number): string {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Ribbon countdown pill — reads from the global ScanContext, no independent timer. */
export default function NavScanCountdown() {
  const { remaining, airportIata } = useScan();

  if (!airportIata || remaining === null) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-navy-700/40 px-2.5 py-1 text-xs text-slate-400">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      <span>
        {airportIata}{" "}
        <span className="font-mono text-white">{fmt(remaining)}</span>
      </span>
    </div>
  );
}
