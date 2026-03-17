"use client";

import { useState, useEffect } from "react";
import { gmtOffsetLabelForAirport } from "@/lib/airportTimezone";
import { useScan } from "@/contexts/ScanContext";

/**
 * Scan countdown card — reads remaining seconds and airportIata directly from
 * ScanContext, the same single source of truth used by the navbar ribbon pill.
 * No independent timer; the ScanContext interval drives all updates.
 */
export default function ScanCountdown() {
  const { remaining, airportIata } = useScan();

  // Empty string on SSR; set on client to avoid hydration mismatch
  const [gmtOffset, setGmtOffset] = useState<string>("");

  useEffect(() => {
    if (airportIata) {
      setGmtOffset(gmtOffsetLabelForAirport(airportIata));
    }
  }, [airportIata]);

  const isScanning = remaining === null || remaining === 0;

  const display = isScanning
    ? null
    : `${String(Math.floor(remaining! / 60)).padStart(2, "0")}:${String(remaining! % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-border bg-navy-700 p-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        Next scan in
        {gmtOffset && (
          <span className="ml-1.5 font-mono normal-case font-normal text-slate-600">
            {gmtOffset}
          </span>
        )}
      </p>
      {isScanning ? (
        <span className="flex items-center gap-2 font-mono text-3xl font-bold text-accent">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
          Scanning&nbsp;…
        </span>
      ) : (
        <span
          className="font-mono text-3xl font-bold text-accent tabular-nums"
          style={{ minWidth: "5ch", display: "inline-block" }}
        >
          {display}
        </span>
      )}
    </div>
  );
}
