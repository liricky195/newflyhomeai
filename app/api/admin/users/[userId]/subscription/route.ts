import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { updateSubscriptionOverride, flagAirportForImmediateScan } from "@/lib/db";
import type { SubscriptionTier } from "@/lib/db";
import { getScanInterval } from "@/lib/tierIntervals";
import { log } from "@/lib/logger";
import { getStripe } from "@/lib/stripe";

const SubscriptionSchema = z.object({
  tier: z.enum(["free", "standard", "pro", "ultimate"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.id)) {
    log("warn", "admin", "Forbidden access attempt", { userId: session.user.id, path: "/api/admin/users/[userId]/subscription" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tier } = parsed.data;

  const TIER_RANK: Record<string, number> = { free: 0, standard: 1, pro: 2, ultimate: 3 };

  try {
    const { stripeSubscriptionId, previousTier } = updateSubscriptionOverride(userId, tier);

    // Flag airport for an immediate scan when admin upgrades a user's tier.
    if ((TIER_RANK[tier] ?? 0) > (TIER_RANK[previousTier] ?? 0)) {
      flagAirportForImmediateScan(userId);
    }

    if (tier === "free" && stripeSubscriptionId) {
      try {
        await getStripe().subscriptions.cancel(stripeSubscriptionId, {
          invoice_now: false,
          prorate: false,
        });
      } catch (stripeErr) {
        log("error", "admin", `Stripe cancel failed for sub ${stripeSubscriptionId}`, { err: String(stripeErr) });
      }
    }

    return NextResponse.json({
      success: true,
      tier,
      scan_interval_seconds: getScanInterval(tier),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
