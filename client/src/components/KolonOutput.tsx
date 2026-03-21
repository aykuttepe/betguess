import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Kolon, Outcome, SequenceFilters, SportTotoMatch } from '../lib/types';
import { exportToTxt } from '../lib/kolon-generator';

interface KolonOutputProps {
  kolonlar: Kolon[];
  matches: SportTotoMatch[];
  weekLabel: string;
  onImport?: (kolonlar: Kolon[]) => void;
  activeSequenceMatch: number | null;
  activeSequenceOutcomes: Outcome[];
  sequenceFilters: SequenceFilters;
  onActiveSequenceMatchChange: (matchNumber: number | null) => void;
  onSequenceOutcomesChange: (outcomes: Outcome[]) => void;
  onActiveSequenceFilterReset: () => void;
  onSequenceFilterRemove: (matchNumber: number) => void;
}

const OUTCOME_OPTIONS: Outcome[] = ['1', 'X', '2'];
const ROW_HEIGHT = 28;
const TABLE_MAX_HEIGHT = 600;

export default function KolonOutput({
  kolonlar,
  matches,
  weekLabel,
  onImport,
  activeSequenceMatch,
  activeSequenceOutcomes,
  sequenceFilters,
  onActiveSequenceMatchChange,
  onSequenceOutcomesChange,
  onActiveSequenceFilterReset,
  onSequenceFilterRemove,
}: KolonOutputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeFilterEntries = useMemo(() => (
    Object.entries(sequenceFilters)
      .map(([matchNumber, outcomes]) => ({
        matchNumber: Number(matchNumber),
        outcomes,
      }))
      .filter((entry) => entry.outcomes.length > 0)
      .sort((left, right) => left.matchNumber - right.matchNumber)
  ), [sequenceFilters]);

  const rowVirtualizer = useVirtualizer({
    count: kolonlar.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleTxtExport = () => {
    const txt = exportToTxt(kolonlar);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spor-toto-kolonlar.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);

      const imported: Kolon[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sanitizedLine = line.replace(/[\s,]/g, '').toUpperCase();

        if (sanitizedLine.length !== matches.length) {
          alert(`Hata: ${i + 1}. satir eksik veya hatali. Beklenen mac sayisi: ${matches.length}, Satirdaki tercih sayisi: ${sanitizedLine.length}`);
          return;
        }

        const invalidCharMatch = sanitizedLine.match(/[^1X2]/);
        if (invalidCharMatch) {
          alert(`Hata: ${i + 1}. satirda gecersiz karakter ('${invalidCharMatch[0]}'). Sadece 1, X, 2 kullanilmalidir.`);
          return;
        }

        imported.push({
          id: i + 1,
          predictions: sanitizedLine.split('') as Outcome[],
        });
      }

      onImport(imported);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onActiveSequenceMatchChange(value ? Number(value) : null);
  };

  const handleOutcomeToggle = (outcome: Outcome) => {
    const nextOutcomes = activeSequenceOutcomes.includes(outcome)
      ? activeSequenceOutcomes.filter((value) => value !== outcome)
      : [...activeSequenceOutcomes, outcome];

    onSequenceOutcomesChange(nextOutcomes);
  };

  const hasActiveSequenceFilter = activeSequenceMatch !== null && activeSequenceOutcomes.length > 0;

  if (kolonlar.length === 0 && !onImport) return null;

  const colCount = matches.length + 1; // +1 for kolon id column

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4 no-print flex-wrap gap-2">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          Kolonlar ({kolonlar.length.toLocaleString('tr-TR')} adet)
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {kolonlar.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">Tekrar filtresi</span>
                <select
                  value={activeSequenceMatch ?? ''}
                  onChange={handleMatchChange}
                  className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-200"
                >
                  <option value="">Mac sec</option>
                  {matches.map((match) => (
                    <option key={match.matchNumber} value={match.matchNumber}>
                      Mac {match.matchNumber}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  {OUTCOME_OPTIONS.map((outcome) => {
                    const active = activeSequenceOutcomes.includes(outcome);
                    return (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() => handleOutcomeToggle(outcome)}
                        disabled={activeSequenceMatch === null}
                        className={`min-w-8 rounded px-2 py-1 text-xs font-bold transition-colors ${active
                          ? outcome === '1'
                            ? 'bg-green-600 text-white'
                            : outcome === 'X'
                              ? 'bg-yellow-500 text-gray-900'
                              : 'bg-red-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500'
                          }`}
                      >
                        {outcome}
                      </button>
                    );
                  })}
                </div>
                {hasActiveSequenceFilter && (
                  <button
                    type="button"
                    onClick={onActiveSequenceFilterReset}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 transition-colors hover:bg-gray-600"
                  >
                    Temizle
                  </button>
                )}
              </div>
              {activeFilterEntries.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeFilterEntries.map((entry) => {
                    const isEditing = activeSequenceMatch === entry.matchNumber;
                    return (
                      <div
                        key={entry.matchNumber}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${isEditing
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                          : 'border-gray-600 bg-gray-900 text-gray-300'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => onActiveSequenceMatchChange(entry.matchNumber)}
                          className={`transition-colors ${isEditing ? 'text-emerald-200' : 'hover:text-white'}`}
                        >
                          M{entry.matchNumber}: {entry.outcomes.join(' ')}
                        </button>
                        <button
                          type="button"
                          aria-label={`Mac ${entry.matchNumber} filtresini kaldir`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSequenceFilterRemove(entry.matchNumber);
                          }}
                          className={`rounded-full px-1 leading-none transition-colors ${isEditing
                            ? 'text-emerald-200 hover:bg-emerald-400/20'
                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {onImport && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs sm:text-sm"
              >
                TXT Yukle
              </button>
            </>
          )}
          {kolonlar.length > 0 && (
            <>
              <button
                onClick={handleTxtExport}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs sm:text-sm"
              >
                TXT Indir
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs sm:text-sm"
              >
                Yazdir
              </button>
            </>
          )}
        </div>
      </div>

      {kolonlar.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
          <div className="text-center mb-3 text-gray-400 text-sm">{weekLabel}</div>

          {/* Sticky header */}
          <div className="font-mono text-xs sm:text-sm">
            <div
              className="flex text-gray-400 border-b border-gray-700"
              style={{ minWidth: `${colCount * 2}rem` }}
            >
              <div className="px-2 py-1 text-right w-16 shrink-0">Kolon</div>
              {matches.map((m) => (
                <div key={m.matchNumber} className="px-1 py-1 text-center w-8 shrink-0">
                  {m.matchNumber}
                </div>
              ))}
            </div>

            {/* Virtualized rows */}
            <div
              ref={scrollRef}
              className="overflow-y-auto"
              style={{ maxHeight: `${TABLE_MAX_HEIGHT}px` }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const kolon = kolonlar[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.index}
                      className="flex border-b border-gray-700/50 hover:bg-gray-700/30"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        minWidth: `${colCount * 2}rem`,
                      }}
                    >
                      <div className="px-2 py-1 text-right text-gray-500 w-16 shrink-0">
                        {kolon.id}
                      </div>
                      {kolon.predictions.map((pred, i) => (
                        <div
                          key={i}
                          className={`px-1 py-1 text-center font-bold w-8 shrink-0 ${pred === '1'
                            ? 'text-green-400'
                            : pred === 'X'
                              ? 'text-yellow-400'
                              : 'text-red-400'
                            }`}
                        >
                          {pred}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
