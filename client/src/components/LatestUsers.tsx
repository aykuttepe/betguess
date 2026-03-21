import { useEffect, useState } from 'react';

interface LatestUser {
  username: string;
  created_at: string;
}

export default function LatestUsers() {
  const [users, setUsers] = useState<LatestUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/latest-users')
      .then(res => res.json())
      .then(data => {
        if (data.users) {
          setUsers(data.users);
        }
      })
      .catch(err => console.error('Failed to fetch latest users:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-xs bg-slate-800/80 border border-slate-700 rounded-xl p-4 animate-pulse">
        <div className="h-5 w-32 bg-slate-700 rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700"></div>
              <div className="h-4 w-24 bg-slate-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) return null;

  return (
    <div className="w-full max-w-xs bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
        <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-200">Son Katılanlar</h3>
      </div>
      
      <div className="space-y-1">
        {users.map((user, idx) => (
          <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
            <div className="flex shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 items-center justify-center font-bold text-indigo-300 text-xs">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-emerald-300 transition-colors">
                {user.username}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
