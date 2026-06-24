import { useEffect, useRef } from 'react';
import { useRoomStore } from '../store/roomStore';
import QuestionPanel from './QuestionPanel';

export default function SidebarManager({ 
  questionPanelOpen, 
  chatOpen, 
  setChatOpen, 
  messages, 
  textInput, 
  setTextInput, 
  onSendMessage, 
  user 
}) {
  const { roomCode, hostId } = useRoomStore();
  const chatEndRef = useRef(null);
  const isHost = hostId?.toString() === user?._id?.toString();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  return (
    <>
      {/* 📋 PROBLEM PANEL */}
      <div className={`shrink-0 h-full transition-all duration-200 ${questionPanelOpen ? 'w-[380px]' : 'w-0 opacity-0 pointer-events-none overflow-hidden'}`}>
        <QuestionPanel roomId={roomCode} isHost={isHost} roundNumber={1} />
      </div>

      {/* 💬 ROOM CHAT FEED */}
      <div className={`rounded border-2 border-slate-800 bg-slate-900 flex flex-col justify-between transition-all duration-200 shrink-0 h-full ${chatOpen ? 'w-80' : 'w-0 opacity-0 pointer-events-none border-none !p-0 !m-0'}`}>
        <div className="border-b border-slate-800 p-3 bg-slate-950 flex items-center justify-between font-mono">
          <span className="text-xxs font-black tracking-widest text-slate-400 uppercase">Room_Chat_Feed</span>
          <button onClick={() => setChatOpen(false)} className="text-slate-600 hover:text-slate-400 cursor-pointer">✕</button>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-none">
          {messages.map((msg, index) => {
            const isMe = msg.senderId === user?._id;
            return (
              <div key={index} className={`flex flex-col text-left max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-0.5 font-mono">
                  <span className={isMe ? 'text-blue-400' : 'text-emerald-400'}>{msg.username}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className={`rounded px-3 py-1.5 text-xs font-sans break-words ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-950 text-slate-200 rounded-tl-none border border-slate-800'}`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={onSendMessage} className="border-t border-slate-800 p-2.5 bg-slate-950 flex gap-2 font-mono">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type tactical response..."
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none placeholder-slate-600 focus:border-blue-500"
            maxLength={250}
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded font-black text-xxs tracking-widest uppercase px-3 cursor-pointer transition">
            Send
          </button>
        </form>
      </div>
    </>
  );
}