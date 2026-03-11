import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkFlightBookable,
  searchOffers,
  createOrder,
  createDuffelLink,
  fetchDuffelOrder,
  requestUserCancellation,
  validatePassengers,
  cancelOrder,
  ApiError,
  Step2CancellationError,
  clearBookabilityCache,
} from "@/lib/duffel";

// ── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.stubEnv("DUFFEL_API_KEY", "test_token_123");
  clearBookabilityCache();
  mockFetch.mockReset();
  // Default: silently resolve all non-Duffel calls (background logging to 127.0.0.1)
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "{}",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

/**
 * Sets up mockFetch to route only calls to api.duffel.com through the provided
 * response queue. All other calls (logging to 127.0.0.1 etc.) resolve silently.
 * This insulates tests from the background logging fetch calls in lib/duffel.ts.
 */
function setupDuffelMock(responses: Array<ReturnType<typeof jsonResponse>>) {
  let idx = 0;
  mockFetch.mockImplementation((url: unknown) => {
    const urlStr = typeof url === "string" ? url : "";
    if (!urlStr.includes("duffel.com")) {
      // Logging / non-Duffel call — resolve silently
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "{}",
      });
    }
    return responses[idx++] ?? Promise.reject(new Error(`Unexpected Duffel fetch call #${idx}`));
  });
}

// ── checkFlightBookable ──────────────────────────────────────────────────────

const FUTURE_DATE = "2030-06-15"; // always in the future; avoids the past-date early-return guard

// Helper: build a minimal nonstop offer matching flight number "EK101"
function ekOffer(iata = "EK", num = "101") {
  return {
    id: "off_1",
    total_amount: "450.00",
    total_currency: "GBP",
    slices: [
      {
        segments: [
          {
            marketing_carrier: { iata_code: iata, name: "Emirates" },
            marketing_carrier_flight_number: num,
          },
        ],
      },
    ],
  };
}

describe("checkFlightBookable", () => {
  it("returns bookable=true when offers exist", async () => {
    setupDuffelMock([
      jsonResponse({ data: { id: "req_1", offers: [ekOffer()] } }),
    ]);
    const result = await checkFlightBookable("EK101", FUTURE_DATE, "DXB", "LHR");
    expect(result.bookable).toBe(true);
  });

  it("returns bookable=false when offers array is empty", async () => {
    setupDuffelMock([
      jsonResponse({ data: { id: "req_1", offers: [] } }),
    ]);
    const result = await checkFlightBookable("EK102", FUTURE_DATE, "DXB", "JFK");
    expect(result.bookable).toBe(false);
  });

  it("returns a result without throwing on non-2xx (fail-open behavior for non-429 errors)", async () => {
    // The implementation fails open for non-429/422 errors (transient outage avoidance),
    // so bookable may be true or false depending on the error. The key requirement is
    // that the function never throws on a non-2xx response — it always returns a result.
    setupDuffelMock([
      jsonResponse({ errors: [{ message: "Bad request" }] }, 400),
    ]);
    const result = await checkFlightBookable("EK103", FUTURE_DATE, "DXB", "SIN");
    expect(result).toHaveProperty("bookable");
    expect(result).toHaveProperty("lowestPriceCents");
    expect(result).toHaveProperty("currency");
  });

  it("uses cache for repeated calls within TTL — makes exactly 1 Duffel fetch call", async () => {
    setupDuffelMock([
      jsonResponse({ data: { id: "req_1", offers: [ekOffer("EK", "104")] } }),
    ]);

    await checkFlightBookable("EK104", FUTURE_DATE, "DXB", "CDG");
    await checkFlightBookable("EK104", FUTURE_DATE, "DXB", "CDG");

    // Only 1 real Duffel call; the second hits the in-memory cache.
    const duffelCalls = mockFetch.mock.calls.filter(
      (args) => typeof args[0] === "string" && (args[0] as string).includes("duffel.com")
    );
    expect(duffelCalls).toHaveLength(1);
  });
});

// ── searchOffers ─────────────────────────────────────────────────────────────

