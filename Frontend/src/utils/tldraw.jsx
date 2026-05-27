
import { Tldraw, useEditor } from 'tldraw'
import { useEffect, useRef } from 'react'
import { socket } from './socket'

function SyncedCanvas({ roomId }) {
  const editor = useEditor()
  const isRemoteChange = useRef(false)

  useEffect(() => {
    if (!editor || !roomId) return

    socket.roomId = roomId;

const cleanupListener = editor.store.listen((update) => {
  if (isRemoteChange.current) return

  const { changes } = update;
  
  const payload = {
    roomId,
    added: changes.added,
    updated: changes.updated,
    removed: changes.removed,
  }

  if (
    Object.keys(payload.added).length > 0 ||
    Object.keys(payload.updated).length > 0 ||
    Object.keys(payload.removed).length > 0
  ) {
    console.log("📤 emitting canvas-change:", payload) // ← add
    socket.emit("canvas-change", payload)
  }
}, { source: 'user', scope: 'document' })


    socket.on("receive-canvas-change", (data) => {
    console.log("📥 received canvas-change:", data)
      isRemoteChange.current = true

      editor.store.mergeRemoteChanges(() => {
    
        if (data.removed && Object.keys(data.removed).length > 0) {
          Object.keys(data.removed).forEach((id) => {
            if (editor.store.has(id)) editor.store.remove([id])
          })
        }
        
        if (data.added && Object.keys(data.added).length > 0) {
          Object.values(data.added).forEach((record) => {
            editor.store.put([record])
          })
        }

        if (data.updated && Object.keys(data.updated).length > 0) {
          Object.values(data.updated).forEach(([, record]) => {
            editor.store.put([record])
          })
        }
      })

      isRemoteChange.current = false
    })

    return () => {
      cleanupListener()
      socket.off("receive-canvas-change")
    }
  }, [editor, roomId])

  return null
}

export default function CollaborativeCanvas({ roomId, currentUser }) {
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <Tldraw>
        <SyncedCanvas roomId={roomId} />
      </Tldraw>
    </div>
  )
}