import { SportTotoMatch, Outcome, Selections } from '../lib/types';
import MatchRow from './MatchRow';

interface MatchListProps {
  matches: SportTotoMatch[];
  selections: Selections;
  onToggle: (matchNumber: number, outcome: Outcome) => void;
  onOpenDetails: (match: SportTotoMatch) => void;
}

export default function MatchList({ matches, selections, onToggle, onOpenDetails }: MatchListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-800 text-gray-300 text-xs sm:text-sm">
            <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">No</th>
            <th className="px-2 sm:px-3 py-3 text-left w-32 hidden sm:table-cell">Tarih</th>
            <th className="px-2 sm:px-3 py-3 text-center">Karsilasma</th>
            <th className="px-2 sm:px-3 py-3 text-center w-28 sm:w-40">Tahmin</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <MatchRow
              key={match.matchNumber}
              match={match}
              selected={selections.get(match.matchNumber) || []}
              onToggle={(outcome) => onToggle(match.matchNumber, outcome)}
              onOpenDetails={() => onOpenDetails(match)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
