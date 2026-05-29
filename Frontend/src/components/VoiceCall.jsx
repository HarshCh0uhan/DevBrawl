import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent} from 'livekit-client'
import api from '../utils/axios'

export default function VoiceCall({ roomName }) {
  const roomRef = useRef(null)
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [participants, setParticipants] = useState([])

  const joinCall = async () => {
    try {
      // 1. Get token from backend
      const res = await api.get(`/users/voice-token?roomName=${roomName}`)
      const { token, url } = res.data

      // 2. Create LiveKit room
      const room = new Room()
      roomRef.current = room

      // 3. Listen to participant events
      room.on(RoomEvent.ParticipantConnected, () => {
        setParticipants([...room.remoteParticipants.values()])
        console.log("👤 participant joined voice")
      })

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setParticipants([...room.remoteParticipants.values()])
        console.log("👤 participant left voice")
      })

      // 4. Connect and enable mic
      await room.connect(url, token)
      await room.localParticipant.setMicrophoneEnabled(true)
      
      setJoined(true)
      console.log("🎙️ joined LiveKit room:", roomName)
    } catch (err) {
      console.error("❌ voice join error:", err.message)
    }
  }

//   const leaveCall = async () => {
//     await roomRef.current?.disconnect()
//     roomRef.current = null
//     setJoined(false)
//     setMuted(false)
//     setParticipants([])
//   }

  const toggleMute = async () => {
    await roomRef.current?.localParticipant.setMicrophoneEnabled(muted)
    setMuted(!muted)
  }

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect()
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      {!joined ? (
        <button
          onClick={joinCall}
          className="rounded px-3 py-1 text-xxs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-700 cursor-pointer transition"
        >
          🎙️
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {/* Voice participants indicators */}
          {participants.length > 0 && (
            <div className="flex items-center gap-1 text-xxs text-emerald-400 font-black">
              🔊 {participants.length + 1} in call
            </div>
          )}

          <button
            onClick={toggleMute}
            className={`rounded px-3 py-1 text-xxs font-black uppercase tracking-wider border cursor-pointer transition ${
              muted
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
            }`}
          >
            {muted ? '🔇 Unmute' : '🎙️ Mute'}
          </button>

          {/* <button
            onClick={leaveCall}
            className="rounded px-3 py-1 text-xxs font-black uppercase tracking-wider bg-red-950 text-red-400 border border-red-900 cursor-pointer transition hover:bg-red-900"
          >
            📵 Leave
          </button> */}
        </div>
      )}
    </div>
  )
}