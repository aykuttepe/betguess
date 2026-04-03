import { LiveGradeSummary } from '../lib/live-grading';

interface Props {
  summary: LiveGradeSummary;
  programNo: number;
  fetchedAt: string;
  onRefresh: () => void;
  loading: boolean;
}

export default function LiveTrackingDashboard({ summary, programNo, fetchedAt, onRefresh, loading }: Props) {
  const finishedPct = summary.finishedMatchCount > 0
    ? Math.round((summary.finishedMatchCount / (summary.finishedMatchCount + summary.pendingMatchCount)) * 100)
    : 0;

  const timeStr = new Date(fetchedAt).toLocaleString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="live-dashboard">
      <div className="live-dashboard-header">
        <div>
          <h3 className="live-dashboard-title">
            Canli Takip — Program {programNo}
          </h3>
          <p className="live-dashboard-subtitle">
            {summary.finishedMatchCount}/{summary.finishedMatchCount + summary.pendingMatchCount} mac tamamlandi
          </p>
        </div>
        <div className="live-dashboard-actions">
          <span className="live-dashboard-time">Son: {timeStr}</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="live-dashboard-refresh"
          >
            {loading ? '...' : 'Yenile'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="live-progress-bar">
        <div
          className="live-progress-fill"
          style={{ width: `${finishedPct}%` }}
        />
      </div>

      {/* Bucket cards */}
      <div className="live-bucket-grid">
        <BucketCard
          label="Hatasiz"
          count={summary.buckets.perfect}
          accent="emerald"
        />
        <BucketCard
          label="1 Yanlis"
          count={summary.buckets.oneMiss}
          accent="amber"
        />
        <BucketCard
          label="2 Yanlis"
          count={summary.buckets.twoMiss}
          accent="orange"
        />
        <BucketCard
          label="3 Yanlis"
          count={summary.buckets.threeMiss}
          accent="rose"
        />
        <BucketCard
          label="Elenmis"
          count={summary.buckets.eliminated}
          accent="gray"
        />
      </div>

      {/* Summary stats */}
      <div className="live-summary-row">
        <span>Toplam: <strong>{summary.totalCoupons}</strong> kupon</span>
        <span className="text-emerald-400">Devam eden: <strong>{summary.aliveCount}</strong></span>
        <span className="text-gray-500">Elenen: <strong>{summary.eliminatedCount}</strong></span>
      </div>
    </div>
  );
}

function BucketCard({ label, count, accent }: { label: string; count: number; accent: string }) {
  const colors: Record<string, string> = {
    emerald: 'live-bucket-emerald',
    amber: 'live-bucket-amber',
    orange: 'live-bucket-orange',
    rose: 'live-bucket-rose',
    gray: 'live-bucket-gray',
  };

  return (
    <div className={`live-bucket-card ${colors[accent] || ''}`}>
      <div className="live-bucket-count">{count}</div>
      <div className="live-bucket-label">{label}</div>
    </div>
  );
}
