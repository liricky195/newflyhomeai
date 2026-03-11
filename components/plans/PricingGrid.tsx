"use client";

import { motion, type Variants } from "framer-motion";
import PricingCard from "./PricingCard";
import type { SubscriptionTier } from "@/lib/db";

const TIERS: SubscriptionTier[] = ["free", "standard", "pro", "ultimate"];

interface PricingGridProps {
  userId: string | null;
  currentTier: SubscriptionTier;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: 0 | 1;
  hasActiveStripeSubscription: boolean;
}

const container: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export default function PricingGrid({
  userId,
  currentTier,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  hasActiveStripeSubscription,
}: PricingGridProps) {
  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {TIERS.map((tier) => (
        <motion.div key={tier} variants={item}>
          <PricingCard
            tier={tier}
            userId={userId}
            currentTier={currentTier}
            currentPeriodEnd={currentPeriodEnd}
            cancelAtPeriodEnd={cancelAtPeriodEnd}
            hasActiveStripeSubscription={hasActiveStripeSubscription}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
