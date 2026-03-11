import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  initDb,
  getBookingById,
  cancelBookingByUser,
  setCancellationPending,
  getUserById,
  createNotification,
} from "@/lib/db";
import { requestUserCancellation, Step2CancellationError, ApiError } from "@/lib/duffel";
import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import crypto from "crypto";

function buildRefundMessage(
  refundAmount: string,
  refundCurrency: string,
  refundTo: string
): string {
  if (refundAmount === "0.00") {
    return "This fare is non-refundable. No refund will be issued.";
  }
  if (refundTo === "original_form_of_payment" || refundTo === "card") {
    return `Duffel will return ${refundAmount} ${refundCurrency} to your original payment method within 5–10 business days.`;
  }
  if (refundTo === "voucher") {
    return "Your refund will be issued as an airline credit voucher. Contact the airline to redeem it.";
  }
  if (refundTo === "balance") {
    return "Duffel has processed this cancellation. This fare type is settled through your Duffel operator account — the credit is applied there rather than issued as a payment refund.";
  }
  return `Duffel will return ${refundAmount} ${refundCurrency} to your original payment method within 5–10 business days.`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;

  // Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initDb();

  // Fetch booking
  const booking = getBookingById(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Ownership
  if (booking.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // State checks
  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Only confirmed bookings can be cancelled" },
      { status: 409 }
    );
  }

  if (!booking.duffel_order_id) {
    return NextResponse.json(
      { error: "Booking cannot be cancelled — no airline order reference found" },
      { status: 409 }
    );
  }

  if (booking.cancellation_pending === 1) {
    return NextResponse.json(
      { error: "A cancellation is already pending manual review for this booking. Contact support." },
      { status: 409 }
    );
  }

  // Step 1: create cancellation quote
  let cancellation;
  try {
    cancellation = await requestUserCancellation(booking.duffel_order_id);
  } catch (err) {
    if (err instanceof Step2CancellationError) {
      // Step 1 succeeded but step 2 failed — preserve the quote ID for manual review
      setCancellationPending(bookingId, err.cancellationId);
      return NextResponse.json(
        {
          error:
            "Cancellation could not be completed. Your booking may still be active — please check with the airline and contact support.",
        },
        { status: 502 }
      );
    }
    // Step 1 failed — booking still active, no DB change
    return NextResponse.json(
      { error: "Cancellation request failed — your booking is still active. Please try again." },
      { status: 502 }
    );
  }

  const { id: duffelCancellationId, refund_amount, refund_currency, refund_to } = cancellation;

  const refundMessage = buildRefundMessage(refund_amount, refund_currency, refund_to);

  // Update DB — if write fails, retry once, then return 200 regardless (cancellation is irrevocable)
  const writeDb = () =>
    cancelBookingByUser(bookingId, {
      duffelCancellationId,
      refundAmount: refund_amount,
      refundCurrency: refund_currency,
      refundTo: refund_to,
      cancelledReason: "user_cancelled",
    });

  try {
    writeDb();
  } catch (dbErr) {
    console.error(`[cancel] DB write failed for booking ${bookingId}, cancellation ${duffelCancellationId}:`, dbErr);
    try {
      writeDb();
    } catch (retryErr) {
      console.error(
        `[cancel] DB retry also failed for booking ${bookingId}, cancellation ${duffelCancellationId}:`,
        retryErr
      );
    }
    // Return 200 — the cancellation is irrevocable, do not surface DB errors to user
  }

  // Notifications — fire-and-forget
  const user = getUserById(booking.user_id);
  const notifyBody = `Your booking has been cancelled. ${refundMessage}`;

  if (user?.email) {
    sendEmail(
      user.email,
      "Your booking has been cancelled",
      `<h2>Booking Cancelled</h2>
       <p>Your booking has been cancelled as requested.</p>
       ${booking.booking_reference ? `<p>Booking reference: <strong>${booking.booking_reference}</strong></p>` : ""}
       <p>${refundMessage}</p>
       <p>Refund eligibility and timing are determined by the airline's fare conditions. If a refund is due, Duffel will issue it to your original payment method.</p>`
    ).catch((e) => console.error(`[cancel] Email error for booking ${bookingId}:`, e));
  }

  sendPushNotification(booking.user_id, {
    title: "Booking cancelled",
    body: notifyBody,
  }).catch((e) => console.error(`[cancel] Push error for booking ${bookingId}:`, e));

  try {
    createNotification({
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      flight_id: booking.flight_id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: notifyBody,
    });
  } catch (e) {
    console.error(`[cancel] Notification insert error for booking ${bookingId}:`, e);
  }

  return NextResponse.json({
    success: true,
    refundAmount: refund_amount,
    refundCurrency: refund_currency,
    refundTo: refund_to,
    refundMessage,
  });
}
