import crypto from "crypto";
import {
  getConfirmedBookingsByFlightId,
  updateBookingStatus,
  getUserById,
  createNotification,
  type DbBooking,
} from "./db";
import { cancelOrder } from "./duffel";
import { sendEmail } from "./email";
import { sendPushNotification } from "./push";
import { log } from "./logger";

export async function handleFlightCancellation(flightId: string): Promise<void> {
  const bookings = getConfirmedBookingsByFlightId(flightId);
  if (bookings.length === 0) return;

  const results = await Promise.allSettled(
    bookings.map((b) => cancelConfirmedBooking(b))
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      log("error", "bookings", `handleFlightCancellation failed for booking ${bookings[i].id}`, {
        reason: String(result.reason),
      });
    }
  });
}

export async function cancelConfirmedBooking(booking: DbBooking): Promise<void> {
  // Step 1: attempt Duffel order cancellation — log on failure, do not abort
  if (booking.duffel_order_id) {
    try {
      await cancelOrder(booking.duffel_order_id);
    } catch (err) {
      log("error", "bookings", `Duffel cancelOrder failed for booking ${booking.id}`, {
        err: String(err),
      });
    }
  }

  // Step 2: update booking status
  try {
    updateBookingStatus(booking.id, "cancelled", undefined, "flight_cancelled");
  } catch (err) {
    log("error", "bookings", `updateBookingStatus failed for booking ${booking.id}`, {
      err: String(err),
    });
  }

  // Steps 3–5: notify user — each failure is caught independently
  const user = getUserById(booking.user_id);
  const refundMessage =
    "Duffel has been notified of this cancellation. If your ticket is refundable, Duffel will issue the refund directly to your original payment method. Timeline is determined by the airline's fare conditions.";

  if (user?.email) {
    await sendEmail(
      user.email,
      "Your flight has been cancelled",
      `<h2>Your flight has been cancelled</h2>
       <p>We're sorry — the flight you booked has been cancelled by the airline.</p>
       <p>${refundMessage}</p>
       ${booking.booking_reference ? `<p>Original booking reference: <strong>${booking.booking_reference}</strong></p>` : ""}
      `
    ).catch((e) =>
      log("error", "bookings", `Email error for booking ${booking.id}`, { err: String(e) })
    );
  }

  await sendPushNotification(booking.user_id, {
    title: "Flight cancelled",
    body: refundMessage,
  }).catch((e) =>
    log("error", "bookings", `Push error for booking ${booking.id}`, { err: String(e) })
  );

  createNotification({
    id: crypto.randomUUID(),
    user_id: booking.user_id,
    flight_id: booking.flight_id,
    type: "flight_cancelled",
    title: "Flight cancelled",
    body: refundMessage,
  });
}
