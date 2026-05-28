import Editor from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import { socket } from '../utils/socket'


export default function MonacoEditor({ roomId }) {
  const editorRef = useRef(null)
  const isRemoteChange = useRef(false)

  const handleEditorMount = (editor) => {
    editorRef.current = editor

    // Send changes to others
    editor.onDidChangeModelContent(() => {
      if (isRemoteChange.current) return

      const code = editor.getValue()
      socket.emit("code-change", { roomId, code })
    })
  }

  useEffect(() => {
    // Receive changes from others
    socket.on("receive-code-change", (data) => {
      if (!editorRef.current) return

      isRemoteChange.current = true
      const currentPosition = editorRef.current.getPosition()
      editorRef.current.setValue(data.code)
      editorRef.current.setPosition(currentPosition) // preserve cursor
      isRemoteChange.current = false
    })

    return () => socket.off("receive-code-change")
  }, [roomId])

  return (
    
    <div 
      className="w-full h-full"
      onKeyDownCapture={(e) => e.stopPropagation()}
      onKeyUpCapture={(e) => e.stopPropagation()}
    >
      <Editor
      height="100%"
      defaultLanguage="javascript"
      defaultValue="// Start coding..."
      theme="vs-dark"
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
      }}
      onMount={handleEditorMount}
    />

      <div className="w-full h-full bg-slate-950">
        {/* e.g., <Editor height="100%" theme="vs-dark" ... /> */}
      </div>
    </div>
  )
}