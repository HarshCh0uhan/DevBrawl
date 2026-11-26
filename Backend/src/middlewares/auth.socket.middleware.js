import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { verifyAccessToken } from "../utils/verifyAccessToken.js";

export const socketAuthMiddleware = async (socket, next) => {
    try {

        const token = socket.handshake.auth?.token || 
                      socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
            return next(new ApiError(401, "Authentication error: Token missing"));
        }


        const decodedToken = verifyAccessToken(token);

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            return next(new ApiError(401, "Authentication error: User not found"));
        }

        socket.user = user;
        
        next();
    } catch (error) {
        console.error("🔒 Socket Auth Failure:", error.message);
        // Client reads err.data.code in its connect_error handler to decide to log out.
        const authError = new ApiError(401, "Authentication error: Invalid or expired token");
        authError.data = { code: error.code || "TOKEN_INVALID" };
        return next(authError);
    }
};