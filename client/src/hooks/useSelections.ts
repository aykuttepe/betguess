import { useState, useCallback, useMemo } from 'react';
import { Outcome, Selections } from '../lib/types';
import { KolonInput, calculateKolonCount } from '../lib/kolon-generator';

export function useSelections(matchCount: number) {
  const [selections, setSelections] = useState<Selections>(new Map());

  const toggleSelection = useCallback((matchNumber: number, outcome: Outcome) => {
    setSelections(prev => {
      const next = new Map(prev);
      const current = next.get(matchNumber) || [];

      if (current.includes(outcome)) {
        // Kaldir
        const filtered = current.filter(o => o !== outcome);
        if (filtered.length === 0) {
          next.delete(matchNumber);
        } else {
          next.set(matchNumber, filtered);
        }
      } else {
        // Ekle
        next.set(matchNumber, [...current, outcome]);
      }

      return next;
    });
  }, []);

  const resetSelections = useCallback(() => {
    setSelections(new Map());
  }, []);

  const setPopular = useCallback((popularPicks: Map<number, Outcome>) => {
    setSelections(prev => {
      const next = new Map(prev);
      popularPicks.forEach((outcome, matchNumber) => {
        next.set(matchNumber, [outcome]);
      });
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const next = new Map<number, Outcome[]>();
    for (let i = 1; i <= matchCount; i++) {
      next.set(i, ['1', 'X', '2']);
    }
    setSelections(next);
  }, [matchCount]);

  const kolonInputs: KolonInput[] = useMemo(() => {
    return Array.from({ length: matchCount }, (_, i) => {
      const matchNumber = i + 1;
      return {
        matchNumber,
        outcomes: selections.get(matchNumber) || [],
      };
    });
  }, [selections, matchCount]);

  const allSelected = useMemo(() => {
    for (let i = 1; i <= matchCount; i++) {
      if (!selections.has(i) || selections.get(i)!.length === 0) {
        return false;
      }
    }
    return matchCount > 0;
  }, [selections, matchCount]);

  const kolonCount = useMemo(() => {
    if (!allSelected) return 0;
    return calculateKolonCount(kolonInputs);
  }, [kolonInputs, allSelected]);

  return {
    selections,
    toggleSelection,
    resetSelections,
    setPopular,
    selectAll,
    kolonInputs,
    allSelected,
    kolonCount,
  };
}
