const BASE_URL = "https://api.duffel.com";

// Rate limiting: Duffel API has strict rate limits
let duffelLastRequestTime = 0;
const DUFFEL_MIN_DELAY_MS = 1000; // 500ms between requests (2 req/sec max)

async function duffelRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - duffelLastRequestTime;
  if (elapsed < DUFFEL_MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, DUFFEL_MIN_DELAY_MS - elapsed));
  }
  duffelLastRequestTime = Date.now();
}

function getApiKey(): string {
  // HARDENED IN STEP 10: startup assertion
  const key = process.env.DUFFEL_API_KEY;
  if (!key) {
    throw new Error(
      "DUFFEL_API_KEY is required. Obtain from your Duffel dashboard."
    );
  }
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public httpStatus: number,
    public apiMessage: string
  ) {
    super(`Duffel API error ${httpStatus}: ${apiMessage}`);
    this.name = "ApiError";
  }
}

export interface DuffelPassenger {
  type: "adult" | "child" | "infant_without_seat";
  given_name?: string;
  family_name?: string;
  born_on?: string; // YYYY-MM-DD
  gender?: "m" | "f";
  title?: string;
  passport_number?: string;
  passport_expiry?: string; // YYYY-MM-DD
  nationality?: string; // ISO 3166-1 alpha-2
  phone_number?: string;
}

export interface DuffelSlice {
  origin: string;
  destination: string;
  departure_date: string; // YYYY-MM-DD
}

export interface DuffelOfferConditionDetail {
  allowed: boolean;
  /** Penalty amount as a decimal string (e.g. "50.00"), or null when not provided by the airline. */
  penalty_amount: string | null;
  penalty_currency: string | null;
}

export interface DuffelOfferConditions {
  refund_before_departure: DuffelOfferConditionDetail | null;
  change_before_departure: DuffelOfferConditionDetail | null;
}

export interface DuffelOfferBaggage {
  type: "carry_on" | "checked";
  quantity: number;
  /** Maximum weight in kilograms, if provided by the airline. */
  max_weight_kg: number | null;
}

export interface DuffelOffer {
  id: string;
  airline: string;
  airline_name: string;
  departure_time: string;
  arrival_time: string;
  duration: string;
  cabin_class: string;
  amount: string; // decimal string, e.g. "123.45"
  currency: string;
  stops: number;
  conditions: DuffelOfferConditions;
  /** Baggage included for the first (adult) passenger. */
  baggages: DuffelOfferBaggage[];
}

export interface DuffelOrder {
  id: string;
  booking_reference: string;
  ticket_number: string | null;
  status: string;
}

export interface DuffelLink {
  id: string;
  url: string;
  expires_at: string;
  reference: string;
}

export interface DuffelOrderFull {
  id: string;
  booking_reference: string | null;
  documents: Array<{ passenger_id: string; document_number: string }>;
  total_amount: string;
  total_currency: string;
  conditions: {
    refund_before_departure: {
      allowed: boolean;
      penalty_amount: string | null;
      penalty_currency: string | null;
    } | null;
    change_before_departure: {
      allowed: boolean;
      penalty_amount: string | null;
    } | null;
  };
}

/**
 * Thrown when step 2 (confirm) of requestUserCancellation fails.
 * Carries the cancellationId from step 1 so the caller can persist it.
 */
export class Step2CancellationError extends Error {
  constructor(
    public readonly cancellationId: string,
    public readonly cause: unknown
  ) {
    super((cause as Error)?.message ?? "Cancellation confirmation failed");
    this.name = "Step2CancellationError";
  }
}

// ─── In-memory bookability cache (5-minute TTL) ─────────────────────────────

export interface BookabilityResult {
  bookable: boolean;
  lowestPriceCents: number | null;
  currency: string | null;
}

interface CacheEntry extends BookabilityResult {
  expiresAt: number;
}

// Persist the cache across Next.js hot-reloads in development.
// In production each worker process keeps its own Map, which is fine.
const _g = globalThis as typeof globalThis & { _bookabilityCache?: Map<string, CacheEntry> };
_g._bookabilityCache ??= new Map<string, CacheEntry>();
const bookabilityCache = _g._bookabilityCache;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── API helpers ─────────────────────────────────────────────────────────────

async function duffelFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  await duffelRateLimit(); // Rate limit to avoid 429 errors

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string> ?? {}) },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, text);
  }

  return (await res.json()) as T;
}

