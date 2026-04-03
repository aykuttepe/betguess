import { useState } from 'react';
import { LiveCouponGrade } from '../lib/live-grading';

interface Props {
  grade: LiveCouponGrade;
  index: number;
  count?: number;
}

export default function LiveCouponCard({ grade, index, count = 1 }: Props) {
  const [expanded, setExpanded] = useState(false);

  const borderClass = grade.missCount === 0
    ? 'live-card-perfect'
    : grade.missCount === 1
      ? 'live-card-one'
      : grade.missCount <= 3 && grade.isAlive
        ? 'live-card-warn'
        : 'live-card-eliminated';

  const finishedCount = grade.hitCount + grade.missCount;

  return (
    <div className={`live-coupon-card ${borderClass}`}>
      <button
        className="live-coupon-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="live-coupon-left">
          <span className="live-coupon-index">#{index + 1}</span>
          {count > 1 && (
            <span className="live-coupon-count-badge">×{count} adet</span>
          )}
        </div>

        <div className="live-coupon-stats">
          <span className="live-stat-hit">{grade.hitCount}/{finishedCount} dogru</span>
          <span className="live-stat-pending">{grade.pendingCount} mac kaldi</span>
          {!grade.isAlive && <span className="live-stat-eliminated">Elendi</span>}
        </div>

        {/* Mini progress bar */}
        <div className="live-mini-bar">
          {grade.matchDetails.map((m) => (
            <div
              key={m.matchNo}
              className={`live-mini-segment live-mini-${m.status}`}
              title={`${m.matchNo}. ${m.homeTeam} vs ${m.awayTeam}`}
            />
          ))}
        </div>

        <span className="live-coupon-expand">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="live-coupon-details">
          {grade.matchDetails.map((m) => (
            <div key={m.matchNo} className={`live-match-row live-match-${m.status}`}>
              <span className="live-match-no">{m.matchNo}</span>
              <span className="live-match-teams">
                {m.homeTeam} - {m.awayTeam}
              </span>
              <span className="live-match-selection">
                Tahmin: {m.selection.join(', ') || '-'}
              </span>
              <span className="live-match-result">
                {m.result
                  ? `Sonuc: ${m.result} (${m.score || '-'})`
                  : m.score
                    ? `Devam: ${m.score}`
                    : 'Bekleniyor'}
              </span>
              <span className="live-match-icon">
                {m.status === 'hit' ? '✅' : m.status === 'miss' ? '❌' : '⏳'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
