interface SelectionSummaryProps {
  matchCount: number;
  selectedCount: number;
  kolonCount: number;
  allSelected: boolean;
}

export default function SelectionSummary({
  matchCount,
  selectedCount,
  kolonCount,
  allSelected,
}: SelectionSummaryProps) {
  const cost = kolonCount * 10; // 10 TL per kolon (Guncel Nesine/Spor Toto fiyati)

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-6">
      <div>
        <span className="text-gray-400 text-sm">Secilen Mac</span>
        <div className="text-white font-bold text-lg">
          {selectedCount} / {matchCount}
        </div>
      </div>

      <div className="h-8 w-px bg-gray-700" />

      <div>
        <span className="text-gray-400 text-sm">Toplam Kolon</span>
        <div
          className={`font-bold text-lg ${
            kolonCount > 1000
              ? 'text-yellow-400'
              : kolonCount > 0
                ? 'text-emerald-400'
                : 'text-gray-500'
          }`}
        >
          {allSelected ? kolonCount.toLocaleString('tr-TR') : '-'}
        </div>
      </div>

      <div className="h-8 w-px bg-gray-700" />

      <div>
        <span className="text-gray-400 text-sm">Maliyet</span>
        <div className="text-white font-bold text-lg">
          {allSelected ? `${cost.toLocaleString('tr-TR')} TL` : '-'}
        </div>
      </div>

      {!allSelected && (
        <div className="ml-auto text-yellow-500 text-sm">
          Tum maclar icin en az bir tahmin secin
        </div>
      )}

    </div>
  );
}
