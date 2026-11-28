
import { useRoomStore } from '../store/roomStore';
import VoiceCall from './VoiceCall';

export default function RoomHeader({
  user,
  viewMode,
  onViewChange,
  onToggleProblem,
  onToggleChat,
  questionPanelOpen,
  chatOpen,
  onLeave,
  socket,
  isActivePlayer,
  isExplainingPhase
}) {
  const {
    roomCode,
    hostId,
    turnStatus,
    activeUsername,
    activePlayerId,
    turnIndex,
    totalPlayers,
    participants,
    matchState
  } = useRoomStore();

  const isHost = hostId?.toString() === user?._id?.toString();
  const isMyTurn = activePlayerId === user?._id?.toString();

  const handleStartJudging = () => {
    socket.emit("start-judging-phase", { inviteCode: roomCode }, (res) => {
      if (!res?.success) alert(res?.error || "Could not start judging");
    });
  };

  return (
    <header className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3 gap-3 shrink-0 font-mono">
      {/* LEFT: Room Identity + Coder Meta */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-100 uppercase tracking-widest">BRAWL_ROOM</span>
          <span className="text-sm font-black text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded tracking-widest">
            {roomCode}
          </span>
        </div>

        {turnStatus === 'turn_active' && activeUsername && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              {isMyTurn ? 'YOUR TURN' : `${activeUsername}'s TURN`}
            </span>
            <span className="text-[10px] text-slate-600 uppercase tracking-wider">
              ({turnIndex + 1}/{totalPlayers})
            </span>
          </div>
        )}

        {turnStatus === 'all_done' && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <span className="text-xs font-black text-blue-400 uppercase tracking-wider">ROUND COMPLETE</span>
          </div>
        )}

        {/* Peers Avatar Stack */}
        <div className="hidden md:flex items-center gap-1.5 border-l border-slate-800 pl-4 text-slate-500 text-xs">
          <span>PEERS:</span>
          <div className="flex -space-x-1 overflow-hidden">
            {participants.map((p) => (
              <div
                key={p.userId}
                title={p.username}
                className={`h-5 w-5 rounded-full border border-slate-950 flex items-center justify-center text-[8px] font-black uppercase shrink-0 ${
                  p.userId?.toString() === activePlayerId
                    ? 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-400'
                    : 'bg-slate-800 text-blue-400'
                }`}
              >
                {p.username?.substring(0, 2)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER: Layout Mode Buttons */}
      <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-md shadow-inner">
        {['canvas', 'editor', 'split'].map((mode) => (
          <button
            key={mode}
            onClick={() => onViewChange(mode)}
            className={`px-3 py-1 text-xxs font-black tracking-wider uppercase transition rounded cursor-pointer ${
              viewMode === mode ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {mode === 'canvas' ? 'Canvas_View' : mode === 'editor' ? 'Code_Editor' : 'Split_Screen'}
          </button>
        ))}
      </div>

      {/* RIGHT: Admin Actions + Panel Triggers */}
      <div className="flex items-center gap-2">
        {matchState === 'explaining' && (isHost || isMyTurn) && (
          <button
            onClick={handleStartJudging}
            className="rounded px-3 py-1 text-xxs font-black tracking-wider uppercase border transition cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600 shadow-md animate-fade-in"
          >
            ⚖️ Start Judging
          </button>
        )}

        <button
          onClick={onToggleProblem}
          className={`rounded px-3 py-1 text-xxs font-black tracking-wider uppercase border transition cursor-pointer ${
            questionPanelOpen ? 'bg-emerald-500 text-slate-950 border-emerald-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          📋 PROBLEM
        </button>

        <button
          onClick={onToggleChat}
          className={`rounded px-3 py-1 text-xxs font-black tracking-wider uppercase border transition cursor-pointer ${
            chatOpen ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          💬 CHAT
        </button>

        <VoiceCall
          roomName={roomCode}
          isActivePlayer={isActivePlayer}
          isExplainingPhase={isExplainingPhase}
        />

        <button
          onClick={onLeave}
          className="rounded border border-slate-700 bg-slate-800/40 px-3 py-1 text-xxs font-black text-slate-400 tracking-wider transition hover:bg-red-950 hover:text-red-400 hover:border-red-900 cursor-pointer uppercase"
        >
          Leave_Brawl
        </button>
      </div>
    </header>
  );
}
