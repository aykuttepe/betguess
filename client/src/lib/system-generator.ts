// Removed unused imports

export type SystemOutcome = '1' | 'X' | '2' | '1X' | '12' | 'X2' | '1X2';
export type OutcomeType = 'tek' | 'cifte' | 'kapali';

export interface SystemMatchDistribution {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  counts: Record<SystemOutcome, number>;
}

export function getOutcomeType(outcome: SystemOutcome): OutcomeType {
  if (outcome === '1X2') return 'kapali';
  if (outcome === '1X' || outcome === '12' || outcome === 'X2') return 'cifte';
  return 'tek';
}

export function validateSystemDistribution(
  distributions: SystemMatchDistribution[],
  couponCount: number
): { valid: boolean; error?: string } {
  if (distributions.length !== 15) return { valid: false, error: 'Maç sayısı 15 olmalıdır.' };
  if (!Number.isFinite(couponCount) || couponCount <= 0) {
    return { valid: false, error: 'Kupon sayisi sifirdan buyuk olmalidir.' };
  }

  for (const match of distributions) {
    let matchTotal = 0;
    for (const count of Object.values(match.counts)) {
      if (!Number.isFinite(count) || count < 0) return { valid: false, error: 'Negatif dağılım kullanılamaz.' };
      matchTotal += count;
    }

    if (matchTotal !== couponCount) {
      return {
        valid: false,
        error: `Maç ${match.matchNumber} toplamı ${matchTotal}. Kupon sayısına (${couponCount}) eşit olmalıdır.`,
      };
    }
  }

  return { valid: true };
}

interface Cell {
  outcome: SystemOutcome;
  type: OutcomeType;
}

export interface SystemKupon {
  id: string;
  price: number;
  selections: Record<number, string[]>;
}

export interface GenerateSystemCouponsOptions {
  expandToKolons?: boolean;
}

export interface ComprehensiveMatchSelection {
  matchNumber: number;
  outcomes: string[];
}

function outcomeToSelections(outcome: SystemOutcome): string[] {
  const selections: string[] = [];
  if (outcome.includes('1')) selections.push('1');
  if (outcome.includes('X')) selections.push('X');
  if (outcome.includes('2')) selections.push('2');
  return selections;
}

function calculateDistributedCouponPrice(row: Cell[]): number {
  return row.reduce((price, cell) => price * outcomeToSelections(cell.outcome).length, 10);
}

function calculateExpandedKolonCount(row: Cell[]): number {
  return row.reduce((total, cell) => total * outcomeToSelections(cell.outcome).length, 1);
}

function appendExpandedKolons(
  output: SystemKupon[],
  row: Cell[],
  distributions: SystemMatchDistribution[],
): void {
  const selections: Record<number, string[]> = {};

  const buildKolon = (matchIndex: number) => {
    if (matchIndex === row.length) {
      output.push({
        id: String(output.length + 1),
        price: 10,
        selections: { ...selections },
      });
      return;
    }

    const matchNumber = distributions[matchIndex].matchNumber;
    for (const outcome of outcomeToSelections(row[matchIndex].outcome)) {
      selections[matchNumber] = [outcome];
      buildKolon(matchIndex + 1);
    }
  };

  buildKolon(0);
}

const SINGLE_OUTCOMES = ['1', 'X', '2'] as const;
const DOUBLE_OUTCOME_PAIRS: string[][] = [
  ['1', 'X'],
  ['1', '2'],
  ['X', '2'],
];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  const pool = [...items];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

function normalizeSelection(outcomes: string[]): string[] {
  const normalized = Array.from(new Set(outcomes.filter((item): item is typeof SINGLE_OUTCOMES[number] => {
    return item === '1' || item === 'X' || item === '2';
  })));

  normalized.sort((left, right) => {
    return SINGLE_OUTCOMES.indexOf(left) - SINGLE_OUTCOMES.indexOf(right);
  });

  return normalized;
}

function createCouponSignature(selections: Record<number, string[]>): string {
  return Object.entries(selections)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([matchNumber, outcomes]) => `${matchNumber}:${normalizeSelection(outcomes).join('')}`)
    .join('|');
}

function pickRandomSingle(outcomes: string[]): string[] {
  return [outcomes[randomInt(outcomes.length)]];
}