describe("searchOffers", () => {
  it("makes a single HTTP call (return_offers:true) and maps response correctly", async () => {
    // Since return_offers:true is used, offers are inlined in the offer_requests response.
    setupDuffelMock([
      jsonResponse({
        data: {
          id: "req_1",
          offers: [
            {
              id: "off_1",
              owner: { name: "Emirates", iata_code: "EK" },
              slices: [
                {
                  duration: "PT7H",
                  segments: [
                    {
                      departing_at: `${FUTURE_DATE}T10:00:00Z`,
                      arriving_at: `${FUTURE_DATE}T17:00:00Z`,
                      marketing_carrier: { iata_code: "EK", name: "Emirates" },
                      marketing_carrier_flight_number: "101",
                    },
                  ],
                },
              ],
              total_amount: "450.00",
              total_currency: "GBP",
              conditions: {},
            },
          ],
        },
      }),
    ]);

    const offers = await searchOffers("EK101", FUTURE_DATE, "DXB", "LHR", [
      { type: "adult" },
    ]);

    // Exactly one Duffel API call (the internal log fires are to a different host)
    const duffelCalls = mockFetch.mock.calls.filter(
      (args) => typeof args[0] === "string" && (args[0] as string).includes("duffel.com")
    );
    expect(duffelCalls).toHaveLength(1);
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe("off_1");
    expect(offers[0].airline).toBe("EK");
    expect(offers[0].amount).toBe("450.00");
    expect(offers[0].currency).toBe("GBP");
  });
});

// ── 5A: createDuffelLink ──────────────────────────────────────────────────────

describe("createDuffelLink (5A)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("200 happy path — returns id, url, expiresAt", async () => {
    const expiresAt = "2026-03-08T12:30:00Z";
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          id: "lnk_abc",
          url: "https://links.duffel.com/checkout/lnk_abc",
          expires_at: expiresAt,
          reference: "ref-uuid-123",
        },
      })
    );

    const result = await createDuffelLink({
      offerId: "off_123",
      reference: "ref-uuid-123",
      successUrl: "https://example.com/confirm?ref=ref-uuid-123",
      abandonUrl: "https://example.com/flights",
    });

    expect(result.id).toBe("lnk_abc");
    expect(result.url).toBe("https://links.duffel.com/checkout/lnk_abc");
    expect(result.expiresAt).toBe(expiresAt);
  });

  it("request body contains offer_id, reference, success_url, abandon_url, and expires_at between 25–35 min from now", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          id: "lnk_1",
          url: "https://links.duffel.com/checkout/lnk_1",
          expires_at: "2026-03-08T12:30:00Z",
          reference: "ref-1",
        },
      })
    );

    await createDuffelLink({
      offerId: "off_999",
      reference: "ref-1",
      successUrl: "https://example.com/confirm?ref=ref-1&order_id={order_id}",
      abandonUrl: "https://example.com/flights",
    });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/links");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body.data.offer_id).toBe("off_999");
    expect(body.data.reference).toBe("ref-1");
    expect(body.data.success_url).toBe("https://example.com/confirm?ref=ref-1&order_id={order_id}");
    expect(body.data.abandon_url).toBe("https://example.com/flights");

    // expires_at should be 25–35 minutes from now (2026-03-08T12:00:00Z)
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const expiresAtMs = new Date(body.data.expires_at).getTime();
    const diffMinutes = (expiresAtMs - now) / 60000;
    expect(diffMinutes).toBeGreaterThanOrEqual(25);
    expect(diffMinutes).toBeLessThanOrEqual(35);
  });

  it("422 from Duffel — throws ApiError with Duffel message", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ errors: [{ message: "Invalid offer_id" }] }, 422)
    );

    await expect(
      createDuffelLink({ offerId: "bad_off", reference: "ref-1", successUrl: "http://x", abandonUrl: "http://y" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("500 from Duffel — throws ApiError", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ errors: [{ message: "Internal Server Error" }] }, 500)
    );

    await expect(
      createDuffelLink({ offerId: "off_1", reference: "ref-1", successUrl: "http://x", abandonUrl: "http://y" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("network timeout (fetch rejects) — throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    await expect(
      createDuffelLink({ offerId: "off_1", reference: "ref-1", successUrl: "http://x", abandonUrl: "http://y" })
    ).rejects.toThrow("Network timeout");
  });

  it("200 but response.data.url is absent — throws ApiError with 'Malformed Duffel Links response'", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          id: "lnk_empty",
          url: "",
          expires_at: "2026-03-08T12:30:00Z",
          reference: "ref-1",
        },
      })
    );

    await expect(
      createDuffelLink({ offerId: "off_1", reference: "ref-1", successUrl: "http://x", abandonUrl: "http://y" })
    ).rejects.toThrow("Malformed Duffel Links response");
  });
});

