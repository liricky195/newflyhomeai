"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";
import useSWR, { useSWRConfig } from "swr";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScanContextValue {
  /** Unix seconds timestamp of the next scheduled scan, or null if unknown. */
  nextScanAt: number | null;
  /** Seconds until the next scan, computed from nextScanAt. Null before first poll. */
  remaining: number | null;
  airportIata: string | null;
  scanIntervalSeconds: number;
}

interface ScanStatusResponse {
  airportIata: string | null;
  scanIntervalSeconds: number;
  lastScanAt: number | null;
  nextScanAt: number | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ScanContext = createContext<ScanContextValue>({
  nextScanAt: null,
  remaining: null,
  airportIata: null,
  scanIntervalSeconds: 1800,
});

export function useScan(): ScanContextValue {
  return useContext(ScanContext);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const jsonFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// sessionStorage key used to record the nextScanAt value for which globalMutate
// was last fired. Persists across ScanProvider remounts within the same browser
// tab so the same scan boundary cannot trigger /api/flights twice even after a
// logout/re-login cycle.
const SCAN_FIRED_KEY = "flyhome_scanFiredAt";

// ─── Provider ────────────────────────────────────────────────────────────────

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const { mutate: globalMutate } = useSWRConfig();
  const globalMutateRef = useRef(globalMutate);
  globalMutateRef.current = globalMutate;

  const [remaining, setRemaining] = useState<number | null>(null);

  // Tracks whether nextScanAt was ever in the future during this mount.
  // Used to distinguish "page loaded while next_scan_at is already past" (should NOT
  // re-trigger) from "countdown actively reached zero" (SHOULD trigger).
  const hadFutureNextScanAtRef = useRef(false);

  // Single scan-status poll shared by all pages.
  const { data: statusData } = useSWR<ScanStatusResponse>(
    "/api/scan-status",
    jsonFetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      // Prevent an immediate fetch on every ScanProvider mount (page load,
      // re-login, new tab). The 60-second refreshInterval is sufficient to
      // keep scan-status current; a mount-time fetch adds no value and can
      // create a race window where the countdown effect re-evaluates with a
      // freshly-cleared scanFiredRef before the new data arrives.
      revalidateOnMount: false,
    }
  );

  const airportIata = statusData?.airportIata ?? null;
  const scanIntervalSeconds = statusData?.scanIntervalSeconds ?? 1800;
  const nextScanAt = statusData?.nextScanAt ?? null;

  // ── Countdown timer driven by server-provided nextScanAt ──────────────────
  // This is the ONLY setInterval driving the scan-boundary trigger.
  // GET /api/flights is fired when the countdown actively transitions to 0.
  // Two guards prevent spurious fires:
  //
  // 1. hadFutureNextScanAtRef (in-memory, per-mount):
  //    nextScanAt must have been in the future at some point during this mount.
  //    This blocks the trigger on page reload / fresh login / new tab where
  //    next_scan_at is already past before the first tick.
  //
  // 2. sessionStorage (persists across ScanProvider remounts within the tab):
  //    Records the nextScanAt value for which globalMutate was last called.
  //    Prevents the same scan boundary from firing twice if the user logs out
  //    and back in before the next /api/scan-status poll returns a fresh value.
  useEffect(() => {
    if (!airportIata) return;

    const now = Math.floor(Date.now() / 1000);

    // One-way ratchet: once nextScanAt has been in the future during this mount,
    // we know any subsequent 0/past value is a genuine scan completion event.
    if (nextScanAt !== null && nextScanAt > now) {
      hadFutureNextScanAtRef.current = true;
    }

    const tick = () => {
      const now2 = Math.floor(Date.now() / 1000);
      let next: number | null = null;

      if (nextScanAt !== null) {
        const diff = nextScanAt - now2;
        next = diff > 0 ? diff : 0;
      }

      setRemaining(next);

      if (next === 0 && nextScanAt !== null && hadFutureNextScanAtRef.current) {
        let lastFired = 0;
        try { lastFired = parseInt(sessionStorage.getItem(SCAN_FIRED_KEY) ?? "0", 10); }
        catch { /* private browsing / storage unavailable */ }

        if (lastFired !== nextScanAt) {
          try { sessionStorage.setItem(SCAN_FIRED_KEY, String(nextScanAt)); }
          catch { /* ignore */ }
          globalMutateRef.current(`/api/flights?airport=${airportIata}`);
          // Immediately refresh scan-status so nextScanAt updates without
          // waiting for the 60-second SWR poll cycle.
          globalMutateRef.current("/api/scan-status");
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [airportIata, nextScanAt]);

  return (
    <ScanContext.Provider
      value={{ nextScanAt, remaining, airportIata, scanIntervalSeconds }}
    >
      {children}
    </ScanContext.Provider>
  );
}