function pickRandomDouble(outcomes: string[]): string[] {
  if (outcomes.length === 2) {
    return [...outcomes];
  }

  const candidatePairs = DOUBLE_OUTCOME_PAIRS.filter((pair) => pair.every((item) => outcomes.includes(item)));
  return [...candidatePairs[randomInt(candidatePairs.length)]];
}

function getSingleOptionCount(outcomes: string[]): bigint {
  return BigInt(outcomes.length);
}

function getDoubleOptionCount(outcomes: string[]): bigint {
  if (outcomes.length < 2) {
    return 0n;
  }

  if (outcomes.length === 2) {
    return 1n;
  }

  return 3n;
}

function createCapacityKey(kapaliCount: number, cifteCount: number): string {
  return `${kapaliCount}:${cifteCount}`;
}

export function calculateComprehensiveFormulaCapacity(
  wideSelections: ComprehensiveMatchSelection[],
  formulaKapali: number,
  formulaCifte: number,
): bigint {
  if (wideSelections.length !== 15) {
    return 0n;
  }

  if (formulaKapali < 0 || formulaCifte < 0 || formulaKapali + formulaCifte > 15) {
    return 0n;
  }

  const normalizedMatches = wideSelections.map((match) => normalizeSelection(match.outcomes));
  if (normalizedMatches.some((outcomes) => outcomes.length === 0)) {
    return 0n;
  }

  let dp = new Map<string, bigint>();
  dp.set(createCapacityKey(0, 0), 1n);

  for (const outcomes of normalizedMatches) {
    const next = new Map<string, bigint>();

    for (const [key, ways] of dp.entries()) {
      const [kapaliUsed, cifteUsed] = key.split(':').map(Number);

      const singleWays = getSingleOptionCount(outcomes);
      const singleKey = createCapacityKey(kapaliUsed, cifteUsed);
      next.set(singleKey, (next.get(singleKey) ?? 0n) + ways * singleWays);

      if (outcomes.length >= 2 && cifteUsed + 1 <= formulaCifte) {
        const doubleKey = createCapacityKey(kapaliUsed, cifteUsed + 1);
        next.set(doubleKey, (next.get(doubleKey) ?? 0n) + ways * getDoubleOptionCount(outcomes));
      }

      if (outcomes.length === 3 && kapaliUsed + 1 <= formulaKapali) {
        const kapaliKey = createCapacityKey(kapaliUsed + 1, cifteUsed);
        next.set(kapaliKey, (next.get(kapaliKey) ?? 0n) + ways);
      }
    }

    dp = next;
  }

  return dp.get(createCapacityKey(formulaKapali, formulaCifte)) ?? 0n;
}

