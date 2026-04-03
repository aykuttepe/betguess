import { useEffect, useState } from 'react';
import { UPGRADE_NEEDED_EVENT, RATE_LIMITED_EVENT } from '../lib/http';
import { SubscriptionTier } from '../lib/subscription-types';
import UpgradePrompt from './UpgradePrompt';

interface ToastState {
  feature?: string;
  requiredTier?: SubscriptionTier;
  usageInfo?: { used: number; limit: number };
  message?: string;
}

/**
 * Global component — mount once in App.tsx.
 * Listens to betguess:upgrade-needed and betguess:rate-limited events
 * and shows a floating UpgradePrompt toast.
 */
export default function GlobalUpgradeToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    function onUpgradeNeeded(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      setToast({
        feature: detail.feature,
        requiredTier: detail.requiredTier,
        message: detail.error,
      });
    }

    function onRateLimited(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      setToast({
        feature: detail.feature,
        requiredTier: detail.requiredTier,
        usageInfo: detail.limit != null ? { used: detail.used || 0, limit: detail.limit } : undefined,
        message: detail.error,
      });
    }

    window.addEventListener(UPGRADE_NEEDED_EVENT, onUpgradeNeeded);
    window.addEventListener(RATE_LIMITED_EVENT, onRateLimited);
    return () => {
      window.removeEventListener(UPGRADE_NEEDED_EVENT, onUpgradeNeeded);
      window.removeEventListener(RATE_LIMITED_EVENT, onRateLimited);
    };
  }, []);

  if (!toast) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      width: 'min(520px, calc(100vw - 32px))',
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <UpgradePrompt
        feature={toast.feature}
        requiredTier={toast.requiredTier}
        usageInfo={toast.usageInfo}
        message={toast.message}
        variant="banner"
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
