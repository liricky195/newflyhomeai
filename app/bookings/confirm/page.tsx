import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  initDb,
  getBookingByInternalReference,
  confirmBooking,
  setConfirmFetchFailed,
  getUserById,
} from "@/lib/db";
import { fetchDuffelOrder } from "@/lib/duffel";
import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import crypto from "crypto";
import { createNotification } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ref?: string; order_id?: string }>;
}

export default async function BookingConfirmPage({ searchParams }: PageProps) {
  const { ref, order_id: orderId } = await searchParams;

  // If either param missing, redirect immediately — no DB access
  if (!ref || !orderId) {
    redirect("/flights");
  }

  // Get session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(
      `/bookings/confirm?ref=${encodeURIComponent(ref)}&order_id=${encodeURIComponent(orderId)}`
    );
    redirect(`/auth?callbackUrl=${callbackUrl}`);
  }

  initDb();

  // Look up booking by internal reference
  const booking = getBookingByInternalReference(ref);
  if (!booking) {
    redirect("/flights");
  }

  // Ownership check
  if (booking.user_id !== session.user.id) {
    redirect("/flights");
  }

  // Idempotent: already confirmed
  if (booking.status === "confirmed") {
    redirect("/bookings");
  }

  // Already cancelled (user abandoned before returning)
  if (booking.status === "cancelled") {
    redirect("/bookings");
  }

  // Fetch Duffel order
  let order;
  try {
    order = await fetchDuffelOrder(orderId);
  } catch (err) {
    console.error("[confirm] fetchDuffelOrder failed:", err);
    setConfirmFetchFailed(booking.id);
    redirect(`/bookings/confirm-error?ref=${encodeURIComponent(ref)}`);
  }

  // Extract fields — handle nulls gracefully
  const bookingReference = order.booking_reference ?? "PENDING";
  const ticketNumber = order.documents[0]?.document_number ?? null;
  const totalAmount = order.total_amount ?? null;
  const totalCurrency = order.total_currency ?? null;

  // Confirm booking — must succeed before proceeding
  confirmBooking(booking.id, {
    duffelOrderId: order.id,
    bookingReference,
    ticketNumber,
    totalAmount,
    totalCurrency,
    duffelLinkId: booking.duffel_link_id,
  });

  // Send notifications — fire-and-forget, never abort the redirect
  const user = getUserById(booking.user_id);
  if (user?.email) {
    sendEmail(
      user.email,
      `Booking confirmed — ${bookingReference}`,
      `<h2>Your flight is booked!</h2>
       <p>Booking reference: <strong>${bookingReference}</strong></p>
       ${ticketNumber ? `<p>Ticket number: ${ticketNumber}</p>` : ""}
       ${totalAmount && totalCurrency ? `<p>Total paid: ${totalAmount} ${totalCurrency}</p>` : ""}
      `
    ).catch((e) => console.error("[confirm] Email error:", e));
  }

  sendPushNotification(booking.user_id, {
    title: "Booking confirmed",
    body: bookingReference !== "PENDING"
      ? `Reference: ${bookingReference}`
      : "Your booking is confirmed! Your reference will arrive by email shortly.",
  }).catch((e) => console.error("[confirm] Push error:", e));

  try {
    createNotification({
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      flight_id: booking.flight_id,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: bookingReference !== "PENDING"
        ? `Your flight has been booked. Reference: ${bookingReference}`
        : "Your booking is confirmed! Your reference will arrive by email shortly.",
    });
  } catch (e) {
    console.error("[confirm] Notification error:", e);
  }

  redirect("/bookings");
}
