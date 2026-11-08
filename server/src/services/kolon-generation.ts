type Outcome = '1' | 'X' | '2';
interface KolonInput { matchNumber: number; outcomes: Outcome[]; }
export interface Kolon { id: number; predictions: Outcome[]; }
export class KolonInputError extends Error {}
// Technical ceiling for every tier, admins and trial mode included.
export const MAX_KOLON_COUNT = 500000;

export function validateKolonInputs(value: unknown, maxCount: number): KolonInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 15) {
    throw new KolonInputError('1-15 mac secilmelidir.');
  }
  const seen = new Set<number>();
  let count = 1;
  for (const input of value) {
    if (!input || !Number.isSafeInteger(input.matchNumber) || input.matchNumber < 1 || input.matchNumber > 15 ||
        seen.has(input.matchNumber) || !Array.isArray(input.outcomes) || input.outcomes.length < 1 ||
        input.outcomes.length > 3 || new Set(input.outcomes).size !== input.outcomes.length ||
        !input.outcomes.every((outcome: unknown) => outcome === '1' || outcome === 'X' || outcome === '2')) {
      throw new KolonInputError('Gecersiz mac veya sonuc secimi.');
    }
    seen.add(input.matchNumber);
    count *= input.outcomes.length;
    if (count > maxCount) throw new KolonInputError(`En fazla ${maxCount} kolon uretilebilir.`);
  }
  return value;
}

export function generateKolons(inputs: readonly KolonInput[]): Kolon[] {
  const result: Kolon[] = [];
  const current: Outcome[] = [];
  const build = (index: number) => {
    if (index === inputs.length) {
      result.push({ id: result.length + 1, predictions: [...current] });
      return;
    }
    for (const outcome of inputs[index].outcomes) { current[index] = outcome; build(index + 1); }
  };
  build(0);
  return result;
}
