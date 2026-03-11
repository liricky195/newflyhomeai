import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { initDb, getSubscriptionByUserId } from "@/lib/db";
import { getProrationPreview } from "@/lib/stripe";

const ProrationSchema = z.object({
  targetTier: z.enum(["standard", "pro", "ultimate"]),
});

const TIER_PRICE_ENV: Record<string, string> = {
  standard: "STRIPE_PRICE_STANDARD",
  pro: "STRIPE_PRICE_PRO",
  ultimate: "STRIPE_PRICE_ULTIMATE",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { targetTier } = parsed.data;
  const envVar = TIER_PRICE_ENV[targetTier];
  const priceId = process.env[envVar];
  if (!priceId) {
    return NextResponse.json({ error: `${envVar} is not set` }, { status: 400 });
  }

  initDb();
  const sub = getSubscriptionByUserId(session.user.id);

  if (!sub?.stripe_subscription_id) {
    // No active subscription — return zero proration
    return NextResponse.json({ amountDueCents: 0, currency: "usd" });
  }

  try {
    const preview = await getProrationPreview(sub.stripe_subscription_id, priceId);
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
