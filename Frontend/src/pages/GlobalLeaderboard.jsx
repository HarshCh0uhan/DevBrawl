import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { useAuthStore } from '../store/authStore';

export default function GlobalLeaderboardPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get('/users/leaderboard');
        setPlayers(res.data.data);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono tracking-tight antialiased p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-amber-500 uppercase tracking-widest">
              Hall of Fame
            </h1>
            <p className="text-slate-500 text-xs mt-1">Top Brawlers across the platform</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-700 hover:text-white cursor-pointer uppercase"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-lg overflow-hidden shadow-2xl">
          <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-slate-800 bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-7">Player</div>
            <div className="col-span-4 text-right">Brawl Points</div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs animate-pulse">
              Compiling Global Standings...
            </div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No matches played yet. Be the first!
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {players.map((player, index) => {
                const isMe = player._id === currentUser?._id;
                const rank = index + 1;

                return (
                  <div
                    key={player._id}
                    className={`grid grid-cols-12 gap-4 p-4 items-center transition ${
                      isMe ? 'bg-amber-500/10' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="col-span-1 text-center font-black text-lg">
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                    </div>

                    <div className="col-span-7 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        {player.avatar ? (
                          <img src={player.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-400">
                            {player.username.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className={`font-bold uppercase ${isMe ? 'text-amber-400' : 'text-slate-200'}`}>
                        {player.username} {isMe && '(You)'}
                      </span>
                    </div>

                    <div className="col-span-4 text-right font-black text-amber-500">
                      {player.brawlPoints.toLocaleString()} PTS
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
