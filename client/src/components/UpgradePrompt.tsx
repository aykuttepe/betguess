import { useState } from 'react';
import { SubscriptionTier, TIER_LABELS } from '../lib/subscription-types';

interface UpgradePromptProps {
  /** Short name for the feature that's limited, e.g. 'forum_topic' */
  feature?: string;
  /** The tier required to access the feature */
  requiredTier?: SubscriptionTier;
  /** Current usage info */
  usageInfo?: { used: number; limit: number };
  /** Custom message override */
  message?: string;
  /** Styling variant */
  variant?: 'banner' | 'inline' | 'toast';
  onDismiss?: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  forum_topic: 'Forum Konu Açma',
  forum_comment: 'Forum Yorum',
  ai_match: 'AI Maç Analizi',
  ai_team: 'AI Takım Analizi',
  ai_league: 'AI Lig Analizi',
  ai_player: 'AI Oyuncu Analizi',
  ai_transfer: 'AI Transfer Analizi',
  ai_bulk: 'AI Toplu Analiz',
  saved_coupons: 'Kupon Kaydetme',
  kolon_generate: 'Kolon Üretimi',
};

export default function UpgradePrompt({
  feature,
  requiredTier,
  usageInfo,
  message,
  variant = 'banner',
  onDismiss,
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  const featureLabel = feature ? (FEATURE_LABELS[feature] || feature) : 'Bu özellik';
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : 'Pro';

  let displayMessage = message;
  if (!displayMessage) {
    if (usageInfo) {
      displayMessage = `Günlük ${featureLabel} limitinize ulaştınız (${usageInfo.used}/${usageInfo.limit}). ${tierLabel} ile devam edin.`;
    } else {
      displayMessage = `${featureLabel}, ${tierLabel} aboneliği gerektirir.`;
    }
  }

  if (variant === 'inline') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.25)',
        fontSize: '0.85rem',
      }}>
        <span style={{ fontSize: '1.1rem' }}>🔒</span>
        <span style={{ color: '#d1d5db', flex: 1 }}>{displayMessage}</span>
        {onDismiss && (
          <button onClick={handleDismiss} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px 6px',
          }}>✕</button>
        )}
      </div>
    );
  }

  // banner (default)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.06))',
      border: '1px solid rgba(245,158,11,0.3)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    }}>
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚡</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, color: '#fbbf24', fontWeight: 600, fontSize: '0.9rem' }}>
          {requiredTier === 'premium' ? 'Premium Gerekli' : `${tierLabel} Gerekli`}
        </p>
        <p style={{ margin: '2px 0 0', color: '#d1d5db', fontSize: '0.82rem' }}>{displayMessage}</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <a
          href="/pricing"
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#1a1a2e',
            fontWeight: 700,
            fontSize: '0.8rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Planları Gör
        </a>
        {onDismiss && (
          <button onClick={handleDismiss} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#9ca3af',
            cursor: 'pointer',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '0.8rem',
          }}>Kapat</button>
        )}
      </div>
    </div>
  );
}
