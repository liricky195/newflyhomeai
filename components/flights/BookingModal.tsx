// CHANGED IN STEP 9: Rewrote to Duffel Links flow — removed DuffelCardForm, 3DS, and card-entry state
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import useSWR from "swr";
import { getName, getCodes } from "country-list";
import type { DbFlight } from "@/lib/db";
import type { DuffelOffer, DuffelOfferConditionDetail, DuffelOfferBaggage } from "@/lib/duffel";

// ─── Country combobox data ────────────────────────────────────────────────────

interface CountryOption {
  code: string;
  label: string;
}

const COUNTRIES: CountryOption[] = (getCodes() as string[])
  .map((code) => ({ code, label: getName(code) ?? code }))
  .sort((a, b) => a.label.localeCompare(b.label));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(isNaN(num) ? 0 : num);
}

function formatCondition(detail: DuffelOfferConditionDetail | null): string {
  if (!detail) return "Contact airline";
  if (!detail.allowed) return "Non-refundable";
  if (detail.penalty_amount !== null && detail.penalty_currency !== null) {
    const penalty = parseFloat(detail.penalty_amount);
    if (penalty === 0) return "Free";
    return `Fee: ${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: detail.penalty_currency.toUpperCase(),
    }).format(penalty)}`;
  }
  return "Allowed";
}

function formatBaggages(baggages: DuffelOfferBaggage[]): string {
  if (baggages.length === 0) return "No bags";
  const parts: string[] = [];
  const checked = baggages.find((b) => b.type === "checked");
  const carryOn = baggages.find((b) => b.type === "carry_on");
  if (carryOn && carryOn.quantity > 0)
    parts.push(`${carryOn.quantity} carry-on`);
  if (checked && checked.quantity > 0)
    parts.push(
      `${checked.quantity} checked${checked.max_weight_kg != null ? ` (${checked.max_weight_kg}kg)` : ""}`
    );
  return parts.join(", ") || "No bags";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PassengerForm {
  given_name: string;
  family_name: string;
  born_on: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  phone: string;
}

interface FormErrors {
  given_name?: string;
  family_name?: string;
  born_on?: string;
  nationality?: string;
  passport_number?: string;
  phone?: string;
  general?: string;
}

type ModalState =
  | "loading-offers"
  | "selecting-offer"
  | "filling-details"
  | "redirecting";

const EMPTY_FORM: PassengerForm = {
  given_name: "",
  family_name: "",
  born_on: "",
  nationality: "",
  passport_number: "",
  passport_expiry: "",
  phone: "",
};

// ─── SWR fetchers ─────────────────────────────────────────────────────────────

const jsonFetcher = (url: string) =>
  fetch(url).then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
  );

const offerFetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 501) return { stub: true, offers: [] };
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Component ───────────────────────────────────────────────────────────────

interface BookingModalProps {
  flight: DbFlight | null;
  onClose: () => void;
}

