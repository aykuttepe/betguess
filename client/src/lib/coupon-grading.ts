import { CouponRow } from './coupons-api';
import { SystemKupon } from './system-generator';
import { HistoricalProgram } from './types';

export type CouponGrade = 12 | 13 | 14 | 15;

const PROGRAM_NO_REGEX = /spor\s+toto\s+(\d+)\./i;

export function parseProgramNoFromWeekLabel(weekLabel: string): number | null {
  const match = weekLabel.match(PROGRAM_NO_REGEX);
  if (!match) {
    return null;
  }

  const programNo = Number(match[1]);
  return Number.isFinite(programNo) ? programNo : null;
}

export function parseCouponData(data: string): SystemKupon[] {
  try {
    const parsed = JSON.parse(data) as SystemKupon[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getBestHitCount(
  kupons: SystemKupon[],
  program: HistoricalProgram | null | undefined,
): number | null {
  if (!program || kupons.length === 0) {
    return null;
  }

  let bestHitCount = 0;

  for (const kupon of kupons) {
    let hitCount = 0;

    for (const match of program.matches) {
      const selections = kupon.selections[match.matchNo];
      if (Array.isArray(selections) && selections.includes(match.result)) {
        hitCount += 1;
      }
    }

    if (hitCount > bestHitCount) {
      bestHitCount = hitCount;
    }
  }

  return bestHitCount;
}

export function getCouponGrade(bestHitCount: number | null): CouponGrade | null {
  if (bestHitCount === 15 || bestHitCount === 14 || bestHitCount === 13 || bestHitCount === 12) {
    return bestHitCount;
  }

  return null;
}

export interface KolonMatchDetail {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  result: string;
  score: string;
  selections: string[];
  isHit: boolean;
}

export interface KolonGrade {
  kolonId: string;
  hitCount: number;
  grade: CouponGrade | null;
  matchDetails: KolonMatchDetail[];
}

export function getKolonGrades(
  kupons: SystemKupon[],
  program: HistoricalProgram | null | undefined,
): KolonGrade[] {
  if (!program || kupons.length === 0) {
    return [];
  }

  return kupons.map((kupon) => {
    let hitCount = 0;
    const matchDetails: KolonMatchDetail[] = [];

    for (const match of program.matches) {
      const selections = kupon.selections[match.matchNo];
      const isHit = Array.isArray(selections) && selections.includes(match.result);
      if (isHit) hitCount += 1;

      matchDetails.push({
        matchNo: match.matchNo,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        result: match.result,
        score: match.score,
        selections: Array.isArray(selections) ? selections : [],
        isHit,
      });
    }

    return {
      kolonId: kupon.id,
      hitCount,
      grade: getCouponGrade(hitCount),
      matchDetails,
    };
  }).sort((a, b) => b.hitCount - a.hitCount);
}

export interface CouponInsight {
  coupon: CouponRow;
  parsedData: SystemKupon[];
  programNo: number | null;
  bestHitCount: number | null;
  grade: CouponGrade | null;
  hasCompletedProgram: boolean;
  kolonGrades: KolonGrade[];
}

export function buildCouponInsight(
  coupon: CouponRow,
  programsByNo: Map<number, HistoricalProgram>,
): CouponInsight {
  const parsedData = parseCouponData(coupon.data);
  const programNo = parseProgramNoFromWeekLabel(coupon.week);
  const program = programNo === null ? null : programsByNo.get(programNo) ?? null;
  const bestHitCount = getBestHitCount(parsedData, program);
  const kolonGrades = getKolonGrades(parsedData, program);

  return {
    coupon,
    parsedData,
    programNo,
    bestHitCount,
    grade: getCouponGrade(bestHitCount),
    hasCompletedProgram: program !== null,
    kolonGrades,
  };
}
