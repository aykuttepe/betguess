import { useLiveTracking } from '../hooks/useLiveTracking';

export default function SonuclarPage() {
  const { liveProgram, loading, error, refetch } = useLiveTracking(true);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="toto-match-container">
        {loading && !liveProgram && (
          <div className="text-center py-12 text-gray-400">
            <div className="inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p>Mac verileri yukleniyor...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 m-4">
            {error}
          </div>
        )}

        {liveProgram && (
          <>
            <div className="toto-match-header">
              <div>
                <h2 className="toto-match-title">Spor Toto Program {liveProgram.programNo}</h2>
                <p className="toto-match-sub">
                  {liveProgram.finishedCount} tamamlandi &middot; {liveProgram.inProgressCount} devam ediyor &middot; {liveProgram.notStartedCount} bekleniyor
                </p>
              </div>
              <button onClick={refetch} disabled={loading} className="live-dashboard-refresh">
                {loading ? '...' : 'Yenile'}
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ padding: '0 1.25rem' }}>
              <div className="live-progress-bar" style={{ marginBottom: '0' }}>
                <div
                  className="live-progress-fill"
                  style={{ width: `${Math.round((liveProgram.finishedCount / liveProgram.totalMatches) * 100)}%` }}
                />
              </div>
            </div>

            <div className="toto-match-list">
              {liveProgram.matches.map((m) => (
                <div key={m.matchNo} className={`toto-match-row toto-match-${m.status}`}>
                  <span className="toto-match-no">{m.matchNo}</span>
                  <span className="toto-match-teams">{m.homeTeam} — {m.awayTeam}</span>
                  <span className="toto-match-score">
                    {m.score || '-'}
                  </span>
                  <span className="toto-match-result">
                    {m.result ? (
                      <span className={`toto-result-badge toto-result-${m.result === '1' ? 'home' : m.result === 'X' ? 'draw' : 'away'}`}>
                        {m.result}
                      </span>
                    ) : (
                      <span className="toto-result-badge toto-result-none">-</span>
                    )}
                  </span>
                  <span className={`toto-status-badge toto-status-${m.status}`}>
                    {m.status === 'finished' ? 'Tamamlandi' : m.status === 'in_progress' ? 'Devam Ediyor' : 'Bekleniyor'}
                  </span>
                </div>
              ))}
            </div>

            <div className="toto-match-footer">
              Son guncelleme: {new Date(liveProgram.fetchedAt).toLocaleString('tr-TR')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
