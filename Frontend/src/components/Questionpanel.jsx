import { useState, useEffect, useCallback } from 'react'
import { socket } from '../utils/socket'
import api from '../utils/axios'

// ─── Difficulty badge color mapping ─────────────────────────────────────────
const DIFFICULTY_STYLES = {
  easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  hard: 'bg-red-500/10 text-red-400 border-red-500/30',
}

const TOPICS = ["Arrays", "JavaScript", "Logic Puzzles", "Algorithms", "Data Structures", "Strings"]
const DIFFICULTIES = ["easy", "medium", "hard"]

export default function QuestionPanel({ roomId, isHost, roundNumber = 1 }) {
  // ── Question state ──────────────────────────────────────────────────────
  const [question, setQuestion] = useState(null)
  const [status, setStatus] = useState('idle') 
  const [error, setError] = useState('')

  // ── Host picker state ───────────────────────────────────────────────────
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0])
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium')

  // ── Fetch Existing Question on Mount ────────────────────────────────────
  const fetchExistingQuestion = useCallback(async () => {
    if (!roomId || !roundNumber) return

    setStatus('loading')

    try {
      // FORCE structural URL path to utilize your explicit backend api v1 endpoint root
      const res = await api.get(`/questions/${roomId}/${roundNumber}`)
      
      if (res.data?.success && res.data?.data) {
        setQuestion(res.data.data)
        setStatus('ready')
        return
      }
      setStatus('idle')
    } catch (err) {
      // Catch expected 404 cleanly when no question has been initialized for this round yet
      if (err.response?.status === 404) {
        setStatus('idle')
        return
      }

      // Safeguard against HTML fallback strings leaking from proxy drops
      console.log('ℹ️ Active round question space is empty. Awaiting host activation.')
      setStatus('idle')
    }
  }, [roomId, roundNumber])

  useEffect(() => {
    fetchExistingQuestion()
  }, [fetchExistingQuestion])

  // ── Live Socket Updates ──────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return

    socket.on("round-question-generating", () => {
      setStatus('generating')
      setError('')
    })

    socket.on("round-question-regenerating", () => {
      setStatus('regenerating')
      setError('')
    })

    socket.on("round-question-ready", (data) => {
      setQuestion(data)
      setStatus('ready')
      setError('')
    })

    socket.on("round-question-failed", (data) => {
      setStatus('failed')
      setError(data?.error || 'Failed to generate question')
    })

    return () => {
      socket.off("round-question-generating")
      socket.off("round-question-regenerating")
      socket.off("round-question-ready")
      socket.off("round-question-failed")
    }
  }, [roomId])

  // ── Host Actions ────────────────────────────────────────────────────────
  const handleStartRound = () => {
    socket.emit("start-round", {
      inviteCode: roomId,
      roundNumber,
      topic: selectedTopic,
      difficulty: selectedDifficulty,
    })
  }

  const handleRegenerate = () => {
    socket.emit("regenerate-round-question", {
      inviteCode: roomId,
      roundNumber,
      topic: question?.topic || selectedTopic,
      difficulty: question?.difficulty || selectedDifficulty,
    })
  }

  const isBusy = status === 'generating' || status === 'regenerating'
  const isLoading = status === 'loading'

  return (
    <div className="h-full w-full flex flex-col bg-slate-900 border-2 border-slate-800 rounded-lg overflow-hidden">

      {/* ─── PANEL HEADER ─── */}
      <div className="border-b-2 border-slate-800 bg-slate-950 px-4 py-3 flex items-center justify-between shrink-0">
        <span className="text-xxs font-black tracking-widest text-slate-400 uppercase">
          Problem Statement
        </span>
        {question && (
          <span className="text-xxs font-bold text-slate-600 uppercase tracking-wider">
            Round {question.roundNumber}
          </span>
        )}
      </div>

      {/* ─── HOST CONTROLS ─── */}
      {isHost && (
        <div className="border-b-2 border-slate-800 bg-slate-950/60 px-4 py-3 shrink-0 space-y-2.5">
          <div className="flex gap-2">
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={isBusy || isLoading}
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              disabled={isBusy || isLoading}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer uppercase"
            >
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            {status !== 'ready' ? (
              <button
                onClick={handleStartRound}
                disabled={isBusy || isLoading}
                className={`flex-1 rounded py-2 text-xxs font-black uppercase tracking-wider transition ${
                  isBusy || isLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                }`}
              >
                {isBusy ? 'Generating...' : '⚡ Start Round'}
              </button>
            ) : (
              <button
                onClick={handleRegenerate}
                disabled={isBusy || isLoading}
                className={`flex-1 rounded py-2 text-xxs font-black uppercase tracking-wider transition ${
                  isBusy || isLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 text-slate-950 cursor-pointer'
                }`}
              >
                {isBusy ? 'Regenerating...' : '🔄 Regenerate Question'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── PANEL BODY ─── */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-800">

        {/* ── LOADING STATE ── */}
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
            <div className="h-8 w-8 rounded-full border-[3px] border-slate-700 border-t-slate-400 animate-spin" />
            <p className="text-xs text-slate-600 uppercase tracking-wider">
              Checking for active round...
            </p>
          </div>
        )}

        {/* ── IDLE STATE ── */}
        {status === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
            <div className="h-12 w-12 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-700 text-2xl">
              ?
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Waiting for Round
            </p>
            <p className="text-xs text-slate-600 max-w-[220px]">
              {isHost
                ? 'Pick a topic and difficulty above, then start the round.'
                : "The host hasn't started a round yet. Sit tight."}
            </p>
          </div>
        )}

        {/* ── GENERATING / REGENERATING STATE ── */}
        {isBusy && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
            <div className="h-10 w-10 rounded-full border-[3px] border-slate-700 border-t-blue-500 animate-spin" />
            <p className="text-sm font-bold text-blue-400 uppercase tracking-wide animate-pulse">
              {status === 'generating' ? 'Generating Question...' : 'Regenerating Question...'}
            </p>
            <p className="text-xs text-slate-600 max-w-[220px]">
              AI is crafting a fresh challenge. This usually takes a few seconds.
            </p>
          </div>
        )}

        {/* ── FAILED STATE ── */}
        {status === 'failed' && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
            <div className="h-12 w-12 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-400 text-xl">
              ✕
            </div>
            <p className="text-sm font-bold text-red-400 uppercase tracking-wide">
              Generation Failed
            </p>
            <p className="text-xs text-slate-500 max-w-[240px]">
              {error}
            </p>
            {isHost && (
              <p className="text-xxs text-slate-700 uppercase tracking-wider mt-2">
                Try Start Round again above
              </p>
            )}
          </div>
        )}

        {/* ── READY STATE ── */}
        {status === 'ready' && question && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xxs font-black uppercase tracking-wider px-2 py-0.5 rounded border ${DIFFICULTY_STYLES[question.difficulty] || DIFFICULTY_STYLES.medium}`}>
                  {question.difficulty}
                </span>
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider px-2 py-0.5 rounded border border-slate-700 bg-slate-800/50">
                  {question.topic}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-100 leading-snug">
                {question.title}
              </h2>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {question.prompt}
            </div>

            {question.constraints && (
              <div className="border-l-2 border-slate-700 pl-3">
                <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Constraints
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {question.constraints}
                </p>
              </div>
            )}

            {question.sampleTestCases?.length > 0 && (
              <div className="space-y-3">
                <p className="text-xxs font-bold text-slate-500 uppercase tracking-wider">
                  Sample Test Cases
                </p>
                {question.sampleTestCases.map((tc, i) => (
                  <div key={i} className="rounded border border-slate-800 bg-slate-950 overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                      <span className="text-xxs font-black text-slate-500 uppercase tracking-wider">
                        Example {i + 1}
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <span className="text-xxs font-bold text-slate-600 uppercase">Input</span>
                        <pre className="mt-1 text-xs text-slate-300 font-mono bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                          {tc.input || '(empty)'}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xxs font-bold text-slate-600 uppercase">Output</span>
                        <pre className="mt-1 text-xs text-emerald-300 font-mono bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                          {tc.expectedOutput || '(empty)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800">
              <p className="text-xxs text-slate-600 uppercase tracking-wider">
                ⏱ Time Limit: {(question.timeLimitMs / 1000).toFixed(0)}s per test case
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}