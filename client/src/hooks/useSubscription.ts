import { useAuth } from '../contexts/AuthContext';
import { SubscriptionTier, TIER_ORDER } from '../lib/subscription-types';

export interface UseSubscriptionReturn {
  tier: SubscriptionTier;
  isFree: boolean;
  isPro: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  expiresAt: string | null;
  meetsRequirement: (required: SubscriptionTier) => boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user, isAdmin } = useAuth();

  const tier: SubscriptionTier = (user?.subscriptionTier as SubscriptionTier) || 'free';
  const expiresAt = user?.subscriptionExpiresAt ?? null;

  return {
    tier,
    isFree: tier === 'free',
    isPro: tier === 'pro',
    isPremium: tier === 'premium',
    isAdmin,
    expiresAt,
    meetsRequirement: (required: SubscriptionTier) =>
      isAdmin || TIER_ORDER[tier] >= TIER_ORDER[required],
  };
}
