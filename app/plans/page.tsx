import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getSubscriptionByUserId } from "@/lib/db";
import PricingGrid from "@/components/plans/PricingGrid";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await getServerSession(authOptions);

  let sub = null;
  if (session?.user?.id) {
    initDb();
    sub = getSubscriptionByUserId(session.user.id);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white">Choose Your Plan</h1>
        <p className="mt-2 text-sm text-slate-400">
          Faster scans mean you see new flights before everyone else.
        </p>
      </div>

      <PricingGrid
        userId={session?.user?.id ?? null}
        currentTier={sub?.tier ?? "free"}
        currentPeriodEnd={sub?.current_period_end ?? null}
        cancelAtPeriodEnd={sub?.cancel_at_period_end ?? 0}
        hasActiveStripeSubscription={!!sub?.stripe_subscription_id}
      />
    </div>
  );
}
