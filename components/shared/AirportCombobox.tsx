"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AirportEntry {
  iata: string;
  name: string;
  city: string;
  country: string;
}

interface AirportComboboxProps {
  value: string | null;
  onChange: (iata: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  error?: string;
}

let cachedAirports: AirportEntry[] | null = null;

async function loadAirports(): Promise<AirportEntry[]> {
  if (cachedAirports) return cachedAirports;
  const res = await fetch("/data/airports.json");
  if (!res.ok) throw new Error("Failed to load airport data");
  cachedAirports = (await res.json()) as AirportEntry[];
  return cachedAirports;
}

function searchAirports(airports: AirportEntry[], query: string): AirportEntry[] {
  const q = query.trim();
  if (!q) return [];

  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  const scored: Array<{ airport: AirportEntry; score: number }> = [];

  for (const airport of airports) {
    let score = 0;
    if (airport.iata === upper) score = 100;
    else if (airport.iata.startsWith(upper)) score = 80;
    else if (airport.city.toLowerCase().startsWith(lower)) score = 60;
    else if (airport.name.toLowerCase().startsWith(lower)) score = 50;
    else if (airport.city.toLowerCase().includes(lower)) score = 30;
    else if (airport.name.toLowerCase().includes(lower)) score = 20;
    else if (airport.country.toLowerCase().includes(lower)) score = 10;

    if (score > 0) scored.push({ airport, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => s.airport);
}

export default function AirportCombobox({
  value,
  onChange,
  placeholder = "Search city or airport name…",
  disabled = false,
  label,
  required,
  error,
}: AirportComboboxProps) {
  const [query, setQuery] = useState("");
  const [airports, setAirports] = useState<AirportEntry[]>([]);
  const [results, setResults] = useState<AirportEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load airport data on first interaction
  const ensureLoaded = useCallback(async () => {
    if (airports.length > 0) return;
    setLoading(true);
    try {
      const data = await loadAirports();
      setAirports(data);
    } catch {
      // Silent fail — user can still type
    } finally {
      setLoading(false);
    }
  }, [airports.length]);

  // Display label for currently selected value
  const selectedEntry = value
    ? (cachedAirports ?? airports).find((a) => a.iata === value) ?? null
    : null;

  const displayValue = selectedEntry
    ? `${selectedEntry.name} (${selectedEntry.iata}) — ${selectedEntry.city}, ${selectedEntry.country}`
    : query;

  useEffect(() => {
    if (airports.length === 0) return;
    setResults(searchAirports(airports, query));
    setHighlighted(0);
  }, [query, airports]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(null); // clear selection when typing
    setOpen(true);
    void ensureLoaded();
  }

  function handleSelect(airport: AirportEntry) {
    onChange(airport.iata);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        void ensureLoaded();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[highlighted]) handleSelect(results[highlighted]);
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  const inputDisplayValue = value && selectedEntry
    ? `${selectedEntry.name} (${selectedEntry.iata}) — ${selectedEntry.city}, ${selectedEntry.country}`
    : query;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          {label} {required && <span className="text-critical">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputDisplayValue}
          onChange={handleInputChange}
          onFocus={() => {
            void ensureLoaded();
            if (query || !value) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Loading airports…" : placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-lg border bg-navy-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent pr-8 ${
            error ? "border-red-500/50" : "border-border"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 text-slate-500 hover:text-white transition-colors"
            aria-label="Clear selection"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-navy-800 py-1 shadow-xl"
          role="listbox"
        >
          {results.map((airport, i) => (
            <li
              key={airport.iata}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(airport); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                i === highlighted
                  ? "bg-accent/10 text-white"
                  : "text-slate-300 hover:bg-navy-700"
              }`}
            >
              <span className="font-mono font-semibold text-accent">{airport.iata}</span>
              <span className="ml-2">{airport.name}</span>
              <span className="ml-1 text-xs text-slate-500">— {airport.city}, {airport.country}</span>
            </li>
          ))}
        </ul>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-navy-800 px-4 py-3 text-sm text-slate-500 shadow-xl">
          No airports found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
