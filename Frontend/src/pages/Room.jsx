import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket';
import { useAuthStore } from '../store/authStore';
import { useRoomStore } from '../store/roomStore';
import ArenaLeaderboard from '../components/leaderBoard';

import RoomHeader from '../components/RoomHeader';
import WorkspaceLayout from '../components/WorkspaceLayout';
import SidebarManager from '../components/SideBarManager';

export default function RoomPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const store = useRoomStore();

  const [viewMode, setViewMode] = useState('canvas');
  const [chatOpen, setChatOpen] = useState(false);
  const [questionPanelOpen, setQuestionPanelOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [arenaSummary, setArenaSummary] = useState(null);

  useEffect(() => {
    if (!inviteCode) return;
    const roomToken = inviteCode.toUpperCase();
    socket.roomId = roomToken;

    socket.emit("join-room", { inviteCode: roomToken }, (res) => {
      if (res?.success) {
        store.initRoomSession(res.data);
      } else {
        navigate('/dashboard');
      }
    });

    socket.on("user-joined", (data) => {
      if (data.participants) store.setParticipants(data.participants);
    });

    // 🚀 FIXED: Broken state closure updated to get fresh snapshot values
    socket.on("user-left", (data) => {
      const currentParticipants = useRoomStore.getState().participants;
      store.setParticipants(currentParticipants.filter(p => p.userId !== data.userId));
    });

    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, {
        senderId: data.userId,
        username: data.username,
        text: data.message,
        timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socket.on("round-question-ready", (questionData) => {
      store.setActiveQuestion(questionData);
    });

    socket.on("turn-started", (data) => {
      store.syncTurnStart(data);
    });

    // 🚀 FIXED: Re-injected active listener parameters for round advancement hooks
    socket.on("turn-ended", (data) => {
      store.syncTurnEnd(data);
    });

    socket.on("turn-skipped", () => {
      const currentTurnIndex = useRoomStore.getState().turnIndex;
      store.syncTurnEnd({ turnIndex: currentTurnIndex });
    });

    socket.on("all-turns-complete", () => {
      console.log("📥 FRONTEND: 'all-turns-complete' received! Mounting loading screen overlay...");
      store.setAllTurnsComplete();
      setArenaSummary({ loading: true, leaderboard: [], winnerName: null, feedback: "" });

      // Safety net: if match-summary-ready never arrives in 45s, dismiss spinner
      const fallbackTimer = setTimeout(() => {
        setArenaSummary((prev) => {
          if (prev?.loading) {
            return {
              leaderboard: [],
              feedback: "Score compilation timed out. Check with the host.",
              winnerName: null,
            };
          }
          return prev;
        });
      }, 45000);

      // Clear timer as soon as real summary arrives
      socket.once("match-summary-ready", () => clearTimeout(fallbackTimer));
    });

    socket.on("match-summary-ready", (data) => {
      console.log("🏆 FRONTEND: 'match-summary-ready' arrived with payload:", data);
      setArenaSummary(data);
    });

    // Phase-2 AI scoring events
    socket.on("phase2-reviewing", (data) => {
      store.setPhase2Reviewing(data);
    });

    socket.on("phase2-complete", (data) => {
      store.setPhase2Complete(data);
    });

    socket.on("phase2-failed", (data) => {
      store.setPhase2Failed(data);
      // Ensure spinner is dismissed even if leaderboard never arrives
      setArenaSummary((prev) => {
        if (prev?.loading) {
          return {
            leaderboard: [],
            feedback: "AI scoring failed — showing provisional scores.",
            winnerName: null,
          };
        }
        return prev;
      });
    });

    return () => {
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("receive-message");
      socket.off("round-question-ready");
      socket.off("turn-started");
      socket.off("turn-ended");
      socket.off("turn-skipped");
      socket.off("all-turns-complete");
      socket.off("match-summary-ready");
      socket.off("phase2-reviewing");
      socket.off("phase2-complete");
      socket.off("phase2-failed");
      store.clearRoomStore();
    };
  }, [inviteCode, navigate]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!textInput.trim() || !inviteCode) return;
    const text = textInput.trim();
    socket.emit("send-message", { roomId: inviteCode.toUpperCase(), message: text });
    setMessages((prev) => [...prev, {
      senderId: user?._id,
      username: user?.username,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setTextInput('');
  };

  const handleLeave = () => {
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 antialiased overflow-hidden relative">
      <RoomHeader 
        user={user}
        viewMode={viewMode}
        onViewChange={setViewMode}
        onToggleProblem={() => setQuestionPanelOpen(!questionPanelOpen)}
        onToggleChat={() => setChatOpen(!chatOpen)}
        questionPanelOpen={questionPanelOpen}
        chatOpen={chatOpen}
        onLeave={handleLeave}
        socket={socket}
      />

      <div className="flex-1 flex relative bg-slate-950 w-full overflow-hidden p-2 gap-2">
        <SidebarManager 
          questionPanelOpen={questionPanelOpen}
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          messages={messages}
          textInput={textInput}
          setTextInput={setTextInput}
          onSendMessage={handleSendMessage}
          user={user}
        />
        <WorkspaceLayout 
          viewMode={viewMode}
          user={user}
          socket={socket}
        />
      </div>

      {arenaSummary && (
        <ArenaLeaderboard 
          summaryData={arenaSummary} 
          onLeave={handleLeave} 
        />
      )}
    </div>
  );
}