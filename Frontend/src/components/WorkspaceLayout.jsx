import{ useState } from 'react';
import { useRoomStore } from '../store/roomStore';
import CollaborativeCanvas from '../utils/tldraw';
import MonacoEditor from './MonacoEditor';
import api from '../utils/axios';

export default function WorkspaceLayout({ viewMode, user}) {
  const [activePanel, setActivePanel] = useState('canvas');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { roomCode, activeQuestion, activePlayerId, turnStatus } = useRoomStore();
  const isMyTurn = activePlayerId === user?._id?.toString();
  const judge0Languages = { javascript: 63, python: 71, cpp: 54, java: 62, go: 60, rust: 73 };

  const shouldMountCanvas = viewMode === 'canvas' || (viewMode === 'split' && activePanel === 'canvas');
  const shouldMountEditor = viewMode === 'editor' || (viewMode === 'split' && activePanel === 'editor');

  const onFinalSubmit = async (codePayload) => {
    // 🚀 THE FIX: Pulling cleanly out of global Zustand activeQuestion fields!
    if (!activeQuestion?._id) {
      alert("❌ Frontend Error: Could not resolve the active questionId from state store layers.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/submissions/submit', {
        roomId: roomCode,
        questionId: activeQuestion._id,
        sourceCode: codePayload,
        languageId: judge0Languages[selectedLanguage]
      });
    } catch (err) {
      console.error("❌ Submission Engine Drop:", err.response?.data || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex-1 gap-2 transition-all duration-150 ${viewMode === 'split' ? 'flex flex-col md:flex-row' : 'block relative w-full h-full'}`}>
      
      {/* 🎨 CANVAS PANEL */}
      {(viewMode === 'canvas' || viewMode === 'split') && (
        <div
          className={`rounded-lg border-2 overflow-hidden shadow-inner h-full w-full relative
            ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full' : 'absolute inset-0'}
            ${viewMode === 'split' && activePanel === 'canvas' ? 'border-blue-500/50' : 'border-slate-800/85'}
          `}
          onClick={() => viewMode === 'split' && setActivePanel('canvas')}
        >
          {viewMode === 'split' && activePanel !== 'canvas' && (
            <div className="absolute inset-0 z-10 bg-slate-950/60 flex flex-col items-center justify-center gap-2 cursor-pointer">
              <span className="text-slate-400 text-xs font-black uppercase tracking-widest">🎨 Canvas</span>
              <span className="text-slate-600 text-[10px] uppercase tracking-wider">Click to activate</span>
            </div>
          )}
          {shouldMountCanvas && <CollaborativeCanvas roomId={roomCode} currentUser={user} />}
        </div>
      )}

      {/* 💻 EDITOR PANEL */}
      {(viewMode === 'editor' || viewMode === 'split') && (
        <div
          className={`rounded-lg overflow-hidden shadow-inner h-full w-full flex flex-col relative bg-slate-900
            ${viewMode === 'split' ? 'flex-1 h-1/2 md:h-full' : 'absolute inset-0'}
            ${viewMode === 'split' && activePanel === 'editor' ? 'border-2 border-blue-500/50' : 'border-2 border-slate-800/85'}
          `}
          onClick={() => viewMode === 'split' && setActivePanel('editor')}
        >
          {viewMode === 'split' && activePanel !== 'editor' && (
            <div className="absolute inset-0 z-40 bg-slate-950/60 flex flex-col items-center justify-center gap-2 cursor-pointer">
              <span className="text-slate-400 text-xs font-black uppercase tracking-widest">💻 Code Editor</span>
              <span className="text-slate-600 text-[10px] uppercase tracking-wider">Click to activate</span>
            </div>
          )}

          {/* Editor Subheader Control */}
          <div className="flex items-center gap-2 bg-slate-950 border-b border-slate-800/80 px-4 py-2 shrink-0 z-20 font-mono">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RUNTIME_ENV:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={!isMyTurn && turnStatus === 'turn_active'}
              className="bg-slate-900 border border-slate-700 text-xs font-bold text-blue-400 px-2.5 py-1 rounded outline-none cursor-pointer uppercase transition disabled:opacity-50"
            >
              <option value="javascript">JavaScript (Node)</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC)</option>
              <option value="java">Java (OpenJDK)</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>

            {turnStatus === 'turn_active' && !isMyTurn && (
              <span className="ml-auto text-[10px] font-black text-amber-500/70 uppercase tracking-wider">🔒 Read-only</span>
            )}
          </div>

          <div className="flex-1 relative w-full h-full min-h-0">
            {shouldMountEditor && (
              <MonacoEditor
                roomId={roomCode}
                language={selectedLanguage}
                languageId={judge0Languages[selectedLanguage]}
                readOnly={turnStatus === 'turn_active' && !isMyTurn}
                isMyTurn={isMyTurn}
                turnStatus={turnStatus}
                isSubmitting={isSubmitting}
                onFinalSubmit={onFinalSubmit}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}