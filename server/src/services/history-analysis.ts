import {
  HistoricalProgram,
  HistoryAnalysis,
  DistributionStats,
} from '../scraper/history-types';

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(nums: number[], avg: number): number {
  if (nums.length < 2) return 0;
  const variance =
    nums.reduce((sum, n) => sum + (n - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function computeStats(values: number[]): DistributionStats {
  if (values.length === 0) {
    return { avg: 0, min: 0, max: 0, median: 0, stdDev: 0 };
  }
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    avg: Math.round(avg * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
    median: median(values),
    stdDev: Math.round(stdDev(values, avg) * 100) / 100,
  };
}

export function analyzeHistory(
  programs: HistoricalProgram[],
): HistoryAnalysis {
  const home = programs.map((p) => p.distribution.count1);
  const draw = programs.map((p) => p.distribution.countX);
  const away = programs.map((p) => p.distribution.count2);
  const consecutive = programs.map((p) => p.maxConsecutive);

  const homeStats = computeStats(home);
  const drawStats = computeStats(draw);
  const awayStats = computeStats(away);
  const consStats = computeStats(consecutive);

  // Suggested filters: mean +/- 1 std dev, clamped to observed range
  const suggestRange = (stats: DistributionStats) => ({
    min: Math.max(stats.min, Math.floor(stats.avg - stats.stdDev)),
    max: Math.min(stats.max, Math.ceil(stats.avg + stats.stdDev)),
  });

  const homeRange = suggestRange(homeStats);
  const drawRange = suggestRange(drawStats);
  const awayRange = suggestRange(awayStats);

  const sorted = [...programs].sort((a, b) => b.programNo - a.programNo);

  return {
    programCount: programs.length,
    analyzedFrom: sorted.length > 0 ? sorted[sorted.length - 1].startDate : '',
    analyzedTo: sorted.length > 0 ? sorted[0].startDate : '',
    distribution: {
      home: homeStats,
      draw: drawStats,
      away: awayStats,
    },
    consecutiveStats: {
      avgMax: consStats.avg,
      minMax: consStats.min,
      maxMax: consStats.max,
      medianMax: consStats.median,
    },
    suggestedFilters: {
      min1: homeRange.min,
      max1: homeRange.max,
      minX: drawRange.min,
      maxX: drawRange.max,
      min2: awayRange.min,
      max2: awayRange.max,
      maxConsecutive: Math.ceil(consStats.median),
    },
    programs: sorted,
  };
}
