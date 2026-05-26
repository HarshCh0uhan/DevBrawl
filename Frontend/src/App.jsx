import './App.css'
import 'tldraw/tldraw.css'
import CollaborativeCanvas from './utils/tldraw'
import { useEffect } from 'react'
import { socket } from './utils/socket'

function App() {
  const roomId = "JFFBHK"  

  useEffect(() => {
    socket.emit("join-room", { inviteCode: roomId }, (res) => {
      console.log("🏠 joined room:", res)
    })
  }, [])

  return (
    <CollaborativeCanvas
      roomId={roomId}
      currentUser={{ id: '123', username: 'leon' }}
    />
  )
}

export default App