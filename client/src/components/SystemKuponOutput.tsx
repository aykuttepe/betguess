import { useState } from 'react';
import { SystemKupon } from '../lib/system-generator';
import { SportTotoMatch } from '../lib/types';

export default function SystemKuponOutput({
  kuponlar,
  matches,
  weekLabel
}: {
  kuponlar: SystemKupon[];
  matches: SportTotoMatch[];
  weekLabel: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!kuponlar || kuponlar.length === 0) return null;

  const totalPrice = kuponlar.reduce((sum, k) => sum + k.price, 0);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 mt-6">
      <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Sistem Kuponları Üretildi
          </h2>
          <p className="text-sm text-gray-400 mt-1">{weekLabel} - Üretilen Kupon: {kuponlar.length}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-emerald-400 font-medium tracking-wider mb-1">TOPLAM TUTAR</div>
          <div className="text-2xl font-bold text-emerald-400">{totalPrice.toLocaleString('tr-TR')} ₺</div>
        </div>
      </div>

      <div className="space-y-3">
        {kuponlar.map((kupon, idx) => {
          const isExpanded = expanded === kupon.id;
          return (
            <div key={kupon.id} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/50">
              <button
                onClick={() => setExpanded(isExpanded ? null : kupon.id)}
                className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <div className="text-left">
                    <div className="text-gray-200 font-medium">Formül Kuponu</div>
                    <div className="text-xs text-gray-500">ID: #{kupon.id.toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-emerald-400 font-medium">{kupon.price.toLocaleString('tr-TR')} ₺</div>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isExpanded && (
                <div className="p-4 border-t border-gray-700 bg-gray-900/80">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {matches.map(match => {
                      const sel = kupon.selections[match.matchNumber] || [];
                      return (
                        <div key={match.matchNumber} className="flex flex-col bg-gray-800 border border-gray-700 rounded p-2 text-sm">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{match.matchNumber}. Maç</span>
                          </div>
                          <div className="flex justify-between text-gray-300">
                            <span className="truncate max-w-[40%] text-right">{match.homeTeam}</span>
                            <span className="text-gray-500">-</span>
                            <span className="truncate max-w-[40%] text-left">{match.awayTeam}</span>
                          </div>
                          <div className="flex justify-center gap-2 mt-2">
                            {['1', 'X', '2'].map(o => (
                              <div
                                key={o}
                                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                  sel.includes(o)
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-700 text-gray-400'
                                }`}
                              >
                                {o}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
