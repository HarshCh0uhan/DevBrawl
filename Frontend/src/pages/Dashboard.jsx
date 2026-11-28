import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { socket } from '../utils/socket';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // --- LOBBY & FORM STATE ---
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [matchState, setMatchState] = useState('waiting');
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ensure Socket Handshake is Authenticated on Component Mount
  useEffect(() => {
    // socket.auth is a function (see authStore) so the token is always the latest one.
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  // --- REAL-TIME SESSISON LOBBY LISTENERS ---
  useEffect(() => {
    // 1. Sync updated player roster when someone enters the lobby channel
    socket.on("user-joined", (data) => {
      if (data.participants) {
        setParticipants(data.participants);
      }
    });

    // 2. Clear out player slot instantly on unexpected drop or disconnect
    socket.on("user-left", (data) => {
      setParticipants((prev) =>
        prev.filter(p => p.userId?.toString() !== data.userId?.toString())
      );
    });

    // 3. Ready-state changes are broadcast to the whole lobby
    socket.on("room-updated", (data) => {
      if (data.participants) {
        setParticipants(data.participants);
      }
    });

    // 4. Global redirect intercept: execute navigation when host starts the match
    socket.on("room-started", (data) => {
      setMatchState('in_progress');
      navigate(`/room/${data.inviteCode}`);
    });

    return () => {
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("room-updated");
      socket.off("room-started");
    };
  }, [navigate]);

  // --- HANDLERS ---
  const handleCreateRoom = () => {
    setCreateError('');
    setIsCreating(true);

    socket.emit("create-room", { name: `${user?.username}'s Session`}, (res) => {
      setIsCreating(false);
      if (res?.success) {
        setRoom(res.data);
        setParticipants(res.data.participants);
        setMatchState(res.data.matchState || 'waiting');
      } else {
        setCreateError(res?.error || 'Failed to allocate room space');
      }
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setJoinError('');

    if (!inviteCode.trim()) {
      setJoinError('Enter invite code');
      return;
    }

    setIsJoining(true);
    socket.emit("join-room", { inviteCode: inviteCode.trim().toUpperCase() }, (res) => {
      setIsJoining(false);
      if (res?.success) {
        // Stay in dashboard lobby mode, sync participant view metrics
        setRoom(res.data);
        setParticipants(res.data.participants);
        setMatchState(res.data.matchState || 'waiting');
      } else {
        setJoinError(res?.error || 'Active room node not found');
      }
    });
  };

  const handleToggleReady = () => {
    if (!room?.inviteCode) return;
    socket.emit("toggle-ready", { inviteCode: room.inviteCode }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Could not update ready state');
        return;
      }
      setParticipants((prev) => prev.map((p) => (
        String(p.userId) === String(user?._id)
          ? { ...p, isReady: res.isReady }
          : p
      )));
    });
  };

  const handleStartRoom = () => {
    if (!room?.inviteCode) return;

    socket.emit("start-room-session", { inviteCode: room.inviteCode }, (res) => {
      if (!res?.success) alert(res?.error || 'Could not start the match');
    });
  };

  const handleCopyCode = () => {
    if (!room?.inviteCode) return;
    navigator.clipboard.writeText(room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isHost = room?.hostId?.toString() === user?._id?.toString();
  const myParticipant = participants.find((p) => String(p.userId) === String(user?._id));
  const maxPlayers = room?.settings?.maxPlayers ?? 6;
  const isLocked = matchState === 'in_progress';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono tracking-tight antialiased">

      {/* ─── PROFESSIONAL MINIMAL HEADER ─── */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-sm font-bold text-slate-100 uppercase tracking-widest">DevBrawl</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs border border-slate-800 bg-slate-950 px-2.5 py-1 rounded">
            <span className="text-slate-500">USER:</span>
            <span className="text-blue-400 font-semibold">{user?.username}</span>
          </div>
          <button
            onClick={() => navigate('/leaderboard')}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-amber-900 hover:text-amber-400 hover:border-amber-900 cursor-pointer"
          >
            🏆 HALL OF FAME
          </button>
          <button
            onClick={handleLogout}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-red-950 hover:text-red-400 hover:border-red-900 cursor-pointer"
          >
            TERMINATE_SESSION
          </button>
        </div>
      </header>

      {/* ─── MAIN HUB CONTAINER ─── */}
      <main className="mx-auto max-w-4xl px-4 py-16">
        {room ? (

          /* ─── HI-FI LOBBY GRID VIEW ─── */
          <div className="w-full max-w-2xl mx-auto bg-slate-900 border-4 border-slate-950 rounded-xl p-6 shadow-2xl">

            {/* TOP CONTROLS & META BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-slate-950 pb-4 mb-6 gap-4">
              <div className="text-left">
                <div className="text-xxs font-black text-slate-500 uppercase tracking-widest">SESSION_NODE</div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Match Lobby</h2>
              </div>

              {/* Room Code Indicator Box */}
              <div className="flex items-center bg-slate-950 px-4 py-2 border-2 border-slate-800 rounded-lg shadow-inner">
                <div className="text-left mr-6">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">ROOM CODE</span>
                  <span className="text-xl font-mono font-black tracking-widest text-emerald-400">{room.inviteCode}</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1 text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border-2 border-slate-700 transition cursor-pointer uppercase"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Sub-Header Metrics */}
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              <span>Players: {participants.length} / {maxPlayers}</span>
              <span className={isLocked ? 'text-amber-400' : 'text-blue-400'}>
                {isLocked ? 'Match in Progress 🔒' : 'ready For Battle Folks🔥'}
              </span>
            </div>

            {/* THE LOBBY PLAYER GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {/* Map connected roster */}
              {participants.map((player) => {
                const playerIsHost = String(player.userId) === String(room.hostId);

                return (
                  <div
                    key={player.userId}
                    className={`flex items-center justify-between p-3 rounded-lg border-4 border-slate-950 shadow-md transform transition ${
                      playerIsHost
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      {/* Avatar Render Wrapper */}
                      <div className={`h-10 w-10 rounded-full border-2 border-slate-950 flex items-center justify-center text-lg overflow-hidden shrink-0 ${
                        playerIsHost ? 'bg-amber-600' : 'bg-emerald-700'
                      }`}>
                        <img
                          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-black text-sm uppercase truncate max-w-[140px]">
                          {player.username}
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${
                          playerIsHost ? 'text-amber-950' : 'text-emerald-200'
                        }`}>
                          {playerIsHost ? 'Lobby Host' : player.isReady ? 'Ready to Brawl' : 'Not Ready'}
                        </div>
                      </div>
                    </div>

                    {/* Meta action/indicator flags */}
                    {playerIsHost ? (
                      <span className="text-xs font-black tracking-widest bg-amber-600/30 px-2 py-0.5 rounded border border-amber-600 text-amber-950 uppercase">
                        Host
                      </span>
                    ) : (
                      <div className={`h-6 w-6 rounded-full border-2 border-slate-950 flex items-center justify-center font-black text-xs shadow-sm select-none ${
                        player.isReady ? 'bg-emerald-400 text-slate-950' : 'bg-red-600 text-white'
                      }`}>
                        {player.isReady ? '✓' : '✕'}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pad out open remaining spaces up to maxPlayers */}
              {Array.from({ length: Math.max(0, maxPlayers - participants.length) }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg border-4 border-dashed border-slate-800 bg-slate-950/40 text-slate-600 select-none"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="h-10 w-10 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-700 text-xl font-black">
                      ?
                    </div>
                    <div>
                      <div className="font-bold text-sm uppercase tracking-wider text-slate-700">Open Slot</div>
                      <div className="text-[10px] font-bold uppercase text-slate-800">Awaiting Connection...</div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="h-6 w-6 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-slate-400 font-black text-md hover:bg-slate-700 hover:text-white transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>

            {/* ACTION PIPELINE TRIGGERS */}
            <div className="border-t-4 border-slate-950 pt-4 mt-4 space-y-3">
              {!isHost && myParticipant && (
                <button
                  onClick={handleToggleReady}
                  disabled={isLocked}
                  className={`w-full rounded-lg border-4 border-slate-950 py-3 text-sm font-black tracking-widest uppercase transition ${
                    isLocked
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : myParticipant.isReady
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                  }`}
                >
                  {myParticipant.isReady ? '✓ Ready — Click to Unready' : 'Ready Up'}
                </button>
              )}

              {isHost ? (
                <button
                  onClick={handleStartRoom}
                  disabled={isLocked}
                  className={`w-full rounded-lg border-4 border-slate-950 py-3 text-sm font-black tracking-widest uppercase transition ${
                    isLocked
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md'
                  }`}
                >
                  {isLocked ? 'Match in Progress' : 'Launch Workspace Session ⚔️'}
                </button>
              ) : (
                <div className="w-full rounded-lg bg-slate-950 border-4 border-slate-950 py-3 text-center text-xs text-slate-500 font-black tracking-widest uppercase animate-pulse">
                  {isLocked ? 'Match in Progress' : 'Holding Connection // Waiting for Host Launch Signal'}
                </div>
              )}
            </div>
          </div>
        ) : (

          /* ─── INITIAL CREATION OR INTERCEPT SPLIT CARDS ─── */
          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Room Box */}
            <div className="rounded border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between text-left">
              <div>
                <h3 className="text-md font-bold text-slate-100 uppercase tracking-wider mb-1">Initialize Room</h3>
                <p className="text-xs text-slate-500 mb-6">Compile a new real-time room node instance. Generates access verification metrics.</p>
                {createError && <p className="mb-3 text-xs text-red-400 font-mono">ERR: {createError}</p>}
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className={`w-full rounded py-2.5 text-xs font-bold text-white uppercase tracking-wider transition ${
                  isCreating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                }`}
              >
                {isCreating ? 'COMPILING...' : '[+] Allocate Room'}
              </button>
            </div>

            {/* Join Room Box */}
            <div className="rounded border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between text-left">
              <div>
                <h3 className="text-md font-bold text-slate-100 uppercase tracking-wider mb-1">Intercept Session</h3>
                <p className="text-xs text-slate-500 mb-4">Input active token parameters to authenticate and enter an allocated workspace pipeline.</p>
                {joinError && <p className="mb-3 text-xs text-red-400 font-mono">ERR: {joinError}</p>}
              </div>

              <form onSubmit={handleJoinRoom} className="w-full space-y-2.5">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="INPUT_INVITE_TOKEN"
                  maxLength={6}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm font-mono font-bold tracking-widest text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 uppercase"
                />
                <button
                  type="submit"
                  disabled={isJoining}
                  className={`w-full rounded py-2.5 text-xs font-bold text-white uppercase tracking-wider transition ${
                    isJoining ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'
                  }`}
                >
                  {isJoining ? 'VERIFYING...' : 'Join Pipeline →'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
