
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../utils/socket'
import CollaborativeCanvas from '../utils/tldraw'
import { useAuthStore } from '../store/authStore'
import MonacoEditor from '../components/MonacoEditor'
import VoiceCall from '../components/VoiceCall'

export default function RoomPage() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const [viewMode, setViewMode] = useState('canvas')
  const [activePanel, setActivePanel] = useState('canvas') // which panel has focus
  const [participants, setParticipants] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [roomData, setRoomData] = useState(null)
  
  // Dynamic language switcher states
  const [selectedLanguage, setSelectedLanguage] = useState('javascript')
  const chatEndRef = useRef(null)

  const judge0Languages = {
    javascript: 63,
    python: 71,
    cpp: 54,
    java: 62,
    go: 60,
    rust: 73
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatOpen])

  useEffect(() => {
    if (!inviteCode) return

    const roomToken = inviteCode.toUpperCase()
    socket.roomId = roomToken

    socket.emit("join-room", { inviteCode: roomToken }, (res) => {
      if (res?.success) {
        setParticipants(res.data.participants)
        setRoomData(res.data)
      } else {
        navigate('/dashboard')
      }
    })

    socket.on("user-joined", (data) => {
      if (data.participants) setParticipants(data.participants)
    })

    socket.on("user-left", (data) => {
      setParticipants((prev) => prev.filter(p => p.userId !== data.userId))
    })

    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, {
        senderId: data.userId,
        username: data.username,
        text: data.message,
        timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    })

    return () => {
      socket.off("user-joined")
      socket.off("user-left")
      socket.off("receive-message")
    }
  }, [inviteCode, navigate])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!textInput.trim() || !inviteCode) return

    const text = textInput.trim()

    socket.emit("send-message", {
      roomId: inviteCode.toUpperCase(),
      message: text
    })

    setMessages((prev) => [...prev, {
      senderId: user?._id,
      username: user?.username,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }])

    setTextInput('')
  }

  const handleLeave = () => {
    socket.emit("leave-room-manually", { inviteCode: inviteCode?.toUpperCase() })
    navigate('/dashboard')
  }

  const shouldMountCanvas = viewMode === 'canvas' || (viewMode === 'split' && activePanel === 'canvas')
  const shouldMountEditor = viewMode === 'editor' || (viewMode === 'split' && activePanel === 'editor')

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    if (mode === 'canvas') setActivePanel('canvas')
    if (mode === 'editor') setActivePanel('editor')
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-mono tracking-tight text-slate-200 antialiased overflow-hidden">

      {/* ─── HEADER ─── */}
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3 gap-3 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-100 uppercase tracking-widest">BRAWL_ROOM</span>
            <span className="text-sm font-black text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded tracking-widest">
              {inviteCode?.toUpperCase()}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 border-l border-slate-800 pl-4 text-slate-500 text-xs">
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

        {/* ─── VIEW MODE TOGGLE ─── */}
        <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-md shadow-inner">
          {['canvas', 'editor', 'split'].map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              className={`px-3 py-1 text-xxs font-black tracking-wider uppercase transition rounded ${
                viewMode === mode
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300 cursor-pointer'
              }`}
            >
              {mode === 'canvas' ? 'Canvas_View' : mode === 'editor' ? 'Code_Editor' : 'Split_Screen'}
            </button>
          ))}
        </div>

        {/* ─── UTILITY BUTTONS ─── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`rounded px-3 py-1 text-xxs font-black tracking-wider uppercase border transition cursor-pointer ${
              chatOpen
                ? 'bg-amber-500 text-slate-950 border-amber-600'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            💬 CHAT
          </button>

          <VoiceCall roomName={inviteCode?.toUpperCase()} />

          <button
            onClick={handleLeave}
            className="rounded border border-slate-700 bg-slate-800/40 px-3 py-1 text-xxs font-black text-slate-400 tracking-wider transition hover:bg-red-950 hover:text-red-400 hover:border-red-900 cursor-pointer uppercase"
          >
            Leave_Brawl
          </button>
        </div>
      </header>

      {/* ─── MAIN VIEWPORT ─── */}
      <div className="flex-1 flex relative bg-slate-950 w-full overflow-hidden p-2 gap-2">

        <div className={`flex-1 gap-2 transition-all duration-150 ${viewMode === 'split' ? 'flex flex-col md:flex-row' : 'block relative w-full h-full'}`}>

          {/* ── CANVAS PANEL ─────────────────────────────────────────────── */}
          {(viewMode === 'canvas' || viewMode === 'split') && (
            <div
              className={`rounded-lg border-2 overflow-hidden shadow-inner h-full w-full relative
                ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full' : 'absolute inset-0'}
                ${viewMode === 'split' && activePanel === 'canvas'
                  ? 'border-blue-500/50'
                  : 'border-slate-800/85'}
              `}
              onClick={() => viewMode === 'split' && setActivePanel('canvas')}
            >
              {viewMode === 'split' && activePanel !== 'canvas' && (
                <div className="absolute inset-0 z-10 bg-slate-950/60 flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <span className="text-slate-400 text-xs font-black uppercase tracking-widest">🎨 Canvas</span>
                  <span className="text-slate-600 text-[10px] uppercase tracking-wider">Click to activate</span>
                </div>
              )}

              {shouldMountCanvas && (
                <CollaborativeCanvas
                  roomId={inviteCode?.toUpperCase()}
                  currentUser={user}
                />
              )}
            </div>
          )}

          {/* ── EDITOR PANEL ─────────────────────────────────────────────── */}
          {(viewMode === 'editor' || viewMode === 'split') && (
            <div
              className={`rounded-lg overflow-hidden shadow-inner h-full w-full flex flex-col relative bg-slate-900
                ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full' : 'absolute inset-0'}
                ${viewMode === 'split' && activePanel === 'editor'
                  ? 'border-2 border-blue-500/50'
                  : 'border-2 border-slate-800/85'}
              `}
              onClick={() => viewMode === 'split' && setActivePanel('editor')}
            >
              {viewMode === 'split' && activePanel !== 'editor' && (
                <div className="absolute inset-0 z-40 bg-slate-950/60 flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <span className="text-slate-400 text-xs font-black uppercase tracking-widest">💻 Code Editor</span>
                  <span className="text-slate-600 text-[10px] uppercase tracking-wider">Click to activate</span>
                </div>
              )}

              {/* DYNAMIC LANGUAGE OPTIONS SELECTOR HEADER (Kept in View Wrapper) */}
              <div className="flex items-center gap-2 bg-slate-950 border-b border-slate-800/80 px-4 py-2 shrink-0 z-20">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">RUNTIME_ENV:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-mono font-bold text-blue-400 px-2.5 py-1 rounded outline-none cursor-pointer focus:border-blue-500 uppercase transition"
                >
                  <option value="javascript">JavaScript (Node)</option>
                  <option value="python">Python 3</option>
                  <option value="cpp">C++ (GCC)</option>
                  <option value="java">Java (OpenJDK)</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>

              {/* Live Mount Frame */}
              <div className="flex-1 relative w-full h-full min-h-0">
                {shouldMountEditor && (
                  <MonacoEditor 
                    roomId={inviteCode?.toUpperCase()} 
                    language={selectedLanguage}
                    languageId={judge0Languages[selectedLanguage]}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── CHAT SIDEBAR ─── */}
        <div
          className={`rounded border-2 border-slate-800 bg-slate-900 flex flex-col justify-between transition-all duration-200 shrink-0 h-full ${
            chatOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none border-none !p-0 !m-0'
          }`}
        >
          <div className="border-b border-slate-800 p-3 bg-slate-950 flex items-center justify-between">
            <span className="text-xxs font-black tracking-widest text-slate-400 uppercase">Room_Chat_Feed</span>
            <button onClick={() => setChatOpen(false)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((msg, index) => {
              const isMe = msg.senderId === user?._id
              return (
                <div key={index} className={`flex flex-col text-left max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-0.5">
                    <span className={isMe ? 'text-blue-400' : 'text-emerald-400'}>{msg.username}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className={`rounded px-3 py-1.5 text-xs font-sans break-words ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-950 text-slate-200 rounded-tl-none border border-slate-800'}`}>
                    {msg.text}
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-800 p-2.5 bg-slate-950 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type tactical response..."
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none placeholder-slate-600 focus:border-blue-500 font-mono"
              maxLength={250}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded font-black text-xxs tracking-widest uppercase px-3 cursor-pointer transition"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}