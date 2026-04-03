import { ReactNode } from 'react';
import { SubscriptionTier } from '../lib/subscription-types';
import { useSubscription } from '../hooks/useSubscription';
import UpgradePrompt from './UpgradePrompt';

interface FeatureGateProps {
  minTier: SubscriptionTier;
  feature?: string;
  /** If true, renders children with a visual locked overlay instead of replacing entirely */
  overlay?: boolean;
  children: ReactNode;
}

export default function FeatureGate({ minTier, feature, overlay, children }: FeatureGateProps) {
  const { meetsRequirement } = useSubscription();

  if (meetsRequirement(minTier)) {
    return <>{children}</>;
  }

  if (overlay) {
    return (
      <div style={{ position: 'relative', userSelect: 'none' }}>
        <div style={{ opacity: 0.25, pointerEvents: 'none', filter: 'blur(2px)' }}>
          {children}
        </div>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,10,20,0.5)', borderRadius: '12px',
        }}>
          <UpgradePrompt feature={feature} requiredTier={minTier} variant="inline" />
        </div>
      </div>
    );
  }

  return <UpgradePrompt feature={feature} requiredTier={minTier} />;
}