// ── 5B: fetchDuffelOrder ─────────────────────────────────────────────────────

const MOCK_ORDER_FULL = {
  id: "ord_abc123",
  booking_reference: "ABC123",
  documents: [{ passenger_id: "pas_0", document_number: "TKT123456" }],
  total_amount: "542.00",
  total_currency: "GBP",
  conditions: {
    refund_before_departure: {
      allowed: true,
      penalty_amount: "50.00",
      penalty_currency: "GBP",
    },
    change_before_departure: {
      allowed: false,
      penalty_amount: null,
    },
  },
};

describe("fetchDuffelOrder (5B)", () => {
  it("200 happy path — returns DuffelOrderFull with all typed fields", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ data: MOCK_ORDER_FULL }));

    const order = await fetchDuffelOrder("ord_abc123");

    expect(order.id).toBe("ord_abc123");
    expect(order.booking_reference).toBe("ABC123");
    expect(order.total_amount).toBe("542.00");
    expect(order.total_currency).toBe("GBP");
    expect(order.documents[0].document_number).toBe("TKT123456");
    expect(order.conditions.refund_before_departure?.allowed).toBe(true);
  });

  it("documents array with one entry — documents[0].document_number is accessible", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ data: MOCK_ORDER_FULL }));
    const order = await fetchDuffelOrder("ord_abc123");
    expect(order.documents[0].document_number).toBe("TKT123456");
  });

  it("documents array empty — documents is [] and function does not throw", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ data: { ...MOCK_ORDER_FULL, documents: [] } })
    );
    const order = await fetchDuffelOrder("ord_abc123");
    expect(order.documents).toHaveLength(0);
  });

  it("conditions.refund_before_departure is null — function succeeds, field is null", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          ...MOCK_ORDER_FULL,
          conditions: { refund_before_departure: null, change_before_departure: null },
        },
      })
    );
    const order = await fetchDuffelOrder("ord_abc123");
    expect(order.conditions.refund_before_departure).toBeNull();
  });

  it("404 — throws ApiError with httpStatus 404", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ errors: [{ message: "Order not found" }] }, 404)
    );
    const err = await fetchDuffelOrder("ord_unknown").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).httpStatus).toBe(404);
  });

  it("500 — throws ApiError", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ errors: [{ message: "Server error" }] }, 500)
    );
    await expect(fetchDuffelOrder("ord_abc123")).rejects.toBeInstanceOf(ApiError);
  });

  it("network timeout — throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(fetchDuffelOrder("ord_abc123")).rejects.toThrow("fetch failed");
  });
});

// ── 5C: requestUserCancellation regression ───────────────────────────────────

const MOCK_CANCELLATION = {
  id: "canc_abc",
  order_id: "ord_abc",
  refund_amount: "245.50",
  refund_currency: "GBP",
  refund_to: "original_form_of_payment",
  expires_at: "2026-03-08T13:00:00Z",
  live_mode: false,
};

