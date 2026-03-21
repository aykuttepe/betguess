import { Outcome, SportTotoMatch } from '../lib/types';

interface MatchRowProps {
  match: SportTotoMatch;
  selected: Outcome[];
  onToggle: (outcome: Outcome) => void;
  onOpenDetails: () => void;
}

const outcomeLabels: { value: Outcome; label: string }[] = [
  { value: '1', label: '1' },
  { value: 'X', label: 'X' },
  { value: '2', label: '2' },
];

export default function MatchRow({ match, selected, onToggle, onOpenDetails }: MatchRowProps) {
  return (
    <tr
      className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors cursor-pointer"
      onClick={onOpenDetails}
      title="SofaScore detaylarini ac"
    >
      <td className="px-2 sm:px-3 py-2 text-center font-bold text-emerald-400 w-8 sm:w-10 text-xs sm:text-sm">
        {match.matchNumber}
      </td>
      <td className="px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-400 hidden sm:table-cell w-32">
        <div>{match.matchDate}</div>
        <div className="text-xs">{match.matchTime}</div>
      </td>
      <td className="px-2 sm:px-3 py-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-white font-medium flex-1 text-right text-xs sm:text-sm truncate">
            {match.homeTeam}
          </span>
          <span className="text-gray-500 text-xs">-</span>
          <span className="text-white font-medium flex-1 text-xs sm:text-sm truncate">
            {match.awayTeam}
          </span>
        </div>
      </td>
      <td className="px-2 sm:px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1 justify-center">
          {outcomeLabels.map(({ value, label }) => {
            const isSelected = selected.includes(value);
            const pref =
              value === '1'
                ? match.preferences.home
                : value === 'X'
                  ? match.preferences.draw
                  : match.preferences.away;

            return (
              <button
                key={value}
                onClick={() => onToggle(value)}
                className={`
                  w-10 h-8 sm:w-12 sm:h-10 rounded font-bold text-xs sm:text-sm transition-all
                  flex flex-col items-center justify-center
                  ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                <span>{label}</span>
                <span className="text-[9px] sm:text-[10px] font-normal opacity-70">
                  %{pref}
                </span>
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}
