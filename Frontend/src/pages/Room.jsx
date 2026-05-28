import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../utils/socket'
import CollaborativeCanvas from '../utils/tldraw'
import { useAuthStore } from '../store/authStore'
import MonacoEditor from '../components/MonacoEditor'

export default function RoomPage() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  // Layout states
  const [viewMode, setViewMode] = useState('canvas') // 'canvas' | 'editor' | 'split'
  const [participants, setParticipants] = useState([])

  useEffect(() => {
    if (!inviteCode) return

    const roomToken = inviteCode.toUpperCase()
    socket.roomId = roomToken

    socket.emit("join-room", { inviteCode: roomToken }, (res) => {
      if (res?.success) {
        setParticipants(res.data.participants)
      } else {
        console.error("Failed to sync room session boundary metrics")
        navigate('/dashboard')
      }
    })

    socket.on("user-joined", (data) => {
      if (data.participants) setParticipants(data.participants)
    })

    socket.on("user-left", (data) => {
      setParticipants((prev) => prev.filter(p => p.userId !== data.userId))
    })

    return () => {
      socket.off("user-joined")
      socket.off("user-left")
    }
  }, [inviteCode, navigate])

  const handleLeave = () => {
    socket.emit("leave-room-manually", { inviteCode: inviteCode?.toUpperCase() })
    navigate('/dashboard')
  }

  // Helper classes to dynamically hide/show components based on viewMode without unmounting them
  const showCanvas = viewMode === 'canvas' || viewMode === 'split';
  const showEditor = viewMode === 'editor' || viewMode === 'split';

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-mono tracking-tight text-slate-200 antialiased overflow-hidden">
      
      {/* ─── WORKSPACE FIXED HEADER ─── */}
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3 gap-3 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-100 uppercase tracking-widest">BRAWL_ROOM</span>
            <span className="text-sm font-black text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded tracking-widest">{inviteCode?.toUpperCase()}</span>
          </div>
          
          {/* Active Player Mini Counters */}
          <div className="hidden md:flex items-center gap-1.5 border-l border-slate-800 pl-4 text-slate-500 text-xs">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>PEERS_ACTIVE:</span>
            <div className="flex -space-x-1 overflow-hidden">
              {participants.map((p) => (
                <div 
                  key={p.userId} 
                  title={p.username} 
                  className="h-5 w-5 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-[8px] font-black uppercase text-blue-400 shrink-0"
                >
                  {p.username?.substring(0, 2)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── TOGGLE BAR CONTROLS ─── */}
        <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-md shadow-inner">
          <button
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1 text-xxs font-black tracking-wider uppercase transition rounded ${
              viewMode === 'canvas' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300 cursor-pointer'
            }`}
          >
            Canvas_View
          </button>
          <button
            onClick={() => setViewMode('editor')}
            className={`px-3 py-1 text-xxs font-black tracking-wider uppercase transition rounded ${
              viewMode === 'editor' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300 cursor-pointer'
            }`}
          >
            Code_Editor
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-xxs font-black tracking-wider uppercase transition rounded ${
              viewMode === 'split' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300 cursor-pointer'
            }`}
          >
            Split_Screen
          </button>
        </div>

        <div>
          <button
            onClick={handleLeave}
            className="rounded border border-slate-700 bg-slate-800/40 px-3 py-1 text-xxs font-black text-slate-400 tracking-wider transition hover:bg-red-950 hover:text-red-400 hover:border-red-900 cursor-pointer uppercase"
          >
            Leave_Workspace_Brawl
          </button>
        </div>
      </header>

      {/* ─── PERSISTENT DYNAMIC PANELS VIEWPORT ─── */}
      {/* Fixed Layout wrapper holds components constantly to prevent state drops */}
      <div className="flex-1 relative bg-slate-950 w-full overflow-hidden p-2">
        <div className={`w-full h-full gap-2 transition-all duration-150 ${viewMode === 'split' ? 'flex flex-col md:flex-row' : 'block'}`}>
          
          {/* COLLABORATIVE CANVAS PANEL CONTAINER */}
          <div 
            className={`relative rounded-lg border-2 border-slate-800/85 overflow-hidden shadow-inner h-full w-full ${
              showCanvas ? 'block' : 'hidden'
            } ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full' : ''}`}
          >
            <CollaborativeCanvas roomId={inviteCode?.toUpperCase()} currentUser={user} />
          </div>

          {/* MONACO CODE EDITOR PANEL CONTAINER */}
          <div 
            className={`relative rounded-lg overflow-hidden shadow-inner h-full w-full ${
              showEditor ? 'block' : 'hidden'
            } ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full' : ''}`}
          >
            <MonacoEditor roomId={inviteCode?.toUpperCase()} />
          </div>

        </div>
      </div>

    </div>
  )
}
