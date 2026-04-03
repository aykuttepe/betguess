import type { LiveProgram } from './live-tracking-api';

export interface LiveMatchGrade {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  selection: string[];
  result: '1' | 'X' | '2' | null;
  score: string | null;
  status: 'hit' | 'miss' | 'pending';
}

export interface LiveCouponGrade {
  kuponId: string;
  hitCount: number;
  missCount: number;
  pendingCount: number;
  maxPossible: number;
  isAlive: boolean;
  matchDetails: LiveMatchGrade[];
}

export interface LiveGradeSummary {
  totalCoupons: number;
  aliveCount: number;
  eliminatedCount: number;
  bestHitCount: number;
  bestMaxPossible: number;
  finishedMatchCount: number;
  pendingMatchCount: number;
  buckets: {
    perfect: number;
    oneMiss: number;
    twoMiss: number;
    threeMiss: number;
    eliminated: number;
  };
}

export interface SystemKuponLike {
  id: string;
  selections: Record<number, string[]>;
}

export function gradeCouponLive(
  kupon: SystemKuponLike,
  liveProgram: LiveProgram,
): LiveCouponGrade {
  const matchDetails: LiveMatchGrade[] = [];
  let hitCount = 0;
  let missCount = 0;
  let pendingCount = 0;

  for (const match of liveProgram.matches) {
    const selection = kupon.selections[match.matchNo] || [];
    let status: 'hit' | 'miss' | 'pending';

    if (match.result === null) {
      status = 'pending';
      pendingCount++;
    } else if (selection.includes(match.result)) {
      status = 'hit';
      hitCount++;
    } else {
      status = 'miss';
      missCount++;
    }

    matchDetails.push({
      matchNo: match.matchNo,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      selection,
      result: match.result,
      score: match.score,
      status,
    });
  }

  const maxPossible = hitCount + pendingCount;

  return {
    kuponId: kupon.id,
    hitCount,
    missCount,
    pendingCount,
    maxPossible,
    isAlive: maxPossible >= 12,
    matchDetails,
  };
}

export function gradeCouponsLive(
  kupons: SystemKuponLike[],
  liveProgram: LiveProgram,
): LiveCouponGrade[] {
  return kupons
    .map((k) => gradeCouponLive(k, liveProgram))
    .sort((a, b) => {
      // Best hit count first
      if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
      // Fewest misses first
      return a.missCount - b.missCount;
    });
}

export function summarizeLiveGrades(
  grades: LiveCouponGrade[],
  finishedMatchCount: number,
  pendingMatchCount: number,
): LiveGradeSummary {
  const buckets = { perfect: 0, oneMiss: 0, twoMiss: 0, threeMiss: 0, eliminated: 0 };
  let bestHitCount = 0;
  let bestMaxPossible = 0;
  let aliveCount = 0;
  let eliminatedCount = 0;

  for (const g of grades) {
    if (g.hitCount > bestHitCount) bestHitCount = g.hitCount;
    if (g.maxPossible > bestMaxPossible) bestMaxPossible = g.maxPossible;

    if (g.isAlive) {
      aliveCount++;
      if (g.missCount === 0) buckets.perfect++;
      else if (g.missCount === 1) buckets.oneMiss++;
      else if (g.missCount === 2) buckets.twoMiss++;
      else if (g.missCount === 3) buckets.threeMiss++;
    } else {
      eliminatedCount++;
      buckets.eliminated++;
    }
  }

  return {
    totalCoupons: grades.length,
    aliveCount,
    eliminatedCount,
    bestHitCount,
    bestMaxPossible,
    finishedMatchCount,
    pendingMatchCount,
    buckets,
  };
}
