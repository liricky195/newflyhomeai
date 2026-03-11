import { NextRequest, NextResponse } from "next/server";
import { handleWebhook } from "@/lib/stripe";
import { log, logRequest } from "@/lib/logger";
import { corsHeaders } from "@/lib/cors"; // HARDENED IN STEP 10

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