export function generateComprehensiveFormulaCoupons(
  wideSelections: ComprehensiveMatchSelection[],
  formulaKapali: number,
  formulaCifte: number,
  couponCount: number,
  formulaPrice: number,
): SystemKupon[] {
  if (wideSelections.length !== 15) {
    throw new Error('Genis kupon 15 mac icermelidir.');
  }

  if (couponCount <= 0) {
    throw new Error('Kupon sayisi sifirdan buyuk olmalidir.');
  }

  const normalizedMatches = wideSelections.map((match) => ({
    matchNumber: match.matchNumber,
    outcomes: normalizeSelection(match.outcomes),
  }));

  const emptyMatch = normalizedMatches.find((match) => match.outcomes.length === 0);
  if (emptyMatch) {
    throw new Error(`Mac ${emptyMatch.matchNumber} icin en az bir secim yapmalisiniz.`);
  }

  const kapaliCandidates = normalizedMatches.filter((match) => match.outcomes.length === 3);
  const cifteCandidates = normalizedMatches.filter((match) => match.outcomes.length >= 2);

  if (formulaKapali > kapaliCandidates.length) {
    throw new Error(`Bu genis kupondan en fazla ${kapaliCandidates.length} kapali secilebilir.`);
  }

  if (formulaKapali + formulaCifte > cifteCandidates.length) {
    throw new Error(
      `Bu genis kupondan secilen formulle en fazla ${cifteCandidates.length - formulaKapali} cifte uretebilirsiniz.`,
    );
  }

  const capacity = calculateComprehensiveFormulaCapacity(
    wideSelections,
    formulaKapali,
    formulaCifte,
  );

  if (capacity < BigInt(couponCount)) {
    throw new Error(
      `Istenen ${couponCount} farkli kupon uretilemedi. Mevcut genis kupon ile en fazla ${capacity.toString()} farkli kupon bulundu.`,
    );
  }

  const generated = new Map<string, SystemKupon>();
  const maxAttempts = Math.max(couponCount * 80, 400);

  for (let attempt = 0; attempt < maxAttempts && generated.size < couponCount; attempt++) {
    const chosenKapali = new Set(
      pickRandomItems(
        kapaliCandidates.map((match) => match.matchNumber),
        formulaKapali,
      ),
    );

    const remainingDoubleCandidates = normalizedMatches
      .filter((match) => match.outcomes.length >= 2 && !chosenKapali.has(match.matchNumber))
      .map((match) => match.matchNumber);

    const chosenCifte = new Set(pickRandomItems(remainingDoubleCandidates, formulaCifte));
    const selections: Record<number, string[]> = {};

    for (const match of normalizedMatches) {
      if (chosenKapali.has(match.matchNumber)) {
        selections[match.matchNumber] = [...match.outcomes];
        continue;
      }

      if (chosenCifte.has(match.matchNumber)) {
        selections[match.matchNumber] = pickRandomDouble(match.outcomes);
        continue;
      }

      selections[match.matchNumber] = pickRandomSingle(match.outcomes);
    }

    const signature = createCouponSignature(selections);
    if (generated.has(signature)) {
      continue;
    }

    generated.set(signature, {
      id: Math.random().toString(36).substring(2, 10),
      price: formulaPrice,
      selections,
    });
  }

  if (generated.size < couponCount) {
    throw new Error(
      `Istenen ${couponCount} farkli kupon uretilemedi. Mevcut genis kupon ile en fazla ${generated.size} farkli kupon bulundu.`,
    );
  }

  return Array.from(generated.values());
}

// Generate the N coupons by shuffling each match distribution independently.
export function generateSystemCoupons(
  distributions: SystemMatchDistribution[],
  couponCount: number,
  options: GenerateSystemCouponsOptions = {},
): SystemKupon[] {
  // Validate first just in case
  const val = validateSystemDistribution(distributions, couponCount);
  if (!val.valid) throw new Error(val.error);

  // 1. Build initial columns
  // matrix is [couponIndex][matchIndex]
  const matrix: Cell[][] = Array.from({ length: couponCount }, () => []);

  for (let m = 0; m < distributions.length; m++) {
    const dist = distributions[m];
    const columnOutcomes: SystemOutcome[] = [];

    // Flatten the counts into an array of exactly `couponCount` elements
    for (const [outcomeStr, count] of Object.entries(dist.counts)) {
      const outcome = outcomeStr as SystemOutcome;
      for (let i = 0; i < (count as number); i++) {
        columnOutcomes.push(outcome);
      }
    }

    // Shuffle column elements randomly
    for (let i = columnOutcomes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [columnOutcomes[i], columnOutcomes[j]] = [columnOutcomes[j], columnOutcomes[i]];
    }

    // Assign to matrix
    for (let c = 0; c < couponCount; c++) {
      matrix[c][m] = {
        outcome: columnOutcomes[c],
        type: getOutcomeType(columnOutcomes[c]),
      };
    }
  }

  if (options.expandToKolons) {
    const maxKolonCount = 500000;
    const totalExpandedCount = matrix.reduce((total, row) => total + calculateExpandedKolonCount(row), 0);

    if (totalExpandedCount > maxKolonCount) {
      throw new Error(
        `Cok fazla kolon olusuyor (${totalExpandedCount.toLocaleString('tr-TR')}). Lutfen dagilimi daraltin.`,
      );
    }

    const expandedKolons: SystemKupon[] = [];
    matrix.forEach((row) => appendExpandedKolons(expandedKolons, row, distributions));
    return expandedKolons;
  }

  // 2. Map the shuffled matrix to SystemKupon array.
  return matrix.map((row) => {
    const selections: Record<number, string[]> = {}; // Map matchNumber to selections
    
    row.forEach((cell, idx) => {
      const matchNumber = distributions[idx].matchNumber;
      selections[matchNumber] = outcomeToSelections(cell.outcome);
    });

    return {
      id: Math.random().toString(36).substring(2, 10),
      price: calculateDistributedCouponPrice(row),
      selections,
    };
  });
}
