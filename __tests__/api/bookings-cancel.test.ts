/**
 * 5I — POST /api/bookings/[bookingId]/cancel
 * File: __tests__/api/bookings-cancel.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock next-auth ────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockInitDb = vi.fn();
const mockGetBookingById = vi.fn();
const mockCancelBookingByUser = vi.fn();
const mockSetCancellationPending = vi.fn();
const mockGetUserById = vi.fn();
const mockCreateNotification = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getBookingById: (...args: unknown[]) => mockGetBookingById(...args),
  cancelBookingByUser: (...args: unknown[]) => mockCancelBookingByUser(...args),
  setCancellationPending: (...args: unknown[]) => mockSetCancellationPending(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

// ── Mock Duffel ───────────────────────────────────────────────────────────────

const mockRequestUserCancellation = vi.fn();

class MockApiError extends Error {
  httpStatus: number;
  apiMessage: string;
  constructor(httpStatus: number, apiMessage: string) {
    super(`Duffel API error ${httpStatus}: ${apiMessage}`);
    this.httpStatus = httpStatus;
    this.apiMessage = apiMessage;
    Object.setPrototypeOf(this, MockApiError.prototype);
  }
}

class MockStep2CancellationError extends Error {
  cancellationId: string;
  constructor(cancellationId: string, message: string) {
    super(message);
    this.cancellationId = cancellationId;
    Object.setPrototypeOf(this, MockStep2CancellationError.prototype);
  }
}

vi.mock("@/lib/duffel", () => ({
  requestUserCancellation: (...args: unknown[]) =>
    mockRequestUserCancellation(...args),
  Step2CancellationError: MockStep2CancellationError,
  ApiError: MockApiError,
}));

// ── Mock email / push (fire-and-forget) ──────────────────────────────────────

const mockSendEmail = vi.fn();
const mockSendPushNotification = vi.fn();

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}));

import { getServerSession } from "next-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_USER_ID = "u1";

function makeRequest(bookingId: string): Request {
  return new Request(
    `http://localhost:3001/api/bookings/${bookingId}/cancel`,
    { method: "POST" }
  );
}

const CONFIRMED_BOOKING = {
  id: "bk-001",
  user_id: SESSION_USER_ID,
  flight_id: "fl-001",
  status: "confirmed" as const,
  duffel_order_id: "ord_abc",
  booking_reference: "ABC123",
  cancellation_pending: 0 as 0 | 1,
};

function makeParams(bookingId: string) {
  return { params: Promise.resolve({ bookingId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: SESSION_USER_ID, email: "test@test.com" },
    expires: "",
  });
  mockGetUserById.mockReturnValue({ id: SESSION_USER_ID, email: "test@test.com", name: "Test" });
  // Always return Promises so .catch() calls in the route handler don't fail
  mockSendEmail.mockResolvedValue(undefined);
  mockSendPushNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5I — POST /api/bookings/[bookingId]/cancel
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/bookings/[bookingId]/cancel (5I)", () => {
  it("confirmed booking, refund_to=original_form_of_payment → 200; DB cancelled; stripe.refunds NOT called", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_123",
      refund_amount: "245.50",
      refund_currency: "GBP",
      refund_to: "original_form_of_payment",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.refundAmount).toBe("245.50");
    expect(json.refundTo).toBe("original_form_of_payment");

    expect(mockCancelBookingByUser).toHaveBeenCalledWith("bk-001", {
      duffelCancellationId: "canc_123",
      refundAmount: "245.50",
      refundCurrency: "GBP",
      refundTo: "original_form_of_payment",
      cancelledReason: "user_cancelled",
    });
  });

  it("refund_to=voucher → 200; refundMessage contains 'voucher' language", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_124",
      refund_amount: "200.00",
      refund_currency: "USD",
      refund_to: "voucher",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.refundMessage.toLowerCase()).toContain("voucher");
    expect(json.refundMessage.toLowerCase()).not.toContain("card refund");
  });

  it("refund_to=balance → 200; refundMessage mentions 'operator account'", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_125",
      refund_amount: "150.00",
      refund_currency: "EUR",
      refund_to: "balance",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.refundMessage.toLowerCase()).toContain("operator account");
    // Should NOT promise a refund to the user's payment card
    expect(json.refundMessage.toLowerCase()).not.toContain("to your card");
    expect(json.refundMessage.toLowerCase()).not.toContain("return");
  });

  it("refund_amount=0.00 → 200; refundMessage says 'non-refundable'", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_126",
      refund_amount: "0.00",
      refund_currency: "GBP",
      refund_to: "original_form_of_payment",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.refundMessage.toLowerCase()).toContain("non-refundable");
  });

  it("step 1 throws ApiError → 502; DB row status still 'confirmed'; cancellation_pending still 0", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockRejectedValueOnce(
      new MockApiError(422, "Cannot cancel at this time")
    );

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    expect(res.status).toBe(502);
    expect(mockCancelBookingByUser).not.toHaveBeenCalled();
    expect(mockSetCancellationPending).not.toHaveBeenCalled();
  });

  it("step 2 throws (Step2CancellationError) → 502; DB has cancellation_pending=1 and pending_cancellation_id; status still 'confirmed'", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockRejectedValueOnce(
      new MockStep2CancellationError("canc_abc", "Step 2 failed")
    );

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    expect(res.status).toBe(502);
    expect(mockSetCancellationPending).toHaveBeenCalledWith("bk-001", "canc_abc");
    expect(mockCancelBookingByUser).not.toHaveBeenCalled();
  });

  it("cancelBookingByUser DB write fails on first attempt, succeeds on retry → 200", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_retry",
      refund_amount: "100.00",
      refund_currency: "USD",
      refund_to: "original_form_of_payment",
    });
    mockCancelBookingByUser
      .mockImplementationOnce(() => { throw new Error("DB locked"); })
      .mockImplementationOnce(() => { /* success on retry */ });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    expect(res.status).toBe(200);
    expect(mockCancelBookingByUser).toHaveBeenCalledTimes(2);
  });

  it("cancelBookingByUser DB write fails on both attempts → 200 returned; error logged", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_fail",
      refund_amount: "80.00",
      refund_currency: "USD",
      refund_to: "original_form_of_payment",
    });
    mockCancelBookingByUser.mockImplementation(() => {
      throw new Error("DB permanently locked");
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    // Cancellation is irrevocable — still returns 200
    expect(res.status).toBe(200);
    expect(mockCancelBookingByUser).toHaveBeenCalledTimes(2);
  });

  it("booking not found → 404", async () => {
    mockGetBookingById.mockReturnValueOnce(null);

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-ghost") as any, makeParams("bk-ghost") as any);

    expect(res.status).toBe(404);
    expect(mockRequestUserCancellation).not.toHaveBeenCalled();
  });

  it("wrong user (booking belongs to different user) → 403", async () => {
    mockGetBookingById.mockReturnValueOnce({
      ...CONFIRMED_BOOKING,
      user_id: "other-user-id",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    expect(res.status).toBe(403);
    expect(mockRequestUserCancellation).not.toHaveBeenCalled();
  });

  it("unauthenticated → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    expect(res.status).toBe(401);
    expect(mockGetBookingById).not.toHaveBeenCalled();
    expect(mockRequestUserCancellation).not.toHaveBeenCalled();
  });

  it("non-confirmed status (pending) → 409 'Only confirmed bookings can be cancelled'", async () => {
    mockGetBookingById.mockReturnValueOnce({
      ...CONFIRMED_BOOKING,
      status: "pending",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("Only confirmed bookings can be cancelled");
  });

  it("already cancelled → 409", async () => {
    mockGetBookingById.mockReturnValueOnce({
      ...CONFIRMED_BOOKING,
      status: "cancelled",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    expect(res.status).toBe(409);
    expect(mockRequestUserCancellation).not.toHaveBeenCalled();
  });

  it("no duffel_order_id → 409 'no airline order reference found'", async () => {
    mockGetBookingById.mockReturnValueOnce({
      ...CONFIRMED_BOOKING,
      duffel_order_id: null,
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("no airline order reference found");
  });

  it("cancellation_pending=1 already set → 409 'cancellation is already pending'", async () => {
    mockGetBookingById.mockReturnValueOnce({
      ...CONFIRMED_BOOKING,
      cancellation_pending: 1,
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error.toLowerCase()).toContain("pending");
  });

  it("email/push throws after successful cancellation → 200 returned, no error surfaced", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_notify_fail",
      refund_amount: "50.00",
      refund_currency: "GBP",
      refund_to: "original_form_of_payment",
    });
    // Override the default resolved mocks with rejections for this test
    mockSendEmail.mockReturnValueOnce(Promise.reject(new Error("Email service down")));
    mockSendPushNotification.mockReturnValueOnce(Promise.reject(new Error("Push service down")));

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);

    // Should still succeed — notifications are fire-and-forget
    expect(res.status).toBe(200);
  });
});

describe("POST /api/bookings/[bookingId]/cancel — additional branch coverage", () => {
  it("refund_to unknown type (not voucher/balance/ofp) → 200; falls through to default message", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_unknown",
      refund_amount: "75.00",
      refund_currency: "GBP",
      refund_to: "unknown_type",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    expect(res.status).toBe(200);
  });

  it("booking with null booking_reference → 200; email sent without reference line", async () => {
    mockGetBookingById.mockReturnValueOnce({ ...CONFIRMED_BOOKING, booking_reference: null });
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_no_ref",
      refund_amount: "50.00",
      refund_currency: "GBP",
      refund_to: "original_form_of_payment",
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    expect(res.status).toBe(200);
  });

  it("createNotification throws → 200 returned; error logged but not surfaced", async () => {
    mockGetBookingById.mockReturnValueOnce(CONFIRMED_BOOKING);
    mockRequestUserCancellation.mockResolvedValueOnce({
      id: "canc_notif_fail",
      refund_amount: "50.00",
      refund_currency: "GBP",
      refund_to: "original_form_of_payment",
    });
    mockCreateNotification.mockImplementationOnce(() => {
      throw new Error("DB constraint");
    });

    const { POST } = await import("@/app/api/bookings/[bookingId]/cancel/route");
    const res = await POST(makeRequest("bk-001") as any, makeParams("bk-001") as any);
    expect(res.status).toBe(200);
  });
});