describe("requestUserCancellation (5C)", () => {
  it("both steps succeed — returns cancellation with refund fields", async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse({ data: MOCK_CANCELLATION })) // step 1
      .mockReturnValueOnce(jsonResponse({ data: MOCK_CANCELLATION })); // step 2

    const result = await requestUserCancellation("ord_abc");

    expect(result.id).toBe("canc_abc");
    expect(result.refund_amount).toBe("245.50");
    expect(result.refund_currency).toBe("GBP");
    expect(result.refund_to).toBe("original_form_of_payment");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("step 1 returns refund_to='voucher' — mapped correctly", async () => {
    const voucherCanc = { ...MOCK_CANCELLATION, refund_to: "voucher" };
    mockFetch
      .mockReturnValueOnce(jsonResponse({ data: voucherCanc }))
      .mockReturnValueOnce(jsonResponse({ data: voucherCanc }));

    const result = await requestUserCancellation("ord_abc");
    expect(result.refund_to).toBe("voucher");
  });

  it("step 1 returns refund_to='balance' — mapped correctly", async () => {
    const balanceCanc = { ...MOCK_CANCELLATION, refund_to: "balance" };
    mockFetch
      .mockReturnValueOnce(jsonResponse({ data: balanceCanc }))
      .mockReturnValueOnce(jsonResponse({ data: balanceCanc }));

    const result = await requestUserCancellation("ord_abc");
    expect(result.refund_to).toBe("balance");
  });

  it("step 1 returns refund_amount='0.00' — mapped correctly", async () => {
    const zeroCanc = { ...MOCK_CANCELLATION, refund_amount: "0.00" };
    mockFetch
      .mockReturnValueOnce(jsonResponse({ data: zeroCanc }))
      .mockReturnValueOnce(jsonResponse({ data: zeroCanc }));

    const result = await requestUserCancellation("ord_abc");
    expect(result.refund_amount).toBe("0.00");
  });

  it("step 1 throws — function throws immediately, step 2 is never called", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ errors: [{ message: "forbidden" }] }, 403));

    await expect(requestUserCancellation("ord_abc")).rejects.toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("step 2 throws — throws Step2CancellationError containing step-1 cancellationId", async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse({ data: MOCK_CANCELLATION })) // step 1 succeeds
      .mockReturnValueOnce(jsonResponse({ errors: [{ message: "Conflict" }] }, 409)); // step 2 fails

    const err = await requestUserCancellation("ord_abc").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Step2CancellationError);
    expect((err as Step2CancellationError).cancellationId).toBe("canc_abc");
  });

  it("network timeout on step 1 — throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(requestUserCancellation("ord_abc")).rejects.toThrow("ECONNRESET");
  });
});

// ── createOrder ──────────────────────────────────────────────────────────────

describe("createOrder", () => {
  it("returns typed DuffelOrder", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { id: "ord_1", booking_reference: "ABC123", status: "confirmed" },
      })
    );

    const order = await createOrder("off_1", [
      {
        type: "adult",
        given_name: "Jane",
        family_name: "Smith",
        born_on: "1990-01-15",
      },
    ]);

    expect(order.id).toBe("ord_1");
    expect(order.booking_reference).toBe("ABC123");
    expect(order.status).toBe("confirmed");
  });

  it("throws ApiError on non-2xx", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ errors: [{ message: "Invalid offer" }] }, 422)
    );

    await expect(
      createOrder("off_invalid", [{ type: "adult" }])
    ).rejects.toThrow(ApiError);
  });
});

// ── searchOffers baggage handling ────────────────────────────────────────────

const FUTURE_DATE_BAG = "2030-09-15";

