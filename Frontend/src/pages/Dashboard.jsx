import { useState,useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
// import io from 'socket.io-client'; 
import { socket } from '../utils/socket';

export default function Dashboard() {

  useEffect(() => {
  const token = useAuthStore.getState().token
  
  if (!socket.connected) {
    socket.auth = { token }
    socket.connect()
  }

  socket.on("connect", () => {
    console.log("✅ socket connected:", socket.id)
  })

  socket.on("connect_error", (err) => {
    console.error("❌ socket error:", err.message)
  })

  return () => {
    socket.off("connect")
    socket.off("connect_error")
  }
}, [])

   socket.on("connect", () => console.log("✅ socket connected:", socket.id))
  socket.on("connect_error", (err) => console.error("❌ socket error:", err.message))

  const navigate = useNavigate();
  
  // Extract user state and actions from your Zustand store
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Form States
  const [roomName, setRoomName] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [inviteCode, setInviteCode] = useState('');

  // UI Status States
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- HANDLE LOGOUT ---
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // --- CREATE ROOM ACTION ---
  const handleCreateRoom = (e) => {
    e.preventDefault();
    setCreateError('');
    setIsLoading(true);

    if (!roomName) {
      setCreateError('Please enter a workspace room name');
      setIsLoading(false);
      return;
    }

    socket.emit("create-room", { name: roomName, language, maxParticipants: 4 }, (res) => {
      setIsLoading(false);
      if (res.success) {
        navigate(`/room/${res.data.inviteCode}`);
      } else {
        setCreateError(res.error || 'Failed to initialize coding room');
      }
    });
  };

  // --- JOIN ROOM ACTION ---
  const handleJoinRoom = (e) => {
    e.preventDefault();
    setJoinError('');
    setIsLoading(true);

    if (!inviteCode) {
      setJoinError('Please enter a valid invite code');
      setIsLoading(false);
      return;
    }

    socket.emit("join-room", { inviteCode: inviteCode.trim().toUpperCase() }, (res) => {
      setIsLoading(false);
      if (res.success) {
        navigate(`/room/${res.data.inviteCode}`);
      } else {
        setJoinError(res.error || 'Room not found or link expired');
      }
    });
   
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-100">
      {/* ─── HEADER ─── */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-800/50 px-6 py-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight text-white">Collaborative Workspace</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300">
            Welcome, <span className="text-blue-400 font-semibold">{user?.username || 'Developer'}</span>!
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md border border-slate-600 bg-slate-700/50 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-red-600 hover:text-white hover:border-red-600 focus:outline-none cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT LAYOUT ─── */}
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          
          {/* ─── CREATE ROOM SECTION ─── */}
          <section className="rounded-xl border border-slate-800 bg-slate-800 p-6 shadow-md">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h2 className="text-xl font-bold text-slate-100">Create New Room</h2>
            </div>
            <p className="mb-5 text-sm text-slate-400">Launch a fresh interactive collaborative space to host an interview or scribble logic.</p>

            {createError && (
              <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., Algos & Chill"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-blue-500 disabled:opacity-50"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Development Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 disabled:opacity-50 file:bg-slate-800"
                  disabled={isLoading}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="go">Go</option>
                </select>
              </div>

              <button
                type="submit"
                className={`w-full rounded-md py-2 text-sm font-semibold text-white transition focus:outline-none ${
                  isLoading 
                    ? 'bg-slate-700 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                }`}
                disabled={isLoading}
              >
                {isLoading ? 'Creating Workspace...' : 'Create Room'}
              </button>
            </form>
          </section>

          {/* ─── JOIN ROOM SECTION ─── */}
          <section className="rounded-xl border border-slate-800 bg-slate-800 p-6 shadow-md flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl">🔑</span>
                <h2 className="text-xl font-bold text-slate-100">Join Existing Room</h2>
              </div>
              <p className="mb-5 text-sm text-slate-400">Enter a unique active token invite code shared by a teammate or interviewer to slide into their canvas view.</p>

              {joinError && (
                <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
                  {joinError}
                </div>
              )}

              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="e.g., CQRFHO"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm tracking-wider font-mono text-slate-100 placeholder-slate-500 outline-none transition focus:border-blue-500 uppercase disabled:opacity-50"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full rounded-md py-2 text-sm font-semibold text-white transition focus:outline-none mt-2 ${
                    isLoading 
                      ? 'bg-slate-700 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Verifying Credentials...' : 'Join Room'}
                </button>
              </form>
            </div>
            
            <div className="mt-6 border-t border-slate-700/50 pt-4 text-center">
              <span className="text-xs text-slate-500">
                Connected Port Node Securely Verifying Session Tokens Active
              </span>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}