import { SubscriptionTier, TIER_LABELS } from '../lib/subscription-types';

interface TierBadgeProps {
  tier: SubscriptionTier;
  className?: string;
}

export default function TierBadge({ tier, className = '' }: TierBadgeProps) {
  const configs: Record<SubscriptionTier, { bg: string; text: string; border: string }> = {
    free: {
      bg: 'rgba(100,100,120,0.15)',
      text: '#9ca3af',
      border: 'rgba(100,100,120,0.3)',
    },
    pro: {
      bg: 'rgba(59,130,246,0.15)',
      text: '#60a5fa',
      border: 'rgba(59,130,246,0.4)',
    },
    premium: {
      bg: 'rgba(245,158,11,0.15)',
      text: '#fbbf24',
      border: 'rgba(245,158,11,0.4)',
    },
  };

  const config = configs[tier];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      {tier === 'premium' && '★ '}
      {tier === 'pro' && '⚡ '}
      {TIER_LABELS[tier]}
    </span>
  );
}