describe("searchOffers — baggage handling", () => {
  it("maps carry_on and checked baggages from passengers", async () => {
    setupDuffelMock([
      jsonResponse({
        data: {
          id: "req_bag",
          offers: [
            {
              id: "off_bag",
              owner: { name: "Emirates", iata_code: "EK" },
              total_amount: "500.00",
              total_currency: "GBP",
              conditions: {},
              slices: [
                {
                  duration: "PT8H",
                  segments: [
                    {
                      departing_at: `${FUTURE_DATE_BAG}T10:00:00Z`,
                      arriving_at: `${FUTURE_DATE_BAG}T18:00:00Z`,
                      marketing_carrier: { iata_code: "EK", name: "Emirates" },
                      marketing_carrier_flight_number: "201",
                      passengers: [
                        {
                          baggages: [
                            { type: "carry_on", quantity: 1, max_weight_kg: null },
                            { type: "checked", quantity: 1, max_weight_kg: 23 },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ]);

    const offers = await searchOffers("EK201", FUTURE_DATE_BAG, "DXB", "LHR", [{ type: "adult" }]);
    expect(offers).toHaveLength(1);
    const carry = offers[0].baggages.find((b) => b.type === "carry_on");
    const checked = offers[0].baggages.find((b) => b.type === "checked");
    expect(carry).toBeDefined();
    expect(carry!.quantity).toBe(1);
    expect(checked).toBeDefined();
    expect(checked!.max_weight_kg).toBe(23);
  });

  it("accumulates baggage quantities across multiple passengers", async () => {
    setupDuffelMock([
      jsonResponse({
        data: {
          id: "req_multi",
          offers: [
            {
              id: "off_multi",
              owner: { name: "Emirates", iata_code: "EK" },
              total_amount: "900.00",
              total_currency: "GBP",
              conditions: {},
              slices: [
                {
                  duration: "PT8H",
                  segments: [
                    {
                      departing_at: `${FUTURE_DATE_BAG}T10:00:00Z`,
                      arriving_at: `${FUTURE_DATE_BAG}T18:00:00Z`,
                      marketing_carrier: { iata_code: "EK", name: "Emirates" },
                      marketing_carrier_flight_number: "202",
                      passengers: [
                        { baggages: [{ type: "checked", quantity: 1, max_weight_kg: 23 }] },
                        { baggages: [{ type: "checked", quantity: 1, max_weight_kg: null }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ]);

    const offers = await searchOffers("EK202", FUTURE_DATE_BAG, "DXB", "LHR", [{ type: "adult" }]);
    const checked = offers[0].baggages.find((b) => b.type === "checked");
    expect(checked!.quantity).toBe(2);
    expect(checked!.max_weight_kg).toBe(23);
  });
});

// ── validatePassengers ───────────────────────────────────────────────────────

describe("validatePassengers", () => {
  it("returns valid=true when not a test key (no API call)", async () => {
    vi.stubEnv("DUFFEL_API_KEY", "duffel_live_prod_key");
    const result = await validatePassengers("off_1", [{ type: "adult", given_name: "John", family_name: "Doe", born_on: "1990-01-01" }]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    vi.unstubAllEnvs();
    vi.stubEnv("DUFFEL_API_KEY", "test_token_123");
  });

  it("returns valid=true when test key and API succeeds", async () => {
    vi.stubEnv("DUFFEL_API_KEY", "duffel_test_abc");
    setupDuffelMock([jsonResponse({ data: { id: "ord_ok" } })]);
    const result = await validatePassengers("off_1", [{ type: "adult", given_name: "Jane", family_name: "Smith", born_on: "1995-06-15" }]);
    expect(result.valid).toBe(true);
    vi.unstubAllEnvs();
    vi.stubEnv("DUFFEL_API_KEY", "test_token_123");
  });

  it("returns valid=false with error messages on 422", async () => {
    vi.stubEnv("DUFFEL_API_KEY", "duffel_test_abc");
    setupDuffelMock([
      jsonResponse({ errors: [{ message: "Invalid passport number" }] }, 422),
    ]);
    const result = await validatePassengers("off_1", [{ type: "adult", given_name: "Jane", family_name: "Smith", born_on: "1995-06-15", passport_number: "BAD" }]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid passport number");
    vi.unstubAllEnvs();
    vi.stubEnv("DUFFEL_API_KEY", "test_token_123");
  });

  it("returns valid=true (fail-open) on non-422 errors", async () => {
    vi.stubEnv("DUFFEL_API_KEY", "duffel_test_abc");
    setupDuffelMock([jsonResponse({}, 500)]);
    const result = await validatePassengers("off_1", [{ type: "adult", given_name: "Jane", family_name: "Smith", born_on: "1995-06-15" }]);
    expect(result.valid).toBe(true);
    vi.unstubAllEnvs();
    vi.stubEnv("DUFFEL_API_KEY", "test_token_123");
  });
});

// ── cancelOrder ──────────────────────────────────────────────────────────────

describe("cancelOrder", () => {
  it("sends DELETE request and resolves without error", async () => {
    setupDuffelMock([
      jsonResponse({}, 200),
    ]);
    await expect(cancelOrder("ord_abc123")).resolves.toBeUndefined();
  });

  it("does not throw on 404 (already cancelled — idempotent)", async () => {
    setupDuffelMock([
      jsonResponse({ errors: [{ message: "Not found" }] }, 404),
    ]);
    await expect(cancelOrder("ord_gone")).resolves.toBeUndefined();
  });

  it("throws ApiError on non-404 error", async () => {
    setupDuffelMock([
      jsonResponse({ errors: [{ message: "Server error" }] }, 500),
    ]);
    await expect(cancelOrder("ord_err")).rejects.toThrow(ApiError);
  });
});

// ── checkFlightBookable — additional branch coverage ─────────────────────────

describe("checkFlightBookable — additional branches", () => {
  it("returns not-bookable immediately when destination is 'Unknown'", async () => {
    const result = await checkFlightBookable("EK999", FUTURE_DATE, "DXB", "Unknown");
    expect(result.bookable).toBe(false);
    expect(result.lowestPriceCents).toBeNull();
  });

  it("returns not-bookable for past departure date", async () => {
    const result = await checkFlightBookable("EK999", "2020-01-01", "DXB", "LHR");
    expect(result.bookable).toBe(false);
  });

  it("returns not-bookable for same-day departure", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await checkFlightBookable("EK999", today, "DXB", "LHR");
    expect(result.bookable).toBe(false);
  });

  it("returns not-bookable on 429 rate limit (fail closed)", async () => {
    setupDuffelMock([jsonResponse({ errors: [{ message: "Rate limited" }] }, 429)]);
    const result = await checkFlightBookable("EK999", FUTURE_DATE, "DXB", "LHR");
    expect(result.bookable).toBe(false);
  });

  it("returns not-bookable on 422 with past-date message (fail closed)", async () => {
    setupDuffelMock([jsonResponse({ errors: [{ message: "departure_date is in the past" }] }, 422)]);
    const result = await checkFlightBookable("EK999", FUTURE_DATE, "DXB", "LHR");
    expect(result.bookable).toBe(false);
  });

  it("returns bookable=false when offer list is not an array", async () => {
    setupDuffelMock([jsonResponse({ data: { offers: null } }, 200)]);
    const result = await checkFlightBookable("EK999", FUTURE_DATE, "DXB", "LHR");
    expect(result.bookable).toBe(false);
  });

  it("returns bookable=true when operating carrier matches flight number", async () => {
    const offer = {
      slices: [{
        segments: [{
          marketing_carrier: { iata_code: "XX" },
          marketing_carrier_flight_number: "999",
          operating_carrier: { iata_code: "EK" },
          operating_carrier_flight_number: "101",
        }],
      }],
      total_amount: "150.00",
      total_currency: "USD",
    };
    setupDuffelMock([jsonResponse({ data: { offers: [offer] } }, 200)]);
    const result = await checkFlightBookable("EK101", FUTURE_DATE, "DXB", "LHR");
    expect(result.bookable).toBe(true);
  });

  it("returns bookable=false when offer has multiple segments (not nonstop)", async () => {
    const offer = {
      slices: [{
        segments: [
          {
            marketing_carrier: { iata_code: "EK" },
            marketing_carrier_flight_number: "101",
            operating_carrier: null,
            operating_carrier_flight_number: null,
          },
          {
            marketing_carrier: { iata_code: "EK" },
            marketing_carrier_flight_number: "102",
            operating_carrier: null,
            operating_carrier_flight_number: null,
          },
        ],
      }],
      total_amount: "150.00",
      total_currency: "USD",
    };
    setupDuffelMock([jsonResponse({ data: { offers: [offer] } }, 200)]);
    const result = await checkFlightBookable("EK101", FUTURE_DATE, "DXB", "LHR");
    expect(result.bookable).toBe(false);
  });
});

// ── searchOffers — additional branch coverage ─────────────────────────────────

describe("searchOffers — additional branches", () => {
  const makePassenger = () => ({
    id: "pas_0",
    type: "adult" as const,
    given_name: "Test",
    family_name: "User",
    born_on: "1990-01-01",
    gender: "m" as const,
    title: "mr" as const,
  });

  const makeOffer = (overrides: Record<string, unknown> = {}) => ({
    id: "off_1",
    owner: { iata_code: "EK", name: "Emirates" },
    slices: [{
      duration: "PT5H",
      segments: [{
        marketing_carrier: { iata_code: "EK" },
        marketing_carrier_flight_number: "101",
        operating_carrier: null,
        operating_carrier_flight_number: null,
        departing_at: "2026-06-01T10:00:00Z",
        arriving_at: "2026-06-01T15:00:00Z",
        passengers: [],
      }],
    }],
    total_amount: "200.00",
    total_currency: "USD",
    conditions: null,
    ...overrides,
  });

  it("returns empty array when no nonstop offers available", async () => {
    const multiSegOffer = {
      ...makeOffer(),
      slices: [{
        duration: "PT10H",
        segments: [
          {
            marketing_carrier: { iata_code: "EK" },
            marketing_carrier_flight_number: "101",
            operating_carrier: null,
            operating_carrier_flight_number: null,
            departing_at: "2026-06-01T10:00:00Z",
            arriving_at: "2026-06-01T14:00:00Z",
            passengers: [],
          },
          {
            marketing_carrier: { iata_code: "EK" },
            marketing_carrier_flight_number: "200",
            operating_carrier: null,
            operating_carrier_flight_number: null,
            departing_at: "2026-06-01T16:00:00Z",
            arriving_at: "2026-06-01T20:00:00Z",
            passengers: [],
          },
        ],
      }],
    };
    setupDuffelMock([jsonResponse({ data: { offers: [multiSegOffer] } }, 200)]);
    const result = await searchOffers("EK101", FUTURE_DATE, "DXB", "LHR", [makePassenger()]);
    expect(result).toEqual([]);
  });

  it("handles offer with operating carrier match", async () => {
    const opCarrierOffer = {
      ...makeOffer({
        slices: [{
          duration: "PT5H",
          segments: [{
            marketing_carrier: { iata_code: "XX" },
            marketing_carrier_flight_number: "999",
            operating_carrier: { iata_code: "EK" },
            operating_carrier_flight_number: "101",
            departing_at: "2026-06-01T10:00:00Z",
            arriving_at: "2026-06-01T15:00:00Z",
            passengers: [],
          }],
        }],
      }),
    };
    setupDuffelMock([jsonResponse({ data: { offers: [opCarrierOffer] } }, 200)]);
    const result = await searchOffers("EK101", FUTURE_DATE, "DXB", "LHR", [makePassenger()]);
    expect(result.length).toBe(1);
  });

  it("handles offer with conditions and baggage data", async () => {
    const offerWithConditionsAndBaggage = {
      ...makeOffer({
        slices: [{
          duration: "PT5H",
          segments: [{
            marketing_carrier: { iata_code: "EK" },
            marketing_carrier_flight_number: "101",
            operating_carrier: null,
            operating_carrier_flight_number: null,
            departing_at: "2026-06-01T10:00:00Z",
            arriving_at: "2026-06-01T15:00:00Z",
            passengers: [{
              baggages: [
                { type: "checked", quantity: 1, max_weight_kg: 23 },
                { type: "carry_on", quantity: 1, max_weight_kg: null },
              ],
            }],
          }],
        }],
        conditions: {
          refund_before_departure: { allowed: true, penalty_amount: "50.00", penalty_currency: "USD" },
          change_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
        },
      }),
    };
    setupDuffelMock([jsonResponse({ data: { offers: [offerWithConditionsAndBaggage] } }, 200)]);
    const result = await searchOffers("EK101", FUTURE_DATE, "DXB", "LHR", [makePassenger()]);
    expect(result.length).toBe(1);
    expect(result[0].conditions.refund_before_departure?.allowed).toBe(true);
    expect(result[0].baggages.some(b => b.type === "checked")).toBe(true);
  });
});
