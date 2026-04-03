import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGetTiers, TierInfo } from '../lib/subscription-api';
import { SubscriptionTier, TIER_LABELS } from '../lib/subscription-types';
import TierBadge from '../components/TierBadge';

const TIER_ICONS: Record<string, string> = { free: '🆓', pro: '⚡', premium: '★' };
const TIER_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  free:    { accent: '#9ca3af', bg: 'rgba(100,100,120,0.08)', border: 'rgba(100,100,120,0.2)' },
  pro:     { accent: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)'  },
  premium: { accent: '#fbbf24', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.35)' },
};

export default function PricingPage() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const currentTier = (user?.subscriptionTier || 'free') as SubscriptionTier;

  useEffect(() => {
    apiGetTiers()
      .then((d) => setTiers(d.tiers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#f9fafb' }}>
          Abonelik Planları
        </h1>
        <p style={{ color: '#9ca3af', marginTop: '10px', fontSize: '1rem' }}>
          İhtiyacınıza uygun planı seçin.
        </p>
        {user && (
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Mevcut planınız:</span>
            <TierBadge tier={currentTier} />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '60px 0' }}>Yükleniyor…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {tiers.map((tier) => {
            const colors = TIER_COLORS[tier.id] || TIER_COLORS.free;
            const isCurrentPlan = tier.id === currentTier;
            return (
              <div
                key={tier.id}
                style={{
                  borderRadius: '16px',
                  padding: '28px 24px',
                  background: colors.bg,
                  border: `2px solid ${isCurrentPlan ? colors.accent : colors.border}`,
                  boxShadow: isCurrentPlan ? `0 0 24px ${colors.accent}22` : '0 2px 12px rgba(0,0,0,0.2)',
                  position: 'relative',
                  transition: 'transform 0.2s',
                }}
              >
                {isCurrentPlan && (
                  <div style={{
                    position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
                    background: colors.accent, color: '#0a0a14', fontSize: '0.7rem', fontWeight: 800,
                    padding: '3px 14px', borderRadius: '0 0 8px 8px', letterSpacing: '0.05em',
                  }}>
                    MEVCUT PLANIN
                  </div>
                )}

                {/* Tier Header */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '6px' }}>{TIER_ICONS[tier.id]}</div>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: colors.accent }}>
                    {tier.name}
                  </h2>
                  <div style={{ marginTop: '6px', color: '#9ca3af', fontSize: '0.85rem' }}>
                    {tier.price === 0 ? 'Ücretsiz' : tier.price === null ? 'İletişime geç' : `₺${tier.price}/ay`}
                  </div>
                </div>

                {/* Feature List */}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tier.features.map((f) => (
                    <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ color: '#9ca3af' }}>{f.label}</span>
                      <span style={{
                        color: f.value === 'Kilitli' ? '#4b5563' : '#e5e7eb',
                        fontWeight: f.value === 'Kilitli' ? 400 : 600,
                        textAlign: 'right',
                      }}>
                        {f.value === 'Kilitli' ? '🔒 —' : f.value}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {!isCurrentPlan && tier.id !== 'free' && (
                  <div style={{ marginTop: '24px' }}>
                    <button style={{
                      width: '100%', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: `linear-gradient(135deg, ${colors.accent}, ${colors.accent}bb)`,
                      color: '#0a0a14', fontWeight: 700, fontSize: '0.9rem',
                    }}>
                      {TIER_LABELS[tier.id as SubscriptionTier]} Planına Geç
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.8rem', marginTop: '40px' }}>
        Abonelik yükseltmek veya sorularınız için yönetici ile iletişime geçin.
      </p>
    </div>
  );
}
