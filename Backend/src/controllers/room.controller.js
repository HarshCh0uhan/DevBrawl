import { Room } from "../model/room.model.js";
import { ApiError } from "../utils/apiError.js";
import { AccessToken } from 'livekit-server-sdk'

const createRoomInternal = async (payload, user) => {
    const { name, maxParticipants } = payload || {};

    if (!user?._id) {
        throw new ApiError(401, "Authentication failed. User context missing.");
    }

    const room = await Room.create({
        name: name || `Room-${user.username}`,
        hostId: user._id,
        // language: language || "javascript",
        maxParticipants: maxParticipants || 8,
        code: "",
        participants: [{ userId: user._id, username: user.username }],
    });

    return room;
};

const joinRoomInternal = async (payload, user) => {
    const { inviteCode } = payload;

    if (!inviteCode) throw new ApiError(400, "Invitation code is required");
    if (!user?._id) throw new ApiError(401, "Authentication failed");

    const room = await Room.findOne({ 
        inviteCode: inviteCode.trim().toUpperCase(), 
        isActive: true 
    });

    if (!room) throw new ApiError(404, "Room not found or deactivated");

    if (room.participants.length >= room.maxParticipants) {
        throw new ApiError(400, "Room is full");
    }

    const isAlreadyInside = room.participants.some(
        (p) => p.userId.toString() === user._id.toString()
    );

    if (isAlreadyInside) return room;

    room.participants.push({
        userId: user._id,
        username: user.username || "Participant"
    });

    await room.save();
    return room;
};

const leaveRoomInternal = async (inviteCode, userId) => {
    if (!inviteCode || !userId) return null;

    const room = await Room.findOneAndUpdate(
        { inviteCode: inviteCode.toUpperCase() },
        { $pull: { participants: { userId } } },
        { returnDocument: 'after' }
    );

    return room || null;
};

export const generateLiveKitToken = async (roomName, username) => {
    const token = new AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        { identity: username }
    )
    
    token.addGrant({ 
        roomJoin: true, 
        room: roomName,
        canPublish: true,
        canSubscribe: true,
    })

    return token.toJwt()
}

export { createRoomInternal, joinRoomInternal, leaveRoomInternal };