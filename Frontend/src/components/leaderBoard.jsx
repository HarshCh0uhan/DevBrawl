
export default function ArenaLeaderboard({ summaryData, onLeave }) {
  if (!summaryData) return null;

  // Show spinner while waiting for AI scoring to complete
  if (summaryData.loading) return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md font-mono gap-4">
      <div className="h-10 w-10 rounded-full border-[3px] border-slate-700 border-t-amber-500 animate-spin" />
      <p className="text-xs font-black text-amber-400 uppercase tracking-widest animate-pulse">
        Compiling Arena Standings...
      </p>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">
        AI is evaluating all submissions
      </p>
    </div>
  );

  const { 
  leaderboard = [], 
  feedback = "Match concluded safely.", 
  winnerName = "Unknown Coder" 
} = summaryData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border-4 border-slate-700 rounded-xl shadow-2xl overflow-hidden font-mono text-left p-6 space-y-6 relative border-t-amber-500">
        
        {/* 🎖️ Arcade Style Header Layout */}
        <div className="text-center space-y-1">
          <div className="text-3xl animate-bounce">⚔️</div>
          <h1 className="text-2xl font-black text-amber-500 tracking-widest uppercase">
            BRAWL OVER • MATCH RECAP
          </h1>
          <p className="text-slate-500 text-[10px] tracking-widest uppercase">
            DevBrawl Combat Arena Final Metrics
          </p>
        </div>

        {/* 👑 MVP Winner Announcement Podium Block */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/20 p-4 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-0.5">MATCH_MVP_WINNER</span>
            <span className="text-xl font-black text-slate-100 uppercase tracking-wider">{winnerName || "Unknown"}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-amber-400/70 uppercase block font-bold tracking-wider">STATUS</span>
            <span className="text-base font-black text-amber-400 tracking-widest animate-pulse">👑 CHAMPION</span>
          </div>
        </div>

        {/* 📊 The Mini Militia Style Scoreboard Row Iterations */}
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider block">FINAL_STANDINGS:</span>
          {leaderboard.map((player, idx) => {
            const isWinner = idx === 0;
            return (
              <div 
                key={player._id} 
                className={`flex items-center justify-between p-3.5 rounded border-2 transition ${
                  isWinner 
                    ? 'bg-amber-500/5 border-amber-500/40 text-amber-400 shadow-sm' 
                    : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                {/* Left Side: Rank Pointer + Identity Info */}
                <div className="flex items-center gap-4">
                  <span className={`font-black text-base ${isWinner ? 'text-amber-400' : 'text-slate-600'}`}>
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="font-black text-sm uppercase tracking-wider block">{player.username}</span>
                    <span className="text-[10px] text-slate-500 font-sans mt-0.5 block">
                      🎯 Target Weights: <strong className={isWinner ? 'text-amber-500' : 'text-blue-400'}>{player.testsPassed || 0}</strong> / {player.testsTotal || 0} Passed
                    </span>
                  </div>
                </div>

                {/* Right Side: Raw Score Point Array */}
                <div className="text-right">
                  <span className="text-[9px] text-slate-600 block font-bold tracking-widest">EXP_AWARDED</span>
                  <span className="text-lg font-black tracking-wider font-mono">{player.finalScore || 0} PTS</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 🤖 AI Strategic Tactical Feedback Commentary Container */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-1.5 border-l-blue-500 border-l-4">
          <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black tracking-widest uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            TACTICAL AI ANALYSIS COMPILATION:
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans italic">
            "{feedback || "Review sequence parsing concluded safely."}"
          </p>
        </div>

        {/* 🏁 Return Action Trigger Button */}
        <button 
          onClick={onLeave}
          className="w-full rounded bg-blue-600 hover:bg-blue-500 py-3 text-xs font-black uppercase tracking-widest text-white cursor-pointer transition-colors shadow-lg border-b-4 border-blue-800 active:border-b-0"
        >
          RETURN TO HQ DASHBOARD
        </button>
      </div>
    </div>
  );
}