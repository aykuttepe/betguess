import { DEFAULT_FILTERS, Kolon, KolonFilters, Outcome, SequenceFilter, SequenceFilters } from './types';

const MAX_KOLON_COUNT = 500000;

export interface KolonInput {
  matchNumber: number;
  outcomes: Outcome[];
}

export function calculateKolonCount(inputs: readonly KolonInput[]): number {
  if (inputs.length === 0) {
    return 0;
  }

  if (inputs.some((input) => input.outcomes.length === 0)) {
    return 0;
  }

  return inputs.reduce((product, input) => product * input.outcomes.length, 1);
}

export function generateKolonlar(inputs: readonly KolonInput[]): Kolon[] {
  if (inputs.length === 0) {
    return [];
  }

  if (inputs.some((input) => input.outcomes.length === 0)) {
    throw new Error('Her mac icin en az bir secim yapilmalidir.');
  }

  const totalKolonCount = calculateKolonCount(inputs);

  if (totalKolonCount > MAX_KOLON_COUNT) {
    throw new Error(`Cok fazla kolon olusuyor (${totalKolonCount.toLocaleString('tr-TR')}). Lutfen secimleri daraltin.`);
  }

  const kolonlar: Kolon[] = [];
  const current = new Array<Outcome>(inputs.length);

  const buildKolon = (inputIndex: number) => {
    if (inputIndex === inputs.length) {
      kolonlar.push({
        id: kolonlar.length + 1,
        predictions: [...current],
      });
      return;
    }

    for (const outcome of inputs[inputIndex].outcomes) {
      current[inputIndex] = outcome;
      buildKolon(inputIndex + 1);
    }
  };

  buildKolon(0);
  return kolonlar;
}

function checkConsecutive(predictions: readonly Outcome[], maxConsecutive: number): boolean {
  if (maxConsecutive <= 0 || predictions.length < 2) {
    return true;
  }

  let streak = 1;

  for (let index = 1; index < predictions.length; index += 1) {
    if (predictions[index] === predictions[index - 1]) {
      streak += 1;
      if (streak > maxConsecutive) {
        return false;
      }
    } else {
      streak = 1;
    }
  }

  return true;
}

function checkDistribution(predictions: readonly Outcome[], filters: KolonFilters): boolean {
  let ones = 0;
  let draws = 0;
  let twos = 0;

  for (const prediction of predictions) {
    if (prediction === '1') {
      ones += 1;
    } else if (prediction === 'X') {
      draws += 1;
    } else {
      twos += 1;
    }
  }

  return (
    ones >= filters.min1 &&
    ones <= filters.max1 &&
    draws >= filters.minX &&
    draws <= filters.maxX &&
    twos >= filters.min2 &&
    twos <= filters.max2
  );
}

function cloneKolon(kolon: Kolon): Kolon {
  return {
    id: kolon.id,
    predictions: [...kolon.predictions],
  };
}

function renumberKolonlar(kolonlar: readonly Kolon[]): Kolon[] {
  return kolonlar.map((kolon, index) => ({
    id: index + 1,
    predictions: [...kolon.predictions],
  }));
}

function normalizeSequenceFilters(filters: SequenceFilters): SequenceFilter[] {
  return Object.entries(filters)
    .map(([matchNumber, outcomes]) => ({
      matchNumber: Number(matchNumber),
      outcomes,
    }))
    .filter((filter) => Number.isInteger(filter.matchNumber) && filter.matchNumber > 0 && filter.outcomes.length > 0)
    .sort((left, right) => left.matchNumber - right.matchNumber);
}

export function shuffleKolonlar(kolonlar: readonly Kolon[]): Kolon[] {
  const shuffled = kolonlar.map(cloneKolon);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return renumberKolonlar(shuffled);
}

export function applySequenceFilter(kolonlar: readonly Kolon[], filter: SequenceFilter): Kolon[] {
  const selectedOutcomes = new Set(filter.outcomes);
  const matchIndex = filter.matchNumber - 1;

  if (matchIndex < 0 || selectedOutcomes.size === 0) {
    return renumberKolonlar(kolonlar);
  }

  let previousKeptOutcome: Outcome | null = null;
  const filtered: Kolon[] = [];

  for (const kolon of kolonlar) {
    const currentOutcome = kolon.predictions[matchIndex];

    if (
      currentOutcome &&
      selectedOutcomes.has(currentOutcome) &&
      previousKeptOutcome === currentOutcome
    ) {
      continue;
    }

    filtered.push(kolon);
    previousKeptOutcome = currentOutcome ?? null;
  }

  return renumberKolonlar(filtered);
}

export function applySequenceFilters(kolonlar: readonly Kolon[], filters: SequenceFilters): Kolon[] {
  return normalizeSequenceFilters(filters).reduce(
    (currentKolonlar, filter) => applySequenceFilter(currentKolonlar, filter),
    renumberKolonlar(kolonlar),
  );
}

export function applyFilters(kolonlar: readonly Kolon[], filters: KolonFilters): Kolon[] {
  const filtered = kolonlar.filter((kolon) => (
    checkConsecutive(kolon.predictions, filters.maxConsecutive) &&
    checkDistribution(kolon.predictions, filters)
  ));

  return renumberKolonlar(filtered);
}

export function isFilterActive(filters: KolonFilters): boolean {
  return (
    filters.maxConsecutive !== DEFAULT_FILTERS.maxConsecutive ||
    filters.min1 !== DEFAULT_FILTERS.min1 ||
    filters.max1 !== DEFAULT_FILTERS.max1 ||
    filters.minX !== DEFAULT_FILTERS.minX ||
    filters.maxX !== DEFAULT_FILTERS.maxX ||
    filters.min2 !== DEFAULT_FILTERS.min2 ||
    filters.max2 !== DEFAULT_FILTERS.max2
  );
}

export function exportToTxt(kolonlar: readonly Kolon[]): string {
  return kolonlar.map((kolon) => kolon.predictions.join('')).join('\n').trim();
}