export default function BookingModal({ flight, onClose }: BookingModalProps) {
  const [modalState, setModalState] = useState<ModalState>("loading-offers");
  const [selectedOffer, setSelectedOffer] = useState<DuffelOffer | null>(null);
  const [form, setForm] = useState<PassengerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Nationality combobox state
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [nationalityOpen, setNationalityOpen] = useState(false);

  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Fetch saved profile to pre-fill form
  const { data: profileData } = useSWR<{
    personal?: {
      full_name?: string | null;
      date_of_birth?: string | null;
      nationality?: string | null;
      passport_number?: string | null;
      passport_expiry?: string | null;
      phone?: string | null;
    } | null;
  }>("/api/monitored-airports", jsonFetcher, { revalidateOnFocus: false });

  const {
    data: offersData,
    isLoading: offersLoading,
    error: offersError,
    mutate: mutateOffers,
  } = useSWR<{ offers: DuffelOffer[]; stub?: boolean }>(
    flight ? `/api/bookings/offers?flight_id=${flight.id}` : null,
    offerFetcher,
    { revalidateOnFocus: false }
  );

  // Reset when a new flight is opened
  useEffect(() => {
    if (!flight) return;
    const p = profileData?.personal;
    const fullName = p?.full_name ?? "";
    const nameParts = fullName.trim().split(/\s+/);
    const nat = p?.nationality ?? "";
    const natLabel = nat
      ? (COUNTRIES.find((c) => c.code === nat)?.label ?? nat)
      : "";
    setForm({
      given_name: nameParts[0] ?? "",
      family_name: nameParts.slice(1).join(" ") || "",
      born_on: p?.date_of_birth ?? "",
      nationality: nat,
      passport_number: p?.passport_number ?? "",
      passport_expiry: p?.passport_expiry ?? "",
      phone: p?.phone ?? "",
    });
    setNationalitySearch(natLabel);
    setNationalityOpen(false);
    setErrors({});
    setSubmitError(null);
    setSelectedOffer(null);
    setModalState("loading-offers");
    submittingRef.current = false;
  }, [flight, profileData]);

  // Transition to selecting-offer when offers load
  useEffect(() => {
    if (!offersLoading && !offersError && offersData) {
      setModalState("selecting-offer");
    }
  }, [offersLoading, offersError, offersData]);

  // Body scroll lock
  useEffect(() => {
    if (flight) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [flight]);

  // Escape key closes modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState !== "redirecting") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, modalState]);

  // Focus the close button when modal opens
  useEffect(() => {
    if (flight) {
      const id = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [flight]);

  const sortedOffers = useMemo<DuffelOffer[]>(() => {
    const offers = offersData?.offers ?? [];
    return [...offers].sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
  }, [offersData]);

  const isStub = offersData?.stub === true;

  const filteredCountries = useMemo(() => {
    if (!nationalitySearch) return [];
    return COUNTRIES.filter(
      (c) =>
        c.label.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(nationalitySearch.toLowerCase())
    ).slice(0, 8);
  }, [nationalitySearch]);

  function handleField(key: keyof PassengerForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!form.given_name.trim()) errs.given_name = "First name is required";
    if (!form.family_name.trim()) errs.family_name = "Last name is required";
    if (!form.born_on) {
      errs.born_on = "Date of birth is required";
    } else {
      const dob = new Date(form.born_on);
      if (isNaN(dob.getTime()) || dob >= new Date())
        errs.born_on = "Enter a valid past date";
    }
    if (!form.nationality.trim()) {
      errs.nationality = "Nationality is required";
    }
    if (!form.passport_number.trim())
      errs.passport_number = "Passport number is required";
    if (form.phone && !/^\+/.test(form.phone.trim())) {
      errs.phone = "Phone must be in international format (e.g. +447700900000)";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSelectOffer = useCallback((offer: DuffelOffer) => {
    setSelectedOffer(offer);
    setModalState("filling-details");
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submittingRef.current || !selectedOffer || !flight) return;
      if (!validate()) return;

      submittingRef.current = true;
      setSubmitError(null);
      setModalState("redirecting");

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: selectedOffer.id,
            flightId: flight.id,
            given_name: form.given_name,
            family_name: form.family_name,
            born_on: form.born_on,
            nationality: form.nationality,
            passport_number: form.passport_number,
            passport_expiry: form.passport_expiry || undefined,
            phone: form.phone || undefined,
          }),
        });

        if (res.status === 400) {
          const body = await res.json().catch(() => ({}));
          setSubmitError(
            (body as { error?: string }).error ?? "Validation failed"
          );
          setModalState("filling-details");
          return;
        }
        if (res.status === 403) {
          setSubmitError("This flight is not available");
          setModalState("filling-details");
          return;
        }
        if (!res.ok) {
          setSubmitError("Could not connect to booking system");
          setModalState("filling-details");
          return;
        }

        const { checkoutUrl } = (await res.json()) as { checkoutUrl: string };
        setTimeout(() => {
          window.location.href = checkoutUrl;
        }, 500);
      } catch {
        setSubmitError("Could not connect to booking system");
        setModalState("filling-details");
      } finally {
        submittingRef.current = false;
      }
    },
    [selectedOffer, flight, form, validate]
  );

  if (!flight) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Book flight"
      onClick={(e) => {
        if (e.target === e.currentTarget && modalState !== "redirecting")
          onClose();
      }}
    >
      <div className="relative flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-navy-800 sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Book Flight</h2>
            <p className="mt-0.5 font-mono text-sm text-slate-400">
              {flight.flight_number} · {flight.departure_airport} →{" "}
              {flight.destination_airport}
            </p>
            <p className="text-xs text-slate-500">
              Dep. {formatTime(flight.scheduled_departure)} · {flight.airline}
            </p>
          </div>
          {modalState !== "redirecting" && (
            <button
              ref={firstFocusRef}
              onClick={onClose}
              aria-label="Close modal"
              className="ml-4 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-navy-700 hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Redirecting ── */}
          {modalState === "redirecting" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                className="mb-4 h-10 w-10 animate-spin text-accent"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <p className="text-base font-medium text-white">
                Redirecting to secure checkout...
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Please don&apos;t close this window.
              </p>
            </div>
          )}

          {/* ── Loading offers ── */}
          {modalState === "loading-offers" && !offersError && (
            <div className="space-y-3 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Searching for offers…
              </p>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-navy-700 shimmer"
                  data-testid="offer-skeleton"
                />
              ))}
            </div>
          )}

          {/* ── Offers error ── */}
          {offersError && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <p className="text-sm text-red-400">
                  Could not load flight options.{" "}
                  {(offersError as Error).message}. Retry.
                </p>
              </div>
              <button
                onClick={() => mutateOffers()}
                className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Selecting offer ── */}
          {modalState === "selecting-offer" && !isStub && (
            <div className="space-y-3">
              {sortedOffers.length === 0 ? (
                <div className="rounded-lg border border-border bg-navy-700/30 px-4 py-6 text-center">
                  <p className="text-sm text-slate-400">
                    No flights are currently available for this route. Please
                    try again later.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Select a flight offer
                  </p>
                  <div className="space-y-2">
                    {sortedOffers.map((offer) => (
                      <button
                        key={offer.id}
                        onClick={() => handleSelectOffer(offer)}
                        className="w-full rounded-lg border border-border bg-navy-700/50 px-4 py-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-mono font-medium text-white">
                              {offer.departure_time &&
                                new Date(offer.departure_time).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  }
                                )}
                            </span>
                            <span className="text-slate-500">→</span>
                            <span className="font-mono text-white">
                              {offer.arrival_time &&
                                new Date(offer.arrival_time).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  }
                                )}
                            </span>
                            {offer.duration && (
                              <span className="text-xs text-slate-500">
                                · {offer.duration}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              ·{" "}
                              {offer.stops === 0
                                ? "Direct"
                                : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
                            </span>
                          </div>
                          <span className="font-mono text-sm font-semibold text-accent">
                            {formatCurrency(offer.amount, offer.currency)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                          <span>{formatBaggages(offer.baggages)}</span>
                          <span className="text-slate-600">·</span>
                          <span>
                            Refund:{" "}
                            {formatCondition(
                              offer.conditions.refund_before_departure
                            )}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Stub notice ── */}
          {isStub && modalState === "selecting-offer" && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-4">
              <p className="text-sm font-medium text-accent">
                Booking coming soon
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Offers will be available shortly.
              </p>
            </div>
          )}

          {/* ── Filling details ── */}
          {modalState === "filling-details" && selectedOffer && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Selected offer summary */}
              <div className="rounded-lg border border-border bg-navy-700/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Selected flight</p>
                    <p className="mt-0.5 text-sm text-slate-300">
                      {flight.flight_number} · {flight.departure_airport} →{" "}
                      {flight.destination_airport}
                    </p>
                  </div>
                  <span className="font-mono text-lg font-bold text-accent">
                    {formatCurrency(selectedOffer.amount, selectedOffer.currency)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalState("selecting-offer")}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Change offer
                </button>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Passenger Details
              </p>

              {/* Given / Family name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="bm-given-name"
                    className="mb-1 block text-xs font-medium text-slate-400"
                  >
                    First Name
                  </label>
                  <input
                    id="bm-given-name"
                    type="text"
                    value={form.given_name}
                    onChange={(e) =>
                      handleField("given_name", e.target.value.toUpperCase())
                    }
                    placeholder="JOHN"
                    className={`w-full rounded-md border bg-navy-700 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50 ${errors.given_name ? "border-red-500/50" : "border-border"}`}
                  />
                  {errors.given_name && (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.given_name}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="bm-family-name"
                    className="mb-1 block text-xs font-medium text-slate-400"
                  >
                    Last Name
                  </label>
                  <input
                    id="bm-family-name"
                    type="text"
                    value={form.family_name}
                    onChange={(e) =>
                      handleField("family_name", e.target.value.toUpperCase())
                    }
                    placeholder="DOE"
                    className={`w-full rounded-md border bg-navy-700 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50 ${errors.family_name ? "border-red-500/50" : "border-border"}`}
                  />
                  {errors.family_name && (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.family_name}
                    </p>
                  )}
                </div>
              </div>

              {/* DOB */}
              <div>
                <label
                  htmlFor="bm-born-on"
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  Date of birth
                </label>
                <input
                  id="bm-born-on"
                  type="date"
                  value={form.born_on}
                  onChange={(e) => handleField("born_on", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={`w-full rounded-md border bg-navy-700 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent/50 ${errors.born_on ? "border-red-500/50" : "border-border"}`}
                />
                {errors.born_on && (
                  <p className="mt-1 text-xs text-red-400">{errors.born_on}</p>
                )}
              </div>

              {/* Passport number */}
              <div>
                <label
                  htmlFor="bm-passport"
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  Passport Number
                </label>
                <input
                  id="bm-passport"
                  type="text"
                  value={form.passport_number}
                  onChange={(e) =>
                    handleField("passport_number", e.target.value.toUpperCase())
                  }
                  placeholder="A12345678"
                  className={`w-full rounded-md border bg-navy-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50 ${errors.passport_number ? "border-red-500/50" : "border-border"}`}
                />
                {errors.passport_number && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.passport_number}
                  </p>
                )}
              </div>

              {/* Nationality combobox */}
              <div className="relative">
                <label
                  htmlFor="bm-nationality"
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  Nationality
                </label>
                <input
                  id="bm-nationality"
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={nationalityOpen}
                  placeholder="Search country…"
                  value={
                    form.nationality
                      ? (COUNTRIES.find((c) => c.code === form.nationality)
                          ?.label ?? nationalitySearch)
                      : nationalitySearch
                  }
                  onChange={(e) => {
                    setNationalitySearch(e.target.value);
                    handleField("nationality", "");
                    setNationalityOpen(true);
                  }}
                  onFocus={() => setNationalityOpen(true)}
                  onBlur={() =>
                    setTimeout(() => setNationalityOpen(false), 150)
                  }
                  className={`w-full rounded-md border bg-navy-700 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50 ${errors.nationality ? "border-red-500/50" : "border-border"}`}
                />
                {nationalityOpen && filteredCountries.length > 0 && (
                  <ul
                    role="listbox"
                    aria-label="Nationality options"
                    className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-navy-800 py-1 shadow-xl"
                  >
                    {filteredCountries.map((c) => (
                      <li
                        key={c.code}
                        role="option"
                        aria-selected={form.nationality === c.code}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleField("nationality", c.code);
                          setNationalitySearch(c.label);
                          setNationalityOpen(false);
                        }}
                        className="cursor-pointer px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
                      >
                        <span className="font-mono font-semibold text-accent">
                          {c.code}
                        </span>{" "}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
                {errors.nationality && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.nationality}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="bm-phone"
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  Phone number (international format, e.g. +447700900000)
                </label>
                <input
                  id="bm-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => handleField("phone", e.target.value)}
                  placeholder="+447700900000"
                  className={`w-full rounded-md border bg-navy-700 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50 ${errors.phone ? "border-red-500/50" : "border-border"}`}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-400">{errors.phone}</p>
                )}
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <button
                  type="submit"
                  disabled={submittingRef.current}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue to Checkout
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