// ─── Public functions ────────────────────────────────────────────────────────

export async function createDuffelLink(params: {
  offerId: string;
  reference: string;
  successUrl: string;
  abandonUrl: string;
}): Promise<{ id: string; url: string; expiresAt: string }> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const res = await duffelFetch<{ data: DuffelLink }>("/links", {
    method: "POST",
    body: JSON.stringify({
      data: {
        offer_id: params.offerId,
        reference: params.reference,
        expires_at: expiresAt,
        success_url: params.successUrl,
        abandon_url: params.abandonUrl,
      },
    }),
  });

  if (!res.data?.url) {
    throw new ApiError(0, "Malformed Duffel Links response");
  }

  return {
    id: res.data.id,
    url: res.data.url,
    expiresAt: res.data.expires_at,
  };
}

export async function createComponentClientKey(): Promise<string> {
  const res = await duffelFetch<{ data: { component_client_key: string } }>(
    "/identity/component_client_keys",
    { method: "POST", body: "{}" }
  );
  return res.data.component_client_key;
}

export async function createOrderWithCard(params: {
  offerId: string;
  amount: string;
  currency: string;
  threeDSecureSessionId: string;
  passengers: DuffelPassenger[];
}): Promise<DuffelOrder> {
  const data = await duffelFetch<{
    data: { id: string; booking_reference: string; status: string; documents?: Array<{ document_number?: string }> };
  }>("/air/orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [params.offerId],
        passengers: params.passengers.map((p, i) => ({
          id: `pas_${i}`,
          type: p.type,
          given_name: p.given_name,
          family_name: p.family_name,
          born_on: p.born_on,
          gender: p.gender ?? "m",
          title: p.title ?? "mr",
          ...(p.phone_number ? { phone_number: p.phone_number } : {}),
          ...(p.passport_number
            ? {
                identity_documents: [
                  {
                    type: "passport",
                    unique_identifier: p.passport_number,
                    issuing_country_code: p.nationality ?? "GB",
                    expires_on: p.passport_expiry ?? "2030-01-01",
                  },
                ],
              }
            : {}),
        })),
        payments: [
          {
            type: "card",
            amount: params.amount,
            currency: params.currency,
            three_d_secure_session_id: params.threeDSecureSessionId,
          },
        ],
      },
    }),
  });

  return {
    id: data.data.id,
    booking_reference: data.data.booking_reference,
    ticket_number: data.data.documents?.[0]?.document_number ?? null,
    status: data.data.status,
  };
}

export async function fetchDuffelOrder(orderId: string): Promise<DuffelOrderFull> {
  const res = await duffelFetch<{ data: DuffelOrderFull }>(`/air/orders/${orderId}`);
  return res.data;
}

