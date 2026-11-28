import { Room } from "../models/room.model.js";
import { ApiError } from "../utils/apiError.js";
import { AccessToken } from 'livekit-server-sdk'
import { env } from "../config/env.js";
import bcrypt from "bcryptjs";

const createRoomInternal = async (payload, user) => {
    const { name, maxParticipants, isPublic = false, isPrivate = false, password, settings } = payload || {};

    if (!user?._id) {
        throw new ApiError(401, "Authentication failed. User context missing.");
    }

    if (isPrivate && !password) {
        throw new ApiError(400, "Room password is required");
    }

    const roomData = {
        name: name || `${user.username}'s Room`,
        hostId: user._id,
        isPublic: Boolean(isPublic && !isPrivate),
        isPrivate: Boolean(isPrivate),
        settings: settings || { maxPlayers: maxParticipants || 4 },
        code: "",
        // The host is implicitly ready; otherwise nobody could ever start.
        participants: [{ userId: user._id, username: user.username, isReady: true }],
    };

    if (isPrivate) {
        const salt = await bcrypt.genSalt(10);
        roomData.password = await bcrypt.hash(password, salt);
    }

    const room = await Room.create(roomData);

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

    // Check membership BEFORE capacity: someone already in a full room must be
    // able to re-join (refresh / reconnect) instead of being told it is full.
    const isAlreadyInside = room.participants.some(
        (p) => p.userId.toString() === user._id.toString()
    );

    if (isAlreadyInside) return room;

    const maxPlayers = room.settings?.maxPlayers ?? 4;
    if (room.participants.length >= maxPlayers) {
        throw new ApiError(400, "Room is full");
    }

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
        env.livekitApiKey,
        env.livekitApiSecret,
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
