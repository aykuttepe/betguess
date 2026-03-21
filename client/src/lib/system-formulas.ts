export interface SystemFormula {
  id: string;
  kapaliCount: number;
  cifteCount: number;
  price: number;
}

// Calculate price: Base is 10 TL. Each Kapali is *3 permutations, each Cifte is *2 permutations.
export function calculateFormulaPrice(kapaliCount: number, cifteCount: number): number {
  return 10 * Math.pow(3, kapaliCount) * Math.pow(2, cifteCount);
}

// Fixed list of common formulas to display in the grid
export const SYSTEM_FORMULAS: SystemFormula[] = [];

for (let k = 0; k <= 7; k++) {
  // Max limits to keep UI somewhat manageable, or match the screenshot
  const maxCifte = k === 0 || k === 1 ? 9 : k <= 3 ? 8 : k <= 5 ? 3 : 1; 
  for (let c = 0; c <= maxCifte; c++) {
    SYSTEM_FORMULAS.push({
      id: `${k}K_${c}C`,
      kapaliCount: k,
      cifteCount: c,
      price: calculateFormulaPrice(k, c),
    });
  }
}

export const COUPON_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