export async function checkFlightBookable(
  flightNumber: string,
  departureDate: string,
  origin: string,
  destination: string
): Promise<BookabilityResult> {
  // Skip flights with no known destination — cannot search Duffel without one.
  if (destination === "Unknown") {
    return { bookable: false, lowestPriceCents: null, currency: null };
  }

  // Skip flights whose departure date has already passed (UTC). Same-day flights
  // are allowed through — Duffel accepts them on most routes, and any that are
  // rejected return a 422 handled in the catch block below.
  const today = new Date().toISOString().slice(0, 10);
  if (departureDate <= today) {
    return { bookable: false, lowestPriceCents: null, currency: null };
  }

  const cacheKey = `${flightNumber}-${departureDate}`;
  const cached = bookabilityCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { bookable: cached.bookable, lowestPriceCents: cached.lowestPriceCents, currency: cached.currency };
  }

  // Strip all whitespace before comparing so "EK301" and "EK 301" are treated identically.
  const normalize = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

  try {
    type CheckSeg = {
      marketing_carrier: { iata_code: string };
      marketing_carrier_flight_number: string;
      operating_carrier?: { iata_code: string };
      operating_carrier_flight_number?: string;
    };
    const data = await duffelFetch<{
      data: {
        id: string;
        offers?: Array<{
          total_amount: string;
          total_currency: string;
          slices?: Array<{ segments?: Array<CheckSeg> }>;
        }>;
      };
    }>(
      "/air/offer_requests",
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            slices: [{ origin, destination, departure_date: departureDate }],
            passengers: [{ type: "adult" }],
            cabin_class: "economy",
            return_offers: true,
          },
        }),
      }
    );

    const allOffers = Array.isArray(data.data.offers) ? data.data.offers : [];
    // Filter to nonstop offers that match the exact flight number (space-insensitive).
    const targetFlight = normalize(flightNumber);
    const offers = allOffers.filter((o) => {
      const segs = o.slices?.[0]?.segments ?? [];
      if (segs.length !== 1) return false; // nonstop only
      const seg = segs[0];
      const marketing = normalize(`${seg.marketing_carrier.iata_code}${seg.marketing_carrier_flight_number}`);
      const operating = seg.operating_carrier && seg.operating_carrier_flight_number
        ? normalize(`${seg.operating_carrier.iata_code}${seg.operating_carrier_flight_number}`)
        : null;
      return marketing === targetFlight || operating === targetFlight;
    });
    const bookable = offers.length > 0;
    const prices = offers
      .map((o) => Math.round(parseFloat(o.total_amount) * 100))
      .filter((p) => !isNaN(p));
    const lowestPriceCents = prices.length > 0 ? Math.min(...prices) : null;
    const currency = offers[0]?.total_currency ?? null;

    const result: BookabilityResult = { bookable, lowestPriceCents, currency };
    // Only cache confirmed results (successful Duffel response).
    bookabilityCache.set(cacheKey, { ...result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    // 429 rate-limit: Duffel could not confirm bookability. Fail closed so the flight
    // is hidden rather than shown with no price. Do NOT cache — retry on next scan.
    if (err instanceof ApiError && err.httpStatus === 429) {
      console.warn(`[bookabilityCheck] Rate-limited for ${flightNumber} — marking non-bookable until next scan.`);
      return { bookable: false, lowestPriceCents: null, currency: null };
    }

    // Duffel rejects same-day searches with 422 on some routes. Treat as non-bookable.
    if (err instanceof ApiError && err.httpStatus === 422) {
      const msg = err.apiMessage.toLowerCase();
      if (msg.includes("past") || msg.includes("today") || msg.includes("future")) {
        return { bookable: false, lowestPriceCents: null, currency: null };
      }
    }

    // All other errors (network timeout, 5xx): fail open so a transient outage does not
    // hide potentially bookable flights. Do NOT cache — retry on next scan.
    console.error(`[bookabilityCheck] Error for ${flightNumber}:`, (err as Error).message);
    return { bookable: true, lowestPriceCents: null, currency: null };
  }
}

