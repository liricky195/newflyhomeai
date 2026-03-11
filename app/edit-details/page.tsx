"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getName, getCodes } from "country-list";
import PageTransition from "@/components/shared/PageTransition";
import AirportCombobox from "@/components/shared/AirportCombobox";
import type { AirportEntry } from "@/components/shared/AirportCombobox";

// ─── Country combobox data ────────────────────────────────────────────────────

interface CountryOption {
  code: string;
  label: string;
}

const COUNTRIES: CountryOption[] = (getCodes() as string[])
  .map((code) => ({ code, label: getName(code) ?? code }))
  .sort((a, b) => a.label.localeCompare(b.label));

// ─── Phone helpers ────────────────────────────────────────────────────────────

function formatPhoneDisplay(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw);
  return parsed ? parsed.formatInternational() : raw;
}

function toE164(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw);
  return parsed?.isValid() ? parsed.format("E.164") : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditDetailsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [airportIata, setAirportIata] = useState<string | null>(null);
  const [airportEntry, setAirportEntry] = useState<AirportEntry | null>(null);
  const [destinationIata, setDestinationIata] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");

  // Nationality combobox state
  const [nationalityCode, setNationalityCode] = useState("");
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [nationalityOpen, setNationalityOpen] = useState(false);

  // Phone
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, router]);

  // Pre-populate form from saved data
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/monitored-airports")
      .then((r) => r.json())
      .then(async (data) => {
        if (data.airport) {
          setAirportIata(data.airport.airport_iata ?? null);
          setDestinationIata(data.airport.destination_iata ?? null);

          // Look up airport name from the JSON for read-only display
          if (data.airport.airport_iata) {
            try {
              const res = await fetch("/data/airports.json");
              if (res.ok) {
                const airports: AirportEntry[] = await res.json();
                const found = airports.find((a) => a.iata === data.airport.airport_iata);
                if (found) setAirportEntry(found);
              }
            } catch { /* ignore */ }
          }
        }
        if (data.personal) {
          setFullName(data.personal.full_name ?? "");
          setDob(data.personal.date_of_birth ?? "");
          setPassportNumber(data.personal.passport_number ?? "");
          setPassportExpiry(data.personal.passport_expiry ?? "");

          const nat = data.personal.nationality ?? "";
          setNationalityCode(nat);
          if (nat) {
            const found = COUNTRIES.find((c) => c.code === nat);
            setNationalitySearch(found ? found.label : nat);
          }

          const phone = data.personal.phone ?? "";
          setPhoneDisplay(phone ? formatPhoneDisplay(phone) : "");
        }
      })
      .catch(() => {});
  }, [status]);

  if (status !== "authenticated") return null;

  const filteredCountries = nationalitySearch
    ? COUNTRIES.filter(
        (c) =>
          c.label.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(nationalitySearch.toLowerCase())
      ).slice(0, 8)
    : [];

  function handlePhoneBlur() {
    if (!phoneDisplay) { setPhoneError(null); return; }
    const e164 = toE164(phoneDisplay);
    if (!e164) {
      setPhoneError("Enter a valid international phone number including country code (e.g. +1 555 000 0000)");
    } else {
      setPhoneError(null);
      setPhoneDisplay(formatPhoneDisplay(phoneDisplay));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Phone validation
    if (phoneDisplay) {
      const e164 = toE164(phoneDisplay);
      if (!e164) {
        setPhoneError("Enter a valid international phone number including country code");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const phoneE164 = phoneDisplay ? toE164(phoneDisplay) : null;

    try {
      const body: Record<string, unknown> = {
        destination_iata: destinationIata || null,
        personal_details: {
          full_name: fullName || null,
          date_of_birth: dob || null,
          passport_number: passportNumber || null,
          passport_expiry: passportExpiry || null,
          nationality: nationalityCode || null,
          phone: phoneE164 || null,
        },
      };

      // Only include airport_iata on initial setup (when airportIata is not yet set)
      // After setup, the airport is locked and must not be sent
      if (!airportIata) {
        setError("Please set your stranded airport first.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/monitored-airports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error((resBody as { error?: string }).error ?? "Failed to save. Please try again.");
      }

      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-white">Travel Details</h1>
        <p className="mb-8 text-sm text-slate-400">
          Tell us where you are stranded and where you want to go.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Stranded Airport — read-only display */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Stranded Airport
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-navy-800/60 px-4 py-2.5">
              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <div className="flex-1">
                {airportEntry ? (
                  <span className="text-sm text-white">
                    {airportEntry.name}{" "}
                    <span className="font-mono text-accent">({airportEntry.iata})</span>
                    {" "}— {airportEntry.city}, {airportEntry.country}
                  </span>
                ) : airportIata ? (
                  <span className="font-mono text-sm text-white">{airportIata}</span>
                ) : (
                  <span className="text-sm text-slate-500">Not yet configured</span>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Cannot be changed — contact support if this is incorrect.
            </p>
          </div>

          {/* Preferred destination */}
          <AirportCombobox
            label="Preferred Destination"
            value={destinationIata}
            onChange={setDestinationIata}
            placeholder="Search city or airport — e.g. London, Heathrow, LHR"
          />

          {/* Personal details section */}
          <div className="border-t border-border pt-6">
            <h2 className="mb-1 text-lg font-semibold text-white">Personal Details</h2>
            <p className="mb-4 text-xs text-slate-500">
              Used to pre-fill booking forms. Encrypted at rest.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="full-name"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Full Name (as on passport)
                </label>
                <input
                  id="full-name"
                  type="text"
                  placeholder="JOHN DOE"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-border bg-navy-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="dob"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Date of Birth
                  </label>
                  <input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-lg border border-border bg-navy-800 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-accent"
                  />
                </div>

                {/* Nationality combobox */}
                <div className="relative">
                  <label
                    htmlFor="nationality"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Nationality
                  </label>
                  <input
                    id="nationality"
                    type="text"
                    placeholder="Search country…"
                    value={nationalityCode
                      ? (COUNTRIES.find((c) => c.code === nationalityCode)?.label ?? nationalitySearch)
                      : nationalitySearch}
                    onChange={(e) => {
                      setNationalitySearch(e.target.value);
                      setNationalityCode("");
                      setNationalityOpen(true);
                    }}
                    onFocus={() => setNationalityOpen(true)}
                    onBlur={() => setTimeout(() => setNationalityOpen(false), 150)}
                    className="w-full rounded-lg border border-border bg-navy-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent"
                  />
                  {nationalityOpen && filteredCountries.length > 0 && (
                    <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-navy-800 py-1 shadow-xl">
                      {filteredCountries.map((c) => (
                        <li
                          key={c.code}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNationalityCode(c.code);
                            setNationalitySearch(c.label);
                            setNationalityOpen(false);
                          }}
                          className="cursor-pointer px-4 py-2 text-sm text-slate-300 hover:bg-navy-700"
                        >
                          <span className="font-mono font-semibold text-accent">{c.code}</span>
                          <span className="ml-2">{c.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="passport-number"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Passport Number
                  </label>
                  <input
                    id="passport-number"
                    type="text"
                    placeholder="A12345678"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-border bg-navy-800 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="passport-expiry"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Passport Expiry
                  </label>
                  <input
                    id="passport-expiry"
                    type="date"
                    value={passportExpiry}
                    onChange={(e) => setPassportExpiry(e.target.value)}
                    className="w-full rounded-lg border border-border bg-navy-800 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={phoneDisplay}
                  onChange={(e) => {
                    setPhoneDisplay(e.target.value);
                    setPhoneError(null);
                  }}
                  onBlur={handlePhoneBlur}
                  className={`w-full rounded-lg border bg-navy-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent ${
                    phoneError ? "border-red-500/50" : "border-border"
                  }`}
                />
                {phoneError && (
                  <p className="mt-1 text-xs text-red-400">{phoneError}</p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-critical/10 px-4 py-3 text-sm text-critical">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-navy transition-colors hover:bg-accent-dark disabled:opacity-60"
          >
            {submitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </PageTransition>
  );
}
