

import Editor from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { socket } from '../utils/socket'
import api from '../utils/axios'

export default function MonacoEditor({ roomId, language, languageId }) {
  const editorRef = useRef(null)
  const isRemoteChange = useRef(false)

  // Console terminal panel layouts
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState('Terminal ready. Execution via cloud sandbox enabled.')
  const [executionStatus, setExecutionStatus] = useState('')

  const handleEditorMount = (editor) => {
    editorRef.current = editor

    // Auto focus when mounted — safely isolated from tldraw now
    editor.focus()

    editor.onDidChangeModelContent(() => {
      if (isRemoteChange.current) return
      const code = editor.getValue()
      socket.emit("code-change", { roomId, code })
    })
  }

  useEffect(() => {
    socket.on("receive-code-change", (data) => {
      if (!editorRef.current) return

      isRemoteChange.current = true
      const currentPosition = editorRef.current.getPosition()
      editorRef.current.setValue(data.code)
      if (currentPosition) {
        editorRef.current.setPosition(currentPosition)
      }
      isRemoteChange.current = false
    })

    return () => socket.off("receive-code-change")
  }, [roomId])

  // --- TRIGGER SANDBOX CODE COMPILATION ---
  const handleRunCode = async () => {
    if (!editorRef.current || isRunning) return

    const sourceCode = editorRef.current.getValue()
    setIsRunning(true)
    setConsoleOpen(true)
    setTerminalOutput('Forwarding payload to isolated execution sandbox container...')
    setExecutionStatus('RUNNING...')

    try {
      const response = await api.post('compiler/run-code', {
        sourceCode,
        languageId
      })

      if (response.data.success) {
        setTerminalOutput(response.data.output)
        setExecutionStatus(response.data.status || 'SUCCESS')
      } else {
        setTerminalOutput(response.data.output || 'Compilation error occurred.')
        setExecutionStatus('ERROR')
      }
    } catch (error) {
      console.error("❌ Sandbox compilation handler failed:", error.message)
      setTerminalOutput(error.response?.data?.output || 'Failed to communicate with runtime server sandbox.')
      setExecutionStatus('CRITICAL FAILURE')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-950">
      
      {/* MONACO MAIN COMPILER FIELD */}
      <div className="flex-1 min-h-0 w-full relative">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language} // Dynamic synchronization binding
          defaultValue="// Start crushing algorithms here..."
          options={{
            fontSize: 14,
            fontFamily: 'Fira Code, Monaco, Courier New, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12 },
          }}
          onMount={handleEditorMount}
        />

        {/* FLOATING ACTION TRIGGER RUNNER */}
        <button
          onClick={handleRunCode}
          disabled={isRunning}
          className={`absolute bottom-4 right-6 z-30 font-mono font-black text-xs tracking-widest px-4 py-2 rounded shadow-2xl transition border cursor-pointer uppercase ${
            isRunning 
              ? 'bg-slate-800 text-slate-500 border-slate-700 animate-pulse'
              : 'bg-emerald-500 text-slate-950 border-emerald-600 hover:bg-emerald-400 active:scale-95'
          }`}
        >
          {isRunning ? '⚡ Running...' : '▶ Run_Code'}
        </button>
      </div>

      {/* ─── SLIDE-UP TERMINAL CONSOLE LOGS DRAWER ─── */}
      <div 
        className={`border-t border-slate-800 bg-slate-900 transition-all duration-200 flex flex-col shrink-0 z-30 ${
          consoleOpen ? 'h-52' : 'h-8'
        }`}
      >
        <div 
          onClick={() => setConsoleOpen(!consoleOpen)}
          className="bg-slate-950 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <span className="text-xxs font-black tracking-widest text-slate-500 uppercase">Sandbox_Terminal_Output</span>
            {executionStatus && (
              <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded ${
                executionStatus === 'Accepted' || executionStatus === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                executionStatus === 'RUNNING...' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {executionStatus}
              </span>
            )}
          </div>
          <span className="text-slate-500 text-xs font-black font-mono">
            {consoleOpen ? '▼' : '▲'}
          </span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-left bg-slate-950/40 text-slate-300 selection:bg-slate-800 break-all whitespace-pre-wrap">
          {terminalOutput}
        </div>
      </div>

    </div>
  )
}