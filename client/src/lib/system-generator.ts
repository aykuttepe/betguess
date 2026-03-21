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
  formulaKapali: number,
  formulaCifte: number,
  couponCount: number
): { valid: boolean; error?: string } {
  if (distributions.length !== 15) return { valid: false, error: 'Maç sayısı 15 olmalıdır.' };

  let totalKapali = 0;
  let totalCifte = 0;

  for (const match of distributions) {
    let matchTotal = 0;
    for (const [outcome, count] of Object.entries(match.counts)) {
      if (count < 0) return { valid: false, error: 'Negatif dağılım kullanılamaz.' };
      matchTotal += count;
      const t = getOutcomeType(outcome as SystemOutcome);
      if (t === 'kapali') totalKapali += count;
      if (t === 'cifte') totalCifte += count;
    }

    if (matchTotal !== couponCount) {
      return {
        valid: false,
        error: `Maç ${match.matchNumber} toplamı ${matchTotal}. Kupon sayısına (${couponCount}) eşit olmalıdır.`,
      };
    }
  }

  const expectedKapali = formulaKapali * couponCount;
  const expectedCifte = formulaCifte * couponCount;

  if (totalKapali !== expectedKapali) {
    return { valid: false, error: `Toplam Kapalı sayısı ${totalKapali}. Ancak hedeflenen ${expectedKapali} olmalıdır.` };
  }
  if (totalCifte !== expectedCifte) {
    return { valid: false, error: `Toplam Çifte sayısı ${totalCifte}. Ancak hedeflenen ${expectedCifte} olmalıdır.` };
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

export interface ComprehensiveMatchSelection {
  matchNumber: number;
  outcomes: string[];
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

// Generate the N coupons fulfilling the distribution using a matrix column-shuffle + row-balancing algorithm
export function generateSystemCoupons(
  distributions: SystemMatchDistribution[],
  formulaKapali: number,
  formulaCifte: number,
  couponCount: number,
  formulaPrice: number
): SystemKupon[] {
  // Validate first just in case
  const val = validateSystemDistribution(distributions, formulaKapali, formulaCifte, couponCount);
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

  // 2. Balance Kapali
  let iterations = 0;
  while (true) {
    iterations++;
    if (iterations > 10000) throw new Error("Makine dengelemeyi sağlayamadı, sonsuz döngü koruması aktif.");

    let rowA = -1; // Has too many kapali
    let rowB = -1; // Has too few kapali

    for (let c = 0; c < couponCount; c++) {
      let count = matrix[c].filter((cell) => cell.type === 'kapali').length;
      if (count > formulaKapali) rowA = c;
      else if (count < formulaKapali) rowB = c;
    }

    if (rowA === -1 && rowB === -1) break; // Balanced Kapali!

    // Find a column where rowA has kapali and rowB does NOT have kapali (so swapping improves/moves one kapali from A to B)
    let swapped = false;
    for (let m = 0; m < distributions.length; m++) {
      if (matrix[rowA][m].type === 'kapali' && matrix[rowB][m].type !== 'kapali') {
        const temp = matrix[rowA][m];
        matrix[rowA][m] = matrix[rowB][m];
        matrix[rowB][m] = temp;
        swapped = true;
        break;
      }
    }
    
    if (!swapped) {
      // Very rare path: unable to make direct swap. Can do a multi-way swap, but randomness usually avoids traps.
      // Easiest "jolt" is randomly swap two items in a column that don't change row counts just to shuffle the board state.
      const m = Math.floor(Math.random() * distributions.length);
      const randR = Math.floor(Math.random() * couponCount);
      const temp = matrix[rowA][m];
      matrix[rowA][m] = matrix[randR][m];
      matrix[randR][m] = temp;
    }
  }

  // 3. Balance Cifte (making sure not to touch kapali)
  iterations = 0;
  while (true) {
    iterations++;
    if (iterations > 10000) throw new Error("Makine çifte dengelemesini sağlayamadı, koruma aktif.");

    let rowA = -1; // Has too many cifte
    let rowB = -1; // Has too few cifte

    for (let c = 0; c < couponCount; c++) {
      let count = matrix[c].filter((cell) => cell.type === 'cifte').length;
      if (count > formulaCifte) rowA = c;
      else if (count < formulaCifte) rowB = c;
    }

    if (rowA === -1 && rowB === -1) break; // Balanced Cifte!

    let swapped = false;
    for (let m = 0; m < distributions.length; m++) {
      // Row A gives a 'cifte', Row B gives a 'tek'
      if (matrix[rowA][m].type === 'cifte' && matrix[rowB][m].type === 'tek') {
        const temp = matrix[rowA][m];
        matrix[rowA][m] = matrix[rowB][m];
        matrix[rowB][m] = temp;
        swapped = true;
        break;
      }
    }

    if (!swapped) {
       const m = Math.floor(Math.random() * distributions.length);
       const randR = Math.floor(Math.random() * couponCount);
       // Only swap if we don't accidentally touch a 'kapali' in row A or randR
       if (matrix[rowA][m].type !== 'kapali' && matrix[randR][m].type !== 'kapali') {
          const temp = matrix[rowA][m];
          matrix[rowA][m] = matrix[randR][m];
          matrix[randR][m] = temp;
       }
    }
  }

  // 4. Matrix is now perfectly balanced. Map to SystemKupon array.
  return matrix.map((row) => {
    const selections: Record<number, string[]> = {}; // Map matchNumber to selections
    
    row.forEach((cell, idx) => {
      const matchNumber = distributions[idx].matchNumber;
      // Convert '1X' -> ['1', 'X'], '1X2' -> ['1', 'X', '2']
      const slcStr = cell.outcome;
      const slcArr: string[] = [];
      if (slcStr.includes('1')) slcArr.push('1');
      if (slcStr.includes('X')) slcArr.push('X');
      if (slcStr.includes('2')) slcArr.push('2');
      selections[matchNumber] = slcArr;
    });

    return {
      id: Math.random().toString(36).substring(2, 10),
      price: formulaPrice,
      selections,
    };
  });
}
