import jwt from "jsonwebtoken";
import { User } from "../model/user.model.js";
import { ApiError } from "../utils/apiError.js";

export const socketAuthMiddleware = async (socket, next) => {
    try {

        const token = socket.handshake.auth?.token || 
                      socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
            return next(new ApiError(401, "Authentication error: Token missing"));
        }


        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            return next(new ApiError(401, "Authentication error: User not found"));
        }

        socket.user = user;
        
        next();
    } catch (error) {
        console.error("🔒 Socket Auth Failure:", error.message);
        return next(new ApiError(401, "Authentication error: Invalid or expired token"));
    }
};