/**
 * 5J — lib/bookings.ts: handleFlightCancellation (airline-initiated)
 * File: __tests__/lib/bookings.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockGetConfirmedBookingsByFlightId = vi.fn();
const mockUpdateBookingStatus = vi.fn();
const mockGetUserById = vi.fn();
const mockCreateNotification = vi.fn();

vi.mock("@/lib/db", () => ({
  getConfirmedBookingsByFlightId: (...args: unknown[]) =>
    mockGetConfirmedBookingsByFlightId(...args),
  updateBookingStatus: (...args: unknown[]) => mockUpdateBookingStatus(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

// ── Mock Duffel ───────────────────────────────────────────────────────────────

const mockCancelOrder = vi.fn();

vi.mock("@/lib/duffel", () => ({
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
}));

// ── Mock email / push ─────────────────────────────────────────────────────────

const mockSendEmail = vi.fn();
const mockSendPushNotification = vi.fn();

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}));

import { handleFlightCancellation } from "@/lib/bookings";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeBooking(id: string, duffelOrderId: string | null = "ord_abc") {
  return {
    id,
    user_id: "user-001",
    flight_id: "fl-001",
    status: "confirmed" as const,
    duffel_order_id: duffelOrderId,
    booking_reference: "REF-" + id,
    ticket_number: null,
    total_amount: 0,
    currency: "GBP",
    duffel_offer_id: "off-1",
    passenger_details: "{}",
    stripe_payment_intent_id: null,
    cancelled_reason: null,
    duffel_cancellation_id: null,
    refund_amount_cents: null,
    refund_to: null,
    stripe_refund_id: null,
    internal_reference: null,
    duffel_total: null,
    total_currency: null,
    duffel_link_id: null,
    confirm_fetch_failed: 0 as 0 | 1,
    cancellation_pending: 0 as 0 | 1,
    pending_cancellation_id: null,
    created_at: 1000000,
    updated_at: 1000000,
  };
}

const USER_RECORD = {
  id: "user-001",
  email: "test@test.com",
  name: "Test User",
  image: null,
  role: "user",
};

beforeEach(() => {
  mockSendEmail.mockResolvedValue(undefined);
  mockSendPushNotification.mockResolvedValue(undefined);
  mockCancelOrder.mockResolvedValue(undefined);
  mockUpdateBookingStatus.mockReturnValue(undefined);
  mockGetUserById.mockReturnValue(USER_RECORD);
  mockCreateNotification.mockReturnValue(undefined);
  vi.clearAllMocks();
  // Re-apply defaults after clearAllMocks
  mockSendEmail.mockResolvedValue(undefined);
  mockSendPushNotification.mockResolvedValue(undefined);
  mockCancelOrder.mockResolvedValue(undefined);
  mockUpdateBookingStatus.mockReturnValue(undefined);
  mockGetUserById.mockReturnValue(USER_RECORD);
  mockCreateNotification.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5J — handleFlightCancellation
// ─────────────────────────────────────────────────────────────────────────────

describe("handleFlightCancellation (5J)", () => {
  it("one confirmed booking on the cancelled flight → full pipeline: cancelOrder, updateBookingStatus, sendEmail, sendPushNotification, createNotification all called; stripe.refunds NOT called", async () => {
    const booking = makeBooking("bk-001");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);

    await handleFlightCancellation("fl-001");

    expect(mockCancelOrder).toHaveBeenCalledWith("ord_abc");
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith(
      "bk-001",
      "cancelled",
      undefined,
      "flight_cancelled"
    );
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendPushNotification).toHaveBeenCalledOnce();
    expect(mockCreateNotification).toHaveBeenCalledOnce();
  });

  it("email body does NOT contain 'refund has been issued' — asserts updated message copy from 1G", async () => {
    const booking = makeBooking("bk-copy");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);

    await handleFlightCancellation("fl-001");

    const emailBody = mockSendEmail.mock.calls[0]?.[2] as string;
    expect(emailBody).not.toContain("refund has been issued");
    expect(emailBody).toContain("Duffel");
  });

  it("duffel.cancelOrder throws → pipeline continues; updateBookingStatus, sendEmail, sendPushNotification, createNotification still called", async () => {
    const booking = makeBooking("bk-duffel-throw");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);
    mockCancelOrder.mockRejectedValueOnce(new Error("Duffel API timeout"));

    await handleFlightCancellation("fl-001");

    // cancelOrder threw, but everything else should still run
    expect(mockCancelOrder).toHaveBeenCalled();
    expect(mockUpdateBookingStatus).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockSendPushNotification).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalled();
  });

  it("updateBookingStatus throws → pipeline catches error; does not crash; other bookings processed", async () => {
    const bk1 = makeBooking("bk-status-throw");
    const bk2 = makeBooking("bk-status-ok");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([bk1, bk2]);

    mockUpdateBookingStatus
      .mockImplementationOnce(() => { throw new Error("DB error"); })
      .mockReturnValueOnce(undefined);

    await expect(handleFlightCancellation("fl-001")).resolves.not.toThrow();

    // Second booking should still have been attempted
    expect(mockCancelOrder).toHaveBeenCalledTimes(2);
    expect(mockUpdateBookingStatus).toHaveBeenCalledTimes(2);
  });

  it("sendEmail throws → other bookings on same flight still processed; pipeline does not abort", async () => {
    const bk1 = makeBooking("bk-email-throw");
    const bk2 = makeBooking("bk-email-ok");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([bk1, bk2]);

    mockSendEmail
      .mockRejectedValueOnce(new Error("Email down"))
      .mockResolvedValue(undefined);

    await expect(handleFlightCancellation("fl-001")).resolves.not.toThrow();

    // Both bookings should have had updateBookingStatus called
    expect(mockUpdateBookingStatus).toHaveBeenCalledTimes(2);
  });

  it("multiple confirmed bookings on same flight (3 bookings) → all 3 processed; cancelConfirmedBooking called 3 times", async () => {
    const bookings = [
      makeBooking("bk-a"),
      makeBooking("bk-b"),
      makeBooking("bk-c"),
    ];
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce(bookings);

    await handleFlightCancellation("fl-001");

    expect(mockCancelOrder).toHaveBeenCalledTimes(3);
    expect(mockUpdateBookingStatus).toHaveBeenCalledTimes(3);
    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(mockSendPushNotification).toHaveBeenCalledTimes(3);
  });

  it("zero confirmed bookings on flight → no error, no DB writes, no notifications", async () => {
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([]);

    await expect(handleFlightCancellation("fl-empty")).resolves.not.toThrow();

    expect(mockCancelOrder).not.toHaveBeenCalled();
    expect(mockUpdateBookingStatus).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("booking has no duffel_order_id → cancelOrder NOT called; rest of pipeline runs", async () => {
    const booking = makeBooking("bk-no-order", null);
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);

    await handleFlightCancellation("fl-001");

    expect(mockCancelOrder).not.toHaveBeenCalled();
    expect(mockUpdateBookingStatus).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("refundMessage contains updated Duffel message (1G text), not old Stripe text", async () => {
    const booking = makeBooking("bk-copy-push");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);

    await handleFlightCancellation("fl-001");

    const pushBody = mockSendPushNotification.mock.calls[0]?.[1]?.body as string;
    expect(pushBody).toContain("Duffel");
    expect(pushBody).not.toContain("5–10 business days");
    expect(pushBody).not.toContain("within 5");
  });
});

describe("handleFlightCancellation — additional branch coverage", () => {
  it("cancelConfirmedBooking rejects (createNotification throws) -> result.status=rejected is logged", async () => {
    const booking = makeBooking("bk-reject");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);
    mockCreateNotification.mockImplementationOnce(() => {
      throw new Error("DB constraint failure");
    });

    await expect(handleFlightCancellation("fl-001")).resolves.not.toThrow();

    // Pipeline should log the rejection but not crash
    expect(mockCancelOrder).toHaveBeenCalled();
  });

  it("user has no email -> sendEmail NOT called; rest of pipeline still runs", async () => {
    const booking = makeBooking("bk-no-email");
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);
    mockGetUserById.mockReturnValueOnce({ ...USER_RECORD, email: null });

    await handleFlightCancellation("fl-001");

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendPushNotification).toHaveBeenCalled();
  });
});

describe("cancelConfirmedBooking — booking_reference null branch", () => {
  it("booking with null booking_reference -> email still sent without reference line", async () => {
    const booking = { ...makeBooking("bk-no-ref"), booking_reference: null };
    mockGetConfirmedBookingsByFlightId.mockReturnValueOnce([booking]);

    await handleFlightCancellation("fl-001");

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailBody = mockSendEmail.mock.calls[0]?.[2] as string;
    expect(emailBody).not.toContain("Original booking reference");
  });
});
