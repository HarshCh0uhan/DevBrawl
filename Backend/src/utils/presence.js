import { leaveRoomInternal } from "../controllers/room.controller.js";

// How long a dropped socket may stay away before the user is removed from the
// room. Covers page refresh, brief network blips and tab sleep: the client
// re-joins on reconnect and cancels the pending removal.
const GRACE_MS = () => Number(process.env.PRESENCE_GRACE_MS ?? 10000);

const pendingLeaves = new Map(); // "ROOM:userId" -> Timeout

const keyOf = (roomCode, userId) => `${String(roomCode).toUpperCase()}:${userId}`;

export const cancelPendingLeave = (roomCode, userId) => {
  const key = keyOf(roomCode, userId);
  const timer = pendingLeaves.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingLeaves.delete(key);
  }
};

// True when the user still has at least one connected socket inside the room
// (second tab, or the refreshed tab that already re-joined). Relies on
// socket.data.userId, which is set on connection in utils/socket.js.
export const hasLiveSocket = async (io, roomCode, userId) => {
  const sockets = await io.in(String(roomCode).toUpperCase()).fetchSockets();
  return sockets.some((s) => s.data?.userId === String(userId));
};

// Removes the participant from MongoDB and tells everyone left in the room.
export const removeUserFromRoom = async (io, roomCode, user) => {
  const code = String(roomCode).toUpperCase();
  const room = await leaveRoomInternal(code, user._id);
  if (!room) return null;

  io.to(code).emit("user-left", {
    userId: user._id,
    username: user.username,
    systemMessage: `${user.username} has left the workspace.`,
    participants: room.participants,
  });
  return room;
};

// Called when a socket drops. Removal is delayed; a re-join cancels it, and at
// expiry it is skipped if the user is connected through another socket.
export const scheduleLeave = (io, roomCode, user) => {
  const key = keyOf(roomCode, user._id);
  cancelPendingLeave(roomCode, user._id);

  const timer = setTimeout(async () => {
    pendingLeaves.delete(key);
    try {
      if (await hasLiveSocket(io, roomCode, user._id)) return;
      await removeUserFromRoom(io, roomCode, user);
    } catch (err) {
      console.error(`❌ Delayed leave failed for ${key}:`, err.message);
    }
  }, GRACE_MS());

  timer.unref?.();
  pendingLeaves.set(key, timer);
};
