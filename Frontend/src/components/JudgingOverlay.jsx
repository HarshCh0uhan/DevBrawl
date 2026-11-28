import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';

export default function JudgingOverlay({ roomId, activePlayerId, activePlayerName, participants, myUserId, onClose }) {
  const [scores, setScores] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Filter out the active player (they are not judging)
  const judges = participants.filter(p => p.userId !== activePlayerId);

  useEffect(() => {
    // In 1v1 the whole pool is assigned to the active player, so a judge can
    // submit immediately. (Sliders for multi-target allocation come later.)
    const initial = {};
    judges.forEach(j => { initial[j.userId] = 0; });
    initial[activePlayerId] = 100;
    setScores(initial);
  }, [participants, activePlayerId]);

  const totalAllocated = Object.values(scores).reduce((a, b) => a + b, 0);
  const remaining = 100 - totalAllocated;

  const handleSliderChange = (userId, value) => {
    const val = parseInt(value, 10);
    const newTotal = totalAllocated - (scores[userId] || 0) + val;
    if (newTotal <= 100) {
      setScores({ ...scores, [userId]: val });
    }
  };

  const handleSubmit = () => {
    if (remaining !== 0) return alert("You must allocate exactly 100 points before submitting.");

    // For 1v1, the single judge assigns all 100 points to the active player
    const finalScores = { [activePlayerId]: 100 };

    socket.emit('submit-judging-scores', { inviteCode: roomId, scores: finalScores }, (res) => {
      if (res.success) setSubmitted(true);
      else alert(res.error);
    });
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">⚖️</div>
          <h2 className="text-xl font-black text-emerald-400 uppercase tracking-widest">Scores Submitted</h2>
          <p className="text-slate-400 text-sm">Waiting for other judges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-slate-900 border-4 border-amber-500 rounded-xl shadow-2xl p-6 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-amber-500 uppercase tracking-widest">Judging Pool</h2>
          <p className="text-slate-400 text-xs">Evaluate {activePlayerName}'s explanation</p>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg flex items-center justify-between border-2 border-slate-800">
          <span className="text-sm font-bold text-slate-300 uppercase">Points Remaining:</span>
          <span className={`text-2xl font-black ${remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {remaining} / 100
          </span>
        </div>

        {/* Since 1v1 currently assigns all points to the active player automatically */}
        <div className="space-y-4">
          <p className="text-xs text-slate-500 text-center">
            (In 1v1 mode, you are allocating all 100 points to {activePlayerName}. Multi-player sliders coming soon.)
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={remaining !== 0}
          className={`w-full py-3 rounded font-black uppercase tracking-widest transition ${
            remaining === 0
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          Submit Score
        </button>
      </div>
    </div>
  );
}
