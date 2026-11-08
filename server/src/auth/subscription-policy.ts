import { AuthUser, SubscriptionTier } from './types';

export const TIER_LIMITS_CONFIG: Record<string, Record<SubscriptionTier, number>> = {
  ai_match:      { free: 0,  pro: 15,  premium: -1 },
  ai_team:       { free: 0,  pro: 10,  premium: -1 },
  ai_league:     { free: 0,  pro: 10,  premium: -1 },
  ai_bulk:       { free: 0,  pro: 5,   premium: 20 },
  ai_player:     { free: 0,  pro: 10,  premium: -1 },
  ai_transfer:   { free: 0,  pro: 10,  premium: -1 },
  forum_topic:   { free: 2,  pro: 10,  premium: -1 },
  forum_comment: { free: 5,  pro: -1,  premium: -1 },
  kolon_generate: { free: 5, pro: -1,  premium: -1 },
};

export const COUPON_LIMITS: Record<SubscriptionTier, number> = {
  free: 3,
  pro: 20,
  premium: -1,
};

export const KOLON_LIMITS: Record<SubscriptionTier, number> = {
  free: 10000,   // per generation; free also has 5 uses/day
  pro: 50000,
  premium: 500000,
};

export const HISTORY_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 50,
  premium: 200,
};

export function effectiveTier(user: Pick<AuthUser, 'subscriptionTier' | 'subscriptionExpiresAt'>, now = Date.now()): SubscriptionTier {
  if (!['free', 'pro', 'premium'].includes(user.subscriptionTier)) return 'free';
  if (user.subscriptionTier !== 'free' && user.subscriptionExpiresAt) {
    const value = user.subscriptionExpiresAt;
    const timestamp = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value.replace(' ', 'T') + 'Z');
    if (!Number.isFinite(timestamp) || timestamp <= now) return 'free';
  }
  return user.subscriptionTier;
}
