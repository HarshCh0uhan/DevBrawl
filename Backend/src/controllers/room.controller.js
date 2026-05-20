import { Room } from "../model/room.model.js";
import { ApiError } from "../utils/apiError.js";

 
const createRoomInternal = async (payload, user) => {
    const { name, language, maxParticipants } = payload;

    if (!name || !language) {
        throw new ApiError(400, "Room name and language are required");
    }

    if (!user?._id) {
        throw new ApiError(401, "Authentication failed. User context missing.");
    }

    const room = await Room.create({
        name,
        hostId: user._id,
        language: language.toLowerCase(),
        maxParticipants: maxParticipants || 8,
        code: "",
        participants: [
            {
                userId: user._id,
                username: user.username || "Host",
            }
        ]
    });

    if (!room) {
        throw new ApiError(500, "Failed to initialize collaborative room state");
    }

    return room;
};

const joinRoomInternal = async (payload, user) => {
    const { inviteCode } = payload;

    if (!inviteCode) {
        throw new ApiError(400, "Invitation code is required to join");
    }

    if (!user?._id) {
        throw new ApiError(401, "Authentication failed. User context missing.");
    }

    const room = await Room.findOne({ 
        inviteCode: inviteCode.trim().toUpperCase(), 
        isActive: true 
    });

    if (!room) {
        throw new ApiError(404, "Room not found or has been deactivated");
    }
    const isAlreadyInside = room.participants.some(
        (p) => p.userId.toString() === user._id.toString()
    );
    if (room.participants.length >= room.maxParticipants) {
    throw new ApiError(400, "Room is full. Cannot join session");
    }
    if (isAlreadyInside) {
        return room;
    }

    room.participants.push({
        userId: user._id,
        username: user.username || "Participant"
    });

    await room.save();

    return room;
};


export { createRoomInternal ,joinRoomInternal };

