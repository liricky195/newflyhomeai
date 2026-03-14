import { NextRequest, NextResponse } from "next/server";
import { handleWebhook, getStripe } from "@/lib/stripe";
import { log, logRequest } from "@/lib/logger";
import { corsHeaders } from "@/lib/cors";
import { getUserByStripeCustomerId } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import Stripe from "stripe"; // HARDENED IN STEP 10

// HARDENED IN STEP 10: OPTIONS for CORS preflight (unrestricted — always returns headers)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(origin, true),
  });
}

export async function POST(request: NextRequest) {
  const startMs = Date.now(); // HARDENED IN STEP 10: request duration tracking
  const origin = request.headers.get("origin");

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/webhooks/stripe", 400, durationMs);
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400, headers: corsHeaders(origin, true) }
    );
  }

  try {
    // HARDENED IN STEP 10 (1F): raw body as text — constructEvent is the absolute
    // first operation after reading the raw body. No DB call, JSON parse, or session
    // check may precede it.
    const rawBody = await request.text();
    await handleWebhook(rawBody, signature);

    // After successful webhook processing, check if we need to send a receipt
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      
      if (customerId) {
        const user = getUserByStripeCustomerId(customerId);
        if (user?.email) {
          const amount = (invoice.amount_paid / 100).toFixed(2);
          const currency = invoice.currency.toUpperCase();
          const planName = invoice.lines.data[0]?.description ?? "Subscription Plan";
          
          await sendEmail(
            user.email,
            `Receipt for your ${planName} subscription`,
            `<h2>Thank you for your purchase!</h2>
             <p>We've received your payment of <strong>${amount} ${currency}</strong> for your <strong>${planName}</strong>.</p>
             <p>Your subscription is now active.</p>
             <p>Invoice ID: ${invoice.id}</p>`
          ).catch(e => log("error", "stripe-receipt", "Failed to send receipt email", { err: String(e) }));
        }
      }
    }

    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/webhooks/stripe", 200, durationMs);
    return NextResponse.json(
      { received: true },
      { headers: corsHeaders(origin, true) }
    );
  } catch (err) {
    log("error", "stripe-webhook", "Error processing webhook", {
      err: (err as Error).message,
    });
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/webhooks/stripe", 400, durationMs);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400, headers: corsHeaders(origin, true) }
    );
  }
}
