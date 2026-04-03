export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface UsageLimit {
  used: number;
  limit: number; // -1 = sınırsız, 0 = kilitli
}

export interface UsageStatus {
  tier: SubscriptionTier;
  expiresAt: string | null;
  limits: Record<string, UsageLimit>;
}

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Ücretsiz',
  pro: 'Pro',
  premium: 'Premium',
};

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

/** true if userTier meets or exceeds requiredTier */
export function tierMeetsRequirement(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_ORDER[userTier] >= TIER_ORDER[required];
}
