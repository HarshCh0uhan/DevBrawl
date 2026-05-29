


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

  // Layout & UI Panel States
  const [viewMode, setViewMode] = useState('canvas') 
  const [participants, setParticipants] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [roomData, setRoomData] = useState(null)
  const chatEndRef = useRef(null)

  // Auto-scroll to the bottom when new message arrives
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

    // --- FIXED REAL-TIME TEXT CHAT LISTENERS ---
    socket.on("receive-message", (data) => {
    setMessages((prev) => [...prev, {
      senderId: data.userId,
      username: data.username,
      text: data.message,  // ← map message to text
      timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }])
})

    return () => {
      socket.off("user-joined")
      socket.off("user-left")
      socket.off("receive-message")
    }
  }, [inviteCode, navigate])

  // --- DISPATCH MESSAGE TO SERVER ENGINE ---
  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!textInput.trim() || !inviteCode) return

    const text = textInput.trim()

    // Match backend: { roomId, message }
    socket.emit("send-message", {
      roomId: inviteCode.toUpperCase(),
      message: text  
    })

    // Optimistic local update
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

  const showCanvas = viewMode === 'canvas' || viewMode === 'split'
  const showEditor = viewMode === 'editor' || viewMode === 'split'

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

        {/* Utility Toggles */}
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

      {/* ─── PERSISTENT CORE VIEWPORT RUNNER ─── */}
      <div className="flex-1 flex relative bg-slate-950 w-full overflow-hidden p-2 gap-2">
        
        {/* VIEWPORTS EXPANDABLE BOX */}
        <div className={`flex-1 gap-2 transition-all duration-150 ${viewMode === 'split' ? 'flex flex-col md:flex-row' : 'block relative w-full h-full'}`}>
          {/* COLLABORATIVE CANVAS PANEL */}
          <div className={`rounded-lg border-2 border-slate-800/85 overflow-hidden shadow-inner h-full w-full ${showCanvas ? 'block' : 'hidden'} ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full relative' : 'absolute inset-0'}`}>
            <CollaborativeCanvas roomId={inviteCode?.toUpperCase()} currentUser={user} />
          </div>

          {/* MONACO CODE EDITOR PANEL */}
          <div className={`rounded-lg overflow-hidden shadow-inner h-full w-full ${showEditor ? 'block' : 'hidden'} ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full relative' : 'absolute inset-0'}`}>
            <MonacoEditor roomId={inviteCode?.toUpperCase()} />
          </div>
        </div>

        {/* ─── SLIDE-OUT PROFESSIONAL SIDEBAR TEXT CHAT PANEL ─── */}
        <div 
          className={`rounded border-2 border-slate-800 bg-slate-900 flex flex-col justify-between transition-all duration-200 shrink-0 h-full ${
            chatOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none border-none !p-0 !m-0'
          }`}
        >
          {/* Tray Title Bar */}
          <div className="border-b border-slate-800 p-3 bg-slate-950 flex items-center justify-between">
            <span className="text-xxs font-black tracking-widest text-slate-400 uppercase">Room_Chat_Feed</span>
            <button onClick={() => setChatOpen(false)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>

          {/* Message Stream Render Box */}
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

          {/* Tray Input Form Submission Bar */}
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
