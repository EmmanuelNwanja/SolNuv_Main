import Head from 'next/head';
import { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/ui/index';
import { RiTrophyLine, RiMedalLine, RiSunLine, RiRecycleLine, RiLeafLine } from 'react-icons/ri';

const CATEGORIES = [
  { id: 'impact', label: 'Overall Impact', icon: RiLeafLine },
  { id: 'active', label: 'Active Projects', icon: RiSunLine },
  { id: 'recycled', label: 'Recycled', icon: RiRecycleLine },
  { id: 'silver', label: 'Silver Fleet', icon: RiMedalLine },
];

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-amber-700'];

export default function Leaderboard() {
  const { profile } = useAuth();
  const [category, setCategory] = useState('impact');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserPos, setCurrentUserPos] = useState(null);

  useEffect(() => {
    setLoading(true);
    dashboardAPI.getLeaderboard({ category })
      .then(r => {
        setData(r.data.data?.leaderboard || []);
        setCurrentUserPos(r.data.data?.current_user_position);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category]);

  function getDisplayValue(entry) {
    switch (category) {
      case 'active': return `${entry.active_projects_count} projects`;
      case 'recycled': return `${entry.recycled_count} recycled`;
      case 'silver': return `${(entry.total_silver_grams || 0).toFixed(1)}g silver`;
      default: return `${(entry.impact_score || 0).toFixed(0)} pts`;
    }
  }

  return (
    <>
      <Head><title>Leaderboard — SolNuv</title></Head>

      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-forest-900 flex items-center gap-2">
            <RiTrophyLine className="text-amber-500" /> Leaderboard
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Nigeria's leading solar installers ranked by responsible management
            {currentUserPos && <span className="ml-2 font-semibold text-forest-900">· Your rank: #{currentUserPos}</span>}
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${category === cat.id ? 'bg-forest-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-forest-900/30'}`}
          >
            <cat.icon /> {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="max-w-2xl">
          {/* Top 3 podium */}
          {data.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[data[1], data[0], data[2]].map((entry, podiumIdx) => {
                const rank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
                const isMe = entry?.entity_id === profile?.id;
                return (
                  <div key={entry?.entity_id} className={`rounded-2xl p-4 text-center ${rank === 1 ? 'bg-amber-500 text-forest-900 order-first sm:order-none' : 'bg-white border border-slate-200'} ${rank === 1 ? 'py-6' : ''} ${isMe ? 'ring-2 ring-emerald-500' : ''}`}>
                    <div className={`text-3xl mb-1 ${RANK_COLORS[rank - 1]}`}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                    </div>
                    <p className={`font-semibold text-sm truncate ${rank === 1 ? 'text-forest-900' : 'text-slate-800'}`}>{entry?.entity_name || '-'}</p>
                    <p className={`text-xs mt-1 ${rank === 1 ? 'text-forest-900/70' : 'text-slate-500'}`}>{entry ? getDisplayValue(entry) : '-'}</p>
                    {isMe && <p className="text-xs font-bold text-emerald-600 mt-1">That's you! 🎉</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <div className="card">
            <div className="space-y-2">
              {data.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No data yet. Add projects to appear on the leaderboard!</p>
              ) : data.map((entry, idx) => {
                const isMe = entry.entity_id === profile?.id;
                return (
                  <div key={entry.entity_id} className={`flex items-center gap-4 p-3 rounded-xl transition-all ${isMe ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'}`}>
                    <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0 ${idx < 3 ? RANK_COLORS[idx] : 'text-slate-400'}`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{entry.entity_name}</p>
                      <p className="text-xs text-slate-400">
                        {entry.active_projects_count} active · {entry.recycled_count} recycled · {(entry.total_silver_grams || 0).toFixed(1)}g silver
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-forest-900 text-sm">{getDisplayValue(entry)}</p>
                      {isMe && <p className="text-xs text-emerald-600 font-medium">You</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

Leaderboard.getLayout = getDashboardLayout;
