import { useParams } from 'react-router-dom'
import CollaborativeCanvas from '../utils/tldraw'
import { useEffect } from 'react'
import { socket } from '../utils/socket'

export default function RoomPage() {
  const { inviteCode } = useParams()

  useEffect(() => {
    socket.emit("join-room", { inviteCode }, (res) => {
      console.log("🏠 joined room:", res)
    })
  }, [inviteCode])

  return (
    <CollaborativeCanvas
      roomId={inviteCode}
    />
  )
}