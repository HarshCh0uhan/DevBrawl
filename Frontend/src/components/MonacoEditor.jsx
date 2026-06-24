
import Editor from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { socket } from '../utils/socket'
import api from '../utils/axios'

export default function MonacoEditor({ 
  roomId, 
  language, 
  languageId, 
  readOnly = false,
  // 🚀 New Turn State Properties Linked from RoomPage.jsx
  isMyTurn = false,
  turnStatus = 'waiting',
  onFinalSubmit,
  isSubmitting = false 
}) {
  const editorRef = useRef(null)
  const isRemoteChange = useRef(false)

  const [consoleOpen, setConsoleOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState('Terminal ready. Execution via cloud sandbox enabled.')
  const [executionStatus, setExecutionStatus] = useState('')

  const handleEditorMount = (editor) => {
    editorRef.current = editor
    if (!readOnly) editor.focus()

    editor.onDidChangeModelContent(() => {
      if (isRemoteChange.current) return
      if (readOnly) return
      const code = editor.getValue()
      socket.emit("code-change", { roomId, code })
    })
  }

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({ readOnly })
  }, [readOnly])

  useEffect(() => {
    socket.on("receive-code-change", (data) => {
      if (!editorRef.current) return
      isRemoteChange.current = true
      const currentPosition = editorRef.current.getPosition()
      editorRef.current.setValue(data.code)
      if (currentPosition) editorRef.current.setPosition(currentPosition)
      isRemoteChange.current = false
    })
    return () => socket.off("receive-code-change")
  }, [roomId])

  const handleRunCode = async () => {
    if (!editorRef.current || isRunning || readOnly) return

    const sourceCode = editorRef.current.getValue()
    setIsRunning(true)
    setConsoleOpen(true)
    setTerminalOutput('Forwarding payload to isolated execution sandbox container...')
    setExecutionStatus('RUNNING')

    try {
      const response = await api.post('compiler/run-code', {
        sourceCode,
        languageId,
        roomId
      })

      const { success, status, output, stderr } = response.data
      setExecutionStatus(status || 'UNKNOWN')

      if (success) {
        let display = (!output || output === '(no output)')
          ? '✓ Program exited cleanly with no output.'
          : output
        if (stderr && stderr.trim()) {
          display += `\n\n─── stderr ───\n${stderr.trim()}`
        }
        setTerminalOutput(display)
      } else {
        setTerminalOutput(output || stderr || 'An error occurred during execution.')
      }

    } catch (error) {
      console.error("❌ Sandbox error:", error.message)
      const serverMsg = error.response?.data?.output || error.response?.data?.message
      setTerminalOutput(serverMsg || 'Failed to communicate with runtime server sandbox.')
      setExecutionStatus('CONNECTION ERROR')
    } finally {
      setIsRunning(false)
    }
  }

  // 🚀 Local submission wrapper to extract current code cleanly
  const executeSubmitBrawl = () => {
    if (!editorRef.current || isSubmitting) return
    const codePayload = editorRef.current.getValue()
    onFinalSubmit(codePayload)
  }

  const badgeClass = (() => {
    if (!executionStatus) return ''
    const s = executionStatus.toLowerCase()
    if (s === 'accepted') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    if (s === 'running') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    return 'bg-red-500/10 text-red-400 border border-red-500/20'
  })()

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-950">

      <div className="flex-1 min-h-0 w-full relative">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          defaultValue="// Start crushing algorithms here..."
          options={{
            fontSize: 14,
            fontFamily: 'Fira Code, Monaco, Courier New, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12 },
            readOnly,
            renderLineHighlight: readOnly ? 'none' : 'line',
          }}
          onMount={handleEditorMount}
        />

        {/* 🚀 ACTION BUTTON CONTAINER: Placed elegantly at the bottom right */}
        {!readOnly && (
          <div className="absolute bottom-4 right-6 z-30 flex items-center gap-2">
            
            {/* Run Button */}
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`font-mono font-black text-xs tracking-widest px-4 py-2 rounded shadow-2xl transition border cursor-pointer uppercase ${
                isRunning
                  ? 'bg-slate-800 text-slate-500 border-slate-700'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 active:scale-95'
              }`}
            >
              {isRunning ? '⚡ Running...' : '▶ Run_Code'}
            </button>

            {/* Submit Brawl Button — Visible only during active coder turn status */}
            {turnStatus === 'turn_active' && isMyTurn && (
              <button
                onClick={executeSubmitBrawl}
                disabled={isSubmitting}
                className={`font-mono font-black text-xs tracking-widest px-4 py-2 rounded shadow-2xl transition border cursor-pointer uppercase ${
                  isSubmitting
                    ? 'bg-slate-800 text-slate-500 border-slate-700 animate-pulse'
                    : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500 active:scale-95'
                }`}
              >
                {isSubmitting ? 'Submitting...' : '🚀 Submit_Brawl'}
              </button>
            )}

          </div>
        )}
      </div>

      {/* Terminal drawer */}
      <div className={`border-t border-slate-800 bg-slate-900 transition-all duration-200 flex flex-col shrink-0 z-30 ${consoleOpen ? 'h-52' : 'h-8'}`}>
        <div
          onClick={() => setConsoleOpen(!consoleOpen)}
          className="bg-slate-950 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <span className="text-xxs font-black tracking-widest text-slate-500 uppercase">Sandbox_Terminal_Output</span>
            {executionStatus && (
              <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded ${badgeClass}`}>
                {executionStatus}
              </span>
            )}
          </div>
          <span className="text-slate-500 text-xs font-black font-mono">{consoleOpen ? '▼' : '▲'}</span>
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-left bg-slate-950/40 text-slate-300 selection:bg-slate-800 break-all whitespace-pre-wrap">
          {terminalOutput}
        </div>
      </div>

    </div>
  )
}