export async function searchOffers(
  flightNumber: string,
  departureDate: string,
  origin: string,
  destination: string,
  passengers: DuffelPassenger[]
): Promise<DuffelOffer[]> {
  type BaggageShape = {
    type: "carry_on" | "checked";
    quantity: number;
    max_weight_kg?: number | null;
  };
  type SegmentShape = {
    departing_at: string;
    arriving_at: string;
    marketing_carrier: { iata_code: string; name: string };
    marketing_carrier_flight_number: string;
    operating_carrier?: { iata_code: string };
    operating_carrier_flight_number?: string;
    // Duffel path: slices[].segments[].passengers[].baggages[]
    passengers?: Array<{
      baggages?: BaggageShape[];
    }>;
  };
  type ConditionDetail = {
    allowed: boolean;
    penalty_amount: string | null;
    penalty_currency: string | null;
  };
  type OfferShape = {
    id: string;
    owner: { name: string; iata_code: string };
    slices: Array<{
      duration: string;
      segments: Array<SegmentShape>;
    }>;
    total_amount: string;
    total_currency: string;
    conditions?: {
      refund_before_departure?: ConditionDetail | null;
      change_before_departure?: ConditionDetail | null;
    };
  };

  // Single synchronous call — return_offers:true avoids the separate /air/offers fetch
  const offerReqRes = await duffelFetch<{ data: { id: string; offers?: OfferShape[] } }>(
    "/air/offer_requests",
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          slices: [{ origin, destination, departure_date: departureDate }],
          passengers: passengers.map((p) => ({ type: p.type })),
          cabin_class: "economy",
          return_offers: true,
        },
      }),
    }
  );

  const allOffersList = offerReqRes.data.offers ?? [];
  // Only surface nonstop itineraries (single segment in the first slice)
  const nonstopOffers = allOffersList.filter(
    (o) => (o.slices?.[0]?.segments?.length ?? 1) === 1
  );

  // Filter to offers for the exact flight number from AeroDataBox.
  // AeroDataBox may return "EK301" (no space) while Duffel provides carrier + number
  // as separate fields. Strip all whitespace before comparing so both formats match.
  // Also check the operating carrier as a fallback for wetlease/charter flights.
  const normalize = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
  const targetFlight = normalize(flightNumber);
  const fnFilteredOffers = nonstopOffers.filter((o) => {
    const seg = o.slices?.[0]?.segments?.[0];
    if (!seg) return false;
    const marketing = normalize(
      `${seg.marketing_carrier.iata_code}${seg.marketing_carrier_flight_number}`
    );
    const operating = seg.operating_carrier && seg.operating_carrier_flight_number
      ? normalize(`${seg.operating_carrier.iata_code}${seg.operating_carrier_flight_number}`)
      : null;
    return marketing === targetFlight || operating === targetFlight;
  });

  const offersList = fnFilteredOffers;

  return offersList.map((offer) => {
    const firstSlice = offer.slices[0];
    const firstSeg = firstSlice?.segments[0];
    const lastSeg = firstSlice?.segments[firstSlice.segments.length - 1];

    // Cancellation / change conditions — present on inline offers; may have null penalty
    // amounts on some carriers even when `allowed` is known.
    const cond = offer.conditions;
    const conditions: DuffelOfferConditions = {
      refund_before_departure: cond?.refund_before_departure
        ? {
            allowed: cond.refund_before_departure.allowed,
            penalty_amount: cond.refund_before_departure.penalty_amount ?? null,
            penalty_currency: cond.refund_before_departure.penalty_currency ?? null,
          }
        : null,
      change_before_departure: cond?.change_before_departure
        ? {
            allowed: cond.change_before_departure.allowed,
            penalty_amount: cond.change_before_departure.penalty_amount ?? null,
            penalty_currency: cond.change_before_departure.penalty_currency ?? null,
          }
        : null,
    };

    // Baggage — Duffel path: slices[].segments[].passengers[].baggages[]
    // For a nonstop single-adult search we aggregate across all segments so the
    // displayed allowance reflects the full journey (not just the first leg).
    // Quantities are summed per type; weight is taken from the first occurrence.
    const bagMap = new Map<"carry_on" | "checked", { quantity: number; max_weight_kg: number | null }>();
    for (const slice of offer.slices) {
      for (const seg of slice.segments) {
        for (const pax of seg.passengers ?? []) {
          for (const b of pax.baggages ?? []) {
            const existing = bagMap.get(b.type);
            if (existing) {
              existing.quantity += b.quantity;
              if (existing.max_weight_kg === null && b.max_weight_kg != null) {
                existing.max_weight_kg = b.max_weight_kg;
              }
            } else {
              bagMap.set(b.type, {
                quantity: b.quantity,
                max_weight_kg: b.max_weight_kg ?? null,
              });
            }
          }
        }
      }
    }
    const baggages: DuffelOfferBaggage[] = Array.from(bagMap.entries()).map(([type, v]) => ({
      type,
      quantity: v.quantity,
      max_weight_kg: v.max_weight_kg,
    }));

    return {
      id: offer.id,
      airline: offer.owner.iata_code,
      airline_name: offer.owner.name,
      departure_time: firstSeg?.departing_at ?? "",
      arrival_time: lastSeg?.arriving_at ?? "",
      duration: firstSlice?.duration ?? "",
      cabin_class: "economy",
      amount: offer.total_amount,
      currency: offer.total_currency,
      stops: Math.max(0, (firstSlice?.segments.length ?? 1) - 1),
      conditions,
      baggages,
    };
  });
}

export async function createOrder(
  offerId: string,
  passengers: DuffelPassenger[]
): Promise<DuffelOrder> {
  const data = await duffelFetch<{
    data: { id: string; booking_reference: string; status: string; documents?: Array<{ document_number?: string }> };
  }>("/air/orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [offerId],
        passengers: passengers.map((p, i) => ({
          id: `pas_${i}`,
          type: p.type,
          given_name: p.given_name,
          family_name: p.family_name,
          born_on: p.born_on,
          gender: p.gender ?? "m",
          title: p.title ?? "mr",
          ...(p.phone_number ? { phone_number: p.phone_number } : {}),
          ...(p.passport_number
            ? {
                identity_documents: [
                  {
                    type: "passport",
                    unique_identifier: p.passport_number,
                    issuing_country_code: p.nationality ?? "GB",
                    expires_on: p.passport_expiry ?? "2030-01-01",
                  },
                ],
              }
            : {}),
        })),
        payments: [
          {
            type: "balance",
            amount: "0",
            currency: "GBP",
          },
        ],
      },
    }),
  });

  return {
    id: data.data.id,
    booking_reference: data.data.booking_reference,
    ticket_number: data.data.documents?.[0]?.document_number ?? null,
    status: data.data.status,
  };
}

/**
 * Dry-run passenger validation against Duffel sandbox.
 * Only executes if DUFFEL_API_KEY starts with "duffel_test_".
 * In production, Zod is the gate — live order creation must not happen here.
 */
export async function validatePassengers(
  offerId: string,
  passengers: DuffelPassenger[]
): Promise<{ valid: boolean; errors: string[] }> {
  const key = process.env.DUFFEL_API_KEY ?? "";
  if (!key.startsWith("duffel_test_")) {
    return { valid: true, errors: [] };
  }

  try {
    await duffelFetch("/air/orders", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "instant",
          selected_offers: [offerId],
          passengers: passengers.map((p, i) => ({
            id: `pas_${i}`,
            type: p.type,
            given_name: p.given_name,
            family_name: p.family_name,
            born_on: p.born_on,
            gender: p.gender ?? "m",
            title: p.title ?? "mr",
            ...(p.phone_number ? { phone_number: p.phone_number } : {}),
            ...(p.passport_number
              ? {
                  identity_documents: [
                    {
                      type: "passport",
                      unique_identifier: p.passport_number,
                      issuing_country_code: p.nationality ?? "GB",
                      expires_on: p.passport_expiry ?? "2030-01-01",
                    },
                  ],
                }
              : {}),
          })),
          payments: [{ type: "balance", amount: "0", currency: "GBP" }],
        },
      }),
    });
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 422) {
      let msgs: string[] = [];
      try {
        const parsed = JSON.parse(err.apiMessage) as {
          errors?: Array<{ message?: string }>;
        };
        msgs = (parsed.errors ?? [])
          .map((e) => e.message ?? "")
          .filter(Boolean);
      } catch {
        msgs = [err.apiMessage];
      }
      return { valid: false, errors: msgs };
    }
    // Non-422 errors (network, auth, etc.) — fail open so the booking can proceed
    console.error("[validatePassengers] Non-422 error:", err);
    return { valid: true, errors: [] };
  }
}

export interface DuffelOrderCancellation {
  id: string;
  order_id: string;
  refund_amount: string;    // decimal string e.g. "245.50" or "0.00"
  refund_currency: string;
  refund_to: string;        // "balance" | "original_form_of_payment" | "card" | "voucher"
  expires_at: string;
  live_mode: boolean;
}

/**
 * User-initiated cancellation: two-step quote-then-confirm flow.
 * Step 1: POST /air/order_cancellations — creates a cancellation quote.
 * Step 2: POST /air/order_cancellations/{id}/actions/confirm — confirms the cancellation.
 * Returns the confirmed DuffelOrderCancellation. Never swallows errors.
 * Do NOT use this for airline-initiated cancellations — use cancelOrder for those.
 */
export async function requestUserCancellation(
  duffelOrderId: string
): Promise<DuffelOrderCancellation> {
  // Step 1: create cancellation quote
  const quoteRes = await duffelFetch<{ data: DuffelOrderCancellation }>(
    "/air/order_cancellations",
    {
      method: "POST",
      body: JSON.stringify({ data: { order_id: duffelOrderId } }),
    }
  );

  const cancellationId = quoteRes.data.id;

  // Step 2: confirm the cancellation (point of no return)
  let confirmRes: { data: DuffelOrderCancellation };
  try {
    confirmRes = await duffelFetch<{ data: DuffelOrderCancellation }>(
      `/air/order_cancellations/${cancellationId}/actions/confirm`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  } catch (err) {
    throw new Step2CancellationError(cancellationId, err);
  }

  return confirmRes.data;
}

/**
 * Cancels a Duffel order. Ignores 404 (already cancelled), re-throws on other errors.
 */
export async function cancelOrder(duffelOrderId: string): Promise<void> {
  try {
    await duffelFetch(`/air/orders/${duffelOrderId}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 404) {
      console.warn(`[cancelOrder] Order ${duffelOrderId} not found — already cancelled.`);
      return;
    }
    throw err;
  }
}

/** Clears the bookability cache — useful for tests. */
export function clearBookabilityCache(): void {
  bookabilityCache.clear();
}
